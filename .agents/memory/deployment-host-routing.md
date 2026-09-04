---
name: Deployment host routing
description: How Phoenix distinguishes Replit deployment domains from tenant-owned custom domains.
---

Treat every hostname listed in production `REPLIT_DOMAINS` as a platform host that defaults to the Phoenix workspace. Continue checking verified tenant-owned custom domains first.

**Why:** A Replit-attached custom domain can look like a tenant subdomain. Interpreting its first DNS label as a workspace slug makes public API requests fail even though the deployment and static assets are healthy.

**How to apply:** When changing tenant resolution, keep verified tenant-domain lookup authoritative, then recognize Replit’s runtime domain list, and only use explicit workspace slugs for shared platform navigation.