# Phoenix Operations — Marketing Site, Funnel System & Mini CRM

A white-label-ready platform for Phoenix Operations (an EOS® coaching practice): a public
marketing site, an audience-segmented funnel system with a 5-step qualifying intake, and an
admin app with a mini CRM (kanban pipelines), site-content CMS, white-label branding,
users & partner network, billing, and integrations (Zapier, HubSpot, SendGrid, Stripe).

Built with **Next.js (App Router) + React + TypeScript**, **Postgres via Supabase**
(auth + RLS), deployable on **Vercel and Replit**.

> Design source of truth: the `.dc.html` prototypes in [`design/`](design/) — this app
> recreates them 1:1 (colors, type, spacing, copy). See [`design/README.md`](design/README.md).

---

## Quick start (zero config)

```bash
npm install
npm run dev
```

Open http://localhost:3000. **With no env vars set, the app runs in demo mode**: an
in-memory store seeded with the Phoenix Operations workspace, the five funnels (Lack of
Control fully live), the sample pipeline contacts, and an open `/admin` (a banner reminds
you it's demo mode). Every feature works — intake, scoring, kanban drag-and-drop, CMS
toggles — data just resets on restart.

### Key routes

| Route | What it is |
| --- | --- |
| `/` | Homepage (6 CMS-togglable sections, "we/us" voice) |
| `/guide` | Meet Your Guide — renders from the workspace's Guide identity profile |
| `/results` | Private link-only EOS results page (`noindex`, excluded from nav/sitemap) |
| `/f/lack-of-control` | Seed funnel: StoryBrand hero + 5-step intake + scheduler |
| `/admin` | Dashboard, Funnels, Contacts (pipeline), Sequences, Site Content, White Label, Users & Network, Billing, Integrations |
| `/login` · `/reset` · `/signup` | Auth + 3-step partner-workspace signup |
| `/legal/privacy` · `/legal/terms` | Legal drafts (attorney review required before launch) |

---

## Environment variables

Copy `.env.example` → `.env.local` and fill in what you use. Everything is optional —
features light up as keys appear; nothing is hardcoded.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for SEO, sitemap, email links |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser auth) |
| `SUPABASE_SERVICE_ROLE` | Supabase service-role key (server data access) |
| `SENDGRID_API_KEY` | Transactional email (confirmation, owner alert, reminders) |
| `SENDGRID_FROM_EMAIL` | Verified sender |
| `OWNER_NOTIFICATION_EMAIL` | Internal new-lead notifications |
| `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET` | HubSpot OAuth app (two-way sync) |
| `ZAPIER_INBOUND_TOKEN` | Shared token for `POST /api/webhooks/zapier/inbound` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Plans, trials, webhook |
| `STRIPE_PRICE_SOLO` / `STRIPE_PRICE_PRACTICE` / `STRIPE_PRICE_NETWORK` | Price IDs for the 3 plans |

---

## Database (Supabase)

