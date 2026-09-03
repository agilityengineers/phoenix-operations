"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";

// 3-step partner-workspace signup:
//   1) account (name, email, password, invite code)
//   2) practice type + brand name + subdomain
//   3) plan pick → Stripe Checkout (14-day trial)

const PRACTICE_TYPES = ["EOS Implementer", "Operations Consultant", "Business Coach", "Other professional"];

const PLANS = [
  { name: "Solo", price: "$79", blurb: "1 user · 2 funnels · CRM · Zapier" },
  { name: "Practice", price: "$179", blurb: "5 users · unlimited funnels · HubSpot sync · custom domain" },
  { name: "Network", price: "$399", blurb: "Unlimited users · multi-workspace · partner rollup analytics" },
];

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    inviteCode: "",
    practiceType: "EOS Implementer",
    brandName: "",
    subdomain: "",
    plan: "Practice",
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form, value: string) => {
    setError("");
    setForm((f) => ({ ...f, [key]: value }));
  };

  const next = async () => {
    if (step === 1) {
      if (!form.name.trim() || !/.+@.+\..+/.test(form.email) || form.password.length < 8) {
        setError("Name, a valid email, and a password of 8+ characters are required.");
        return;
      }
      if (!form.inviteCode.trim()) {
        setError("Partner signup is gated by an invite code from your Phoenix Operations contact.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!form.brandName.trim()) {
        setError("Give your practice a brand name — it appears on every client-facing page.");
        return;
      }
      setStep(3);
      return;
    }
    // Step 3 — create the account, then hand off to Stripe Checkout.
    setBusy(true);
    setError("");
    try {
      const supabase = getBrowserSupabase();
      if (supabase) {
        const { error: err } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: {
              full_name: form.name,
              invite_code: form.inviteCode,
              practice_type: form.practiceType,
              brand_name: form.brandName,
              subdomain: form.subdomain,
              plan: form.plan,
            },
          },
        });
        if (err) {
          setError(err.message);
          setBusy(false);
          return;
        }
      }
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: form.plan.toLowerCase(), email: form.email }),
      });
      const body = (await res.json()) as { url?: string | null };
      if (body.url) {
        window.location.href = body.url;
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card wide">
      <div className="signup-head">
        <div>
          <h1 style={{ margin: 0 }}>Create your partner workspace</h1>
          <p className="auth-sub">
            Your own white-labeled funnels, CRM, and guide page — connected to the Phoenix
            Operations network.
          </p>
        </div>
        <span className="signup-step">Step {step} of 3</span>
      </div>
      <div className="signup-progress">
        <div style={{ width: `${step * 33.4}%` }} />
      </div>

      {step === 1 && (
        <div className="signup-grid">
          <label className="field">
            Your name
            <input
              placeholder="First and last name"
              autoComplete="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </label>
          <label className="field">
            Work email
            <input
              type="email"
              placeholder="you@yourfirm.com"
              autoComplete="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              placeholder="8+ characters"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
          </label>
          <label className="field">
            <span>
              Invite code{" "}
              <span style={{ fontWeight: 400, color: "var(--muted-3)" }}>
                (from your Phoenix Operations contact)
              </span>
            </span>
            <input
              placeholder="e.g. PHX-4F7K"
              value={form.inviteCode}
              onChange={(e) => set("inviteCode", e.target.value)}
            />
          </label>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>
              What kind of practice do you run?
            </p>
            <div className="type-row">
              {PRACTICE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`type-chip${form.practiceType === t ? " selected" : ""}`}
                  onClick={() => set("practiceType", t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="signup-grid">
            <label className="field">
              Practice / brand name
              <input
                placeholder="e.g. Summit Operations"
                value={form.brandName}
                onChange={(e) => set("brandName", e.target.value)}
              />
            </label>
            <label className="field">
              Preferred subdomain
              <input
                placeholder="summit → summit.phoenixops.app"
                value={form.subdomain}
                onChange={(e) => set("subdomain", e.target.value.replace(/[^a-z0-9-]/g, ""))}
              />
            </label>
          </div>
          <p className="signup-hint">
            You can connect a custom domain and upload your logo after setup — everything
            client-facing is white-labeled.
          </p>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Pick your plan</p>
          <div className="plan-pick-grid">
            {PLANS.map((p) => (
              <button
                key={p.name}
                type="button"
                className={`plan-pick${form.plan === p.name ? " selected" : ""}`}
                onClick={() => set("plan", p.name)}
              >
                <span className="name">{p.name}</span>
                <span className="price">
                  {p.price}
                  <span className="per">/mo</span>
                </span>
                <span className="blurb">{p.blurb}</span>
              </button>
            ))}
          </div>
          <p className="signup-hint">
            14-day free trial on every plan. Card collected at checkout via Stripe — cancel anytime.
          </p>
        </div>
      )}

      {error && (
        <div className="auth-error" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <div className="signup-nav">
        <button
          type="button"
          className={`signup-back${step === 1 ? " hidden" : ""}`}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
        >
          ← Back
        </button>
        <button type="button" className="signup-next" onClick={next} disabled={busy}>
          {step === 3 ? (busy ? "Starting…" : "Start free trial") : "Continue →"}
        </button>
      </div>

      {done && (
        <div className="auth-success" style={{ marginTop: 18 }}>
          ✓ Workspace created — check your email to verify, then you&apos;ll land in onboarding (logo,
          guide profile, first funnel).
        </div>
      )}
    </div>
  );
}
