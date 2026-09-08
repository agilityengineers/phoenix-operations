// Checks for the SendGrid sender registry and the guards around sending.
// Run with: pnpm --filter @workspace/scripts run test:sendgrid
// No network and no credentials — safe to run anywhere, including CI.
import { createServer } from "node:http";
import { clearStatusCache, coveredByDomain, domainOf, emailStatus, isSandbox, isSenderKey, mailDomain, sendEmail, senderList, senders } from "@workspace/sendgrid";

let pass = 0, fail = 0;
const check = (name: string, ok: boolean) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); };

/** Every check runs against a known-empty environment, then restores it. */
const KEYS = [
  "SENDGRID_API_KEY", "SENDGRID_API_BASE", "SENDGRID_MAIL_DOMAIN", "SENDGRID_FROM_NAME", "SENDGRID_FROM_EMAIL", "SENDGRID_SANDBOX",
  "SENDGRID_PERSON_NAME", "SENDGRID_SENDER_NOREPLY", "SENDGRID_SENDER_SUPPORT", "SENDGRID_SENDER_JOSHUA",
  "SENDGRID_SENDER_NOREPLY_NAME", "SENDGRID_SENDER_SUPPORT_NAME", "SENDGRID_SENDER_JOSHUA_NAME",
];
const saved = Object.fromEntries(KEYS.map(key => [key, process.env[key]]));
const reset = () => { for (const key of KEYS) delete process.env[key]; };
reset();

// --- Defaults: the three accounts, all on the one authenticated domain --------
check(`mail domain defaults to phoenix-operations.com (got ${mailDomain()})`, mailDomain() === "phoenix-operations.com");
const base = senders();
check(`noreply defaults (got ${base.noreply.email})`, base.noreply.email === "noreply@phoenix-operations.com");
check(`support defaults (got ${base.support.email})`, base.support.email === "support@phoenix-operations.com");
check(`joshua defaults (got ${base.joshua.email})`, base.joshua.email === "joshua@phoenix-operations.com");
check("all three sit on the mail domain", senderList().every(sender => domainOf(sender.email) === mailDomain()));
check("registry lists exactly three senders", senderList().length === 3);
check(`noreply replies route to support (got ${base.noreply.replyTo})`, base.noreply.replyTo === "support@phoenix-operations.com");
check("support replies to itself", base.support.replyTo === base.support.email);
check("joshua replies to himself", base.joshua.replyTo === base.joshua.email);
check("noreply is not a monitored inbox", base.noreply.monitored === false);
check("support and joshua are monitored", base.support.monitored && base.joshua.monitored);
check(`support carries a support display name (got ${base.support.name})`, base.support.name === "Phoenix Operations Support");
check(`joshua sends under a person's name (got ${base.joshua.name})`, base.joshua.name === "Joshua Kornitsky");

// --- Overrides ----------------------------------------------------------------
process.env.SENDGRID_FROM_NAME = "Phoenix Ops";
check(`display name follows SENDGRID_FROM_NAME (got ${senders().noreply.name})`, senders().noreply.name === "Phoenix Ops");
reset();

process.env.SENDGRID_SENDER_SUPPORT = "help";
check("a bare local part is completed with the mail domain", senders().support.email === "help@phoenix-operations.com");
check("noreply follows the moved support address for replies", senders().noreply.replyTo === "help@phoenix-operations.com");
reset();

process.env.SENDGRID_SENDER_JOSHUA = "Joshua@Phoenix-Operations.COM";
check("a full address override is lowercased", senders().joshua.email === "joshua@phoenix-operations.com");
reset();

process.env.SENDGRID_SENDER_NOREPLY = "not an address";
check("junk override falls back to the default rather than sending nowhere", senders().noreply.email === "noreply@phoenix-operations.com");
reset();

