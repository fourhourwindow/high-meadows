import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import {
  db,
  cancelBookingHold,
  cancelConfirmedBooking,
  shrinkBookingDateRange,
} from "../lib/firebase";
import type { Unit, Booking, CancellationTier } from "../types";
import "./AdminAvailabilityManager.css";

type DayStatus = "available" | "held" | "booked" | "blocked" | "past" | "loading";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Same plain-text-color symbols as the customer calendar, plus a distinct
// mark for "blocked" (already has a striped background — the icon reinforces
// it further, since stripes alone can still be subtle for some viewers).
function statusIcon(status: DayStatus): string | null {
  if (status === "held") return "○"; // hollow — not yet filled in/confirmed
  if (status === "booked") return "●"; // solid — filled in, confirmed
  if (status === "blocked") return "✕";
  return null;
}

// Separate storage key from the customer-facing calendar's — no reason for
// browsing March on the public site to jump the admin calendar to March too.
const MONTH_STORAGE_KEY = "highMeadows:adminCalendarMonth";

interface StoredMonth {
  year: number;
  month: number;
}

function loadStoredMonth(): StoredMonth | null {
  try {
    const raw = localStorage.getItem(MONTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.year === "number" && typeof parsed.month === "number") return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Mirrors cancelConfirmedBooking.ts's server-side logic — kept in sync
 * manually since it's a small pure function; the server always recomputes
 * independently and is the actual source of truth for what gets refunded.
 * This copy only drives what's PRE-FILLED in the admin's override input. */
function computeDefaultRefundPercent(daysNotice: number, tiers: CancellationTier[]): number {
  const sorted = [...tiers].sort((a, b) => b.minDaysBeforeEvent - a.minDaysBeforeEvent);
  const match = sorted.find((t) => daysNotice >= t.minDaysBeforeEvent);
  return match ? match.refundPercent : 0;
}

function nightsBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00Z").getTime();
  const end = new Date(endDate + "T00:00:00Z").getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

interface Props {
  units: Unit[];
  onDone: (message: string) => void;
  /** Called after a hold is cancelled or a booking's dates are shrunk —
   * lets the parent (Admin.tsx) refresh its own "Active Holds" list, which
   * this component has no way to update directly since it's a separate
   * section fed by its own data fetch. */
  onHoldChanged?: () => void;
}

/**
 * A visual replacement for the old plain block/unblock form. Shows a real
 * calendar with four distinct states so the admin can actually SEE what's
 * held, booked, or already blocked. Clicking an available/blocked date
 * toggles block status. Clicking a held or booked date fetches the FULL
 * booking (not just that one day's availability doc) so the panel can
 * offer the right actions: cancel the whole thing, or — if the clicked
 * date is the first or last night of a multi-night stay — remove just
 * that one night and keep the rest, with the price recalculated.
 */
export function AdminAvailabilityManager({ units, onDone, onHoldChanged }: Props) {
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [cursor, setCursor] = useState(() => {
    const stored = loadStoredMonth();
    if (stored) return stored;
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  // Per-unit status map so a combined view can tell "every selected unit is
  // blocked" (safe to unblock all at once) apart from "some are, some
  // aren't" (ambiguous — click is disabled rather than guessing intent).
  const [statusByUnit, setStatusByUnit] = useState<Record<string, Record<string, DayStatus>>>({});
  // Exact hold expiry per unit/date — admin gets full precision, unlike the
  // customer-facing calendar's deliberately vague day-level hint.
  const [holdExpiryByUnit, setHoldExpiryByUnit] = useState<Record<string, Record<string, string>>>(
    {}
  );
  // Which booking a held OR booked date belongs to — needed to open its info panel.
  const [bookingIdByUnit, setBookingIdByUnit] = useState<Record<string, Record<string, string>>>(
    {}
  );

  // Unified info panel state — used for BOTH held and booked days. Fetched
  // lazily only when a day is actually clicked, since it needs the full
  // booking doc (to know the true start/end of the stay), not just the one
  // day's availability doc.
  const [infoDate, setInfoDate] = useState<string | null>(null);
  const [infoStatus, setInfoStatus] = useState<"held" | "booked" | null>(null);
  const [infoBooking, setInfoBooking] = useState<Booking | null>(null);
  const [refundPercentInput, setRefundPercentInput] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [shrinking, setShrinking] = useState(false);
  const [cancellationTiers, setCancellationTiers] = useState<CancellationTier[]>([]);

  useEffect(() => {
    (async () => {
      const snap = await getDoc(doc(db, "settings", "cancellationPolicy"));
      if (snap.exists()) {
        setCancellationTiers((snap.data().tiers as CancellationTier[]) ?? []);
      }
    })();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(MONTH_STORAGE_KEY, JSON.stringify(cursor));
    } catch {
      // Persistence is a nice-to-have, not required.
    }
  }, [cursor]);

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

  const unitsToShow = selectedUnitIds.length > 0 ? selectedUnitIds : units.map((u) => u.id);

  function closeInfoPanel() {
    setInfoDate(null);
    setInfoStatus(null);
    setInfoBooking(null);
  }

  useEffect(() => {
    closeInfoPanel(); // the open panel would reference a date no longer shown
  }, [cursor]);

  useEffect(() => {
    let cancelled = false;
    const todayIso = new Date().toISOString().slice(0, 10);

    (async () => {
      const result: Record<string, Record<string, DayStatus>> = {};
      const expiryResult: Record<string, Record<string, string>> = {};
      const bookingIdResult: Record<string, Record<string, string>> = {};
      for (const unitId of unitsToShow) {
        result[unitId] = {};
        expiryResult[unitId] = {};
        bookingIdResult[unitId] = {};
        await Promise.all(
          isoDates.map(async (isoDate) => {
            if (isoDate < todayIso) {
              result[unitId][isoDate] = "past";
              return;
            }
            const snap = await getDoc(doc(db, "availability", unitId, "dates", isoDate));
            if (!snap.exists()) {
              result[unitId][isoDate] = "available";
              return;
            }
            const data = snap.data();
            if (data.status === "held") {
              const expired = data.holdExpiresAt && new Date(data.holdExpiresAt) < new Date();
              result[unitId][isoDate] = expired ? "available" : "held";
              if (!expired) {
                if (data.holdExpiresAt) expiryResult[unitId][isoDate] = data.holdExpiresAt;
                if (data.bookingId) bookingIdResult[unitId][isoDate] = data.bookingId;
              }
              return;
            }
            if (data.status === "booked" && data.bookingId) {
              bookingIdResult[unitId][isoDate] = data.bookingId;
            }
            result[unitId][isoDate] = data.status as DayStatus;
          })
        );
      }
      if (!cancelled) {
        setStatusByUnit(result);
        setHoldExpiryByUnit(expiryResult);
        setBookingIdByUnit(bookingIdResult);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isoDates, JSON.stringify(unitsToShow)]);

  /** Combined status across every currently-shown unit for one date — used
   * both for the color shown and for deciding whether a click is allowed. */
  function combinedStatus(isoDate: string): DayStatus {
    const statuses = unitsToShow.map((u) => statusByUnit[u]?.[isoDate] ?? "loading");
    if (statuses.includes("past")) return "past";
    if (statuses.includes("loading")) return "loading";
    if (statuses.includes("booked")) return "booked";
    if (statuses.includes("held")) return "held";
    if (statuses.every((s) => s === "blocked")) return "blocked";
    if (statuses.every((s) => s === "available")) return "available";
    // Mixed available/blocked across units — shown as blocked (still
    // "not fully open"), but clicking is disabled since the correct action
    // is ambiguous.
    return "blocked";
  }

  function isMixed(isoDate: string): boolean {
    const statuses = unitsToShow.map((u) => statusByUnit[u]?.[isoDate] ?? "loading");
    const distinct = new Set(statuses.filter((s) => s === "available" || s === "blocked"));
    return distinct.size > 1;
  }

  /** The hold's exact expiry for a date, taken from whichever shown unit has
   * it — normally identical across all of a single booking's units. */
  function expiryFor(isoDate: string): string | null {
    for (const unitId of unitsToShow) {
      const value = holdExpiryByUnit[unitId]?.[isoDate];
      if (value) return value;
    }
    return null;
  }

  function bookingIdFor(isoDate: string): string | null {
    for (const unitId of unitsToShow) {
      const value = bookingIdByUnit[unitId]?.[isoDate];
      if (value) return value;
    }
    return null;
  }

  async function openInfo(isoDate: string, status: "held" | "booked") {
    if (infoDate === isoDate) {
      closeInfoPanel(); // toggle closed
      return;
    }
    const bookingId = bookingIdFor(isoDate);
    if (!bookingId) return;

    setInfoDate(isoDate);
    setInfoStatus(status);
    setInfoBooking(null);

    const snap = await getDoc(doc(db, "bookings", bookingId));
    if (!snap.exists()) return;
    const booking = { id: snap.id, ...snap.data() } as Booking;
    setInfoBooking(booking);

    if (status === "booked") {
      const daysNotice =
        (new Date(booking.dateRange.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      setRefundPercentInput(String(computeDefaultRefundPercent(daysNotice, cancellationTiers)));
    }
  }

  /** Marks a single date available again in local state, for the units
   * belonging to the given booking — avoids waiting on a full refetch
   * after a cancel or shrink action succeeds. */
  function markDateAvailableLocally(isoDate: string, unitIds: string[]) {
    setStatusByUnit((prev) => {
      const next = { ...prev };
      for (const unitId of unitIds) {
        if (next[unitId]?.[isoDate]) {
          next[unitId] = { ...next[unitId], [isoDate]: "available" };
        }
      }
      return next;
    });
  }

  async function handleCancelHold() {
    if (!infoBooking || !infoDate) return;
    const confirmed = window.confirm(
      `Cancel this entire hold? This releases all ${nightsBetween(
        infoBooking.dateRange.startDate,
        infoBooking.dateRange.endDate
      )} night(s) immediately and can't be undone from here.`
    );
    if (!confirmed) return;

    setCancelling(true);
    try {
      await cancelBookingHold({ bookingId: infoBooking.id });
      let cursorDate = infoBooking.dateRange.startDate;
      while (cursorDate <= infoBooking.dateRange.endDate) {
        markDateAvailableLocally(cursorDate, infoBooking.packageSnapshot.unitIds);
        cursorDate = new Date(new Date(cursorDate + "T00:00:00Z").getTime() + 86400000)
          .toISOString()
          .slice(0, 10);
      }
      onDone("Cancelled the hold — those dates are available again.");
      onHoldChanged?.();
      closeInfoPanel();
    } catch (err) {
      console.error(err);
      onDone("Couldn't cancel that hold — see console for details.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleCancelConfirmed() {
    if (!infoBooking) return;
    const percent = Math.max(0, Math.min(100, Number(refundPercentInput) || 0));
    const refundAmount = Math.round(infoBooking.depositAmount * (percent / 100) * 100) / 100;

    const confirmed = window.confirm(
      `Cancel this booking and refund ${percent}% ($${refundAmount.toFixed(2)})? This can't be undone from here.`
    );
    if (!confirmed) return;

    setCancelling(true);
    try {
      const result = await cancelConfirmedBooking({
        bookingId: infoBooking.id,
        overridePercent: percent,
      });
      const data = result.data as { refundAmount: number; refundStatus: string };

      let cursorDate = infoBooking.dateRange.startDate;
      while (cursorDate <= infoBooking.dateRange.endDate) {
        markDateAvailableLocally(cursorDate, infoBooking.packageSnapshot.unitIds);
        cursorDate = new Date(new Date(cursorDate + "T00:00:00Z").getTime() + 86400000)
          .toISOString()
          .slice(0, 10);
      }

      const refundNote =
        data.refundStatus === "manual_required"
          ? `refund of $${data.refundAmount.toFixed(2)} needs manual processing`
          : data.refundStatus === "refunded"
          ? `$${data.refundAmount.toFixed(2)} refunded`
          : "no refund due";
      onDone(`Booking cancelled — ${refundNote}.`);
      closeInfoPanel();
    } catch (err) {
      console.error(err);
      onDone("Couldn't cancel that booking — see console for details.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleShrink() {
    if (!infoBooking || !infoDate) return;
    const isConfirmed = infoStatus === "booked";
    const confirmed = window.confirm(
      `Remove ${infoDate} from this ${isConfirmed ? "booking" : "hold"}? The remaining nights ` +
        `stay ${isConfirmed ? "booked" : "held"}, and the price will be recalculated` +
        `${isConfirmed ? ", with any owed refund" : ""}.`
    );
    if (!confirmed) return;

    setShrinking(true);
    try {
      const result = await shrinkBookingDateRange({ bookingId: infoBooking.id, removeDate: infoDate });
      const data = result.data as { newTotal: number; refundAmount: number; refundStatus: string };

      markDateAvailableLocally(infoDate, infoBooking.packageSnapshot.unitIds);

      const refundNote =
        isConfirmed && data.refundAmount > 0
          ? data.refundStatus === "manual_required"
            ? ` — refund of $${data.refundAmount.toFixed(2)} needs manual processing`
            : ` — $${data.refundAmount.toFixed(2)} refunded`
          : "";
      onDone(`Removed ${infoDate} — new total $${data.newTotal.toLocaleString()}${refundNote}.`);
      onHoldChanged?.();
      closeInfoPanel();
    } catch (err) {
      console.error(err);
      onDone("Couldn't remove that date — see console for details.");
    } finally {
      setShrinking(false);
    }
  }

  async function toggleDate(isoDate: string) {
    const status = combinedStatus(isoDate);
    if (status !== "available" && status !== "blocked") return;
    if (isMixed(isoDate)) return; // ambiguous — require resolving via the unit checkboxes first

    const action = status === "available" ? "block" : "unblock";
    await Promise.all(
      unitsToShow.map(async (unitId) => {
        const ref = doc(db, "availability", unitId, "dates", isoDate);
        if (action === "block") {
          await setDoc(ref, { status: "blocked" });
        } else {
          await deleteDoc(ref);
        }
      })
    );

    setStatusByUnit((prev) => {
      const next = { ...prev };
      for (const unitId of unitsToShow) {
        next[unitId] = { ...next[unitId], [isoDate]: action === "block" ? "blocked" : "available" };
      }
      return next;
    });

    const unitLabel =
      unitsToShow.length === units.length
        ? "the whole property"
        : units.filter((u) => unitsToShow.includes(u.id)).map((u) => u.name).join(", ");
    onDone(`${action === "block" ? "Blocked" : "Unblocked"} ${isoDate} for ${unitLabel}`);
  }

  function toggleUnit(unitId: string) {
    setSelectedUnitIds((prev) =>
      prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]
    );
  }

  function changeMonth(delta: number) {
    setCursor((prev) => {
      const d = new Date(prev.year, prev.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const isMultiNight = infoBooking && infoBooking.dateRange.startDate !== infoBooking.dateRange.endDate;
  const isEdgeDate =
    infoBooking &&
    infoDate &&
    (infoDate === infoBooking.dateRange.startDate || infoDate === infoBooking.dateRange.endDate);

  return (
    <div className="admin-availability">
      <div className="admin-availability__units">
        {units.map((unit) => (
          <label key={unit.id} className="admin-availability__unit-toggle">
            <input
              type="checkbox"
              checked={selectedUnitIds.includes(unit.id)}
              onChange={() => toggleUnit(unit.id)}
            />
            {unit.name}
          </label>
        ))}
        <button
          type="button"
          className="admin-availability__select-all"
          onClick={() => setSelectedUnitIds(units.map((u) => u.id))}
        >
          Select all
        </button>
        {selectedUnitIds.length > 0 && (
          <button
            type="button"
            className="admin-availability__select-all"
            onClick={() => setSelectedUnitIds([])}
          >
            Clear
          </button>
        )}
      </div>
      <p className="admin-availability__hint">
        {selectedUnitIds.length === 0
          ? "No units selected — showing all three combined. Check specific units to manage them individually."
          : `Managing: ${units.filter((u) => selectedUnitIds.includes(u.id)).map((u) => u.name).join(", ")}`}
      </p>

      <div className="admin-availability__header">
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">
          ←
        </button>
        <h3>
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </h3>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Next month">
          →
        </button>
      </div>

      <div className="admin-availability__weekdays">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="admin-availability__grid">
        {Array.from({ length: firstWeekday }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {isoDates.map((isoDate) => {
          const status = combinedStatus(isoDate);
          const mixed = isMixed(isoDate);
          const dayNum = Number(isoDate.slice(-2));
          const togglable = (status === "available" || status === "blocked") && !mixed;
          const expiry = status === "held" ? expiryFor(isoDate) : null;
          const bookedClickable = status === "booked" && !mixed && !!bookingIdFor(isoDate);
          const clickable = togglable || !!expiry || bookedClickable;
          const tooltip = mixed
            ? "Units disagree — check individual units to resolve"
            : expiry
            ? `Held until ${new Date(expiry).toLocaleString()}`
            : bookedClickable
            ? "Click for booking details and cancellation"
            : status;
          return (
            <button
              key={isoDate}
              type="button"
              disabled={!clickable}
              onClick={() => {
                if (expiry) {
                  openInfo(isoDate, "held");
                  return;
                }
                if (bookedClickable) {
                  openInfo(isoDate, "booked");
                  return;
                }
                toggleDate(isoDate);
              }}
              title={tooltip}
              className={[
                "admin-availability__day",
                `admin-availability__day--${status}`,
                mixed ? "admin-availability__day--mixed" : "",
                infoDate === isoDate ? "admin-availability__day--info-open" : "",
              ].join(" ")}
              aria-label={`${MONTH_NAMES[cursor.month]} ${dayNum}, ${tooltip}`}
            >
              {dayNum}
              {statusIcon(status) && !mixed && (
                <span className="admin-availability__day-icon" aria-hidden="true">
                  {statusIcon(status)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {infoDate && infoBooking && (
        <div className="admin-availability__hold-detail">
          <p>
            <strong>{infoBooking.clientName}</strong> — {infoBooking.packageSnapshot.name}
            <br />
            {infoBooking.dateRange.startDate}
            {infoBooking.dateRange.startDate !== infoBooking.dateRange.endDate &&
              ` – ${infoBooking.dateRange.endDate}`}
            {infoStatus === "held" && infoBooking.holdExpiresAt && (
              <>
                <br />
                Hold expires exactly at{" "}
                <strong>{new Date(infoBooking.holdExpiresAt).toLocaleString()}</strong>.
              </>
            )}
            {infoStatus === "booked" && (
              <>
                <br />
                Deposit paid: ${infoBooking.depositAmount.toLocaleString()}
              </>
            )}
          </p>

          {isMultiNight && (
            isEdgeDate ? (
              <button
                type="button"
                className="admin-availability__cancel-hold admin-availability__cancel-hold--secondary"
                onClick={handleShrink}
                disabled={shrinking}
              >
                {shrinking ? "Removing…" : `Remove just ${infoDate} (keep the rest)`}
              </button>
            ) : (
              <p className="admin-availability__middle-date-note">
                {infoDate} is in the middle of this{" "}
                {nightsBetween(infoBooking.dateRange.startDate, infoBooking.dateRange.endDate)}-night
                stay — removing just this night isn't supported yet, since it would split the
                booking into two separate stays. Cancel the whole thing instead, or handle this
                one manually.
              </p>
            )
          )}

          {infoStatus === "held" ? (
            <button
              type="button"
              className="admin-availability__cancel-hold"
              onClick={handleCancelHold}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling…" : "Cancel entire hold"}
            </button>
          ) : (
            <>
              <label className="admin-availability__refund-input">
                Refund %
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={refundPercentInput}
                  onChange={(e) => setRefundPercentInput(e.target.value)}
                />
                <span className="admin-availability__refund-amount">
                  = $
                  {((infoBooking.depositAmount * (Number(refundPercentInput) || 0)) / 100).toFixed(2)}
                </span>
              </label>
              <button
                type="button"
                className="admin-availability__cancel-hold"
                onClick={handleCancelConfirmed}
                disabled={cancelling}
              >
                {cancelling ? "Processing…" : "Cancel entire booking & refund"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="admin-availability__legend">
        <span><i className="admin-availability__swatch admin-availability__swatch--available" /> Available</span>
        <span><i className="admin-availability__swatch admin-availability__swatch--held" /> ○ Pending hold (click for details)</span>
        <span><i className="admin-availability__swatch admin-availability__swatch--booked" /> ● Booked (click for details)</span>
        <span><i className="admin-availability__swatch admin-availability__swatch--blocked" /> ✕ Blocked by you</span>
      </div>
      <p className="admin-availability__click-hint">
        Click an available date to block it, or a blocked date to unblock it. Click a held or
        booked date to see details — you can cancel the whole stay, or, if you clicked the first
        or last night of a multi-night stay, remove just that one night and keep the rest.
      </p>
    </div>
  );
}
