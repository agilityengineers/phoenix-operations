# Handoff: Phoenix Operations — Marketing Site, Funnel System & Mini CRM

## Overview
A white-label-ready platform for Phoenix Operations (an EOS® coaching practice): a public marketing site, an audience-segmented funnel/landing-page system with multi-step qualifying intake, and an admin app containing a mini CRM, CMS, white-label branding, user/partner management, and integrations (Zapier, HubSpot, SendGrid).

Primary user: the practice owner (Joshua Kornitsky). Platform design center: EOS implementers — but the architecture must generalize to any consultant or operations professional (no hard-coded EOS assumptions outside editable content).

## About the Design Files
The `.dc.html` files in this bundle are **design references created in HTML** — high-fidelity prototypes showing intended look and behavior, NOT production code. The task is to **recreate these designs** in the production stack below using its established patterns. **To view them: open each `.dc.html` file in a browser from this folder** — `support.js` and `image-slot.js` (bundled) must sit alongside them, and `assets/` supplies images. The rendered page in the browser is the source of truth for look and behavior; the file source is the source of truth for exact hex values, spacing, and copy (styles are inline on every element).

## Target Stack (non-negotiable, from the client brief)
- Next.js (App Router) + React + TypeScript, typed API routes
- Postgres via Supabase (auth + RLS), migrations + seed data included
- Deployable on both **Vercel and Replit**; GitHub source control (repo: `agilityengineers/phoenix-operations`)
- All third-party keys via environment variables — nothing hardcoded
- WCAG AA, SEO meta + schema.org per page, optimized images, spam-protected forms (honeypot + rate limit)

## Fidelity
**High-fidelity.** Recreate pixel-perfectly: exact colors, type, spacing, and copy as in the files. The one lofi area is the admin's "Edit copy" / drag-reorder affordances (buttons exist but editors are not mocked) — implement with your judgment following the visual language.

## Files
| File | What it is |
| --- | --- |
| `Phoenix Site.dc.html` | Public homepage (brand-first, modular sections) |
| `Meet Your Guide.dc.html` | Guide bio page (renders from Guide identity profile) |
| `Results Proof.dc.html` | Private link-only EOS results/proof page (noindex) |
| `Funnel Landing.dc.html` | Seed funnel: "Lack of Control" — StoryBrand hero + 5-step intake + scheduler |
| `Admin.dc.html` | Admin app: Dashboard, Funnels, Funnel Builder, Contacts (pipeline + detail), Sequences, Site Content CMS, White Label, Users & Network (with network rollup KPIs), Billing, Integrations |
| `Auth.dc.html` | Sign in, password reset, 3-step partner-workspace signup (invite code, practice type, plan pick + Stripe trial) |
| `Email Templates.dc.html` | SendGrid designs: intake confirmation, internal new-lead notification, 24h call reminder (600px, table-safe) |
| `Legal.dc.html` | Privacy Policy + Terms of Service drafts (tabbed) — flagged for attorney review; covers white-label controller/processor split |
| `Mobile Funnel.dc.html` | 390px mobile references: homepage, funnel landing, intake step, scheduler (44px+ hit targets) |
| `assets/` | logo.png (brand-orange recolor), mark.png (phoenix mark only), headshot.jpg/png, hero-photo.png |
| `docs/phoenix-operations.txt`, `docs/conversation-guide.txt` | Source positioning copy & intake question bank (extracted from client docs) |

Note: the prototypes persist state in `localStorage` (`po-intake-lack-of-control`, `po-leads`) — in production these become DB rows (intake_sessions with resume tokens, leads).

