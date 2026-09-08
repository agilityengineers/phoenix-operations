import { SENDER_KEYS, type Sender, type SenderKey } from "./types";

/**
 * The one domain Phoenix sends from. Every sender below is derived from it, so
 * authenticating this domain in SendGrid authenticates all of them at once —
 * that is the whole reason the addresses are computed rather than typed.
 */
const DEFAULT_DOMAIN = "phoenix-operations.com";
const DEFAULT_ORG_NAME = "Phoenix Operations";
const DEFAULT_PERSON_NAME = "Joshua Kornitsky";

const env = (name: string) => process.env[name]?.trim() || "";

export const mailDomain = () => (env("SENDGRID_MAIL_DOMAIN") || DEFAULT_DOMAIN).toLowerCase();
export const orgName = () => env("SENDGRID_FROM_NAME") || DEFAULT_ORG_NAME;

/**
 * Accepts either a whole address or a bare local part, so a secret can read
 * `hello` or `hello@phoenix-operations.com` and mean the same thing. Returns null
 * for anything that isn't address-shaped rather than sending to a typo.
 */
const address = (value: string, domain: string): string | null => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const full = trimmed.includes("@") ? trimmed : `${trimmed}@${domain}`;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(full) ? full : null;
};

/** `SENDGRID_SENDER_SUPPORT`, and so on. Rarely needed — the defaults are the point. */
const overrideFor = (key: SenderKey) => `SENDGRID_SENDER_${key.toUpperCase()}`;

const localPart: Record<SenderKey, string> = { noreply: "noreply", support: "support", joshua: "joshua" };

const displayName = (key: SenderKey): string => {
  const override = env(`${overrideFor(key)}_NAME`);
  if (override) return override;
  if (key === "support") return `${orgName()} Support`;
  if (key === "joshua") return env("SENDGRID_PERSON_NAME") || DEFAULT_PERSON_NAME;
  return orgName();
};

const emailFor = (key: SenderKey, domain: string): string => {
  // SENDGRID_FROM_EMAIL predates the registry and used to be the only from
  // address. Still honoured for `noreply` so an existing deployment keeps sending
  // across this change without anybody touching Replit Secrets first.
  const raw = env(overrideFor(key)) || (key === "noreply" ? env("SENDGRID_FROM_EMAIL") : "");
  return (raw && address(raw, domain)) || `${localPart[key]}@${domain}`;
};

/**
 * Resolves the registry from the environment on every call, because Replit
 * Secrets land in `process.env` at boot and we want a restart — not a rebuild —
 * to be enough to change an address.
 */
export const senders = (): Record<SenderKey, Sender> => {
  const domain = mailDomain();
  const support = emailFor("support", domain);
  const build = (key: SenderKey): Sender => {
    const email = emailFor(key, domain);
    return {
      key,
      email,
      name: displayName(key),
      // Replies to a noreply box are a dead end, so they are steered to support.
      replyTo: key === "noreply" ? support : email,
      monitored: key !== "noreply",
    };
  };
  return { noreply: build("noreply"), support: build("support"), joshua: build("joshua") };
};

export const senderList = (): Sender[] => SENDER_KEYS.map(key => senders()[key]);

export const senderFor = (key: SenderKey): Sender | null => senders()[key] ?? null;

/** Domain part of an address, lowercased. Null when the value isn't an address. */
export const domainOf = (email: string): string | null => {
  const at = email.lastIndexOf("@");
  return at > 0 && at < email.length - 1 ? email.slice(at + 1).toLowerCase() : null;
};

/**
 * Whether domain authentication for `authenticated` covers `email`. SendGrid
 * signs the exact domain and anything beneath it, so a sender on a subdomain of
 * an authenticated domain is covered too.
 */
export const coveredByDomain = (email: string, authenticated: string): boolean => {
  const domain = domainOf(email);
  const root = authenticated.trim().toLowerCase();
  return Boolean(domain && root) && (domain === root || domain!.endsWith(`.${root}`));
};
