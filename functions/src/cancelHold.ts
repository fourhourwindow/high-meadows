import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2/https";
import { releaseUnits } from "./availability";
import { Booking } from "./types";

const db = () => admin.firestore();

interface CancelHoldInput {
  bookingId: string;
}

/**
 * Admin-only: cancels an active hold before it would naturally expire — the
 * couple called to say they've changed their mind, someone held the wrong
 * dates by mistake, etc. Releases the units immediately and marks the
 * booking "cancelled" rather than deleting it, so there's still a record of
 * what happened. (Deleting the document instead would also release the
 * units, via the onBookingDeleted trigger — but it throws away the
 * history, which isn't what you want for a real customer interaction.)
 *
 * Only works on bookings still in "held" status — a confirmed booking
 * needs real cancellation/refund handling, not this.
 */
export const cancelBookingHold = functions.onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new functions.HttpsError("permission-denied", "Admin access required");
  }

  const { bookingId } = request.data as CancelHoldInput;
  const bookingRef = db().collection("bookings").doc(bookingId);

  await db().runTransaction(async (txn) => {
    const snap = await txn.get(bookingRef);
    if (!snap.exists) throw new functions.HttpsError("not-found", "Booking not found");
    const booking = snap.data() as Booking;

    if (booking.status !== "held") {
      throw new functions.HttpsError(
        "failed-precondition",
        `Booking is ${booking.status}, not an active hold — nothing to cancel`
      );
    }

    releaseUnits(txn, booking.packageSnapshot.unitIds, booking.dateRange);

    txn.update(bookingRef, {
      status: "cancelled",
      holdExpiresAt: admin.firestore.FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });
  });

  return { success: true };
});
