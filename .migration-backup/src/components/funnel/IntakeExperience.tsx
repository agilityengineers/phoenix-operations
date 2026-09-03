"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Funnel, FunnelVariant, GuideProfile, IntakeAnswers, UtmParams } from "@/lib/types";

// The funnel landing + 5-step qualifying intake + scheduler.
// Answers persist to localStorage immediately and sync to the server
// (debounced) so a returning visitor resumes at their step — on this device
// via localStorage, across devices via the resume token in the URL.

const CONTROL_OPTS = [
  "Scheduling & operations",
  "Cash flow & finances",
  "Quality of work",
  "My own calendar",
  "Team accountability",
];
const STEP_AWAY_OPTS = [
  "Things run fine without me",
  "Small stuff slips, big stuff waits for me",
  "Fires start within days",
  "Honestly? I never fully step away",
];
const INDUSTRY_OPTS = [
  "Trades / home services",
  "Construction",
  "Professional services",
  "Manufacturing",
  "Retail / e-commerce",
  "Other",
];
const REVENUE_OPTS = ["Under $500K", "$500K–$1M", "$1M–$3M", "$3M–$10M", "$10M+"];
const EMPLOYEE_OPTS = ["1–3", "4–10", "11–25", "26–50", "50+"];
const CLIENT_OPTS = ["Under 25", "25–100", "100–500", "500+"];
const YEARS_OPTS = ["Under 3 years", "3–10 years", "10+ years"];
const ROLE_OPTS = ["Owner / Founder", "CEO / President", "COO / Operations", "Other leadership", "Other"];
const OWNER_JOIN_OPTS = ["Yes", "Maybe", "No"];
const COACH_OPTS = ["Yes, currently", "Have in the past", "No, never", "In a peer group"];
const URGENCY_OPTS = ["Now — this quarter", "In the next 6 months", "Just exploring"];

const STEP_TITLES: Record<number, string> = {
  1: "Let's start with what's happening",
  2: "A bit about the business",
  3: "How to reach you",
  4: "Two honest questions",
  5: "Review and submit",
};

const SCHEDULE_DAYS = [
  { label: "Mon 9/7", slots: ["9:15 AM", "11:30 AM", "2:00 PM", "4:15 PM"] },
  { label: "Tue 9/8", slots: ["9:15 AM", "11:30 AM", "2:00 PM", "4:15 PM"] },
  { label: "Wed 9/9", slots: ["9:15 AM", "11:30 AM", "2:00 PM", "4:15 PM"] },
  { label: "Thu 9/10", slots: ["9:15 AM", "11:30 AM", "2:00 PM", "4:15 PM"] },
  { label: "Fri 9/11", slots: ["9:15 AM", "11:30 AM", "2:00 PM", "4:15 PM"] },
];

type Persisted = {
  step: number;
  a: IntakeAnswers;
  submitted: boolean;
  bookedSlot: string | null;
  resumeToken: string;
  contactId?: string;
  utm?: UtmParams;
};

function makeToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `tok_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// Step 1's two pick-lists are both multi-select.
type MultiField = "leastControl" | "stepAway";
const MULTI_FIELDS: MultiField[] = ["leastControl", "stepAway"];

// Saved progress may predate stepAway becoming multi-select — widen any single
// stored string back into a list so a returning visitor keeps their answer.
function normalizeAnswers(saved: IntakeAnswers | undefined): IntakeAnswers {
  const a: IntakeAnswers = { leastControl: [], ...saved };
  for (const f of MULTI_FIELDS) {
    const v: unknown = a[f];
    if (typeof v === "string") a[f] = v ? [v] : [];
    else if (!Array.isArray(v)) a[f] = [];
  }
  return a;
}

type Props = {
  funnel: Funnel;
  variant: FunnelVariant;
  guide: GuideProfile;
};

export default function IntakeExperience({ funnel, variant, guide }: Props) {
  const storageKey = `po-intake-${funnel.slug}`;
  const blockEnabled = useCallback(
    (id: string) => funnel.blocks.find((b) => b.id === id)?.enabled ?? true,
    [funnel.blocks]
  );

  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(1);
  const [a, setA] = useState<IntakeAnswers>({ leastControl: [] });
  const [resumed, setResumed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [bookedSlot, setBookedSlot] = useState<string | null>(null);
  const [validationMsg, setValidationMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const tokenRef = useRef<string>("");
  const contactIdRef = useRef<string | undefined>(undefined);
  const utmRef = useRef<UtmParams>({});
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  // Hydrate saved progress + capture UTM/referrer on first mount.
  useEffect(() => {
    let saved: Persisted | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    } catch {
      /* corrupted state — start fresh */
    }
    const params = new URLSearchParams(window.location.search);
    const utm: UtmParams = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const) {
      const v = params.get(k);
      if (v) utm[k] = v;
    }
    if (document.referrer) utm.referrer = document.referrer;

    if (saved?.resumeToken) {
      tokenRef.current = saved.resumeToken;
      contactIdRef.current = saved.contactId;
      utmRef.current = { ...(saved.utm ?? {}), ...utm };
      setStep(saved.step ?? 1);
      setA(normalizeAnswers(saved.a));
      setSubmitted(saved.submitted ?? false);
      setBookedSlot(saved.bookedSlot ?? null);
      setResumed(!saved.submitted && (saved.step ?? 1) > 1);
    } else {
      tokenRef.current = makeToken();
      utmRef.current = utm;
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback(
    (next: Partial<Persisted>) => {
      const data: Persisted = {
        step,
        a,
        submitted,
        bookedSlot,
        resumeToken: tokenRef.current,
        contactId: contactIdRef.current,
        utm: utmRef.current,
        ...next,
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
      } catch {
        /* storage unavailable (private mode) — server sync still applies */
      }
      // Debounced server-side session save → resumable across devices.
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        fetch("/api/intake/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            funnelSlug: funnel.slug,
            variant: variant.id,
            resumeToken: data.resumeToken,
            step: data.step,
            answers: data.a,
            utm: data.utm,
            submitted: data.submitted,
          }),
        }).catch(() => {});
      }, 600);
    },
    [step, a, submitted, bookedSlot, storageKey, funnel.slug, variant.id]
  );

  const setAnswer = useCallback(
    (field: keyof IntakeAnswers, value: string) => {
      setValidationMsg("");
      setA((prev) => {
        const next = { ...prev, [field]: value };
        persist({ a: next });
        return next;
      });
      if (!startedRef.current) {
        startedRef.current = true;
      }
    },
    [persist]
  );

  const toggleAnswer = useCallback(
    (field: MultiField, value: string) => {
      setValidationMsg("");
      setA((prev) => {
        const cur = prev[field] ?? [];
        const nextList = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value];
        const next = { ...prev, [field]: nextList };
        persist({ a: next });
        return next;
      });
    },
    [persist]
  );

  const showOwnerJoin =
    blockEnabled("ownerJoin") &&
    Boolean(a.role) &&
    a.role !== "Owner / Founder" &&
    a.role !== "CEO / President";

  const goBack = () => {
    if (step > 1) {
      const next = step - 1;
      setStep(next);
      persist({ step: next });
    }
  };

  const goNext = async () => {
    if (step === 3) {
      const nameOk = (a.name ?? "").trim().length > 0;
      const emailOk = /.+@.+\..+/.test(a.email ?? "");
      if (!nameOk || !emailOk) {
        setValidationMsg("Name and a valid work email are required to continue.");
        return;
      }
    }
    if (step < 5) {
      const next = step + 1;
      setStep(next);
      setResumed(false);
      persist({ step: next });
      return;
    }
    // Final submit — server computes the score, creates the lead, fires
    // integrations (Zapier events, SendGrid confirmation + owner alert).
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/intake/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funnelSlug: funnel.slug,
          variant: variant.id,
          resumeToken: tokenRef.current,
          answers: a,
          utm: utmRef.current,
          website: honeypot, // honeypot — must be empty
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { contactId?: string };
        contactIdRef.current = body.contactId;
      }
    } catch {
      /* network hiccup — the booking step still works; session is saved */
    }
    setSubmitted(true);
    setSubmitting(false);
    persist({ submitted: true, contactId: contactIdRef.current });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const book = async (day: string, time: string) => {
    const slot = `${day} · ${time}`;
    setBookedSlot(slot);
    persist({ bookedSlot: slot });
    fetch("/api/intake/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeToken: tokenRef.current,
        contactId: contactIdRef.current,
        slot,
        funnelSlug: funnel.slug,
      }),
    }).catch(() => {});
  };

  const reviewRows = useMemo(() => {
    const rows: Array<[string, string | undefined]> = [
      ["Least control", (a.leastControl ?? []).join(", ") || undefined],
      ["Keeps coming back", a.bounceback],
      ["When you step away", (a.stepAway ?? []).join(", ") || undefined],
      ["Industry", a.industry],
      ["Revenue", a.revenue],
      ["Team size", a.employees],
      ["Clients", a.clients],
      ["Years in business", a.years],
      ["Name", a.name],
      ["Email", a.email],
      ["Company", a.company],
      ["Phone", a.phone],
      ["Role", a.role],
      ["Owner joining call", a.ownerJoin],
      ["Coach / peer group", a.coachHistory],
      ["Urgency", a.urgency],
      ["Already tried", a.tried],
    ];
    return rows.filter((r): r is [string, string] => Boolean(r[1]));
  }, [a]);

  const chip = (selected: boolean) => `chip${selected ? " selected" : ""}`;
  const firstName = (a.name || "there").split(" ")[0];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="fnl-header">
        <div className="fnl-header-inner">
          <Link href="/" style={{ display: "flex" }}>
            <Image
              src="/assets/logo.png"
              alt="Phoenix Operations"
              width={202}
              height={60}
              className="site-logo"
              style={{ height: "auto", maxHeight: 60, width: "auto" }}
              priority
            />
          </Link>
          <span className="fnl-header-note">Free 15-minute conversation · No pitch</span>
        </div>
      </header>

      <div style={{ flex: 1 }}>
        {!submitted && (
          <>
            <section className="fnl-hero">
              <div>
                <p className="kicker">{funnel.kicker}</p>
                <h1>{hydrated ? variant.headline : funnel.variants[0]?.headline}</h1>
                <div className="accent-rule" />
                <p className="fnl-problem">{funnel.problemCopy}</p>
                <div className="fnl-cta-row">
                  <a href="#intake" className="btn-primary">
                    Start the conversation <span className="arrow">→</span>
                  </a>
                  <span className="fnl-cta-note">
                    Takes about 2 minutes.
                    <br />
                    Then pick a time that works.
                  </span>
                </div>
              </div>
              <div className="stakes-card">
                <p className="title">Sound familiar?</p>
                <div className="stakes-list">
                  {funnel.stakes.map((s) => (
                    <div key={s} className="stake">
                      <span className="stake-check">✓</span>
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
                <div className="guide-note">
                  <Image src={guide.photoUrl} alt={guide.name} width={56} height={56} />
                  <p>
                    <strong>I&apos;ve sat in your seat.</strong> I know how to ask the questions that
                    get you above the weeds—so you can see the obstacles clearly and decide what
                    needs attention first.
                  </p>
                </div>
              </div>
            </section>

            <section id="intake" className="intake">
              <div className="intake-inner">
                <div className="intake-head">
                  <h2>{STEP_TITLES[step]}</h2>
                  <span className="intake-step-label">Step {step} of 5</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${step * 20}%` }} />
                </div>
                {resumed && (
                  <p className="resume-note">
                    Welcome back — we saved your answers so you can pick up where you left off.
                  </p>
                )}

                {/* Honeypot — bots fill it, humans never see it */}
                <div className="hp-field" aria-hidden="true">
                  <label>
                    Website
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </label>
                </div>

                {step === 1 && blockEnabled("frustration") && (
                  <div className="intake-body">
                    <div>
                      <p className="q-label">
                        Where do you feel you have the least control in the business?
                      </p>
                      <p className="q-hint">Pick all that apply.</p>
                      <div className="chip-row">
                        {CONTROL_OPTS.map((o) => (
                          <button
                            key={o}
                            type="button"
                            className={chip((a.leastControl ?? []).includes(o))}
                            onClick={() => toggleAnswer("leastControl", o)}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="q-label">
                        What keeps coming back to you that should be handled by someone else?
                      </p>
                      <textarea
                        rows={3}
                        value={a.bounceback ?? ""}
                        placeholder="e.g. Every pricing call, every hiring decision, every unhappy customer…"
                        onChange={(e) => setAnswer("bounceback", e.target.value)}
                      />
                    </div>
                    <div>
                      <p className="q-label">What happens when you step away?</p>
                      <p className="q-hint">Pick all that apply.</p>
                      <div className="chip-col">
                        {STEP_AWAY_OPTS.map((o) => (
                          <button
                            key={o}
                            type="button"
                            className={chip((a.stepAway ?? []).includes(o))}
                            onClick={() => toggleAnswer("stepAway", o)}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && blockEnabled("firmographics") && (
                  <div className="intake-body">
                    <div>
                      <p className="q-label">What industry are you in?</p>
                      <div className="chip-row">
                        {INDUSTRY_OPTS.map((o) => (
                          <button
                            key={o}
                            type="button"
                            className={chip(a.industry === o)}
                            onClick={() => setAnswer("industry", o)}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="contact-grid">
                      <div>
                        <p className="q-label sm">Annual revenue</p>
                        <div className="chip-col tight">
                          {REVENUE_OPTS.map((o) => (
                            <button
                              key={o}
                              type="button"
                              className={chip(a.revenue === o)}
                              onClick={() => setAnswer("revenue", o)}
                            >
                              {o}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="q-label sm">Team size</p>
                        <div className="chip-col tight">
                          {EMPLOYEE_OPTS.map((o) => (
                            <button
                              key={o}
                              type="button"
                              className={chip(a.employees === o)}
                              onClick={() => setAnswer("employees", o)}
                            >
                              {o}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="q-label sm">Active clients / customers</p>
                        <div className="chip-col tight">
                          {CLIENT_OPTS.map((o) => (
                            <button
                              key={o}
                              type="button"
                              className={chip(a.clients === o)}
                              onClick={() => setAnswer("clients", o)}
                            >
                              {o}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="q-label sm">Years in business</p>
                        <div className="chip-col tight">
                          {YEARS_OPTS.map((o) => (
                            <button
                              key={o}
                              type="button"
                              className={chip(a.years === o)}
                              onClick={() => setAnswer("years", o)}
                            >
                              {o}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && blockEnabled("contact") && (
                  <div className="intake-body" style={{ gap: 28 }}>
                    <div className="contact-grid">
                      <label className="field">
                        Your name *
                        <input
                          value={a.name ?? ""}
                          placeholder="First and last name"
                          autoComplete="name"
                          onChange={(e) => setAnswer("name", e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Work email *
                        <input
                          type="email"
                          value={a.email ?? ""}
                          placeholder="you@company.com"
                          autoComplete="email"
                          onChange={(e) => setAnswer("email", e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Company
                        <input
                          value={a.company ?? ""}
                          placeholder="Company name"
                          autoComplete="organization"
                          onChange={(e) => setAnswer("company", e.target.value)}
                        />
                      </label>
                      <label className="field">
                        Phone
                        <input
                          type="tel"
                          value={a.phone ?? ""}
                          placeholder="(555) 000-0000"
                          autoComplete="tel"
                          onChange={(e) => setAnswer("phone", e.target.value)}
                        />
                      </label>
                    </div>
                    <div>
                      <p className="q-label sm">Your role</p>
                      <div className="chip-row">
                        {ROLE_OPTS.map((o) => (
                          <button
                            key={o}
                            type="button"
                            className={chip(a.role === o)}
                            onClick={() => setAnswer("role", o)}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                    {showOwnerJoin && (
                      <div className="owner-join">
                        <p className="q-label">
                          Since you&apos;re not the owner — will the owner join the conversation?
                        </p>
                        <div className="chip-row">
                          {OWNER_JOIN_OPTS.map((o) => (
                            <button
                              key={o}
                              type="button"
                              className={chip(a.ownerJoin === o)}
                              onClick={() => setAnswer("ownerJoin", o)}
                            >
                              {o}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="q-label sm">Do you work with a coach or peer group today?</p>
                      <div className="chip-row">
                        {COACH_OPTS.map((o) => (
                          <button
                            key={o}
                            type="button"
                            className={chip(a.coachHistory === o)}
                            onClick={() => setAnswer("coachHistory", o)}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="q-label sm">How soon do you want to make a change?</p>
                      <div className="chip-row">
                        {URGENCY_OPTS.map((o) => (
                          <button
                            key={o}
                            type="button"
                            className={chip(a.urgency === o)}
                            onClick={() => setAnswer("urgency", o)}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="validation-msg" role="alert">
                      {validationMsg}
                    </p>
                  </div>
                )}

                {step === 4 && blockEnabled("coachability") && (
                  <div className="intake-body">
                    <p className="review-intro" style={{ margin: 0 }}>
                      Honest answers make the conversation useful. There are no wrong answers here.
                    </p>
                    {(
                      [
                        {
                          field: "coachAdmit" as const,
                          q: "I can admit that some of what’s holding the business back needs help from outside my own head.",
                        },
                        {
                          field: "coachOpen" as const,
                          q: "I’m open to being challenged on how I lead and how the business runs.",
                        },
                      ]
                    ).map((L) => (
                      <div key={L.field}>
                        <p className="q-label">{L.q}</p>
                        <div className="likert-row">
                          {["1", "2", "3", "4", "5"].map((v) => (
                            <button
                              key={v}
                              type="button"
                              className={chip(a[L.field] === v)}
                              onClick={() => setAnswer(L.field, v)}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                        <div className="likert-scale">
                          <span>Strongly disagree</span>
                          <span>Strongly agree</span>
                        </div>
                      </div>
                    ))}
                    <div>
                      <p className="q-label">What have you already tried?</p>
                      <textarea
                        rows={3}
                        value={a.tried ?? ""}
                        placeholder="New hires, software, delegating, consultants…"
                        onChange={(e) => setAnswer("tried", e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div style={{ marginTop: 36 }}>
                    <p className="review-intro">
                      Here&apos;s what you&apos;ve shared. If it looks right, submit and pick a time for your
                      15-minute conversation.
                    </p>
                    <div className="review-table">
                      {reviewRows.map(([k, v]) => (
                        <div key={k} className="review-row">
                          <span className="k">{k}</span>
                          <span className="v">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="intake-footer">
                  <button type="button" className={`btn-back${step === 1 ? " hidden" : ""}`} onClick={goBack}>
                    ← Back
                  </button>
                  <button type="button" className="btn-continue" onClick={goNext} disabled={submitting}>
                    {step === 5 ? (submitting ? "Submitting…" : "Submit & pick a time") : "Continue →"}
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {submitted && (
          <section className="scheduler">
            <div className="scheduler-head">
              <span className="success-disc">✓</span>
              <h1>Thanks, {firstName}. Last step: pick a time.</h1>
              <p>
                15 minutes. No prep, no pressure. A confirmation and calendar invite will land in
                your inbox.
              </p>
            </div>
            {!bookedSlot ? (
              <div className="slot-card">
                <div className="slot-card-head">
                  <p className="week">Week of September 7</p>
                  <span className="tz">All times Eastern · 15 min</span>
                </div>
                <div className="slot-grid">
                  {SCHEDULE_DAYS.map((d) => (
                    <div key={d.label} className="slot-col">
                      <div className="slot-day-label">{d.label}</div>
                      {d.slots.map((s) => (
                        <button key={s} type="button" className="slot-btn" onClick={() => book(d.label, s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="booked-card">
                <p className="kicker">You&apos;re booked</p>
                <p className="booked-slot">{bookedSlot} Eastern</p>
                <p className="booked-note">
                  Confirmation sent to {a.email}. Come ready to talk about the issue creating the
                  most frustration right now — nothing else to prepare.
                </p>
                <Link href="/">← Back to the site</Link>
              </div>
            )}
            <p className="no-pitch-note">
              This is a conversation, not a sales pitch. If I can help, great. If I can&apos;t, I&apos;ll
              tell you.
            </p>
          </section>
        )}
      </div>

      <footer className="fnl-footer">
        <div className="fnl-footer-inner">
          <span>© 2026 Phoenix Operations. All rights reserved.</span>
          <Link href="/admin">Admin</Link>
        </div>
      </footer>
    </div>
  );
}
