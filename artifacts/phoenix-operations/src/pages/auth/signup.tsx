import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import AuthShell from "@/components/auth/AuthShell";

// 3-step self-service workspace signup:
//   1) account (name, email, password)
//   2) practice type + brand name + subdomain
//   3) plan pick → Stripe Checkout (14-day trial)
//
// Arriving with ?invite=… collapses that to a single step, and the link is
// checked against the API before the account form is shown at all — nobody
// should type out a password only to be told the link died last week.

const PRACTICE_TYPES = ["EOS Implementer", "Operations Consultant", "Business Coach", "Other professional"];

const PLANS = [
  { name: "Solo", price: "$79", blurb: "1 user · 2 funnels · CRM" },
  { name: "Practice", price: "$179", blurb: "5 users · unlimited funnels · custom domain" },
  { name: "Network", price: "$399", blurb: "Unlimited users · multi-workspace · partner rollup analytics" },
];

type DeadStatus = "invalid" | "expired" | "used" | "revoked" | "workspace_unavailable" | "unavailable";

type InviteCheck =
  | { status: "checking" }
  | { status: "valid"; email: string; role: string; workspaceName: string; expiresAt: string }
  | { status: DeadStatus; expiresAt?: string };

// Why a link cannot be used, in the invitee's language. Every one of these is
// safe to show a stranger: none of them names a workspace or confirms that an
// account exists, and none of them echoes the token back.
const DEAD_LINK: Record<DeadStatus, { title: string; body: string; retry?: boolean }> = {
  expired: {
    title: "This invitation has expired",
    body: "Invitations stay valid for seven days. Ask the person who invited you to send a fresh one — it takes them a moment.",
  },
  used: {
    title: "This invitation has already been used",
    body: "An account was created with it. If that was you, sign in below; otherwise ask your administrator for a new invitation.",
  },
  revoked: {
    title: "This invitation is no longer active",
    body: "It was replaced or withdrawn by a workspace administrator. Check your inbox for a newer invitation, or ask them to resend one.",
  },
  invalid: {
    title: "This invitation link isn't valid",
    body: "The link may have been truncated by your email client. Try copying the full URL from the invitation, or ask your administrator to resend it.",
  },
  workspace_unavailable: {
    title: "This workspace is no longer available",
    body: "The workspace this invitation points to has been removed. Reach out to the person who invited you.",
  },
  unavailable: {
    title: "We couldn't check this invitation",
    body: "Something went wrong reaching the server. Your link is probably fine — try again in a moment.",
    retry: true,
  },
};

// Server error codes are precise but not human. Anything unmapped falls back to
// a generic line rather than leaking a raw code into the UI.
const SUBMIT_ERRORS: Record<string, string> = {
  validation_failed: "Enter your name, a valid email, and a password of at least 8 characters.",
  auth_unavailable: "Accounts can't be created right now. Try again in a few minutes.",
  email_taken: "An account already exists for this email address. Sign in instead.",
  invite_email_mismatch: "This invitation was issued to a different email address.",
  invited_workspace_unavailable: "The workspace behind this invitation is no longer available.",
  invalid_custom_domain: "That custom domain isn't valid.",
  valid_subdomain_required: "Choose a subdomain of letters, numbers, and hyphens.",
  subdomain_taken: "That subdomain is already taken — try another.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
};

const isDead = (value: unknown): value is DeadStatus =>
  typeof value === "string" && value in DEAD_LINK;

const onDate = (value: string | undefined) => {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
};

