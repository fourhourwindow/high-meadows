import { useState } from "react";
import { createBookingHold } from "../lib/firebase";
import { trackEvent } from "../lib/analytics";
import type { Package } from "../types";
import "./BookingFlow.css";

interface Props {
  pkg: Package;
  dateRange: { startDate: string; endDate: string };
  /** Called after a successful hold, and when the visitor wants to pick
   * different dates instead — lets the parent (Booking.tsx) reset its
   * range selection and refresh the calendar's availability. */
  onDone: () => void;
}

interface HoldResult {
  bookingId: string;
  totalPrice: number;
  nightlyBreakdown: { date: string; dayOfWeek: string; nightRate: number }[];
  holdExpiresAt: string;
}

/**
 * Formats a plain "YYYY-MM-DD" date string as "M/D/YYYY". Parses the string
 * directly rather than going through `new Date(isoDate)` — the Date
 * constructor treats a bare date string as UTC midnight, which can roll
 * back a day once converted to a negative-UTC-offset local timezone (most
 * of the US). Splitting the string avoids that entirely.
 */
function formatMDY(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${month}/${day}/${year}`;
}

/**
 * Collects guest details, creates a hold via the createBookingHold Cloud
 * Function (which re-checks availability and recomputes price
 * server-side — never trust the client for either), then hands off to
 * Stripe Checkout for the deposit. Replace the checkout redirect with your
 * own Checkout Session creation call once Stripe is wired up — omitted
 * here since it's a thin wrapper around the Stripe SDK you'd add
 * separately (see stripeWebhook.ts's metadata contract: { bookingId,
 * purpose: "deposit" }).
 */
export function BookingFlow({ pkg, dateRange, onDone }: Props) {
  const [form, setForm] = useState({ clientName: "", email: "", phone: "", guestCount: 2 });
  const [hold, setHold] = useState<HoldResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await createBookingHold({
        packageId: pkg.id,
        dateRange,
        ...form,
      });
      const holdResult = result.data as HoldResult;
      setHold(holdResult);
      trackEvent("hold_created", {
        package_name: pkg.name,
        value: holdResult.totalPrice,
        currency: "USD",
      });
    } catch (err: any) {
      setError(
        err.message ?? "That package just became unavailable for these dates. Please pick another date."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (hold) {
    const holdExpiry = new Date(hold.holdExpiresAt);
    return (
      <div className="booking-flow booking-flow__confirmation">
        <h3>Your dates are held.</h3>
        <p className="booking-flow__hold-expiry">
          This hold is reserved for you until {holdExpiry.toLocaleString()} — after that, if a
          deposit hasn't been made, the dates open back up.
        </p>
        <ul className="booking-flow__breakdown">
          {hold.nightlyBreakdown.map((n) => (
            <li key={n.date}>
              <span>{n.dayOfWeek}, {formatMDY(n.date)}</span>
              <span>${n.nightRate.toLocaleString()}</span>
            </li>
          ))}
        </ul>
        <p className="booking-flow__total">
          Total: <strong>${hold.totalPrice.toLocaleString()}</strong>
        </p>
        <p className="booking-flow__next-step">
          Next: pay a deposit to confirm — deposit checkout isn't wired up
          yet, so for now reach out directly to complete this booking.
        </p>
        <button type="button" className="btn btn-secondary" onClick={onDone}>
          Choose different dates
        </button>
      </div>
    );
  }

  return (
    <form className="booking-flow" onSubmit={handleSubmit}>
      <h3>Book {pkg.name}</h3>
      <p className="booking-flow__dates">
        {formatMDY(dateRange.startDate)}
        {dateRange.startDate !== dateRange.endDate && ` – ${formatMDY(dateRange.endDate)}`}
      </p>

      <label>
        Name
        <input
          required
          value={form.clientName}
          onChange={(e) => setForm({ ...form, clientName: e.target.value })}
        />
      </label>
      <label>
        Email
        <input
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </label>
      <label>
        Phone
        <input
          required
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </label>
      <label>
        Guest count
        <input
          type="number"
          min={1}
          max={pkg.maxGuestCount}
          value={form.guestCount}
          onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value) })}
        />
      </label>

      {error && (
        <p role="alert" className="booking-flow__error">
          {error}
        </p>
      )}

      <div className="booking-flow__actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Checking availability…" : "Hold these dates"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onDone}>
          Choose different dates
        </button>
      </div>
    </form>
  );
}
