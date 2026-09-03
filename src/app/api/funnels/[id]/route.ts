import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import type { Funnel } from "@/lib/types";

// PATCH — funnel builder save. POST with id "new" — create from the template.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: Partial<Funnel>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const funnel = await getStore().updateFunnel(id, {
    name: body.name,
    slug: body.slug,
    segment: body.segment,
    offer: body.offer,
    status: body.status,
    storybrand: body.storybrand,
    variants: body.variants,
    blocks: body.blocks,
    weights: body.weights,
  });
  if (!funnel) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ funnel });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (id !== "new") return NextResponse.json({ error: "use_patch" }, { status: 405 });
  let body: Funnel;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const store = getStore();
  const slug = (body.slug || "").replace(/[^a-z0-9-]/g, "");
  if (!slug) return NextResponse.json({ error: "slug_required" }, { status: 400 });
  if (await store.getFunnelBySlug(slug)) {
    return NextResponse.json({ error: "slug_taken" }, { status: 409 });
  }
  const funnel = await store.createFunnel({
    workspaceId: body.workspaceId,
    name: body.name || body.segment?.split("—")[0]?.trim() || "New funnel",
    slug,
    segment: body.segment ?? "",
    offer: body.offer ?? "Free 15-minute conversation — no pitch",
    status: "draft",
    kicker: body.kicker || `For founders who feel it: ${body.name || "this"}`,
    problemCopy: body.problemCopy ?? body.storybrand?.problem ?? "",
    stakes: body.stakes?.filter(Boolean).length ? body.stakes : [],
    storybrand: body.storybrand,
    variants: body.variants?.length ? body.variants : [{ id: "A", label: "A", headline: "", trafficPct: 100 }],
    blocks: body.blocks ?? [],
    weights: body.weights ?? { icpFit: 40, coachability: 25, authority: 20, urgency: 15 },
    stats: { visits: 0, leads: 0, cvr: "—" },
  });
  return NextResponse.json({ funnel });
}
