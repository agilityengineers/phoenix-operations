import { coveredByDomain, domainOf, mailDomain, senderList, senders } from "./senders";
import type {
  DnsRecord,
  DomainAuthentication,
  EmailErrorCode,
  EmailMessage,
  EmailStatus,
  Recipient,
  SendGridResult,
  SenderAuthentication,
  SenderStatus,
  SendReceipt,
  VerifiedSender,
} from "./types";
import { isSenderKey } from "./types";

/** Overridable so the checks can point the client at a local stub. */
const apiBase = () => process.env.SENDGRID_API_BASE?.trim() || "https://api.sendgrid.com";
const TIMEOUT_MS = 10_000;
/** How long a composed status is reused. Long enough that an admin screen polling
 *  it doesn't hammer SendGrid, short enough that a DNS fix shows up quickly. */
const STATUS_TTL_MS = 60_000;

const apiKey = () => process.env.SENDGRID_API_KEY?.trim() || "";

/** True when an API key is present. Does not prove the key still works. */
export const isConfigured = () => apiKey().length > 0;

/**
 * Sandbox mode asks SendGrid to run every validation it normally would — the
 * From identity included — and then throw the message away instead of delivering
 * it. It is how you prove the wiring works without mailing a real person.
 */
export const isSandbox = () => /^(1|true|yes|on)$/i.test(process.env.SENDGRID_SANDBOX?.trim() ?? "");

type Json = Record<string, unknown>;

const mapStatus = (status: number): EmailErrorCode => {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 400 || status === 413) return "payload_rejected";
  if (status === 429) return "rate_limited";
  return "upstream_error";
};

/** SendGrid answers errors as `{ errors: [{ message, field }] }`. */
const errorDetail = (body: Json, text: string): string | undefined => {
  const errors = body.errors;
  if (Array.isArray(errors)) {
    const messages = errors
      .map(entry => (entry && typeof entry === "object" ? String((entry as Json).message ?? "") : ""))
      .filter(Boolean);
    if (messages.length) return messages.join("; ");
  }
  const trimmed = text.trim();
  return trimmed ? trimmed.slice(0, 300) : undefined;
};

/**
 * Single place where we talk to SendGrid. Never throws, and never puts the API
 * key anywhere but the Authorization header.
 */
const call = async <T>(
  path: string,
  init: { method?: string; body?: Json; query?: Record<string, string | undefined> },
  parse: (body: Json, headers: Headers) => T,
): Promise<SendGridResult<T>> => {
  const key = apiKey();
  if (!key) return { ok: false, error: "not_configured" };

  const url = new URL(`${apiBase()}${path}`);
  for (const [name, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined) url.searchParams.set(name, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const name = (err as { name?: string }).name;
    return { ok: false, error: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network" };
  }

  const text = await response.text().catch(() => "");
  let body: Json = {};
  try {
    const parsed = text ? JSON.parse(text) : {};
    body = Array.isArray(parsed) ? { results: parsed } : (parsed as Json);
  } catch {
    body = {};
  }

  if (!response.ok) return { ok: false, error: mapStatus(response.status), detail: errorDetail(body, text) };
  return { ok: true, data: parse(body, response.headers) };
};

const list = (body: Json): Json[] => {
  const results = body.results;
  return Array.isArray(results) ? (results.filter(entry => entry && typeof entry === "object") as Json[]) : [];
};

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

const toAddress = (value: Recipient): { email: string; name?: string } | null => {
  const record = typeof value === "string" ? { email: value } : value;
  const email = record.email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return record.name ? { email, name: record.name } : { email };
};

const toAddresses = (value: Recipient | Recipient[] | undefined) =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value])
    .map(toAddress)
    .filter((entry): entry is { email: string; name?: string } => entry !== null);

/** A 403 that names the sender identity is the one failure worth its own code. */
const refinedSendError = (error: EmailErrorCode, detail: string | undefined): EmailErrorCode => {
  if (error !== "forbidden" && error !== "payload_rejected") return error;
  return /sender identity|verified sender|from address|does not match/i.test(detail ?? "")
    ? "sender_not_authenticated"
    : error;
};

