import { useQuery } from "@tanstack/react-query";
import { getStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

const KIND_COLORS: Record<string, string> = {
  Email: "#D96C2C",
  Task: "#B5541C",
  CRM: "#3A5474",
  Zap: "#2E7D43",
};

export default function SequencesPage() {
  const store = getStore();

  const { data: sequences, isLoading } = useQuery({
    queryKey: ["sequences"],
    queryFn: () => store.listSequences(),
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  }

  if (!sequences) return null;

  return (
    <section>
      <div className="adm-title-row">
        <h1>Follow-up Sequences</h1>
        <button className="adm-btn">+ New sequence</button>
      </div>
      <p className="adm-lede">
        Automation templates for intake events. Email delivery is unavailable until an email provider is connected; stage moves and tasks
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
