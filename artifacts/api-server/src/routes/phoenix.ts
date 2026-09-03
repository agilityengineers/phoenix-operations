import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { resolveTxt } from "node:dns/promises";
import { Router, type IRouter, type Request, type RequestHandler } from "express";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, phoenixBootstrapTokens, phoenixResetTokens, phoenixUserInvites, phoenixUsers, phoenixWorkspaces } from "@workspace/db";
import { csv, parseCsv, score } from "../lib/phoenix";
import { getPhoenixStore, mutatePhoenixStore, PhoenixStore, WORKSPACE_ID, type Answers } from "../lib/phoenix-store";
import { bootstrapTokenHash } from "../lib/phoenix-bootstrap";

const router: IRouter = Router();
const scryptAsync = promisify(scrypt);
const hits = new Map<string, { count: number; start: number }>();
const body = (req: Request) => req.body as Record<string, unknown>;
const invalid = (res: any) => res.status(400).json({ error: "invalid_json" });
const siteUrl = (req: Request) => process.env.SITE_URL ?? `${req.protocol}://${req.get("host")}`;
const limited = (req: Request, bucket: string, max: number) => { const key = `${bucket}:${req.ip}`, old = hits.get(key), now = Date.now(), value = !old || now - old.start > 60_000 ? { count: 0, start: now } : old; value.count++; hits.set(key, value); return value.count > max; };
const signature = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("base64url");
type Session = { userId: string; workspaceId: string; email: string; role: string; exp: number };
const session = (req: Request): Session | null => {
  const secret = process.env.SESSION_SECRET, [value, supplied] = String(req.cookies?.po_session ?? "").split(".");
  if (!secret || !value || !supplied) return null;
  const expected = Buffer.from(signature(value, secret)), actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try { const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Session; return parsed.userId && parsed.workspaceId && parsed.exp > Date.now() ? parsed : null; } catch { return null; }
};
const setSession = (res: any, user: { id: string; email: string; workspaceId: string; role: string }) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const value = Buffer.from(JSON.stringify({ userId: user.id, email: user.email, workspaceId: user.workspaceId, role: user.role, exp: Date.now() + 86_400_000 })).toString("base64url");
  res.cookie("po_session", `${value}.${signature(value, secret)}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 86_400_000, path: "/" });
  return true;
};
const hashPassword = async (password: string, salt = randomBytes(16).toString("base64url")) => ({ salt, hash: (await scryptAsync(password, salt, 64) as Buffer).toString("base64url") });
const passwordMatches = async (password: string, salt: string, hash: string) => { const derived = Buffer.from((await scryptAsync(password, salt, 64) as Buffer).toString("base64url")); const saved = Buffer.from(hash); return derived.length === saved.length && timingSafeEqual(derived, saved); };
const adminOnly: RequestHandler = async (req, res, next) => { const signed = session(req); if (!process.env.SESSION_SECRET) return res.status(503).json({ error: "admin_api_disabled" }); if (!signed) return res.status(401).json({ error: "unauthorized" }); const [user] = await db.select().from(phoenixUsers).where(eq(phoenixUsers.id, signed.userId)).limit(1); if (!user || user.workspaceId !== signed.workspaceId) return res.status(401).json({ error: "unauthorized" }); (req as Request & { phoenixSession: Session }).phoenixSession = { ...signed, email: user.email, role: user.role }; next(); };
const identity = (req: Request) => (req as Request & { phoenixSession: Session }).phoenixSession;
const slug = (value: unknown) => typeof value === "string" && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value) ? value : null;
const customHost = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/\.$/, "").split(":")[0];
  const reserved = /(^|\.)(replit\.app|replit\.dev|repl\.co|replitusercontent\.com|phoenixoperations\.com)$/.test(normalized);
  const publicSuffixOnly = /^(com|org|net|edu|gov|io|co|app|dev|co\.uk)$/.test(normalized);
  return !reserved && !publicSuffixOnly && normalized !== "localhost" && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized) && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized) ? normalized : null;
};
const publicWorkspace = async (req: Request) => {
  const host = (req.get("host") ?? "").split(":")[0].toLowerCase();
  if (host) { const [custom] = await db.select().from(phoenixWorkspaces).where(and(eq(phoenixWorkspaces.customDomain, host), eq(phoenixWorkspaces.isPublic, true))).limit(1); if (custom) return custom; }
  const platformHost = host === "localhost" || host === "127.0.0.1" || host.endsWith(".replit.dev") || host.endsWith(".replit.app") || host.endsWith(".repl.co") || host.endsWith(".replitusercontent.com");
  const hostSlug = !platformHost && host.split(".").length > 2 ? slug(host.split(".")[0]) : null;
  const requested = slug(req.query.workspace) ?? hostSlug ?? "phoenix";
  if (!requested) return null;
  if (requested === "phoenix") await getPhoenixStore(WORKSPACE_ID, true);
  const [row] = await db.select().from(phoenixWorkspaces).where(and(eq(phoenixWorkspaces.slug, requested), eq(phoenixWorkspaces.isPublic, true))).limit(1);
  return row ?? null;
};
const publicStore = async (req: Request) => { const row = await publicWorkspace(req); if (!row) throw new Error("public_workspace_unavailable"); const store = await getPhoenixStore(row.id); if (!store) throw new Error("public_workspace_unavailable"); return { id: row.id, store }; };
const tenantStore = async (req: Request) => { const store = await getPhoenixStore(identity(req).workspaceId); if (!store) throw new Error("workspace_not_found"); return store; };
const requireRole = (...roles: string[]): RequestHandler => (req, res, next) => roles.includes(identity(req).role) ? next() : res.status(403).json({ error: "forbidden" });
const normalizedOrigin = (value: string) => { try { const url = new URL(value); return `${url.protocol}//${url.host.toLowerCase()}`; } catch { return null; } };
const csrfOrigin: RequestHandler = (req, res, next) => {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (!origin && !req.get("sec-fetch-site") && !req.get("sec-fetch-mode")) return next();
  const forwarded = req.get("forwarded"), forwardedHost = forwarded?.match(/(?:^|;)\s*host="?([^;,"]+)/i)?.[1], forwardedProto = forwarded?.match(/(?:^|;)\s*proto="?([^;,"]+)/i)?.[1];
  const scheme = (forwardedProto ?? req.get("x-forwarded-proto")?.split(",")[0] ?? req.protocol).trim();
  const host = (forwardedHost ?? req.get("x-forwarded-host")?.split(",")[0] ?? req.get("host") ?? "").trim();
  const expected = normalizedOrigin(`${scheme}://${host}`);
  if (!origin || !expected || normalizedOrigin(origin) !== expected) return res.status(403).json({ error: "csrf_origin_mismatch" });
  next();
};

