import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import AuthShell from "@/components/auth/AuthShell";
import {
  authErrorMessage,
  fetchInvitation,
  inviteTokenFromUrl,
  roleLabel,
  type InvitationPreview,
} from "@/lib/auth";

// 3-step self-service workspace signup:
//   1) account (name, email, password)
//   2) practice type + brand name + subdomain
//   3) plan pick → Stripe Checkout (14-day trial)

const PRACTICE_TYPES = ["EOS Implementer", "Operations Consultant", "Business Coach", "Other professional"];

const PLANS = [
  { name: "Solo", price: "$79", blurb: "1 user · 2 funnels · CRM" },
  { name: "Practice", price: "$179", blurb: "5 users · unlimited funnels · custom domain" },
  { name: "Network", price: "$399", blurb: "Unlimited users · multi-workspace · partner rollup analytics" },
];

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const [inviteToken] = useState(inviteTokenFromUrl);
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    practiceType: "EOS Implementer",
    brandName: "",
    subdomain: "",
    plan: "Practice",
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  // Set when the invited address already has an account. Signup cannot help
  // there — the workspace has to be added to that identity instead of a new one.
  const [existingAccount, setExistingAccount] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    void fetchInvitation(inviteToken).then((preview) => {
      if (cancelled) return;
      if (!preview) {
        setError(authErrorMessage("invalid_or_expired_invite"));
        return;
      }
      setInvitation(preview);
      setExistingAccount(preview.accountExists);
      setForm((f) => ({ ...f, email: f.email || preview.email }));
    });
    return () => {
      cancelled = true;
    };
  }, [inviteToken]);

  const set = (key: keyof typeof form, value: string) => {
    setError("");
    if (key === "email") setExistingAccount(false);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const createAccount = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...(inviteToken ? { inviteToken } : {}) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "request_failed" }))).error);
      setDone(true);
      setLocation("/admin");
    } catch (err) {
      const code = err instanceof Error ? err.message : "request_failed";
      if (code === "account_exists" || code === "email_taken") setExistingAccount(true);
      setError(authErrorMessage(code));
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (step === 1) {
      if (!form.name.trim() || !/.+@.+\..+/.test(form.email) || form.password.length < 8) {
        setError("Name, a valid email, and a password of 8+ characters are required.");
        return;
      }
      if (inviteToken) {
        await createAccount();
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
    // Create the account first; billing can be configured separately.
    await createAccount();
  };

  return (
    <AuthShell>
      <div className="auth-card wide">
        <div className="signup-head">
          <div>
            <h1 style={{ margin: 0 }}>{inviteToken ? "Accept your workspace invitation" : "Create your partner workspace"}</h1>
            <p className="auth-sub">
              {invitation
                ? `${invitation.workspace.name} invited ${invitation.email} to join as ${roleLabel(invitation.role)}. Create your account to accept.`
                : inviteToken
                  ? "Create your account to join the workspace with the role selected by its administrator."
                  : "Start a workspace for your white-labeled funnels, CRM, and guide page. No invite code is required."}
            </p>
          </div>
          <span className="signup-step">Step {step} of {inviteToken ? 1 : 3}</span>
        </div>
        <div className="signup-progress">
          <div style={{ width: inviteToken ? "100%" : `${step * 33.4}%` }} />
        </div>

        {invitation?.accountExists && !error && (
          <div className="ws-invite-note" style={{ marginTop: 16 }}>
            {invitation.email} already has an account.{" "}
            <Link href={`/login?invite=${encodeURIComponent(inviteToken)}`} className="auth-link">
              Sign in to add {invitation.workspace.name}
            </Link>{" "}
            — you keep the workspaces you already use.
          </div>
        )}

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
            {existingAccount && (
              <>
                {" "}
                <Link
                  href={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : "/login"}
                  className="auth-link"
                >
                  {inviteToken ? "Sign in to add this workspace" : "Sign in instead"}
                </Link>
                {inviteToken ? " — your current workspaces stay as they are." : ""}
              </>
            )}
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
            ✓ Workspace created. Redirecting to your workspace…
          </div>
        )}
      </div>
    </AuthShell>
  );
}
