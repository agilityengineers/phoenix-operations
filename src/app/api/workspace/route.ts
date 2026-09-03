import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import type { Brand, GuideProfile } from "@/lib/types";

// PATCH /api/workspace — white-label brand + guide identity updates.
export async function PATCH(req: Request) {
  let body: { brand?: Partial<Brand>; guide?: Partial<GuideProfile>; domain?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const store = getStore();
  const current = await store.getWorkspace();
  const workspace = await store.updateWorkspace({
    ...(body.domain ? { domain: body.domain } : {}),
    brand: { ...current.brand, ...(body.brand ?? {}) },
    guide: { ...current.guide, ...(body.guide ?? {}) },
  });
  return NextResponse.json({ workspace });
}
