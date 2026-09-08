# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run test:calendly` — check the Calendly webhook signature verifier and slot formatters (no network, no credentials)
- `pnpm --filter @workspace/phoenix-operations run test` — admin routing checks: every sidebar item and in-admin link resolves to a registered admin screen, and the highlighted item follows the URL (no browser, no database)
- `pnpm --filter @workspace/scripts run test:admin-access` — release check for super-admin login, invitations and their dead-link statuses, the member directory, the rank rules, and multi-workspace membership. Needs `DATABASE_URL`, `SESSION_SECRET`, a running app (`ADMIN_CHECK_BASE_URL`, default `http://localhost:80`) and `chromium` on `PATH` (set `ADMIN_CHECK_SKIP_BROWSER=1` to skip the rendered-page checks); it creates and cleans up its own throwaway workspaces
- `pnpm --filter @workspace/scripts run calendly:subscribe` — list Calendly webhook subscriptions; `create --url https://<host>/api/webhooks/calendly` sets one up and prints the signing key, `delete <uuid>` removes one. Needs `CALENDLY_PERSONAL_ACCESS_TOKEN`.
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — signs session cookies and the single-use booking/reset/invite capability tokens. Auth, intake submission and booking all return 503 without it; there is deliberately no fallback, because a guessable secret would make those tokens forgeable.
- Optional env (scheduling): `CALENDLY_PERSONAL_ACCESS_TOKEN`, `CALENDLY_WEBHOOK_SIGNING_KEY`. Without them the funnel still captures and scores leads, and the scheduler shows a "we'll email you" message instead of times. Set both in Replit Secrets, never in the repo.
- Escape hatches, rarely needed: `CALENDLY_API_BASE` (point the client at a stub for local testing) and `CALENDLY_CREATE_INVITEE_PATH` (override the Scheduling API path if the account's API disagrees).

## CI

`.github/workflows/ci.yml` runs install, `typecheck`, `build`, `test:calendly` and the admin routing
checks on every pull request and on pushes to `main`. It needs no secrets — none of those steps touch Calendly or the
database — so it is safe on fork pull requests.

**Use pnpm 10 (pinned to 10.15.1).** Not a preference: pnpm 12 fails this workspace with
`ERR_PNPM_IGNORED_BUILDS` over esbuild even though `onlyBuiltDependencies` lists it, and pnpm 9
can't read `overrides` from `pnpm-workspace.yaml` so it fails with
`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. Both were verified against a clean tree. If you upgrade,
check a clean `pnpm install --frozen-lockfile` still exits 0 first.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Scheduling (Calendly)

The funnel's slot grid and the public `/schedule` page render the guide's **real**
Calendly availability and create **real** events on their calendar. There is no Calendly
iframe anywhere — `lib/integrations/calendly` calls the API server-side and the site keeps
its own markup and CSS, so the booking step looks like the rest of the site.

- Availability: `GET /api/public/scheduling/availability` (cached ~60s per tenant/range;
  chunked across Calendly's 7-day-per-request cap).
- Booking from the funnel: `POST /api/intake/book`, still gated by the single-use, 30-minute
  capability token minted at intake submission. It runs in three phases so the tenant's row
  lock is never held across the network call to Calendly, and the token is only spent once
  Calendly has accepted the booking.
- Booking from `/schedule`: `POST /api/public/scheduling/book` — unauthenticated by design,
  defended by honeypot, rate limit and email validation.
- Reconciliation: `POST /api/webhooks/calendly` (`invitee.created`, `invitee.canceled`) is the
  authoritative record — it's what catches cancellations and reschedules. Mounted outside the
  session/CSRF middleware because its authentication *is* the HMAC signature.
- The subscription behind that webhook is created with the `calendly:subscribe` script above.
  Calendly has no UI for subscriptions. For personal-access-token subscriptions, the helper
  generates the signing key, sends it to Calendly during creation, and prints it **once** —
  so get the access token in place first, then run `create`, then paste the key into the vault.
  Re-run `list` after the deployment host changes; a subscription pointing at a dead preview
  URL silently stops reconciling.
- Which event type gets booked is set per workspace in Admin → Integrations. Only non-secret
  scheduling config lives in the workspace record; credentials stay in env vars, because
  `GET /workspace` returns that record wholesale.
- **Calendly plan:** the Scheduling API and webhooks both require a paid Calendly plan. On the
  free tier the integration stays off and the funnel degrades to the "we'll email you" message.

## Go-live order (scheduling)

Two of these hard-fail if done out of order.

1. **`SESSION_SECRET` first.** `index.ts` awaits `ensurePhoenixBootstrap()` *before*
   `app.listen`, and with no super admin yet `bootstrapTokenHash()` throws without the
   secret — so a missing secret plus no super admin means the API does not boot at all, not
   merely that auth is disabled.
2. **`CALENDLY_PERSONAL_ACCESS_TOKEN`** — the webhook signing key cannot be obtained before it.
3. **Deploy**, so `/api/webhooks/calendly` exists to receive deliveries.
4. **Claim the super admin.** On boot with no super admin in the Phoenix workspace, the
   server writes a one-time `/bootstrap?token=…` claim URL to the *private deployment logs*,
   valid 60 minutes. Open it at `https://<host>/bootstrap?token=…`. An email that already
   signs in (a partner signup, say) proves its password; the Phoenix workspace is added to
   that account as super admin and becomes its home, and every other workspace it belongs to
   is kept. A new email creates the account. The first successful claim revokes every
   outstanding link.
5. **`calendly:subscribe create --url https://<host>/api/webhooks/calendly`**, then paste the
   printed key in as `CALENDLY_WEBHOOK_SIGNING_KEY`. Both Calendly secrets are read per
   request, so no rebuild is needed.
6. **Admin → Integrations**: pick the event type and switch it on. Both are required —
   `schedulingLive` needs the token *and* `enabled` *and* `eventTypeUri`.

## Roles & permissions

- Hierarchy, top down: `super_admin` → `admin` → `owner` → `staff` → `partner`. A role is held
  per workspace membership, so one account can be super admin in the Phoenix workspace and
  owner of its own partner workspace. The single permissions table lives in
  `artifacts/api-server/src/lib/phoenix-roles.ts`, mirrored for the UI in
  `artifacts/phoenix-operations/src/lib/roles.ts` (change both together). To open a feature to
  admins later, add the role to that feature's row; every route and screen reads it.
- Key-ring rule: you can grant, change or remove only roles at or below your own rank, and
  never your own. Role changes and seat removals (`members.manage`) are super admin and admin
  only; owners invite owners, staff and partners, and can withdraw the invitations they could
  have sent.
- The super-admin seat lives in the Phoenix workspace. It is created only by the claim URL in
  the go-live order above, or by a super admin inviting another. `GET /partners` (super admin
  only) lists every real workspace except `ws_phoenix`, with seat counts.
- "Partner signup" on `/signup` creates a *new* workspace and makes the signer its `owner`; it
  never joins the Phoenix workspace. Joining an existing workspace happens through an
  invitation, or through the claim URL for the super-admin seat.
- The member directory (`GET /members`) is built from `phoenix_memberships` plus open
  invitations in `phoenix_user_invites`; the JSONB workspace state no longer carries members
  or partner workspaces. `PATCH /members/:id` changes a seat's role (or a pending invitation's),
  `DELETE /members/:id` removes a seat or revokes an invitation. Removing a seat never touches
  the person's other workspaces; when it was their home workspace, home moves to the oldest one
  they still belong to, and an account left with no workspace is deleted.

