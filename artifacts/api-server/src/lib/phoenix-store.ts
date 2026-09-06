import { db, phoenixWorkspaces } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export const WORKSPACE_ID = "ws_phoenix";

export type Answers = Record<string, string | string[] | undefined>;
export type Contact = {
  id: string; workspaceId: string; pipelineId: string; name: string; company: string;
  role: string; email: string; phone?: string; funnel: string; source: string;
  score: number; stage: number; position: number; owner: string; createdAt: string;
  answers?: Answers; utm?: Record<string, string | undefined>;
  /** Human-readable booked time, e.g. "Mon Sep 14 · 9:15 AM". Kept for display. */
  bookedSlot?: string;
  /** RFC 3339 UTC instant of the booking — the machine-readable truth. */
  bookedAt?: string;
  /** IANA zone the invitee booked in, so we render their time, not ours. */
  bookedTimezone?: string;
  calendlyEventUri?: string;
  calendlyInviteeUri?: string;
  /** Set when a booking is cancelled in Calendly, so the CRM stops claiming a call. */
  bookingCanceledAt?: string;
};
export type Activity = { id: string; workspaceId: string; contactId: string; type: string; title: string; body: string; at: string };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const now = () => new Date().toISOString();
const workspace = {
  id: WORKSPACE_ID, name: "Phoenix Operations", domain: "phoenixoperations.com", type: "eos_implementer",
  status: "live", plan: "network", createdAt: "2026-01-05T00:00:00Z",
  brand: { logoUrl: "/assets/logo.png", markUrl: "/assets/mark.png", primaryColor: "#D76C2C", inkColor: "#14263B", paperColor: "#F7F4EE", customDomain: "phoenixoperations.com" },
  guide: { photoUrl: "/assets/headshot.jpg", name: "Joshua Kornitsky", title: "Founder, Phoenix Operations", story: "I've built companies, led teams, worked inside large organizations, and spent decades working with hundreds of small businesses.", showGuideBand: true },
  // Non-secret scheduling config only. Credentials live in env vars — this whole
  // record is returned by GET /workspace and GET /public/workspace.
  scheduling: { provider: "calendly", eventTypeUri: "", eventTypeName: "", schedulingUrl: "", durationMinutes: 15, enabled: false },
};
const defaultBlocks = () => [
  { id: "frustration", name: "Frustration deep-dive", desc: "3 questions · Conversation Guide: Lack of Control", required: true, enabled: true, order: 0 },
  { id: "firmographics", name: "Business profile", desc: "Industry, revenue, team size, clients, years", required: true, enabled: true, order: 1 },
  { id: "contact", name: "Contact info", desc: "Name, email, company, phone, role", required: true, enabled: true, order: 2 },
  { id: "ownerJoin", name: "Owner attendance", desc: "Shown only when respondent is not the owner/CEO", required: false, enabled: true, order: 3 },
  { id: "coachability", name: "Coachability self-assessment", desc: '2 Likert questions + "what have you tried"', required: true, enabled: true, order: 4 },
];
const funnel = (id: string, name: string, slug: string, status: string, visits: number, leads: number) => ({
  id, workspaceId: WORKSPACE_ID, name, slug, segment: `${name} — founders`, offer: "Free 15-minute conversation — no pitch", status,
  kicker: `For founders who feel it: ${name}`, problemCopy: "", stakes: [], storybrand: { hero: "", problem: "", guide: 'Joshua — "I’ve sat in your seat."', plan: "A free 15-minute conversation. No prep, no pressure, no pitch.", success: "" },
  variants: [{ id: "A", label: "A", headline: "", trafficPct: 100 }], blocks: defaultBlocks(),
  weights: { icpFit: 40, coachability: 25, authority: 20, urgency: 15 }, stats: { visits, leads, cvr: visits ? `${((leads / visits) * 100).toFixed(1)}%` : "—" },
});

