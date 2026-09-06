import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStore } from "@/lib/store";
import { apiRequest } from "@/lib/store/api";
import type { SchedulingConfig } from "@/lib/types";
import { Loader2 } from "lucide-react";

type SchedulingStatus = {
  tokenPresent: boolean;
  webhookConfigured: boolean;
  connected: boolean;
  error?: string;
  account: { name: string; email: string; schedulingUrl: string; timezone: string } | null;
  scheduling?: SchedulingConfig;
};
type EventType = { uri: string; name: string; duration: number; schedulingUrl: string };

const CALENDLY_ERRORS: Record<string, string> = {
  unauthorized: "The access token was rejected. Generate a new one in Calendly and update CALENDLY_PERSONAL_ACCESS_TOKEN.",
  forbidden_plan: "This Calendly plan doesn't include API access. The Scheduling API and webhooks need a paid plan.",
  rate_limited: "Calendly is rate-limiting us. Try again shortly.",
  endpoint_unavailable: "Calendly didn't recognise that endpoint. Check CALENDLY_CREATE_INVITEE_PATH against your account's API version.",
  timeout: "Calendly didn't respond in time.",
  network: "Couldn't reach Calendly from the server.",
};

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

export default function IntegrationsPage() {
  const store = getStore();

  const { data, isLoading } = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      const webhooks = await store.listWebhooks();
      return { webhooks };
    },
  });

  if (isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-orange-500" /></div>;
  }

  if (!data) return null;
  const { webhooks } = data;

  // Zapier/SendGrid/HubSpot remain unimplemented; Calendly below is live.
  const zapierInboundConfigured = false;
  const sendgridConfigured = false;
  const hubspotConfigured = false;

  return (
    <section>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Integrations</h1>
      <div className="integrations-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CalendlyCard />

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
                    ● Unavailable until an integration is connected
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700 }}>Outbound events</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {webhooks.map((z) => (
                <div key={z.id} className="zap-event-row">
                  <code>{z.event}</code>
                  <span className="desc">{z.desc}</span>
                    <span className="pill neutral">Unavailable</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700 }}>
              Sample payload — <code style={{ fontWeight: 400 }}>lead.qualified</code>
            </div>
            <pre className="payload-block">{samplePayload}</pre>
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
                    ● Unavailable until email delivery is connected
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              <div className="sg-row">
                <span>Intake confirmation → prospect</span>
                <span>Unavailable</span>
              </div>
              <div className="sg-row">
                <span>New-lead notification → Joshua</span>
                <span>Unavailable</span>
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
                    ? "Connected"
                    : "Unavailable until OAuth is implemented"}
                </div>
              </div>
            </div>
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
             <span className="adm-subtle" style={{ fontSize: 12 }}>Unavailable until connected</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <div className="adm-subtle">No integration sync has run.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The one integration that actually does something. Credentials live in server
 * env vars and are never sent here — this only reads connection status and edits
 * the non-secret event type the funnel books against.
 */
function CalendlyCard() {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const status = useQuery({
    queryKey: ["scheduling-status"],
    queryFn: () => apiRequest<SchedulingStatus>("/scheduling/status"),
  });
  const eventTypes = useQuery({
    queryKey: ["scheduling-event-types"],
    queryFn: () => apiRequest<{ eventTypes: EventType[] }>("/scheduling/event-types"),
    enabled: Boolean(status.data?.tokenPresent && status.data.account),
    retry: false,
  });

  const scheduling = status.data?.scheduling;
  const connected = Boolean(status.data?.connected);

  const save = async (patch: Partial<SchedulingConfig>) => {
    setSaving(true);
    setNotice("");
    try {
      await apiRequest("/workspace", { method: "PATCH", body: JSON.stringify({ scheduling: patch }) });
      await status.refetch();
      setNotice("Saved.");
    } catch {
      setNotice("Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const chooseEventType = (uri: string) => {
    const chosen = eventTypes.data?.eventTypes.find((t) => t.uri === uri);
    if (!chosen) return;
    void save({ eventTypeUri: chosen.uri, eventTypeName: chosen.name, schedulingUrl: chosen.schedulingUrl, durationMinutes: chosen.duration });
  };

  return (
    <div className="adm-card">
      <div className="integration-head">
        <div className="integration-id">
          <span className="integration-logo" style={{ background: "#006BFF", color: "#fff" }}>C</span>
          <div>
            <div className="name">Calendly</div>
            <div className={`status ${connected ? "on" : "off"}`}>
              ●{" "}
              {status.isLoading
                ? "Checking…"
                : connected
                  ? `Connected as ${status.data?.account?.name ?? "Calendly user"}`
                  : !status.data?.tokenPresent
                    ? "Add CALENDLY_PERSONAL_ACCESS_TOKEN to connect"
                    : status.data?.error
                      ? "Token rejected by Calendly"
                      : "Connected — pick an event type to go live"}
            </div>
          </div>
        </div>
      </div>

      {status.data?.error && (
        <div className="conflict-rule" style={{ marginTop: 14 }}>
          {CALENDLY_ERRORS[status.data.error] ?? `Calendly returned: ${status.data.error}`}
        </div>
      )}

      {status.data?.tokenPresent && status.data.account && (
        <>
          <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700 }}>Event type the funnel books</div>
          {eventTypes.isLoading ? (
            <div className="adm-subtle" style={{ marginTop: 10 }}>Loading event types…</div>
          ) : eventTypes.isError ? (
            <div className="adm-subtle" style={{ marginTop: 10 }}>Couldn&apos;t load event types from Calendly.</div>
          ) : (
            <select
              className="field"
              style={{ marginTop: 10, width: "100%", padding: "10px 12px" }}
              value={scheduling?.eventTypeUri ?? ""}
              disabled={saving}
              onChange={(e) => chooseEventType(e.target.value)}
            >
              <option value="">Select an event type…</option>
              {eventTypes.data?.eventTypes.map((t) => (
                <option key={t.uri} value={t.uri}>{t.name} · {t.duration} min</option>
              ))}
            </select>
          )}

          <div className="sg-row" style={{ marginTop: 14 }}>
            <span>Show real availability in the funnel</span>
            <button
              className="hs-dir"
              disabled={saving || !scheduling?.eventTypeUri}
              onClick={() => void save({ enabled: !scheduling?.enabled })}
            >
              {scheduling?.enabled ? "On" : "Off"}
            </button>
          </div>
          <div className="sg-row">
            <span>Cancellation &amp; reschedule sync (webhook)</span>
            <span className={status.data.webhookConfigured ? "on" : undefined}>
              {status.data.webhookConfigured ? "Active" : "Add CALENDLY_WEBHOOK_SIGNING_KEY"}
            </span>
          </div>
          <div className="sg-row">
            <span>Account timezone</span>
            <span>{status.data.account.timezone}</span>
          </div>
          {notice && <div className="adm-subtle" style={{ marginTop: 10, fontSize: 12 }}>{notice}</div>}
        </>
      )}
    </div>
  );
}
