import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { getStore } from "@/lib/store";
import { Loader2 } from "lucide-react";

export default function FunnelsPage() {
  const store = getStore();

  const { data: funnels, isLoading } = useQuery({
    queryKey: ["funnels"],
    queryFn: () => store.listFunnels(),
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  }

  if (!funnels) return null;

  return (
    <section>
      <div className="adm-title-row">
        <h1>Funnels</h1>
        <Link href="/admin/funnels/new" className="adm-btn">
          + New funnel
        </Link>
      </div>
      <div className="funnels-grid">
        {funnels.map((f) => (
          <div key={f.id} className="funnel-card">
            <div className="head">
              <div className="name">{f.name}</div>
              <span className={`status-pill ${f.status}`}>{f.status}</span>
            </div>
            <div className="headline">
              &ldquo;{f.variants[0]?.headline}&rdquo; — {f.segment.split("—")[1]?.trim() ?? f.segment}
            </div>
            <div className="slug">
              /f/{f.slug} · {f.variants.length} variant{f.variants.length === 1 ? "" : "s"}
            </div>
            <div className="stats">
              <span>
                <strong>{f.stats.visits ? f.stats.visits.toLocaleString() : "—"}</strong> visits
              </span>
              <span>
                <strong>{f.stats.leads || "—"}</strong> leads
              </span>
              <span>
                <strong>{f.stats.cvr}</strong> CVR
              </span>
            </div>
            <div className="actions">
              <Link href={`/admin/funnels/${f.id}`} className="adm-btn-outline">
                Edit funnel
              </Link>
              <Link href={`/f/${f.slug}`} className="adm-btn-ghost">
                View page
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
