import { Link, useLocation } from "wouter";
import { useState } from "react";
import AuthShell from "@/components/auth/AuthShell";

export default function LoginPage() {
  const [_, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!response.ok) throw new Error("Invalid email or password.");
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
        <h1>Sign in to your workspace</h1>
        <p className="auth-sub">Funnels, pipeline, and everything in between.</p>
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
            {busy ? "Signing in…" : "Sign in"}
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
          New partner?{" "}
          <Link href="/signup" className="auth-link">
            Create your workspace
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
