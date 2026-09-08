import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { resolveTxt } from "node:dns/promises";
import { Router, type IRouter, type Request, type RequestHandler } from "express";
import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { db, phoenixBootstrapTokens, phoenixResetTokens, phoenixUserInvites, phoenixUsers, phoenixWorkspaces } from "@workspace/db";
import { availableTimes, bookedSlotLabel, createInvitee, currentUser, isConfigured as calendlyConfigured, isWebhookConfigured, listEventTypes, safeTimeZone, slotDayLabel, slotTimeLabel, timeZoneLabel, weekLabel, zonedDateKey } from "@workspace/calendly";
import { csv, parseCsv, score } from "../lib/phoenix";
import { getPhoenixStore, mutatePhoenixStore, PhoenixStore, WORKSPACE_ID, type Answers } from "../lib/phoenix-store";
import { bootstrapTokenHash } from "../lib/phoenix-bootstrap";
import { sendAdminInvitationEmail } from "../lib/phoenix-email";
import { assignableRoles, can, isRole, outranksOrEquals, rank, type Permission } from "../lib/phoenix-roles";

const router: IRouter = Router();
const scryptAsync = promisify(scrypt);
const hits = new Map<string, { count: number; start: number }>();
const body = (req: Request) => req.body as Record<string, unknown>;
const invalid = (res: any) => res.status(400).json({ error: "invalid_json" });
const siteUrl = (req: Request) => process.env.SITE_URL ?? `${req.protocol}://${req.get("host")}`;
const limited = (req: Request, bucket: string, max: number) => { const key = `${bucket}:${req.ip}`, old = hits.get(key), now = Date.now(), value = !old || now - old.start > 60_000 ? { count: 0, start: now } : old; value.count++; hits.set(key, value); return value.count > max; };
const signature = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("base64url");
/**
 * Server secret for capability tokens (booking, reset, invite). Returns null when
 * unset so callers fail closed with a 503 — never falls back to a literal, which
 * would make every derived token forgeable.
 */
const serverSecret = () => process.env.SESSION_SECRET?.trim() || null;
const capabilityHash = (value: string, secret: string) => createHmac("sha256", secret).update(value).digest("hex");
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
  const reserved = /(^|\.)(replit\.app|replit\.dev|repl\.co|replitusercontent\.com|phoenix-operations\.com|phoenixoperations\.com)$/.test(normalized);
  const publicSuffixOnly = /^(com|org|net|edu|gov|io|co|app|dev|co\.uk)$/.test(normalized);
  return !reserved && !publicSuffixOnly && normalized !== "localhost" && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized) && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized) ? normalized : null;
};
const deploymentHosts = new Set(
  (process.env.REPLIT_DOMAINS ?? "")
    .split(",")
    .map(value => value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0].split(":")[0])
    .filter(Boolean),
);
const publicWorkspace = async (req: Request) => {
  const host = (req.get("host") ?? "").split(":")[0].toLowerCase();
  if (host) { const [custom] = await db.select().from(phoenixWorkspaces).where(and(eq(phoenixWorkspaces.customDomain, host), eq(phoenixWorkspaces.isPublic, true))).limit(1); if (custom) return custom; }
  const platformHost = deploymentHosts.has(host) || host === "localhost" || host === "127.0.0.1" || host.endsWith(".replit.dev") || host.endsWith(".replit.app") || host.endsWith(".repl.co") || host.endsWith(".replitusercontent.com");
  const hostSlug = !platformHost && host.split(".").length > 2 ? slug(host.split(".")[0]) : null;
  const requested = slug(req.query.workspace) ?? hostSlug ?? "phoenix";
  if (!requested) return null;
  if (requested === "phoenix") await getPhoenixStore(WORKSPACE_ID, true);
  const [row] = await db.select().from(phoenixWorkspaces).where(and(eq(phoenixWorkspaces.slug, requested), eq(phoenixWorkspaces.isPublic, true))).limit(1);
  return row ?? null;
};
const publicStore = async (req: Request) => { const row = await publicWorkspace(req); if (!row) throw new Error("public_workspace_unavailable"); const store = await getPhoenixStore(row.id); if (!store) throw new Error("public_workspace_unavailable"); return { id: row.id, store }; };
const tenantStore = async (req: Request) => { const store = await getPhoenixStore(identity(req).workspaceId); if (!store) throw new Error("workspace_not_found"); return store; };
const requirePermission = (permission: Permission): RequestHandler => (req, res, next) => can(identity(req).role, permission) ? next() : res.status(403).json({ error: "forbidden" });
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
  const [superAdmin] = await db.select({ id: phoenixUsers.id }).from(phoenixUsers).where(and(eq(phoenixUsers.workspaceId, WORKSPACE_ID), eq(phoenixUsers.role, "super_admin"))).limit(1);
  res.json({ bootstrapRequired: !superAdmin });
});
/**
 * One-time claim of the Phoenix workspace, opened from the URL that boot prints
 * to the private deployment logs. An email that already signs in proves itself
 * with its current password and is moved into the Phoenix workspace as super
 * admin, wherever it lived before; a new email creates the account. The first
 * successful claim revokes every outstanding claim link.
 */
