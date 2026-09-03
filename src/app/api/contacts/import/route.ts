import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/csv";
import { WORKSPACE_ID } from "@/lib/seed";
import { getStore } from "@/lib/store";
import type { Contact } from "@/lib/types";

// POST /api/contacts/import — multipart CSV with name,company,email,role,phone.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const pipelineId = String(form?.get("pipelineId") ?? "prospects");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) return NextResponse.json({ error: "empty_csv" }, { status: 400 });

  const store = getStore();
  const existing = await store.listContacts();
  const seen = new Set(existing.map((c) => c.email.toLowerCase()));

  const created: Contact[] = [];
  for (const row of rows.slice(0, 500)) {
    const name = row.name || [row.first_name, row.last_name].filter(Boolean).join(" ");
    if (!name) continue;
    const email = (row.email ?? "").toLowerCase();
    if (email && seen.has(email)) continue; // dedupe on email
    if (email) seen.add(email);
    created.push(
      await store.createContact({
        workspaceId: WORKSPACE_ID,
        pipelineId,
        name,
        company: row.company || "—",
        role: row.role || "—",
        email: row.email || "—",
        phone: row.phone || undefined,
        funnel: row.funnel || "Import",
        source: row.source || "csv import",
        score: Number(row.score) || 50,
        stage: 0,
        position: 0,
        owner: row.owner || "—",
      })
    );
  }

  return NextResponse.json({ contacts: created });
}
