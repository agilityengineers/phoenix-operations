// Domain model — multi-tenant, every record keyed by workspace_id.
// Mirrors supabase/migrations/0001_init.sql.

export type WorkspaceType = "eos_implementer" | "consultant" | "other";
export type Role = "admin" | "owner" | "staff" | "partner";
export type FunnelStatus = "live" | "draft" | "paused";
export type PlanId = "solo" | "practice" | "network";

export interface Brand {
  logoUrl: string;
  markUrl: string;
  primaryColor: string;
  inkColor: string;
  paperColor: string;
  customDomain?: string;
}

export interface GuideProfile {
  photoUrl: string;
  name: string;
  title: string;
  story: string;
  showGuideBand: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  domain: string;
  type: WorkspaceType;
  status: "live" | "onboarding";
  brand: Brand;
  guide: GuideProfile;
  plan: PlanId;
  createdAt: string;
}

export interface Member {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: Role;
  state: "active" | "invited";
}

export interface StoryBrand {
  hero: string;
  problem: string;
  guide: string;
  plan: string;
  success: string;
}

export interface FunnelVariant {
  id: string;
  label: string; // "A", "B"
  headline: string;
  trafficPct: number;
  cvr?: string;
}

export type BlockKind =
  | "frustration"
  | "firmographics"
  | "contact"
  | "ownerJoin"
  | "coachability";

export interface FormBlock {
  id: BlockKind;
  name: string;
  desc: string;
  required: boolean;
  enabled: boolean;
  order: number;
  condition?: string; // human-readable; evaluated in the intake flow
}

export interface ScoringWeights {
  icpFit: number; // 40
  coachability: number; // 25
  authority: number; // 20
  urgency: number; // 15
}

export interface Funnel {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  segment: string;
  offer: string;
  status: FunnelStatus;
  kicker: string; // hero eyebrow, e.g. "For founders who feel it: Lack of Control"
  problemCopy: string;
  stakes: string[]; // "Sound familiar?" bullets
  storybrand: StoryBrand;
  variants: FunnelVariant[];
  blocks: FormBlock[];
  weights: ScoringWeights;
  stats: { visits: number; leads: number; cvr: string };
}

export interface IntakeAnswers {
  leastControl?: string[];
  bounceback?: string;
  stepAway?: string;
  industry?: string;
  revenue?: string;
  employees?: string;
  clients?: string;
  years?: string;
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  role?: string;
  ownerJoin?: string;
  coachHistory?: string;
  urgency?: string;
  coachAdmit?: string;
  coachOpen?: string;
  tried?: string;
}

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
}

export interface IntakeSession {
  id: string;
  workspaceId: string;
  funnelSlug: string;
  variant: string;
  resumeToken: string;
  step: number;
  answers: IntakeAnswers;
  utm: UtmParams;
  submitted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PipelineId = "prospects" | "clients";

export interface Pipeline {
  id: PipelineId | string;
  workspaceId: string;
  name: string;
  desc: string;
  stages: string[];
}

export interface Contact {
  id: string;
  workspaceId: string;
  pipelineId: string;
  name: string;
  company: string;
  role: string;
  email: string;
  phone?: string;
  funnel: string;
  source: string;
  score: number;
  stage: number; // index into pipeline.stages
  position: number;
  owner: string;
  createdAt: string;
  answers?: IntakeAnswers;
  utm?: UtmParams;
  bookedSlot?: string;
}

export type ActivityType =
  | "view"
  | "intake_started"
  | "intake_completed"
  | "note"
  | "task"
  | "email"
  | "call"
  | "stage_change";

export interface Activity {
  id: string;
  workspaceId: string;
  contactId: string;
  type: ActivityType;
  title: string;
  body: string;
  at: string;
}

export interface CmsSection {
  id: string;
  name: string;
  desc: string;
  enabled: boolean;
}

export interface CmsPage {
  id: "home" | "guide" | "results" | "funnelTpl";
  name: string;
  meta: string;
  sections: CmsSection[];
}

export interface SequenceStep {
  kind: "Email" | "Task" | "CRM" | "Zap";
  label: string;
}

export interface Sequence {
  id: string;
  workspaceId: string;
  name: string;
  trigger: string;
  active: boolean;
  stat: string;
  statLabel: string;
  steps: SequenceStep[];
}

export interface WebhookEndpoint {
  id: string;
  workspaceId: string;
  event: "lead.created" | "intake.completed" | "lead.qualified" | "stage.changed";
  desc: string;
  url?: string;
  active: boolean;
}

export interface SyncLogEntry {
  id: string;
  workspaceId: string;
  at: string;
  msg: string;
  state: "ok" | "retried" | "error";
}

export interface Subscription {
  id: string;
  workspaceId: string;
  workspaceName: string;
  domain: string;
  plan: PlanId;
  since: string;
  amountMonthly: number;
  state: "active" | "trial";
  trialDaysLeft?: number;
}

export interface QualificationTags {
  coachable: boolean;
  icpFit: boolean;
  hot: boolean;
  lowFit: boolean;
}