router.post("/auth/bootstrap", async (req, res) => {
  if (limited(req, "bootstrap", 5)) return res.status(429).json({ error: "rate_limited" });
  if (!process.env.SESSION_SECRET) return res.status(503).json({ error: "auth_unavailable" });
  const b = body(req), token = String(b.token ?? ""), name = String(b.name ?? "").trim(), email = String(b.email ?? "").trim().toLowerCase(), password = String(b.password ?? "");
  if (!token || !/.+@.+\..+/.test(email) || !password) return res.status(400).json({ error: "validation_failed" });
  const tokenHash = bootstrapTokenHash(token);
  const [claimable] = await db.select({ id: phoenixBootstrapTokens.id }).from(phoenixBootstrapTokens).where(and(eq(phoenixBootstrapTokens.tokenHash, tokenHash), eq(phoenixBootstrapTokens.workspaceId, WORKSPACE_ID), isNull(phoenixBootstrapTokens.consumedAt), gt(phoenixBootstrapTokens.expiresAt, new Date()))).limit(1);
  if (!claimable) return res.status(400).json({ error: "invalid_or_expired_token" });
  const [existing] = await db.select().from(phoenixUsers).where(eq(phoenixUsers.email, email)).limit(1);
  if (existing && !(await passwordMatches(password, existing.passwordSalt, existing.passwordHash))) return res.status(401).json({ error: "invalid_credentials" });
  if (!existing && (!name || password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password))) return res.status(400).json({ error: "validation_failed" });
  const passwordRecord = existing ? null : await hashPassword(password);
  try {
    const outcome = await db.transaction(async tx => {
      await tx.execute(sql`SELECT id FROM phoenix_workspaces WHERE id = ${WORKSPACE_ID} FOR UPDATE`);
      const claimed = await tx.execute(sql`SELECT id FROM phoenix_users WHERE workspace_id = ${WORKSPACE_ID} AND role = 'super_admin' LIMIT 1`);
      if (claimed.rows.length) return "already_claimed" as const;
      const locked = await tx.execute(sql`SELECT id FROM phoenix_bootstrap_tokens WHERE token_hash = ${tokenHash} AND workspace_id = ${WORKSPACE_ID} AND consumed_at IS NULL AND expires_at > now() FOR UPDATE`);
      if (!locked.rows.length) return "invalid_token" as const;
      const [user] = existing
        ? await tx.update(phoenixUsers).set({ workspaceId: WORKSPACE_ID, role: "super_admin", ...(name ? { name } : {}) }).where(eq(phoenixUsers.id, existing.id)).returning()
        : await tx.insert(phoenixUsers).values({ id: `usr_${randomUUID()}`, email, workspaceId: WORKSPACE_ID, name, role: "super_admin", passwordHash: passwordRecord!.hash, passwordSalt: passwordRecord!.salt }).returning();
      await tx.update(phoenixBootstrapTokens).set({ consumedAt: new Date() }).where(and(eq(phoenixBootstrapTokens.workspaceId, WORKSPACE_ID), isNull(phoenixBootstrapTokens.consumedAt)));
      return { user, claimed: existing ? "existing" as const : "created" as const, previousWorkspaceId: existing && existing.workspaceId !== WORKSPACE_ID ? existing.workspaceId : null };
    });
    if (outcome === "already_claimed") return res.status(409).json({ error: "bootstrap_not_required" });
    if (outcome === "invalid_token") return res.status(400).json({ error: "invalid_or_expired_token" });
    setSession(res, outcome.user);
    res.status(201).json({ user: { id: outcome.user.id, email: outcome.user.email, name: outcome.user.name, role: outcome.user.role }, workspace: { id: WORKSPACE_ID }, claimed: outcome.claimed, previousWorkspaceId: outcome.previousWorkspaceId });
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
  if (inviteToken && !invite) return res.status(400).json({ error: "invalid_or_expired_invite" });
  if (!invite && !requestedSlug) return res.status(400).json({ error: "valid_subdomain_required" });
  if (invite && invite.email !== email) return res.status(403).json({ error: "invite_email_mismatch" });
  const workspaceId = invite?.workspaceId ?? `ws_${randomUUID()}`, template = await getPhoenixStore(WORKSPACE_ID, true), name = String(b.name).trim(), brandName = String(b.brandName ?? "").trim() || name;
  if (!template) throw new Error("public_workspace_unavailable");
  const passwordRecord = await hashPassword(password), user = { id: `usr_${randomUUID()}`, email, workspaceId, name, role: invite?.role ?? "owner" };
  if (invite) {
    const accepted = await db.transaction(async tx => {
      const locked = await tx.execute(sql`SELECT id, workspace_id, email, role FROM phoenix_user_invites WHERE id = ${invite.id} AND used_at IS NULL AND expires_at > now() FOR UPDATE`);
      const current = locked.rows[0] as { id: string; workspace_id: string; email: string; role: string } | undefined;
      if (!current) return null;
      if (current.email !== email) return "email_mismatch" as const;
      const [workspace] = await tx.select({ state: phoenixWorkspaces.state }).from(phoenixWorkspaces).where(eq(phoenixWorkspaces.id, current.workspace_id)).limit(1);
      if (!workspace) return "workspace_missing" as const;
      const invitedUser = { ...user, workspaceId: current.workspace_id, role: current.role };
      await tx.insert(phoenixUsers).values({ ...invitedUser, passwordHash: passwordRecord.hash, passwordSalt: passwordRecord.salt });
      await tx.update(phoenixUserInvites).set({ usedAt: new Date() }).where(eq(phoenixUserInvites.id, current.id));
      return { user: invitedUser, workspace: new PhoenixStore(workspace.state as Record<string, unknown>).getWorkspace() };
    });
    if (!accepted) return res.status(400).json({ error: "invalid_or_expired_invite" });
    if (accepted === "email_mismatch") return res.status(403).json({ error: "invite_email_mismatch" });
    if (accepted === "workspace_missing") return res.status(410).json({ error: "invited_workspace_unavailable" });
    setSession(res, accepted.user);
    return res.status(201).json({ user: { email, name, role: accepted.user.role }, workspace: { id: accepted.user.workspaceId, name: accepted.workspace.name }, domain: { state: "none" } });
  }
  const store = template;
  const workspace = store.getWorkspace(); store.updateWorkspace({ id: workspaceId, name: brandName, domain: String(b.subdomain ?? "").trim() || workspace.domain, type: String(b.practiceType ?? workspace.type), brand: { ...workspace.brand, customDomain: "" }, guide: { ...workspace.guide, name } });
  try { await db.insert(phoenixWorkspaces).values({ id: workspaceId, slug: requestedSlug!, pendingCustomDomain, domainVerificationToken, state: store.snapshot(), isPublic: true }); }
  catch { return res.status(409).json({ error: "subdomain_taken" }); }
  await db.insert(phoenixUsers).values({ ...user, passwordHash: passwordRecord.hash, passwordSalt: passwordRecord.salt });
  setSession(res, user); res.status(201).json({ user: { email, name, role: user.role }, workspace: { id: workspaceId, name: brandName }, domain: pendingCustomDomain ? { state: "pending", domain: pendingCustomDomain, txtName: `_phoenix-verification.${pendingCustomDomain}`, txtValue: domainVerificationToken } : { state: "none" } });
});
router.post("/auth/login", async (req, res) => {
  const b = body(req), email = String(b.email ?? "").trim().toLowerCase(), password = String(b.password ?? "");
  const [user] = await db.select().from(phoenixUsers).where(eq(phoenixUsers.email, email)).limit(1);
  if (!user || !(await passwordMatches(password, user.passwordSalt, user.passwordHash))) return res.status(401).json({ error: "invalid_credentials" });
  if (!setSession(res, user)) return res.status(503).json({ error: "auth_unavailable" });
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, workspace: { id: user.workspaceId } });
});
router.get("/auth/session", async (req, res) => { const value = session(req); if (!value) return res.status(401).json({ error: "unauthorized" }); const [user] = await db.select().from(phoenixUsers).where(eq(phoenixUsers.id, value.userId)).limit(1); if (!user || user.workspaceId !== value.workspaceId) return res.status(401).json({ error: "unauthorized" }); res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, workspace: { id: user.workspaceId } }); });
router.post("/auth/logout", (_req, res) => res.clearCookie("po_session", { path: "/" }).json({ ok: true }));
router.post("/auth/reset/request", async (req, res) => { if (process.env.NODE_ENV === "production") return res.status(503).json({ error: "recovery_unavailable" }); const secret = serverSecret(); if (!secret) return res.status(503).json({ error: "recovery_unavailable" }); const email = String(body(req).email ?? "").trim().toLowerCase(), [user] = await db.select().from(phoenixUsers).where(eq(phoenixUsers.email, email)).limit(1); const result: { ok: boolean; resetUrl?: string } = { ok: true }; if (user) { const token = randomBytes(32).toString("base64url"), tokenHash = capabilityHash(token, secret); await db.insert(phoenixResetTokens).values({ id: `rst_${randomUUID()}`, tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 30 * 60_000) }); result.resetUrl = `${siteUrl(req)}/reset?token=${encodeURIComponent(token)}`; } res.json(result); });
router.post("/auth/reset/confirm", async (req, res) => { const token = String(body(req).token ?? ""), password = String(body(req).password ?? ""); if (!token || password.length < 8) return res.status(400).json({ error: "validation_failed" }); const secret = serverSecret(); if (!secret) return res.status(503).json({ error: "recovery_unavailable" }); const tokenHash = capabilityHash(token, secret); const [record] = await db.select().from(phoenixResetTokens).where(and(eq(phoenixResetTokens.tokenHash, tokenHash), gt(phoenixResetTokens.expiresAt, new Date()), isNull(phoenixResetTokens.usedAt))).limit(1); if (!record) return res.status(400).json({ error: "invalid_or_expired_token" }); const passwordRecord = await hashPassword(password); await db.update(phoenixUsers).set({ passwordHash: passwordRecord.hash, passwordSalt: passwordRecord.salt }).where(eq(phoenixUsers.id, record.userId)); await db.update(phoenixResetTokens).set({ usedAt: new Date() }).where(eq(phoenixResetTokens.id, record.id)); res.json({ ok: true }); });

