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
import {
  seedActivitiesFor,
  seedCmsPages,
  seedContacts,
  seedFunnels,
  seedMembers,
  seedPartnerWorkspaces,
  seedPipelines,
  seedSequences,
  seedSubscriptions,
  seedSyncLog,
  seedWebhooks,
  seedWorkspace,
} from "../seed";
import type { DataStore } from "./index";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export class MemoryStore implements DataStore {
  private workspace: Workspace = clone(seedWorkspace);
  private partners: Workspace[] = clone(seedPartnerWorkspaces);
  private members: Member[] = clone(seedMembers);
  private funnels: Funnel[] = clone(seedFunnels);
  private sessions = new Map<string, IntakeSession>();
  private pipelines: Pipeline[] = clone(seedPipelines);
  private contacts: Contact[] = clone(seedContacts);
  private activities: Activity[] = seedContacts.flatMap((c) => seedActivitiesFor(c));
  private cmsPages: CmsPage[] = clone(seedCmsPages);
  private sequences: Sequence[] = clone(seedSequences);
  private webhooks: WebhookEndpoint[] = clone(seedWebhooks);
  private syncLog: SyncLogEntry[] = clone(seedSyncLog);
  private subscriptions: Subscription[] = clone(seedSubscriptions);
  private idCounter = 100;

  private nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}_${this.idCounter}`;
  }

  async getWorkspace(): Promise<Workspace> {
    return clone(this.workspace);
  }

  async updateWorkspace(patch: Partial<Workspace>): Promise<Workspace> {
    this.workspace = {
      ...this.workspace,
      ...patch,
      brand: { ...this.workspace.brand, ...(patch.brand ?? {}) },
      guide: { ...this.workspace.guide, ...(patch.guide ?? {}) },
    };
    return clone(this.workspace);
  }

  async listPartnerWorkspaces(): Promise<Workspace[]> {
    return clone(this.partners);
  }

  async listMembers(): Promise<Member[]> {
    return clone(this.members);
  }

  async inviteMember(email: string, role: Member["role"]): Promise<Member> {
    const member: Member = {
      id: this.nextId("m"),
      workspaceId: this.workspace.id,
      name: email.split("@")[0],
      email,
      role,
      state: "invited",
    };
    this.members.push(member);
    return clone(member);
  }

  async listFunnels(): Promise<Funnel[]> {
    return clone(this.funnels);
  }

  async getFunnelBySlug(slug: string): Promise<Funnel | null> {
    return clone(this.funnels.find((f) => f.slug === slug) ?? null);
  }

  async getFunnelById(id: string): Promise<Funnel | null> {
    return clone(this.funnels.find((f) => f.id === id) ?? null);
  }

  async createFunnel(f: Omit<Funnel, "id">): Promise<Funnel> {
    const funnel: Funnel = { ...clone(f), id: this.nextId("fn") } as Funnel;
    this.funnels.push(funnel);
    return clone(funnel);
  }

  async updateFunnel(id: string, patch: Partial<Funnel>): Promise<Funnel | null> {
    const f = this.funnels.find((x) => x.id === id);
    if (!f) return null;
    Object.assign(f, patch);
    return clone(f);
  }

  async getIntakeSession(token: string): Promise<IntakeSession | null> {
    return clone(this.sessions.get(token) ?? null);
  }

  async upsertIntakeSession(
    s: Omit<IntakeSession, "createdAt" | "updatedAt">
  ): Promise<IntakeSession> {
    const existing = this.sessions.get(s.resumeToken);
    const now = new Date().toISOString();
    const session: IntakeSession = {
      ...s,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.sessions.set(s.resumeToken, session);
    return clone(session);
  }

  async listPipelines(): Promise<Pipeline[]> {
    return clone(this.pipelines);
  }

  async listContacts(): Promise<Contact[]> {
    return clone(this.contacts);
  }

  async getContact(id: string): Promise<Contact | null> {
    return clone(this.contacts.find((c) => c.id === id) ?? null);
  }

  async createContact(c: Omit<Contact, "id" | "createdAt">): Promise<Contact> {
    const contact: Contact = { ...c, id: this.nextId("ld"), createdAt: new Date().toISOString() };
    this.contacts.unshift(contact);
    return clone(contact);
  }

  async updateContact(id: string, patch: Partial<Contact>): Promise<Contact | null> {
    const c = this.contacts.find((x) => x.id === id);
    if (!c) return null;
    Object.assign(c, patch);
    return clone(c);
  }

  async listActivities(contactId: string): Promise<Activity[]> {
    return clone(
      this.activities
        .filter((a) => a.contactId === contactId)
        .sort((a, b) => (a.at < b.at ? 1 : -1))
    );
  }

  async addActivity(a: Omit<Activity, "id" | "at">): Promise<Activity> {
    const activity: Activity = { ...a, id: this.nextId("act"), at: new Date().toISOString() };
    this.activities.unshift(activity);
    return clone(activity);
  }

  async listCmsPages(): Promise<CmsPage[]> {
    return clone(this.cmsPages);
  }

  async setCmsSection(pageId: string, sectionId: string, enabled: boolean): Promise<void> {
    const page = this.cmsPages.find((p) => p.id === pageId);
    const section = page?.sections.find((s) => s.id === sectionId);
    if (section) section.enabled = enabled;
  }

  async listSequences(): Promise<Sequence[]> {
    return clone(this.sequences);
  }

  async listWebhooks(): Promise<WebhookEndpoint[]> {
    return clone(this.webhooks);
  }

  async listSyncLog(): Promise<SyncLogEntry[]> {
    return clone(this.syncLog);
  }

  async addSyncLog(entry: Omit<SyncLogEntry, "id">): Promise<void> {
    this.syncLog.unshift({ ...entry, id: this.nextId("sl") });
  }

  async listSubscriptions(): Promise<Subscription[]> {
    return clone(this.subscriptions);
  }
}
