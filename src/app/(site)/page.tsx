import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import {
  CalendarCheckIcon,
  CeilingIcon,
  ChatIcon,
  CompassIcon,
  FounderIcon,
  GrowthIcon,
  IdeaIcon,
  PeopleIcon,
  PracticalIcon,
  ProfitIcon,
  RepeatIcon,
  ResultsIcon,
  ShieldIcon,
} from "@/components/site/icons";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Phoenix Operations — You're working harder. Shouldn't this be getting easier?",
  description:
    "As your business grows, are you finding less control, more people problems, and profits that don't reflect the effort? Schedule a free 15-minute conversation — no pitch.",
  alternates: { canonical: "/" },
};

const frustrations = [
  {
    name: "Lack of Control",
    blurb: "The business seems to control you more than you control it.",
    href: "/f/lack-of-control",
    icon: <CompassIcon />,
  },
  {
    name: "Lack of Profit",
    blurb: "You're working too hard for what the business produces.",
    href: "/f/lack-of-profit",
    icon: <ProfitIcon />,
  },
  {
    name: "People",
    blurb: "You're frustrated with people who aren't meeting your expectations.",
    href: "/f/people",
    icon: <PeopleIcon />,
  },
  {
    name: "Hitting the Ceiling",
    blurb: "What got you here doesn't seem capable of getting you to the next level.",
    href: "/f/hitting-the-ceiling",
    icon: <CeilingIcon />,
  },
  {
    name: "Nothing Works",
    blurb: "You've tried fixing these things before, but the same problems keep coming back.",
    href: "/f/nothing-works",
    icon: <RepeatIcon />,
  },
];

const steps = [
  {
    n: "1",
    name: "Schedule Your 15-Minute Conversation",
    blurb: "Pick a time that works for you. No prep, no pressure. Just a real conversation.",
    icon: <CalendarCheckIcon />,
  },
  {
    n: "2",
    name: "Tell Us What's Getting in the Way",
    blurb: "We'll talk through the frustration that's creating the most challenges right now.",
    icon: <ChatIcon />,
  },
  {
    n: "3",
    name: "Get Clarity in Real Time",
    blurb: "We'll share what we're seeing, the patterns behind it, and what you might consider next.",
    icon: <IdeaIcon />,
  },
  {
    n: "4",
    name: "Decide What Makes Sense for You",
    blurb:
      "If it's a good fit, we'll explore what's possible. If not, you'll still walk away with useful perspective.",
    icon: <CeilingIcon size={30} accent />,
  },
];

const traits = [
  { name: "Founder-Led", blurb: "Visionary leaders building something valuable.", icon: <FounderIcon /> },
  { name: "Growth-Minded", blurb: "Companies ready to break through to the next level.", icon: <GrowthIcon /> },
  { name: "Results-Focused", blurb: "Teams that want more profit, control, and freedom.", icon: <ResultsIcon /> },
  { name: "Practical Approach", blurb: "Real-world experience. No theory for theory's sake.", icon: <PracticalIcon /> },
];

const faqs = [
  {
    q: "Is the 15-minute conversation really free, with no sales pitch?",
    a: "Yes. This is a straightforward conversation about what's getting in your way. If we believe we can help, we'll tell you. If we don't, we'll tell you that too.",
  },
  {
    q: "How do I prepare for the conversation?",
    a: "You don't need to prepare anything. Come ready to talk about the issue that's creating the most frustration for you right now.",
  },
  {
    q: "Who is this not for?",
    a: "This probably isn't the right conversation if you're looking for an overnight fix, a prepackaged answer, or someone else to make the decisions for you.",
  },
  {
    q: "What types of businesses benefit most?",
    a: "Founder-led companies and leadership teams navigating the challenges that come with growth — especially when control, profit, people and recurring problems are getting in the way.",
  },
];

const testimonials = [
  {
    text: "They've always made themselves available, and I found that when they're facilitating our quarterly meetings, we get more done and stay focused on what matters.",
    who: "Danielle Putnam",
    role: "CEO, The New Flat Rate",
  },
  {
    text: "I've watched our leadership team really step up levels of leadership — the way they're communicating better, the way our communication flows, the way we track, measure, and improve things continues to get better.",
    who: "Kenny Chapman",
    role: "Founder and CEO, The Blue Collar Success Group",
  },
  {
    text: "We have scorecards in place for all departments of our entire organization. Everybody understands the role they play and what they need to do to help the company win. Our team feels more fulfilled, and we're getting better results.",
    who: "Chris Crew",
    role: "President, The Blue Collar Success Group",
  },
];