router.get("/public/workspace", async (req, res) => { const value = await publicStore(req); res.json({ workspace: value.store.getWorkspace() }); });
router.get("/public/funnels/:slug", async (req, res) => { const funnel = (await publicStore(req)).store.funnelBySlug(req.params.slug); if (!funnel) return res.status(404).json({ error: "not_found" }); res.json({ funnel }); });
router.get("/public/cms", async (req, res) => res.json({ pages: (await publicStore(req)).store.listCms() }));
router.use(["/workspace", "/members", "/cms", "/funnels", "/contacts", "/pipelines", "/activities", "/scheduling", "/sequences", "/webhooks", "/sync-log", "/subscriptions", "/partners"], adminOnly);
router.use(["/workspace", "/members", "/cms", "/funnels", "/contacts", "/pipelines", "/activities", "/scheduling", "/sequences", "/webhooks", "/sync-log", "/subscriptions", "/partners"], csrfOrigin);
router.use("/members", requirePermission("members.read"));
router.use(["/webhooks", "/subscriptions", "/scheduling"], requirePermission("workspace.manage"));
router.use("/partners", requirePermission("partners.read"));
const schedulingPatch = (value: unknown) => {
  if (value === undefined || value === null || typeof value !== "object") return {};
  const v = value as Record<string, unknown>;
  return {
    ...(v.eventTypeUri !== undefined ? { eventTypeUri: String(v.eventTypeUri).slice(0, 300) } : {}),
    ...(v.eventTypeName !== undefined ? { eventTypeName: String(v.eventTypeName).slice(0, 200) } : {}),
    ...(v.schedulingUrl !== undefined ? { schedulingUrl: String(v.schedulingUrl).slice(0, 300) } : {}),
    ...(v.durationMinutes !== undefined ? { durationMinutes: Math.max(1, Math.min(480, Number(v.durationMinutes) || 15)) } : {}),
    ...(v.enabled !== undefined ? { enabled: Boolean(v.enabled) } : {}),
  };
};
router.get("/workspace", async (req, res) => res.json({ workspace: (await tenantStore(req)).getWorkspace() }));
router.get("/workspace/domain-status", requirePermission("workspace.manage"), async (req, res) => { const [row] = await db.select({ customDomain: phoenixWorkspaces.customDomain, pendingCustomDomain: phoenixWorkspaces.pendingCustomDomain, token: phoenixWorkspaces.domainVerificationToken, verifiedAt: phoenixWorkspaces.customDomainVerifiedAt }).from(phoenixWorkspaces).where(eq(phoenixWorkspaces.id, identity(req).workspaceId)).limit(1); if (!row) return res.status(404).json({ error: "workspace_not_found" }); res.json({ state: row.pendingCustomDomain ? "pending" : row.customDomain ? "verified" : "none", domain: row.pendingCustomDomain ?? row.customDomain, verifiedAt: row.verifiedAt, ...(row.pendingCustomDomain && row.token ? { txtName: `_phoenix-verification.${row.pendingCustomDomain}`, txtValue: row.token } : {}) }); });
router.post("/workspace/domain-verify", requirePermission("workspace.manage"), async (req, res) => { const workspaceId = identity(req).workspaceId, [row] = await db.select({ domain: phoenixWorkspaces.pendingCustomDomain, token: phoenixWorkspaces.domainVerificationToken }).from(phoenixWorkspaces).where(eq(phoenixWorkspaces.id, workspaceId)).limit(1); if (!row?.domain || !row.token) return res.status(400).json({ error: "no_pending_domain" }); let records: string[][]; try { records = await resolveTxt(`_phoenix-verification.${row.domain}`); } catch { return res.status(422).json({ error: "dns_verification_not_found", txtName: `_phoenix-verification.${row.domain}`, txtValue: row.token }); } if (!records.some(parts => parts.join("") === row.token)) return res.status(422).json({ error: "dns_verification_mismatch", txtName: `_phoenix-verification.${row.domain}`, txtValue: row.token }); try { const verifiedAt = new Date(), workspace = await db.transaction(async tx => { const locked = await tx.execute(sql`SELECT state, pending_custom_domain, domain_verification_token FROM phoenix_workspaces WHERE id = ${workspaceId} FOR UPDATE`), current = locked.rows[0] as { state: Record<string, unknown>; pending_custom_domain: string | null; domain_verification_token: string | null } | undefined; if (!current || current.pending_custom_domain !== row.domain || current.domain_verification_token !== row.token) throw new Error("domain_changed"); const store = new PhoenixStore(current.state), ws = store.getWorkspace(); store.updateWorkspace({ domain: row.domain, brand: { ...ws.brand, customDomain: row.domain } }); await tx.update(phoenixWorkspaces).set({ state: store.snapshot(), customDomain: row.domain, pendingCustomDomain: null, domainVerificationToken: null, customDomainVerifiedAt: verifiedAt, updatedAt: verifiedAt }).where(eq(phoenixWorkspaces.id, workspaceId)); return store.getWorkspace(); }); res.json({ state: "verified", domain: row.domain, verifiedAt, workspace }); } catch (err) { if ((err as { code?: string }).code === "23505") return res.status(409).json({ error: "domain_taken" }); if ((err as Error).message === "domain_changed") return res.status(409).json({ error: "domain_changed" }); throw err; } });
/** Members are real logins plus invitations that are still open. Pending invitations carry an `inv_` id, logins a `usr_` id. */
type MemberRow = { id: string; workspaceId: string; name: string; email: string; role: string; state: "active" | "invited"; createdAt: string; inviteExpiresAt?: string };
const memberColumns = { id: phoenixUsers.id, workspaceId: phoenixUsers.workspaceId, name: phoenixUsers.name, email: phoenixUsers.email, role: phoenixUsers.role, createdAt: phoenixUsers.createdAt };
const activeMember = (user: { id: string; workspaceId: string; name: string; email: string; role: string; createdAt: Date }): MemberRow => ({ id: user.id, workspaceId: user.workspaceId, name: user.name, email: user.email, role: user.role, state: "active", createdAt: user.createdAt.toISOString() });
const invitedMember = (invite: { id: string; workspaceId: string; email: string; role: string; createdAt: Date; expiresAt: Date }): MemberRow => ({ id: invite.id, workspaceId: invite.workspaceId, name: invite.email.split("@")[0], email: invite.email, role: invite.role, state: "invited", createdAt: invite.createdAt.toISOString(), inviteExpiresAt: invite.expiresAt.toISOString() });
const pendingInvite = (workspaceId: string, id?: string) => and(eq(phoenixUserInvites.workspaceId, workspaceId), isNull(phoenixUserInvites.usedAt), gt(phoenixUserInvites.expiresAt, new Date()), ...(id ? [eq(phoenixUserInvites.id, id)] : []));
const byRankThenName = (a: MemberRow, b: MemberRow) => rank(b.role) - rank(a.role) || a.name.localeCompare(b.name);
router.get("/members", async (req, res) => {
  const workspaceId = identity(req).workspaceId;
  const [users, invites] = await Promise.all([
    db.select(memberColumns).from(phoenixUsers).where(eq(phoenixUsers.workspaceId, workspaceId)),
    db.select().from(phoenixUserInvites).where(pendingInvite(workspaceId)),
  ]);
  res.json({ members: [...users.map(activeMember).sort(byRankThenName), ...invites.map(invitedMember).sort(byRankThenName)] });
});
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
router.get("/partners", async (_req, res) => {
  const [rows, counts] = await Promise.all([
    db.select({ id: phoenixWorkspaces.id, slug: phoenixWorkspaces.slug, customDomain: phoenixWorkspaces.customDomain, isPublic: phoenixWorkspaces.isPublic, state: phoenixWorkspaces.state, createdAt: phoenixWorkspaces.createdAt }).from(phoenixWorkspaces).where(ne(phoenixWorkspaces.id, WORKSPACE_ID)).orderBy(desc(phoenixWorkspaces.createdAt)),
    db.select({ workspaceId: phoenixUsers.workspaceId, members: sql<number>`count(*)::int` }).from(phoenixUsers).groupBy(phoenixUsers.workspaceId),
  ]);
  const memberCounts = new Map(counts.map(row => [row.workspaceId, row.members]));
  res.json({ workspaces: rows.map(row => ({ ...new PhoenixStore(row.state as Record<string, unknown>).getWorkspace(), id: row.id, slug: row.slug, customDomain: row.customDomain, isPublic: row.isPublic, memberCount: memberCounts.get(row.id) ?? 0, createdAt: row.createdAt.toISOString() })) });
});
router.get("/scheduling/status", async (req, res) => {
  const scheduling = schedulingOf(await tenantStore(req));
  if (!calendlyConfigured()) return res.json({ tokenPresent: false, webhookConfigured: isWebhookConfigured(), account: null, scheduling, connected: false });
  const me = await currentUser();
  res.json({
    tokenPresent: true,
    webhookConfigured: isWebhookConfigured(),
    account: me.ok ? { name: me.data.name, email: me.data.email, schedulingUrl: me.data.schedulingUrl, timezone: me.data.timezone } : null,
    error: me.ok ? undefined : me.error,
    scheduling,
    connected: me.ok && Boolean(scheduling?.enabled && scheduling.eventTypeUri),
  });
});
router.get("/scheduling/event-types", async (_req, res) => {
  if (!calendlyConfigured()) return res.status(503).json({ error: "not_configured" });
  const me = await currentUser();
  if (!me.ok) return res.status(502).json({ error: "calendly_unavailable", reason: me.error });
  const types = await listEventTypes(me.data.uri);
  if (!types.ok) return res.status(502).json({ error: "calendly_unavailable", reason: types.error });
  res.json({ eventTypes: types.data });
});

