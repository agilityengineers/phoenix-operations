import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import { BuildingIcon, GearIcon, PeopleIcon } from "@/components/site/icons";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meet Your Guide",
  description:
    "I've sat in your seat. Decades of building companies, leading teams, and coaching hundreds of small businesses through the challenges that come with growth.",
  alternates: { canonical: "/guide" },
};

const pillars = [
  {
    name: "Built and led companies",
    blurb:
      "Founder-side experience with the weight of payroll, people, and every decision landing on one desk.",
    icon: <BuildingIcon />,
  },
  {
    name: "Inside large organizations",
    blurb:
      "Systems and discipline from big-company operations — translated to what actually fits a growing business.",
    icon: <GearIcon />,
  },
  {
    name: "Hundreds of small businesses",
    blurb:
      "Decades of coaching founders and leadership teams through the exact frustrations on this site.",
    icon: <PeopleIcon size={40} />,
  },
];

const quotes = [
  {
    text: "One of the things I also recognize is that coaches also need to be coached. And Josh has been a phenomenal coach for me and for my team.",
    who: "Chris Crew",
    role: "President, The Blue Collar Success Group",
  },
  {
    text: "Joshua has a unique ability to simplify complex concepts, keep us focused on what matters most… Thanks to his support, we've gained clarity, accountability, and traction in ways we hadn't before.",
    who: "Lincoln Higdon",
    role: "CEO, Centerpoint IT",
  },
];

// Renders entirely from the workspace Guide identity profile — the same page
// serves any white-label partner workspace with their own guide.
export default async function GuidePage() {
  const workspace = await getStore().getWorkspace();
  const guide = workspace.guide;
  const firstName = guide.name.split(" ")[0];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: guide.name,
    jobTitle: guide.title,
    worksFor: { "@type": "Organization", name: workspace.name },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteNav variant="back" />

      <section className="guide-hero">
        <div className="guide-hero-inner">
          <div className="guide-portrait">
            <div className="ring-photo">
              <div className="ring" />
              <div className="arc" />
              <div className="photo">
                <Image src={guide.photoUrl} alt={guide.name} width={340} height={340} priority />
              </div>
            </div>
            <div>
              <div className="guide-name">{guide.name}</div>
              <div className="guide-title">{guide.title}</div>
            </div>
          </div>
          <div>
            <p className="kicker">Your Guide</p>
            <h1>I&apos;ve sat in your seat.</h1>
            <div className="accent-rule md" />
            <p className="guide-story">{guide.story}</p>
            <p className="guide-bold">
              You are the leading expert in your business, not me. But I know how to ask the
              questions that help light the path—so you can see the obstacles more clearly and
              decide what needs attention first.
            </p>
            <Link href="/f/lack-of-control" className="btn-primary">
              Schedule a 15-Minute Conversation <span className="arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="experience">
        <div className="experience-inner">
          <h2>Where the perspective comes from</h2>
          <div className="accent-rule sm centered" />
          <div className="pillars">
            {pillars.map((p) => (
              <div key={p.name} className="pillar">
                <span className="icon">{p.icon}</span>
                <span className="name">{p.name}</span>
                <span className="blurb">{p.blurb}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="guide-quotes">
        <div className="guide-quotes-inner">
          <h2>What leaders say about working with {firstName === "Joshua" ? "Joshua" : firstName}</h2>
          <div className="guide-quote-grid">
            {quotes.map((q) => (
              <figure key={q.who} className="guide-quote">
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

      <SiteFooter variant="guide" />
    </>
  );
}
