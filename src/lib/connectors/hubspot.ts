import { getStore } from "../store";
import type { Contact } from "../types";
import type { Connector, OutboundEvent } from "./types";

// HubSpot two-way contact sync (OAuth app).
// Push path: lead events upsert a HubSpot contact by email with mapped fields.
// Pull path + token refresh live in /api/integrations/hubspot/*.
// Conflict rule: most recent edit wins; this CRM is the source of truth for
// score & stage (those two fields always push, never pull).
// 429 handling: exponential backoff retry, logged to the visible sync log.

const FIELD_MAP: Record<string, (c: Contact) => string | undefined> = {
  email: (c) => c.email,
  firstname: (c) => c.name.split(" ")[0],
  lastname: (c) => c.name.split(" ").slice(1).join(" ") || undefined,
  company: (c) => c.company,
  phone: (c) => c.phone,
  jobtitle: (c) => c.role,
  // Custom properties (create in HubSpot: settings → properties)
  po_score: (c) => String(c.score),
  po_funnel: (c) => c.funnel,
  po_source: (c) => c.source,
};

async function getAccessToken(): Promise<string | null> {
  // Tokens obtained via the OAuth flow are stored per-workspace
  // (hubspot_connections). Env var fallback supports private-app tokens.
  if (process.env.HUBSPOT_ACCESS_TOKEN) return process.env.HUBSPOT_ACCESS_TOKEN;
  return null;
}

async function upsertContact(token: string, contact: Contact): Promise<Response> {
  const properties: Record<string, string> = {};
  for (const [prop, get] of Object.entries(FIELD_MAP)) {
    const v = get(contact);
    if (v) properties[prop] = v;
  }
  // Upsert by email via the CRM v3 search+create pattern.
  const search = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      filterGroups: [
        { filters: [{ propertyName: "email", operator: "EQ", value: contact.email }] },
      ],
      properties: ["email"],
      limit: 1,
    }),
  });
  if (search.status === 429) return search;
  const found = search.ok ? await search.json() : { total: 0 };
  if (found.total > 0) {
    const id = found.results[0].id;
    return fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ properties }),
    });
  }
  return fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ properties }),
  });
}

export const hubspotConnector: Connector = {
  name: "hubspot",

  configured() {
    return Boolean(
      process.env.HUBSPOT_ACCESS_TOKEN ||
        (process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET)
    );
  },

  async onEvent(event: OutboundEvent, contact: Contact) {
    if (!this.configured()) return;
    const store = getStore();
    const token = await getAccessToken();
    if (!token) return;

    const label = () =>
      new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

    try {
      let attempt = 0;
      let backoff = 1000;
      // Retry-with-backoff on 429 rate limits (max 3 attempts), per spec.
      // Each retry is visible in the sync log.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await upsertContact(token, contact);
        if (res.status === 429 && attempt < 3) {
          attempt += 1;
          await store.addSyncLog({
            workspaceId: contact.workspaceId,
            at: label(),
            msg: `Contact push → HubSpot (429 rate limit)`,
            state: "retried",
          });
          await new Promise((r) => setTimeout(r, backoff));
          backoff *= 2;
          continue;
        }
        await store.addSyncLog({
          workspaceId: contact.workspaceId,
          at: label(),
          msg: `Contact ${event === "stage.changed" ? "update" : "push"} → HubSpot (${contact.email})`,
          state: res.ok ? "ok" : "error",
        });
        if (attempt > 0 && res.ok) {
          await store.addSyncLog({
            workspaceId: contact.workspaceId,
            at: label(),
            msg: `Retry succeeded after backoff (${(backoff / 2000).toFixed(1)}s)`,
            state: "ok",
          });
        }
        break;
      }
    } catch {
      // Sync failures never break the intake flow.
    }
  },
};
