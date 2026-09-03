import { NextResponse } from "next/server";
import { dispatchEvent } from "@/lib/connectors/registry";
import { WORKSPACE_ID } from "@/lib/seed";
import { getStore } from "@/lib/store";

// PATCH /api/contacts/[id] — stage moves (kanban drag / arrows) and edits.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { stage?: number; pipelineId?: string; owner?: string; name?: string; company?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const store = getStore();
  const before = await store.getContact(id);
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const contact = await store.updateContact(id, {
    ...(body.stage !== undefined ? { stage: Number(body.stage) } : {}),
    ...(body.pipelineId ? { pipelineId: body.pipelineId } : {}),
    ...(body.owner ? { owner: body.owner } : {}),
    ...(body.name ? { name: body.name } : {}),
    ...(body.company ? { company: body.company } : {}),
  });

  if (body.stage !== undefined && contact && before.stage !== contact.stage) {
    const pipelines = await store.listPipelines();
    const stages = pipelines.find((p) => p.id === contact.pipelineId)?.stages ?? [];
    await store.addActivity({
      workspaceId: WORKSPACE_ID,
      contactId: id,
      type: "stage_change",
      title: `Stage → ${stages[contact.stage] ?? contact.stage}`,
      body: `Moved from ${stages[before.stage] ?? before.stage}`,
    });
    await dispatchEvent("stage.changed", contact, { stage: stages[contact.stage] });
  }

  return NextResponse.json({ contact });
}
