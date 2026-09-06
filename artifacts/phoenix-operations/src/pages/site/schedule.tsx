import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import SiteNav from "@/components/site/SiteNav";
import SiteFooter from "@/components/site/SiteFooter";
import SlotPicker, { type BookResult } from "@/components/funnel/SlotPicker";
import { apiRequest, publicWorkspaceSlug } from "@/lib/store/api";
import { getPublicStore } from "@/lib/store";

// Direct booking for referrals and emailed links — people who shouldn't have to
// walk through the five-step intake first. Same slot UI as the funnel, so it reads
// as part of the site rather than a bolted-on scheduling page. Bookings still land
// in the pipeline, tagged as a direct booking.

export default function SchedulePage() {
  const store = getPublicStore();
  const { data: workspace } = useQuery({
    queryKey: ["workspace", publicWorkspaceSlug()],
    queryFn: () => store.getWorkspace(),
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [bookedSlot, setBookedSlot] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  if (!workspace) return null;

  const guide = workspace.guide;
  const firstName = guide.name.split(" ")[0];
  const duration = workspace.scheduling?.durationMinutes ?? 15;
  const detailsReady = name.trim().length > 0 && /.+@.+\..+/.test(email.trim());
  const tenant = `?workspace=${encodeURIComponent(publicWorkspaceSlug())}`;

  const book = async (startTime: string, timezone: string): Promise<BookResult> => {
    if (!detailsReady) {
      setMessage("Please add your name and email first — that's who the invite goes to.");
      return { booked: false };
    }
    setBusy(true);
    setMessage("");
    try {
      const confirmed = await apiRequest<{ bookedSlot: string }>("/public/scheduling/book", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), company: company.trim(), startTime, timezone, website: honeypot }),
      });
      setBookedSlot(confirmed.bookedSlot);
      return { booked: true };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "";
      setMessage(
        reason === "slot_unavailable"
          ? "That time was just taken. Here are the times still open."
          : reason === "scheduling_unavailable"
            ? "We couldn't reach the calendar just now. Please try again in a moment."
            : "We couldn't confirm that time. Please try another slot."
      );
      return { booked: false, refresh: reason === "slot_unavailable" };
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ["--orange" as string]: workspace.brand.primaryColor, ["--ink" as string]: workspace.brand.inkColor, ["--paper" as string]: workspace.brand.paperColor }}>
      <SiteNav variant="back" workspace={workspace} />

      <section className="scheduler">
        <div className="scheduler-head">
          <span className="kicker">Book a conversation</span>
          <h1>{bookedSlot ? `You're set, ${name.split(" ")[0] || "thanks"}.` : `Grab time with ${firstName}.`}</h1>
          <p>
            {duration} minutes. No prep, no pressure. If you'd rather talk through what's going on
            first,{" "}
            <Link href={`/f/lack-of-control${tenant}`}>start here instead</Link>.
          </p>
        </div>

        {!bookedSlot ? (
          <>
            <div className="slot-card" style={{ marginTop: 44 }}>
              <p className="q-label sm">Who's joining?</p>
              <p className="q-hint">So {firstName} knows who he's meeting and where to send the invite.</p>
              <div className="contact-grid">
                <label className="field">
                  Your name
                  <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Jordan Reyes" />
                </label>
                <label className="field">
                  Work email
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="jordan@company.com" />
                </label>
                <label className="field">
                  {/* One flex item, or `.field`'s column layout drops the hint onto its own line. */}
                  <span>
                    Company <span style={{ color: "var(--muted-3)", fontWeight: 400 }}>(optional)</span>
                  </span>
                  <input value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" placeholder="Reyes Mechanical" />
                </label>
              </div>
              <div className="hp-field" aria-hidden="true">
                <label>
                  Website
                  <input value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" />
                </label>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <SlotPicker onBook={book} busy={busy} />
            </div>

            {message && (
              <p className="validation-msg" role="status" style={{ marginTop: 14, textAlign: "center" }}>
                {message}
              </p>
            )}
          </>
        ) : (
          <div className="booked-card">
            <p className="kicker">You&apos;re booked</p>
            <p className="booked-slot">{bookedSlot}</p>
            <p className="booked-note">
              A confirmation and calendar invite are on their way to {email}. Come ready to talk
              about whatever is creating the most friction right now — nothing else to prepare.
            </p>
            <Link href={`/${tenant}`}>← Back to the site</Link>
          </div>
        )}

        <p className="no-pitch-note">
          This is a conversation, not a sales pitch. If {firstName} can help, great. If he
          can&apos;t, he&apos;ll tell you.
        </p>
      </section>

      <SiteFooter variant="guide" workspace={workspace} />
    </div>
  );
}
