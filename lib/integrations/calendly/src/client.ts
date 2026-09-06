import type {
  CalendlyAvailableTime,
  CalendlyBooking,
  CalendlyErrorCode,
  CalendlyEventType,
  CalendlyResult,
  CalendlyUser,
  CalendlyWebhookCreated,
  CalendlyWebhookSubscription,
  CreateInviteeInput,
} from "./types";

const API_BASE = process.env.CALENDLY_API_BASE ?? "https://api.calendly.com";
const TIMEOUT_MS = 10_000;

/**
 * Calendly's Scheduling API (late 2025) books an invitee without an iframe or a
 * redirect, which is what lets Phoenix keep its own scheduler UI. Their docs are
 * not reachable from this environment, so the path is a single overridable
 * constant: if the account's API disagrees, set CALENDLY_CREATE_INVITEE_PATH
 * rather than editing code, and the caller sees "endpoint_unavailable" instead of
 * a silent failure.
 */
const CREATE_INVITEE_PATH = process.env.CALENDLY_CREATE_INVITEE_PATH ?? "/scheduled_events";

/** Calendly rejects availability windows wider than 7 days. */
export const MAX_AVAILABILITY_WINDOW_DAYS = 7;

const token = () => process.env.CALENDLY_PERSONAL_ACCESS_TOKEN?.trim() || "";

/** True when an access token is present. Does not prove the token still works. */
export const isConfigured = () => token().length > 0;

type Json = Record<string, unknown>;

const mapStatus = (status: number): CalendlyErrorCode => {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden_plan";
  if (status === 404 || status === 405) return "endpoint_unavailable";
  if (status === 429) return "rate_limited";
  return "upstream_error";
};

