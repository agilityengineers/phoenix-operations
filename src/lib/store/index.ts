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
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";

// Data access boundary. Two backends:
//  - SupabaseStore: production (Postgres + RLS), active when SUPABASE env is set
//  - MemoryStore:   demo mode — seeded, in-process, lets the app run with zero setup
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
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

// Memory store survives across dev-server HMR reloads via globalThis.
const globalForStore = globalThis as unknown as { __poStore?: DataStore };

export function getStore(): DataStore {
  if (supabaseConfigured()) {
    if (!globalForStore.__poStore || !(globalForStore.__poStore instanceof SupabaseStore)) {
      globalForStore.__poStore = new SupabaseStore();
    }
    return globalForStore.__poStore;
  }
  if (!globalForStore.__poStore) globalForStore.__poStore = new MemoryStore();
  return globalForStore.__poStore;
}
