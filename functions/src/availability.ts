import * as admin from "firebase-admin";
import { AvailabilityDoc, DateRange } from "./types";
import { eachDateInRange } from "./pricing";

const db = () => admin.firestore();

export class UnavailableError extends Error {
  constructor(public unitId: string, public date: string) {
    super(`Unit ${unitId} is not available on ${date}`);
  }
}

/**
 * Reads availability/{unitId}/dates/{date} for every unit x date combo in
 * the range. Call this INSIDE a Firestore transaction (pass `txn`) so the
 * read is part of the same atomic operation as the subsequent write — a
 * read-then-write outside a transaction is a race condition waiting to
 * double-book a Saturday.
 */
export async function assertUnitsAvailable(
  txn: FirebaseFirestore.Transaction,
  unitIds: string[],
  range: DateRange
): Promise<void> {
  const dates = eachDateInRange(range);
  const refs = unitIds.flatMap((unitId) =>
    dates.map((date) => ({
      unitId,
      date,
      ref: db().collection("availability").doc(unitId).collection("dates").doc(date),
    }))
  );

  const snaps = await Promise.all(refs.map((r) => txn.get(r.ref)));

  snaps.forEach((snap, i) => {
    const { unitId, date } = refs[i];
    if (!snap.exists) return; // no doc = available by default
    const data = snap.data() as AvailabilityDoc;
    if (data.status === "booked" || data.status === "blocked") {
      throw new UnavailableError(unitId, date);
    }
    if (data.status === "held") {
      // Still counts as unavailable unless the hold has expired.
      const expired =
        data.holdExpiresAt && new Date(data.holdExpiresAt) < new Date();
      if (!expired) throw new UnavailableError(unitId, date);
    }
  });
}

/**
 * Writes a "held" status for every unit x date combo in the range. Must be
 * called inside the same transaction as assertUnitsAvailable so the
 * check-then-write is atomic.
 */
export function holdUnits(
  txn: FirebaseFirestore.Transaction,
  unitIds: string[],
  range: DateRange,
  bookingId: string,
  holdExpiresAt: string
): void {
  const dates = eachDateInRange(range);
  for (const unitId of unitIds) {
    for (const date of dates) {
      const ref = db().collection("availability").doc(unitId).collection("dates").doc(date);
      txn.set(ref, { status: "held", bookingId, holdExpiresAt } as AvailabilityDoc);
    }
  }
}

/** Flips held dates to "booked" — call on successful payment. */
export function confirmUnits(
  txn: FirebaseFirestore.Transaction,
  unitIds: string[],
  range: DateRange,
  bookingId: string
): void {
  const dates = eachDateInRange(range);
  for (const unitId of unitIds) {
    for (const date of dates) {
      const ref = db().collection("availability").doc(unitId).collection("dates").doc(date);
      txn.set(ref, { status: "booked", bookingId } as AvailabilityDoc);
    }
  }
}

/** Releases units back to available — call on expiry, cancellation, or downgrade. */
export function releaseUnits(
  txn: FirebaseFirestore.Transaction,
  unitIds: string[],
  range: DateRange
): void {
  const dates = eachDateInRange(range);
  for (const unitId of unitIds) {
    for (const date of dates) {
      const ref = db().collection("availability").doc(unitId).collection("dates").doc(date);
      txn.delete(ref); // absence of a doc = available, per assertUnitsAvailable
    }
  }
}