export class PhoenixStore {
  private counter = 100;
  private workspace = clone(workspace);
  private members = [
    { id: "m1", workspaceId: WORKSPACE_ID, name: "Joshua Kornitsky", email: "joshua@phoenixoperations.com", role: "admin", state: "active" },
    { id: "m2", workspaceId: WORKSPACE_ID, name: "Dana Whitfield", email: "dana@phoenixoperations.com", role: "staff", state: "active" },
    { id: "m3", workspaceId: WORKSPACE_ID, name: "Chris Crew", email: "chris@bluecollarsuccess.com", role: "partner", state: "active" },
    { id: "m4", workspaceId: WORKSPACE_ID, name: "Renee Alcott", email: "renee@alcottops.com", role: "partner", state: "invited" },
  ];
  private funnels = [funnel("control", "Lack of Control", "lack-of-control", "live", 1284, 86), funnel("profit", "Lack of Profit", "lack-of-profit", "live", 702, 38), funnel("people", "People", "people", "draft", 0, 0), funnel("ceiling", "Hitting the Ceiling", "hitting-the-ceiling", "live", 449, 21), funnel("nothing", "Nothing Works", "nothing-works", "paused", 188, 6)];
  private sessions = new Map<string, Record<string, unknown>>();
  private pipelines = [{ id: "prospects", workspaceId: WORKSPACE_ID, name: "Prospects", desc: "Potential clients moving from intake to engagement", stages: ["New", "Qualified", "Call scheduled", "In conversation"] }, { id: "clients", workspaceId: WORKSPACE_ID, name: "Client journey", desc: "Active clients", stages: ["Onboarding", "Foundation", "Traction", "Graduated"] }];
  private contacts: Contact[] = [
    ["1","Marcus Webb","Webb Mechanical","Owner / Founder","marcus@webbmech.com","Lack of Control","google / cpc",88,1,"Joshua"], ["2","Sarah Delgado","Delgado Electric","CEO / President","sarah@delgadoelectric.com","Lack of Control","linkedin / organic",76,2,"Joshua"], ["3","Tom Brantley","Brantley HVAC","Owner / Founder","tom@brantleyhvac.com","Lack of Profit","referral",91,2,"Joshua"], ["4","Priya Nair","Nair Consulting","COO / Operations","priya@nairconsulting.com","People","newsletter",54,0,"—"], ["5","Dale Hutchins","Hutchins Plumbing Co.","Owner / Founder","dale@hutchinsplumbing.com","Lack of Control","google / cpc",83,3,"Joshua"], ["6","Renee Alcott","Alcott Landscapes","Owner / Founder","renee@alcottlandscapes.com","Hitting the Ceiling","facebook / paid",67,1,"Joshua"], ["7","Gene Park","Park Manufacturing","Other leadership","gene@parkmfg.com","Nothing Works","referral",41,0,"—"], ["8","Chris Crew","The Blue Collar Success Group","President","chris@bluecollarsuccess.com","Referral","referral",91,2,"Joshua","clients"], ["9","Danielle Putnam","The New Flat Rate","CEO / President","danielle@newflatrate.com","Referral","referral",88,2,"Joshua","clients"], ["10","Lincoln Higdon","Centerpoint IT","CEO / President","lincoln@centerpointit.com","Lack of Control","google / cpc",84,1,"Joshua","clients"], ["11","Teresa Vance","Vance Roofing","Owner / Founder","teresa@vanceroofing.com","Hitting the Ceiling","referral",79,0,"Joshua","clients"]].map(([id,name,company,role,email,funnelName,source,score,stage,owner,pipelineId]) => ({ id: String(id), workspaceId: WORKSPACE_ID, pipelineId: String(pipelineId ?? "prospects"), name: String(name), company: String(company), role: String(role), email: String(email), funnel: String(funnelName), source: String(source), score: Number(score), stage: Number(stage), position: 0, owner: String(owner), createdAt: "2026-09-01T13:14:02Z" }));
  private activities: Activity[] = [];
  private cms = [{ id: "home", name: "Homepage", meta: "6 sections · Published", sections: [{ id: "hero", name: "Hero", desc: "Headline, frustration selector, primary CTA", enabled: true }, { id: "howwho", name: "How It Works + Who We Help", desc: "Two-column content", enabled: true }, { id: "guideband", name: "Guide band", desc: "Guide intro", enabled: true }, { id: "results", name: "Client Perspectives", desc: "Testimonials", enabled: true }, { id: "faq", name: "FAQ", desc: "Questions", enabled: true }, { id: "footer", name: "Footer CTA", desc: "Schedule button", enabled: true }] }, { id: "guide", name: "Meet Your Guide", meta: "4 sections · Published", sections: [{ id: "ghero", name: "Guide hero", desc: "Photo and story", enabled: true }] }, { id: "results", name: "Results (private)", meta: "5 sections · Link-only", sections: [{ id: "rhero", name: "Results hero", desc: "EOS framing", enabled: true }] }, { id: "funnelTpl", name: "Funnel template", meta: "StoryBrand · 5 blocks", sections: [{ id: "fhero", name: "StoryBrand hero", desc: "Per-funnel copy", enabled: true }, { id: "fintake", name: "Intake form", desc: "Modular blocks", enabled: true }] }];
  private partners = [{ ...workspace, id: "ws_bluecollar", name: "Blue Collar Success", domain: "bluecollarsuccess.com" }];
  private sequences = [{ id: "seq_1", workspaceId: WORKSPACE_ID, name: "New lead follow-up", trigger: "Lead created", active: true, stat: "86%", statLabel: "open rate", steps: [{ kind: "Email", label: "Welcome" }] }];
  private webhooks = [{ id: "wh_1", workspaceId: WORKSPACE_ID, event: "lead.created", desc: "New lead notification", active: true }];
  private syncLog = [{ id: "sync_1", workspaceId: WORKSPACE_ID, at: "2026-09-01T13:14:02Z", msg: "HubSpot sync complete", state: "ok" }];
  private subscriptions = [{ id: "sub_1", workspaceId: WORKSPACE_ID, workspaceName: "Phoenix Operations", domain: "phoenixoperations.com", plan: "network", since: "2026-01-05", amountMonthly: 499, state: "active" }];
  private next(prefix: string) { this.counter++; return `${prefix}_${this.counter}`; }
  constructor(state?: Record<string, unknown>) {
    if (state) {
      Object.assign(this, clone(state));
      this.sessions = new Map(Object.entries((state.sessions ?? {}) as Record<string, Record<string, unknown>>));
      // Tenants provisioned before scheduling existed have no `scheduling` key.
      this.workspace = { ...this.workspace, scheduling: { ...workspace.scheduling, ...(this.workspace?.scheduling ?? {}) } };
    }
  }
  snapshot() {
    return clone({
      counter: this.counter, workspace: this.workspace, members: this.members, funnels: this.funnels,
      sessions: Object.fromEntries(this.sessions), pipelines: this.pipelines, contacts: this.contacts,
      activities: this.activities, cms: this.cms, partners: this.partners, sequences: this.sequences,
      webhooks: this.webhooks, syncLog: this.syncLog, subscriptions: this.subscriptions,
    });
  }
  getWorkspace() { return clone(this.workspace); } updateWorkspace(patch: Record<string, unknown>) { this.workspace = { ...this.workspace, ...patch, brand: { ...this.workspace.brand, ...((patch.brand as object) ?? {}) }, guide: { ...this.workspace.guide, ...((patch.guide as object) ?? {}) }, scheduling: { ...this.workspace.scheduling, ...((patch.scheduling as object) ?? {}) } }; return this.getWorkspace(); }
  listFunnels() { return clone(this.funnels); } funnelBySlug(slug: string) { return clone(this.funnels.find(f => f.slug === slug) ?? null); } funnelById(id: string) { return clone(this.funnels.find(f => f.id === id) ?? null); }
  createFunnel(value: Record<string, unknown>) { const f = { ...value, id: this.next("fn") }; this.funnels.push(f as typeof this.funnels[number]); return clone(f); } updateFunnel(id: string, patch: Record<string, unknown>) { const f = this.funnels.find(x => x.id === id); if (!f) return null; Object.assign(f, patch); return clone(f); }
  session(token: string) { return clone(this.sessions.get(token) ?? null); } saveSession(value: Record<string, unknown>) { const token = String(value.resumeToken); const old = this.sessions.get(token); const saved = { ...value, submitted: Boolean(value.submitted || old?.submitted), bookingTokenHash: value.bookingTokenHash ?? old?.bookingTokenHash, bookingContactId: value.bookingContactId ?? old?.bookingContactId, bookingExpiresAt: value.bookingExpiresAt ?? old?.bookingExpiresAt, bookingConsumedAt: value.bookingConsumedAt ?? old?.bookingConsumedAt, createdAt: old?.createdAt ?? now(), updatedAt: now() }; this.sessions.set(token, saved); return clone(saved); }
  listPipelines() { return clone(this.pipelines); } listContacts() { return clone(this.contacts); } contact(id: string) { return clone(this.contacts.find(c => c.id === id) ?? null); }
  createContact(value: Omit<Contact, "id" | "createdAt">) { const c = { ...value, id: this.next("ld"), createdAt: now() }; this.contacts.unshift(c); return clone(c); } updateContact(id: string, patch: Partial<Contact>) { const c = this.contacts.find(x => x.id === id); if (!c) return null; Object.assign(c, patch); return clone(c); }
  contactByCalendlyEvent(eventUri: string) { if (!eventUri) return null; return clone(this.contacts.find(c => c.calendlyEventUri === eventUri) ?? null); }
  contactByCalendlyInvitee(inviteeUri: string) { if (!inviteeUri) return null; return clone(this.contacts.find(c => c.calendlyInviteeUri === inviteeUri) ?? null); }
  contactByEmail(email: string) { const needle = email.trim().toLowerCase(); if (!needle) return null; return clone(this.contacts.find(c => c.email.toLowerCase() === needle) ?? null); }
  /** Index of a stage by name, or -1. Stage order is tenant-editable, so never hardcode the number. */
  stageIndex(pipelineId: string, stageName: string) { return (this.pipelines.find(p => p.id === pipelineId)?.stages ?? []).indexOf(stageName); }
  activitiesFor(contactId: string) { return clone(this.activities.filter(a => a.contactId === contactId).sort((a,b) => b.at.localeCompare(a.at))); } addActivity(value: Omit<Activity, "id" | "at">) { const a = { ...value, id: this.next("act"), at: now() }; this.activities.unshift(a); return clone(a); }
  listMembers() { return clone(this.members); } invite(email: string, role: string) { const member = { id: this.next("m"), workspaceId: WORKSPACE_ID, name: email.split("@")[0], email, role, state: "invited" }; this.members.push(member); return clone(member); }
  toggle(pageId: string, sectionId: string, enabled: boolean) { this.cms.find(p => p.id === pageId)?.sections.find(s => s.id === sectionId) && (this.cms.find(p => p.id === pageId)!.sections.find(s => s.id === sectionId)!.enabled = enabled); }
  listCms() { return clone(this.cms); }
  listPartners() { return clone(this.partners); }
  listSequences() { return clone(this.sequences); }
  listWebhooks() { return clone(this.webhooks); }
  listSyncLog() { return clone(this.syncLog); }
  addSyncLog(value: Omit<typeof this.syncLog[number], "id">) { this.syncLog.unshift({ ...value, id: this.next("sync") }); }
  listSubscriptions() { return clone(this.subscriptions); }
}

