import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import AuthShell from "@/components/auth/AuthShell";
import {
  acceptInvitation,
  authErrorMessage,
  clearInviteToken,
  enterWorkspace,
  fetchInvitation,
  fetchSession,
  isLiveInvitation,
  roleLabel,
  takeInviteToken,
  type InvitationPreview,
} from "@/lib/auth";
import type { WorkspaceMembership } from "@/lib/types";

// Where a signed-in account chooses which workspace to work in, and where an
// invitation is redeemed once its recipient already has an account. A pending
// invitation token (handed over by the signup or login page) is accepted here
// and its workspace added; with no token this is just the picker.

export default function WorkspacesPage() {
  const [, setLocation] = useLocation();
  const [token] = useState(takeInviteToken);
  const [workspaces, setWorkspaces] = useState<WorkspaceMembership[]>([]);
  const [activeId, setActiveId] = useState("");
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [joined, setJoined] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const goToAdmin = useCallback(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.replace(`${base}/admin`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await fetchSession();
      if (cancelled) return;
      if (!session) {
        setLocation("/login");
        return;
      }
      setWorkspaces(session.workspaces);
      setActiveId(session.workspace.id);

      if (!token) {
        setLoading(false);
        return;
      }
      const preview = await fetchInvitation(token);
      if (cancelled) return;
      if (!isLiveInvitation(preview)) {
        clearInviteToken();
        setError(authErrorMessage("invalid_or_expired_invite"));
        setLoading(false);
        return;
      }
      setInvitation(preview);
      if (!preview.acceptableNow) {
        // Signed in as somebody else. Say so plainly rather than silently
        // dropping the invitation on the floor.
        setError(authErrorMessage("invite_email_mismatch"));
        setLoading(false);
        return;
      }
      try {
        const accepted = await acceptInvitation(token);
        clearInviteToken();
        if (cancelled) return;
        setWorkspaces(accepted.workspaces);
        setActiveId(accepted.workspace.id);
        setJoined(accepted.workspace.name);
      } catch (err) {
        clearInviteToken();
        if (!cancelled) setError(authErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setLocation, token]);

  const enter = async (workspace: WorkspaceMembership) => {
    setError("");
    setBusy(workspace.id);
    try {
      await enterWorkspace(workspace.id);
      goToAdmin();
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy("");
    }
  };

  const signOut = async () => {
    clearInviteToken();
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setLocation("/login");
  };

  return (
    <AuthShell>
      <div className="auth-card wide">
        <h1 style={{ margin: 0 }}>{token ? "Your workspaces" : "Choose a workspace"}</h1>
        <p className="auth-sub">
          {joined
            ? `You have joined ${joined}. Your existing workspaces are untouched — pick where you want to work.`
            : "You belong to more than one workspace. Pick the one you want to open; you can switch at any time from the sidebar."}
        </p>

        {invitation && !joined && !error && (
          <div className="ws-invite-note">
            Invitation to <strong>{invitation.workspaceName}</strong> as {roleLabel(invitation.role)}.
          </div>
        )}

        {error && <div className="auth-error" style={{ marginTop: 16 }}>{error}</div>}

        {loading ? (
          <p className="signup-hint" style={{ marginTop: 20 }}>Loading your workspaces…</p>
        ) : (
          <div className="ws-list">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                className={`ws-option${workspace.id === activeId ? " current" : ""}`}
                onClick={() => void enter(workspace)}
                disabled={Boolean(busy)}
              >
                <span className="ws-option-main">
                  <span className="name">{workspace.name}</span>
                  <span className="slug">{workspace.slug}</span>
                </span>
                <span className="ws-option-side">
                  <span className="pill">{roleLabel(workspace.role)}</span>
                  <span className="go">{busy === workspace.id ? "Opening…" : "Open →"}</span>
                </span>
              </button>
            ))}
            {!workspaces.length && (
              <p className="signup-hint">
                Your account does not belong to any workspace yet. Ask an administrator to invite you.
              </p>
            )}
          </div>
        )}

        <p className="auth-foot">
          <button type="button" className="auth-link linklike" onClick={() => void signOut()}>
            Sign in as someone else
          </button>
        </p>
      </div>
    </AuthShell>
  );
}