/** Single place where we talk to Calendly. Never throws; never logs the token. */
const call = async <T>(
  path: string,
  init: { method?: string; body?: Json; query?: Record<string, string | undefined> },
  parse: (body: Json) => T | null,
): Promise<CalendlyResult<T>> => {
  const accessToken = token();
  if (!accessToken) return { ok: false, error: "not_configured" };

  const url = new URL(path.startsWith("http") ? path : `${API_BASE}${path}`);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${accessToken}`,
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
    body = text ? (JSON.parse(text) as Json) : {};
  } catch {
    body = {};
  }

  if (!response.ok) {
    // Calendly reports "this time is taken" as a 4xx with a descriptive title.
    const title = String((body.title as string) ?? (body.message as string) ?? "");
    const detail = String((body.details as string) ?? (body.message as string) ?? title ?? "");
    if (response.status === 400 || response.status === 409 || response.status === 422) {
      const taken = /already|unavailable|not available|taken|conflict|no longer/i.test(`${title} ${detail}`);
      return { ok: false, error: taken ? "slot_unavailable" : "upstream_error", detail: detail || title || undefined };
    }
    return { ok: false, error: mapStatus(response.status), detail: detail || title || undefined };
  }

  const parsed = parse(body);
  if (parsed === null) return { ok: false, error: "bad_response" };
  return { ok: true, data: parsed };
};

const str = (value: unknown) => (typeof value === "string" ? value : undefined);

/** The account the access token belongs to. */
export const currentUser = (): Promise<CalendlyResult<CalendlyUser>> =>
  call("/users/me", {}, (body) => {
    const r = body.resource as Json | undefined;
    const uri = str(r?.uri);
    if (!r || !uri) return null;
    return {
      uri,
      name: str(r.name) ?? "",
      email: str(r.email) ?? "",
      schedulingUrl: str(r.scheduling_url) ?? "",
      timezone: str(r.timezone) ?? "UTC",
      currentOrganization: str(r.current_organization) ?? "",
    };
  });

/** Active event types for a user, for the admin picker. */
export const listEventTypes = (userUri: string): Promise<CalendlyResult<CalendlyEventType[]>> =>
  call("/event_types", { query: { user: userUri, active: "true", count: "100" } }, (body) => {
    const collection = body.collection;
    if (!Array.isArray(collection)) return null;
    return collection.flatMap((raw) => {
      const item = raw as Json;
      const uri = str(item.uri);
      if (!uri) return [];
      return [{
        uri,
        name: str(item.name) ?? "Untitled",
        slug: str(item.slug) ?? "",
        duration: typeof item.duration === "number" ? item.duration : 0,
        schedulingUrl: str(item.scheduling_url) ?? "",
        active: item.active !== false,
      }];
    });
  });

const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

/** One Calendly availability request. Window must be <= 7 days. */
const availableTimesWindow = (
  eventTypeUri: string,
  start: Date,
  end: Date,
): Promise<CalendlyResult<CalendlyAvailableTime[]>> =>
  call(
    "/event_type_available_times",
    { query: { event_type: eventTypeUri, start_time: start.toISOString(), end_time: end.toISOString() } },
    (body) => {
      const collection = body.collection;
      if (!Array.isArray(collection)) return null;
      return collection.flatMap((raw) => {
        const item = raw as Json;
        const startTime = str(item.start_time);
        if (!startTime) return [];
        if (item.status !== undefined && item.status !== "available") return [];
        return [{
          startTime,
          schedulingUrl: str(item.scheduling_url),
          inviteesRemaining:
            typeof item.invitees_remaining === "number" ? item.invitees_remaining : undefined,
        }];
      });
    },
  );

/**
 * Bookable times between two instants, chunked across Calendly's 7-day cap and
 * merged. Calendly also rejects a start_time in the past, so the range is
 * clamped forward a minute.
 */
export const availableTimes = async (
  eventTypeUri: string,
  start: Date,
  end: Date,
): Promise<CalendlyResult<CalendlyAvailableTime[]>> => {
  const floor = new Date(Date.now() + 60_000);
  let cursor = start.getTime() < floor.getTime() ? floor : start;
  if (end.getTime() <= cursor.getTime()) return { ok: true, data: [] };

  const merged: CalendlyAvailableTime[] = [];
  const seen = new Set<string>();
  while (cursor.getTime() < end.getTime()) {
    const windowEnd = new Date(Math.min(addDays(cursor, MAX_AVAILABILITY_WINDOW_DAYS).getTime(), end.getTime()));
    const result = await availableTimesWindow(eventTypeUri, cursor, windowEnd);
    // A partial failure is a failure: better to show "unavailable" than a
    // calendar with silent holes in it.
    if (!result.ok) return result;
    for (const slot of result.data) {
      if (seen.has(slot.startTime)) continue;
      seen.add(slot.startTime);
      merged.push(slot);
    }
    cursor = windowEnd;
  }
  merged.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return { ok: true, data: merged };
};

/**
 * Books the event on the Calendly account's real calendar. This is the call that
 * makes the booking genuine — everything else is presentation.
 */
export const createInvitee = (input: CreateInviteeInput): Promise<CalendlyResult<CalendlyBooking>> =>
  call(
    CREATE_INVITEE_PATH,
    {
      method: "POST",
      body: {
        event_type: input.eventTypeUri,
        start_time: input.startTime,
        invitee: {
          name: input.invitee.name,
          email: input.invitee.email,
          timezone: input.invitee.timezone,
        },
        ...(input.tracking && Object.keys(input.tracking).length ? { tracking: input.tracking } : {}),
      },
    },
    (body) => {
      const r = (body.resource as Json | undefined) ?? body;
      const invitee = (r.invitee as Json | undefined) ?? r;
      const eventUri =
        str(r.event) ?? str((r.event as Json | undefined)?.uri) ?? str(invitee.event) ?? str(r.uri);
      const inviteeUri = str(invitee.uri) ?? str(r.invitee_uri);
      if (!eventUri && !inviteeUri) return null;
      return {
        eventUri: eventUri ?? "",
        inviteeUri: inviteeUri ?? "",
        cancelUrl: str(invitee.cancel_url),
        rescheduleUrl: str(invitee.reschedule_url),
        startTime: str(r.start_time) ?? input.startTime,
      };
    },
  );

// ── Webhook subscriptions ────────────────────────────────────────────────────
// Calendly has no UI for these; they exist only through the API, and the signing
// key is returned once when a subscription is created. Driven by
// scripts/src/calendly-subscribe.ts.

const WEBHOOK_EVENTS = ["invitee.created", "invitee.canceled"];

const parseSubscription = (raw: Json): CalendlyWebhookSubscription | null => {
  const uri = str(raw.uri);
  if (!uri) return null;
  return {
    uri,
    callbackUrl: str(raw.callback_url) ?? "",
    events: Array.isArray(raw.events) ? raw.events.filter((e): e is string => typeof e === "string") : [],
    state: str(raw.state) ?? "unknown",
    scope: str(raw.scope) ?? "",
    createdAt: str(raw.created_at),
  };
};

/** Existing subscriptions for a user, so we can see whether one already points here. */
export const listWebhookSubscriptions = (
  userUri: string,
  organizationUri: string,
): Promise<CalendlyResult<CalendlyWebhookSubscription[]>> =>
  call(
    "/webhook_subscriptions",
    { query: { scope: "user", user: userUri, organization: organizationUri, count: "100" } },
    (body) => {
      const collection = body.collection;
      if (!Array.isArray(collection)) return null;
      return collection.flatMap((raw) => {
        const parsed = parseSubscription(raw as Json);
        return parsed ? [parsed] : [];
      });
    },
  );

/** Creates the subscription and returns the signing key — the only time it is available. */
export const createWebhookSubscription = (
  callbackUrl: string,
  userUri: string,
  organizationUri: string,
): Promise<CalendlyResult<CalendlyWebhookCreated>> =>
  call(
    "/webhook_subscriptions",
    {
      method: "POST",
      body: {
        url: callbackUrl,
        events: WEBHOOK_EVENTS,
        organization: organizationUri,
        user: userUri,
        scope: "user",
      },
    },
    (body) => {
      const resource = (body.resource as Json | undefined) ?? body;
      const parsed = parseSubscription(resource);
      const signingKey = str(resource.signing_key);
      if (!parsed || !signingKey) return null;
      return { ...parsed, signingKey };
    },
  );

/** Removes a subscription — typically one left pointing at a dead preview host. */
export const deleteWebhookSubscription = (uuidOrUri: string): Promise<CalendlyResult<true>> => {
  const uuid = uuidOrUri.split("/").pop() ?? uuidOrUri;
  return call(`/webhook_subscriptions/${encodeURIComponent(uuid)}`, { method: "DELETE" }, () => true);
};