/** Loads a tenant's isolated JSONB state and writes every requested mutation durably. */
export const getPhoenixStore = async (workspaceId: string, publicWorkspace = false) => {
  if (publicWorkspace) {
    await db.insert(phoenixWorkspaces).values({
      id: WORKSPACE_ID, state: new PhoenixStore().snapshot(), isPublic: true,
      slug: "phoenix",
    }).onConflictDoNothing();
    workspaceId = WORKSPACE_ID;
  }
  const [row] = await db.select().from(phoenixWorkspaces).where(eq(phoenixWorkspaces.id, workspaceId)).limit(1);
  if (!row) return null;
  return new PhoenixStore(row.state as Record<string, unknown>);
};

/** Serializes JSONB state changes for one tenant, preventing lost updates. */
export const mutatePhoenixStore = async <T>(workspaceId: string, fn: (store: PhoenixStore) => T | Promise<T>, workspacePatch: { customDomain?: string | null; pendingCustomDomain?: string | null; domainVerificationToken?: string | null; customDomainVerifiedAt?: Date | null } = {}): Promise<T> =>
  db.transaction(async (tx) => {
    const rows = await tx.execute(sql`SELECT id, state FROM phoenix_workspaces WHERE id = ${workspaceId} FOR UPDATE`);
    const row = rows.rows[0] as { state: Record<string, unknown> } | undefined;
    if (!row) throw new Error("workspace_not_found");
    const store = new PhoenixStore(row.state);
    const result = await fn(store);
    await tx.update(phoenixWorkspaces).set({ state: store.snapshot(), updatedAt: new Date(), ...workspacePatch }).where(eq(phoenixWorkspaces.id, workspaceId));
    return result;
  });