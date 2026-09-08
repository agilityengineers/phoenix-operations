---
name: Roles and the super-admin claim
description: How platform-level access is granted and why partner signup never joins the Phoenix workspace.
---

Roles are held per workspace membership (`phoenix_memberships`), and the super-admin seat lives in the Phoenix workspace. `/signup` without an invite creates a *new* workspace whose signer is its `owner`; an existing workspace is joined only through an invitation, or through the one-time claim URL that boot prints while no membership in `ws_phoenix` holds `super_admin`.

**Why:** The first production user signed up through "Partner signup" expecting to administer the Phoenix workspace, and nothing could get them there without SQL. The claim route now accepts an existing login (email + current password), adds the Phoenix workspace to it as super admin, makes it home, and keeps every other workspace the account belongs to.

**How to apply:** Gate routes and screens through the permissions table in `artifacts/api-server/src/lib/phoenix-roles.ts` (mirrored in `artifacts/phoenix-operations/src/lib/roles.ts`), never with ad-hoc role lists. Keep the key-ring rule: roles can only be granted, changed or removed at or below the actor's rank, and never on the actor's own account. Removing a seat from someone's home workspace must move home elsewhere, because `roleInWorkspace()` falls back to the user row for the home workspace.