export default async function HomePage() {
  const store = getStore();
  const [cmsPages, workspace] = await Promise.all([store.listCmsPages(), store.getWorkspace()]);
  const home = cmsPages.find((p) => p.id === "home");
  const on = (id: string) => home?.sections.find((s) => s.id === id)?.enabled ?? true;
  const guide = workspace.guide;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "Phoenix Operations",
    description:
      "Business coaching for founders and leadership teams in growing companies — more control, more profit, fewer recurring problems.",
    url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    founder: { "@type": "Person", name: guide.name },
    areaServed: "US",
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteNav />

      {on("hero") && (
        <section className="hero">
          <div className="hero-photo">
            <Image
              src="/assets/hero-photo.png"
              alt="Summit at first light"
              fill
              sizes="(max-width: 760px) 100vw, 52vw"
              priority
              style={{ objectFit: "cover" }}
            />
          </div>
          <div className="hero-fade" />
          <div className="hero-inner">
            <div className="hero-copy">
              <h1>You&apos;re working harder. Shouldn&apos;t this be getting easier?</h1>
              <div className="accent-rule" />
              <p className="hero-lede">
                As your business grows, are you finding yourself with less control, more people
                problems, and profits that don&apos;t reflect the effort you&apos;re putting in? Does it feel
                like you keep hitting a ceiling, even after trying different ways to move forward?
              </p>
              <p className="hero-question">What&apos;s creating the most frustration for you right now?</p>
            </div>
            <div className="frustration-grid">
              {frustrations.map((f) => (
                <Link key={f.name} href={f.href} className="frustration-item">
                  <span className="icon">{f.icon}</span>
                  <span className="name">{f.name}</span>
                  <span className="blurb">{f.blurb}</span>
                </Link>
              ))}
            </div>
            <div className="hero-cta-block">
              <p className="hero-cta-lead">
                Let&apos;s talk about what&apos;s keeping you up at night — and where to start.
              </p>
              <Link href="/f/lack-of-control" className="btn-primary">
                Schedule a 15-Minute Conversation <span className="arrow">→</span>
              </Link>
              <p className="hero-cta-note">No pressure. Just a real conversation about your business.</p>
            </div>
          </div>
        </section>
      )}

      {on("howwho") && (
        <section id="approach" className="howwho">
          <div className="howwho-inner">
            <div className="howwho-left">
              <p className="kicker">What&apos;s Next?</p>
              <h2>
                Here&apos;s how it works.
                <br />
                <span className="sub">Simple, practical, and focused on you.</span>
              </h2>
              <div className="steps">
                {steps.map((s) => (
                  <div key={s.n} className="step">
                    <span className="step-num">{s.n}</span>
                    <span className="step-icon">{s.icon}</span>
                    <div>
                      <div className="step-name">{s.name}</div>
                      <div className="step-blurb">{s.blurb}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="shield-note">
                <span className="icon">
                  <ShieldIcon />
                </span>
                <div>
                  <div className="title">Straightforward and Respectful</div>
                  <div className="body">
                    This is a conversation, not a sales pitch. If we can help, great. If we can&apos;t,
                    we&apos;ll tell you.
                  </div>
                </div>
              </div>
            </div>
            <div id="who" className="who">
              <h2>Who We Help</h2>
              <div className="accent-rule sm" />
              <p className="who-lede">
                Founders and leadership teams in growing companies who are ready to build a
                stronger, healthier, more profitable business.
              </p>
              <div className="traits">
                {traits.map((t) => (
                  <div key={t.name} className="trait">
                    <span className="icon">{t.icon}</span>
                    <span className="name">{t.name}</span>
                    <span className="blurb">{t.blurb}</span>
                  </div>
                ))}
              </div>
              <figure className="inline-quote">
                <span className="quote-glyph">&ldquo;</span>
                <div>
                  <blockquote>
                    Phoenix Operations has a unique ability to simplify complex concepts and keep us
                    focused on what matters most… We&apos;ve gained clarity, accountability, and traction
                    in ways we hadn&apos;t before.
                  </blockquote>
                  <figcaption>— Lincoln Higdon, CEO, Centerpoint IT</figcaption>
                </div>
              </figure>
            </div>
          </div>
        </section>
      )}

      {on("guideband") && guide.showGuideBand && (
        <section className="guide-band">
          <div className="guide-band-inner">
            <div className="ring-photo">
              <div className="ring" />
              <div className="arc" />
              <div className="photo">
                <Image src={guide.photoUrl} alt="Your guide" width={170} height={170} />
              </div>
            </div>
            <div className="guide-band-copy">
              <p className="kicker">Behind Phoenix Operations</p>
              <h2>Guided by someone who&apos;s sat in your seat.</h2>
              <p>
                Decades of building companies, leading teams, and working with hundreds of small
                businesses — asking the questions that light the path so you can decide what needs
                attention first.
              </p>
            </div>
            <Link href="/guide" className="btn-ink-outline">
              Meet Your Guide
            </Link>
          </div>
        </section>
      )}

      {on("results") && (
        <section id="results" className="perspectives">
          <div className="perspectives-inner">
            <h2>Client Perspectives</h2>
            <div className="accent-rule md centered" />
            <p className="perspectives-lede">What clients say about working with Phoenix Operations.</p>
            <div className="testimonial-grid">
              {testimonials.map((q) => (
                <figure key={q.who} className="testimonial-card">
                  <span className="quote-glyph">&ldquo;</span>
                  <blockquote>{q.text}</blockquote>
                  <figcaption>
                    <strong>— {q.who}</strong>
                    <br />
                    {q.role}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {on("faq") && (
        <section id="faq" className="faq">
          <div className="faq-inner">
            <h2>Frequently Asked Questions</h2>
            <p className="faq-lede">A few things you may want to know before scheduling a conversation.</p>
            <div className="faq-list">
              {faqs.map((f) => (
                <details key={f.q} className="faq-item">
                  <summary>
                    {f.q} <span className="faq-chev">▼</span>
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {on("footer") && <SiteFooter variant="home" />}
    </>
  );
}
