import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import "./AvailabilityCalendar.css";

interface AvailabilityCalendarProps {
  /** Which units must be free for a date to show as available. Defaults to
   * the core venue grounds — pass a package's full unitIds when using this
   * on the booking page to check a specific package. */
  unitIds?: string[];
  /** Called when the visitor clicks a date. Omit for a read-only preview
   * (e.g. the homepage teaser). */
  onSelectDate?: (isoDate: string) => void;
  /** Highlights a single selected date, e.g. the start of a range being built
   * on the booking page. */
  selectedDate?: string | null;
}

type DayStatus = "available" | "unavailable" | "past" | "loading";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Renders a single month at a time with prev/next navigation. Checks each
 * visible date against availability/{unitId}/dates/{date} for every unit in
 * unitIds — fine for a month's worth of days (~30 * unitIds.length reads),
 * but if this grows to a multi-month view, switch to a denormalized
 * "date -> status" lookup doc per unit per month instead of per-day docs.
 */
export function AvailabilityCalendar({
  unitIds = ["venue-grounds"],
  onSelectDate,
  selectedDate,
}: AvailabilityCalendarProps) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [statuses, setStatuses] = useState<Record<string, DayStatus>>({});

  const daysInMonth = useMemo(
    () => new Date(cursor.year, cursor.month + 1, 0).getDate(),
    [cursor]
  );
  const firstWeekday = useMemo(
    () => new Date(cursor.year, cursor.month, 1).getDay(),
    [cursor]
  );
  const isoDates = useMemo(
    () =>
      Array.from({ length: daysInMonth }, (_, i) => {
        const d = i + 1;
        return `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }),
    [cursor, daysInMonth]
  );

  useEffect(() => {
    let cancelled = false;
    const todayIso = new Date().toISOString().slice(0, 10);

    (async () => {
      const initial: Record<string, DayStatus> = {};
      isoDates.forEach((d) => {
        initial[d] = d < todayIso ? "past" : "loading";
      });
      setStatuses(initial);

      const results = await Promise.all(
        isoDates.map(async (isoDate) => {
          if (isoDate < todayIso) return [isoDate, "past"] as const;
          for (const unitId of unitIds) {
            const snap = await getDoc(doc(db, "availability", unitId, "dates", isoDate));
            if (snap.exists()) {
              const status = snap.data().status;
              if (status === "booked" || status === "blocked") {
                return [isoDate, "unavailable"] as const;
              }
              if (status === "held") {
                const expired =
                  snap.data().holdExpiresAt && new Date(snap.data().holdExpiresAt) < new Date();
                if (!expired) return [isoDate, "unavailable"] as const;
              }
            }
          }
          return [isoDate, "available"] as const;
        })
      );

      if (!cancelled) {
        setStatuses(Object.fromEntries(results));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isoDates, unitIds]);

  function changeMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div className="availability-calendar">
      <div className="availability-calendar__header">
        <button
          type="button"
          className="availability-calendar__nav"
          onClick={() => changeMonth(-1)}
          aria-label="Previous month"
        >
          ←
        </button>
        <h3>
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </h3>
        <button
          type="button"
          className="availability-calendar__nav"
          onClick={() => changeMonth(1)}
          aria-label="Next month"
        >
          →
        </button>
      </div>

      <div className="availability-calendar__weekdays">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="availability-calendar__grid">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {isoDates.map((isoDate) => {
          const status = statuses[isoDate] ?? "loading";
          const dayNum = Number(isoDate.slice(-2));
          const clickable = status === "available" && !!onSelectDate;
          return (
            <button
              key={isoDate}
              type="button"
              disabled={!clickable}
              onClick={() => onSelectDate?.(isoDate)}
              className={[
                "availability-calendar__day",
                `availability-calendar__day--${status}`,
                selectedDate === isoDate ? "availability-calendar__day--selected" : "",
              ].join(" ")}
              aria-label={`${MONTH_NAMES[cursor.month]} ${dayNum}, ${status}`}
            >
              {dayNum}
            </button>
          );
        })}
      </div>

      <div className="availability-calendar__legend">
        <span><i className="availability-calendar__swatch availability-calendar__swatch--available" /> Available</span>
        <span><i className="availability-calendar__swatch availability-calendar__swatch--unavailable" /> Booked</span>
      </div>
    </div>
  );
}
