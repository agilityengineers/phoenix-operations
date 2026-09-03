import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

// POST /api/cms/toggle — homepage/guide/results/funnel-template section on/off.
export async function POST(req: Request) {
  let body: { pageId?: string; sectionId?: string; enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.pageId || !body.sectionId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  await getStore().setCmsSection(body.pageId, body.sectionId, Boolean(body.enabled));
  return NextResponse.json({ ok: true });
}
