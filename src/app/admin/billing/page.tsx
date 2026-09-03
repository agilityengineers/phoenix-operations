import { PLANS } from "@/lib/seed";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const subs = await getStore().listSubscriptions();
  const mrr = subs.reduce((sum, s) => sum + (s.state === "active" ? s.amountMonthly : 0), 0);
  const mrrWithTrials = subs.reduce((sum, s) => sum + s.amountMonthly, 0);
  const stripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY);

  return (
    <section>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Billing &amp; Plans</h1>
      <p className="adm-lede">
        Partner workspaces subscribe via Stripe. Phoenix Operations (network admin) sees every
        subscription; partners see only their own.
      </p>

      <div className="plan-grid">
        {PLANS.map((p) => (
          <div key={p.id} className={`plan-card${p.popular ? " popular" : ""}`}>
            <div className="head">
              <span className="name">{p.name}</span>
              {p.popular && <span className="popular-badge">Most common</span>}
            </div>
            <div className="price">
              ${p.price}
              <span className="per">/mo</span>
            </div>
            <ul>
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="adm-card" style={{ marginTop: 16 }}>
        <div className="adm-title-row">
          <div className="adm-card-title">Subscriptions</div>
          <span className="adm-subtle">
            MRR <strong style={{ color: "var(--ink)" }}>${mrrWithTrials || mrr}</strong> · Stripe{" "}
            {stripeConfigured ? (
              <>
                connected <span style={{ color: "var(--success)", fontWeight: 700 }}>●</span>
              </>
            ) : (
              <>
                not configured <span style={{ color: "var(--muted-3)", fontWeight: 700 }}>●</span>
              </>
            )}
          </span>
        </div>
        <div style={{ marginTop: 10 }}>
          {subs.map((s) => (
            <div key={s.id} className="sub-row">
              <div>
                <div className="name">{s.workspaceName}</div>
                <div className="domain">{s.domain}</div>
              </div>
              <span style={{ fontWeight: 600 }}>
                {s.plan.charAt(0).toUpperCase() + s.plan.slice(1)}
              </span>
              <span style={{ color: "var(--muted-2)" }}>{s.since}</span>
              <span style={{ fontWeight: 700 }}>${s.amountMonthly}</span>
              <span className={`pill ${s.state === "active" ? "ok" : "warn"}`}>
                {s.state === "active" ? "Active" : `Trial · ${s.trialDaysLeft} days left`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
