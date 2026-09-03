import type {
  Activity,
  CmsPage,
  Contact,
  Funnel,
  IntakeSession,
  Member,
  Pipeline,
  Sequence,
  Subscription,
  SyncLogEntry,
  WebhookEndpoint,
  Workspace,
} from "../types";
import { ApiStore, PublicApiStore } from "./api";

// Data access boundary backed by the shared API server.
export interface DataStore {
  getWorkspace(id?: string): Promise<Workspace>;
  updateWorkspace(patch: Partial<Workspace>): Promise<Workspace>;
  listPartnerWorkspaces(): Promise<Workspace[]>;

  listMembers(): Promise<Member[]>;
  inviteMember(email: string, role: Member["role"]): Promise<Member>;

  listFunnels(): Promise<Funnel[]>;
  getFunnelBySlug(slug: string): Promise<Funnel | null>;
  getFunnelById(id: string): Promise<Funnel | null>;
  createFunnel(f: Omit<Funnel, "id">): Promise<Funnel>;
  updateFunnel(id: string, patch: Partial<Funnel>): Promise<Funnel | null>;

  getIntakeSession(token: string): Promise<IntakeSession | null>;
  upsertIntakeSession(s: Omit<IntakeSession, "createdAt" | "updatedAt">): Promise<IntakeSession>;

  listPipelines(): Promise<Pipeline[]>;
  listContacts(): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | null>;
  createContact(c: Omit<Contact, "id" | "createdAt">): Promise<Contact>;
  updateContact(id: string, patch: Partial<Contact>): Promise<Contact | null>;

  listActivities(contactId: string): Promise<Activity[]>;
  addActivity(a: Omit<Activity, "id" | "at">): Promise<Activity>;

  listCmsPages(): Promise<CmsPage[]>;
  setCmsSection(pageId: string, sectionId: string, enabled: boolean): Promise<void>;

  listSequences(): Promise<Sequence[]>;
  listWebhooks(): Promise<WebhookEndpoint[]>;
  listSyncLog(): Promise<SyncLogEntry[]>;
  addSyncLog(entry: Omit<SyncLogEntry, "id">): Promise<void>;
  listSubscriptions(): Promise<Subscription[]>;
}

export function supabaseConfigured(): boolean {
  return true;
}

// The API server is the sole shared data source; browser state is never a store.
const globalForStore = globalThis as unknown as {
  __poStore?: DataStore;
  __poPublicStore?: DataStore;
};

export function getStore(): DataStore {
  if (!globalForStore.__poStore) globalForStore.__poStore = new ApiStore();
  return globalForStore.__poStore;
}

export function getPublicStore(): DataStore {
  if (!globalForStore.__poPublicStore) globalForStore.__poPublicStore = new PublicApiStore();
  return globalForStore.__poPublicStore;
}