router.patch("/workspace", requirePermission("workspace.manage"), async (req, res) => { if (!req.body || typeof req.body !== "object") return invalid(res); const b = body(req), pending = b.customDomain === null ? null : b.customDomain !== undefined ? customHost(b.customDomain) : undefined; if (b.customDomain !== undefined && pending === null && b.customDomain !== null) return res.status(400).json({ error: "invalid_custom_domain" }); const token = pending ? randomBytes(24).toString("base64url") : null; const workspace = await mutatePhoenixStore(identity(req).workspaceId, store => { const current = store.getWorkspace(); return store.updateWorkspace({ ...(b.domain ? { domain: b.domain } : {}), brand: { ...current.brand, ...((b.brand as object) ?? {}), ...(pending !== undefined ? { customDomain: "" } : {}) }, guide: { ...current.guide, ...((b.guide as object) ?? {}) }, scheduling: { ...current.scheduling, ...schedulingPatch(b.scheduling) } }); }, pending !== undefined ? { customDomain: null, pendingCustomDomain: pending, domainVerificationToken: token, customDomainVerifiedAt: null } : {}); res.json({ workspace, ...(pending ? { domain: { state: "pending", domain: pending, txtName: `_phoenix-verification.${pending}`, txtValue: token } } : pending === null ? { domain: { state: "none" } } : {}) }); });
router.post("/members/invite", requirePermission("members.invite"), async (req, res) => {
  const actor = identity(req);
  const email = String(body(req).email ?? "").trim().toLowerCase();
  const role = String(body(req).role ?? "");
  if (!/.+@.+\..+/.test(email)) return res.status(400).json({ error: "invalid_email" });
  if (!isRole(role)) return res.status(400).json({ error: "invalid_role" });
  if (!assignableRoles(actor.role).includes(role)) return res.status(403).json({ error: "role_not_assignable" });
  // One login belongs to exactly one workspace, so an email that already signs in somewhere cannot be invited.
  const [taken] = await db.select({ workspaceId: phoenixUsers.workspaceId }).from(phoenixUsers).where(eq(phoenixUsers.email, email)).limit(1);
  if (taken) return res.status(409).json({ error: taken.workspaceId === actor.workspaceId ? "already_member" : "email_taken" });
  const secret = serverSecret();
  if (!secret) return res.status(503).json({ error: "invites_unavailable" });

  const token = randomBytes(32).toString("base64url");
  const workspaceId = actor.workspaceId;
  const invite = { id: `inv_${randomUUID()}`, tokenHash: capabilityHash(token, secret), workspaceId, email, role, expiresAt: new Date(Date.now() + 7 * 86400_000) };
  await db.transaction(async tx => {
    // A fresh invitation replaces any earlier pending one for the same person.
    await tx.update(phoenixUserInvites).set({ expiresAt: new Date() }).where(and(pendingInvite(workspaceId), eq(phoenixUserInvites.email, email)));
    await tx.insert(phoenixUserInvites).values(invite);
  });
  const workspace = (await tenantStore(req)).getWorkspace();
  const member = invitedMember({ ...invite, createdAt: new Date() });
  const invitePath = `/signup?invite=${encodeURIComponent(token)}`;
  const delivery = await sendAdminInvitationEmail({
    to: email,
    role,
    inviteUrl: new URL(invitePath, siteUrl(req)).toString(),
    expiresAt: invite.expiresAt,
    workspaceName: workspace.name,
    inviterName: actor.email,
    brand: workspace.brand,
    siteUrl: siteUrl(req),
  });
  if (delivery.status === "failed") {
    req.log.warn({ reason: delivery.reason, workspaceId }, "Admin invitation email delivery failed");
  }
  res.json({ member, invitePath, expiresAt: invite.expiresAt, delivery });
});
/** Change a member's role, or the role a pending invitation will grant. Nobody edits themselves or anyone ranked above them. */
router.patch("/members/:id", requirePermission("members.manage"), async (req, res) => {
  const actor = identity(req), role = String(body(req).role ?? ""), id = String(req.params.id);
  if (!isRole(role)) return res.status(400).json({ error: "invalid_role" });
  if (!assignableRoles(actor.role).includes(role)) return res.status(403).json({ error: "role_not_assignable" });
  if (id === actor.userId) return res.status(400).json({ error: "cannot_change_own_role" });
  if (id.startsWith("inv_")) {
    const [invite] = await db.select().from(phoenixUserInvites).where(pendingInvite(actor.workspaceId, id)).limit(1);
    if (!invite) return res.status(404).json({ error: "not_found" });
    if (!outranksOrEquals(actor.role, invite.role)) return res.status(403).json({ error: "outranked" });
    const [updated] = await db.update(phoenixUserInvites).set({ role }).where(eq(phoenixUserInvites.id, invite.id)).returning();
    return res.json({ member: invitedMember(updated) });
  }
  const [target] = await db.select(memberColumns).from(phoenixUsers).where(and(eq(phoenixUsers.id, id), eq(phoenixUsers.workspaceId, actor.workspaceId))).limit(1);
  if (!target) return res.status(404).json({ error: "not_found" });
  if (!outranksOrEquals(actor.role, target.role)) return res.status(403).json({ error: "outranked" });
  const [updated] = await db.update(phoenixUsers).set({ role }).where(eq(phoenixUsers.id, target.id)).returning(memberColumns);
  res.json({ member: activeMember(updated) });
});
/** Remove a member's login, or revoke a pending invitation. The same rank rules apply, and nobody removes themselves. */
router.delete("/members/:id", requirePermission("members.manage"), async (req, res) => {
  const actor = identity(req), id = String(req.params.id);
  if (id === actor.userId) return res.status(400).json({ error: "cannot_remove_self" });
  if (id.startsWith("inv_")) {
    const [invite] = await db.select().from(phoenixUserInvites).where(pendingInvite(actor.workspaceId, id)).limit(1);
    if (!invite) return res.status(404).json({ error: "not_found" });
    if (!outranksOrEquals(actor.role, invite.role)) return res.status(403).json({ error: "outranked" });
    await db.update(phoenixUserInvites).set({ expiresAt: new Date() }).where(eq(phoenixUserInvites.id, invite.id));
    return res.json({ ok: true, revoked: invite.id });
  }
  const [target] = await db.select(memberColumns).from(phoenixUsers).where(and(eq(phoenixUsers.id, id), eq(phoenixUsers.workspaceId, actor.workspaceId))).limit(1);
  if (!target) return res.status(404).json({ error: "not_found" });
  if (!outranksOrEquals(actor.role, target.role)) return res.status(403).json({ error: "outranked" });
  await db.transaction(async tx => {
    await tx.delete(phoenixResetTokens).where(eq(phoenixResetTokens.userId, target.id));
    await tx.delete(phoenixUsers).where(eq(phoenixUsers.id, target.id));
  });
  res.json({ ok: true, removed: target.id });
});
router.post("/cms/toggle", requirePermission("content.manage"), async (req, res) => { const b = body(req); if (!b.pageId || !b.sectionId) return res.status(400).json({ error: "missing_fields" }); await mutatePhoenixStore(identity(req).workspaceId, store => store.toggle(String(b.pageId), String(b.sectionId), Boolean(b.enabled))); res.json({ ok: true }); });
router.patch("/funnels/:id", requirePermission("content.manage"), async (req, res) => { const b = body(req), allowed = ["name", "slug", "segment", "offer", "status", "storybrand", "variants", "blocks", "weights"], funnel = await mutatePhoenixStore(identity(req).workspaceId, store => store.updateFunnel(String(req.params.id), Object.fromEntries(allowed.filter(k => b[k] !== undefined).map(k => [k, b[k]])))); if (!funnel) return res.status(404).json({ error: "not_found" }); res.json({ funnel }); });
router.post("/funnels/:id", requirePermission("content.manage"), async (req, res) => { if (req.params.id !== "new") return res.status(405).json({ error: "use_patch" }); const b = body(req), funnelSlug = String(b.slug ?? "").replace(/[^a-z0-9-]/g, ""); if (!funnelSlug) return res.status(400).json({ error: "slug_required" }); const funnel = await mutatePhoenixStore(identity(req).workspaceId, store => { if (store.funnelBySlug(funnelSlug)) return null; return store.createFunnel({ ...b, id: undefined, workspaceId: identity(req).workspaceId, name: String(b.name || "New funnel"), slug: funnelSlug, status: "draft", variants: Array.isArray(b.variants) && b.variants.length ? b.variants : [{ id: "A", label: "A", headline: "", trafficPct: 100 }], stats: { visits: 0, leads: 0, cvr: "—" } }); }); if (!funnel) return res.status(409).json({ error: "slug_taken" }); res.json({ funnel }); });

