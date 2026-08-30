import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2/https";
import Stripe from "stripe";
import { releaseUnits } from "./availability";
import { Booking, CancellationTier } from "./types";

const db = () => admin.firestore();

interface CancelConfirmedInput {
  bookingId: string;
  /** Admin-typed refund percentage (0-100) — overrides the computed
   * sliding-scale default when provided. */
  overridePercent?: number;
}

/** Picks the tier for the given notice period: the tier with the highest
 * minDaysBeforeEvent that the notice still satisfies. 95 days' notice
 * qualifies for a 90-day tier, not the 60-day one below it. */
function computeDefaultRefundPercent(daysNotice: number, tiers: CancellationTier[]): number {
  const sorted = [...tiers].sort((a, b) => b.minDaysBeforeEvent - a.minDaysBeforeEvent);
  const match = sorted.find((t) => daysNotice >= t.minDaysBeforeEvent);
  return match ? match.refundPercent : 0;
}

/**
 * Cancels a CONFIRMED booking (deposit already paid) — distinct from
 * cancelBookingHold, which only handles un-paid holds. Computes a refund
 * from the sliding-scale policy in settings/cancellationPolicy unless the
 * admin supplies an explicit override percentage. Releases the units
 * either way, since the point is reopening the date regardless of how the
 * refund math shakes out.
 *
 * The actual Stripe refund can only succeed once real Stripe secrets are
 * configured and a genuine PaymentIntent exists on the booking — before
 * that, refundStatus comes back "manual_required" so the admin knows to
 * handle the refund outside the app rather than the request silently
 * failing.
 */
export const cancelConfirmedBooking = functions.onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new functions.HttpsError("permission-denied", "Admin access required");
  }

  const { bookingId, overridePercent } = request.data as CancelConfirmedInput;
  const bookingRef = db().collection("bookings").doc(bookingId);

  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) throw new functions.HttpsError("not-found", "Booking not found");
  const booking = bookingSnap.data() as Booking;

  if (booking.status !== "confirmed") {
    throw new functions.HttpsError(
      "failed-precondition",
      `Booking is ${booking.status}, not confirmed — nothing to cancel here`
    );
  }

  const daysNotice =
    (new Date(booking.dateRange.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  let refundPercent: number;
  if (typeof overridePercent === "number") {
    refundPercent = Math.max(0, Math.min(100, overridePercent));
  } else {
    const policySnap = await db().collection("settings").doc("cancellationPolicy").get();
    const tiers = (policySnap.data()?.tiers as CancellationTier[] | undefined) ?? [];
    refundPercent = computeDefaultRefundPercent(daysNotice, tiers);
  }

  const refundAmount = Math.round(booking.depositAmount * (refundPercent / 100) * 100) / 100;

  let refundStatus: "refunded" | "manual_required" | "not_applicable" = "not_applicable";
  if (refundAmount > 0 && booking.stripePaymentIntentId) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
      await stripe.refunds.create({
        payment_intent: booking.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100), // Stripe wants cents
      });
      refundStatus = "refunded";
    } catch (err) {
      // Stripe not configured yet, or the refund itself failed — either
      // way, don't let that block releasing the date. Flag it for manual
      // handling instead of silently losing track of an owed refund.
      console.error("Stripe refund failed — needs manual processing", err);
      refundStatus = "manual_required";
    }
  }

  await db().runTransaction(async (txn) => {
    releaseUnits(txn, booking.packageSnapshot.unitIds, booking.dateRange);
    txn.update(bookingRef, {
      status: "cancelled",
      refundPercent,
      refundAmount,
      refundStatus,
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  return { refundPercent, refundAmount, refundStatus };
});
