---
name: Auth session cache compatibility
description: Prevent stale authentication response shapes from crashing protected layouts.
---

Authentication session responses must use `Cache-Control: no-store`, and clients must request them with caching disabled. When a session shape gains a collection, normalize a missing value to an empty collection before rendering.

**Why:** A browser reused an older session payload after the response gained a workspace-memberships array. The protected admin layout read the new array directly and crashed after a successful login.

**How to apply:** Treat session payloads as security-sensitive live state, and make protected layouts tolerant of one-version-old optional collection fields during deployments and hot reloads.