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
import { WORKSPACE_ID } from "../seed";
import { getServiceClient } from "../supabase/server";
import type { DataStore } from "./index";

// Production store — Postgres via Supabase (schema: supabase/migrations/0001_init.sql,
// data: supabase/seed.sql). Single-workspace scoping for now: WORKSPACE_ID is the
// Phoenix Operations root workspace; partner workspaces read the same tables under
// their own workspace_id (RLS enforces isolation for authenticated app users).

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const wsFromRow = (r: Row): Workspace => ({
  id: r.id,
  name: r.name,
  domain: r.domain,
  type: r.type,
  status: r.status,
  plan: r.plan,
  brand: r.brand,
  guide: r.guide,
  createdAt: r.created_at,
});

const funnelFromRow = (r: Row): Funnel => ({
  id: r.id,
  workspaceId: r.workspace_id,
  name: r.name,
  slug: r.slug,
  segment: r.segment,
  offer: r.offer,
  status: r.status,
  kicker: r.kicker,
  problemCopy: r.problem_copy,
  stakes: r.stakes,
  storybrand: r.storybrand,
  variants: r.variants,
  blocks: r.blocks,
  weights: r.weights,
  stats: r.stats,
});

const contactFromRow = (r: Row): Contact => ({
  id: r.id,
  workspaceId: r.workspace_id,
  pipelineId: r.pipeline_id,
  name: r.name,
  company: r.company,
  role: r.role,
  email: r.email,
  phone: r.phone ?? undefined,
  funnel: r.funnel,
  source: r.source,
  score: r.score,
  stage: r.stage,
  position: r.position,
  owner: r.owner,
  createdAt: r.created_at,
  answers: r.answers ?? undefined,
  utm: r.utm ?? undefined,
  bookedSlot: r.booked_slot ?? undefined,
});

export class SupabaseStore implements DataStore {
  private db = getServiceClient();

  async getWorkspace(id: string = WORKSPACE_ID): Promise<Workspace> {
    const { data, error } = await this.db.from("workspaces").select("*").eq("id", id).single();
    if (error) throw error;
    return wsFromRow(data);
  }

  async updateWorkspace(patch: Partial<Workspace>): Promise<Workspace> {
    const current = await this.getWorkspace();
    const row: Row = {};
    if (patch.name) row.name = patch.name;
    if (patch.domain) row.domain = patch.domain;
    if (patch.brand) row.brand = { ...current.brand, ...patch.brand };
    if (patch.guide) row.guide = { ...current.guide, ...patch.guide };
    const { data, error } = await this.db
      .from("workspaces")
      .update(row)
      .eq("id", WORKSPACE_ID)
      .select()
      .single();
    if (error) throw error;
    return wsFromRow(data);
  }

  async listPartnerWorkspaces(): Promise<Workspace[]> {
    const { data, error } = await this.db.from("workspaces").select("*").order("created_at");
    if (error) throw error;
    return data.map(wsFromRow);
  }