router.post("/intake/session", async (req, res) => { if (limited(req, "session", 60)) return res.status(429).json({ error: "rate_limited" }); const b = body(req), funnelSlug = String(b.funnelSlug ?? ""), token = b.resumeToken, tenant = await publicWorkspace(req); if (!tenant || !funnelSlug || typeof token !== "string" || token.length > 128) return res.status(400).json({ error: "missing_fields" }); const saved = await mutatePhoenixStore(tenant.id, store => { if (!store.funnelBySlug(funnelSlug)) return null; const previous = store.session(token) as Record<string, unknown> | null; return store.saveSession({ id: token, workspaceId: tenant.id, funnelSlug, variant: String(b.variant ?? "A"), resumeToken: token, step: Math.min(5, Math.max(1, Number(b.step ?? 1))), answers: b.answers ?? {}, utm: b.utm ?? {}, submitted: Boolean(previous?.submitted) }); }); if (!saved) return res.status(404).json({ error: "unknown_funnel" }); res.json({ ok: true, updatedAt: saved.updatedAt }); });
router.get("/intake/session", async (req, res) => { const token = String(req.query.token ?? ""), tenant = await publicWorkspace(req); if (!token || !tenant) return res.status(400).json({ error: "missing_token" }); const store = await getPhoenixStore(tenant.id), saved = store?.session(token); if (!saved) return res.status(404).json({ error: "not_found" }); res.json({ session: saved }); });
router.post("/intake/submit", async (req, res) => { if (limited(req, "submit", 10)) return res.status(429).json({ error: "rate_limited" }); const secret = serverSecret(); if (!secret) return res.status(503).json({ error: "intake_unavailable" }); const b = body(req); if (String(b.website ?? "").trim()) return res.json({ ok: true }); const answers = (b.answers ?? {}) as Answers, name = String(answers.name ?? "").trim(), email = String(answers.email ?? "").trim(), resumeToken = typeof b.resumeToken === "string" ? b.resumeToken : "", tenant = await publicWorkspace(req); if (!tenant || !b.funnelSlug || !resumeToken || resumeToken.length > 128 || !name || !/.+@.+\..+/.test(email)) return res.status(400).json({ error: "validation_failed" }); const value = score(answers), utm = (b.utm ?? {}) as Record<string, string | undefined>, source = utm.utm_source ? `${utm.utm_source} / ${utm.utm_medium ?? "direct"}` : utm.referrer ? "referral" : "direct", bookingToken = randomBytes(32).toString("base64url"), bookingTokenHash = capabilityHash(bookingToken, secret); const contact = await mutatePhoenixStore(tenant.id, store => { const funnel = store.funnelBySlug(String(b.funnelSlug)); if (!funnel) return null; const existing = store.listContacts().find(c => c.email.toLowerCase() === email.toLowerCase()), saved = existing ? store.updateContact(existing.id, { score: value, answers, utm })! : store.createContact({ workspaceId: tenant.id, pipelineId: "prospects", name, company: String(answers.company ?? "").trim() || "—", role: String(answers.role ?? "—"), email, phone: answers.phone ? String(answers.phone) : undefined, funnel: funnel.name, source, score: value, stage: 0, position: 0, owner: "—", answers, utm }); store.saveSession({ id: resumeToken, workspaceId: tenant.id, funnelSlug: b.funnelSlug, variant: String(b.variant ?? "A"), resumeToken, step: 5, answers, utm, submitted: true, bookingTokenHash, bookingContactId: saved.id, bookingExpiresAt: new Date(Date.now() + 30 * 60_000).toISOString() }); store.addActivity({ workspaceId: tenant.id, contactId: saved.id, type: "intake_completed", title: `Intake completed — scored ${value}`, body: "" }); return saved; }); if (!contact) return res.status(404).json({ error: "unknown_funnel" }); res.json({ ok: true, bookingToken, score: value }); });

