import { useState } from "react";
import { useLocation } from "wouter";
import AuthShell from "@/components/auth/AuthShell";

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
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to provision the owner."); }
    finally { setBusy(false); }
  };
  return <AuthShell><div className="auth-card">
    <h1>Provision Phoenix owner</h1>
    <p className="auth-sub">Use the one-time bootstrap URL from the private deployment logs. Tokens expire after 60 minutes.</p>
    <label className="field">Bootstrap token<input value={token} onChange={e => setToken(e.target.value)} autoComplete="off" /></label>
    <label className="field">Name<input value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></label>
    <label className="field">Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
    <label className="field">Strong password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder="12+ characters, upper/lowercase and number" /></label>
    {error && <div className="auth-error">{error}</div>}
    <button type="button" className="signup-next" disabled={busy} onClick={submit}>{busy ? "Provisioning…" : "Create owner"}</button>
  </div></AuthShell>;
}