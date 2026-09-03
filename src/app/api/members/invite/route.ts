import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["admin", "owner", "staff", "partner"];

// POST /api/members/invite — adds an invited member row.
// With Supabase configured this also triggers an auth invite email.
export async function POST(req: Request) {
  let body: { email?: string; role?: Role };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/.+@.+\..+/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  const role = ROLES.includes(body.role as Role) ? (body.role as Role) : "staff";
  const member = await getStore().inviteMember(email, role);
  return NextResponse.json({ member });
}
