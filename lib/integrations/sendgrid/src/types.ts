/**
 * The addresses Phoenix is allowed to send from. Think of them as three voices
 * rather than three mailboxes: `noreply` is the machine talking, `support` is the
 * team, `joshua` is a person. Callers pick a voice by key and never type a from
 * address, which is what keeps every outbound message on an authenticated domain.
 */
export const SENDER_KEYS = ["noreply", "support", "joshua"] as const;
export type SenderKey = (typeof SENDER_KEYS)[number];

export const isSenderKey = (value: unknown): value is SenderKey =>
  typeof value === "string" && (SENDER_KEYS as readonly string[]).includes(value);

export type Sender = {
  key: SenderKey;
  /** Envelope and header From address. Always on the authenticated mail domain. */
  email: string;
  /** Display name the recipient sees. */
  name: string;
  /** Where replies land. `noreply` points at support, because nobody reads noreply. */
  replyTo: string;
  /** False when replies to this address go nowhere a human looks. */
  monitored: boolean;
};

export type EmailAddress = { email: string; name?: string };
export type Recipient = string | EmailAddress;

export type EmailMessage = {
  to: Recipient | Recipient[];
  subject: string;
  html: string;
  /**
   * Plain-text alternative. Always worth supplying: a multipart message reads
   * better in text-only clients and scores better with spam filters.
   */
  text?: string;
  /** Which voice sends it. Defaults to `noreply`. */
  from?: SenderKey;
  /** Overrides the sender's own reply-to for this one message. */
  replyTo?: string;
  cc?: Recipient | Recipient[];
  bcc?: Recipient | Recipient[];
  /** SendGrid categories, for per-flow stats in their dashboard. */
  categories?: string[];
};

export type EmailErrorCode =
  /** No SENDGRID_API_KEY in the environment. */
  | "not_configured"
  /** Caller asked for a sender key that isn't in the registry. */
  | "unknown_sender"
  /** No usable recipient after parsing. */
  | "invalid_recipient"
  /** SendGrid rejected the API key (401). */
  | "unauthorized"
  /** The key is valid but lacks the scope for this call (403). */
  | "forbidden"
  /** SendGrid will not send as this From address — the identity isn't authenticated. */
  | "sender_not_authenticated"
  | "rate_limited"
  /** SendGrid understood the request and refused the payload (400/413). */
  | "payload_rejected"
  | "upstream_error"
  | "timeout"
  | "network";

export type SendGridResult<T> = { ok: true; data: T } | { ok: false; error: EmailErrorCode; detail?: string };

export type SendReceipt = {
  /** SendGrid's queue id, useful for tracing a message in Activity. Null in sandbox. */
  messageId: string | null;
  /** True when the message was validated but deliberately not delivered. */
  sandbox: boolean;
  from: string;
  to: string[];
};

/** One DNS record SendGrid wants published for domain authentication. */
export type DnsRecord = {
  name: string;
  type: string;
  host: string;
  data: string;
  valid: boolean;
};

export type DomainAuthentication = {
  id: number;
  domain: string;
  /** The sending subdomain SendGrid generated, e.g. `em1234`. */
  subdomain: string | null;
  /** True once every DNS record below has been seen by SendGrid. */
  valid: boolean;
  /** True when SendGrid manages DKIM/SPF key rotation through CNAMEs. */
  automaticSecurity: boolean;
  isDefault: boolean;
  records: DnsRecord[];
};

export type VerifiedSender = {
  id: number;
  email: string;
  name: string;
  verified: boolean;
};

/** How a given From address earns the right to send. */
export type SenderAuthentication =
  /** Covered by domain authentication — the whole domain is signed. This is the goal. */
  | "domain"
  /** Verified one address at a time through SendGrid's Single Sender flow. */
  | "single_sender"
  /** SendGrid will refuse this From address. */
  | "unverified"
  /** We couldn't ask SendGrid, so we're not guessing. */
  | "unknown";

export type SenderStatus = Sender & {
  authentication: SenderAuthentication;
  /** False when an override points the address off the authenticated mail domain. */
  onMailDomain: boolean;
};

export type EmailStatus = {
  /** An API key is present. Says nothing about whether it works. */
  configured: boolean;
  /** Messages are being validated but not delivered. */
  sandbox: boolean;
  /** The domain every sender should sit on. */
  domain: string;
  senders: SenderStatus[];
  domainAuthentication: DomainAuthentication | null;
  /** True when the account is set up well enough to send from every sender. */
  ready: boolean;
  /** Set when SendGrid couldn't be reached or refused us; the rest is then best-effort. */
  error?: EmailErrorCode;
  detail?: string;
  checkedAt: string;
};
