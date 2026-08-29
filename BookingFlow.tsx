import { useState } from "react";
import { createBookingHold } from "../lib/firebase";
import type { Package } from "../types";

interface Props {
  pkg: Package;
  dateRange: { startDate: string; endDate: string };
}

interface HoldResult {
  bookingId: string;
  totalPrice: number;
  nightlyBreakdown: { date: string; dayOfWeek: string; nightRate: number }[];
  holdExpiresAt: string;
}

/**
 * Collects guest details, creates a short-lived hold via the
 * createBookingHold Cloud Function (which re-checks availability and
 * recomputes price server-side), then hands off to Stripe Checkout for
 * the deposit. Replace the checkout redirect with your own
 * Checkout Session creation call — omitted here since it's a thin
 * wrapper around the Stripe SDK you'd add separately.
 */
export function BookingFlow({ pkg, dateRange }: Props) {
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
      setHold(result.data as HoldResult);
    } catch (err: any) {
      setError(err.message ?? "That package just became unavailable. Please pick another date.");
    } finally {
      setSubmitting(false);
    }
  }

  if (hold) {
    return (
      <div>
        <h3>Your hold is confirmed for {HOLD_MINUTES_LABEL}</h3>
        <ul>
          {hold.nightlyBreakdown.map((n) => (
            <li key={n.date}>
              {n.dayOfWeek}, {n.date}: ${n.nightRate.toLocaleString()}
            </li>
          ))}
        </ul>
        <p>
          <strong>Total: ${hold.totalPrice.toLocaleString()}</strong>
        </p>
        {/* Next: create a Stripe Checkout Session for the deposit amount,
            with metadata { bookingId: hold.bookingId, purpose: "deposit" },
            then redirect to session.url. */}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>Book {pkg.name}</h3>
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
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? "Checking availability…" : "Hold this date"}
      </button>
    </form>
  );
}

const HOLD_MINUTES_LABEL = "15 minutes — complete payment before it releases";
