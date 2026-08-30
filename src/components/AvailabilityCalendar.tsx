import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import "./AvailabilityCalendar.css";

export interface DateRangeValue {
  start: string | null;
  end: string | null;
}

interface AvailabilityCalendarProps {
  /** Which units must be free for a date to show as available. Defaults to
   * the core venue grounds — pass a package's full unitIds when using this
   * on the booking page to check a specific package. */
  unitIds?: string[];
  /** Called when the visitor clicks a date, in single-date mode. Omit for a
   * read-only preview (e.g. the homepage teaser). Ignored if `range` is
   * provided — use `onRangeChange` instead for range-select mode. */
  onSelectDate?: (isoDate: string) => void;
  /** Highlights a single selected date. Ignored in range mode. */
  selectedDate?: string | null;
  /** Enables two-click range selection (click a start date, then an end
   * date) instead of single-date selection — used on the booking page,
   * since a stay can span multiple nights. Pass the current range value
   * plus onRangeChange to make this a controlled component. */
  range?: DateRangeValue;
  onRangeChange?: (range: DateRangeValue) => void;
}

type DayStatus = "available" | "held" | "booked" | "past" | "loading";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Module-level constant, not an inline default — a default parameter like
// `unitIds = ["venue-grounds"]` creates a brand-new array every render,
// which retriggers the effect below (it depends on unitIds), which
// triggers a re-render, forever. A stable reference here breaks that loop.
const DEFAULT_UNIT_IDS = ["venue-grounds"];

// Persists which month is showing across a full page refresh (not just
// client-side navigation, which React state would already survive). One
// shared key across every AvailabilityCalendar instance on the site — if
// someone's browsing March on the booking page, switching packages or
// coming back later keeps showing March rather than jumping back to today.
const MONTH_STORAGE_KEY = "highMeadows:calendarMonth";

interface StoredMonth {
  year: number;
  month: number;
}

function loadStoredMonth(): StoredMonth | null {
  try {
    const raw = localStorage.getItem(MONTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.year === "number" && typeof parsed.month === "number") {
      return parsed;
    }
    return null;
  } catch {
    // Private browsing modes and disabled storage can throw here — just
    // fall back to the current month rather than breaking the calendar.
    return null;
  }
}

