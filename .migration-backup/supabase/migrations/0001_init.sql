-- Phoenix Operations — initial schema
-- Multi-tenant: every table keyed by workspace_id with RLS enforced.
-- Server-side API routes use the service role; authenticated app users are
-- restricted to workspaces they belong to via the memberships check below.

create extension if not exists pgcrypto;

-- ── Workspaces & people ─────────────────────────────────────────────────────

create table workspaces (
  id          text primary key,
  name        text not null,
  domain      text not null default '',
  type        text not null default 'eos_implementer'
              check (type in ('eos_implementer', 'consultant', 'other')),
  status      text not null default 'onboarding' check (status in ('live', 'onboarding')),
  plan        text not null default 'solo' check (plan in ('solo', 'practice', 'network')),
  brand       jsonb not null default '{}'::jsonb,
  guide       jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create table members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null references workspaces(id) on delete cascade,
  user_id       uuid,                    -- auth.users.id once the invite is accepted
  name          text not null,
  email         text not null,
  role          text not null default 'staff'
                check (role in ('admin', 'owner', 'staff', 'partner')),
  state         text not null default 'invited' check (state in ('active', 'invited')),
  created_at    timestamptz not null default now(),
  unique (workspace_id, email)
);

create index members_workspace_idx on members(workspace_id);
create index members_user_idx on members(user_id);

-- ── Funnels ─────────────────────────────────────────────────────────────────

create table funnels (
  id            text primary key,
  workspace_id  text not null references workspaces(id) on delete cascade,
  name          text not null,
  slug          text not null,
  segment       text not null default '',
  offer         text not null default '',
  status        text not null default 'draft' check (status in ('live', 'draft', 'paused')),
  kicker        text not null default '',
  problem_copy  text not null default '',
  stakes        jsonb not null default '[]'::jsonb,
  storybrand    jsonb not null default '{}'::jsonb,   -- hero/problem/guide/plan/success
  variants      jsonb not null default '[]'::jsonb,   -- [{id,label,headline,trafficPct,cvr}]
  blocks        jsonb not null default '[]'::jsonb,   -- modular intake blocks w/ order+condition
  weights       jsonb not null default '{"icpFit":40,"coachability":25,"authority":20,"urgency":15}'::jsonb,
  stats         jsonb not null default '{"visits":0,"leads":0,"cvr":"—"}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (workspace_id, slug)
);

create index funnels_workspace_idx on funnels(workspace_id);

-- ── Intake sessions (partial save / resume) ─────────────────────────────────

create table intake_sessions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null references workspaces(id) on delete cascade,
  funnel_slug   text not null,
  variant       text not null default 'A',
  resume_token  text not null unique,
  step          int  not null default 1 check (step between 1 and 5),
  answers       jsonb not null default '{}'::jsonb,
  utm           jsonb not null default '{}'::jsonb,
  submitted     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index intake_sessions_workspace_idx on intake_sessions(workspace_id);
create index intake_sessions_funnel_idx on intake_sessions(workspace_id, funnel_slug);

-- ── CRM: pipelines, contacts, activities ────────────────────────────────────

create table pipelines (
  id            text primary key,
  workspace_id  text not null references workspaces(id) on delete cascade,
  name          text not null,
  description   text not null default '',
  stages        jsonb not null default '[]'::jsonb,   -- ordered stage-name list
  created_at    timestamptz not null default now()
);

create index pipelines_workspace_idx on pipelines(workspace_id);

create table contacts (
  id            text primary key default ('ld_' || substr(gen_random_uuid()::text, 1, 8)),
  workspace_id  text not null references workspaces(id) on delete cascade,
  pipeline_id   text not null references pipelines(id),
  name          text not null,
  company       text not null default '—',
  role          text not null default '—',
  email         text not null default '—',
  phone         text,
  funnel        text not null default '—',
  source        text not null default 'direct',
  score         int  not null default 50 check (score between 0 and 100),
  stage         int  not null default 0,
  position      int  not null default 0,
  owner         text not null default '—',
  answers       jsonb,
  utm           jsonb,
  booked_slot   text,
  created_at    timestamptz not null default now()
);

create index contacts_workspace_idx on contacts(workspace_id);
create index contacts_email_idx on contacts(workspace_id, lower(email));
create index contacts_board_idx on contacts(workspace_id, pipeline_id, stage, position);

create table activities (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null references workspaces(id) on delete cascade,
  contact_id    text not null references contacts(id) on delete cascade,
  type          text not null check (type in
                ('view','intake_started','intake_completed','note','task','email','call','stage_change')),
  title         text not null,
  body          text not null default '',
  at            timestamptz not null default now()
);

