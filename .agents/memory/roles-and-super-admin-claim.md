---
name: Roles and the super-admin claim
description: How platform-level access is granted and why partner signup never joins the Phoenix workspace.
---

One login belongs to exactly one workspace, and emails are unique platform-wide. `/signup` without an invite creates a *new* workspace whose signer is its `owner`; joining an existing workspace happens only through an invitation link or the one-time claim URL that boot prints while the Phoenix workspace has no `super_admin`.

**Why:** The first production user signed up through "Partner signup" expecting to administer the Phoenix workspace, and nothing could move them there without SQL. The claim route now accepts an existing login (email + current password) and moves it into `ws_phoenix` as `super_admin`.

**How to apply:** Gate routes and screens through the permissions table in `artifacts/api-server/src/lib/phoenix-roles.ts` (mirrored in `artifacts/phoenix-operations/src/lib/roles.ts`), never with ad-hoc role lists. Keep the key-ring rule: roles can only be granted, changed or removed at or below the actor's rank, and never on the actor's own account.
