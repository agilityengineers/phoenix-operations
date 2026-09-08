import { useState } from "react";
import { useLocation } from "wouter";
import AuthShell from "@/components/auth/AuthShell";

// One-time claim of the Phoenix Operations workspace. The link comes from the
// private deployment logs. An email that already signs in is moved into the
// Phoenix workspace as super admin after proving its password; a new email
// creates the super admin account.

const ERROR_COPY: Record<string, string> = {
  invalid_or_expired_token: "This claim link is invalid or has expired. Restart the deployment to print a fresh one in the logs.",
  invalid_credentials: "That password does not match the existing login for this email.",
  bootstrap_not_required: "This workspace already has a super admin. Sign in instead.",
  validation_failed: "Check the fields. A new account needs a name and a password of 8+ characters with upper and lowercase letters and a number.",
  email_taken: "That email is already in use.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  auth_unavailable: "The server has no session secret yet, so accounts cannot be created.",
};

export default function BootstrapPage() {
  const [, navigate] = useLocation();
  const [token, setToken] = useState(() => new URLSearchParams(window.location.search).get("token") ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/bootstrap", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, name, email, password }) });
      if (!response.ok) throw new Error((await response.json().catch(() => ({ error: "bootstrap_failed" }))).error);
      navigate("/admin");
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(ERROR_COPY[code] ?? "Unable to claim the workspace.");
    }
    finally { setBusy(false); }
  };
  return <AuthShell><div className="auth-card">
    <h1>Claim the Phoenix Operations workspace</h1>
    <p className="auth-sub">Use the one-time claim link from the private deployment logs. Links expire after 60 minutes. Sign in with an existing login to move it here as super admin, or enter a new email to create the super admin account.</p>
    <label className="field">Claim token<input value={token} onChange={e => setToken(e.target.value)} autoComplete="off" /></label>
    <label className="field">Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
    <label className="field">Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Your current password, or a new strong one" /></label>
    <label className="field">Name<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Required for a new account" /></label>
    {error && <div className="auth-error">{error}</div>}
    <button type="button" className="signup-next" disabled={busy} onClick={submit}>{busy ? "Claiming…" : "Claim as super admin"}</button>
  </div></AuthShell>;
}
