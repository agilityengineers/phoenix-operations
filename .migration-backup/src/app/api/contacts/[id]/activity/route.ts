import { NextResponse } from "next/server";
import { WORKSPACE_ID } from "@/lib/seed";
import { getStore } from "@/lib/store";
import type { ActivityType } from "@/lib/types";

// POST /api/contacts/[id]/activity — + Note and + Task from contact detail.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { type?: ActivityType; title?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const type = body.type === "task" ? "task" : "note";
  const text = (body.body ?? "").slice(0, 2000);
  if (!text) return NextResponse.json({ error: "body_required" }, { status: 400 });

  const store = getStore();
  const contact = await store.getContact(id);
  if (!contact) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const activity = await store.addActivity({
    workspaceId: WORKSPACE_ID,
    contactId: id,
    type,
    title: body.title ?? (type === "task" ? "Task created" : "Note added"),
    body: text,
  });
  return NextResponse.json({ activity });
}
