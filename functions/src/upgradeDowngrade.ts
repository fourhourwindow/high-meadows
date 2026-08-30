import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2/https";
import { assertUnitsAvailable, holdUnits, confirmUnits, releaseUnits } from "./availability";
import { getPriceForRange } from "./pricing";
import { Booking, ChangeRequest, ChangeType, Package } from "./types";

const db = () => admin.firestore();
// Matches the initial booking hold window in booking.ts — see that file's
// comment for reasoning. Feel free to make this shorter than the initial
// hold if you'd rather couples decide on upgrades faster once they've
// already committed to a booking.
const HOLD_DURATION_HOURS = 48;
const DOWNGRADE_CUTOFF_DAYS = 30;

interface RequestChangeInput {
  bookingId: string;
  requestedPackageId: string;
}

/**
 * Step 1: client requests a package change (up or down). Computes the unit
 * delta and price difference via the same getPriceForRange used everywhere
 * else, checks the 30-day cutoff for downgrades, and — for upgrades — holds
 * the newly-added units pending payment.
 */
export const requestPackageChange = functions.onCall(async (request) => {
  const { bookingId, requestedPackageId } = request.data as RequestChangeInput;

  const bookingRef = db().collection("bookings").doc(bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) throw new functions.HttpsError("not-found", "Booking not found");
  const booking = bookingSnap.data() as Booking;

  const requestedPkgSnap = await db().collection("packages").doc(requestedPackageId).get();
  if (!requestedPkgSnap.exists) throw new functions.HttpsError("not-found", "Package not found");
  const requestedPkg = requestedPkgSnap.data() as Package;

  const currentUnitIds = new Set(booking.packageSnapshot.unitIds);
  const requestedUnitIds = new Set(requestedPkg.unitIds);

  const addedUnits = requestedPkg.unitIds.filter((u) => !currentUnitIds.has(u));
  const removedUnits = booking.packageSnapshot.unitIds.filter((u) => !requestedUnitIds.has(u));

  const changeType: ChangeType = addedUnits.length > 0 ? "upgrade" : "downgrade";

  if (changeType === "downgrade") {
    const daysUntilEvent =
      (new Date(booking.dateRange.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysUntilEvent < DOWNGRADE_CUTOFF_DAYS) {
      throw new functions.HttpsError(
        "failed-precondition",
        `Downgrades must be requested at least ${DOWNGRADE_CUTOFF_DAYS} days before the event`
      );
    }
  }

  // Price is always recomputed from scratch for both packages over the
  // same date range — never diff cached totals.
  const [currentPrice, requestedPrice] = await Promise.all([
    getPriceForRange(booking.packageSnapshot.packageId, booking.dateRange),
    getPriceForRange(requestedPackageId, booking.dateRange),
  ]);
  const priceDifference =
    Math.round((requestedPrice.total - currentPrice.total) * 100) / 100;

  const requestRef = db().collection("changeRequests").doc();
  const expiresAt = new Date(
    Date.now() + HOLD_DURATION_HOURS * 60 * 60 * 1000
  ).toISOString();

  await db().runTransaction(async (txn) => {
    if (changeType === "upgrade") {
      // Only the newly-added units need an availability check — units
      // already on the booking are already held/booked by definition.
      await assertUnitsAvailable(txn, addedUnits, booking.dateRange);
      holdUnits(txn, addedUnits, booking.dateRange, bookingId, expiresAt);
    }

    const changeRequest: ChangeRequest = {
      id: requestRef.id,
      bookingId,
      changeType,
      currentPackageId: booking.packageSnapshot.packageId,
      requestedPackageId,
      unitDelta: changeType === "upgrade" ? addedUnits : removedUnits,
      priceDifference,
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt,
    };
    txn.set(requestRef, changeRequest);
  });

  return { changeRequestId: requestRef.id, changeType, priceDifference, expiresAt };
});

/**
 * Step 2 for upgrades: called once the price-difference payment succeeds
 * (Stripe webhook). Confirms the held units and updates the booking's
 * package snapshot, preserving the old snapshot in packageHistory.
 */
export async function approveUpgrade(changeRequestId: string, stripePaymentIntentId: string) {
  await applyApprovedChange(changeRequestId, async (txn, booking, changeReq, newSnapshot) => {
    confirmUnits(txn, changeReq.unitDelta, booking.dateRange, booking.id);
    txn.update(db().collection("bookings").doc(booking.id), {
      packageSnapshot: newSnapshot,
      packageHistory: admin.firestore.FieldValue.arrayUnion(booking.packageSnapshot),
      stripePaymentIntentId,
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * Step 2 for downgrades: called once the refund has been issued via Stripe
 * (see stripeWebhook.ts / a manual admin action). Releases the removed
 * units and updates the booking's package snapshot.
 */
export async function approveDowngrade(changeRequestId: string, stripeRefundId: string) {
  await applyApprovedChange(changeRequestId, async (txn, booking, changeReq, newSnapshot) => {
    releaseUnits(txn, changeReq.unitDelta, booking.dateRange);
    txn.update(db().collection("bookings").doc(booking.id), {
      packageSnapshot: newSnapshot,
      packageHistory: admin.firestore.FieldValue.arrayUnion(booking.packageSnapshot),
      updatedAt: new Date().toISOString(),
    });
  });
}

async function applyApprovedChange(
  changeRequestId: string,
  applyUnitChange: (
    txn: FirebaseFirestore.Transaction,
    booking: Booking,
    changeReq: ChangeRequest,
    newSnapshot: Booking["packageSnapshot"]
  ) => void
) {
  const changeRef = db().collection("changeRequests").doc(changeRequestId);

  await db().runTransaction(async (txn) => {
    const changeSnap = await txn.get(changeRef);
    if (!changeSnap.exists) throw new Error("Change request not found");
    const changeReq = changeSnap.data() as ChangeRequest;
    if (changeReq.status !== "pending") return; // idempotent on webhook retries

    const bookingRef = db().collection("bookings").doc(changeReq.bookingId);
    const bookingSnap = await txn.get(bookingRef);
    const booking = bookingSnap.data() as Booking;

    const requestedPkgSnap = await db().collection("packages").doc(changeReq.requestedPackageId).get();
    const requestedPkg = requestedPkgSnap.data() as Package;
    // requestedPkg.id is always undefined — Firestore's .data() never
    // includes the document's own ID. changeReq.requestedPackageId (the
    // string this doc was fetched by) is the real ID.
    const { total, nightlyBreakdown } = await getPriceForRange(
      changeReq.requestedPackageId,
      booking.dateRange
    );

    const newSnapshot = {
      packageId: changeReq.requestedPackageId,
      name: requestedPkg.name,
      unitIds: requestedPkg.unitIds,
      dateRange: booking.dateRange,
      nightlyBreakdown,
      totalPrice: total,
    };

    applyUnitChange(txn, booking, changeReq, newSnapshot);
    txn.update(changeRef, { status: "approved" });
  });
}
