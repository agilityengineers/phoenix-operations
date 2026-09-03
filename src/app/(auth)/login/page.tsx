"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const supabase = getBrowserSupabase();
    if (!supabase) {
      // Demo mode — no auth backend; straight to the workspace.
      router.push("/admin");
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/admin");
    router.refresh();
  };

  const signInWithGoogle = async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      router.push("/admin");
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/admin` },
    });
  };

  return (
    <div className="auth-card">
      <Image src="/assets/mark.png" alt="" width={40} height={40} className="mark" />
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
          <Link href="/reset" className="auth-link">
            Forgot password?
          </Link>
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
  );
}
