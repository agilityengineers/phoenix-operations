import type {
  Activity,
  CmsPage,
  Contact,
  Funnel,
  Member,
  Pipeline,
  Sequence,
  Subscription,
  SyncLogEntry,
  WebhookEndpoint,
  Workspace,
} from "./types";

// ────────────────────────────────────────────────────────────────────────────
// Seed data — the Phoenix Operations workspace exactly as in the design files.
// Used by the in-memory demo store and mirrored by supabase/seed.sql.
// ────────────────────────────────────────────────────────────────────────────

export const WORKSPACE_ID = "ws_phoenix";

export const seedWorkspace: Workspace = {
  id: WORKSPACE_ID,
  name: "Phoenix Operations",
  domain: "phoenixoperations.com",
  type: "eos_implementer",
  status: "live",
  plan: "network",
  createdAt: "2026-01-05T00:00:00Z",
  brand: {
    logoUrl: "/assets/logo.png",
    markUrl: "/assets/mark.png",
    primaryColor: "#D76C2C",
    inkColor: "#14263B",
    paperColor: "#F7F4EE",
    customDomain: "phoenixoperations.com",
  },
  guide: {
    photoUrl: "/assets/headshot.jpg",
    name: "Joshua Kornitsky",
    title: "Founder, Phoenix Operations",
    story:
      "I've built companies, led teams, worked inside large organizations, and spent decades working with hundreds of small businesses. I've seen what happens when growth starts creating more complexity than the people and processes were built to handle.",
    showGuideBand: true,
  },
  scheduling: {
    provider: "calendly",
    eventTypeUri: "",
    eventTypeName: "",
    schedulingUrl: "",
    durationMinutes: 15,
    enabled: false,
  },
};

export const seedPartnerWorkspaces: Workspace[] = [
  seedWorkspace,
  {
    ...seedWorkspace,
    id: "ws_bluecollar",
    name: "Blue Collar Ops",
    domain: "ops.bluecollarsuccess.com",
    type: "eos_implementer",
    status: "live",
    plan: "practice",
    createdAt: "2026-03-02T00:00:00Z",
  },
  {
    ...seedWorkspace,
    id: "ws_alcott",
    name: "Alcott Operations",
    domain: "alcottops.com",
    type: "consultant",
    status: "onboarding",
    plan: "solo",
    createdAt: "2026-08-14T00:00:00Z",
  },
];

export const partnerStats: Record<string, { funnels: string; leads: string; users: string }> = {
  ws_phoenix: { funnels: "5", leads: "151", users: "2" },
  ws_bluecollar: { funnels: "3", leads: "112", users: "4" },
  ws_alcott: { funnels: "1", leads: "—", users: "1" },
};

export const seedMembers: Member[] = [
  { id: "m1", workspaceId: WORKSPACE_ID, name: "Joshua Kornitsky", email: "joshua@phoenixoperations.com", role: "admin", state: "active" },
  { id: "m2", workspaceId: WORKSPACE_ID, name: "Dana Whitfield", email: "dana@phoenixoperations.com", role: "staff", state: "active" },
  { id: "m3", workspaceId: WORKSPACE_ID, name: "Chris Crew", email: "chris@bluecollarsuccess.com", role: "partner", state: "active" },
  { id: "m4", workspaceId: WORKSPACE_ID, name: "Renee Alcott", email: "renee@alcottops.com", role: "partner", state: "invited" },
];

// ── Funnels ─────────────────────────────────────────────────────────────────

const defaultBlocks = (): Funnel["blocks"] => [
  { id: "frustration", name: "Frustration deep-dive", desc: "3 questions · Conversation Guide: Lack of Control", required: true, enabled: true, order: 0 },
  { id: "firmographics", name: "Business profile", desc: "Industry, revenue, team size, clients, years", required: true, enabled: true, order: 1 },
  { id: "contact", name: "Contact info", desc: "Name, email, company, phone, role", required: true, enabled: true, order: 2 },
  { id: "ownerJoin", name: "Owner attendance", desc: "Shown only when respondent is not the owner/CEO", required: false, enabled: true, order: 3, condition: "role ≠ Owner/Founder and role ≠ CEO/President" },
  { id: "coachability", name: "Coachability self-assessment", desc: '2 Likert questions + "what have you tried"', required: true, enabled: true, order: 4 },
];