  async listMembers(): Promise<Member[]> {
    const { data, error } = await this.db
      .from("members")
      .select("*")
      .eq("workspace_id", WORKSPACE_ID)
      .order("created_at");
    if (error) throw error;
    return data.map((r: Row) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      email: r.email,
      role: r.role,
      state: r.state,
    }));
  }

  async inviteMember(email: string, role: Member["role"]): Promise<Member> {
    const { data, error } = await this.db
      .from("members")
      .insert({
        workspace_id: WORKSPACE_ID,
        name: email.split("@")[0],
        email,
        role,
        state: "invited",
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      name: data.name,
      email: data.email,
      role: data.role,
      state: data.state,
    };
  }

  async listFunnels(): Promise<Funnel[]> {
    const { data, error } = await this.db
      .from("funnels")
      .select("*")
      .eq("workspace_id", WORKSPACE_ID)
      .order("created_at");
    if (error) throw error;
    return data.map(funnelFromRow);
  }

  async getFunnelBySlug(slug: string): Promise<Funnel | null> {
    const { data } = await this.db
      .from("funnels")
      .select("*")
      .eq("workspace_id", WORKSPACE_ID)
      .eq("slug", slug)
      .maybeSingle();
    return data ? funnelFromRow(data) : null;
  }

  async getFunnelById(id: string): Promise<Funnel | null> {
    const { data } = await this.db.from("funnels").select("*").eq("id", id).maybeSingle();
    return data ? funnelFromRow(data) : null;
  }

  async createFunnel(f: Omit<Funnel, "id">): Promise<Funnel> {
    const { data, error } = await this.db
      .from("funnels")
      .insert({
        workspace_id: f.workspaceId,
        name: f.name,
        slug: f.slug,
        segment: f.segment,
        offer: f.offer,
        status: f.status,
        kicker: f.kicker,
        problem_copy: f.problemCopy,
        stakes: f.stakes,
        storybrand: f.storybrand,
        variants: f.variants,
        blocks: f.blocks,
        weights: f.weights,
        stats: f.stats,
      })
      .select()
      .single();
    if (error) throw error;
    return funnelFromRow(data);
  }

  async updateFunnel(id: string, patch: Partial<Funnel>): Promise<Funnel | null> {
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.slug !== undefined) row.slug = patch.slug;
    if (patch.segment !== undefined) row.segment = patch.segment;
    if (patch.offer !== undefined) row.offer = patch.offer;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.storybrand !== undefined) row.storybrand = patch.storybrand;
    if (patch.variants !== undefined) row.variants = patch.variants;
    if (patch.blocks !== undefined) row.blocks = patch.blocks;
    if (patch.weights !== undefined) row.weights = patch.weights;
    const { data, error } = await this.db
      .from("funnels")
      .update(row)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? funnelFromRow(data) : null;
  }

  async getIntakeSession(token: string): Promise<IntakeSession | null> {
    const { data } = await this.db
      .from("intake_sessions")
      .select("*")
      .eq("resume_token", token)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      funnelSlug: data.funnel_slug,
      variant: data.variant,
      resumeToken: data.resume_token,
      step: data.step,
      answers: data.answers,
      utm: data.utm,
      submitted: data.submitted,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async upsertIntakeSession(
    s: Omit<IntakeSession, "createdAt" | "updatedAt">
  ): Promise<IntakeSession> {
    const { data, error } = await this.db
      .from("intake_sessions")
      .upsert(
        {
          workspace_id: s.workspaceId,
          funnel_slug: s.funnelSlug,
          variant: s.variant,
          resume_token: s.resumeToken,
          step: s.step,
          answers: s.answers,
          utm: s.utm,
          submitted: s.submitted,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "resume_token" }
      )
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      funnelSlug: data.funnel_slug,
      variant: data.variant,
      resumeToken: data.resume_token,
      step: data.step,
      answers: data.answers,
      utm: data.utm,
      submitted: data.submitted,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listPipelines(): Promise<Pipeline[]> {
    const { data, error } = await this.db
      .from("pipelines")
      .select("*")
      .eq("workspace_id", WORKSPACE_ID)
      .order("created_at");
    if (error) throw error;
    return data.map((r: Row) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      desc: r.description,
      stages: r.stages,
    }));
  }

  async listContacts(): Promise<Contact[]> {
    const { data, error } = await this.db
      .from("contacts")
      .select("*")
      .eq("workspace_id", WORKSPACE_ID)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(contactFromRow);
  }

  async getContact(id: string): Promise<Contact | null> {
    const { data } = await this.db.from("contacts").select("*").eq("id", id).maybeSingle();
    return data ? contactFromRow(data) : null;
  }

  async createContact(c: Omit<Contact, "id" | "createdAt">): Promise<Contact> {
    const { data, error } = await this.db
      .from("contacts")
      .insert({
        workspace_id: c.workspaceId,
        pipeline_id: c.pipelineId,
        name: c.name,
        company: c.company,
        role: c.role,
        email: c.email,
        phone: c.phone ?? null,
        funnel: c.funnel,
        source: c.source,
        score: c.score,
        stage: c.stage,
        position: c.position,
        owner: c.owner,
        answers: c.answers ?? null,
        utm: c.utm ?? null,
        booked_slot: c.bookedSlot ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return contactFromRow(data);
  }

  async updateContact(id: string, patch: Partial<Contact>): Promise<Contact | null> {
    const row: Row = {};
    if (patch.stage !== undefined) row.stage = patch.stage;
    if (patch.position !== undefined) row.position = patch.position;
    if (patch.pipelineId !== undefined) row.pipeline_id = patch.pipelineId;
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.company !== undefined) row.company = patch.company;
    if (patch.owner !== undefined) row.owner = patch.owner;
    if (patch.score !== undefined) row.score = patch.score;
    if (patch.bookedSlot !== undefined) row.booked_slot = patch.bookedSlot;
    const { data, error } = await this.db
      .from("contacts")
      .update(row)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw error;
    return data ? contactFromRow(data) : null;
  }

  async listActivities(contactId: string): Promise<Activity[]> {
    const { data, error } = await this.db
      .from("activities")
      .select("*")
      .eq("contact_id", contactId)
      .order("at", { ascending: false });
    if (error) throw error;
    return data.map((r: Row) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      contactId: r.contact_id,
      type: r.type,
      title: r.title,
      body: r.body,
      at: r.at,
    }));
  }

  async addActivity(a: Omit<Activity, "id" | "at">): Promise<Activity> {
    const { data, error } = await this.db
      .from("activities")
      .insert({
        workspace_id: a.workspaceId,
        contact_id: a.contactId,
        type: a.type,
        title: a.title,
        body: a.body,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      contactId: data.contact_id,
      type: data.type,
      title: data.title,
      body: data.body,
      at: data.at,
    };
  }

  async listCmsPages(): Promise<CmsPage[]> {
    const { data, error } = await this.db
      .from("cms_pages")
      .select("*")
      .eq("workspace_id", WORKSPACE_ID)
      .order("sort");
    if (error) throw error;
    return data.map((r: Row) => ({
      id: r.id,
      name: r.name,
      meta: r.meta,
      sections: r.sections,
    }));
  }

  async setCmsSection(pageId: string, sectionId: string, enabled: boolean): Promise<void> {
    const { data } = await this.db
      .from("cms_pages")
      .select("sections")
      .eq("workspace_id", WORKSPACE_ID)
      .eq("id", pageId)
      .single();
    if (!data) return;
    const sections = (data.sections as CmsPage["sections"]).map((s) =>
      s.id === sectionId ? { ...s, enabled } : s
    );
    await this.db
      .from("cms_pages")
      .update({ sections })
      .eq("workspace_id", WORKSPACE_ID)
      .eq("id", pageId);
  }

  async listSequences(): Promise<Sequence[]> {
    const { data, error } = await this.db
      .from("sequences")
      .select("*")
      .eq("workspace_id", WORKSPACE_ID)
      .order("created_at");
    if (error) throw error;
    return data.map((r: Row) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      trigger: r.trigger,
      active: r.active,
      stat: r.stat,
      statLabel: r.stat_label,
      steps: r.steps,
    }));
  }

  async listWebhooks(): Promise<WebhookEndpoint[]> {
    const { data, error } = await this.db
      .from("webhook_endpoints")
      .select("*")
      .eq("workspace_id", WORKSPACE_ID);
    if (error) throw error;
    return data.map((r: Row) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      event: r.event,
      desc: r.description,
      url: r.url ?? undefined,
      active: r.active,
    }));
  }

  async listSyncLog(): Promise<SyncLogEntry[]> {
    const { data, error } = await this.db
      .from("sync_log")
      .select("*")
      .eq("workspace_id", WORKSPACE_ID)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data.map((r: Row) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      at: r.at_label,
      msg: r.msg,
      state: r.state,
    }));
  }

  async addSyncLog(entry: Omit<SyncLogEntry, "id">): Promise<void> {
    await this.db.from("sync_log").insert({
      workspace_id: entry.workspaceId,
      at_label: entry.at,
      msg: entry.msg,
      state: entry.state,
    });
  }

  async listSubscriptions(): Promise<Subscription[]> {
    const { data, error } = await this.db.from("subscriptions").select("*").order("created_at");
    if (error) throw error;
    return data.map((r: Row) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      workspaceName: r.workspace_name,
      domain: r.domain,
      plan: r.plan,
      since: r.since,
      amountMonthly: r.amount_monthly,
      state: r.state,
      trialDaysLeft: r.trial_days_left ?? undefined,
    }));
  }
}
