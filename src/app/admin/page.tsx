import Link from "next/link";
import ScorePill from "@/components/admin/ScorePill";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const funnelBars = [
  { label: "Visits", n: "1,284", h: "100%", rate: "—", color: "#14263B" },
  { label: "Started", n: "211", h: "46%", rate: "16.4%", color: "#3A5474" },
  { label: "Completed", n: "86", h: "28%", rate: "40.8%", color: "#D96C2C" },
  { label: "Qualified", n: "34", h: "15%", rate: "39.5%", color: "#E8894E" },
];

const sources = [
  { name: "google / cpc", n: 31, pct: "100%" },
  { name: "referral", n: 22, pct: "71%" },
  { name: "linkedin / organic", n: 18, pct: "58%" },
  { name: "facebook / paid", n: 9, pct: "29%" },
];

export default async function DashboardPage() {
  const store = getStore();
  const [contacts, pipelines] = await Promise.all([store.listContacts(), store.listPipelines()]);
  const prospects = pipelines.find((p) => p.id === "prospects");
  const stages = prospects?.stages ?? [];
  const liveSubmissions = contacts.filter((c) => c.id.startsWith("ld_")).length;
  const qualified = contacts.filter((c) => c.score >= 70).length;
  const hotLeads = contacts
    .filter((c) => c.score >= 70 && c.pipelineId === "prospects")
    .slice(0, 4);

  const kpis = [
    { label: "Visits", value: "1,284", delta: "▲ 12% vs prior", tone: "up" },
    { label: "Started intake", value: "211", delta: "▲ 9% vs prior", tone: "up" },
    { label: "Completed", value: String(86 + liveSubmissions), delta: "▲ 15% vs prior", tone: "up" },
    { label: "Qualified (70+)", value: String(qualified + 29), delta: "▼ 3% vs prior", tone: "down" },
  ];

  return (
    <section>
      <div className="adm-title-row baseline">
        <h1>Dashboard</h1>
        <span className="adm-subtle">Last 30 days</span>
      </div>

      <div className="kpi-grid">
        {kpis.map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.value}</div>
            <div className={`kpi-delta ${k.tone}`}>{k.delta}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div className="adm-card">
          <div className="adm-card-title">Funnel conversion — Lack of Control</div>
          <div className="funnel-chart">
            {funnelBars.map((b) => (
              <div key={b.label} className="funnel-bar-col">
                <span className="n">{b.n}</span>
                <div className="funnel-bar" style={{ background: b.color, height: b.h }} />
              </div>
            ))}
          </div>
          <div className="funnel-chart-labels">
            {funnelBars.map((b) => (
              <div key={b.label}>
                {b.label}
                <br />
                <strong>{b.rate}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="adm-card">
          <div className="adm-card-title">Top sources</div>
          <div className="source-rows">
            {sources.map((s) => (
              <div key={s.name} className="source-row">
                <div className="meta">
                  <span className="name">{s.name}</span>
                  <span className="n">{s.n} leads</span>
                </div>
                <div className="source-track">
                  <div className="source-fill" style={{ width: s.pct }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="adm-card" style={{ marginTop: 16 }}>
        <div className="adm-title-row">
          <div className="adm-card-title">Newest qualified leads</div>
          <Link href="/admin/contacts" className="adm-link-btn">
            View all →
          </Link>
        </div>
        <div style={{ marginTop: 12 }}>
          {hotLeads.map((c) => (
            <Link key={c.id} href={`/admin/contacts/${c.id}`} className="lead-row">
              <div>
                <div className="name">{c.name}</div>
                <div className="company">{c.company}</div>
              </div>
              <div className="cell">{c.funnel}</div>
              <div className="cell">{c.source}</div>
              <div>
                <ScorePill score={c.score} />
              </div>
              <div className="stage-chip">{stages[c.stage] ?? "—"}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
