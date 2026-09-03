import { getStore } from "../store";
import type { Contact } from "../types";
import { buildLeadPayload, type Connector, type OutboundEvent } from "./types";

// Outbound Zapier webhooks. Each enabled endpoint for the event receives the
// stable JSON schema documented in the admin Integrations view:
//   { event, lead: { id, name, email, company, funnel, score, tags, utm }, occurred_at }
export const zapierConnector: Connector = {
  name: "zapier",

  configured() {
    // Outbound needs at least one endpoint URL configured (admin → Integrations).
    // Always report configured: endpoints are checked per event at send time.
    return true;
  },

  async onEvent(event: OutboundEvent, contact: Contact, extra?: Record<string, unknown>) {
    const store = getStore();
    try {
      const endpoints = await store.listWebhooks();
      const targets = endpoints.filter((e) => e.event === event && e.active && e.url);
      if (targets.length === 0) return;
      const payload = buildLeadPayload(event, contact, extra);
      await Promise.all(
        targets.map(async (t) => {
          try {
            const res = await fetch(t.url!, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            await store.addSyncLog({
              workspaceId: contact.workspaceId,
              at: timeLabel(),
              msg: `Zapier ${event} → ${new URL(t.url!).hostname}`,
              state: res.ok ? "ok" : "error",
            });
          } catch {
            await store.addSyncLog({
              workspaceId: contact.workspaceId,
              at: timeLabel(),
              msg: `Zapier ${event} delivery failed`,
              state: "error",
            });
          }
        })
      );
    } catch {
      // Never let integration failures break the intake flow.
    }
  },
};

function timeLabel(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}