router.get("/auth/bootstrap/status", async (_req, res) => {
  const [owner] = await db.select({ id: phoenixUsers.id }).from(phoenixUsers).where(and(eq(phoenixUsers.workspaceId, WORKSPACE_ID), sql`${phoenixUsers.role} IN ('owner', 'admin')`)).limit(1);
  res.json({ bootstrapRequired: !owner });
});
router.post("/auth/bootstrap", async (req, res) => {
  if (limited(req, "bootstrap", 5)) return res.status(429).json({ error: "rate_limited" });
  if (!process.env.SESSION_SECRET) return res.status(503).json({ error: "auth_unavailable" });
  const b = body(req), token = String(b.token ?? ""), name = String(b.name ?? "").trim(), email = String(b.email ?? "").trim().toLowerCase(), password = String(b.password ?? "");
  if (!token || !name || !/.+@.+\..+/.test(email) || password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) return res.status(400).json({ error: "validation_failed" });
  const tokenHash = bootstrapTokenHash(token), passwordRecord = await hashPassword(password), user = { id: `usr_${randomUUID()}`, email, workspaceId: WORKSPACE_ID, name, role: "owner" };
  try {
    const created = await db.transaction(async tx => {
      await tx.execute(sql`SELECT id FROM phoenix_workspaces WHERE id = ${WORKSPACE_ID} FOR UPDATE`);
      const owner = await tx.execute(sql`SELECT id FROM phoenix_users WHERE workspace_id = ${WORKSPACE_ID} AND role IN ('owner', 'admin') LIMIT 1`);
      if (owner.rows.length) return "already_owned" as const;
      const locked = await tx.execute(sql`SELECT id FROM phoenix_bootstrap_tokens WHERE token_hash = ${tokenHash} AND workspace_id = ${WORKSPACE_ID} AND consumed_at IS NULL AND expires_at > now() FOR UPDATE`);
      const record = locked.rows[0] as { id: string } | undefined;
      if (!record) return "invalid_token" as const;
      await tx.insert(phoenixUsers).values({ ...user, passwordHash: passwordRecord.hash, passwordSalt: passwordRecord.salt });
      await tx.update(phoenixBootstrapTokens).set({ consumedAt: new Date() }).where(eq(phoenixBootstrapTokens.id, record.id));
      return "created" as const;
    });
    if (created === "already_owned") return res.status(409).json({ error: "bootstrap_not_required" });
    if (created === "invalid_token") return res.status(400).json({ error: "invalid_or_expired_token" });
    setSession(res, user);
    res.status(201).json({ user: { email, name, role: "owner" } });
  } catch (err) {
    if ((err as { code?: string }).code === "23505") return res.status(409).json({ error: "email_taken" });
    throw err;
  }
});

