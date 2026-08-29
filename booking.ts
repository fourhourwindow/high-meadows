import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2/https";
import { assertUnitsAvailable, holdUnits, confirmUnits } from "./availability";
import { getPriceForRange } from "./pricing";
import { Booking, DateRange, Package, PackageSnapshot } from "./types";

const db = () => admin.firestore();

const HOLD_DURATION_MINUTES = 15;

interface CreateHoldRequest {
  packageId: string;
  dateRange: DateRange;
  clientName: string;
  email: string;
  phone: string;
  guestCount: number;
}

/**
 * Step 1 of booking: hold the requested package's units for a short window
 * while the client completes payment. Runs the availability check and the
 * hold write in a single transaction so two people can't grab the same
 * Saturday at the same time.
 */
export const createBookingHold = functions.onCall(async (request) => {
  const data = request.data as CreateHoldRequest;

  const packageSnap = await db().collection("packages").doc(data.packageId).get();
  if (!packageSnap.exists) {
    throw new functions.HttpsError("not-found", "Package not found");
  }
  const pkg = packageSnap.data() as Package;
  if (!pkg.active) {
    throw new functions.HttpsError("failed-precondition", "Package is not currently offered");
  }
  if (data.guestCount > pkg.maxGuestCount) {
    throw new functions.HttpsError(
      "invalid-argument",
      `This package accommodates up to ${pkg.maxGuestCount} guests`
    );
  }

  // Price is always recomputed server-side — never trust a client-supplied number.
  const { total, nightlyBreakdown } = await getPriceForRange(pkg.id, data.dateRange);

  const bookingRef = db().collection("bookings").doc();
  const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60_000).toISOString();
  const now = new Date().toISOString();

  const packageSnapshot: PackageSnapshot = {
    packageId: pkg.id,
    name: pkg.name,
    unitIds: pkg.unitIds,
    dateRange: data.dateRange,
    nightlyBreakdown,
    totalPrice: total,
  };

  await db().runTransaction(async (txn) => {
    await assertUnitsAvailable(txn, pkg.unitIds, data.dateRange);
    holdUnits(txn, pkg.unitIds, data.dateRange, bookingRef.id, holdExpiresAt);

    const booking: Booking = {
      id: bookingRef.id,
      dateRange: data.dateRange,
      packageSnapshot,
      clientName: data.clientName,
      email: data.email,
      phone: data.phone,
      guestCount: data.guestCount,
      depositAmount: Math.round(total * 0.3 * 100) / 100, // 30% deposit — adjust to your policy
      depositPaid: false,
      balanceDue: Math.round(total * 0.7 * 100) / 100,
      balanceDueDate: "", // set once confirmed, e.g. 30 days before dateRange.startDate
      status: "held",
      holdExpiresAt,
      createdAt: now,
      updatedAt: now,
    };
    txn.set(bookingRef, booking);
  });

  return { bookingId: bookingRef.id, totalPrice: total, nightlyBreakdown, holdExpiresAt };
});

/**
 * Step 2: called from the Stripe webhook handler (see stripeWebhook.ts) once
 * the deposit payment succeeds. Flips the hold to a confirmed booking.
 */
export async function confirmBookingPayment(
  bookingId: string,
  stripePaymentIntentId: string
): Promise<void> {
  const bookingRef = db().collection("bookings").doc(bookingId);

  await db().runTransaction(async (txn) => {
    const snap = await txn.get(bookingRef);
    if (!snap.exists) throw new Error(`Booking ${bookingId} not found`);
    const booking = snap.data() as Booking;

    if (booking.status !== "held") {
      // Already confirmed or expired — webhook retries are common, so this
      // is a no-op rather than an error.
      return;
    }

    confirmUnits(txn, booking.packageSnapshot.unitIds, booking.dateRange, bookingId);

    txn.update(bookingRef, {
      status: "confirmed",
      depositPaid: true,
      stripePaymentIntentId,
      holdExpiresAt: admin.firestore.FieldValue.delete(),
      updatedAt: new Date().toISOString(),
    });
  });
}
