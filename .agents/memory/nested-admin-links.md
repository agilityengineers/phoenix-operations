---
name: Nested admin links
description: Why links inside the admin shell are written relative to /admin, and how exits leave the nested router.
---

Inside `<Route path="/admin" nest>` (App.tsx), write every `<Link>`, `setLocation`, `<Redirect>` and `useLocation()` comparison relative to that base: `/contacts`, not `/admin/contacts`. Links that leave the admin — View site, View page, the sign-in page — are plain anchors built by `lib/site-links.ts` from Vite's base URL.

**Why:** wouter prefixes the nested router's base onto every non-`~` href and reports the location relative to it. The Next.js-era absolute hrefs survived the migration, so each sidebar item resolved to `/admin/admin/…` and rendered the 404 page while typed URLs still worked. `~/` would stop the doubling but ignores Vite's base, which breaks path-mounted previews.

**How to apply:** Register screens in `pages/admin/routes.tsx` and list them in `AdminNav` together; `routes.test.tsx` renders both at real URLs and fails on any link that does not reach its route. Keep cross-section navigation as full page loads.
