import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2/https";
import { getPriceForRange } from "./pricing";
import { Package, SeasonalAdjustment, DayOfWeekRate } from "./types";

const db = () => admin.firestore();

interface RateSnapshotInput {
  /** If provided, each package's actual total for this single date is
   * computed (accounting for day-of-week + season). If omitted, the raw
   * day-of-week rate table is returned instead, since there's no date yet
   * to price against. */
  eventDate?: string;
}

/**
 * Returns current pricing, frozen at the moment it's called. The contact
 * form calls this on submit and embeds the result as a hidden field in the
 * Netlify Forms submission — so the email you receive always reflects
 * exactly what the person was quoted, even if you change rates in the
 * admin dashboard the next day. No admin gate needed: this only returns
 * the same pricing that's already public on the booking page.
 */
export const getRateSnapshot = functions.onCall(async (request) => {
  const { eventDate } = (request.data ?? {}) as RateSnapshotInput;

  const packagesSnap = await db()
    .collection("packages")
    .where("active", "==", true)
    .get();
  const packages = packagesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Package));

  if (eventDate) {
    const quotes = await Promise.all(
      packages.map(async (pkg) => {
        try {
          const { total } = await getPriceForRange(pkg.id, {
            startDate: eventDate,
            endDate: eventDate,
          });
          return { packageId: pkg.id, name: pkg.name, priceForDate: total };
        } catch {
          // Missing rate config for this package/day — omit rather than fail
          // the whole quote for every other package.
          return { packageId: pkg.id, name: pkg.name, priceForDate: null };
        }
      })
    );
    return { generatedAt: new Date().toISOString(), eventDate, quotes };
  }

  // No date yet — return the raw rate tables + active seasons so there's
  // still a meaningful snapshot to attach.
  const [ratesSnap, seasonsSnap] = await Promise.all([
    db().collection("dayOfWeekRates").get(),
    db().collection("seasonalAdjustments").where("active", "==", true).get(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    eventDate: null,
    dayOfWeekRates: ratesSnap.docs.map((d) => d.data() as DayOfWeekRate),
    activeSeasons: seasonsSnap.docs.map((d) => d.data() as SeasonalAdjustment),
  };
});
