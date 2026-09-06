import { createHmac, timingSafeEqual } from "node:crypto";
import type { CalendlyWebhookEvent } from "./types";

/** Reject anything signed more than this long ago, to blunt replay. */
const MAX_SIGNATURE_AGE_MS = 5 * 60_000;

export type WebhookVerification =
  | { ok: true; event: CalendlyWebhookEvent }
  | { ok: false; reason: "not_configured" | "missing_signature" | "malformed_signature" | "stale" | "mismatch" | "bad_json" };

const signingKey = () => process.env.CALENDLY_WEBHOOK_SIGNING_KEY?.trim() || "";

export const isWebhookConfigured = () => signingKey().length > 0;

/** Parses `t=1700000000,v1=abc123` in either order, tolerating spaces. */
const parseHeader = (header: string) => {
  let timestamp = "";
  let digest = "";
  for (const part of header.split(",")) {
    const [rawKey, ...rest] = part.split("=");
    const key = rawKey?.trim();
    const value = rest.join("=").trim();
    if (key === "t") timestamp = value;
    else if (key === "v1") digest = value;
  }
  return { timestamp, digest };
};

const equals = (a: string, b: string) => {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch, so compare lengths first. The
  // length of a hex digest is not a secret.
  return left.length === right.length && timingSafeEqual(left, right);
};

const str = (value: unknown) => (typeof value === "string" ? value : undefined);

/**
 * Verifies a Calendly webhook and returns its payload.
 *
 * Calendly signs `${timestamp}.${rawBody}` with HMAC-SHA256 using the signing key
 * issued when the subscription was created. It must be the *raw* bytes: any
 * middleware that re-serialises the parsed JSON first will break every signature.
 */
export const verifyWebhook = (rawBody: Buffer | string, header: string | undefined): WebhookVerification => {
  const key = signingKey();
  if (!key) return { ok: false, reason: "not_configured" };
  if (!header) return { ok: false, reason: "missing_signature" };

  const { timestamp, digest } = parseHeader(header);
  if (!timestamp || !digest || !/^\d+$/.test(timestamp)) return { ok: false, reason: "malformed_signature" };

  const signedAtMs = Number(timestamp) * 1000;
  if (!Number.isFinite(signedAtMs) || Math.abs(Date.now() - signedAtMs) > MAX_SIGNATURE_AGE_MS) {
    return { ok: false, reason: "stale" };
  }

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, "utf8");
  const expected = createHmac("sha256", key)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), body]))
    .digest("hex");
  if (!equals(expected, digest)) return { ok: false, reason: "mismatch" };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body.toString("utf8")) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "bad_json" };
  }

  const payload = (parsed.payload as Record<string, unknown> | undefined) ?? {};
  const scheduledEvent = (payload.scheduled_event as Record<string, unknown> | undefined) ?? {};
  const tracking = (payload.tracking as Record<string, unknown> | undefined) ?? {};

  return {
    ok: true,
    event: {
      event: str(parsed.event) ?? "",
      createdAt: str(parsed.created_at),
      payload: {
        email: str(payload.email),
        name: str(payload.name),
        timezone: str(payload.timezone),
        uri: str(payload.uri),
        status: str(payload.status),
        cancelUrl: str(payload.cancel_url),
        rescheduleUrl: str(payload.reschedule_url),
        eventUri: str(scheduledEvent.uri) ?? str(payload.event),
        startTime: str(scheduledEvent.start_time),
        tracking: Object.fromEntries(
          Object.entries(tracking).map(([k, v]) => [k, str(v)]),
        ),
      },
    },
  };
};