const defaultWeights = { icpFit: 40, coachability: 25, authority: 20, urgency: 15 };

export const seedFunnels: Funnel[] = [
  {
    id: "control",
    workspaceId: WORKSPACE_ID,
    name: "Lack of Control",
    slug: "lack-of-control",
    segment: "Lack of Control — founders whose business runs them",
    offer: "Free 15-minute conversation — no pitch",
    status: "live",
    kicker: "For founders who feel it: Lack of Control",
    problemCopy:
      "Every decision routes through you. Every fire finds you. You built this company to create freedom—and somewhere along the way, it started controlling you more than you control it.",
    stakes: [
      "You cancel time off because something always breaks while you’re gone.",
      "Decisions your team should own still land on your desk every day.",
      "You’ve delegated before — and quietly taken it all back.",
    ],
    storybrand: {
      hero: "A founder whose business controls them more than they control it",
      problem: "Every decision routes through you. Every fire finds you.",
      guide: 'Joshua — "I’ve sat in your seat."',
      plan: "A free 15-minute conversation. No prep, no pressure, no pitch.",
      success: "Clarity on the obstacles and what needs attention first",
    },
    variants: [
      { id: "A", label: "A", headline: "The business shouldn't run you.", trafficPct: 50, cvr: "7.1%" },
      { id: "B", label: "B", headline: "Take your business back.", trafficPct: 50, cvr: "5.4%" },
    ],
    blocks: defaultBlocks(),
    weights: defaultWeights,
    stats: { visits: 1284, leads: 86, cvr: "6.7%" },
  },
  {
    id: "profit",
    workspaceId: WORKSPACE_ID,
    name: "Lack of Profit",
    slug: "lack-of-profit",
    segment: "Lack of Profit — working too hard for what the business produces",
    offer: "Free 15-minute conversation — no pitch",
    status: "live",
    kicker: "For founders who feel it: Lack of Profit",
    problemCopy:
      "You're working too hard for what the business produces. The effort is real — the numbers don't reflect it, and it's hard to say exactly where it leaks.",
    stakes: [
      "Revenue grows, but the bottom line barely moves.",
      "You quote from gut feel and hope the margin holds.",
      "Payroll clears, and somehow there’s little left for you.",
    ],
    storybrand: {
      hero: "A founder working too hard for what the business produces",
      problem: "Working this hard should show up in the numbers.",
      guide: 'Joshua — "I’ve sat in your seat."',
      plan: "A free 15-minute conversation. No prep, no pressure, no pitch.",
      success: "Clarity on where the profit is leaking and what to fix first",
    },
    variants: [{ id: "A", label: "A", headline: "Working this hard should show up in the numbers.", trafficPct: 100 }],
    blocks: defaultBlocks(),
    weights: defaultWeights,
    stats: { visits: 702, leads: 38, cvr: "5.4%" },
  },
  {
    id: "people",
    workspaceId: WORKSPACE_ID,
    name: "People",
    slug: "people",
    segment: "People — frustrated with people who aren't meeting expectations",
    offer: "Free 15-minute conversation — no pitch",
    status: "draft",
    kicker: "For founders who feel it: People",
    problemCopy:
      "You're frustrated with people who aren't meeting your expectations — and tired of being the only one who cares as much as you do.",
    stakes: [
      "Expectations feel obvious to you and fuzzy to everyone else.",
      "The same conversations keep getting avoided.",
      "Your best people carry the ones who coast.",
    ],
    storybrand: {
      hero: "A leader whose people aren't meeting expectations",
      problem: "Stop being the only one who cares as much as you do.",
      guide: 'Joshua — "I’ve sat in your seat."',
      plan: "A free 15-minute conversation. No prep, no pressure, no pitch.",
      success: "A clear read on the people issues and where to start",
    },
    variants: [{ id: "A", label: "A", headline: "Stop being the only one who cares as much as you do.", trafficPct: 100 }],
    blocks: defaultBlocks(),
    weights: defaultWeights,
    stats: { visits: 0, leads: 0, cvr: "—" },
  },
  {
    id: "ceiling",
    workspaceId: WORKSPACE_ID,
    name: "Hitting the Ceiling",
    slug: "hitting-the-ceiling",
    segment: "Hitting the Ceiling — what got you here won't get you there",
    offer: "Free 15-minute conversation — no pitch",
    status: "live",
    kicker: "For founders who feel it: Hitting the Ceiling",
    problemCopy:
      "What got you here doesn't seem capable of getting you to the next level. The company keeps bumping into the same ceiling — and pushing harder isn't moving it.",
    stakes: [
      "Growth stalled at the same revenue line — again.",
      "What used to work has quietly stopped working.",
      "Everyone’s busy, but the company isn’t moving.",
    ],
    storybrand: {
      hero: "A founder whose company keeps hitting the same ceiling",
      problem: "What got you here won’t get you there.",
      guide: 'Joshua — "I’ve sat in your seat."',
      plan: "A free 15-minute conversation. No prep, no pressure, no pitch.",
      success: "Clarity on what's capping growth and what needs attention first",
    },
    variants: [
      { id: "A", label: "A", headline: "What got you here won’t get you there.", trafficPct: 50 },
      { id: "B", label: "B", headline: "Break through the ceiling.", trafficPct: 50 },
    ],
    blocks: defaultBlocks(),
    weights: defaultWeights,
    stats: { visits: 449, leads: 21, cvr: "4.7%" },
  },
  {
    id: "nothing",
    workspaceId: WORKSPACE_ID,
    name: "Nothing Works",
    slug: "nothing-works",
    segment: "Nothing Works — the same problems keep coming back",
    offer: "Free 15-minute conversation — no pitch",
    status: "paused",
    kicker: "For founders who feel it: Nothing Works",
    problemCopy:
      "You've tried fixing these things before — new hires, new software, new consultants — but the same problems keep coming back.",
    stakes: [
      "Every fix improved things for a month, then faded.",
      "The issues list looks the same as it did last year.",
      "You’re starting to wonder if it’s just how it is.",
    ],
    storybrand: {
      hero: "A founder who has tried everything and the problems keep returning",
      problem: "You’ve tried everything. The problems keep coming back.",
      guide: 'Joshua — "I’ve sat in your seat."',
      plan: "A free 15-minute conversation. No prep, no pressure, no pitch.",
      success: "An honest read on why fixes haven’t stuck — and what would",
    },
    variants: [{ id: "A", label: "A", headline: "You’ve tried everything. The problems keep coming back.", trafficPct: 100 }],
    blocks: defaultBlocks(),
    weights: defaultWeights,
    stats: { visits: 188, leads: 6, cvr: "3.2%" },
  },
];

