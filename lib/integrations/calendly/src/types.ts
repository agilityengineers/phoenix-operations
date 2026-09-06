// Shapes we consume from the Calendly API v2 (https://api.calendly.com).
// Only the fields Phoenix actually reads are modelled; Calendly returns more.

/** Every call returns a result rather than throwing, so a Calendly outage degrades the funnel. */
export type CalendlyResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: CalendlyErrorCode; detail?: string };

export type CalendlyErrorCode =
  /** No access token configured — the integration is simply off. */
  | "not_configured"
  /** Token missing, malformed, or revoked. */
  | "unauthorized"
  /** Token is valid but the account's plan doesn't include this API. */
  | "forbidden_plan"
  /** Calendly's rate limit. */
  | "rate_limited"
  /** The requested time is no longer bookable — someone took it first. */
  | "slot_unavailable"
  /** The endpoint path/shape doesn't match this account's API. See CREATE_INVITEE_PATH. */
  | "endpoint_unavailable"
  /** Request exceeded our own deadline. */
  | "timeout"
  /** DNS/socket failure reaching Calendly. */
  | "network"
  /** 2xx but the body wasn't the shape we expect. */
  | "bad_response"
  /** Any other non-2xx. */
  | "upstream_error";

export interface CalendlyUser {
  uri: string;
  name: string;
  email: string;
  schedulingUrl: string;
  timezone: string;
  currentOrganization: string;
}

export interface CalendlyEventType {
  uri: string;
  name: string;
  slug: string;
  /** Minutes. */
  duration: number;
  schedulingUrl: string;
  active: boolean;
}

export interface CalendlyAvailableTime {
  /** RFC 3339 UTC instant, e.g. "2026-09-14T13:15:00.000000Z". */
  startTime: string;
  /** Calendly's per-slot booking URL. Kept for diagnostics; we book via the API. */
  schedulingUrl?: string;
  inviteesRemaining?: number;
}

export interface CalendlyBooking {
  /** URI of the created scheduled event. */
  eventUri: string;
  /** URI of the created invitee. */
  inviteeUri: string;
  /** Calendly's cancel/reschedule link for the invitee, when returned. */
  cancelUrl?: string;
  rescheduleUrl?: string;
  startTime: string;
}

export interface CreateInviteeInput {
  eventTypeUri: string;
  /** RFC 3339 UTC instant. Must line up with a slot Calendly currently offers. */
  startTime: string;
  invitee: { name: string; email: string; timezone: string };
  /**
   * Correlation metadata echoed back on the invitee.created webhook, so an
   * asynchronous webhook can be matched to the intake session that caused it.
   */
  tracking?: Record<string, string>;
}

/** Verified payload of an inbound Calendly webhook. */
export interface CalendlyWebhookEvent {
  event: "invitee.created" | "invitee.canceled" | string;
  createdAt?: string;
  payload: {
    email?: string;
    name?: string;
    timezone?: string;
    uri?: string;
    status?: string;
    cancelUrl?: string;
    rescheduleUrl?: string;
    /** Absolute URI of the scheduled event this invitee belongs to. */
    eventUri?: string;
    startTime?: string;
    tracking?: Record<string, string | undefined>;
  };
}
