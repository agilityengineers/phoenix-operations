"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

export default function ResetPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = getBrowserSupabase();
    if (supabase && /.+@.+\..+/.test(email)) {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
    }
    // Always confirm — no account enumeration.
    setSent(true);
  };

  return (
    <div className="auth-card">
      <Image src="/assets/mark.png" alt="" width={40} height={40} className="mark" />
      <h1>Reset your password</h1>
      <p className="auth-sub">Enter your email and we&apos;ll send a reset link. It expires in 30 minutes.</p>
      <form className="auth-form" onSubmit={sendReset}>
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
        <button type="submit" className="auth-submit">
          Send reset link
        </button>
        {sent && (
          <div className="auth-success">✓ If that email has an account, a reset link is on its way.</div>
        )}
      </form>
      <p className="auth-foot">
        <Link href="/login" className="auth-link">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