/**
 * Sends one message as one of the registry's senders. The caller chooses a voice,
 * never a From address, so nothing can accidentally send as an unauthenticated
 * identity — SendGrid would refuse it anyway, and this fails earlier and clearer.
 */
export const sendEmail = async (message: EmailMessage): Promise<SendGridResult<SendReceipt>> => {
  const key = message.from ?? "noreply";
  if (!isSenderKey(key)) return { ok: false, error: "unknown_sender", detail: String(key) };
  const sender = senders()[key];

  const to = toAddresses(message.to);
  if (!to.length) return { ok: false, error: "invalid_recipient" };
  const cc = toAddresses(message.cc);
  const bcc = toAddresses(message.bcc);

  const content: { type: string; value: string }[] = [];
  // SendGrid requires text/plain before text/html when both are present.
  if (message.text) content.push({ type: "text/plain", value: message.text });
  content.push({ type: "text/html", value: message.html });

  const sandbox = isSandbox();
  const payload: Json = {
    personalizations: [{ to, ...(cc.length ? { cc } : {}), ...(bcc.length ? { bcc } : {}) }],
    from: { email: sender.email, name: sender.name },
    reply_to: { email: message.replyTo ?? sender.replyTo },
    subject: message.subject,
    content,
    ...(message.categories?.length ? { categories: message.categories.slice(0, 10) } : {}),
    ...(sandbox ? { mail_settings: { sandbox_mode: { enable: true } } } : {}),
  };

  const sent = await call("/v3/mail/send", { method: "POST", body: payload }, (_body, headers) => ({
    messageId: headers.get("x-message-id"),
    sandbox,
    from: sender.email,
    to: to.map(entry => entry.email),
  }));

  return sent.ok ? sent : { ok: false, error: refinedSendError(sent.error, sent.detail), detail: sent.detail };
};

// ---------------------------------------------------------------------------
// Authentication state
// ---------------------------------------------------------------------------

const dnsRecords = (dns: unknown): DnsRecord[] => {
  if (!dns || typeof dns !== "object") return [];
  return Object.entries(dns as Json).flatMap(([name, value]) => {
    if (!value || typeof value !== "object") return [];
    const record = value as Json;
    return [{
      name,
      type: String(record.type ?? "cname"),
      host: String(record.host ?? ""),
      data: String(record.data ?? ""),
      valid: record.valid === true,
    }];
  });
};

const parseDomain = (entry: Json): DomainAuthentication => ({
  id: Number(entry.id ?? 0),
  domain: String(entry.domain ?? ""),
  subdomain: entry.subdomain ? String(entry.subdomain) : null,
  valid: entry.valid === true,
  automaticSecurity: entry.automatic_security === true,
  isDefault: entry.default === true,
  records: dnsRecords(entry.dns),
});

/**
 * Domain authentications on the account, newest-configured first. SendGrid calls
 * these "whitelabel domains" in the API and "Sender Authentication" in the UI.
 */
export const listDomainAuthentication = async (domain?: string): Promise<SendGridResult<DomainAuthentication[]>> =>
  call("/v3/whitelabel/domains", { query: { limit: "50", domain } }, body => list(body).map(parseDomain));

/**
 * The authentication record covering our mail domain, or null when there isn't
 * one. Prefers an exact domain match over a parent that merely covers us.
 */
export const domainAuthentication = async (domain = mailDomain()): Promise<SendGridResult<DomainAuthentication | null>> => {
  const all = await listDomainAuthentication();
  if (!all.ok) return all;
  const exact = all.data.find(entry => entry.domain.toLowerCase() === domain.toLowerCase());
  const covering = all.data.find(entry => coveredByDomain(`x@${domain}`, entry.domain));
  return { ok: true, data: exact ?? covering ?? null };
};

/** Re-checks DNS for one domain authentication and returns its refreshed state. */
export const validateDomainAuthentication = async (id: number): Promise<SendGridResult<{ valid: boolean }>> =>
  call(`/v3/whitelabel/domains/${id}/validate`, { method: "POST" }, body => ({ valid: body.valid === true }));

