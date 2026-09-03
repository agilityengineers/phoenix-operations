import { Link, useParams, useLocation } from "wouter";

const privacySections = [
  {
    h: "1. What we collect",
    body: "Information you provide through our intake forms (name, work email, company, phone, role, and your answers about your business), scheduling details, and information collected automatically: pages visited, referral source, UTM campaign parameters, device and browser type, and IP address.",
  },
  {
    h: "2. How we use it",
    body: "To prepare for and conduct the conversation you requested, to operate and improve our funnels and website, to send transactional email (confirmations, reminders, internal notifications), and — only with your consent — occasional relevant follow-up. We score intake answers internally to prioritize outreach; scoring never results in automated rejection.",
  },
  {
    h: "3. Who we share it with",
    body: "Service providers that run our platform: hosting (Vercel/Replit), database (Supabase), email delivery (SendGrid), scheduling, and — where a workspace has enabled them — CRM synchronization (HubSpot) and automation (Zapier) under their respective data processing agreements. We do not sell personal information.",
  },
  {
    h: "4. White-label workspaces",
    body: "Some pages on this platform are operated by independent partner practices (e.g. EOS implementers or consultants). When you submit a form on a partner’s workspace, that partner is the data controller for your submission and Phoenix Operations acts as the platform processor.",
  },
  {
    h: "5. Retention",
    body: "Intake submissions and CRM records are kept while there is an active relationship or legitimate business need, and deleted or anonymized on verified request. Partial (unsubmitted) intake progress stored in your browser can be cleared by you at any time.",
  },
  {
    h: "6. Your rights",
    body: "Depending on your jurisdiction (including GDPR and CCPA/CPRA), you may request access, correction, deletion, portability, or restriction of processing, and opt out of marketing at any time via the unsubscribe link or by contacting us.",
  },
  {
    h: "7. Security",
    body: "Data is encrypted in transit and at rest, access is role-restricted (admin / owner / staff), and integrations use OAuth or token authentication. No method is 100% secure; we will notify affected users of any breach as required by law.",
  },
  {
    h: "8. Cookies & tracking",
    body: "We use first-party cookies for session state and form resume, and campaign attribution (UTM) parameters for funnel analytics. We do not use third-party advertising cookies on intake pages.",
  },
];

const termsSections = [
  {
    h: "1. The service",
    body: "Phoenix Operations provides business coaching services and a software platform for funnels, intake, and client management, including white-labeled partner workspaces. These terms govern use of the website, funnels, and platform.",
  },
  {
    h: "2. Scheduling & conversations",
    body: "The 15-minute conversation is free and carries no obligation. Coaching engagements, if any, are governed by a separate written agreement. Nothing on this site constitutes financial, legal, or accounting advice.",
  },
  {
    h: "3. Accounts & roles",
    body: "Workspace admins are responsible for the users they invite and the roles they assign (admin, owner, staff, partner). You are responsible for safeguarding credentials and for activity under your account.",
  },
  {
    h: "4. Partner workspaces",
    body: "Partners operate their own white-labeled workspaces and are solely responsible for their client relationships, content, and compliance with applicable marketing and privacy laws. EOS® and related marks belong to EOS Worldwide; use of methodology trademarks must follow the mark owner’s guidelines.",
  },
  {
    h: "5. Acceptable use",
    body: "No unlawful, deceptive, or spam-generating use of funnels or email features; no scraping, reverse engineering, or reselling of the platform outside an authorized partner agreement.",
  },
  {
    h: "6. Fees & trials",
    body: "Paid plans bill monthly via Stripe after any free trial. You can cancel anytime, effective at the end of the billing period. Fees are non-refundable except where required by law.",
  },
  {
    h: "7. Data & content ownership",
    body: "You own your workspace content and client records. You grant us a limited license to host and process them to operate the service. We may use aggregated, de-identified usage data to improve the platform.",
  },
  {
    h: "8. Disclaimers & liability",
    body: 'The service is provided "as is." To the maximum extent permitted by law, our total liability is limited to fees paid in the twelve months preceding the claim. Business results depend on execution and are not guaranteed.',
  },
  {
    h: "9. Changes & termination",
    body: "We may update these terms with 30 days’ notice for material changes. We may suspend accounts for violation of these terms. Governing law and venue to be confirmed with counsel.",
  },
];

const docs = {
  privacy: {
    kicker: "Your data, plainly",
    title: "Privacy Policy",
    sections: privacySections,
  },
  terms: {
    kicker: "The ground rules",
    title: "Terms of Service",
    sections: termsSections,
  },
} as const;

type DocKey = keyof typeof docs;

export default function LegalPage() {
  const params = useParams<{ doc: string }>();
  const [_, setLocation] = useLocation();
  const doc = params?.doc as DocKey;
  
  const entry = docs[doc];
  if (!entry) {
    setLocation("/");
    return null;
  }

  return (
    <>
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link href="/" style={{ display: "flex" }}>
            <img
              src="/assets/logo.png"
              alt="Phoenix Operations"
              width={181}
              height={54}
              className="site-logo"
              style={{ height: 54, width: "auto" }}
            />
          </Link>
          <nav className="tab-switch" aria-label="Legal documents">
            <Link href="/legal/privacy" className={doc === "privacy" ? "active" : ""}>
              Privacy Policy
            </Link>
            <Link href="/legal/terms" className={doc === "terms" ? "active" : ""}>
              Terms of Service
            </Link>
          </nav>
        </div>
      </header>

      <main className="legal-main">
        <p className="kicker">{entry.kicker}</p>
        <h1>{entry.title}</h1>
        <p className="legal-updated">
          Last updated: September 3, 2026 ·{" "}
          <strong>Draft — requires attorney review before launch</strong>
        </p>
        <div className="legal-sections">
          {entry.sections.map((s) => (
            <section key={s.h}>
              <h2>{s.h}</h2>
              <p>{s.body}</p>
            </section>
          ))}
        </div>
        <div className="legal-contact">
          <div className="title">Questions?</div>
          <p>
            Contact us at <a href="mailto:privacy@phoenixoperations.com">privacy@phoenixoperations.com</a>{" "}
            — we respond within 5 business days.
          </p>
        </div>
      </main>

      <footer className="site-footer">
        <div className="site-footer-bar">
          <div className="site-footer-bar-inner">
            <span>© 2026 Phoenix Operations. All rights reserved.</span>
            <Link href="/">← Back to site</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
