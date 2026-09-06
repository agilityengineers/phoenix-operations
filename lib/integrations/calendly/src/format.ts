// Slot times are formatted here so the funnel, the /schedule page and the CRM
// all render a booking identically.

/** Falls back rather than throwing on a bogus IANA zone from a query string. */
export const safeTimeZone = (value: unknown, fallback = "America/New_York") => {
  const zone = String(value ?? "").trim();
  if (!zone) return fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return zone;
  } catch {
    return fallback;
  }
};

const parts = (date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(date);

/** "9:15 AM" */
export const slotTimeLabel = (iso: string, timeZone: string) =>
  parts(new Date(iso), timeZone, { hour: "numeric", minute: "2-digit", hour12: true });

/** "Mon 9/14" — matches the column headers the slot grid already renders. */
export const slotDayLabel = (iso: string, timeZone: string) =>
  parts(new Date(iso), timeZone, { weekday: "short", month: "numeric", day: "numeric" }).replace(",", "");

/** "2026-09-14" in the given zone, for grouping slots into day columns. */
export const zonedDateKey = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/** "Mon Sep 14 · 9:15 AM" — the display string stored on the contact. */
export const bookedSlotLabel = (iso: string, timeZone: string) =>
  `${parts(new Date(iso), timeZone, { weekday: "short", month: "short", day: "numeric" }).replace(",", "")} · ${slotTimeLabel(iso, timeZone)}`;

/** "Week of September 14" — the existing .slot-card-head heading. */
export const weekLabel = (iso: string, timeZone: string) =>
  `Week of ${parts(new Date(iso), timeZone, { month: "long", day: "numeric" })}`;

/** Short zone name, e.g. "EDT", for the .tz caption. */
export const timeZoneLabel = (iso: string, timeZone: string) => {
  const formatted = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(new Date(iso));
  return formatted.find(p => p.type === "timeZoneName")?.value ?? timeZone;
};