const roleLabel = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const [inviteToken] = useState(() => new URLSearchParams(window.location.search).get("invite") ?? "");
  const [invite, setInvite] = useState<InviteCheck | null>(inviteToken ? { status: "checking" } : null);
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
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form, value: string) => {
    setError("");
    setForm((f) => ({ ...f, [key]: value }));
  };

  // The token is a bearer credential. Keep it in component state and drop it
  // from the address bar so it stops riding along in history, referrers, and
  // anything the invitee copies or screen-shares from this page.
  useEffect(() => {
    if (!inviteToken) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("invite")) return;
    url.searchParams.delete("invite");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [inviteToken]);

  const checkInvite = useCallback(async () => {
    if (!inviteToken) return;
    setInvite({ status: "checking" });
    try {
      const response = await fetch(`/api/auth/invite?token=${encodeURIComponent(inviteToken)}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("unavailable");
      const value = (await response.json()) as {
        status?: string;
        email?: string;
        role?: string;
        workspaceName?: string;
        expiresAt?: string;
      };
      if (value.status === "valid") {
        setInvite({
          status: "valid",
          email: value.email ?? "",
          role: value.role ?? "staff",
          workspaceName: value.workspaceName ?? "your workspace",
          expiresAt: value.expiresAt ?? "",
        });
        // The server rejects any other address for this token, so the invitee
        // never gets to guess at which mailbox the invitation was sent to.
        setForm((f) => ({ ...f, email: value.email ?? "" }));
        return;
      }
      setInvite({ status: isDead(value.status) ? value.status : "invalid", expiresAt: value.expiresAt });
    } catch {
      setInvite({ status: "unavailable" });
    }
  }, [inviteToken]);

  useEffect(() => {
    void checkInvite();
  }, [checkInvite]);

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
      if (!res.ok) throw new Error((await res.json().catch(() => ({ error: "" }))).error);
      setDone(true);
      setLocation("/admin");
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      // The link can die between opening this page and submitting it. The
      // server is the authority either way, so re-read the status and let the
      // page fall through to the explanation rather than showing a form error.
      if (code === "invalid_or_expired_invite" && inviteToken) {
        await checkInvite();
        return;
      }
      setError(SUBMIT_ERRORS[code] ?? "Unable to create your account. Try again in a moment.");
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

  if (invite?.status === "checking") {
    return (
      <AuthShell>
        <div className="auth-card" role="status" aria-live="polite">
          <h1>Checking your invitation</h1>
          <p className="auth-sub">One moment while we confirm this link is still good.</p>
        </div>
      </AuthShell>
    );
  }

  if (invite && invite.status !== "valid") {
    const copy = DEAD_LINK[invite.status];
    const expiredOn = invite.status === "expired" ? onDate(invite.expiresAt) : "";
    return (
      <AuthShell>
        <div className="auth-card">
          <img src="/assets/mark.png" alt="" width={40} height={40} className="mark" />
          <h1>{copy.title}</h1>
          <p className="auth-sub">
            {copy.body}
            {expiredOn ? ` This one lapsed on ${expiredOn}.` : ""}
          </p>
          {copy.retry ? (
            <button type="button" className="signup-next" style={{ marginTop: 22 }} onClick={() => void checkInvite()}>
              Try again
            </button>
          ) : null}
          <p className="auth-foot">
            <Link href="/login" className="auth-link">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  const accepted = invite?.status === "valid" ? invite : null;
  const expiresOn = onDate(accepted?.expiresAt);

  return (
    <AuthShell>
      <div className="auth-card wide">
        <div className="signup-head">
          <div>
            <h1 style={{ margin: 0 }}>
              {accepted ? `Join ${accepted.workspaceName}` : "Create your partner workspace"}
            </h1>
            <p className="auth-sub">
              {accepted
                ? `You've been invited as ${roleLabel(accepted.role)}. Create your account to join the workspace.`
                : "Start a workspace for your white-labeled funnels, CRM, and guide page. No invite code is required."}
            </p>
          </div>
          <span className="signup-step">Step {step} of {accepted ? 1 : 3}</span>
        </div>
        <div className="signup-progress">
          <div style={{ width: accepted ? "100%" : `${step * 33.4}%` }} />
        </div>

        {accepted && (
          <div className="auth-success" style={{ marginBottom: 20 }}>
            ✓ Invitation confirmed for {accepted.email}
            {expiresOn ? ` — valid through ${expiresOn}` : ""}
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
                readOnly={Boolean(accepted)}
                aria-describedby={accepted ? "invite-email-hint" : undefined}
                onChange={(e) => set("email", e.target.value)}
              />
              {accepted && (
                <span id="invite-email-hint" className="signup-hint" style={{ fontWeight: 400 }}>
                  This invitation is tied to this address.
                </span>
              )}
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
            {accepted
              ? busy
                ? "Joining…"
                : "Accept invitation →"
              : step === 3
                ? busy
                  ? "Starting…"
                  : "Start free trial"
                : "Continue →"}
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
