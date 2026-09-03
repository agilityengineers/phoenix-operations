import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const KIND_COLORS: Record<string, string> = {
  Email: "#D96C2C",
  Task: "#B5541C",
  CRM: "#3A5474",
  Zap: "#2E7D43",
};

export default async function SequencesPage() {
  const sequences = await getStore().listSequences();

  return (
    <section>
      <div className="adm-title-row">
        <h1>Follow-up Sequences</h1>
        <button className="adm-btn">+ New sequence</button>
      </div>
      <p className="adm-lede">
        Automations that run after intake events. Emails send via SendGrid; stage moves and tasks
        land in the CRM.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 22 }}>
        {sequences.map((q) => (
          <div key={q.id} className="sequence-card">
            <div className="sequence-head">
              <span className={`pill ${q.active ? "ok" : "neutral"}`}>
                {q.active ? "Active" : "Paused"}
              </span>
              <div style={{ flex: 1 }}>
                <div className="name">{q.name}</div>
                <div className="trigger">Trigger: {q.trigger}</div>
              </div>
              <span className="stat">
                <strong>{q.stat}</strong> {q.statLabel}
              </span>
              <button className="adm-btn-ghost sm">Edit</button>
            </div>
            <div className="sequence-steps">
              {q.steps.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="seq-step">
                    <div className="kind" style={{ color: KIND_COLORS[s.kind] }}>
                      {s.kind}
                    </div>
                    <div className="label">{s.label}</div>
                  </div>
                  {i < q.steps.length - 1 && <span className="seq-arrow">→</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
