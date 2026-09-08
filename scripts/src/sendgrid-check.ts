// Report — and optionally exercise — SendGrid email delivery.
//
// This is the tool for the "we'll make sure all names are authenticated" step.
// It shows whether the sending domain is authenticated, the exact DNS records to
// publish when it isn't, and where each of the three senders stands.
//
//   pnpm --filter @workspace/scripts run sendgrid:check
//   pnpm --filter @workspace/scripts run sendgrid:check --validate
//   pnpm --filter @workspace/scripts run sendgrid:check --send you@example.com --from support
//
// Requires SENDGRID_API_KEY. The key is never printed. Exits 1 when the account
// is not ready to send as every sender, so it can gate a go-live.

import {
  accountScopes,
  domainAuthentication,
  emailStatus,
  isSandbox,
  isSenderKey,
  mailDomain,
  sendEmail,
  validateDomainAuthentication,
  type SenderAuthentication,
} from "@workspace/sendgrid";

const args = process.argv.slice(2);
const has = (name: string) => args.includes(`--${name}`);
const flag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

function die(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const EXPLAIN: Record<string, string> = {
  not_configured: "SENDGRID_API_KEY is not set in this environment.",
  unauthorized: "SendGrid rejected the API key. Create a new one and update the secret.",
  forbidden: "The API key is valid but lacks the scope for this call. A Full Access key, or one with Mail Send + Sender Authentication, is needed.",
  sender_not_authenticated: "SendGrid will not send as that From address yet — the domain or the single sender is unverified.",
  rate_limited: "SendGrid is rate-limiting us; try again shortly.",
  payload_rejected: "SendGrid refused the message itself.",
  timeout: "SendGrid did not respond in time.",
  network: "Could not reach SendGrid from here.",
  upstream_error: "SendGrid returned an unexpected error.",
};
const explain = (error: string, detail?: string) => `${EXPLAIN[error] ?? `SendGrid returned: ${error}`}${detail ? ` (${detail})` : ""}`;

const MARK: Record<SenderAuthentication, string> = { domain: "✓", single_sender: "✓", unverified: "✗", unknown: "?" };
const AUTH_LABEL: Record<SenderAuthentication, string> = {
  domain: "domain authenticated",
  single_sender: "single sender verified",
  unverified: "NOT authenticated",
  unknown: "unknown",
};

const pad = (value: string, width: number) => value + " ".repeat(Math.max(0, width - value.length));

async function report(): Promise<boolean> {
  const status = await emailStatus({ refresh: true });

  console.log(`\nSendGrid — ${status.domain}`);
  console.log("─".repeat(72));
  console.log(`API key            ${status.configured ? "present" : "MISSING — set SENDGRID_API_KEY"}`);
  if (!status.configured) { console.log(""); return false; }

  const scopes = await accountScopes();
  if (scopes.ok) {
    const canSend = scopes.data.some(scope => scope.startsWith("mail.send"));
    const canReadAuth = scopes.data.some(scope => scope.startsWith("whitelabel"));
    console.log(`Key scopes         mail.send ${canSend ? "✓" : "✗"} · sender authentication ${canReadAuth ? "✓" : "✗"} (${scopes.data.length} scopes)`);
  } else {
    console.log(`Key scopes         could not read — ${explain(scopes.error, scopes.detail)}`);
  }
  if (status.sandbox) console.log("Sandbox            ON — messages are validated by SendGrid and then discarded (SENDGRID_SANDBOX)");

  const auth = status.domainAuthentication;
  console.log("");
  if (!auth) {
    console.log(`Domain auth        NONE for ${status.domain}`);
    console.log("                   Create it in SendGrid: Settings → Sender Authentication → Authenticate Your Domain,");
    console.log(`                   for ${status.domain}, then publish the CNAMEs it gives you and re-run this with --validate.`);
  } else {
    console.log(`Domain auth        ${auth.valid ? "VALID" : "PENDING — DNS not verified yet"} · id ${auth.id}${auth.subdomain ? ` · subdomain ${auth.subdomain}` : ""}${auth.isDefault ? " · default" : ""}`);
    // Only worth printing while they are still actionable.
    if (!auth.valid && auth.records.length) {
      console.log("\n  DNS records (publish these on the domain's nameserver):");
      const width = Math.max(...auth.records.map(record => record.host.length), 20);
      for (const record of auth.records) {
        console.log(`  ${record.valid ? "✓" : "✗"} ${pad(record.type.toUpperCase(), 6)} ${pad(record.host, width)}  →  ${record.data}`);
      }
    }
  }

  console.log("\n  Senders:");
  const width = Math.max(...status.senders.map(sender => sender.email.length));
  for (const sender of status.senders) {
    const offDomain = sender.onMailDomain ? "" : "  ← off the authenticated domain";
    console.log(`  ${MARK[sender.authentication]} ${pad(sender.key, 8)} ${pad(sender.email, width)}  ${pad(AUTH_LABEL[sender.authentication], 24)} replies → ${sender.replyTo}${offDomain}`);
  }

  if (status.error) console.log(`\n  Note: ${explain(status.error, status.detail)}`);
  console.log("");
  console.log(status.ready
    ? "✓ Ready — every sender is authenticated and can send."
    : "✗ Not ready — see above. Domain authentication covers all three senders at once, so it is the fix worth doing.");
  console.log("");
  return status.ready;
}

if (has("validate")) {
  const auth = await domainAuthentication();
  if (!auth.ok) die(explain(auth.error, auth.detail));
  if (!auth.data) die(`No domain authentication exists for ${mailDomain()} yet. Create it in SendGrid first.`);
  console.log(`\nAsking SendGrid to re-check DNS for ${auth.data.domain}…`);
  const result = await validateDomainAuthentication(auth.data.id);
  if (!result.ok) die(explain(result.error, result.detail));
  console.log(result.data.valid ? "✓ SendGrid now sees every record." : "✗ SendGrid still cannot see every record — DNS may not have propagated.");
}

const recipient = flag("send");
if (recipient) {
  const key = flag("from") ?? "noreply";
  if (!isSenderKey(key)) die(`Unknown sender "${key}". Use one of: noreply, support, joshua.`);
  console.log(`\nSending a test message to ${recipient} as ${key}${isSandbox() ? " (sandbox — SendGrid will validate and discard it)" : ""}…`);
  const sent = await sendEmail({
    to: recipient,
    from: key,
    subject: `Phoenix Operations email delivery test (${key})`,
    text: `This is a delivery test sent as the "${key}" sender. If it reached you, that From address is authenticated and delivering.`,
    html: `<p>This is a delivery test sent as the <strong>${key}</strong> sender.</p><p>If it reached you, that From address is authenticated and delivering.</p>`,
    categories: ["delivery-test"],
  });
  if (!sent.ok) die(explain(sent.error, sent.detail));
  console.log(`✓ Accepted by SendGrid from ${sent.data.from}${sent.data.messageId ? ` · message id ${sent.data.messageId}` : ""}${sent.data.sandbox ? " · sandbox, nothing was delivered" : ""}\n`);
}

const ready = await report();
process.exit(ready ? 0 : 1);