1. Create a project at [supabase.com](https://supabase.com), grab the URL + keys.
2. Apply the schema and seed:

   ```bash
   # with the Supabase CLI linked to your project
   supabase db push                                  # applies supabase/migrations/0001_init.sql
   supabase db execute --file supabase/seed.sql      # Phoenix workspace + Lack of Control funnel + sample CRM
   ```

   (Or paste both files into the Supabase SQL editor, migration first.)

3. Set the three Supabase env vars. The app switches from the demo store to Postgres
   automatically, and `/admin` starts requiring a signed-in user.

**Multi-tenancy & RLS**: every table is keyed by `workspace_id`. API routes use the
service role; direct client access is protected by RLS policies that only pass for
active members of the workspace (`members.user_id = auth.uid()`). HubSpot tokens are
further restricted to admin/owner roles.

**Auth**: Supabase Auth with email/password + Google OAuth. Partner signup (`/signup`)
is gated by an invite code and records practice type + plan in user metadata; email
verification leads into onboarding.

---

## Deploying

### Vercel

1. Import the repo at vercel.com → framework auto-detects Next.js.
2. Add the env vars above (at minimum `NEXT_PUBLIC_SITE_URL` = your production URL).
3. Deploy. Set your custom domain; update `NEXT_PUBLIC_SITE_URL` to match.
4. Point the Stripe webhook at `https://<domain>/api/webhooks/stripe` and the HubSpot
   redirect URL at `https://<domain>/api/integrations/hubspot/callback`.

### Replit

1. Create a Repl → *Import from GitHub* → `agilityengineers/phoenix-operations`.
2. Run command: `npm run dev` (development) or `npm run build && npm run start -- -p 3000`
   (production). The dev server already allows `*.replit.dev` origins.
3. Add the env vars in the Repl's *Secrets* tab.
4. With no secrets set it runs in demo mode — useful for content/design review.

---

## Integration walkthroughs

### Zapier

**Outbound (this app → your Zaps).** Four events fire with a stable JSON schema:

`lead.created` · `intake.completed` · `lead.qualified` (score ≥ 70) · `stage.changed`

```json
{
  "event": "lead.qualified",
  "lead": {
    "id": "ld_8x2k",
    "name": "Marcus Webb",
    "email": "marcus@webbmech.com",
    "company": "Webb Mechanical",
    "funnel": "lack-of-control",
    "score": 88,
    "tags": ["coachable", "icp-fit", "hot"],
    "utm": { "source": "google", "medium": "cpc", "campaign": "founders-q3" }
  },
  "occurred_at": "2026-09-01T13:14:02Z"
}
```

Zap setup: create a *Webhooks by Zapier → Catch Hook* trigger, copy the hook URL into the
event's endpoint (Admin → Integrations), and map fields from `lead.*`.

**Inbound (your Zaps → this app).** `POST /api/webhooks/zapier/inbound` with
`Authorization: Bearer $ZAPIER_INBOUND_TOKEN` (or `?token=`):

```json
{ "action": "update_contact", "email": "marcus@webbmech.com", "fields": { "stage": "Qualified", "owner": "Joshua" } }
{ "action": "add_note", "email": "marcus@webbmech.com", "note": "Replied on LinkedIn" }
```

### HubSpot

1. Create a HubSpot OAuth app (scopes: contacts/companies/deals read+write), set the
   redirect URL to `/api/integrations/hubspot/callback`, and add
   `HUBSPOT_CLIENT_ID`/`HUBSPOT_CLIENT_SECRET`.
2. Admin → Integrations → **Connect** starts the OAuth flow; tokens persist per workspace.
3. Sync behavior: two-way (configurable Push/Pull), **conflict rule: most recent edit wins,
   this CRM is the source of truth for score & stage**. 429 rate limits retry with
   exponential backoff — every push, pull, retry, and failure lands in the visible sync log.
4. Create custom contact properties `po_score`, `po_funnel`, `po_source` in HubSpot to
   receive the mapped fields (see `src/lib/connectors/hubspot.ts` for the field map).

### SendGrid

Verify a sender, set `SENDGRID_API_KEY` + `SENDGRID_FROM_EMAIL` + `OWNER_NOTIFICATION_EMAIL`.
Three templates ship in `src/lib/emails/templates.ts` (600px, table-safe, white-label
branded): intake confirmation (fires on booking), internal new-lead alert (fires on
submission), and the 24h call reminder (wire to a scheduler/cron of your choice).

### Stripe

Create three recurring prices (Solo $79 / Practice $179 / Network $399), set the price ID
env vars + `STRIPE_SECRET_KEY`. Partner signup step 3 creates a Checkout session with a
14-day trial; `POST /api/webhooks/stripe` (verify with `STRIPE_WEBHOOK_SECRET`) tracks the
subscription lifecycle.

---

## How it's put together

```
src/
  app/                 # routes (public site, /f/[slug], /admin/*, auth, /api/*)
  components/          # site / funnel / admin / auth components
  lib/
    seed.ts            # the seeded workspace/funnels/contacts (mirrors supabase/seed.sql)
    scoring.ts         # 0–100 score: ICP 40 · Coachability 25 · Authority 20 · Urgency 15
    store/             # DataStore interface + memory (demo) and Supabase backends
    connectors/        # pluggable integrations: zapier, sendgrid, hubspot (+ registry)
    emails/            # transactional HTML templates (white-label variables)
supabase/
  migrations/0001_init.sql   # schema + RLS
  seed.sql                   # Phoenix workspace, funnels, CRM sample data
design/                # the handoff design prototypes (source of truth)
```

**Scoring** (server-side on submit, threshold 70, soft disqualify — low scores still book):
ICP fit ≤40 (revenue, team size, industry, years) · Authority ≤20 (Owner 20 / CEO 16 /
other-with-owner-joining 10 / else 2) · Coachability ≤25 (two Likerts, "what you've tried",
multi-select breadth, coach history) · Urgency ≤15. Tags: Coachable ≥70, ICP-fit ≥75,
Hot ≥85, otherwise Low-fit.

**A/B variants**: middleware pins a sticky 0–99 roll per visitor per funnel (90-day
cookie); the server maps it through the traffic split so SSR and client agree.

**Intake resume**: answers persist to `localStorage` instantly and to
`intake_sessions` (debounced) with a resume token — returning visitors see
"Welcome back" at their step.

**Spam protection**: honeypot field + per-IP sliding-window rate limits on all public
POST endpoints.

## Conventions

- WCAG AA: semantic landmarks, focus states, ≥44px touch targets on funnel/mobile,
  `aria` on interactive controls.
- SEO: per-page metadata + schema.org JSON-LD, `sitemap.xml` / `robots.txt`
  (both exclude `/results`, which is also `noindex`).
- All third-party keys via env vars — nothing hardcoded.
- Legal pages are drafts and **require attorney review before launch** (the pages say so).