// ── Pipelines + contacts ────────────────────────────────────────────────────

export const seedPipelines: Pipeline[] = [
  {
    id: "prospects",
    workspaceId: WORKSPACE_ID,
    name: "Prospects",
    desc: "Potential clients moving from intake to engagement",
    stages: ["New", "Qualified", "Call scheduled", "In conversation"],
  },
  {
    id: "clients",
    workspaceId: WORKSPACE_ID,
    name: "Client journey",
    desc: "Active clients — tracking the coaching experience end to end",
    stages: ["Onboarding", "Foundation", "Traction", "Graduated"],
  },
];

export const seedContacts: Contact[] = [
  { id: "1", workspaceId: WORKSPACE_ID, pipelineId: "prospects", name: "Marcus Webb", company: "Webb Mechanical", role: "Owner / Founder", email: "marcus@webbmech.com", funnel: "Lack of Control", source: "google / cpc", score: 88, stage: 1, position: 0, owner: "Joshua", createdAt: "2026-09-01T13:14:02Z" },
  { id: "2", workspaceId: WORKSPACE_ID, pipelineId: "prospects", name: "Sarah Delgado", company: "Delgado Electric", role: "CEO / President", email: "sarah@delgadoelectric.com", funnel: "Lack of Control", source: "linkedin / organic", score: 76, stage: 2, position: 0, owner: "Joshua", createdAt: "2026-08-30T10:00:00Z" },
  { id: "3", workspaceId: WORKSPACE_ID, pipelineId: "prospects", name: "Tom Brantley", company: "Brantley HVAC", role: "Owner / Founder", email: "tom@brantleyhvac.com", funnel: "Lack of Profit", source: "referral", score: 91, stage: 2, position: 1, owner: "Joshua", createdAt: "2026-08-29T15:20:00Z" },
  { id: "4", workspaceId: WORKSPACE_ID, pipelineId: "prospects", name: "Priya Nair", company: "Nair Consulting", role: "COO / Operations", email: "priya@nairconsulting.com", funnel: "People", source: "newsletter", score: 54, stage: 0, position: 0, owner: "—", createdAt: "2026-08-28T09:00:00Z" },
  { id: "5", workspaceId: WORKSPACE_ID, pipelineId: "prospects", name: "Dale Hutchins", company: "Hutchins Plumbing Co.", role: "Owner / Founder", email: "dale@hutchinsplumbing.com", funnel: "Lack of Control", source: "google / cpc", score: 83, stage: 3, position: 0, owner: "Joshua", createdAt: "2026-08-26T11:45:00Z" },
  { id: "6", workspaceId: WORKSPACE_ID, pipelineId: "prospects", name: "Renee Alcott", company: "Alcott Landscapes", role: "Owner / Founder", email: "renee@alcottlandscapes.com", funnel: "Hitting the Ceiling", source: "facebook / paid", score: 67, stage: 1, position: 1, owner: "Joshua", createdAt: "2026-08-25T16:30:00Z" },
  { id: "7", workspaceId: WORKSPACE_ID, pipelineId: "prospects", name: "Gene Park", company: "Park Manufacturing", role: "Other leadership", email: "gene@parkmfg.com", funnel: "Nothing Works", source: "referral", score: 41, stage: 0, position: 1, owner: "—", createdAt: "2026-08-24T14:00:00Z" },
  { id: "8", workspaceId: WORKSPACE_ID, pipelineId: "clients", name: "Chris Crew", company: "The Blue Collar Success Group", role: "President", email: "chris@bluecollarsuccess.com", funnel: "Referral", source: "referral", score: 91, stage: 2, position: 0, owner: "Joshua", createdAt: "2026-05-01T09:00:00Z" },
  { id: "9", workspaceId: WORKSPACE_ID, pipelineId: "clients", name: "Danielle Putnam", company: "The New Flat Rate", role: "CEO / President", email: "danielle@newflatrate.com", funnel: "Referral", source: "referral", score: 88, stage: 2, position: 1, owner: "Joshua", createdAt: "2026-04-12T09:00:00Z" },
  { id: "10", workspaceId: WORKSPACE_ID, pipelineId: "clients", name: "Lincoln Higdon", company: "Centerpoint IT", role: "CEO / President", email: "lincoln@centerpointit.com", funnel: "Lack of Control", source: "google / cpc", score: 84, stage: 1, position: 0, owner: "Joshua", createdAt: "2026-06-20T09:00:00Z" },
  { id: "11", workspaceId: WORKSPACE_ID, pipelineId: "clients", name: "Teresa Vance", company: "Vance Roofing", role: "Owner / Founder", email: "teresa@vanceroofing.com", funnel: "Hitting the Ceiling", source: "referral", score: 79, stage: 0, position: 0, owner: "Joshua", createdAt: "2026-08-18T09:00:00Z" },
];

