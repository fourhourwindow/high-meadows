import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2/https";
import { eachDateInRange } from "./pricing";
import { Booking } from "./types";

const db = () => admin.firestore();

interface ExtendHoldInput {
  bookingId: string;
  /** New expiry as an ISO timestamp — must be later than the current one. */
  newExpiresAt: string;
}

/**
 * Pushes out a hold's expiry — the "someone contacted me directly and needs
 * more time" exception to the default hold window. Admin-only: gated on the
 * same custom claim firestore.rules checks everywhere else.
 *
 * Updates the booking doc AND every availability/{unitId}/dates/{date} doc
 * in its range in one transaction. Updating only the booking would leave
 * the availability docs' own holdExpiresAt stuck at the old time —
 * assertUnitsAvailable() checks THAT field to decide if a held date has
 * expired, so a mismatch would let someone else grab the date out from
 * under an admin-extended hold.
 */
export const extendBookingHold = functions.onCall(async (request) => {
  if (request.auth?.token.admin !== true) {
    throw new functions.HttpsError("permission-denied", "Admin access required");
  }

  const { bookingId, newExpiresAt } = request.data as ExtendHoldInput;
  const bookingRef = db().collection("bookings").doc(bookingId);

  await db().runTransaction(async (txn) => {
    const snap = await txn.get(bookingRef);
    if (!snap.exists) throw new functions.HttpsError("not-found", "Booking not found");
    const booking = snap.data() as Booking;

    if (booking.status !== "held") {
      throw new functions.HttpsError(
        "failed-precondition",
        `Booking is ${booking.status}, not currently held`
      );
    }
    if (new Date(newExpiresAt) <= new Date(booking.holdExpiresAt ?? 0)) {
      throw new functions.HttpsError(
        "invalid-argument",
        "New expiry must be later than the current one"
      );
    }

    txn.update(bookingRef, { holdExpiresAt: newExpiresAt, updatedAt: new Date().toISOString() });

    const dates = eachDateInRange(booking.dateRange);
    for (const unitId of booking.packageSnapshot.unitIds) {
      for (const date of dates) {
        const ref = db().collection("availability").doc(unitId).collection("dates").doc(date);
        txn.set(ref, { status: "held", bookingId, holdExpiresAt: newExpiresAt });
      }
    }
  });

  return { success: true };
});
