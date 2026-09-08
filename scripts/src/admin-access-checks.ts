import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { db, phoenixMemberships, phoenixUserAvatars, phoenixUserInvites, phoenixUsers, phoenixWorkspaces, pool } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

// Release checks for admin access: super-admin login, the invitation flow and
// its dead-link statuses, the member directory, the rank rules (nobody grants,
// changes or removes a role above their own; nobody edits themselves), and a
// returning account joining a second workspace. Needs a running app at
// ADMIN_CHECK_BASE_URL, DATABASE_URL, and chromium for the rendered-page checks
// (ADMIN_CHECK_SKIP_BROWSER=1 skips those).

const scryptAsync = promisify(scrypt);
const execFileAsync = promisify(execFile);
const baseUrl = process.env.ADMIN_CHECK_BASE_URL ?? "http://localhost:80";
const suffix = randomUUID().replaceAll("-", "");
const workspaceId = `ws_check_${suffix}`;
// A second workspace, so an account that already belongs somewhere can be
// invited into another one — the case that used to be rejected outright.
const secondWorkspaceId = `ws_check_second_${suffix}`;
const workspaceIds = [workspaceId, secondWorkspaceId];
const superId = `usr_check_super_${suffix}`;
const secondOwnerId = `usr_check_second_owner_${suffix}`;
const superEmail = `super-${suffix}@checks.invalid`;
const secondOwnerEmail = `second-owner-${suffix}@checks.invalid`;
const invitedEmail = `admin-${suffix}@checks.invalid`;
const staffEmail = `staff-${suffix}@checks.invalid`;
const supersededEmail = `resent-${suffix}@checks.invalid`;
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
const inviteTokenOf = (value: Record<string, any>) => new URL(String(value.invitePath ?? ""), baseUrl).searchParams.get("invite");
const members = async (cookie: string) => (await json("/api/members", { headers: { cookie } })).value.members as Array<Record<string, unknown>> | undefined;

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
    { id: superId, email: superEmail, passwordHash, passwordSalt: salt, workspaceId, name: "Release Check Super Admin", role: "super_admin" },
    { id: secondOwnerId, email: secondOwnerEmail, passwordHash, passwordSalt: salt, workspaceId: secondWorkspaceId, name: "Release Check Owner Two", role: "owner" },
  ]);
  // Seeded directly, so mirror what signup would have written.
  await db.insert(phoenixMemberships).values([
    { id: `mem_${superId}`, userId: superId, workspaceId, role: "super_admin" },
    { id: `mem_${secondOwnerId}`, userId: secondOwnerId, workspaceId: secondWorkspaceId, role: "owner" },
  ]);

  if (process.env.ADMIN_CHECK_SKIP_BROWSER !== "1") {
    const loginDom = await renderedDom("/admin/login");
    check(loginDom.includes("Sign in to your workspace"), "/admin/login did not render the login form.");

    const redirectedDom = await renderedDom("/admin");
    check(redirectedDom.includes("Sign in to your workspace"), "Unauthenticated /admin did not redirect to the admin login.");
  }

  const login = await post("/api/auth/login", { email: superEmail, password });
  check(login.response.ok, `Super admin login failed (${login.response.status}).`);
  check(login.value.user?.role === "super_admin", "Login did not return the authenticated role.");
  check(login.value.user?.id === superId, "Login did not return the user id.");
  check(login.value.workspace?.id === workspaceId, "Login did not return the authenticated workspace.");
  const superCookie = cookieFrom(login.response);
  check(superCookie, "Login did not issue a session cookie.");

  const session = await json("/api/auth/session", { headers: { cookie: superCookie } });
  check(session.value.user?.role === "super_admin" && session.value.workspace?.id === workspaceId, "Session did not preserve role and workspace access.");

  const invite = await post("/api/members/invite", { email: invitedEmail, role: "admin" }, superCookie);
  check(invite.response.ok, `Admin invitation failed (${invite.response.status}).`);
  check(String(invite.value.member?.id ?? "").startsWith("inv_") && invite.value.member?.state === "invited", "Invitation did not return a pending member record.");
  const token = inviteTokenOf(invite.value);
  check(token, "Invitation did not return an acceptance token.");

  const pendingRows = await members(superCookie);
  check(pendingRows?.some(member => member.email === invitedEmail && member.state === "invited" && member.role === "admin"), "Pending invitation is missing from the member directory.");
  check(pendingRows?.some(member => member.id === superId && member.state === "active" && member.role === "super_admin"), "The super admin seat is missing from the member directory.");

  const duplicate = await post("/api/members/invite", { email: superEmail, role: "staff" }, superCookie);
  check(duplicate.response.status === 409 && duplicate.value.error === "already_member", "Inviting someone already seated here was not rejected.");

  const live = await json(`/api/auth/invite?token=${encodeURIComponent(token)}`);
  check(live.response.ok, `Invitation status check failed (${live.response.status}).`);
  check(live.value.status === "valid", "A live invitation did not report itself usable before signup.");
  check(live.value.email === invitedEmail, "Invitation status did not name the invited address.");
  check(live.value.role === "admin" && live.value.workspaceName, "Invitation status did not describe the role and workspace being joined.");
  check(!("token" in live.value) && !("tokenHash" in live.value) && !("workspaceId" in live.value), "Invitation status echoed the raw token or internal workspace id.");

  const unknown = await json("/api/auth/invite?token=not-a-real-invitation");
  check(unknown.value.status === "invalid", "An unknown token was not reported as invalid.");
  check(!unknown.value.email && !unknown.value.workspaceName, "An unknown token leaked workspace or invitee detail.");

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
  const adminId = String(signup.value.user?.id ?? "");
  check(adminId.startsWith("usr_"), "Signup did not return the new user id.");
  const rows = await members(adminCookie);
  const acceptedMember = rows?.find(member => member.email === invitedEmail);
  check(acceptedMember?.role === "admin" && acceptedMember.state === "active", "Accepted admin was not activated in the workspace member directory.");
  check(acceptedMember.workspaceId === workspaceId, "Accepted admin member record points to the wrong workspace.");
  check(rows?.filter(member => member.email === invitedEmail).length === 1, "Accepted invitation still shows as pending.");

  const spent = await json(`/api/auth/invite?token=${encodeURIComponent(token)}`);
  check(spent.value.status === "used", "An accepted invitation was not reported as already used.");

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
  const expiringToken = inviteTokenOf(expiringInvite.value);
  check(expiringToken, "Expiring invitation did not return an acceptance token.");
  const [expiringRecord] = await db.select().from(phoenixUserInvites).where(eq(phoenixUserInvites.email, expiredEmail)).limit(1);
  check(expiringRecord, "Expiring invitation was not persisted.");
  await db.update(phoenixUserInvites).set({ expiresAt: new Date(0) }).where(eq(phoenixUserInvites.id, expiringRecord.id));
  const lapsed = await json(`/api/auth/invite?token=${encodeURIComponent(expiringToken)}`);
  check(lapsed.value.status === "expired", "An expired invitation was not reported as expired ahead of the form.");
  check(!lapsed.value.email && !lapsed.value.workspaceName, "An expired invitation leaked workspace or invitee detail.");

  const expired = await post("/api/auth/signup", {
    name: "Expired Invite",
    email: expiredEmail,
    password,
    inviteToken: expiringToken,
  });
  check(expired.response.status === 400 && expired.value.error === "invalid_or_expired_invite", "Expired invitation was not rejected cleanly.");

  const firstInvite = await post("/api/members/invite", { email: supersededEmail, role: "staff" }, superCookie);
  check(firstInvite.response.ok, `Supersession setup failed (${firstInvite.response.status}).`);
  const staleToken = inviteTokenOf(firstInvite.value);
  check(staleToken, "Superseded invitation setup did not return an acceptance token.");
  const secondInvite = await post("/api/members/invite", { email: supersededEmail, role: "admin" }, superCookie);
  check(secondInvite.response.ok, `Re-invitation failed (${secondInvite.response.status}).`);
  const freshToken = inviteTokenOf(secondInvite.value);
  check(freshToken && freshToken !== staleToken, "Re-invitation did not issue a distinct token.");
  check((await members(superCookie))?.filter(member => member.email === supersededEmail).length === 1, "A superseded invitation still appears in the directory.");

  const stale = await json(`/api/auth/invite?token=${encodeURIComponent(staleToken!)}`);
  check(stale.value.status === "revoked", "A superseded invitation was not reported as revoked.");
  const staleSignup = await post("/api/auth/signup", {
    name: "Superseded Invite",
    email: supersededEmail,
    password,
    inviteToken: staleToken,
  });
  check(staleSignup.response.status === 400 && staleSignup.value.error === "invalid_or_expired_invite", "A superseded invitation was still redeemable at signup.");
  const fresh = await json(`/api/auth/invite?token=${encodeURIComponent(freshToken!)}`);
  check(fresh.value.status === "valid" && fresh.value.role === "admin", "The replacement invitation did not survive superseding the old one.");

  const revokedEmail = `revoked-${invitedEmail}`;
  const revokable = await post("/api/members/invite", { email: revokedEmail, role: "staff" }, superCookie);
  check(revokable.response.ok, `Revokable invitation setup failed (${revokable.response.status}).`);
  const revokableToken = inviteTokenOf(revokable.value);
  check(revokableToken, "Revokable invitation did not return an acceptance token.");
  const revoke = await post("/api/members/invite/revoke", { email: revokedEmail }, superCookie);
  check(revoke.response.ok && revoke.value.revoked === 1, `Invitation revocation failed (${revoke.response.status}).`);
  const revokedPreview = await json(`/api/auth/invite?token=${encodeURIComponent(revokableToken!)}`);
  check(revokedPreview.value.status === "revoked", "A withdrawn invitation was not reported as revoked.");
  const revokedSignup = await post("/api/auth/signup", {
    name: "Revoked Invite",
    email: revokedEmail,
    password,
    inviteToken: revokableToken,
  });
  check(revokedSignup.response.status === 400 && revokedSignup.value.error === "invalid_or_expired_invite", "Revoked invitation was not rejected cleanly.");

  // ── Rank rules ────────────────────────────────────────────────────────────
  // An admin cannot reach above their own rank, in either direction.
  const escalate = await post("/api/members/invite", { email: `escalate-${suffix}@checks.invalid`, role: "super_admin" }, adminCookie);
  check(escalate.response.status === 403 && escalate.value.error === "role_not_assignable", "Admin was allowed to invite a super admin.");
  const demoteSuper = await send("PATCH", `/api/members/${superId}`, { role: "staff" }, adminCookie);
  check(demoteSuper.response.status === 403 && demoteSuper.value.error === "outranked", "Admin was allowed to change the super admin's role.");
  const removeSuper = await send("DELETE", `/api/members/${superId}`, undefined, adminCookie);
  check(removeSuper.response.status === 403 && removeSuper.value.error === "outranked", "Admin was allowed to remove the super admin.");
  const selfEdit = await send("PATCH", `/api/members/${superId}`, { role: "admin" }, superCookie);
  check(selfEdit.response.status === 400 && selfEdit.value.error === "cannot_change_own_role", "A member was allowed to change their own role.");
  const staffInvite = await post("/api/members/invite", { email: staffEmail, role: "staff" }, adminCookie);
  check(staffInvite.response.ok && staffInvite.value.member?.role === "staff", `Admin could not invite staff (${staffInvite.response.status}).`);
  const partnersAsAdmin = await json("/api/partners", { headers: { cookie: adminCookie } });
  check(partnersAsAdmin.response.status === 403, "Admin could read the platform-wide partner list.");
  const partnersAsSuper = await json("/api/partners", { headers: { cookie: superCookie } });
  check(partnersAsSuper.response.ok && Array.isArray(partnersAsSuper.value.workspaces), "Super admin could not read the partner list.");
  check(workspaceIds.every(id => partnersAsSuper.value.workspaces.some((workspace: Record<string, unknown>) => workspace.id === id)), "Partner list does not include the check workspaces.");

  // The super admin changes the admin's role, and the new rank takes effect on the next request.
  const demote = await send("PATCH", `/api/members/${adminId}`, { role: "owner" }, superCookie);
  check(demote.response.ok && demote.value.member?.role === "owner", `Role change failed (${demote.response.status}).`);
  const ownerInvitesAdmin = await post("/api/members/invite", { email: `late-${suffix}@checks.invalid`, role: "admin" }, adminCookie);
  check(ownerInvitesAdmin.response.status === 403 && ownerInvitesAdmin.value.error === "role_not_assignable", "An owner was allowed to invite an admin.");
  const ownerManages = await send("PATCH", `/api/members/${superId}`, { role: "staff" }, adminCookie);
  check(ownerManages.response.status === 403 && ownerManages.value.error === "forbidden", "An owner was allowed to manage seated members.");
  const workspaceAsOwner = await json("/api/workspace", { headers: { cookie: adminCookie } });
  check(workspaceAsOwner.response.ok, "An owner could not load the workspace record.");
  const promote = await send("PATCH", `/api/members/${adminId}`, { role: "admin" }, superCookie);
  check(promote.response.ok && promote.value.member?.role === "admin", `Restoring the admin role failed (${promote.response.status}).`);

  // Revoking one pending invitation by id removes it from the directory and kills its link.
  const staffInviteId = String(staffInvite.value.member.id);
  const revokeById = await send("DELETE", `/api/members/${staffInviteId}`, undefined, superCookie);
  check(revokeById.response.ok && revokeById.value.revoked === staffInviteId, `Revoking an invitation by id failed (${revokeById.response.status}).`);
  check(!(await members(superCookie))?.some(member => member.email === staffEmail), "A revoked invitation still appears in the directory.");
  const staffToken = inviteTokenOf(staffInvite.value);
  const revokedById = await post("/api/auth/signup", { name: "Revoked", email: staffEmail, password, inviteToken: staffToken });
  check(revokedById.response.status === 400 && revokedById.value.error === "invalid_or_expired_invite", "An invitation revoked by id was still accepted.");

  // ── A returning user joins a second workspace ────────────────────────────
  // The admin who accepted above already belongs to `workspaceId`. The owner of
  // the second workspace now invites that same address.
  const secondLogin = await post("/api/auth/login", { email: secondOwnerEmail, password });
  check(secondLogin.response.ok, `Second workspace owner login failed (${secondLogin.response.status}).`);
  const secondOwnerCookie = cookieFrom(secondLogin.response);
  const crossInvite = await post("/api/members/invite", { email: invitedEmail, role: "staff" }, secondOwnerCookie);
  check(crossInvite.response.ok, `Cross-workspace invitation failed (${crossInvite.response.status}).`);
  const crossToken = inviteTokenOf(crossInvite.value);
  check(crossToken, "Cross-workspace invitation did not return an acceptance token.");

  // Signup must refuse rather than mint a duplicate identity for the address.
  const duplicateSignup = await post("/api/auth/signup", { name: "Duplicate", email: invitedEmail, password, inviteToken: crossToken });
  check(duplicateSignup.response.status === 409 && duplicateSignup.value.error === "account_exists", "Signup did not steer an existing account to sign-in.");

  const preview = await json(`/api/auth/invite?token=${encodeURIComponent(crossToken!)}`);
  check(preview.value.status === "valid", `Cross-workspace invitation did not preview as live (${preview.value.status}).`);
  check(preview.value.accountExists === true, "Invitation status did not report that the invited address already has an account.");
  check(preview.value.acceptableNow === false && preview.value.signedInAs === null, "An unauthenticated status claimed the invitation was acceptable.");

  // The signed-in admin accepts. Its original workspace access must survive.
  const wrongAccount = await post("/api/auth/invite/accept", { token: crossToken }, superCookie);
  check(wrongAccount.response.status === 403 && wrongAccount.value.error === "invite_email_mismatch", "An invitation was acceptable by the wrong account.");

  const accept = await post("/api/auth/invite/accept", { token: crossToken }, adminCookie);
  check(accept.response.status === 201, `Invitation acceptance by an existing user failed (${accept.response.status}).`);
  check(accept.value.workspace?.id === secondWorkspaceId, "Acceptance did not enter the invited workspace.");
  check(accept.value.workspace?.role === "staff", "Acceptance did not apply the invited role.");
  const joinedIds = (accept.value.workspaces as Array<Record<string, unknown>>).map(entry => entry.id);
  check(joinedIds.includes(workspaceId) && joinedIds.includes(secondWorkspaceId), "Joining a second workspace replaced the first instead of adding to it.");
  const joinedCookie = cookieFrom(accept.response);
  check(joinedCookie, "Invitation acceptance did not reissue the session cookie.");

  const replay = await post("/api/auth/invite/accept", { token: crossToken }, joinedCookie);
  check(replay.response.status === 400 && replay.value.error === "invalid_or_expired_invite", "A spent invitation was accepted twice.");

  // Read the directory as that workspace's owner: the returning user joined as
  // staff, and /members is owner/admin and up.
  const joinedMember = (await members(secondOwnerCookie))?.find(member => member.email === invitedEmail);
  check(joinedMember?.state === "active" && joinedMember.role === "staff", "The returning user was not activated in the second workspace directory.");
  const staffOnly = await json("/api/members", { headers: { cookie: joinedCookie } });
  check(staffOnly.response.status === 403, "The invited role was not enforced in the workspace it was granted for.");
  // Staff can still open the admin shell: the workspace record is readable by every member.
  const staffWorkspace = await json("/api/workspace", { headers: { cookie: joinedCookie } });
  check(staffWorkspace.response.ok, "A staff member could not load the workspace record.");
  const staffPatch = await send("PATCH", "/api/workspace", { brand: { primaryColor: "#000000" } }, joinedCookie);
  check(staffPatch.response.status === 403, "A staff member was allowed to change the workspace.");

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

  // ── Removing a seat ──────────────────────────────────────────────────────
  // An owner cannot remove seats; the super admin removes the admin from the
  // first workspace, which was that account's home. Home moves to the second
  // workspace and the account survives with its remaining access.
  const ownerRemoves = await send("DELETE", `/api/members/${adminId}`, undefined, secondOwnerCookie);
  check(ownerRemoves.response.status === 403 && ownerRemoves.value.error === "forbidden", "An owner was allowed to remove a seat.");
  const remove = await send("DELETE", `/api/members/${adminId}`, undefined, superCookie);
  check(remove.response.ok && remove.value.removed === adminId && remove.value.accountDeleted === false, `Removing the admin's seat failed (${remove.response.status}).`);
  check(!(await members(superCookie))?.some(member => member.id === adminId), "A removed seat still appears in the directory.");
  const removedSession = await json("/api/auth/session", { headers: { cookie: backCookie } });
  check(removedSession.response.status === 401, "A removed member's session for that workspace was still accepted.");
  const relogin = await post("/api/auth/login", { email: invitedEmail, password });
  check(relogin.response.ok && relogin.value.workspace?.id === secondWorkspaceId && relogin.value.workspace?.role === "staff", "Home did not move to the workspace the removed member still belongs to.");
  check((relogin.value.workspaces as unknown[]).length === 1, "The removed workspace still appears in the member's list.");

  console.info("Admin access release checks passed.");
}

try {
  await main();
} finally {
  const created = await db.select({ id: phoenixUsers.id }).from(phoenixUsers).where(inArray(phoenixUsers.workspaceId, workspaceIds));
  if (created.length) await db.delete(phoenixMemberships).where(inArray(phoenixMemberships.userId, created.map(user => user.id)));
  await db.delete(phoenixMemberships).where(inArray(phoenixMemberships.workspaceId, workspaceIds));
  // Profile photos reference the account, so they have to go before it does.
  if (created.length) await db.delete(phoenixUserAvatars).where(inArray(phoenixUserAvatars.userId, created.map(user => user.id)));
  await db.delete(phoenixUsers).where(inArray(phoenixUsers.workspaceId, workspaceIds));
  await db.delete(phoenixUserInvites).where(inArray(phoenixUserInvites.workspaceId, workspaceIds));
  await db.delete(phoenixWorkspaces).where(inArray(phoenixWorkspaces.id, workspaceIds));
  await pool.end();
}