export function seedActivitiesFor(contact: Contact): Activity[] {
  return [
    {
      id: `${contact.id}-a1`,
      workspaceId: WORKSPACE_ID,
      contactId: contact.id,
      type: "email",
      title: "Confirmation email sent",
      body: "SendGrid · intake-confirmation template · delivered",
      at: "2026-09-01T13:15:00Z",
    },
    {
      id: `${contact.id}-a2`,
      workspaceId: WORKSPACE_ID,
      contactId: contact.id,
      type: "intake_completed",
      title: `Intake completed — scored ${contact.score}`,
      body: 'Least control: scheduling, team accountability. "Every pricing call still comes to me." Coachability 4/5 and 5/5.',
      at: "2026-09-01T13:14:00Z",
    },
    {
      id: `${contact.id}-a3`,
      workspaceId: WORKSPACE_ID,
      contactId: contact.id,
      type: "intake_started",
      title: "Intake started",
      body: `Landed on /lack-of-control (variant A) · ${contact.source}`,
      at: "2026-09-01T13:08:00Z",
    },
    {
      id: `${contact.id}-a4`,
      workspaceId: WORKSPACE_ID,
      contactId: contact.id,
      type: "view",
      title: "Page view",
      body: "utm_campaign=founders-q3 · first visit",
      at: "2026-09-01T13:06:00Z",
    },
  ];
}

