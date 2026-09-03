import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/site/SiteFooter";

// Private, link-only page: excluded from nav, sitemap, and robots; noindex.
export const metadata: Metadata = {
  title: "What Results Look Like",
  description: "The results come from running on a real operating system.",
  robots: { index: false, follow: false, nocache: true },
};

const bigStats = [
  {
    n: "2.8×",
    label: "Faster growth with a professional implementer",
    sub: "Gallup-validated, propensity-matched study of 305 companies over five years (TrueSpace).",
  },
  {
    n: "100K+",
    label: "Companies have adopted EOS tools",
    sub: "Across trades, services, manufacturing, and more — almost all founder-led, growth-stage businesses.",
  },
  {
    n: "6",
    label: "Key components strengthened",
    sub: "Vision, People, Data, Issues, Process, Traction — the whole business, not one symptom.",
  },
];

const components = [
  {
    n: "V",
    name: "Vision",
    what: "Everyone on your leadership team answers the same eight questions the same way — where you’re going and how you’ll get there.",
    result: "No more side quests. Decisions get easier because direction is clear.",
  },
  {
    n: "P",
    name: "People",
    what: "Right people in the right seats, defined by an Accountability Chart — who owns what, with no overlap and no gaps.",
    result: "The people frustrations stop recycling. Owners stop being the safety net.",
  },
  {
    n: "D",
    name: "Data",
    what: "A weekly scorecard of 5-15 numbers that give you an absolute pulse on the business — no waiting for month-end.",
    result: "You manage from facts, not feelings. Problems surface weeks earlier.",
  },
  {
    n: "I",
    name: "Issues",
    what: "A discipline for surfacing problems and solving them at the root: Identify, Discuss, Solve.",
    result: "Issues get solved once instead of discussed forever.",
  },
  {
    n: "Pr",
    name: "Process",
    what: 'Your core processes documented, simplified, and followed by all — the "franchise-ready" way your business runs.',
    result: "Consistency and quality stop depending on who did the work.",
  },
  {
    n: "T",
    name: "Traction",
    what: "90-day Rocks and a weekly Level 10 Meeting™ pulse that turns the vision into execution.",
    result: "The plan actually happens. Accountability without micromanaging.",
  },
];

const phases = [
  {
    when: "Days 1–90",
    title: "Clarity and traction",
    items: [
      "Accountability Chart in place — every seat owned",
      "First Rocks set; the priorities fight ends",
      "Weekly Level 10 Meetings running — shorter, useful meetings",
      "Scorecard live: a real pulse on the business",
    ],
  },
  {
    when: "Months 3–12",
    title: "Momentum",
    items: [
      "Issues list shrinking instead of recycling",
      "Leadership team healthier and more open",
      "Owner delegating with confidence — and it sticks",
      "Numbers trending: on-time delivery, margin, close rate",
    ],
  },
  {
    when: "Year 1–2+",
    title: "Freedom",
    items: [
      "Business runs on the system, not the owner",
      "Predictable quarters: plan, execute, review, repeat",
      "Profit reflects the effort — pricing, focus, discipline",
      "The company grows without growing your hours",
    ],
  },
];

const quotes = [
  {
    text: "We have scorecards in place for all departments of our entire organization. Everybody understands the role they play and what they need to do to help the company win. Our team feels more fulfilled, and we’re getting better results.",
    who: "Chris Crew",
    role: "President, The Blue Collar Success Group",
  },
  {
    text: "I’ve watched our leadership team really step up levels of leadership — the way they’re communicating better, the way our communication flows, the way we track, measure, and improve things continues to get better.",
    who: "Kenny Chapman",
    role: "Founder and CEO, The Blue Collar Success Group",
  },
  {
    text: "When they’re facilitating our quarterly meetings, we get more done and stay focused on what matters.",
    who: "Danielle Putnam",
    role: "CEO, The New Flat Rate",
  },
  {
    text: "We’ve gained clarity, accountability, and traction in ways we hadn’t before.",
    who: "Lincoln Higdon",
    role: "CEO, Centerpoint IT",
  },
];

export default function ResultsPage() {
  return (
    <>
      <header className="results-header">
        <div className="results-header-inner">
          <Link href="/" style={{ display: "flex" }}>
            <Image
              src="/assets/logo.png"
              alt="Phoenix Operations"
              width={188}
              height={56}
              className="site-logo"
              style={{ height: 56, width: "auto" }}
            />
          </Link>
          <span className="private-badge">Private link · Shared by Phoenix Operations</span>
        </div>
      </header>

      <section className="results-hero">
        <p className="kicker">What Results Look Like</p>
        <h1>The results come from running on a real operating system.</h1>
        <div className="accent-rule centered" />
        <p>
          Phoenix Operations coaches companies on EOS® — the Entrepreneurial Operating System. It
          isn&apos;t magic, and it isn&apos;t theory. It&apos;s a set of simple, proven tools installed into how
          your leadership team runs the business, week after week. The numbers below are what
          disciplined execution produces.
        </p>
      </section>

      <section className="stat-band">
        <div className="stat-band-inner">
          <div className="stat-grid">
            {bigStats.map((s) => (
              <div key={s.n} className="stat">
                <div className="n">{s.n}</div>
                <div className="label">{s.label}</div>
                <div className="sub">{s.sub}</div>
              </div>
            ))}
          </div>
          <p className="stat-source">
            Sources: TrueSpace/Gallup-validated five-year study of 305 companies; EOS Worldwide
            adoption reporting.
          </p>
        </div>
      </section>

      <section className="components">
        <div className="components-inner">
          <h2>Where the results actually come from</h2>
          <p className="section-lede">
            EOS strengthens six key components of your business. Each one removes a specific drag
            on growth — the same frustrations that likely brought you here.
          </p>
          <div className="component-grid">
            {components.map((c) => (
              <div key={c.n} className="component-card">
                <div className="component-head">
                  <span className="component-disc">{c.n}</span>
                  <span className="component-name">{c.name}</span>
                </div>
                <p className="component-what">{c.what}</p>
                <div className="component-result">
                  <strong>The result:</strong> <span>{c.result}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="phases">
        <div className="phases-inner">
          <h2>What owners typically see, and when</h2>
          <p className="section-lede">
            A realistic arc. Every company moves at its own pace — this is the pattern.
          </p>
          <div className="phase-grid">
            {phases.map((p) => (
              <div key={p.when} className="phase-card">
                <div className="phase-when">{p.when}</div>
                <div className="phase-title">{p.title}</div>
                <ul>
                  {p.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="honest-caveat">
            An honest caveat: EOS produces these results when the leadership team actually runs the
            system — shows up to the meetings, keeps the scorecard, and holds each other
            accountable. That discipline is exactly what Phoenix Operations coaches.
          </p>
        </div>
      </section>

      <section className="proof">
        <div className="proof-inner">
          <h2>Proof from companies we&apos;ve coached</h2>
          <div className="proof-grid">
            {quotes.map((q) => (
              <figure key={q.who} className="proof-quote">
                <span className="quote-glyph">&ldquo;</span>
                <div>
                  <blockquote>{q.text}</blockquote>
                  <figcaption>
                    <strong>— {q.who}</strong>, {q.role}
                  </figcaption>
                </div>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter variant="results" />
    </>
  );
}