// SENDGRID_FROM_EMAIL is what the first version of this integration read. It has
// to keep working, or deploying this change silently stops invitations.
process.env.SENDGRID_FROM_EMAIL = "hello@phoenix-operations.com";
check("legacy SENDGRID_FROM_EMAIL still sets the noreply sender", senders().noreply.email === "hello@phoenix-operations.com");
process.env.SENDGRID_SENDER_NOREPLY = "noreply@phoenix-operations.com";
check("the explicit override wins over the legacy one", senders().noreply.email === "noreply@phoenix-operations.com");
reset();

process.env.SENDGRID_MAIL_DOMAIN = "Mail.Example.COM";
const moved = senders();
check("changing the mail domain moves every sender at once",
  moved.noreply.email === "noreply@mail.example.com" && moved.support.email === "support@mail.example.com" && moved.joshua.email === "joshua@mail.example.com");
reset();

// --- Domain-authentication coverage ------------------------------------------
check("exact domain is covered", coveredByDomain("noreply@phoenix-operations.com", "phoenix-operations.com"));
check("subdomain is covered by the parent", coveredByDomain("noreply@mail.phoenix-operations.com", "phoenix-operations.com"));
check("coverage is case-insensitive", coveredByDomain("Noreply@Phoenix-Operations.com", "PHOENIX-OPERATIONS.COM"));
check("a look-alike domain is not covered", !coveredByDomain("noreply@notphoenix-operations.com", "phoenix-operations.com"));
check("an unrelated domain is not covered", !coveredByDomain("noreply@gmail.com", "phoenix-operations.com"));
check("the parent is not covered by its own subdomain", !coveredByDomain("noreply@phoenix-operations.com", "mail.phoenix-operations.com"));
check("domainOf reads the domain", domainOf("a@b.com") === "b.com");
check("domainOf rejects a non-address", domainOf("nope") === null);

// --- Sender keys --------------------------------------------------------------
check("known sender keys accepted", isSenderKey("noreply") && isSenderKey("support") && isSenderKey("joshua"));
check("unknown sender key rejected", !isSenderKey("marketing") && !isSenderKey("") && !isSenderKey(42));

// --- Sandbox flag -------------------------------------------------------------
check("sandbox is off by default", !isSandbox());
for (const on of ["1", "true", "TRUE", "yes", "on"]) { process.env.SENDGRID_SANDBOX = on; check(`sandbox reads "${on}" as on`, isSandbox()); }
for (const off of ["0", "false", "no", ""]) { process.env.SENDGRID_SANDBOX = off; check(`sandbox reads "${off}" as off`, !isSandbox()); }
reset();

// --- Send guards (all fail before any network call) ---------------------------
const message = { to: "someone@example.com", subject: "s", html: "<p>h</p>" };
const unconfigured = await sendEmail(message);
check("sending without an API key fails closed", !unconfigured.ok && unconfigured.error === "not_configured");

process.env.SENDGRID_API_KEY = "SG.not-a-real-key";
const badSender = await sendEmail({ ...message, from: "marketing" as never });
check("an unknown sender is refused before we call SendGrid", !badSender.ok && badSender.error === "unknown_sender");
const noRecipient = await sendEmail({ ...message, to: [] });
check("a message with no recipient is refused", !noRecipient.ok && noRecipient.error === "invalid_recipient");
const junkRecipient = await sendEmail({ ...message, to: "not-an-address" });
check("a malformed recipient is refused", !junkRecipient.ok && junkRecipient.error === "invalid_recipient");
reset();

// --- Against a stub SendGrid ---------------------------------------------------
// Everything above is pure. What follows proves the shape of the request we
// actually put on the wire and how we read the answer back, which is the part
// that breaks silently: a payload SendGrid quietly refuses looks, from here,
// exactly like a payload it accepts. The stub only ever listens on loopback.

type Captured = { path: string; method: string; auth?: string; body: any };
const captured: Captured[] = [];
let mailStatus = 202;
let mailBody = "";
let domains: unknown[] = [];