// ── CMS ─────────────────────────────────────────────────────────────────────

export const seedCmsPages: CmsPage[] = [
  {
    id: "home",
    name: "Homepage",
    meta: "6 sections · Published",
    sections: [
      { id: "hero", name: "Hero", desc: "Headline, frustration selector, primary CTA", enabled: true },
      { id: "howwho", name: "How It Works + Who We Help", desc: "Two-column: 4 steps, 4 traits, inline testimonial", enabled: true },
      { id: "guideband", name: "Guide band", desc: "Compact intro linking to the guide page", enabled: true },
      { id: "results", name: "Client Perspectives", desc: "3 testimonial cards", enabled: true },
      { id: "faq", name: "FAQ", desc: "4 questions, accordion", enabled: true },
      { id: "footer", name: "Footer CTA", desc: "Ready to take the first step + schedule button", enabled: true },
    ],
  },
  {
    id: "guide",
    name: "Meet Your Guide",
    meta: "4 sections · Published",
    sections: [
      { id: "ghero", name: "Guide hero", desc: "Circular photo, story, CTA — pulls from Guide identity", enabled: true },
      { id: "gpillars", name: "Experience pillars", desc: "3 columns of background", enabled: true },
      { id: "gquotes", name: "Guide testimonials", desc: "2 attributed quotes", enabled: true },
      { id: "gfooter", name: "Footer CTA", desc: "Shared footer module", enabled: true },
    ],
  },
  {
    id: "results",
    name: "Results (private)",
    meta: "5 sections · Link-only",
    sections: [
      { id: "rhero", name: "Results hero", desc: "EOS framing statement", enabled: true },
      { id: "rstats", name: "Headline metrics", desc: "2.8× study, 100K+ adoption, six components", enabled: true },
      { id: "rcomponents", name: "Six Key Components", desc: "V/P/D/I/Pr/T cards with results", enabled: true },
      { id: "rtimeline", name: "What owners see, and when", desc: "90 days / year one / year two+", enabled: true },
      { id: "rproof", name: "Client proof", desc: "4 quotes + trademark attribution", enabled: true },
    ],
  },
  {
    id: "funnelTpl",
    name: "Funnel template",
    meta: "StoryBrand · 5 blocks",
    sections: [
      { id: "fhero", name: "StoryBrand hero", desc: "Hero/problem/guide/plan/success — per-funnel copy", enabled: true },
      { id: "fstakes", name: "Sound familiar card", desc: "3 stakes + guide credibility note", enabled: true },
      { id: "fintake", name: "Intake form", desc: "Modular blocks — managed per funnel", enabled: true },
      { id: "fschedule", name: "Scheduler", desc: "Post-submit booking step", enabled: true },
    ],
  },
];

// ── Sequences ───────────────────────────────────────────────────────────────

