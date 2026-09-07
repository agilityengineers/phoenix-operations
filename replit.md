# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run test:calendly` — check the Calendly webhook signature verifier and slot formatters (no network, no credentials)
- `pnpm --filter @workspace/scripts run calendly:subscribe` — list Calendly webhook subscriptions; `create --url https://<host>/api/webhooks/calendly` sets one up and prints the signing key, `delete <uuid>` removes one. Needs `CALENDLY_PERSONAL_ACCESS_TOKEN`.
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — signs session cookies and the single-use booking/reset/invite capability tokens. Auth, intake submission and booking all return 503 without it; there is deliberately no fallback, because a guessable secret would make those tokens forgeable.
- Optional env (scheduling): `CALENDLY_PERSONAL_ACCESS_TOKEN`, `CALENDLY_WEBHOOK_SIGNING_KEY`. Without them the funnel still captures and scores leads, and the scheduler shows a "we'll email you" message instead of times. Set both in Replit Secrets, never in the repo.
- Escape hatches, rarely needed: `CALENDLY_API_BASE` (point the client at a stub for local testing) and `CALENDLY_CREATE_INVITEE_PATH` (override the Scheduling API path if the account's API disagrees).

## CI

`.github/workflows/ci.yml` runs install, `typecheck`, `build` and `test:calendly` on every pull
request and on pushes to `main`. It needs no secrets — none of those steps touch Calendly or the
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
  Calendly has no UI for subscriptions, and the signing key is returned **once**, at creation —
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
   `app.listen`, and with no admin account yet `bootstrapTokenHash()` throws without the
   secret — so a missing secret plus no admin means the API does not boot at all, not merely
   that auth is disabled.
2. **`CALENDLY_PERSONAL_ACCESS_TOKEN`** — the webhook signing key cannot be obtained before it.
3. **Deploy**, so `/api/webhooks/calendly` exists to receive deliveries.
4. **Create the first admin.** On boot with no owner/admin, the server writes a one-time
   `/bootstrap?token=…` URL to the *private deployment logs*, valid 60 minutes. Open it at
   `https://<host>/bootstrap?token=…` to create the owner account.
5. **`calendly:subscribe create --url https://<host>/api/webhooks/calendly`**, then paste the
   printed key in as `CALENDLY_WEBHOOK_SIGNING_KEY`. Both Calendly secrets are read per
   request, so no rebuild is needed.
6. **Admin → Integrations**: pick the event type and switch it on. Both are required —
   `schedulingLive` needs the token *and* `enabled` *and* `eventTypeUri`.

## Gotchas

- The seeded workspace is inserted with `onConflictDoNothing()`, so editing the seed defaults
  changes nothing for a workspace that already exists. Correcting live values (the site domain,
  say) has to happen through the admin UI, not a deploy.
- Saving White Label only sends `customDomain` when it actually changed. Sending it at all makes
  `PATCH /workspace` restart DNS verification and clear the verified state, so an unrelated edit
  would silently un-verify a working custom domain.
- `PhoenixStore.snapshot()` enumerates its fields explicitly, so a new top-level key on the
  store will not persist unless it's added there. Scheduling config sidesteps this by living
  inside the `workspace` record.
- On API startup, the default `ws_phoenix` workspace is created idempotently. If it has no owner/admin, the server invalidates older bootstrap tokens, creates a one-time 60-minute token, and writes its `/bootstrap?token=...` URL once to private deployment logs. The public bootstrap status endpoint exposes only whether provisioning is required; it never exposes the token.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