const CALL_SCHEDULED = "Call scheduled";
const AVAILABILITY_TTL_MS = 60_000;
const availabilityCache = new Map<string, { at: number; body: unknown }>();
type Scheduling = { provider: string; eventTypeUri: string; eventTypeName: string; schedulingUrl: string; durationMinutes: number; enabled: boolean };
const schedulingOf = (store: NonNullable<Awaited<ReturnType<typeof getPhoenixStore>>>) => store.getWorkspace().scheduling as Scheduling | undefined;
const schedulingLive = (scheduling: Scheduling | undefined) => Boolean(calendlyConfigured() && scheduling?.enabled && scheduling.eventTypeUri);

/**
 * Real availability from the tenant's Calendly event type, grouped into the day
 * columns the funnel's slot grid already renders. Cached briefly per tenant and
 * range so a traffic spike doesn't burn Calendly's rate limit. The access token
 * never leaves the server.
 */
router.get("/public/scheduling/availability", async (req, res) => {
  if (limited(req, "availability", 120)) return res.status(429).json({ error: "rate_limited" });
  const tenant = await publicWorkspace(req);
  const store = tenant ? await getPhoenixStore(tenant.id) : null;
  if (!tenant || !store) return res.status(404).json({ error: "not_found" });
  const scheduling = schedulingOf(store), timezone = safeTimeZone(req.query.timezone);
  if (!schedulingLive(scheduling)) return res.json({ configured: false, timezone, days: [], schedulingUrl: scheduling?.schedulingUrl ?? "", durationMinutes: scheduling?.durationMinutes ?? 15 });

  const requestedStart = new Date(String(req.query.start ?? ""));
  const start = Number.isNaN(requestedStart.getTime()) ? new Date() : requestedStart;
  const span = Math.min(14, Math.max(1, Number(req.query.days ?? 7) || 7));
  const end = new Date(start.getTime() + span * 86_400_000);

  const key = `${tenant.id}:${timezone}:${start.toISOString().slice(0, 13)}:${span}`;
  const hit = availabilityCache.get(key);
  if (hit && Date.now() - hit.at < AVAILABILITY_TTL_MS) return res.json(hit.body);
  // Keys vary by tenant, zone and hour, so drop stale entries rather than growing forever.
  if (availabilityCache.size > 200) for (const [k, v] of availabilityCache) if (Date.now() - v.at >= AVAILABILITY_TTL_MS) availabilityCache.delete(k);

  const result = await availableTimes(scheduling!.eventTypeUri, start, end);
  if (!result.ok) return res.status(502).json({ error: "scheduling_unavailable", reason: result.error, schedulingUrl: scheduling!.schedulingUrl });

  const byDay = new Map<string, { date: string; label: string; slots: Array<{ startTime: string; label: string }> }>();
  for (const slot of result.data) {
    const date = zonedDateKey(slot.startTime, timezone);
    if (!byDay.has(date)) byDay.set(date, { date, label: slotDayLabel(slot.startTime, timezone), slots: [] });
    byDay.get(date)!.slots.push({ startTime: slot.startTime, label: slotTimeLabel(slot.startTime, timezone) });
  }
  const days = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  const anchor = days[0]?.slots[0]?.startTime ?? start.toISOString();
  const payload = {
    configured: true, timezone, days,
    weekLabel: weekLabel(anchor, timezone), timezoneLabel: timeZoneLabel(anchor, timezone),
    durationMinutes: scheduling!.durationMinutes, schedulingUrl: scheduling!.schedulingUrl,
    rangeStart: start.toISOString(), rangeEnd: end.toISOString(),
  };
  availabilityCache.set(key, { at: Date.now(), body: payload });
  res.json(payload);
});