const stub = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on("data", chunk => chunks.push(chunk));
  req.on("end", () => {
    const raw = Buffer.concat(chunks).toString("utf8");
    const url = new URL(req.url ?? "/", "http://localhost");
    captured.push({ path: url.pathname, method: req.method ?? "", auth: req.headers.authorization, body: raw ? JSON.parse(raw) : null });
    const json = (status: number, payload: string, headers: Record<string, string> = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(payload);
    };
    if (url.pathname === "/v3/mail/send") return json(mailStatus, mailBody, { "x-message-id": "msg-abc123" });
    if (url.pathname === "/v3/whitelabel/domains") return json(200, JSON.stringify(domains));
    if (url.pathname === "/v3/verified_senders") return json(200, JSON.stringify({ results: [{ id: 7, from_email: "joshua@phoenix-operations.com", from_name: "Joshua", verified: true }] }));
    if (url.pathname === "/v3/scopes") return json(200, JSON.stringify({ scopes: ["mail.send", "whitelabel.read"] }));
    return json(404, "{}");
  });
});
await new Promise<void>(resolve => stub.listen(0, "127.0.0.1", resolve));
process.env.SENDGRID_API_BASE = `http://127.0.0.1:${(stub.address() as { port: number }).port}`;
process.env.SENDGRID_API_KEY = "SG.test-key";
const last = () => captured[captured.length - 1]!;

const accepted = await sendEmail({ to: "dest@example.com", from: "support", subject: "Hi", html: "<p>x</p>", text: "x", categories: ["admin-invitation"] });
check("a well-formed message is accepted", accepted.ok);
check("the queue id comes back from the x-message-id header", accepted.ok && accepted.data.messageId === "msg-abc123");
check("the receipt names the sender used", accepted.ok && accepted.data.from === "support@phoenix-operations.com");
const send = last();
check("posted to /v3/mail/send", send.path === "/v3/mail/send" && send.method === "POST");
check("the API key travels as a bearer token, and only there", send.auth === "Bearer SG.test-key" && !JSON.stringify(send.body).includes("SG.test-key"));
check("from carries address and display name", send.body.from.email === "support@phoenix-operations.com" && send.body.from.name === "Phoenix Operations Support");
check("reply_to is set", send.body.reply_to.email === "support@phoenix-operations.com");
check("recipient lands in personalizations", send.body.personalizations[0].to[0].email === "dest@example.com");
// SendGrid requires the plain-text part first; reversing these drops the text alternative.
check("text/plain precedes text/html", send.body.content[0].type === "text/plain" && send.body.content[1].type === "text/html");
check("categories forwarded for reporting", JSON.stringify(send.body.categories) === '["admin-invitation"]');
check("no sandbox block when sandbox is off", send.body.mail_settings === undefined);

await sendEmail({ to: "dest@example.com", subject: "s", html: "<p>y</p>" });
check("an html-only message sends a single content part", last().body.content.length === 1 && last().body.content[0].type === "text/html");
check("the default sender is noreply", last().body.from.email === "noreply@phoenix-operations.com");
check("noreply's replies are steered to support on the wire", last().body.reply_to.email === "support@phoenix-operations.com");

await sendEmail({ to: ["a@example.com", { email: "b@example.com", name: "B" }], cc: "c@example.com", bcc: "d@example.com", subject: "s", html: "<p>y</p>" });
const fanout = last().body.personalizations[0];
check("multiple recipients and display names survive", fanout.to.length === 2 && fanout.to[1].name === "B");
check("cc and bcc are forwarded", fanout.cc[0].email === "c@example.com" && fanout.bcc[0].email === "d@example.com");

process.env.SENDGRID_SANDBOX = "1";
const sandboxed = await sendEmail({ to: "dest@example.com", subject: "s", html: "<p>y</p>" });
check("sandbox mode is asked of SendGrid", last().body.mail_settings?.sandbox_mode?.enable === true);
check("the receipt says nothing was delivered", sandboxed.ok && sandboxed.data.sandbox === true);
delete process.env.SENDGRID_SANDBOX;

