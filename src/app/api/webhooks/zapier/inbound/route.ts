import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { WORKSPACE_ID } from "@/lib/seed";
import { getStore } from "@/lib/store";

// Inbound Zapier endpoint — token auth via Authorization: Bearer <token>
// or ?token= query param (Zapier's webhook action supports either).
//
// Supported actions:
//   { action: "update_contact", email, fields: { stage?, owner?, company?, phone? } }
//   { action: "add_note",       email, note }
//
// Zap setup docs live in the repo README (copy-pasteable field list).

export async function POST(req: Request) {
  if (!rateLimit(`zapin:${clientKey(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const expected = process.env.ZAPIER_INBOUND_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "inbound_disabled" }, { status: 503 });
  }
  const url = new URL(req.url);
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : url.searchParams.get("token");
  if (token !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    action?: string;
    email?: string;
    note?: string;
    fields?: { stage?: string; owner?: string; company?: string; phone?: string };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = (body.email ?? "").toLowerCase();
  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

  const store = getStore();
  const contact = (await store.listContacts()).find((c) => c.email.toLowerCase() === email);
  if (!contact) return NextResponse.json({ error: "contact_not_found" }, { status: 404 });

  if (body.action === "add_note" && body.note) {
    await store.addActivity({
      workspaceId: WORKSPACE_ID,
      contactId: contact.id,
      type: "note",
      title: "Note added via Zapier",
      body: String(body.note).slice(0, 2000),
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_contact" && body.fields) {
    const patch: Record<string, unknown> = {};
    if (body.fields.owner) patch.owner = body.fields.owner;
    if (body.fields.company) patch.company = body.fields.company;
    if (body.fields.stage) {
      const pipelines = await store.listPipelines();
      const stages = pipelines.find((p) => p.id === contact.pipelineId)?.stages ?? [];
      const idx = stages.findIndex((s) => s.toLowerCase() === body.fields!.stage!.toLowerCase());
      if (idx >= 0) patch.stage = idx;
    }
    await store.updateContact(contact.id, patch);
    await store.addActivity({
      workspaceId: WORKSPACE_ID,
      contactId: contact.id,
      type: "note",
      title: "Updated via Zapier",
      body: `Fields: ${Object.keys(patch).join(", ") || "none matched"}`,
    });
    return NextResponse.json({ ok: true, updated: Object.keys(patch) });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
