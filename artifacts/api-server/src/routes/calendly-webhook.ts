import { Router, type IRouter, type Request } from "express";
import { and, eq } from "drizzle-orm";
import { db, phoenixWorkspaces } from "@workspace/db";
import { bookedSlotLabel, safeTimeZone, verifyWebhook, type CalendlyWebhookEvent } from "@workspace/calendly";
import { getPhoenixStore, mutatePhoenixStore } from "../lib/phoenix-store";
import { logger } from "../lib/logger";

/**
 * Inbound Calendly webhooks.
 *
 * Deliberately mounted outside the admin/CSRF middleware in routes/phoenix.ts:
 * `csrfOrigin` rejects POSTs whose Origin doesn't match our host, which would
 * block Calendly entirely. Authentication here is the HMAC signature, not a
 * session — so signature verification is the only thing standing between the
 * public internet and the CRM, and it runs before anything else.
 *
 * This is the authoritative record. The in-app booking call writes optimistically;
 * a cancellation or reschedule only ever arrives here.
 */
const router: IRouter = Router();

const CALL_SCHEDULED = "Call scheduled";
const QUALIFIED = "Qualified";

/** Which tenant a webhook belongs to. Single Calendly account per deployment today. */
const targetWorkspaceId = async (): Promise<string | null> => {
  const [row] = await db
    .select({ id: phoenixWorkspaces.id })
    .from(phoenixWorkspaces)
    .where(and(eq(phoenixWorkspaces.slug, "phoenix"), eq(phoenixWorkspaces.isPublic, true)))
    .limit(1);
  return row?.id ?? null;
};

const applyCreated = (workspaceId: string, event: CalendlyWebhookEvent) =>
  mutatePhoenixStore(workspaceId, store => {
    const p = event.payload;
    const timezone = safeTimeZone(p.timezone);
    const existing =
      (p.eventUri ? store.contactByCalendlyEvent(p.eventUri) : null) ??
      (p.uri ? store.contactByCalendlyInvitee(p.uri) : null) ??
      (p.email ? store.contactByEmail(p.email) : null);
    const label = p.startTime ? bookedSlotLabel(p.startTime, timezone) : "";

    if (!existing) {
      // Booked straight from Calendly (an emailed link, say) with no intake behind
      // it. Still a lead — record it rather than dropping it on the floor.
      const stages = store.listPipelines().find(x => x.id === "prospects")?.stages ?? [];
      const created = store.createContact({
        workspaceId, pipelineId: "prospects", name: p.name || p.email || "Calendly invitee",
        company: "—", role: "—", email: p.email || "—", funnel: "Direct booking",
        source: "calendly", score: 50, stage: Math.max(0, stages.indexOf(CALL_SCHEDULED)), position: 0, owner: "—",
        bookedSlot: label, bookedAt: p.startTime, bookedTimezone: timezone,
        calendlyEventUri: p.eventUri, calendlyInviteeUri: p.uri,
      });
      store.addActivity({ workspaceId, contactId: created.id, type: "call", title: "Call booked", body: `${label} · booked directly in Calendly` });
      return "created" as const;
    }

    const alreadyRecorded = existing.calendlyEventUri === p.eventUri && !existing.bookingCanceledAt;
    const stage = store.stageIndex(existing.pipelineId, CALL_SCHEDULED);
    store.updateContact(existing.id, {
      bookedSlot: label || existing.bookedSlot, bookedAt: p.startTime ?? existing.bookedAt,
      bookedTimezone: timezone, calendlyEventUri: p.eventUri ?? existing.calendlyEventUri,
      calendlyInviteeUri: p.uri ?? existing.calendlyInviteeUri, bookingCanceledAt: undefined,
      ...(stage >= 0 ? { stage } : {}),
    });
    // The in-app path already logged this booking; don't double up the timeline.
    if (!alreadyRecorded) store.addActivity({ workspaceId, contactId: existing.id, type: "call", title: "Call booked", body: `${label} · confirmed by Calendly` });
    return "reconciled" as const;
  });

const applyCanceled = (workspaceId: string, event: CalendlyWebhookEvent) =>
  mutatePhoenixStore(workspaceId, store => {
    const p = event.payload;
    const contact =
      (p.eventUri ? store.contactByCalendlyEvent(p.eventUri) : null) ??
      (p.uri ? store.contactByCalendlyInvitee(p.uri) : null) ??
      (p.email ? store.contactByEmail(p.email) : null);
    if (!contact) return "unmatched" as const;
    // Move them back to Qualified rather than leaving the board claiming a call
    // that isn't happening. Never move someone forward on a cancellation.
    const qualified = store.stageIndex(contact.pipelineId, QUALIFIED);
    const scheduled = store.stageIndex(contact.pipelineId, CALL_SCHEDULED);
    store.updateContact(contact.id, {
      bookingCanceledAt: new Date().toISOString(), bookedSlot: undefined, bookedAt: undefined,
      ...(qualified >= 0 && contact.stage === scheduled ? { stage: qualified } : {}),
    });
    store.addActivity({ workspaceId, contactId: contact.id, type: "call", title: "Call canceled", body: `${contact.bookedSlot ?? "Booking"} canceled in Calendly` });
    return "canceled" as const;
  });

router.post("/webhooks/calendly", async (req, res) => {
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!raw) return res.status(400).json({ error: "raw_body_unavailable" });

  const verified = verifyWebhook(raw, req.get("calendly-webhook-signature"));
  if (!verified.ok) {
    // 503 when we simply aren't set up yet; 401 means someone sent us something bogus.
    const status = verified.reason === "not_configured" ? 503 : 401;
    logger.warn({ reason: verified.reason }, "calendly webhook rejected");
    return res.status(status).json({ error: verified.reason });
  }

  const workspaceId = await targetWorkspaceId();
  if (!workspaceId || !(await getPhoenixStore(workspaceId))) return res.status(503).json({ error: "workspace_unavailable" });

  try {
    if (verified.event.event === "invitee.created") {
      const outcome = await applyCreated(workspaceId, verified.event);
      return res.json({ ok: true, outcome });
    }
    if (verified.event.event === "invitee.canceled") {
      const outcome = await applyCanceled(workspaceId, verified.event);
      return res.json({ ok: true, outcome });
    }
  } catch (err) {
    // Returning 5xx makes Calendly retry, which is what we want for a transient
    // DB failure. The payload is signed, so a retry is safe to accept.
    logger.error({ err, event: verified.event.event }, "calendly webhook handling failed");
    return res.status(500).json({ error: "handler_failed" });
  }

  // Acknowledge event types we don't act on, so Calendly stops retrying them.
  res.json({ ok: true, outcome: "ignored" });
});

export default router;
