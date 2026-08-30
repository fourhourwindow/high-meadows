import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { releaseUnits } from "./availability";
import { Booking, ChangeRequest } from "./types";

const db = () => admin.firestore();

/**
 * Runs every 5 minutes. Sweeps bookings and change requests whose hold has
 * expired without payment, releasing the units back to available. Without
 * this, an abandoned checkout would permanently block a date.
 */
export const releaseExpiredHolds = onSchedule("every 5 minutes", async () => {
  const nowIso = new Date().toISOString();

  const expiredBookings = await db()
    .collection("bookings")
    .where("status", "==", "held")
    .where("holdExpiresAt", "<", nowIso)
    .get();

  for (const doc of expiredBookings.docs) {
    const booking = doc.data() as Booking;
    await db().runTransaction(async (txn) => {
      releaseUnits(txn, booking.packageSnapshot.unitIds, booking.dateRange);
      txn.update(doc.ref, { status: "expired", updatedAt: nowIso });
    });
  }

  const expiredChanges = await db()
    .collection("changeRequests")
    .where("status", "==", "pending")
    .where("expiresAt", "<", nowIso)
    .get();

  for (const doc of expiredChanges.docs) {
    const changeReq = doc.data() as ChangeRequest;
    if (changeReq.changeType === "upgrade") {
      // Only upgrades hold new units pending payment; downgrades don't
      // reserve anything until approved, so there's nothing to release.
      const bookingSnap = await db().collection("bookings").doc(changeReq.bookingId).get();
      const booking = bookingSnap.data() as Booking;
      await db().runTransaction(async (txn) => {
        releaseUnits(txn, changeReq.unitDelta, booking.dateRange);
        txn.update(doc.ref, { status: "expired" });
      });
    } else {
      await doc.ref.update({ status: "expired" });
    }
  }
});
