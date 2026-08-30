import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2/https";
import Stripe from "stripe";
import { releaseUnits } from "./availability";
import { getPriceForRange } from "./pricing";
import { Booking } from "./types";

const db = () => admin.firestore();

interface ShrinkBookingInput {
  bookingId: string;
  /** Must exactly match the booking's current dateRange.startDate or
   * .endDate. Removing a night from the middle of a multi-night stay would
   * split it into two separate, non-contiguous bookings — a bigger change
   * to the booking model than this supports. */
  removeDate: string;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Removes one night from either edge of a held or confirmed booking,
 * keeping the remaining nights under the same booking. Recomputes the
 * price for the shrunk range via getPriceForRange — the same single source
 * of truth used everywhere else — and, for an already-paid booking,
 * refunds the difference between the old and new deposit amount.
 */
export const shrinkBookingDateRange = functions.onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new functions.HttpsError("permission-denied", "Admin access required");
  }

  const { bookingId, removeDate } = request.data as ShrinkBookingInput;
  const bookingRef = db().collection("bookings").doc(bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) throw new functions.HttpsError("not-found", "Booking not found");
  const booking = bookingSnap.data() as Booking;

  if (booking.status !== "held" && booking.status !== "confirmed") {
    throw new functions.HttpsError(
      "failed-precondition",
      `Booking is ${booking.status} — nothing to shrink`
    );
  }

  const { startDate, endDate } = booking.dateRange;
  if (startDate === endDate) {
    throw new functions.HttpsError(
      "failed-precondition",
      "This booking is only one night — cancel it instead of shrinking it"
    );
  }

  let newStart = startDate;
  let newEnd = endDate;
  if (removeDate === startDate) {
    newStart = addDays(startDate, 1);
  } else if (removeDate === endDate) {
    newEnd = addDays(endDate, -1);
  } else {
    throw new functions.HttpsError(
      "invalid-argument",
      "Only the first or last night of a stay can be removed this way — removing a night " +
        "from the middle would split this into two separate bookings, which isn't supported."
    );
  }

  const newDateRange = { startDate: newStart, endDate: newEnd };
  const { total: newTotal, nightlyBreakdown } = await getPriceForRange(
    booking.packageSnapshot.packageId,
    newDateRange
  );

  const oldDeposit = booking.depositAmount;
  const newDeposit = Math.round(newTotal * 0.3 * 100) / 100;
  const newBalanceDue = Math.round((newTotal - newDeposit) * 100) / 100;

  let refundAmount = 0;
  let refundStatus: "refunded" | "manual_required" | "not_applicable" = "not_applicable";

  if (booking.status === "confirmed") {
    refundAmount = Math.round((oldDeposit - newDeposit) * 100) / 100;
    if (refundAmount > 0) {
      if (booking.stripePaymentIntentId) {
        try {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
          await stripe.refunds.create({
            payment_intent: booking.stripePaymentIntentId,
            amount: Math.round(refundAmount * 100),
          });
          refundStatus = "refunded";
        } catch (err) {
          console.error("Stripe partial refund failed — needs manual processing", err);
          refundStatus = "manual_required";
        }
      } else {
        refundStatus = "manual_required";
      }
    }
  }

  await db().runTransaction(async (txn) => {
    releaseUnits(txn, booking.packageSnapshot.unitIds, {
      startDate: removeDate,
      endDate: removeDate,
    });
    txn.update(bookingRef, {
      dateRange: newDateRange,
      packageSnapshot: {
        ...booking.packageSnapshot,
        dateRange: newDateRange,
        nightlyBreakdown,
        totalPrice: newTotal,
      },
      depositAmount: newDeposit,
      balanceDue: newBalanceDue,
      updatedAt: new Date().toISOString(),
    });
  });

  return { newDateRange, newTotal, refundAmount, refundStatus };
});
