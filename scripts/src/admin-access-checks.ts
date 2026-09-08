import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { db, phoenixUserInvites, phoenixUsers, phoenixWorkspaces, pool } from "@workspace/db";
import { eq } from "drizzle-orm";

// Release checks for admin access: super-admin login, the invitation flow, the
// member directory, and the rank rules (nobody grants, changes or removes a role
// above their own; nobody edits themselves). Needs a running API at
// ADMIN_CHECK_BASE_URL, DATABASE_URL, and chromium for the rendered-page checks.

const scryptAsync = promisify(scrypt);
const execFileAsync = promisify(execFile);
const baseUrl = process.env.ADMIN_CHECK_BASE_URL ?? "http://localhost:80";
const suffix = randomUUID().replaceAll("-", "");
const workspaceId = `ws_check_${suffix}`;
const superAdminId = `usr_check_super_${suffix}`;
const superAdminEmail = `super-${suffix}@checks.invalid`;
const invitedEmail = `admin-${suffix}@checks.invalid`;
const staffEmail = `staff-${suffix}@checks.invalid`;
const password = `Release-${suffix.slice(0, 12)}!`;

const check: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(message);
};

const json = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${baseUrl}${path}`, init);
  const value = await response.json().catch(() => ({})) as Record<string, any>;
  return { response, value };
};

const send = (method: string, path: string, body: unknown, cookie?: string) =>
  json(path, {
    method,
    headers: {
      "content-type": "application/json",
      origin: new URL(baseUrl).origin,
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const post = (path: string, body: unknown, cookie?: string) => send("POST", path, body, cookie);

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

  await db.insert(phoenixWorkspaces).values({
    id: workspaceId,
    slug: `check-${suffix.slice(0, 24)}`,
    state: template.state,
    isPublic: false,
  });
  await db.insert(phoenixUsers).values({
    id: superAdminId,
    email: superAdminEmail,
    passwordHash,
    passwordSalt: salt,
    workspaceId,
    name: "Release Check Super Admin",
    role: "super_admin",
  });

  if (process.env.ADMIN_CHECK_SKIP_BROWSER !== "1") {
    const loginDom = await renderedDom("/admin/login");
    check(loginDom.includes("Sign in to your workspace"), "/admin/login did not render the login form.");

    const redirectedDom = await renderedDom("/admin");
    check(redirectedDom.includes("Sign in to your workspace"), "Unauthenticated /admin did not redirect to the admin login.");
  }

  const login = await post("/api/auth/login", { email: superAdminEmail, password });
  check(login.response.ok, `Super admin login failed (${login.response.status}).`);
  check(login.value.user?.role === "super_admin", "Login did not return the authenticated role.");
  check(login.value.user?.id === superAdminId, "Login did not return the user id.");
  check(login.value.workspace?.id === workspaceId, "Login did not return the authenticated workspace.");
  const superCookie = cookieFrom(login.response);
  check(superCookie, "Login did not issue a session cookie.");

  const session = await json("/api/auth/session", { headers: { cookie: superCookie } });
  check(session.value.user?.role === "super_admin" && session.value.workspace?.id === workspaceId, "Session did not preserve role and workspace access.");

  const invite = await post("/api/members/invite", { email: invitedEmail, role: "admin" }, superCookie);
  check(invite.response.ok, `Admin invitation failed (${invite.response.status}).`);
  check(String(invite.value.member?.id ?? "").startsWith("inv_") && invite.value.member?.state === "invited", "Invitation did not return a pending member record.");
  const invitePath = String(invite.value.invitePath ?? "");
  const token = new URL(invitePath, baseUrl).searchParams.get("invite");
  check(token, "Invitation did not return an acceptance token.");

  const pending = await json("/api/members", { headers: { cookie: superCookie } });
  const pendingRows = pending.value.members as Array<Record<string, unknown>> | undefined;
  check(pendingRows?.some(member => member.email === invitedEmail && member.state === "invited" && member.role === "admin"), "Pending invitation is missing from the member directory.");
  check(pendingRows?.some(member => member.id === superAdminId && member.state === "active" && member.role === "super_admin"), "The super admin login is missing from the member directory.");

  const duplicate = await post("/api/members/invite", { email: superAdminEmail, role: "staff" }, superCookie);
  check(duplicate.response.status === 409 && duplicate.value.error === "already_member", "Inviting an existing member was not rejected.");

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
  const rows = members.value.members as Array<Record<string, unknown>> | undefined;
  const acceptedMember = rows?.find(member => member.email === invitedEmail);
  check(acceptedMember?.role === "admin" && acceptedMember.state === "active", "Accepted admin was not activated in the workspace member directory.");
  check(acceptedMember.workspaceId === workspaceId, "Accepted admin member record points to the wrong workspace.");
  check(rows?.filter(member => member.email === invitedEmail).length === 1, "Accepted invitation still shows as pending.");
  const [adminUser] = await db.select({ id: phoenixUsers.id }).from(phoenixUsers).where(eq(phoenixUsers.email, invitedEmail)).limit(1);
  check(adminUser, "Accepted admin login was not persisted.");

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
  const expiringInvite = await post("/api/members/invite", { email: expiredEmail, role: "admin" }, superCookie);
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

  // Rank rules: an admin cannot reach above their own rank, in either direction.
  const escalate = await post("/api/members/invite", { email: `escalate-${suffix}@checks.invalid`, role: "super_admin" }, adminCookie);
  check(escalate.response.status === 403 && escalate.value.error === "role_not_assignable", "Admin was allowed to invite a super admin.");
  const demoteSuper = await send("PATCH", `/api/members/${superAdminId}`, { role: "staff" }, adminCookie);
  check(demoteSuper.response.status === 403 && demoteSuper.value.error === "outranked", "Admin was allowed to change the super admin's role.");
  const selfEdit = await send("PATCH", `/api/members/${superAdminId}`, { role: "admin" }, superCookie);
  check(selfEdit.response.status === 400 && selfEdit.value.error === "cannot_change_own_role", "A member was allowed to change their own role.");
  const staffInvite = await post("/api/members/invite", { email: staffEmail, role: "staff" }, adminCookie);
  check(staffInvite.response.ok && staffInvite.value.member?.role === "staff", `Admin could not invite staff (${staffInvite.response.status}).`);
  const partnersAsAdmin = await json("/api/partners", { headers: { cookie: adminCookie } });
  check(partnersAsAdmin.response.status === 403, "Admin could read the platform-wide partner list.");
  const partnersAsSuper = await json("/api/partners", { headers: { cookie: superCookie } });
  check(partnersAsSuper.response.ok && Array.isArray(partnersAsSuper.value.workspaces), "Super admin could not read the partner list.");
  check(partnersAsSuper.value.workspaces.some((workspace: Record<string, unknown>) => workspace.id === workspaceId), "Partner list does not include the check workspace.");

  // The super admin changes the admin's role, and the new rank takes effect on the next request.
  const demote = await send("PATCH", `/api/members/${adminUser.id}`, { role: "owner" }, superCookie);
  check(demote.response.ok && demote.value.member?.role === "owner", `Role change failed (${demote.response.status}).`);
  const ownerInvitesAdmin = await post("/api/members/invite", { email: `late-${suffix}@checks.invalid`, role: "admin" }, adminCookie);
  check(ownerInvitesAdmin.response.status === 403 && ownerInvitesAdmin.value.error === "role_not_assignable", "An owner was allowed to invite an admin.");
  const ownerEditsRole = await send("PATCH", `/api/members/${String(staffInvite.value.member.id)}`, { role: "partner" }, adminCookie);
  check(ownerEditsRole.response.status === 403 && ownerEditsRole.value.error === "forbidden", "An owner was allowed to manage members.");
  const workspaceAsOwner = await json("/api/workspace", { headers: { cookie: adminCookie } });
  check(workspaceAsOwner.response.ok, "An owner could not load the workspace record.");

  // Revoking a pending invitation removes it from the directory and kills its link.
  const revoke = await send("DELETE", `/api/members/${String(staffInvite.value.member.id)}`, undefined, superCookie);
  check(revoke.response.ok, `Revoking an invitation failed (${revoke.response.status}).`);
  const afterRevoke = await json("/api/members", { headers: { cookie: superCookie } });
  check(!(afterRevoke.value.members as Array<Record<string, unknown>>).some(member => member.email === staffEmail), "Revoked invitation still appears in the directory.");
  const staffToken = new URL(String(staffInvite.value.invitePath), baseUrl).searchParams.get("invite");
  const revokedSignup = await post("/api/auth/signup", { name: "Revoked", email: staffEmail, password, inviteToken: staffToken });
  check(revokedSignup.response.status === 400 && revokedSignup.value.error === "invalid_or_expired_invite", "Revoked invitation was still accepted.");

  console.info("Admin access release checks passed.");
}

try {
  await main();
} finally {
  await db.delete(phoenixUsers).where(eq(phoenixUsers.workspaceId, workspaceId));
  await db.delete(phoenixUserInvites).where(eq(phoenixUserInvites.workspaceId, workspaceId));
  await db.delete(phoenixWorkspaces).where(eq(phoenixWorkspaces.id, workspaceId));
  await pool.end();
}