## Design Tokens
Colors:
- Paper (page bg): `#F7F4EE` · Admin bg: `#F3F1EB` · Card: `#FFFFFF` · Card alt: `#FDFBF7`, `#FDF9F2`, `#FBF4E9`
- Ink (text/dark bg): `#14263B` · Body text: `#3A4A5E` · Muted: `#4A5A6E`, `#6A7686`, `#8A94A2` · Faint: `#B4AC98`, `#7E8DA1`, `#9FAEC2`
- Primary orange: `#D96C2C` (brand logo recolored to `#D76C2C`) · Hover: `#C05A1C`, dark-bg hover `#E8894E` · Tint: `#FBEFE4` · Deep: `#B5541C`
- Borders: `#E5DFD2`, `#EDE7DA`, `#E7E2D6`, `#F1EDE2`, `#E0DACB`, `#D8D2C4`
- Success: `#2E7D43` on `#E8F3EA` · Warning: `#B5541C` on `#FBF4E9` · Danger: `#B04A3A` on `#F6E8E6`
Typography: **Poppins** (Google Fonts) 400/500/600/700/800 everywhere. H1 48–62px/800, H2 36–44px/800, section kickers 13px/700/uppercase/0.14em tracking, body 14–18px/1.6–1.7, admin UI 12–15px.
Radii: cards 12px, inputs/buttons 6–8px, pills 20px, chips 8px. Orange accent rule: 64–76px × 4–5px.
Buttons: primary = orange bg, white text, 700, uppercase, 0.06em, 16–18px/28–30px padding; secondary = 1.5–2px orange border, transparent.

## Screens / Views

