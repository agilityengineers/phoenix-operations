import type { Role, WorkspaceMembership } from "./types";

// Everything the auth pages need to know about who is signed in and which
// workspaces they may enter. One account can now belong to several workspaces,
// so the active one lives in the session cookie and is swapped server-side.

export interface AuthSession {
  user: { email: string; name: string; role: Role };
  workspace: { id: string; name: string; role: Role };
  workspaces: WorkspaceMembership[];
}

export interface InvitationPreview {
  email: string;
  role: Role;
  expiresAt: string;
  workspace: { id: string; name: string };
  /** An account already exists for the invited address, so it has to be signed into. */
  accountExists: boolean;
  /** Email of the account currently signed in, or null when nobody is. */
  signedInAs: string | null;
  /** The session in this browser is the one the invitation was addressed to. */
  acceptableNow: boolean;
}

const post = async <T>(path: string, body?: unknown): Promise<T> => {
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(String(value.error ?? "request_failed"));
  return value as T;
};

export const inviteTokenFromUrl = () =>
  new URLSearchParams(window.location.search).get("invite") ?? "";

/** The signed-in session, or null when the cookie is missing, stale, or workspace-less. */
export const fetchSession = async (): Promise<AuthSession | null> => {
  const response = await fetch("/api/auth/session", { credentials: "include" });
  if (!response.ok) return null;
  return (await response.json()) as AuthSession;
};

/** What an invitation link offers, or null when it is used, expired, or revoked. */
export const fetchInvitation = async (token: string): Promise<InvitationPreview | null> => {
  if (!token) return null;
  const response = await fetch(`/api/auth/invitation?token=${encodeURIComponent(token)}`, {
    credentials: "include",
  });
  if (!response.ok) return null;
  return ((await response.json()) as { invitation: InvitationPreview }).invitation;
};

/** Adds the invited workspace to the signed-in account and makes it the active one. */
export const acceptInvitation = (token: string) =>
  post<{ workspace: { id: string; name: string; role: Role }; workspaces: WorkspaceMembership[] }>(
    "/api/auth/invitation/accept",
    { token },
  );

/** Moves the session into another workspace the account already belongs to. */
export const enterWorkspace = (workspaceId: string) =>
  post<AuthSession>("/api/auth/workspace", { workspaceId });

/** Human-readable copy for the failures these flows can surface. */
export const authErrorMessage = (error: unknown) => {
  const code = error instanceof Error ? error.message : String(error);
  switch (code) {
    case "invalid_or_expired_invite":
      return "That invitation is no longer valid — it may have been used, revoked, or expired. Ask the workspace administrator for a fresh one.";
    case "invite_email_mismatch":
      return "This invitation was sent to a different email address. Sign in with the invited address to accept it.";
    case "invited_workspace_unavailable":
      return "The workspace behind this invitation is no longer available.";
    case "workspace_access_denied":
      return "You no longer have access to that workspace.";
    case "no_workspace_access":
      return "Your account does not have access to any workspace yet.";
    case "account_exists":
      return "An account already exists for that email address.";
    case "email_taken":
      return "An account already exists for that email address. Sign in instead.";
    case "unauthorized":
      return "Please sign in to continue.";
    case "invites_unavailable":
    case "auth_unavailable":
      return "Sign-in is temporarily unavailable. Please try again shortly.";
    default:
      return "Something went wrong. Please try again.";
  }
};

export const roleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);