router.post("/auth/signup", async (req, res) => {
  const b = body(req), email = String(b.email ?? "").trim().toLowerCase(), password = String(b.password ?? "");
  if (!String(b.name ?? "").trim() || !/.+@.+\..+/.test(email) || password.length < 8) return res.status(400).json({ error: "validation_failed" });
  if (!process.env.SESSION_SECRET) return res.status(503).json({ error: "auth_unavailable" });
  const [existing] = await db.select({ id: phoenixUsers.id }).from(phoenixUsers).where(eq(phoenixUsers.email, email)).limit(1);
  if (existing) return res.status(409).json({ error: "email_taken" });
  const requestedSlug = slug(String(b.subdomain ?? "").trim()) ?? slug(String(b.brandName ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")) ?? null, pendingCustomDomain = b.customDomain === undefined ? null : customHost(b.customDomain), domainVerificationToken = pendingCustomDomain ? randomBytes(24).toString("base64url") : null;
  if (b.customDomain !== undefined && !pendingCustomDomain) return res.status(400).json({ error: "invalid_custom_domain" });
  const inviteToken = String(b.inviteToken ?? ""), inviteHash = inviteToken ? createHmac("sha256", process.env.SESSION_SECRET).update(inviteToken).digest("hex") : "";
  const [invite] = inviteToken ? await db.select().from(phoenixUserInvites).where(and(eq(phoenixUserInvites.tokenHash, inviteHash), gt(phoenixUserInvites.expiresAt, new Date()), isNull(phoenixUserInvites.usedAt))).limit(1) : [];
  if (!invite && !requestedSlug) return res.status(400).json({ error: "valid_subdomain_required" });
  if (invite && invite.email !== email) return res.status(403).json({ error: "invite_email_mismatch" });
  const workspaceId = invite?.workspaceId ?? `ws_${randomUUID()}`, template = await getPhoenixStore(WORKSPACE_ID, true), name = String(b.name).trim(), brandName = String(b.brandName ?? "").trim() || name;
  if (!template) throw new Error("public_workspace_unavailable");
  const store = template;
  const workspace = store.getWorkspace(); store.updateWorkspace({ id: workspaceId, name: brandName, domain: String(b.subdomain ?? "").trim() || workspace.domain, type: String(b.practiceType ?? workspace.type), brand: { ...workspace.brand, customDomain: "" }, guide: { ...workspace.guide, name } });
  const passwordRecord = await hashPassword(password), user = { id: `usr_${randomUUID()}`, email, workspaceId, name, role: invite?.role ?? "owner" };
  if (!invite) {
    try { await db.insert(phoenixWorkspaces).values({ id: workspaceId, slug: requestedSlug!, pendingCustomDomain, domainVerificationToken, state: store.snapshot(), isPublic: true }); }
    catch { return res.status(409).json({ error: "subdomain_taken" }); }
  }
  await db.insert(phoenixUsers).values({ ...user, passwordHash: passwordRecord.hash, passwordSalt: passwordRecord.salt });
  if (invite) await db.update(phoenixUserInvites).set({ usedAt: new Date() }).where(eq(phoenixUserInvites.id, invite.id));
  setSession(res, user); res.status(201).json({ user: { email, name, role: user.role }, workspace: { id: workspaceId, name: brandName }, domain: pendingCustomDomain ? { state: "pending", domain: pendingCustomDomain, txtName: `_phoenix-verification.${pendingCustomDomain}`, txtValue: domainVerificationToken } : { state: "none" } });
});
router.post("/auth/login", async (req, res) => {
  const b = body(req), email = String(b.email ?? "").trim().toLowerCase(), password = String(b.password ?? "");
  const [user] = await db.select().from(phoenixUsers).where(eq(phoenixUsers.email, email)).limit(1);
  if (!user || !(await passwordMatches(password, user.passwordSalt, user.passwordHash))) return res.status(401).json({ error: "invalid_credentials" });
  if (!setSession(res, user)) return res.status(503).json({ error: "auth_unavailable" });
  res.json({ user: { email: user.email, name: user.name } });
});
router.get("/auth/session", async (req, res) => { const value = session(req); if (!value) return res.status(401).json({ error: "unauthorized" }); const [user] = await db.select().from(phoenixUsers).where(eq(phoenixUsers.id, value.userId)).limit(1); if (!user || user.workspaceId !== value.workspaceId) return res.status(401).json({ error: "unauthorized" }); res.json({ user: { email: user.email, name: user.name } }); });
router.post("/auth/logout", (_req, res) => res.clearCookie("po_session", { path: "/" }).json({ ok: true }));
router.post("/auth/reset/request", async (req, res) => { if (process.env.NODE_ENV === "production") return res.status(503).json({ error: "recovery_unavailable" }); const email = String(body(req).email ?? "").trim().toLowerCase(), [user] = await db.select().from(phoenixUsers).where(eq(phoenixUsers.email, email)).limit(1); const result: { ok: boolean; resetUrl?: string } = { ok: true }; if (user) { const token = randomBytes(32).toString("base64url"), tokenHash = createHmac("sha256", process.env.SESSION_SECRET ?? "reset").update(token).digest("hex"); await db.insert(phoenixResetTokens).values({ id: `rst_${randomUUID()}`, tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 30 * 60_000) }); result.resetUrl = `${siteUrl(req)}/reset?token=${encodeURIComponent(token)}`; } res.json(result); });
router.post("/auth/reset/confirm", async (req, res) => { const token = String(body(req).token ?? ""), password = String(body(req).password ?? ""); if (!token || password.length < 8) return res.status(400).json({ error: "validation_failed" }); const tokenHash = createHmac("sha256", process.env.SESSION_SECRET ?? "reset").update(token).digest("hex"); const [record] = await db.select().from(phoenixResetTokens).where(and(eq(phoenixResetTokens.tokenHash, tokenHash), gt(phoenixResetTokens.expiresAt, new Date()), isNull(phoenixResetTokens.usedAt))).limit(1); if (!record) return res.status(400).json({ error: "invalid_or_expired_token" }); const passwordRecord = await hashPassword(password); await db.update(phoenixUsers).set({ passwordHash: passwordRecord.hash, passwordSalt: passwordRecord.salt }).where(eq(phoenixUsers.id, record.userId)); await db.update(phoenixResetTokens).set({ usedAt: new Date() }).where(eq(phoenixResetTokens.id, record.id)); res.json({ ok: true }); });

router.get("/public/workspace", async (req, res) => { const value = await publicStore(req); res.json({ workspace: value.store.getWorkspace() }); });
router.get("/public/funnels/:slug", async (req, res) => { const funnel = (await publicStore(req)).store.funnelBySlug(req.params.slug); if (!funnel) return res.status(404).json({ error: "not_found" }); res.json({ funnel }); });
router.get("/public/cms", async (req, res) => res.json({ pages: (await publicStore(req)).store.listCms() }));
router.use(["/workspace", "/members", "/cms", "/funnels", "/contacts", "/pipelines", "/activities", "/sequences", "/webhooks", "/sync-log", "/subscriptions", "/partners"], adminOnly);
router.use(["/workspace", "/members", "/cms", "/funnels", "/contacts", "/pipelines", "/activities", "/sequences", "/webhooks", "/sync-log", "/subscriptions", "/partners"], csrfOrigin);
router.use(["/workspace", "/members"], requireRole("owner", "admin"));
router.use(["/webhooks", "/subscriptions"], requireRole("owner", "admin"));
router.use("/partners", requireRole("platform_admin"));
router.get("/workspace", async (req, res) => res.json({ workspace: (await tenantStore(req)).getWorkspace() }));
router.get("/workspace/domain-status", async (req, res) => { const [row] = await db.select({ customDomain: phoenixWorkspaces.customDomain, pendingCustomDomain: phoenixWorkspaces.pendingCustomDomain, token: phoenixWorkspaces.domainVerificationToken, verifiedAt: phoenixWorkspaces.customDomainVerifiedAt }).from(phoenixWorkspaces).where(eq(phoenixWorkspaces.id, identity(req).workspaceId)).limit(1); if (!row) return res.status(404).json({ error: "workspace_not_found" }); res.json({ state: row.pendingCustomDomain ? "pending" : row.customDomain ? "verified" : "none", domain: row.pendingCustomDomain ?? row.customDomain, verifiedAt: row.verifiedAt, ...(row.pendingCustomDomain && row.token ? { txtName: `_phoenix-verification.${row.pendingCustomDomain}`, txtValue: row.token } : {}) }); });
router.post("/workspace/domain-verify", async (req, res) => { const workspaceId = identity(req).workspaceId, [row] = await db.select({ domain: phoenixWorkspaces.pendingCustomDomain, token: phoenixWorkspaces.domainVerificationToken }).from(phoenixWorkspaces).where(eq(phoenixWorkspaces.id, workspaceId)).limit(1); if (!row?.domain || !row.token) return res.status(400).json({ error: "no_pending_domain" }); let records: string[][]; try { records = await resolveTxt(`_phoenix-verification.${row.domain}`); } catch { return res.status(422).json({ error: "dns_verification_not_found", txtName: `_phoenix-verification.${row.domain}`, txtValue: row.token }); } if (!records.some(parts => parts.join("") === row.token)) return res.status(422).json({ error: "dns_verification_mismatch", txtName: `_phoenix-verification.${row.domain}`, txtValue: row.token }); try { const verifiedAt = new Date(), workspace = await db.transaction(async tx => { const locked = await tx.execute(sql`SELECT state, pending_custom_domain, domain_verification_token FROM phoenix_workspaces WHERE id = ${workspaceId} FOR UPDATE`), current = locked.rows[0] as { state: Record<string, unknown>; pending_custom_domain: string | null; domain_verification_token: string | null } | undefined; if (!current || current.pending_custom_domain !== row.domain || current.domain_verification_token !== row.token) throw new Error("domain_changed"); const store = new PhoenixStore(current.state), ws = store.getWorkspace(); store.updateWorkspace({ domain: row.domain, brand: { ...ws.brand, customDomain: row.domain } }); await tx.update(phoenixWorkspaces).set({ state: store.snapshot(), customDomain: row.domain, pendingCustomDomain: null, domainVerificationToken: null, customDomainVerifiedAt: verifiedAt, updatedAt: verifiedAt }).where(eq(phoenixWorkspaces.id, workspaceId)); return store.getWorkspace(); }); res.json({ state: "verified", domain: row.domain, verifiedAt, workspace }); } catch (err) { if ((err as { code?: string }).code === "23505") return res.status(409).json({ error: "domain_taken" }); if ((err as Error).message === "domain_changed") return res.status(409).json({ error: "domain_changed" }); throw err; } });
router.get("/members", async (req, res) => res.json({ members: (await tenantStore(req)).listMembers() }));
router.get("/funnels", async (req, res) => res.json({ funnels: (await tenantStore(req)).listFunnels() }));
router.get("/funnels/:id", async (req, res) => { const funnel = (await tenantStore(req)).funnelById(req.params.id); if (!funnel) return res.status(404).json({ error: "not_found" }); res.json({ funnel }); });
router.get("/pipelines", async (req, res) => res.json({ pipelines: (await tenantStore(req)).listPipelines() }));
router.get("/contacts", async (req, res) => res.json({ contacts: (await tenantStore(req)).listContacts() }));
router.get("/contacts/export", async (req, res) => { const pipeline = typeof req.query.pipeline === "string" ? req.query.pipeline : undefined, store = await tenantStore(req), rows = store.listContacts().filter(c => !pipeline || c.pipelineId === pipeline).map(({ name, company, email, phone, role, pipelineId, score, funnel, source, owner, createdAt }) => ({ name, company, email, phone, role, pipeline: pipelineId, score, funnel, source, owner, created_at: createdAt })); res.type("text/csv").attachment(`contacts-${pipeline ?? "all"}.csv`).send(csv(rows)); });
router.get("/contacts/:id", async (req, res) => { const contact = (await tenantStore(req)).contact(req.params.id); if (!contact) return res.status(404).json({ error: "not_found" }); res.json({ contact }); });
router.get("/contacts/:id/activities", async (req, res) => res.json({ activities: (await tenantStore(req)).activitiesFor(req.params.id) }));
router.get("/cms", async (req, res) => res.json({ pages: (await tenantStore(req)).listCms() }));
router.get("/sequences", async (req, res) => res.json({ sequences: (await tenantStore(req)).listSequences() }));
router.get("/webhooks", async (req, res) => res.json({ webhooks: (await tenantStore(req)).listWebhooks() }));
router.get("/sync-log", async (req, res) => res.json({ entries: (await tenantStore(req)).listSyncLog() }));
router.get("/subscriptions", async (req, res) => res.json({ subscriptions: (await tenantStore(req)).listSubscriptions() }));
router.get("/partners", async (req, res) => res.json({ workspaces: (await tenantStore(req)).listPartners() }));

router.patch("/workspace", async (req, res) => { if (!req.body || typeof req.body !== "object") return invalid(res); const b = body(req), pending = b.customDomain === null ? null : b.customDomain !== undefined ? customHost(b.customDomain) : undefined; if (b.customDomain !== undefined && pending === null && b.customDomain !== null) return res.status(400).json({ error: "invalid_custom_domain" }); const token = pending ? randomBytes(24).toString("base64url") : null; const workspace = await mutatePhoenixStore(identity(req).workspaceId, store => { const current = store.getWorkspace(); return store.updateWorkspace({ ...(b.domain ? { domain: b.domain } : {}), brand: { ...current.brand, ...((b.brand as object) ?? {}), ...(pending !== undefined ? { customDomain: "" } : {}) }, guide: { ...current.guide, ...((b.guide as object) ?? {}) } }); }, pending !== undefined ? { customDomain: null, pendingCustomDomain: pending, domainVerificationToken: token, customDomainVerifiedAt: null } : {}); res.json({ workspace, ...(pending ? { domain: { state: "pending", domain: pending, txtName: `_phoenix-verification.${pending}`, txtValue: token } } : pending === null ? { domain: { state: "none" } } : {}) }); });
router.post("/members/invite", async (req, res) => { const email = String(body(req).email ?? "").trim().toLowerCase(), role = ["admin", "owner", "staff", "partner"].includes(String(body(req).role)) ? String(body(req).role) : "staff"; if (!/.+@.+\..+/.test(email)) return res.status(400).json({ error: "invalid_email" }); const token = randomBytes(32).toString("base64url"), tokenHash = createHmac("sha256", process.env.SESSION_SECRET ?? "invite").update(token).digest("hex"); await db.insert(phoenixUserInvites).values({ id: `inv_${randomUUID()}`, tokenHash, workspaceId: identity(req).workspaceId, email, role, expiresAt: new Date(Date.now() + 7 * 86400_000) }); const member = await mutatePhoenixStore(identity(req).workspaceId, store => store.invite(email, role)); res.json({ member, ...(process.env.NODE_ENV !== "production" ? { inviteToken: token } : {}) }); });
router.post("/cms/toggle", async (req, res) => { const b = body(req); if (!b.pageId || !b.sectionId) return res.status(400).json({ error: "missing_fields" }); await mutatePhoenixStore(identity(req).workspaceId, store => store.toggle(String(b.pageId), String(b.sectionId), Boolean(b.enabled))); res.json({ ok: true }); });
router.patch("/funnels/:id", async (req, res) => { const b = body(req), allowed = ["name", "slug", "segment", "offer", "status", "storybrand", "variants", "blocks", "weights"], funnel = await mutatePhoenixStore(identity(req).workspaceId, store => store.updateFunnel(req.params.id, Object.fromEntries(allowed.filter(k => b[k] !== undefined).map(k => [k, b[k]])))); if (!funnel) return res.status(404).json({ error: "not_found" }); res.json({ funnel }); });
router.post("/funnels/:id", async (req, res) => { if (req.params.id !== "new") return res.status(405).json({ error: "use_patch" }); const b = body(req), funnelSlug = String(b.slug ?? "").replace(/[^a-z0-9-]/g, ""); if (!funnelSlug) return res.status(400).json({ error: "slug_required" }); const funnel = await mutatePhoenixStore(identity(req).workspaceId, store => { if (store.funnelBySlug(funnelSlug)) return null; return store.createFunnel({ ...b, id: undefined, workspaceId: identity(req).workspaceId, name: String(b.name || "New funnel"), slug: funnelSlug, status: "draft", variants: Array.isArray(b.variants) && b.variants.length ? b.variants : [{ id: "A", label: "A", headline: "", trafficPct: 100 }], stats: { visits: 0, leads: 0, cvr: "—" } }); }); if (!funnel) return res.status(409).json({ error: "slug_taken" }); res.json({ funnel }); });

router.post("/intake/session", async (req, res) => { if (limited(req, "session", 60)) return res.status(429).json({ error: "rate_limited" }); const b = body(req), funnelSlug = String(b.funnelSlug ?? ""), token = b.resumeToken, tenant = await publicWorkspace(req); if (!tenant || !funnelSlug || typeof token !== "string" || token.length > 128) return res.status(400).json({ error: "missing_fields" }); const saved = await mutatePhoenixStore(tenant.id, store => { if (!store.funnelBySlug(funnelSlug)) return null; const previous = store.session(token) as Record<string, unknown> | null; return store.saveSession({ id: token, workspaceId: tenant.id, funnelSlug, variant: String(b.variant ?? "A"), resumeToken: token, step: Math.min(5, Math.max(1, Number(b.step ?? 1))), answers: b.answers ?? {}, utm: b.utm ?? {}, submitted: Boolean(previous?.submitted) }); }); if (!saved) return res.status(404).json({ error: "unknown_funnel" }); res.json({ ok: true, updatedAt: saved.updatedAt }); });
router.get("/intake/session", async (req, res) => { const token = String(req.query.token ?? ""), tenant = await publicWorkspace(req); if (!token || !tenant) return res.status(400).json({ error: "missing_token" }); const store = await getPhoenixStore(tenant.id), saved = store?.session(token); if (!saved) return res.status(404).json({ error: "not_found" }); res.json({ session: saved }); });
router.post("/intake/submit", async (req, res) => { if (limited(req, "submit", 10)) return res.status(429).json({ error: "rate_limited" }); const b = body(req); if (String(b.website ?? "").trim()) return res.json({ ok: true }); const answers = (b.answers ?? {}) as Answers, name = String(answers.name ?? "").trim(), email = String(answers.email ?? "").trim(), resumeToken = typeof b.resumeToken === "string" ? b.resumeToken : "", tenant = await publicWorkspace(req); if (!tenant || !b.funnelSlug || !resumeToken || resumeToken.length > 128 || !name || !/.+@.+\..+/.test(email)) return res.status(400).json({ error: "validation_failed" }); const value = score(answers), utm = (b.utm ?? {}) as Record<string, string | undefined>, source = utm.utm_source ? `${utm.utm_source} / ${utm.utm_medium ?? "direct"}` : utm.referrer ? "referral" : "direct", bookingToken = randomBytes(32).toString("base64url"), bookingTokenHash = createHmac("sha256", process.env.SESSION_SECRET ?? "booking").update(bookingToken).digest("hex"); const contact = await mutatePhoenixStore(tenant.id, store => { const funnel = store.funnelBySlug(String(b.funnelSlug)); if (!funnel) return null; const existing = store.listContacts().find(c => c.email.toLowerCase() === email.toLowerCase()), saved = existing ? store.updateContact(existing.id, { score: value, answers, utm })! : store.createContact({ workspaceId: tenant.id, pipelineId: "prospects", name, company: String(answers.company ?? "").trim() || "—", role: String(answers.role ?? "—"), email, phone: answers.phone ? String(answers.phone) : undefined, funnel: funnel.name, source, score: value, stage: 0, position: 0, owner: "—", answers, utm }); store.saveSession({ id: resumeToken, workspaceId: tenant.id, funnelSlug: b.funnelSlug, variant: String(b.variant ?? "A"), resumeToken, step: 5, answers, utm, submitted: true, bookingTokenHash, bookingContactId: saved.id, bookingExpiresAt: new Date(Date.now() + 30 * 60_000).toISOString() }); store.addActivity({ workspaceId: tenant.id, contactId: saved.id, type: "intake_completed", title: `Intake completed — scored ${value}`, body: "" }); return saved; }); if (!contact) return res.status(404).json({ error: "unknown_funnel" }); res.json({ ok: true, bookingToken, score: value }); });

router.post("/intake/book", async (req, res) => { if (limited(req, "book", 10)) return res.status(429).json({ error: "rate_limited" }); const b = body(req), slot = String(b.slot ?? ""), resumeToken = typeof b.resumeToken === "string" ? b.resumeToken : "", bookingToken = typeof b.bookingToken === "string" ? b.bookingToken : "", tenant = await publicWorkspace(req); if (!tenant || !slot || slot.length > 64 || !resumeToken || !bookingToken) return res.status(400).json({ error: "missing_fields" }); const booked = await mutatePhoenixStore(tenant.id, store => { const saved = store.session(resumeToken) as Record<string, unknown> | null, hash = String(saved?.bookingTokenHash ?? ""), supplied = createHmac("sha256", process.env.SESSION_SECRET ?? "booking").update(bookingToken).digest("hex"), expected = Buffer.from(hash), actual = Buffer.from(supplied); if (!saved?.submitted || !hash || !saved.bookingExpiresAt || new Date(String(saved.bookingExpiresAt)).getTime() <= Date.now() || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false; const contact = store.contact(String(saved.bookingContactId ?? "")); if (!contact) return false; const stage = (store.listPipelines().find(p => p.id === contact.pipelineId)?.stages ?? []).indexOf("Call scheduled"); store.updateContact(contact.id, { bookedSlot: slot, ...(stage >= 0 ? { stage } : {}) }); store.saveSession({ ...saved, resumeToken, bookingTokenHash: "", bookingContactId: "", bookingExpiresAt: "", bookingConsumedAt: new Date().toISOString() }); store.addActivity({ workspaceId: tenant.id, contactId: contact.id, type: "call", title: "Call booked", body: `${slot} Eastern · 15 minutes` }); return true; }); if (!booked) return res.status(403).json({ error: "invalid_booking_capability" }); res.json({ ok: true }); });
const contactInput = (store: NonNullable<Awaited<ReturnType<typeof getPhoenixStore>>>, b: Record<string, unknown>, workspaceId: string, defaults: { pipelineId?: string; source?: string; funnel?: string } = {}) => {
  const name = String(b.name ?? "").trim();
  if (!name) return null;
  const pipelineId = store.listPipelines().some(p => p.id === b.pipelineId) ? String(b.pipelineId) : (defaults.pipelineId ?? "prospects");
  const pipeline = store.listPipelines().find(p => p.id === pipelineId);
  const requestedStage = typeof b.stage === "string" ? pipeline?.stages.indexOf(b.stage) ?? -1 : Number(b.stage ?? 0);
  const stage = Number.isInteger(requestedStage) && requestedStage >= 0 && requestedStage < (pipeline?.stages.length ?? 0) ? requestedStage : 0;
  const suppliedEmail = String(b.email ?? "").trim();
  if (suppliedEmail && suppliedEmail !== "—" && !/.+@.+\..+/.test(suppliedEmail)) return null;
  const requestedScore = Number(b.score ?? 50);
  return {
    workspaceId, pipelineId, name, company: String(b.company ?? "").trim() || "—",
    role: String(b.role ?? "").trim() || "—", email: suppliedEmail || "—",
    ...(b.phone !== undefined ? { phone: String(b.phone).trim() || undefined } : {}),
    funnel: String(b.funnel ?? "").trim() || defaults.funnel || "Manual",
    source: String(b.source ?? "").trim() || defaults.source || "manual",
    score: Number.isFinite(requestedScore) ? Math.max(0, Math.min(100, requestedScore)) : 50,
    stage, position: Number.isFinite(Number(b.position)) ? Number(b.position) : 0,
    owner: String(b.owner ?? "").trim() || "—",
  };
};
router.post("/contacts", async (req, res) => { const b = body(req), workspaceId = identity(req).workspaceId; const contact = await mutatePhoenixStore(workspaceId, store => { const values = contactInput(store, b, workspaceId); return values ? store.createContact(values) : null; }); if (!contact) return res.status(400).json({ error: "validation_failed" }); res.json({ contact }); });
router.patch("/contacts/:id", async (req, res) => { const b = body(req), contact = await mutatePhoenixStore(identity(req).workspaceId, store => store.updateContact(req.params.id, { ...(b.stage !== undefined ? { stage: Number(b.stage) } : {}), ...(b.pipelineId ? { pipelineId: String(b.pipelineId) } : {}), ...(b.owner ? { owner: String(b.owner) } : {}), ...(b.name ? { name: String(b.name) } : {}) })); if (!contact) return res.status(404).json({ error: "not_found" }); res.json({ contact }); });
router.post("/contacts/:id/activity", async (req, res) => { const b = body(req), text = String(b.body ?? "").slice(0, 2000); if (!text) return res.status(400).json({ error: "body_required" }); const workspaceId = identity(req).workspaceId, activity = await mutatePhoenixStore(workspaceId, store => store.contact(req.params.id) ? store.addActivity({ workspaceId, contactId: req.params.id, type: b.type === "task" ? "task" : "note", title: String(b.title ?? "Note added"), body: text }) : null); if (!activity) return res.status(404).json({ error: "not_found" }); res.json({ activity }); });
router.post("/contacts/import", async (req, res) => { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk)); const rows = parseCsv(Buffer.concat(chunks).toString("utf8")); if (!rows.length) return res.status(400).json({ error: "empty_csv" }); const workspaceId = identity(req).workspaceId, contacts = await mutatePhoenixStore(workspaceId, store => rows.slice(0, 500).flatMap(row => { const values = contactInput(store, row, workspaceId, { source: "csv import", funnel: "Import" }); return values ? [store.createContact(values)] : []; })); res.json({ contacts }); });

export default router;