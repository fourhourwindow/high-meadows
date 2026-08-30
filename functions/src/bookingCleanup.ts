import * as admin from "firebase-admin";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { releaseUnits } from "./availability";
import { Booking } from "./types";

const db = () => admin.firestore();

/**
 * Safety net: whenever a bookings/{bookingId} document is deleted — by an
 * admin cleaning up test data, a future "cancel booking" feature, or
 * anything else — this releases the matching availability docs so the
 * calendar doesn't keep showing those dates as held/booked forever.
 *
 * Without this, `bookings` and `availability` can drift out of sync,
 * since deleting one collection's document was never wired to touch the
 * other — they're only kept consistent by the app's own code paths
 * (createBookingHold, the scheduled expiry sweep, admin block/unblock),
 * not by anything watching for a raw deletion.
 */
export const onBookingDeleted = onDocumentDeleted("bookings/{bookingId}", async (event) => {
  const deleted = event.data?.data() as Booking | undefined;
  if (!deleted) return;

  await db().runTransaction(async (txn) => {
    releaseUnits(txn, deleted.packageSnapshot.unitIds, deleted.dateRange);
  });
});