// The failure that actually happens on day one: the domain isn't authenticated yet.
mailStatus = 403;
mailBody = JSON.stringify({ errors: [{ message: "The from address does not match a verified Sender Identity. Mail cannot be sent until this error is resolved." }] });
const refused = await sendEmail({ to: "dest@example.com", subject: "s", html: "<p>y</p>" });
check("an unverified From is reported as sender_not_authenticated, not a generic 403", !refused.ok && refused.error === "sender_not_authenticated");
check("SendGrid's own wording is kept for the logs", !refused.ok && /verified Sender Identity/.test(refused.detail ?? ""));

const statuses: [number, string, string][] = [
  [401, "unauthorized", "a rejected key"],
  [403, "forbidden", "a key without the scope"],
  [429, "rate_limited", "rate limiting"],
  [400, "payload_rejected", "a refused payload"],
];
for (const [code, expected, label] of statuses) {
  mailStatus = code;
  mailBody = JSON.stringify({ errors: [{ message: "Something went wrong" }] });
  const result = await sendEmail({ to: "d@example.com", subject: "s", html: "<p>y</p>" });
  check(`${label} (${code}) maps to ${expected}`, !result.ok && result.error === expected);
}
mailStatus = 202;
mailBody = "";

// --- Status composition --------------------------------------------------------
clearStatusCache();
domains = [];
const nothing = await emailStatus({ refresh: true });
check("with no domain authentication the account is not ready", !nothing.ready && nothing.domainAuthentication === null);
check("a single-sender verification is still recognised", nothing.senders.find(sender => sender.key === "joshua")?.authentication === "single_sender");
check("an address with neither is reported unverified", nothing.senders.find(sender => sender.key === "noreply")?.authentication === "unverified");

clearStatusCache();
domains = [{
  id: 42, domain: "phoenix-operations.com", subdomain: "em1234", valid: true, automatic_security: true, default: true,
  dns: {
    mail_cname: { valid: true, type: "cname", host: "em1234.phoenix-operations.com", data: "u1.wl.sendgrid.net" },
    dkim1: { valid: true, type: "cname", host: "s1._domainkey.phoenix-operations.com", data: "s1.domainkey.u1.wl.sendgrid.net" },
  },
}];
const live = await emailStatus({ refresh: true });
check("a valid domain authentication makes the account ready", live.ready);
check("one domain authentication covers all three senders", live.senders.every(sender => sender.authentication === "domain"));
check("DNS records are parsed for display", live.domainAuthentication?.records.length === 2);
check("the sending subdomain is read", live.domainAuthentication?.subdomain === "em1234");

const beforeCache = captured.length;
await emailStatus();
check("status is served from cache on the next call", captured.length === beforeCache);
await emailStatus({ refresh: true });
check("refresh bypasses the cache", captured.length > beforeCache);

// An override can move an address outside the reach of the domain authentication.
// The status has to notice, rather than assuming a valid domain covers everyone.
clearStatusCache();
process.env.SENDGRID_SENDER_SUPPORT = "support@elsewhere.example";
const strayed = await emailStatus({ refresh: true });
const strayedSupport = strayed.senders.find(sender => sender.key === "support");
check("an address moved off the authenticated domain is flagged", strayedSupport?.onMailDomain === false);
check("and it is not passed off as domain authenticated", strayedSupport?.authentication !== "domain");
check("one stray address keeps the account from being ready", !strayed.ready);
delete process.env.SENDGRID_SENDER_SUPPORT;

clearStatusCache();
domains = [{ id: 43, domain: "phoenix-operations.com", valid: false, automatic_security: true, dns: { mail_cname: { valid: false, type: "cname", host: "em1.phoenix-operations.com", data: "u1.wl.sendgrid.net" } } }];
const pending = await emailStatus({ refresh: true });
check("a domain whose DNS is unpublished is not ready", !pending.ready && pending.domainAuthentication?.valid === false);
check("and single-sender verification still counts while it is pending", pending.senders.find(sender => sender.key === "joshua")?.authentication === "single_sender");

stub.close();
clearStatusCache();
reset();

for (const [key, value] of Object.entries(saved)) if (value !== undefined) process.env[key] = value;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
