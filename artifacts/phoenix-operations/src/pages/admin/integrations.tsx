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

type SenderAuthentication = "domain" | "single_sender" | "unverified" | "unknown";
type EmailStatus = {
  configured: boolean;
  sandbox: boolean;
  domain: string;
  ready: boolean;
  error?: string;
  detail?: string;
  senders: { key: string; email: string; name: string; replyTo: string; monitored: boolean; authentication: SenderAuthentication; onMailDomain: boolean }[];
  domainAuthentication: {
    id: number;
    domain: string;
    subdomain: string | null;
    valid: boolean;
    records: { name: string; type: string; host: string; data: string; valid: boolean }[];
  } | null;
};

const SENDGRID_ERRORS: Record<string, string> = {
  not_configured: "Add SENDGRID_API_KEY to Replit Secrets and restart the deployment.",
  unauthorized: "SendGrid rejected the API key. Create a new one and update the secret.",
  forbidden: "The API key works but lacks the scope for this. It needs Mail Send and Sender Authentication.",
  sender_not_authenticated: "SendGrid will not send as that address yet — finish authenticating the domain.",
  rate_limited: "SendGrid is rate-limiting us. Try again shortly.",
  payload_rejected: "SendGrid refused the message itself.",
  timeout: "SendGrid didn't respond in time.",
  network: "Couldn't reach SendGrid from the server.",
  upstream_error: "SendGrid returned an unexpected error.",
};

const AUTH_LABEL: Record<SenderAuthentication, string> = {
  domain: "Domain authenticated",
  single_sender: "Single sender verified",
  unverified: "Not authenticated",
  unknown: "Unknown",
};

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

  // Zapier and HubSpot remain unimplemented; Calendly and SendGrid below are live.
  const zapierInboundConfigured = false;
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

          <SendGridCard />
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
 * Credentials live in server env vars and are never sent here — this only reads
 * connection status and edits the non-secret event type the funnel books against.
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

/**
 * Email delivery. Like Calendly, the API key stays on the server; this reads
 * status only. The DNS records it shows are the exception, and deliberately so —
 * they are public records the admin has to publish to make the domain send.
 */
function SendGridCard() {
  const [sending, setSending] = useState("");
  const [notice, setNotice] = useState("");

  const status = useQuery({
    queryKey: ["email-status"],
    queryFn: () => apiRequest<EmailStatus>("/email/status"),
  });

  const data = status.data;
  const auth = data?.domainAuthentication;
  const ready = Boolean(data?.ready);

  const headline = () => {
    if (status.isLoading) return "Checking…";
    if (!data?.configured) return "Add SENDGRID_API_KEY to connect";
    if (data.error) return SENDGRID_ERRORS[data.error] ?? `SendGrid returned: ${data.error}`;
    if (ready) return `Sending as ${data.domain}`;
    return "Connected — finish authenticating the domain";
  };

  const sendTest = async (key: string) => {
    setSending(key);
    setNotice("");
    try {
      const result = await apiRequest<{ to: string; sandbox: boolean }>("/email/test", {
        method: "POST",
        body: JSON.stringify({ from: key }),
      });
      setNotice(
        result.sandbox
          ? `SendGrid accepted the ${key} test and discarded it — sandbox mode is on.`
          : `Test sent from ${key} to ${result.to}.`,
      );
    } catch {
      setNotice(`Couldn't send the ${key} test. Check the sender's status above.`);
    } finally {
      setSending("");
    }
  };

  return (
    <div className="adm-card">
      <div className="integration-head">
        <div className="integration-id">
          <span className="integration-logo" style={{ background: "#EAF0F6", color: "var(--ink)" }}>✉</span>
          <div>
            <div className="name">SendGrid</div>
            <div className={`status ${ready ? "on" : "off"}`}>● {headline()}</div>
          </div>
        </div>
      </div>

      {data?.sandbox && (
        <div className="conflict-rule" style={{ marginTop: 14 }}>
          Sandbox mode is on (SENDGRID_SANDBOX). SendGrid validates every message and then discards it — nothing reaches an inbox.
        </div>
      )}

      {data?.configured && (
        <>
          <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700 }}>Domain authentication</div>
          {!auth ? (
            <div className="conflict-rule" style={{ marginTop: 10 }}>
              No authentication for {data.domain} yet. In SendGrid: Settings → Sender Authentication → Authenticate Your Domain,
              then publish the CNAME records it gives you. One domain authentication covers all three senders below.
            </div>
          ) : (
            <>
              <div className="sg-row" style={{ marginTop: 10 }}>
                <span>{auth.domain}</span>
                <span className={auth.valid ? "on" : undefined}>{auth.valid ? "Verified" : "DNS not verified yet"}</span>
              </div>
              {!auth.valid && auth.records.length > 0 && (
                <>
                  <div style={{ marginTop: 12, fontSize: 12, color: "#8A94A2" }}>Publish these records on the domain, then re-check:</div>
                  <pre className="payload-block">
                    {auth.records
                      .map((record) => `${record.valid ? "✓" : "✗"} ${record.type.toUpperCase()}  ${record.host}  →  ${record.data}`)
                      .join("\n")}
                  </pre>
                </>
              )}
            </>
          )}

          <div style={{ marginTop: 18, fontSize: 13, fontWeight: 700 }}>Senders</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
            {data.senders.map((sender) => (
              <div className="sg-row" key={sender.key}>
                <span>
                  {sender.email}
                  <span style={{ color: "#8A94A2" }}> · replies → {sender.replyTo}</span>
                  {!sender.onMailDomain && <span style={{ color: "#8A94A2" }}> · off the authenticated domain</span>}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span className={sender.authentication === "domain" || sender.authentication === "single_sender" ? "on" : undefined}>
                    {AUTH_LABEL[sender.authentication]}
                  </span>
                  <button className="hs-dir" disabled={Boolean(sending)} onClick={() => void sendTest(sender.key)}>
                    {sending === sender.key ? "Sending…" : "Send test"}
                  </button>
                </span>
              </div>
            ))}
          </div>
          <div className="adm-subtle" style={{ marginTop: 10, fontSize: 12 }}>
            A test goes to your own address, never anyone else&apos;s.
          </div>

          <div style={{ marginTop: 14 }}>
            <button className="hs-dir" disabled={status.isFetching} onClick={() => void status.refetch()}>
              {status.isFetching ? "Re-checking…" : "Re-check with SendGrid"}
            </button>
          </div>
          {notice && <div className="adm-subtle" style={{ marginTop: 10, fontSize: 12 }}>{notice}</div>}
        </>
      )}
    </div>
  );
}