## Workspace membership

One person, one account, many workspaces. `phoenix_users` holds the identity (email
unique) and its **home** workspace; `phoenix_memberships` holds *access* — one row per
(user, workspace) with the role held there. The session cookie names the active
workspace, and every admin request re-reads the role from the membership for that pair,
so a role differs per workspace and a change takes effect on the next request.

- **Accepting an invitation never replaces access.** `POST /auth/signup` mints a new
  identity and refuses a known email with `account_exists`; a returning user signs in and
  calls `POST /auth/invite/accept`, which adds a membership and leaves every other one
  alone. Both paths run inside one transaction that locks the invitation row, so a token
  cannot be spent twice.
- **Choosing where to work.** `POST /auth/login` lands in the home workspace and returns
  the full `workspaces` list; `/workspaces` is the picker, and `POST /auth/workspace`
  re-issues the cookie for another workspace the account already belongs to.
- **Rejections.** Wrong-email, used, expired and revoked invitations all fail closed.
  `GET /auth/invite` classifies a link before the form and, for a live one, also says
  whether the invited address already has an account and whether this browser's session
  is that account — which is how signup knows to send a returning invitee to sign-in.
  Revocation is `POST /members/invite/revoke` or `DELETE /members/<inv_ id>` (anyone who can
  invite, for roles at or below their own), alongside the supersession
  that re-inviting an address already performs; both stamp `revoked_at`, so the old link
  keeps its shape but buys nothing.
- **Backfill.** `ensurePhoenixSchema()` writes a membership for every user's home
  workspace on each boot (idempotent). Until it runs, the home workspace on the user row
  still counts as an implicit membership, so accounts predating the table keep working.
- **Every member can load the admin shell.** `GET /workspace` is open to all roles; changing
  the workspace needs `workspace.manage`, so a staff or partner invitee lands on a working
  dashboard with the management screens hidden.

## Gotchas

- The admin shell is mounted with `<Route path="/admin" nest>`, so wouter resolves every `<Link>`,
  `setLocation`, `<Redirect>` and `useLocation()` value inside it *relative to `/admin`*: write
  `/contacts`, never `/admin/contacts` — that becomes `/admin/admin/contacts` and renders the 404 page,
  which is exactly how the sidebar shipped broken after the Next.js migration (typed URLs worked, clicks
  did not). Screens are registered in `pages/admin/routes.tsx` and listed in `AdminNav`; add to both, and
  `routes.test.tsx` fails on any item that does not reach its route. Links that leave the admin (View
  site, View page, the sign-in page) are plain anchors from `lib/site-links.ts`, because wouter's `~/`
  absolute form ignores Vite's base path.
- The seeded workspace is inserted with `onConflictDoNothing()`, so editing the seed defaults
  changes nothing for a workspace that already exists. Correcting live values (the site domain,
  say) has to happen through the admin UI, not a deploy.
- Saving White Label only sends `customDomain` when it actually changed. Sending it at all makes
  `PATCH /workspace` restart DNS verification and clear the verified state, so an unrelated edit
  would silently un-verify a working custom domain.
- `PhoenixStore.snapshot()` enumerates its fields explicitly, so a new top-level key on the
  store will not persist unless it's added there. Scheduling config sidesteps this by living
  inside the `workspace` record.
- On API startup, the default `ws_phoenix` workspace is created idempotently. If no membership there holds `super_admin`, the server mints a one-time 60-minute claim token and writes its `/bootstrap?token=...` URL once to private deployment logs. Earlier unexpired tokens stay valid, because autoscale can boot several instances and whoever reads the logs may pick any of them; the first successful claim revokes them all. The public bootstrap status endpoint exposes only whether a claim is still open; it never exposes the token.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
