import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { db, phoenixMemberships, phoenixUserInvites, phoenixUsers, phoenixWorkspaces, pool } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const scryptAsync = promisify(scrypt);
const execFileAsync = promisify(execFile);
const baseUrl = process.env.ADMIN_CHECK_BASE_URL ?? "http://localhost:80";
const suffix = randomUUID().replaceAll("-", "");
const workspaceId = `ws_check_${suffix}`;
// A second workspace, so an account that already belongs somewhere can be
// invited into another one — the case that used to be rejected outright.
const secondWorkspaceId = `ws_check_second_${suffix}`;
const workspaceIds = [workspaceId, secondWorkspaceId];
const ownerId = `usr_check_owner_${suffix}`;
const secondOwnerId = `usr_check_second_owner_${suffix}`;
const ownerEmail = `owner-${suffix}@checks.invalid`;
const secondOwnerEmail = `second-owner-${suffix}@checks.invalid`;
const invitedEmail = `admin-${suffix}@checks.invalid`;
const password = `Release-${suffix.slice(0, 12)}!`;

const check: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const json = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const value = await response.json().catch(() => ({})) as Record<string, any>;
  return { response, value };
};

const post = (path: string, body: unknown, cookie?: string) =>
  json(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: new URL(baseUrl).origin,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

const cookieFrom = (response: Response) => response.headers.get("set-cookie")?.split(";")[0] ?? "";

async function renderedDom(path: string) {
  const { stdout } = await execFileAsync("chromium", [
    "--headless",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--virtual-time-budget=4000",
    "--dump-dom",
    `${baseUrl}${path}`,
  ], { maxBuffer: 2_000_000 });
  return stdout;
}

async function main() {
  const [template] = await db.select().from(phoenixWorkspaces).limit(1);
  check(template, "A template workspace is required for the admin access check.");
  const salt = randomBytes(16).toString("base64url");
  const passwordHash = (await scryptAsync(password, salt, 64) as Buffer).toString("base64url");

  await db.insert(phoenixWorkspaces).values([
    { id: workspaceId, slug: `check-${suffix.slice(0, 24)}`, state: template.state, isPublic: false },
    { id: secondWorkspaceId, slug: `check2-${suffix.slice(0, 23)}`, state: template.state, isPublic: false },
  ]);
  await db.insert(phoenixUsers).values([
    { id: ownerId, email: ownerEmail, passwordHash, passwordSalt: salt, workspaceId, name: "Release Check Owner", role: "owner" },
    { id: secondOwnerId, email: secondOwnerEmail, passwordHash, passwordSalt: salt, workspaceId: secondWorkspaceId, name: "Release Check Owner Two", role: "owner" },
  ]);
  // Seeded directly, so mirror what signup would have written.
  await db.insert(phoenixMemberships).values([
    { id: `mem_${ownerId}`, userId: ownerId, workspaceId, role: "owner" },
    { id: `mem_${secondOwnerId}`, userId: secondOwnerId, workspaceId: secondWorkspaceId, role: "owner" },
  ]);

  const loginDom = await renderedDom("/admin/login");
  check(loginDom.includes("Sign in to your workspace"), "/admin/login did not render the login form.");

  const redirectedDom = await renderedDom("/admin");
  check(redirectedDom.includes("Sign in to your workspace"), "Unauthenticated /admin did not redirect to the admin login.");

  const login = await post("/api/auth/login", { email: ownerEmail, password });
  check(login.response.ok, `Owner login failed (${login.response.status}).`);
  check(login.value.user?.role === "owner", "Login did not return the authenticated role.");
  check(login.value.workspace?.id === workspaceId, "Login did not return the authenticated workspace.");
  const ownerCookie = cookieFrom(login.response);
  check(ownerCookie, "Login did not issue a session cookie.");

  const session = await json("/api/auth/session", { headers: { cookie: ownerCookie } });
  check(session.value.user?.role === "owner" && session.value.workspace?.id === workspaceId, "Session did not preserve role and workspace access.");

  const invite = await post("/api/members/invite", { email: invitedEmail, role: "admin" }, ownerCookie);
  check(invite.response.ok, `Admin invitation failed (${invite.response.status}).`);
  const invitePath = String(invite.value.invitePath ?? "");
  const token = new URL(invitePath, baseUrl).searchParams.get("invite");
  check(token, "Invitation did not return an acceptance token.");

  const signup = await post("/api/auth/signup", {
    name: "Release Check Admin",
    email: invitedEmail,
    password,
    inviteToken: token,
  });
  check(signup.response.status === 201, `Invitation acceptance failed (${signup.response.status}).`);
  check(signup.value.user?.role === "admin", "Invited account did not join as admin.");
  check(signup.value.workspace?.id === workspaceId, "Invited admin joined the wrong workspace.");
  const adminCookie = cookieFrom(signup.response);
  check(adminCookie, "Invitation acceptance did not issue a session cookie.");
  const members = await json("/api/members", { headers: { cookie: adminCookie } });
  const acceptedMember = (members.value.members as Array<Record<string, unknown>> | undefined)?.find(member => member.email === invitedEmail);
  check(acceptedMember?.role === "admin" && acceptedMember.state === "active", "Accepted admin was not activated in the workspace member directory.");
  check(acceptedMember.workspaceId === workspaceId, "Accepted admin member record points to the wrong workspace.");

  const reused = await post("/api/auth/signup", {
    name: "Release Check Admin",
    email: `other-${invitedEmail}`,
    password,
    inviteToken: token,
  });
  check(reused.response.status === 400 && reused.value.error === "invalid_or_expired_invite", "Used invitation was not rejected cleanly.");

  const invalid = await post("/api/auth/signup", {
    name: "Invalid Invite",
    email: `invalid-${invitedEmail}`,
    password,
    inviteToken: "not-a-real-invitation",
  });
  check(invalid.response.status === 400 && invalid.value.error === "invalid_or_expired_invite", "Invalid invitation was not rejected cleanly.");

  const expiredEmail = `expired-${invitedEmail}`;
  const expiringInvite = await post("/api/members/invite", { email: expiredEmail, role: "admin" }, ownerCookie);
  check(expiringInvite.response.ok, `Expiring invitation setup failed (${expiringInvite.response.status}).`);
  const expiringToken = new URL(String(expiringInvite.value.invitePath), baseUrl).searchParams.get("invite");
  check(expiringToken, "Expiring invitation did not return an acceptance token.");
  const [expiringRecord] = await db.select().from(phoenixUserInvites).where(eq(phoenixUserInvites.email, expiredEmail)).limit(1);
  check(expiringRecord, "Expiring invitation was not persisted.");
  await db.update(phoenixUserInvites).set({ expiresAt: new Date(0) }).where(eq(phoenixUserInvites.id, expiringRecord.id));
  const expired = await post("/api/auth/signup", {
    name: "Expired Invite",
    email: expiredEmail,
    password,
    inviteToken: expiringToken,
  });
  check(expired.response.status === 400 && expired.value.error === "invalid_or_expired_invite", "Expired invitation was not rejected cleanly.");

  const revokedEmail = `revoked-${invitedEmail}`;
  const revokable = await post("/api/members/invite", { email: revokedEmail, role: "staff" }, ownerCookie);
  check(revokable.response.ok, `Revokable invitation setup failed (${revokable.response.status}).`);
  const revokableToken = new URL(String(revokable.value.invitePath), baseUrl).searchParams.get("invite");
  check(revokableToken, "Revokable invitation did not return an acceptance token.");
  const revoke = await post("/api/members/invite/revoke", { email: revokedEmail }, ownerCookie);
  check(revoke.response.ok && revoke.value.revoked === 1, `Invitation revocation failed (${revoke.response.status}).`);
  const revokedPreview = await json(`/api/auth/invitation?token=${encodeURIComponent(revokableToken!)}`);
  check(revokedPreview.response.status === 400, "Revoked invitation still previewed as valid.");
  const revokedSignup = await post("/api/auth/signup", {
    name: "Revoked Invite",
    email: revokedEmail,
    password,
    inviteToken: revokableToken,
  });
  check(revokedSignup.response.status === 400 && revokedSignup.value.error === "invalid_or_expired_invite", "Revoked invitation was not rejected cleanly.");

  // ── A returning user joins a second workspace ────────────────────────────
  // The admin who accepted above already belongs to `workspaceId`. The owner of
  // the second workspace now invites that same address.
  const secondLogin = await post("/api/auth/login", { email: secondOwnerEmail, password });
  check(secondLogin.response.ok, `Second workspace owner login failed (${secondLogin.response.status}).`);
  const secondOwnerCookie = cookieFrom(secondLogin.response);
  const crossInvite = await post("/api/members/invite", { email: invitedEmail, role: "staff" }, secondOwnerCookie);
  check(crossInvite.response.ok, `Cross-workspace invitation failed (${crossInvite.response.status}).`);
  const crossToken = new URL(String(crossInvite.value.invitePath), baseUrl).searchParams.get("invite");
  check(crossToken, "Cross-workspace invitation did not return an acceptance token.");

  // Signup must refuse rather than mint a duplicate identity for the address.
  const duplicate = await post("/api/auth/signup", { name: "Duplicate", email: invitedEmail, password, inviteToken: crossToken });
  check(duplicate.response.status === 409 && duplicate.value.error === "account_exists", "Signup did not steer an existing account to sign-in.");

  const preview = await json(`/api/auth/invitation?token=${encodeURIComponent(crossToken!)}`);
  check(preview.response.ok, `Invitation preview failed (${preview.response.status}).`);
  check(preview.value.invitation?.accountExists === true, "Invitation preview did not report the existing account.");
  check(preview.value.invitation?.workspace?.id === secondWorkspaceId, "Invitation preview named the wrong workspace.");

  // The signed-in admin accepts. Its original workspace access must survive.
  const wrongAccount = await post("/api/auth/invitation/accept", { token: crossToken }, ownerCookie);
  check(wrongAccount.response.status === 403 && wrongAccount.value.error === "invite_email_mismatch", "An invitation was acceptable by the wrong account.");

  const accept = await post("/api/auth/invitation/accept", { token: crossToken }, adminCookie);
  check(accept.response.status === 201, `Invitation acceptance by an existing user failed (${accept.response.status}).`);
  check(accept.value.workspace?.id === secondWorkspaceId, "Acceptance did not enter the invited workspace.");
  check(accept.value.workspace?.role === "staff", "Acceptance did not apply the invited role.");
  const joinedIds = (accept.value.workspaces as Array<Record<string, unknown>>).map(entry => entry.id);
  check(joinedIds.includes(workspaceId) && joinedIds.includes(secondWorkspaceId), "Joining a second workspace replaced the first instead of adding to it.");
  const joinedCookie = cookieFrom(accept.response);
  check(joinedCookie, "Invitation acceptance did not reissue the session cookie.");

  const replay = await post("/api/auth/invitation/accept", { token: crossToken }, joinedCookie);
  check(replay.response.status === 400 && replay.value.error === "invalid_or_expired_invite", "A spent invitation was accepted twice.");

  // Read the directory as that workspace's owner: the returning user joined as
  // staff, and /members is owner/admin only.
  const secondMembers = await json("/api/members", { headers: { cookie: secondOwnerCookie } });
  const joinedMember = (secondMembers.value.members as Array<Record<string, unknown>> | undefined)?.find(member => member.email === invitedEmail);
  check(joinedMember?.state === "active" && joinedMember.role === "staff", "The returning user was not activated in the second workspace directory.");
  const staffOnly = await json("/api/members", { headers: { cookie: joinedCookie } });
  check(staffOnly.response.status === 403, "The invited role was not enforced in the workspace it was granted for.");

  // Switching back restores the original role rather than carrying the new one over.
  const back = await post("/api/auth/workspace", { workspaceId }, joinedCookie);
  check(back.response.ok, `Switching back to the first workspace failed (${back.response.status}).`);
  check(back.value.workspace?.id === workspaceId && back.value.workspace?.role === "admin", "Switching workspaces did not restore the original role.");
  const backCookie = cookieFrom(back.response);
  const backSession = await json("/api/auth/session", { headers: { cookie: backCookie } });
  check(backSession.value.workspace?.id === workspaceId, "The session did not follow the workspace switch.");
  check((backSession.value.workspaces as unknown[]).length === 2, "The session did not list both workspaces.");

  const trespass = await post("/api/auth/workspace", { workspaceId: "ws_phoenix" }, backCookie);
  check(trespass.response.status === 403 && trespass.value.error === "workspace_access_denied", "A workspace the account does not belong to was enterable.");

  console.info("Admin access release checks passed.");
}

try {
  await main();
} finally {
  const created = await db.select({ id: phoenixUsers.id }).from(phoenixUsers).where(inArray(phoenixUsers.workspaceId, workspaceIds));
  if (created.length) await db.delete(phoenixMemberships).where(inArray(phoenixMemberships.userId, created.map(user => user.id)));
  await db.delete(phoenixUsers).where(inArray(phoenixUsers.workspaceId, workspaceIds));
  await db.delete(phoenixUserInvites).where(inArray(phoenixUserInvites.workspaceId, workspaceIds));
  await db.delete(phoenixWorkspaces).where(inArray(phoenixWorkspaces.id, workspaceIds));
  await pool.end();
}