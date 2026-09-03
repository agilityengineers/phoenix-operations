import type { DataStore } from "./index";
import type { Activity, CmsPage, Contact, Funnel, IntakeSession, Member, Pipeline, Sequence, Subscription, SyncLogEntry, WebhookEndpoint, Workspace } from "../types";

export const publicWorkspaceSlug = () => {
  if (typeof window === "undefined") return "phoenix";
  const explicit = new URLSearchParams(window.location.search).get("workspace");
  const valid = (value: string | null): value is string =>
    Boolean(value && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value));
  if (valid(explicit)) {
    sessionStorage.setItem("po-public-workspace", explicit);
    return explicit;
  }
  const host = window.location.hostname.toLowerCase();
  const remembered = sessionStorage.getItem("po-public-workspace");
  const platformHost =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".replit.dev") ||
    host.endsWith(".replit.app") ||
    host.endsWith(".repl.co") ||
    host.endsWith(".replitusercontent.com");
  if (platformHost) return valid(remembered) ? remembered : "phoenix";
  const label = host.split(".")[0];
  return host.split(".").length > 2 && valid(label) ? label : valid(remembered) ? remembered : "phoenix";
};
const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (path.startsWith("/public/") || path.startsWith("/intake/")) {
    const join = path.includes("?") ? "&" : "?";
    path = `${path}${join}workspace=${encodeURIComponent(publicWorkspaceSlug())}`;
  }
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({ error: response.statusText }))).error);
  return response.json() as Promise<T>;
};
const json = (method: string, value?: unknown): RequestInit => ({ method, body: value === undefined ? undefined : JSON.stringify(value) });

export class ApiStore implements DataStore {
  async getWorkspace() { return (await request<{ workspace: Workspace }>("/workspace")).workspace; }
  async updateWorkspace(patch: Partial<Workspace>) { return (await request<{ workspace: Workspace }>("/workspace", json("PATCH", patch))).workspace; }
  async listPartnerWorkspaces() { return (await request<{ workspaces: Workspace[] }>("/partners")).workspaces; }
  async listMembers() { return (await request<{ members: Member[] }>("/members")).members; }
  async inviteMember(email: string, role: Member["role"]) { return (await request<{ member: Member }>("/members/invite", json("POST", { email, role }))).member; }
  async listFunnels() { return (await request<{ funnels: Funnel[] }>("/funnels")).funnels; }
  async getFunnelBySlug(slug: string) { try { return (await request<{ funnel: Funnel }>(`/public/funnels/${encodeURIComponent(slug)}`)).funnel; } catch { return null; } }
  async getFunnelById(id: string) { try { return (await request<{ funnel: Funnel }>(`/funnels/${encodeURIComponent(id)}`)).funnel; } catch { return null; } }
  async createFunnel(f: Omit<Funnel, "id">) { return (await request<{ funnel: Funnel }>("/funnels/new", json("POST", f))).funnel; }
  async updateFunnel(id: string, patch: Partial<Funnel>) { try { return (await request<{ funnel: Funnel }>(`/funnels/${encodeURIComponent(id)}`, json("PATCH", patch))).funnel; } catch { return null; } }
  async getIntakeSession(token: string) { try { return (await request<{ session: IntakeSession }>(`/intake/session?token=${encodeURIComponent(token)}`)).session; } catch { return null; } }
  async upsertIntakeSession(s: Omit<IntakeSession, "createdAt" | "updatedAt">) {
    await request("/intake/session", json("POST", s));
    return { ...s, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  }
  async listPipelines() { return (await request<{ pipelines: Pipeline[] }>("/pipelines")).pipelines; }
  async listContacts() { return (await request<{ contacts: Contact[] }>("/contacts")).contacts; }
  async getContact(id: string) { try { return (await request<{ contact: Contact }>(`/contacts/${encodeURIComponent(id)}`)).contact; } catch { return null; } }
  async createContact(c: Omit<Contact, "id" | "createdAt">) { return (await request<{ contact: Contact }>("/contacts", json("POST", c))).contact; }
  async updateContact(id: string, patch: Partial<Contact>) { try { return (await request<{ contact: Contact }>(`/contacts/${encodeURIComponent(id)}`, json("PATCH", patch))).contact; } catch { return null; } }
  async listActivities(contactId: string) { return (await request<{ activities: Activity[] }>(`/contacts/${encodeURIComponent(contactId)}/activities`)).activities; }
  async addActivity(a: Omit<Activity, "id" | "at">) { return (await request<{ activity: Activity }>(`/contacts/${encodeURIComponent(a.contactId)}/activity`, json("POST", a))).activity; }
  async listCmsPages() { return (await request<{ pages: CmsPage[] }>("/cms")).pages; }
  async setCmsSection(pageId: string, sectionId: string, enabled: boolean) { await request("/cms/toggle", json("POST", { pageId, sectionId, enabled })); }
  async listSequences() { return (await request<{ sequences: Sequence[] }>("/sequences")).sequences; }
  async listWebhooks() { return (await request<{ webhooks: WebhookEndpoint[] }>("/webhooks")).webhooks; }
  async listSyncLog() { return (await request<{ entries: SyncLogEntry[] }>("/sync-log")).entries; }
  async addSyncLog(entry: Omit<SyncLogEntry, "id">) { await request("/sync-log", json("POST", entry)); }
  async listSubscriptions() { return (await request<{ subscriptions: Subscription[] }>("/subscriptions")).subscriptions; }
}

export class PublicApiStore extends ApiStore {
  override async getWorkspace() {
    return (await request<{ workspace: Workspace }>("/public/workspace")).workspace;
  }

  override async listCmsPages() {
    return (await request<{ pages: CmsPage[] }>("/public/cms")).pages;
  }
}

export const apiRequest = request;