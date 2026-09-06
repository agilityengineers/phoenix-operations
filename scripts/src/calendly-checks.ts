// Checks for the Calendly webhook signature verifier and the slot formatters.
// Run with: pnpm --filter @workspace/scripts run test:calendly
// No network and no credentials — safe to run anywhere.
import { createHmac } from "node:crypto";
import { bookedSlotLabel, safeTimeZone, slotDayLabel, slotTimeLabel, timeZoneLabel, verifyWebhook, weekLabel, zonedDateKey } from "@workspace/calendly";

const KEY = "test-signing-key";
process.env.CALENDLY_WEBHOOK_SIGNING_KEY = KEY;

const body = JSON.stringify({
  event: "invitee.created",
  created_at: "2026-09-14T12:00:00Z",
  payload: {
    email: "marcus@webbmech.com", name: "Marcus Webb", timezone: "America/New_York",
    uri: "https://api.calendly.com/scheduled_events/EV1/invitees/IN1",
    scheduled_event: { uri: "https://api.calendly.com/scheduled_events/EV1", start_time: "2026-09-14T13:15:00.000000Z" },
    tracking: { utm_content: "resume-token-abc" },
  },
});
const sign = (t: number, payload: string, key = KEY) =>
  `t=${t},v1=${createHmac("sha256", key).update(`${t}.${payload}`).digest("hex")}`;

let pass = 0, fail = 0;
const check = (name: string, ok: boolean) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); };

const now = Math.floor(Date.now() / 1000);

const good = verifyWebhook(Buffer.from(body), sign(now, body));
check("valid signature accepted", good.ok);
check("event parsed", good.ok && good.event.event === "invitee.created");
check("eventUri extracted", good.ok && good.event.payload.eventUri === "https://api.calendly.com/scheduled_events/EV1");
check("startTime extracted", good.ok && good.event.payload.startTime === "2026-09-14T13:15:00.000000Z");
check("tracking extracted", good.ok && good.event.payload.tracking?.utm_content === "resume-token-abc");

check("tampered body rejected", !verifyWebhook(Buffer.from(body.replace("Marcus", "Mallory")), sign(now, body)).ok);
check("wrong key rejected", !verifyWebhook(Buffer.from(body), sign(now, body, "other-key")).ok);
check("stale timestamp rejected", (() => { const r = verifyWebhook(Buffer.from(body), sign(now - 11 * 60, body)); return !r.ok && r.reason === "stale"; })());
check("missing header rejected", (() => { const r = verifyWebhook(Buffer.from(body), undefined); return !r.ok && r.reason === "missing_signature"; })());
check("malformed header rejected", (() => { const r = verifyWebhook(Buffer.from(body), "garbage"); return !r.ok && r.reason === "malformed_signature"; })());
check("reversed header order accepted", (() => { const h = sign(now, body).split(","); return verifyWebhook(Buffer.from(body), `${h[1]},${h[0]}`).ok; })());
check("unconfigured key rejected", (() => { delete process.env.CALENDLY_WEBHOOK_SIGNING_KEY; const r = verifyWebhook(Buffer.from(body), sign(now, body)); process.env.CALENDLY_WEBHOOK_SIGNING_KEY = KEY; return !r.ok && r.reason === "not_configured"; })());

// Formatters — 2026-09-14T13:15:00Z is 9:15 AM EDT on Monday Sept 14.
const iso = "2026-09-14T13:15:00.000000Z", tz = "America/New_York";
check(`slotTimeLabel = 9:15 AM (got ${slotTimeLabel(iso, tz)})`, slotTimeLabel(iso, tz) === "9:15 AM");
check(`slotDayLabel = Mon 9/14 (got ${slotDayLabel(iso, tz)})`, slotDayLabel(iso, tz) === "Mon 9/14");
check(`zonedDateKey = 2026-09-14 (got ${zonedDateKey(iso, tz)})`, zonedDateKey(iso, tz) === "2026-09-14");
check(`bookedSlotLabel (got ${bookedSlotLabel(iso, tz)})`, bookedSlotLabel(iso, tz) === "Mon Sep 14 · 9:15 AM");
check(`weekLabel (got ${weekLabel(iso, tz)})`, weekLabel(iso, tz) === "Week of September 14");
check(`timeZoneLabel = EDT (got ${timeZoneLabel(iso, tz)})`, timeZoneLabel(iso, tz) === "EDT");
check("safeTimeZone falls back on junk", safeTimeZone("Not/AZone") === "America/New_York");
check("safeTimeZone keeps valid zone", safeTimeZone("Europe/London") === "Europe/London");
// Timezone actually matters: same instant is 6:15 AM in Los Angeles.
check(`LA rendering differs (got ${slotTimeLabel(iso, "America/Los_Angeles")})`, slotTimeLabel(iso, "America/Los_Angeles") === "6:15 AM");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