/** Single Sender verifications — the per-address fallback when a domain isn't authenticated. */
export const verifiedSenders = async (): Promise<SendGridResult<VerifiedSender[]>> =>
  call("/v3/verified_senders", {}, body =>
    list(body).map(entry => ({
      id: Number(entry.id ?? 0),
      email: String(entry.from_email ?? "").toLowerCase(),
      name: String(entry.from_name ?? ""),
      verified: entry.verified === true,
    })),
  );

/** Scopes the API key carries. The cheapest call that proves a key is live. */
export const accountScopes = async (): Promise<SendGridResult<string[]>> =>
  call("/v3/scopes", {}, body => (Array.isArray(body.scopes) ? body.scopes.map(String) : []));

let cache: { key: string; at: number; value: EmailStatus } | null = null;

/**
 * One answer to "can this system send mail, and as whom?" — composed from the
 * sender registry, the domain authentication record and the single-sender list.
 * Both the admin screen and the CLI check read this, so they can never disagree.
 */
export const emailStatus = async (options: { refresh?: boolean } = {}): Promise<EmailStatus> => {
  const domain = mailDomain();
  const configured = isConfigured();
  const cacheKey = `${domain}:${configured}:${isSandbox()}`;
  if (!options.refresh && cache && cache.key === cacheKey && Date.now() - cache.at < STATUS_TTL_MS) return cache.value;

  const base = {
    configured,
    sandbox: isSandbox(),
    domain,
    checkedAt: new Date().toISOString(),
  };

  const unknown = (error?: EmailErrorCode, detail?: string): EmailStatus => ({
    ...base,
    senders: senderList().map(sender => ({
      ...sender,
      authentication: "unknown" as SenderAuthentication,
      onMailDomain: domainOf(sender.email) === domain,
    })),
    domainAuthentication: null,
    ready: false,
    ...(error ? { error } : {}),
    ...(detail ? { detail } : {}),
  });

  if (!configured) {
    const value = unknown("not_configured");
    cache = { key: cacheKey, at: Date.now(), value };
    return value;
  }

  const authentication = await domainAuthentication(domain);
  if (!authentication.ok) {
    const value = unknown(authentication.error, authentication.detail);
    cache = { key: cacheKey, at: Date.now(), value };
    return value;
  }

  const authenticated = authentication.data;
  const registry = senderList();
  // Only worth asking when the domain authentication can't already vouch for
  // every sender. An address override can put one outside its reach, so this
  // asks about coverage rather than merely whether the domain is valid.
  const needsSingleSenders = !registry.every(
    sender => authenticated?.valid && coveredByDomain(sender.email, authenticated.domain),
  );
  const single = needsSingleSenders ? await verifiedSenders() : null;
  const verified = single?.ok ? single.data : [];

  const senderStatuses: SenderStatus[] = registry.map(sender => {
    const onMailDomain = domainOf(sender.email) === domain;
    let authenticationState: SenderAuthentication = "unverified";
    if (authenticated?.valid && coveredByDomain(sender.email, authenticated.domain)) {
      authenticationState = "domain";
    } else if (verified.some(entry => entry.email === sender.email.toLowerCase() && entry.verified)) {
      authenticationState = "single_sender";
    } else if (needsSingleSenders && single && !single.ok) {
      // We asked and were refused, so "unverified" would be a guess.
      authenticationState = "unknown";
    }
    return { ...sender, authentication: authenticationState, onMailDomain };
  });

  const value: EmailStatus = {
    ...base,
    senders: senderStatuses,
    domainAuthentication: authenticated,
    ready: senderStatuses.every(sender => sender.authentication === "domain" || sender.authentication === "single_sender"),
    ...(single && !single.ok ? { error: single.error, detail: single.detail } : {}),
  };
  cache = { key: cacheKey, at: Date.now(), value };
  return value;
};

/** Drops the cached status. Used after a change that should show up immediately. */
export const clearStatusCache = () => {
  cache = null;
};
