import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { getStore } from "@/lib/store";
import { WORKSPACE_ID } from "@/lib/seed";
import type { IntakeAnswers, UtmParams } from "@/lib/types";

// Partial-progress persistence: every answer lands here (debounced client-side)
// so a returning visitor resumes at their step.

type Body = {
  funnelSlug?: string;
  variant?: string;
  resumeToken?: string;
  step?: number;
  answers?: IntakeAnswers;
  utm?: UtmParams;
  submitted?: boolean;
};

export async function POST(req: Request) {
  if (!rateLimit(`session:${clientKey(req)}`, 60, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { funnelSlug, resumeToken } = body;
  if (!funnelSlug || !resumeToken || typeof resumeToken !== "string" || resumeToken.length > 128) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const store = getStore();
  const funnel = await store.getFunnelBySlug(funnelSlug);
  if (!funnel) return NextResponse.json({ error: "unknown_funnel" }, { status: 404 });

  const session = await store.upsertIntakeSession({
    id: resumeToken,
    workspaceId: WORKSPACE_ID,
    funnelSlug,
    variant: String(body.variant ?? "A"),
    resumeToken,
    step: Math.min(5, Math.max(1, Number(body.step ?? 1))),
    answers: body.answers ?? {},
    utm: body.utm ?? {},
    submitted: Boolean(body.submitted),
  });
  return NextResponse.json({ ok: true, updatedAt: session.updatedAt });
}

// Resume across devices: GET /api/intake/session?token=…
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  const session = await getStore().getIntakeSession(token);
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ session });
}
