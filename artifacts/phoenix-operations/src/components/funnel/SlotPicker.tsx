import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/store/api";

// Real availability from the workspace's Calendly account, rendered through the
// site's own slot-card markup. Shared by the funnel and the standalone /schedule
// page so both look identical — and so there's one place to change the booking UI.

export type AvailabilitySlot = { startTime: string; label: string };
export type AvailabilityDay = { date: string; label: string; slots: AvailabilitySlot[] };

type Availability = {
  configured: boolean;
  timezone: string;
  timezoneLabel?: string;
  weekLabel?: string;
  durationMinutes: number;
  schedulingUrl: string;
  days: AvailabilityDay[];
};

/** Days shown at once — matches the five columns the grid was designed around. */
const DAYS_PER_PAGE = 5;
/** How far ahead each fetch looks. The server chunks this across Calendly's 7-day cap. */
const RANGE_DAYS = 14;

export const visitorTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  } catch {
    return "America/New_York";
  }
};

/**
 * `booked` closes the picker. `refresh` asks for fresh availability — set it when
 * the grid is now wrong (the slot was taken), not merely when booking was declined.
 */
export type BookResult = { booked: boolean; refresh?: boolean };

type Props = {
  onBook: (startTime: string, timezone: string) => Promise<BookResult> | BookResult;
  /** Disables the grid while the caller is mid-request. */
  busy?: boolean;
};

export default function SlotPicker({ onBook, busy = false }: Props) {
  const timezone = useMemo(visitorTimeZone, []);
  const [offsetDays, setOffsetDays] = useState(0);
  const [page, setPage] = useState(0);
  const [data, setData] = useState<Availability | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [booking, setBooking] = useState<string | null>(null);

  const load = useCallback(
    async (offset: number) => {
      setState("loading");
      const start = new Date(Date.now() + offset * 86_400_000).toISOString();
      try {
        const result = await apiRequest<Availability>(
          `/public/scheduling/availability?start=${encodeURIComponent(start)}&days=${RANGE_DAYS}&timezone=${encodeURIComponent(timezone)}`
        );
        setData(result);
        setPage(0);
        setState("ready");
      } catch {
        setState("error");
      }
    },
    [timezone]
  );

  useEffect(() => {
    void load(offsetDays);
  }, [load, offsetDays]);

  const days = data?.days ?? [];
  const pageCount = Math.max(1, Math.ceil(days.length / DAYS_PER_PAGE));
  const visible = days.slice(page * DAYS_PER_PAGE, page * DAYS_PER_PAGE + DAYS_PER_PAGE);
  const heading = visible[0]?.slots[0]?.startTime
    ? headingFor(visible[0].slots[0].startTime, timezone)
    : data?.weekLabel ?? "Next available";

  const book = async (slot: AvailabilitySlot) => {
    if (busy || booking) return;
    setBooking(slot.startTime);
    const result = await onBook(slot.startTime, timezone);
    setBooking(null);
    // A slot taken out from under us: refresh so the grid tells the truth.
    if (result.refresh) void load(offsetDays);
  };

  const back = () => (page > 0 ? setPage(page - 1) : setOffsetDays(Math.max(0, offsetDays - RANGE_DAYS)));
  const forward = () => (page + 1 < pageCount ? setPage(page + 1) : setOffsetDays(offsetDays + RANGE_DAYS));
  const canGoBack = page > 0 || offsetDays > 0;

  return (
    <div className="slot-card">
      <div className="slot-card-head">
        <p className="week">{state === "loading" ? "Finding open times…" : heading}</p>
        <span className="tz">
          All times {data?.timezoneLabel ?? timezone.split("/").pop()?.replace(/_/g, " ")} ·{" "}
          {data?.durationMinutes ?? 15} min
        </span>
        {state === "ready" && days.length > 0 && (
          <div className="slot-nav">
            <button type="button" onClick={back} disabled={!canGoBack || busy} aria-label="Earlier times">
              ←
            </button>
            <button type="button" onClick={forward} disabled={busy} aria-label="Later times">
              →
            </button>
          </div>
        )}
      </div>

      {state === "loading" && (
        <div className={`slot-grid cols-${DAYS_PER_PAGE}`} aria-hidden="true">
          {Array.from({ length: DAYS_PER_PAGE }).map((_, column) => (
            <div key={column} className="slot-col slot-skeleton">
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      )}

      {state === "error" && (
        <p className="slot-note">
          We couldn&apos;t load open times just now. Please try again in a moment
          {data?.schedulingUrl ? (
            <>
              {" "}
              or{" "}
              <a href={data.schedulingUrl} target="_blank" rel="noreferrer">
                pick a time here
              </a>
            </>
          ) : null}
          .
        </p>
      )}

      {state === "ready" && data && !data.configured && (
        <p className="slot-note">
          Online booking isn&apos;t switched on yet — we&apos;ll email you within one business day
          to set up a time.
        </p>
      )}

      {state === "ready" && data?.configured && days.length === 0 && (
        <p className="slot-note">
          No open times in the next couple of weeks.{" "}
          <button type="button" onClick={() => setOffsetDays(offsetDays + RANGE_DAYS)}>
            Look further ahead →
          </button>
        </p>
      )}

      {state === "ready" && visible.length > 0 && (
        <div className={`slot-grid cols-${visible.length}`}>
          {visible.map((day) => (
            <div key={day.date} className="slot-col">
              <div className="slot-day-label">{day.label}</div>
              {day.slots.map((slot) => (
                <button
                  key={slot.startTime}
                  type="button"
                  className="slot-btn"
                  disabled={busy || booking !== null}
                  onClick={() => void book(slot)}
                >
                  {booking === slot.startTime ? "Booking…" : slot.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** "Week of September 14", derived client-side so paging updates the heading. */
function headingFor(iso: string, timeZone: string) {
  try {
    return `Week of ${new Intl.DateTimeFormat("en-US", { timeZone, month: "long", day: "numeric" }).format(new Date(iso))}`;
  } catch {
    return "Next available";
  }
}