function formatDateLabel(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// Plain Unicode symbols, not emoji — these render in the day's normal text
// color (following CSS `color`) rather than forcing their own colored glyph
// the way many emoji do. Color alone shouldn't carry the held-vs-booked
// distinction, since red/gold/green overlaps with the most common forms of
// color blindness.
function statusIcon(status: DayStatus): string | null {
  if (status === "held") return "○"; // hollow — not yet filled in/confirmed
  if (status === "booked") return "●"; // solid — filled in, confirmed
  return null;
}

/**
 * Renders a single month at a time with prev/next navigation. Checks each
 * visible date against availability/{unitId}/dates/{date} for every unit in
 * unitIds — fine for a month's worth of days (~30 * unitIds.length reads),
 * but if this grows to a multi-month view, switch to a denormalized
 * "date -> status" lookup doc per unit per month instead of per-day docs.
 *
 * Supports two selection modes:
 *  - Single-date (onSelectDate + selectedDate): a plain click callback.
 *  - Range (range + onRangeChange): first click sets the start, second
 *    click sets the end. If every day between them isn't available, the
 *    range resets and treats that second click as a new start instead of
 *    silently completing an invalid range.
 */
export function AvailabilityCalendar({
  unitIds = DEFAULT_UNIT_IDS,
  onSelectDate,
  selectedDate,
  range,
  onRangeChange,
}: AvailabilityCalendarProps) {
  const [cursor, setCursor] = useState(() => {
    const stored = loadStoredMonth();
    if (stored) return stored;
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [statuses, setStatuses] = useState<Record<string, DayStatus>>({});
  // Hold expiry per date, day-level granularity only — deliberately not a
  // live countdown. Showing exact remaining time to every visitor would
  // expose another couple's private hold down to the minute and invite
  // people to refresh right at expiry to snipe the date; a "check back
  // around this day" hint is useful without either problem.
  const [heldExpiry, setHeldExpiry] = useState<Record<string, string>>({});
  const [infoDate, setInfoDate] = useState<string | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(MONTH_STORAGE_KEY, JSON.stringify(cursor));
    } catch {
      // Ignore — persistence is a nice-to-have, not required for the
      // calendar to function.
    }
  }, [cursor]);

  const isRangeMode = !!onRangeChange;

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
    setInfoDate(null); // clear any open hint — it'd reference a date no longer shown
  }, [cursor]);

  useEffect(() => {
    let cancelled = false;
    const todayIso = new Date().toISOString().slice(0, 10);

    (async () => {
      const initial: Record<string, DayStatus> = {};
      isoDates.forEach((d) => {
        initial[d] = d < todayIso ? "past" : "loading";
      });
      setStatuses(initial);

      const expiryUpdates: Record<string, string> = {};

      const results = await Promise.all(
        isoDates.map(async (isoDate) => {
          if (isoDate < todayIso) return [isoDate, "past"] as const;
          for (const unitId of unitIds) {
            const snap = await getDoc(doc(db, "availability", unitId, "dates", isoDate));
            if (snap.exists()) {
              const status = snap.data().status;
              // "blocked" (an admin manually taking a date off the
              // calendar) is visually indistinguishable from "booked" here
              // — customers don't need to know WHY a date is unavailable,
              // just that it is. The admin calendar shows this distinction;
              // this one doesn't.
              if (status === "booked" || status === "blocked") {
                return [isoDate, "booked"] as const;
              }
              if (status === "held") {
                const holdExpiresAt = snap.data().holdExpiresAt;
                const expired = holdExpiresAt && new Date(holdExpiresAt) < new Date();
                if (!expired) {
                  if (holdExpiresAt) expiryUpdates[isoDate] = holdExpiresAt;
                  return [isoDate, "held"] as const;
                }
              }
            }
          }
          return [isoDate, "available"] as const;
        })
      );

      if (!cancelled) {
        setStatuses(Object.fromEntries(results));
        setHeldExpiry(expiryUpdates);
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

  function everyDateAvailable(start: string, end: string): boolean {
    const cur = new Date(start + "T00:00:00Z");
    const endDate = new Date(end + "T00:00:00Z");
    while (cur <= endDate) {
      const iso = cur.toISOString().slice(0, 10);
      if (statuses[iso] !== "available") return false;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return true;
  }

  function handleRangeClick(isoDate: string) {
    if (!onRangeChange) return;
    setRangeError(null);
    const { start, end } = range ?? { start: null, end: null };

    if (!start || end) {
      // Starting fresh (either no selection yet, or a completed range —
      // clicking again always starts a new selection).
      onRangeChange({ start: isoDate, end: null });
      return;
    }

    // We have a start but no end — this click attempts to complete the range.
    if (isoDate < start) {
      // Clicked before the start — treat as restarting with a new start.
      onRangeChange({ start: isoDate, end: null });
      return;
    }

    if (!everyDateAvailable(start, isoDate)) {
      setRangeError("Some dates in that range aren't available — pick a new start date.");
      onRangeChange({ start: isoDate, end: null });
      return;
    }

    onRangeChange({ start, end: isoDate });
  }

  function isInRange(isoDate: string): boolean {
    if (!range?.start) return false;
    const end = range.end ?? range.start;
    return isoDate >= range.start && isoDate <= end;
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

      {isRangeMode && (
        <p className="availability-calendar__instructions">
          {!range?.start
            ? "Click a start date."
            : !range.end
            ? "Now click an end date (or the same date again for a single night)."
            : `${range.start} → ${range.end}`}
        </p>
      )}
      {rangeError && <p className="availability-calendar__range-error">{rangeError}</p>}

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
          const selectable = status === "available" && (isRangeMode || !!onSelectDate);
          const showsInfo = status === "held";
          const clickable = selectable || showsInfo;
          const selected = isRangeMode
            ? isInRange(isoDate)
            : selectedDate === isoDate;
          return (
            <button
              key={isoDate}
              type="button"
              disabled={!clickable}
              onClick={() => {
                if (showsInfo) {
                  setInfoDate((prev) => (prev === isoDate ? null : isoDate));
                  return;
                }
                isRangeMode ? handleRangeClick(isoDate) : onSelectDate?.(isoDate);
              }}
              className={[
                "availability-calendar__day",
                `availability-calendar__day--${status}`,
                selected ? "availability-calendar__day--selected" : "",
                infoDate === isoDate ? "availability-calendar__day--info-open" : "",
              ].join(" ")}
              aria-label={
                showsInfo
                  ? `${MONTH_NAMES[cursor.month]} ${dayNum}, pending hold — tap for details`
                  : `${MONTH_NAMES[cursor.month]} ${dayNum}, ${status}`
              }
            >
              {dayNum}
              {statusIcon(status) && (
                <span className="availability-calendar__day-icon" aria-hidden="true">
                  {statusIcon(status)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {infoDate && heldExpiry[infoDate] && (
        <p className="availability-calendar__hold-hint">
          {formatDateLabel(infoDate)} is currently on hold. If it isn't confirmed, it may open
          back up around{" "}
          <strong>
            {new Date(heldExpiry[infoDate]).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
            })}
          </strong>
          .
        </p>
      )}

      <div className="availability-calendar__legend">
        <span><i className="availability-calendar__swatch availability-calendar__swatch--available" /> Available</span>
        <span><i className="availability-calendar__swatch availability-calendar__swatch--held" /> ○ Pending hold (tap for details)</span>
        <span><i className="availability-calendar__swatch availability-calendar__swatch--booked" /> ● Booked</span>
      </div>
    </div>
  );
}