create index activities_contact_idx on activities(contact_id, at desc);

-- ── CMS ─────────────────────────────────────────────────────────────────────

create table cms_pages (
  workspace_id  text not null references workspaces(id) on delete cascade,
  id            text not null,             -- home | guide | results | funnelTpl
  name          text not null,
  meta          text not null default '',
  sections      jsonb not null default '[]'::jsonb,  -- [{id,name,desc,enabled}]
  sort          int not null default 0,
  primary key (workspace_id, id)
);

-- ── Sequences ───────────────────────────────────────────────────────────────

create table sequences (
  id            text primary key,
  workspace_id  text not null references workspaces(id) on delete cascade,
  name          text not null,
  trigger       text not null,
  active        boolean not null default true,
  stat          text not null default '',
  stat_label    text not null default '',
  steps         jsonb not null default '[]'::jsonb,   -- [{kind,label}]
  created_at    timestamptz not null default now()
);

-- ── Integrations ────────────────────────────────────────────────────────────

create table webhook_endpoints (
  id            text primary key,
  workspace_id  text not null references workspaces(id) on delete cascade,
  event         text not null check (event in
                ('lead.created','intake.completed','lead.qualified','stage.changed')),
  description   text not null default '',
  url           text,
  active        boolean not null default true
);

create table webhook_deliveries (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null references workspaces(id) on delete cascade,
  event         text not null,
  payload       jsonb not null,
  status        text not null default 'pending',
  attempts      int not null default 0,
  at            timestamptz not null default now()
);

create table hubspot_connections (
  workspace_id  text primary key references workspaces(id) on delete cascade,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  direction     text not null default 'two_way' check (direction in ('two_way','push','pull')),
  field_mapping jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

create table sync_log (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null references workspaces(id) on delete cascade,
  at_label      text not null,
  msg           text not null,
  state         text not null default 'ok' check (state in ('ok','retried','error')),
  created_at    timestamptz not null default now()
);

create table email_log (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  text not null references workspaces(id) on delete cascade,
  to_email      text not null,
  template      text not null,
  subject       text not null,
  status        text not null default 'sent',
  at            timestamptz not null default now()
);

-- ── Billing ─────────────────────────────────────────────────────────────────

create table subscriptions (
  id              text primary key,
  workspace_id    text not null references workspaces(id) on delete cascade,
  workspace_name  text not null,
  domain          text not null default '',
  plan            text not null check (plan in ('solo','practice','network')),
  since           text not null default '',
  amount_monthly  int not null default 0,
  state           text not null default 'trial' check (state in ('active','trial')),
  trial_days_left int,
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at      timestamptz not null default now()
);

-- ── Scoring rules (per-funnel overrides live on funnels.weights; this table
--    holds workspace-level defaults so partners can tune without code) ───────

create table scoring_rules (
  workspace_id  text primary key references workspaces(id) on delete cascade,
  weights       jsonb not null default '{"icpFit":40,"coachability":25,"authority":20,"urgency":15}'::jsonb,
  threshold     int not null default 70
);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- The Next.js API layer uses the service role (bypasses RLS). These policies
-- protect direct client access: an authenticated user can only read rows in
-- workspaces where they hold an active membership; anon gets nothing.

create or replace function is_workspace_member(ws text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and m.state = 'active'
  );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'workspaces','members','funnels','intake_sessions','pipelines','contacts',
    'activities','cms_pages','sequences','webhook_endpoints','webhook_deliveries',
    'hubspot_connections','sync_log','email_log','subscriptions','scoring_rules'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Workspaces: members can see their own workspace row.
create policy workspaces_member_read on workspaces
  for select using (is_workspace_member(id));

-- Everything else: member read + write within the workspace.
do $$
declare t text;
begin
  foreach t in array array[
    'members','funnels','intake_sessions','pipelines','contacts','activities',
    'cms_pages','sequences','webhook_endpoints','webhook_deliveries',
    'sync_log','email_log','subscriptions','scoring_rules'
  ] loop
    execute format(
      'create policy %I_member_read on %I for select using (is_workspace_member(workspace_id))',
      t, t);
    execute format(
      'create policy %I_member_write on %I for all using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id))',
      t, t);
  end loop;
end $$;

-- HubSpot tokens: workspace admins only, and never client-side.
create policy hubspot_admin_only on hubspot_connections
  for all using (
    exists (
      select 1 from members m
      where m.workspace_id = hubspot_connections.workspace_id
        and m.user_id = auth.uid() and m.role in ('admin','owner') and m.state = 'active'
    )
  );