/**
 * Direct booking from the public /schedule page — referrals and emailed links,
 * with no intake behind them. Unauthenticated by design, so it leans on the same
 * defences as /intake/submit: honeypot, tight rate limit, email validation. The
 * slot itself is authorised by Calendly, which rejects anything not genuinely open.
 */
router.post("/public/scheduling/book", async (req, res) => {
  if (limited(req, "direct-book", 5)) return res.status(429).json({ error: "rate_limited" });
  const b = body(req);
  if (String(b.website ?? "").trim()) return res.json({ ok: true });
  const name = String(b.name ?? "").trim();
  const email = String(b.email ?? "").trim();
  const startTime = String(b.startTime ?? "");
  const timezone = safeTimeZone(b.timezone);
  const startsAt = new Date(startTime);
  if (!name || !/.+@.+\..+/.test(email) || Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) return res.status(400).json({ error: "validation_failed" });
  const tenant = await publicWorkspace(req);
  const store = tenant ? await getPhoenixStore(tenant.id) : null;
  if (!tenant || !store) return res.status(404).json({ error: "not_found" });
  const scheduling = schedulingOf(store);
  if (!schedulingLive(scheduling)) return res.status(503).json({ error: "scheduling_unavailable" });

  const booking = await createInvitee({
    eventTypeUri: scheduling!.eventTypeUri,
    startTime: startsAt.toISOString(),
    invitee: { name, email, timezone },
  });
  if (!booking.ok) {
    const status = booking.error === "slot_unavailable" ? 409 : 502;
    return res.status(status).json({ error: booking.error === "slot_unavailable" ? "slot_unavailable" : "scheduling_unavailable", reason: booking.error });
  }

  const label = bookedSlotLabel(booking.data.startTime, timezone);
  await mutatePhoenixStore(tenant.id, s2 => {
    const existing = s2.contactByEmail(email);
    const stage = s2.stageIndex(existing?.pipelineId ?? "prospects", CALL_SCHEDULED);
    const fields = {
      bookedSlot: label, bookedAt: booking.data.startTime, bookedTimezone: timezone,
      calendlyEventUri: booking.data.eventUri, calendlyInviteeUri: booking.data.inviteeUri,
      bookingCanceledAt: undefined, ...(stage >= 0 ? { stage } : {}),
    };
    // Someone who already came through the funnel keeps their score and answers.
    const contact = existing
      ? s2.updateContact(existing.id, fields)!
      : s2.createContact({
          workspaceId: tenant.id, pipelineId: "prospects", name,
          company: String(b.company ?? "").trim() || "—", role: String(b.role ?? "").trim() || "—",
          email, ...(b.phone ? { phone: String(b.phone).trim() } : {}),
          funnel: "Direct booking", source: "direct booking", score: 50,
          stage: Math.max(0, stage), position: 0, owner: "—", ...fields,
        });
    s2.addActivity({ workspaceId: tenant.id, contactId: contact.id, type: "call", title: "Call booked", body: `${label} ${timeZoneLabel(booking.data.startTime, timezone)} · ${scheduling!.durationMinutes} minutes · booked from /schedule` });
  });
  res.json({ ok: true, bookedSlot: label, startTime: booking.data.startTime, timezone });
});