### 1. Homepage (`Phoenix Site.dc.html`)
Sticky nav (blurred paper bg): logo 66px, links (How It Works, Who We Help, Results, FAQ, Your Guide), outlined Schedule CTA.
Sections (each **admin-togglable** — see CMS):
1. **Hero** — photo bleeds full-height behind right 52%, cream gradient fade left-to-right over it; H1 "You're working harder. Shouldn't this be getting easier?"; 5-column **frustration selector** (Lack of Control, Lack of Profit, People, Hitting the Ceiling, Nothing Works — each an icon + name + blurb, left-border separators, links to that segment's funnel page); CTA "Schedule a 15-Minute Conversation".
2. **How It Works + Who We Help** — two columns split by a border. Left: 4 numbered steps (orange number disc + circled icon + title + blurb) + "Straightforward and Respectful" shield note. Right: Who We Help intro, 2×2 trait grid (Founder-Led, Growth-Minded, Results-Focused, Practical Approach), inline testimonial card.
3. **Guide band** — compact strip (bg `#F1EDE2`): circular headshot 170px with orange arc accent, "Guided by someone who's sat in your seat.", outlined "Meet Your Guide" button.
4. **Client Perspectives** — 3 testimonial cards (big orange quote glyph, quote, attribution).
5. **FAQ** — 4 native-details accordions.
Footer (ink bg): mark + wordmark, "Ready to Take the First Step?", orange CTA; sub-bar with © and links.
**Copy voice: "we/us" — the brand, never first-person Joshua.**

### 2. Meet Your Guide (`Meet Your Guide.dc.html`)
Renders entirely from the **Guide identity profile** (white-label): circular photo 340px in double-ring frame (thin tan ring + orange arc at -45°, soft shadow), name + title beneath; H1 "I've sat in your seat." + story + bold "You are the leading expert…" + CTA. Then 3 experience pillars, 2 attributed testimonials, shared footer. First-person voice is correct HERE.

### 3. Results Proof (`Results Proof.dc.html`)
Private, link-only (exclude from nav/sitemap, `noindex`). Header badge "Private link · Shared by Phoenix Operations". Sections: hero framing results as coming from EOS; ink-bg stat band (2.8× faster growth — TrueSpace/Gallup-validated 5-yr study of 305 companies; 100K+ companies on EOS tools; 6 key components) with source footnote; Six Key Components cards (V/P/D/I/Pr/T: what it is + "The result:"); 3-phase expectations timeline (Days 1–90 / Months 3–12 / Year 1–2+) with honest-caveat paragraph; 4 proof quotes; footer CTA. EOS® trademark attribution in footer.

### 4. Funnel Landing (`Funnel Landing.dc.html`) — the reusable funnel TEMPLATE
One of these is **generated per funnel** at `/f/[slug]` (clean shareable URLs) with A/B variant support. Structure (StoryBrand — prospect is hero, brand is guide):
- Slim header (logo + "Free 15-minute conversation · No pitch").
- Hero: segment kicker, variant headline, problem copy, CTA scrolls to intake; right card = 3 "Sound familiar?" stakes + guide credibility note with headshot.
- **5-step intake** (progress bar, step title, "Step N of 5", back/continue):
  1. Frustration deep-dive: multi-select chips (least control areas), textarea (what keeps coming back), single-select "what happens when you step away" (from the Conversation Guide question bank).
  2. Business profile: industry, revenue range, team size, client count, years in business (chip grids).
  3. Contact: name* + work email* (validated), company, phone, role chips; **conditional block** — if role ≠ Owner/Founder and ≠ CEO/President, show "will the owner join?" (Yes/Maybe/No); coach/peer-group history; urgency.
  4. Coachability: 2 Likert 1–5 self-assessments + "what have you already tried" textarea.
  5. Review table of all answers → Submit.
- **Partial save/resume**: every answer persisted; returning visitor sees "Welcome back" and resumes at their step.
- Post-submit: confirmation + **scheduler** (5-day × 4-slot grid, Calendly-style embed in production) → booked state with slot + email confirmation note.
- **UTM/referrer capture** persisted with the submission.

### 5. Admin (`Admin.dc.html`)
Dark ink sidebar (232px): mark + wordmark, nav (Dashboard, Funnels, Contacts, Site Content, White Label, Users & Network, Integrations), user chip, "View site".
- **Dashboard**: 4 KPI cards (Visits, Started intake, Completed, Qualified 70+ with deltas); funnel conversion bar chart (visits→started→completed→qualified with step rates); top-sources horizontal bars; newest qualified leads table (rows open contact detail).
- **Funnels**: card grid per funnel (status pill Live/Draft/Paused, headline, slug, variant count, visits/leads/CVR, Edit + View page). "+ New funnel".
- **Funnel Builder**: Audience & offer (segment, slug, offer); **StoryBrand narrative** editor (Hero/Problem/Guide/Plan/Success rows — one reusable template, per-funnel copy); A/B variants list with traffic split + CVR; **modular intake blocks** (drag handles, Required/Optional badge, On/Off toggle, conditional blocks show their condition, e.g. owner-attendance); **scoring weights** panel (ICP fit 40, Coachability 25, Authority 20, Urgency 15 = 0–100).
- **Pipeline (Contacts)**: the heart of the mini CRM. Pipeline switcher — **Prospects** (New → Qualified → Call scheduled → In conversation) and **Client journey** (Onboarding → Foundation → Traction → Graduated) so both potential and active clients' experiences are tracked; users can create/manage additional pipelines in production. **Kanban board with real drag-and-drop** (HTML5 draggable cards, columns highlight on drag-over) plus ←/→ buttons as fallback; "+ Add card" globally and per column (creates a manual contact card); search + stage filter pills; score pill (green ≥75 / amber ≥55 / red below), funnel + source tags, owner. CSV import/export buttons. Data model: `pipelines` (workspace_id, name, stage list ordered) with contacts holding (pipeline_id, stage, position).
- **Contact detail**: profile card (initials avatar, ink score card with tags like Coachable · ICP-fit · Hot), field list, **sync status** (HubSpot/Zapier/SendGrid); **activity timeline** (intake completed w/ answer summary, intake started w/ variant+source, page view w/ UTM, email sent; + Note and + Task actions prepend entries).
- **Site Content (CMS)**: page list (Homepage, Meet Your Guide, Results private, Funnel template) → per-page **section modules** with drag handle, description, Edit copy, **On/Off toggle**; Publish button. This is the mechanism behind the homepage section toggles.
- **White Label**: Brand identity (replaceable logo, 3 color swatches, custom domain) + **Guide identity** (photo, name, title, story, guide-band toggle) — guide page & band render from this profile per workspace.
- **Users & Network**: role hierarchy — **Admin (top: full control, invites everyone) → Owner (runs a workspace) → Staff (works leads only) → Partner (owner of their own white-labeled workspace)**; members list with role/state pills + working "+ Invite user"; **Partner workspaces** grid (name, domain, Live/Onboarding, **workspace type badge: EOS Implementer / Ops Consultant / Other**, funnels/leads/users counts, "+ New partner workspace").
- **Sequences**: follow-up automations — booked-call reminders (confirmation, 24h, 1h + stage move), no-show recovery (email → owner task → last nudge → Dormant), post-call follow-through (recap task/email, stage → In conversation, stage.changed webhook), abandoned-intake resume nudges. Each sequence: trigger, Active/Paused, step chips (Email/Task/CRM/Zap), outcome stat.
- **Billing**: Stripe plans — Solo $79 (1 user, 2 funnels), Practice $179 (5 users, unlimited funnels, HubSpot, custom domain), Network $399 (multi-workspace, rollup analytics); subscriptions table with MRR, trial states.
- **Users & Network additions**: 4 network rollup KPIs (network leads, avg workspace CVR, active workspaces, network MRR) and a **workspace type** badge per partner (EOS Implementer / Ops Consultant / Other) — the platform is designed for EOS implementers first but must serve any consultant.
- **Integrations**: Zapier (outbound events `lead.created`, `intake.completed`, `lead.qualified`, `stage.changed` with Active/Paused pills; sample JSON payload block; inbound endpoint `POST /api/webhooks/zapier/inbound` token-auth); SendGrid (intake confirmation → prospect, new-lead notification → owner); HubSpot (OAuth two-way sync, direction control Two-way/Push/Pull, conflict rule "most recent edit wins, CRM is source of truth for score & stage", field mapping, **sync log** with timestamps, 429 rate-limit retry-with-backoff entries).

## Interactions & Behavior
- Chip/select buttons: 1.5px border `#D8D2C4` on `#FDFBF7`; selected = orange border, `#FBEFE4` bg, `#B5541C` text.
- Step 3 validation: name required, email regex; inline error `#B04A3A`.
- Score (0–100), computed on submit: ICP fit ≤40 (revenue 15: $1M+ full / $500K–1M 8; employees 10: 11+ full / 4–10 6; industry 8 for trades/construction/professional-services/manufacturing; years 7 for 3+); Authority ≤20 (Owner 20, CEO 16, other-with-owner-joining 10, else 2); Coachability ≤25 (each Likert 0/2/4/6/8; tried-text >20 chars +4; ≥2 control areas +3; coach history +2); Urgency ≤15 (this quarter 15 / 6 months 9 / exploring 3). Qualified threshold: 70. **Soft disqualify** — low scores still book, flagged low-fit.
- Qualification tags: score ≥70 Coachable, ≥75 ICP-fit, ≥85 Hot, else Low-fit.
- Nav/hover states are in the files (style-hover attributes); transitions ~0.2–0.3s.

## State & Data Model (suggested)
`workspaces` (id, name, domain, type: eos_implementer|consultant|other, brand JSON, guide_profile JSON) · `users` + `memberships` (role: admin|owner|staff|partner) · `funnels` (workspace_id, slug, segment, offer, storybrand JSON, status) · `funnel_variants` (headline, traffic_pct) · `form_blocks` + `funnel_blocks` (order, required, enabled, condition JSON) · `intake_sessions` (answers JSON, step, resume_token, utm JSON) · `leads`/`contacts` + `companies` (dedupe on email/domain) · `activities` (type: view|intake_started|intake_completed|note|task|email|call|stage_change) · `stages` · `scoring_rules` (weights JSON per funnel) · `webhook_endpoints` + `webhook_deliveries` · `hubspot_connections` + `sync_log` · `email_log`. Multi-tenant: every table keyed by workspace_id, RLS enforced; CMS section toggles stored per page per workspace.

## Integration Requirements (must be real, not stubbed)
- **Zapier**: outbound POST with stable JSON schema (see payload in Admin integrations view: event, lead{id,name,email,company,funnel,score,tags,utm}, occurred_at); inbound endpoint with token auth; include copy-pasteable field docs for Zap setup.
- **HubSpot**: OAuth app; two-way contact/company/deal sync; configurable field mapping + direction; conflict = latest-wins with CRM authoritative for score/stage; visible sync log with retry/backoff on 429.
- Connector layer = pluggable interface so more tools can be added without refactoring.
- **SendGrid**: transactional templates for intake confirmation + internal new-lead alert.

## Assets
All in `assets/` — client-provided: logo (recolored to #D76C2C), phoenix mark crop, Joshua headshots (jpg photo, png cutout), hero mountain photo (cropped from client comp). White-label means every one of these is replaceable per workspace via the White Label admin view.

## Seed Data
Seed one end-to-end funnel: **Lack of Control** exactly as in `Funnel Landing.dc.html` (copy, blocks, scoring weights, 2 A/B variants), plus the sample contacts/pipeline from `Admin.dc.html` and the Phoenix Operations workspace with Joshua as Admin.

## Additional build notes
- Auth: Supabase Auth (email/password + Google OAuth); partner signup gated by invite code; email verification → onboarding wizard (logo, guide profile, first funnel).
- Emails render with workspace branding (white-label) — templates take logo URL, colors, guide identity as variables.
- Legal drafts require attorney review; wire real controller/processor language per workspace.
- Mobile: the funnel landing page is majority-mobile — build mobile-first per `Mobile Funnel.dc.html`; desktop per `Funnel Landing.dc.html`.
- Billing: Stripe Checkout + customer portal; 14-day trials; plan limits enforced server-side.

## Acceptance checklist (build must match all of these)
Public:
- [ ] Homepage renders all 6 sections; each independently togglable from admin Site Content; copy is "we/us" voice, no first-person Joshua
- [ ] Hero photo bleeds behind right 52% with cream gradient; 5 frustration links route to their funnel pages
- [ ] Guide page renders entirely from the workspace's Guide identity profile (photo/name/title/story swappable per white-label workspace)
- [ ] Results page is link-only: excluded from nav, sitemap, robots (noindex)
- [ ] Funnel pages at /f/[slug]; A/B variant assignment sticky per visitor; UTM + referrer captured and persisted with submission
- [ ] Intake: 5 steps, exact fields/options from Funnel Landing.dc.html; owner-attendance block appears only when role ≠ Owner/Founder and ≠ CEO/President; partial answers resume across sessions; step-3 name+email validation
- [ ] Score computed per the weights in this README (0–100, threshold 70, soft disqualify); tags Coachable/ICP-fit/Hot/Low-fit
- [ ] Scheduler after submit; booked state; confirmation email fires
- [ ] Mobile: funnel pages match Mobile Funnel.dc.html at 390px; all hit targets ≥44px
Admin:
- [ ] All 9 nav views present: Dashboard, Funnels, Contacts (Pipeline), Sequences, Site Content, White Label, Users & Network, Billing, Integrations
- [ ] Pipeline: two seeded pipelines (Prospects, Client journey), drag-and-drop between stages with column highlight, per-column + global Add card, search + stage filters, CSV import/export
- [ ] Funnel Builder: StoryBrand narrative editor, modular intake blocks with required/optional + on/off + condition display, A/B variant list, scoring-weight panel
- [ ] Contact detail: score card with tags, field list, sync status, activity timeline, + Note / + Task
- [ ] Roles enforced: Admin > Owner > Staff > Partner exactly as described; invite flow; partner workspaces with type badge
- [ ] Integrations: 4 Zapier outbound events with documented payload, inbound token endpoint, HubSpot OAuth two-way sync with field mapping/direction/conflict rule/sync log with 429 retry, SendGrid templates per Email Templates.dc.html
- [ ] Billing: 3 Stripe plans, trials, subscriptions table (network admin sees all, partners see own)
- [ ] Auth: login, reset, 3-step partner signup with invite code + practice type + plan
- [ ] Legal pages published (after attorney review) and linked from auth + site footers

## README for the repo
Cover: setup, env vars (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE, SENDGRID_API_KEY, HUBSPOT_CLIENT_ID/SECRET, ZAPIER_INBOUND_TOKEN, NEXT_PUBLIC_SITE_URL), migrations + seed commands, deploy steps for Vercel AND Replit, and Zapier/HubSpot connection walkthroughs.
