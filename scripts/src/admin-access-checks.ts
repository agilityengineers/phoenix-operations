import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { db, phoenixUserInvites, phoenixUsers, phoenixWorkspaces, pool } from "@workspace/db";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);
const execFileAsync = promisify(execFile);
const baseUrl = process.env.ADMIN_CHECK_BASE_URL ?? "http://localhost:80";
const suffix = randomUUID().replaceAll("-", "");
const workspaceId = `ws_check_${suffix}`;
const ownerId = `usr_check_owner_${suffix}`;
const ownerEmail = `owner-${suffix}@checks.invalid`;
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

  await db.insert(phoenixWorkspaces).values({
    id: workspaceId,
    slug: `check-${suffix.slice(0, 24)}`,
    state: template.state,
    isPublic: false,
  });
  await db.insert(phoenixUsers).values({
    id: ownerId,
    email: ownerEmail,
    passwordHash,
    passwordSalt: salt,
    workspaceId,
    name: "Release Check Owner",
    role: "owner",
  });

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