/**
 * Books the call. Runs in three phases so the tenant's row lock is never held
 * across a network call to Calendly:
 *   1. verify the single-use capability token and claim the booking (locked)
 *   2. create the event in Calendly (unlocked)
 *   3. record it, move the stage, burn the token — or release the claim (locked)
 * The token is only consumed once Calendly has actually accepted the booking, so
 * a failure leaves the visitor able to pick another time.
 */
router.post("/intake/book", async (req, res) => {
  if (limited(req, "book", 10)) return res.status(429).json({ error: "rate_limited" });
  const secret = serverSecret();
  if (!secret) return res.status(503).json({ error: "booking_unavailable" });
  const b = body(req);
  const resumeToken = typeof b.resumeToken === "string" ? b.resumeToken : "";
  const bookingToken = typeof b.bookingToken === "string" ? b.bookingToken : "";
  const startTime = String(b.startTime ?? "");
  const timezone = safeTimeZone(b.timezone);
  const startsAt = new Date(startTime);
  if (!resumeToken || !bookingToken || !startTime || Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) return res.status(400).json({ error: "missing_fields" });
  const tenant = await publicWorkspace(req);
  const store = tenant ? await getPhoenixStore(tenant.id) : null;
  if (!tenant || !store) return res.status(404).json({ error: "not_found" });
  const scheduling = schedulingOf(store);
  if (!schedulingLive(scheduling)) return res.status(503).json({ error: "scheduling_unavailable" });

  // Phase 1 — verify the capability and claim it.
  const claim = await mutatePhoenixStore(tenant.id, s2 => {
    const saved = s2.session(resumeToken) as Record<string, unknown> | null;
    const hash = String(saved?.bookingTokenHash ?? "");
    const supplied = capabilityHash(bookingToken, secret);
    const expected = Buffer.from(hash), actual = Buffer.from(supplied);
    if (!saved?.submitted || !hash || !saved.bookingExpiresAt || new Date(String(saved.bookingExpiresAt)).getTime() <= Date.now() || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const inFlight = String(saved.bookingInFlightAt ?? "");
    if (inFlight && Date.now() - new Date(inFlight).getTime() < 30_000) return "busy" as const;
    const contact = s2.contact(String(saved.bookingContactId ?? ""));
    if (!contact) return null;
    s2.saveSession({ ...saved, resumeToken, bookingInFlightAt: new Date().toISOString() });
    return { contactId: contact.id, name: contact.name, email: contact.email };
  });
  if (claim === null) return res.status(403).json({ error: "invalid_booking_capability" });
  if (claim === "busy") return res.status(409).json({ error: "booking_in_progress" });

  // Phase 2 — the real booking, on the real calendar. No lock held here.
  const release = () => mutatePhoenixStore(tenant.id, s2 => {
    const saved = s2.session(resumeToken) as Record<string, unknown> | null;
    if (saved) s2.saveSession({ ...saved, resumeToken, bookingInFlightAt: "" });
  });
  const booking = await createInvitee({
    eventTypeUri: scheduling!.eventTypeUri,
    startTime: startsAt.toISOString(),
    invitee: { name: claim.name, email: claim.email, timezone },
    // Echoed back on invitee.created so the webhook can find this session.
    tracking: { utm_content: resumeToken },
  });
  if (!booking.ok) {
    await release();
    const status = booking.error === "slot_unavailable" ? 409 : 502;
    return res.status(status).json({ error: booking.error === "slot_unavailable" ? "slot_unavailable" : "scheduling_unavailable", reason: booking.error });
  }

  // Phase 3 — record it and burn the capability.
  const label = bookedSlotLabel(booking.data.startTime, timezone);
  await mutatePhoenixStore(tenant.id, s2 => {
    const saved = s2.session(resumeToken) as Record<string, unknown> | null;
    const contact = s2.contact(claim.contactId);
    if (!contact) return;
    const stage = s2.stageIndex(contact.pipelineId, CALL_SCHEDULED);
    s2.updateContact(contact.id, {
      bookedSlot: label, bookedAt: booking.data.startTime, bookedTimezone: timezone,
      calendlyEventUri: booking.data.eventUri, calendlyInviteeUri: booking.data.inviteeUri,
      bookingCanceledAt: undefined, ...(stage >= 0 ? { stage } : {}),
    });
    if (saved) s2.saveSession({ ...saved, resumeToken, bookingTokenHash: "", bookingContactId: "", bookingExpiresAt: "", bookingInFlightAt: "", bookingConsumedAt: new Date().toISOString() });
    s2.addActivity({ workspaceId: tenant.id, contactId: contact.id, type: "call", title: "Call booked", body: `${label} ${timeZoneLabel(booking.data.startTime, timezone)} · ${scheduling!.durationMinutes} minutes` });
  });
  res.json({ ok: true, bookedSlot: label, startTime: booking.data.startTime, timezone, cancelUrl: booking.data.cancelUrl, rescheduleUrl: booking.data.rescheduleUrl });
});
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