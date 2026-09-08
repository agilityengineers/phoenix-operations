import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import AuthShell from "@/components/auth/AuthShell";
import {
  authErrorMessage,
  fetchInvitation,
  isLiveInvitation,
  roleLabel,
  takeInviteToken,
  type InvitationPreview,
} from "@/lib/auth";
import type { WorkspaceMembership } from "@/lib/types";

export default function LoginPage() {
  const [_, setLocation] = useLocation();
  const [inviteToken] = useState(takeInviteToken);
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // An invitation reaching a returning user lands here: show what they are being
  // asked to join, and prefill the address it was sent to so the two match.
  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    void fetchInvitation(inviteToken).then((preview) => {
      if (cancelled) return;
      if (!isLiveInvitation(preview)) {
        setError(authErrorMessage("invalid_or_expired_invite"));
        return;
      }
      setInvitation(preview);
      setEmail((current) => current || preview.email);
    });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!response.ok) throw new Error("Invalid email or password.");
      const session = await response.json() as {
        user?: { role?: string };
        workspace?: { id?: string };
        workspaces?: WorkspaceMembership[];
      };
      if (!session.user?.role || !session.workspace?.id) {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        throw new Error("Your account does not have valid workspace access.");
      }
      // The picker page also redeems invitations, so send anyone arriving with a
      // token there — and anyone with a choice of workspaces to make.
      if (inviteToken) {
        setLocation("/workspaces");
        return;
      }
      if ((session.workspaces?.length ?? 1) > 1) {
        setLocation("/workspaces");
        return;
      }
      setLocation("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    setError("Google sign-in is currently unavailable. Please use your workspace email and password.");
  };

  return (
    <AuthShell>
      <div className="auth-card">
        <img src="/assets/mark.png" alt="" width={40} height={40} className="mark" />
        <h1>{invitation ? "Sign in to join the workspace" : "Sign in to your workspace"}</h1>
        <p className="auth-sub">
          {invitation
            ? `${invitation.workspaceName} invited ${invitation.email} to join as ${roleLabel(invitation.role)}. Signing in adds it to your account — the workspaces you already use stay exactly as they are.`
            : "Funnels, pipeline, and everything in between."}
        </p>
        <form className="auth-form" onSubmit={signIn}>
          <label className="field">
            Work email
            <input
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="auth-row">
            <label className="auth-check">
              <input type="checkbox" defaultChecked /> Remember me
            </label>
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? "Signing in…" : invitation ? "Sign in and join" : "Sign in"}
          </button>
          <div className="auth-divider">
            <span />
            or
            <span />
          </div>
          <button type="button" className="auth-google" onClick={signInWithGoogle}>
            <span className="g">G</span> Continue with Google
          </button>
        </form>
        <p className="auth-foot">
          {invitation && !invitation.accountExists ? (
            <>
              No account for {invitation.email} yet?{" "}
              <Link href="/signup" className="auth-link">
                Create one and join
              </Link>
            </>
          ) : (
            <>
              New partner?{" "}
              <Link href="/signup" className="auth-link">
                Create your workspace
              </Link>
            </>
          )}
        </p>
      </div>
    </AuthShell>
  );
}
