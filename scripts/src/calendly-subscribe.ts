// Manage the Calendly webhook subscription that keeps Phoenix in sync with
// cancellations and reschedules.
//
// Calendly has no UI for webhook subscriptions — they exist only through the API,
// and the signing key is shown exactly once, when the subscription is created.
// That key is what the server needs as CALENDLY_WEBHOOK_SIGNING_KEY.
//
//   pnpm --filter @workspace/scripts run calendly:subscribe            # list (read-only)
//   pnpm --filter @workspace/scripts run calendly:subscribe create --url https://host/api/webhooks/calendly
//   pnpm --filter @workspace/scripts run calendly:subscribe delete <uuid-or-uri>
//
// Requires CALENDLY_PERSONAL_ACCESS_TOKEN. The token is never printed.

import {
  createWebhookSubscription,
  currentUser,
  deleteWebhookSubscription,
  isConfigured,
  listWebhookSubscriptions,
} from "@workspace/calendly";

const REQUIRED_EVENTS = ["invitee.created", "invitee.canceled"];

function die(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const explain = (error: string, detail?: string) => {
  const notes: Record<string, string> = {
    not_configured: "CALENDLY_PERSONAL_ACCESS_TOKEN is not set in this environment.",
    unauthorized: "Calendly rejected the token. Generate a new one and update the secret.",
    forbidden_plan: "This Calendly plan doesn't include webhooks — they need a paid plan.",
    rate_limited: "Calendly is rate-limiting us; try again shortly.",
    endpoint_unavailable: "Calendly didn't recognise the webhook_subscriptions endpoint.",
    timeout: "Calendly didn't respond in time.",
    network: "Couldn't reach Calendly from here.",
  };
  return `${notes[error] ?? `Calendly returned: ${error}`}${detail ? ` (${detail})` : ""}`;
};

const args = process.argv.slice(2);
const command = args[0] && !args[0].startsWith("--") ? args[0] : "list";
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

if (!isConfigured()) die(explain("not_configured"));

const me = await currentUser();
if (!me.ok) die(explain(me.error, me.detail));
const account = me.data;
console.log(`\nCalendly account: ${account.name} <${account.email}>  ·  ${account.timezone}`);

if (command === "list") {
  const subs = await listWebhookSubscriptions(account.uri, account.currentOrganization);
  if (!subs.ok) die(explain(subs.error, subs.detail));
  if (!subs.data.length) {
    console.log("\nNo webhook subscriptions. Create one with:");
    console.log("  pnpm --filter @workspace/scripts run calendly:subscribe create --url https://<host>/api/webhooks/calendly\n");
    process.exit(0);
  }
  console.log(`\n${subs.data.length} subscription(s):\n`);
  for (const sub of subs.data) {
    const missing = REQUIRED_EVENTS.filter((e) => !sub.events.includes(e));
    const pointsHere = /\/api\/webhooks\/calendly$/.test(sub.callbackUrl);
    console.log(`  ${sub.callbackUrl}`);
    console.log(`    uri     : ${sub.uri}`);
    console.log(`    events  : ${sub.events.join(", ") || "none"}${missing.length ? `   ⚠ missing ${missing.join(", ")}` : ""}`);
    console.log(`    state   : ${sub.state}${sub.state !== "active" ? "   ⚠ not active" : ""}`);
    if (!pointsHere) console.log("    ⚠ this URL is not a Phoenix webhook endpoint");
    console.log("");
  }
  process.exit(0);
}

if (command === "create") {
  const url = flag("url");
  if (!url) die("Pass the callback URL: create --url https://<host>/api/webhooks/calendly");
  const parsed = (() => {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  })();
  if (!parsed) die(`Not a valid URL: ${url}`);
  // Calendly will not deliver to plain HTTP, and a wrong path fails silently later.
  if (parsed.protocol !== "https:") die("The callback URL must be https — Calendly won't deliver to http.");
  if (!parsed.pathname.endsWith("/api/webhooks/calendly")) {
    die(`Expected a path ending in /api/webhooks/calendly, got ${parsed.pathname}`);
  }

  const existing = await listWebhookSubscriptions(account.uri, account.currentOrganization);
  if (existing.ok && existing.data.some((s) => s.callbackUrl === url)) {
    die(`A subscription for ${url} already exists. Delete it first if you need a new signing key.`);
  }

  const created = await createWebhookSubscription(url, account.uri, account.currentOrganization);
  if (!created.ok) die(explain(created.error, created.detail));

  console.log(`\n✓ Subscribed ${created.data.callbackUrl}`);
  console.log(`  events: ${created.data.events.join(", ")}`);
  console.log("\n  Put this in the secrets vault as CALENDLY_WEBHOOK_SIGNING_KEY.");
  console.log("  Calendly will not show it again:\n");
  console.log(`    ${created.data.signingKey}\n`);
  process.exit(0);
}

if (command === "delete") {
  const target = args[1];
  if (!target) die("Pass the subscription uuid or uri: delete <uuid-or-uri>");
  const removed = await deleteWebhookSubscription(target);
  if (!removed.ok) die(explain(removed.error, removed.detail));
  console.log(`\n✓ Deleted ${target}\n`);
  process.exit(0);
}

die(`Unknown command "${command}". Use list, create or delete.`);
