import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const samplePayload = JSON.stringify(
  {
    event: "lead.qualified",
    lead: {
      id: "ld_8x2k",
      name: "Marcus Webb",
      email: "marcus@webbmech.com",
      company: "Webb Mechanical",
      funnel: "lack-of-control",
      score: 88,
      tags: ["coachable", "icp-fit", "hot"],
      utm: { source: "google", medium: "cpc", campaign: "founders-q3" },
    },
    occurred_at: "2026-09-01T13:14:02Z",
  },
  null,
  2
);

export default async function IntegrationsPage() {
  const store = getStore();
  const [webhooks, syncLog] = await Promise.all([store.listWebhooks(), store.listSyncLog()]);
  const zapierInboundConfigured = Boolean(process.env.ZAPIER_INBOUND_TOKEN);
  const sendgridConfigured = Boolean(process.env.SENDGRID_API_KEY);
  const hubspotConfigured = Boolean(
    process.env.HUBSPOT_ACCESS_TOKEN ||
      (process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET)
  );

  return (
    <section>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Integrations</h1>
      <div className="integrations-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Zapier */}
          <div className="adm-card">
            <div className="integration-head">
              <div className="integration-id">
                <span className="integration-logo" style={{ background: "#FF4F00", color: "#fff" }}>
                  ⚡
                </span>
                <div>
                  <div className="name">Zapier</div>
                  <div className={`status ${zapierInboundConfigured ? "on" : "off"}`}>
                    ● {zapierInboundConfigured ? "Connected" : "Add ZAPIER_INBOUND_TOKEN to connect"}
                  </div>
                </div>
              </div>
              <button className="adm-btn-ghost sm">Manage</button>
            </div>
            <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700 }}>Outbound events</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {webhooks.map((z) => (
                <div key={z.id} className="zap-event-row">
                  <code>{z.event}</code>
                  <span className="desc">{z.desc}</span>
                  <span className={`pill ${z.active ? "ok" : "neutral"}`}>
                    {z.active ? "Active" : "Paused"}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700 }}>
              Sample payload — <code style={{ fontWeight: 400 }}>lead.qualified</code>
            </div>
            <pre className="payload-block">{samplePayload}</pre>
            <div className="inbound-row">
              <code>POST /api/webhooks/zapier/inbound</code>
              <span className="note">Inbound updates · token auth</span>
            </div>
          </div>

          {/* SendGrid */}
          <div className="adm-card">
            <div className="integration-head">
              <div className="integration-id">
                <span className="integration-logo" style={{ background: "#EAF0F6", color: "var(--ink)" }}>
                  ✉
                </span>
                <div>
                  <div className="name">SendGrid</div>
                  <div className={`status ${sendgridConfigured ? "on" : "off"}`}>
                    ● {sendgridConfigured ? "Connected" : "Add SENDGRID_API_KEY to connect"}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              <div className="sg-row">
                <span>Intake confirmation → prospect</span>
                <span className="on">On</span>
              </div>
              <div className="sg-row">
                <span>New-lead notification → Joshua</span>
                <span className="on">On</span>
              </div>
            </div>
          </div>
        </div>

        {/* HubSpot */}
        <div className="adm-card">
          <div className="integration-head">
            <div className="integration-id">
              <span className="integration-logo" style={{ background: "#FF7A59", color: "#fff" }}>
                H
              </span>
              <div>
                <div className="name">HubSpot</div>
                <div className={`status ${hubspotConfigured ? "on" : "off"}`}>
                  ●{" "}
                  {hubspotConfigured
                    ? "OAuth connected · rate-limit aware"
                    : "Add HUBSPOT_CLIENT_ID/SECRET, then connect"}
                </div>
              </div>
            </div>
            <a className="adm-btn-ghost sm" href="/api/integrations/hubspot/oauth">
              {hubspotConfigured ? "Field mapping" : "Connect"}
            </a>
          </div>

          <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700 }}>Sync direction</div>
          <div className="hs-direction">
            <button className="hs-dir active">Two-way</button>
            <button className="hs-dir">Push only</button>
            <button className="hs-dir">Pull only</button>
          </div>

          <div style={{ marginTop: 14, fontSize: 13, fontWeight: 700 }}>Conflict handling</div>
          <div className="conflict-rule">
            Most recent edit wins · CRM is source of truth for score &amp; stage
          </div>

          <div className="adm-title-row" style={{ marginTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Sync log</div>
            <span className="adm-subtle" style={{ fontSize: 12 }}>
              Last full sync {syncLog[0]?.at ?? "—"}
            </span>
          </div>
          <div style={{ marginTop: 10 }}>
            {syncLog.map((s) => (
              <div key={s.id} className="synclog-row">
                <span className="time">{s.at}</span>
                <span className="msg">{s.msg}</span>
                <span className={`pill ${s.state === "ok" ? "ok" : s.state === "retried" ? "warn" : "bad"}`}>
                  {s.state === "ok" ? "✓ OK" : s.state === "retried" ? "↻ Retried" : "✕ Error"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