export const seedSequences: Sequence[] = [
  {
    id: "seq1",
    workspaceId: WORKSPACE_ID,
    name: "Booked call — reminders",
    trigger: "intake.completed + slot booked",
    active: true,
    stat: "94%",
    statLabel: "show rate",
    steps: [
      { kind: "Email", label: "Confirmation (immediate)" },
      { kind: "Email", label: "Reminder — 24h before" },
      { kind: "Email", label: "Reminder — 1h before" },
      { kind: "CRM", label: "Stage → Call scheduled" },
    ],
  },
  {
    id: "seq2",
    workspaceId: WORKSPACE_ID,
    name: "No-show recovery",
    trigger: "call marked no-show",
    active: true,
    stat: "41%",
    statLabel: "rebook rate",
    steps: [
      { kind: "Email", label: '"We missed you" + rebook link (1h)' },
      { kind: "Task", label: "Owner: personal follow-up (day 2)" },
      { kind: "Email", label: "Last nudge (day 5)" },
      { kind: "CRM", label: "No response → stage Dormant" },
    ],
  },
  {
    id: "seq3",
    workspaceId: WORKSPACE_ID,
    name: "Post-call follow-through",
    trigger: "call logged as completed",
    active: true,
    stat: "2.4d",
    statLabel: "avg. next step",
    steps: [
      { kind: "Task", label: "Owner: send recap notes (same day)" },
      { kind: "Email", label: "Recap + proposed next step" },
      { kind: "CRM", label: "Stage → In conversation" },
      { kind: "Zap", label: "stage.changed webhook" },
    ],
  },
  {
    id: "seq4",
    workspaceId: WORKSPACE_ID,
    name: "Abandoned intake",
    trigger: "intake started, idle 24h",
    active: false,
    stat: "18%",
    statLabel: "resume rate",
    steps: [
      { kind: "Email", label: '"Pick up where you left off" (24h)' },
      { kind: "Email", label: "Value nudge: results page link (day 3)" },
    ],
  },
];

// ── Integrations ────────────────────────────────────────────────────────────

export const seedWebhooks: WebhookEndpoint[] = [
  { id: "wh1", workspaceId: WORKSPACE_ID, event: "lead.created", desc: "New intake submission", active: true },
  { id: "wh2", workspaceId: WORKSPACE_ID, event: "intake.completed", desc: "All steps finished", active: true },
  { id: "wh3", workspaceId: WORKSPACE_ID, event: "lead.qualified", desc: "Score crosses threshold (70)", active: true },
  { id: "wh4", workspaceId: WORKSPACE_ID, event: "stage.changed", desc: "Pipeline stage moved", active: false },
];

export const seedSyncLog: SyncLogEntry[] = [
  { id: "sl1", workspaceId: WORKSPACE_ID, at: "09:41", msg: "Contacts batch → HubSpot (12 records)", state: "ok" },
  { id: "sl2", workspaceId: WORKSPACE_ID, at: "09:41", msg: "Deals pull ← HubSpot (3 updated)", state: "ok" },
  { id: "sl3", workspaceId: WORKSPACE_ID, at: "09:12", msg: "Contact update → HubSpot (marcus@webbmech.com)", state: "ok" },
  { id: "sl4", workspaceId: WORKSPACE_ID, at: "08:55", msg: "Companies batch → HubSpot (429 rate limit)", state: "retried" },
  { id: "sl5", workspaceId: WORKSPACE_ID, at: "08:55", msg: "Retry succeeded after backoff (2.1s)", state: "ok" },
  { id: "sl6", workspaceId: WORKSPACE_ID, at: "08:20", msg: "Field mapping validated (14 fields, 2-way)", state: "ok" },
];

export const seedSubscriptions: Subscription[] = [
  { id: "sub1", workspaceId: "ws_phoenix", workspaceName: "Phoenix Operations", domain: "phoenixoperations.com", plan: "network", since: "Jan 2026", amountMonthly: 399, state: "active" },
  { id: "sub2", workspaceId: "ws_bluecollar", workspaceName: "Blue Collar Ops", domain: "ops.bluecollarsuccess.com", plan: "practice", since: "Mar 2026", amountMonthly: 179, state: "active" },
  { id: "sub3", workspaceId: "ws_alcott", workspaceName: "Alcott Operations", domain: "alcottops.com", plan: "solo", since: "Aug 2026", amountMonthly: 79, state: "trial", trialDaysLeft: 9 },
];

export const PLANS = [
  { id: "solo" as const, name: "Solo", price: 79, popular: false, features: ["1 user", "2 funnels", "CRM + pipeline", "Zapier webhooks", "Email sequences"] },
  { id: "practice" as const, name: "Practice", price: 179, popular: true, features: ["5 users", "Unlimited funnels", "HubSpot two-way sync", "Custom domain + white label", "A/B variants"] },
  { id: "network" as const, name: "Network", price: 399, popular: false, features: ["Unlimited users", "Multiple partner workspaces", "Network rollup analytics", "Priority support", "Custom connector slots"] },
];
