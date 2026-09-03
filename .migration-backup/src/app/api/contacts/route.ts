import { NextResponse } from "next/server";
import { WORKSPACE_ID } from "@/lib/seed";
import { getStore } from "@/lib/store";

// POST /api/contacts — manual card creation from the pipeline board.
export async function POST(req: Request) {
  let body: { name?: string; company?: string; pipelineId?: string; stage?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });

  const store = getStore();
  const pipelines = await store.listPipelines();
  const pipelineId = pipelines.some((p) => p.id === body.pipelineId)
    ? body.pipelineId!
    : "prospects";
  const stageCount = pipelines.find((p) => p.id === pipelineId)?.stages.length ?? 4;

  const contact = await store.createContact({
    workspaceId: WORKSPACE_ID,
    pipelineId,
    name,
    company: (body.company ?? "").trim() || "—",
    role: "—",
    email: "—",
    funnel: "Manual",
    source: "manual",
    score: 50,
    stage: Math.max(0, Math.min(stageCount - 1, Number(body.stage ?? 0))),
    position: 0,
    owner: "Joshua",
  });
  await store.addActivity({
    workspaceId: WORKSPACE_ID,
    contactId: contact.id,
    type: "note",
    title: "Contact created",
    body: "Added manually from the pipeline board",
  });
  return NextResponse.json({ contact });
}
