import { toCsv } from "@/lib/csv";
import { getStore } from "@/lib/store";

// GET /api/contacts/export?pipeline=prospects — CSV download.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const pipelineFilter = url.searchParams.get("pipeline");

  const store = getStore();
  const [contacts, pipelines] = await Promise.all([store.listContacts(), store.listPipelines()]);
  const rows = contacts
    .filter((c) => !pipelineFilter || c.pipelineId === pipelineFilter)
    .map((c) => {
      const stages = pipelines.find((p) => p.id === c.pipelineId)?.stages ?? [];
      return {
        name: c.name,
        company: c.company,
        email: c.email,
        phone: c.phone ?? "",
        role: c.role,
        pipeline: c.pipelineId,
        stage: stages[c.stage] ?? String(c.stage),
        score: c.score,
        funnel: c.funnel,
        source: c.source,
        owner: c.owner,
        created_at: c.createdAt,
      };
    });

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="contacts-${pipelineFilter ?? "all"}.csv"`,
    },
  });
}
