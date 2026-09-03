import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";
import { WORKSPACE_ID } from "@/lib/seed";
import { dispatchEvent } from "@/lib/connectors/registry";

// Scheduler booking: records the slot, moves the contact to "Call scheduled",
// and lets SendGrid send the confirmation with the booked time.
// (Production swap-in point for a Calendly/scheduling embed webhook.)

type Body = {
  resumeToken?: string;
  contactId?: string;
  slot?: string;
  funnelSlug?: string;
};

export async function POST(req: Request) {
  if (!rateLimit(`book:${clientKey(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.slot || typeof body.slot !== "string" || body.slot.length > 64) {
    return NextResponse.json({ error: "missing_slot" }, { status: 400 });
  }

  const store = getStore();
  let contact = body.contactId ? await store.getContact(body.contactId) : null;
  if (!contact && body.resumeToken) {
    const session = await store.getIntakeSession(body.resumeToken);
    if (session?.answers.email) {
      contact =
        (await store.listContacts()).find(
          (c) => c.email.toLowerCase() === session.answers.email!.toLowerCase()
        ) ?? null;
    }
  }
  if (!contact) return NextResponse.json({ error: "contact_not_found" }, { status: 404 });

  const pipelines = await store.listPipelines();
  const prospects = pipelines.find((p) => p.id === contact!.pipelineId);
  const callStage = prospects?.stages.findIndex((s) => s === "Call scheduled") ?? -1;

  const updated = (await store.updateContact(contact.id, {
    bookedSlot: body.slot,
    ...(callStage >= 0 && contact.stage < callStage ? { stage: callStage } : {}),
  }))!;

  await store.addActivity({
    workspaceId: WORKSPACE_ID,
    contactId: contact.id,
    type: "call",
    title: "Call booked",
    body: `${body.slot} Eastern · 15 minutes`,
  });
  if (callStage >= 0 && contact.stage < callStage) {
    await store.addActivity({
      workspaceId: WORKSPACE_ID,
      contactId: contact.id,
      type: "stage_change",
      title: "Stage → Call scheduled",
      body: "Booked-call sequence: confirmation + reminders scheduled",
    });
    await dispatchEvent("stage.changed", updated, { stage: "Call scheduled" });
  }
  // Send confirmation (now that the slot is known).
  await dispatchEvent("intake.completed", updated, { rebooking: true });

  return NextResponse.json({ ok: true });
}
