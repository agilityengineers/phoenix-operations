---
name: Nested admin auth redirects
description: Why unauthenticated redirects from the nested admin route use browser location replacement.
---

At the admin session boundary, redirect unauthenticated visitors with a full, base-aware `window.location.replace` rather than Wouter's location setter.

**Why:** Navigation from the nested admin route was observed to leave the rendered page indefinitely on its redirect state even after the session request completed. A browser location replacement committed the route reliably and kept the protected URL out of history.

**How to apply:** Use this for redirects triggered by the admin layout/session gate. Build the destination from Vite's base URL so path-mounted previews and deployments remain valid.