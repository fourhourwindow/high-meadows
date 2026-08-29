import * as admin from "firebase-admin";
import {
  DayOfWeek,
  DayOfWeekRate,
  SeasonalAdjustment,
  PriceBreakdownNight,
  DateRange,
} from "./types";

const db = () => admin.firestore();

const DAY_NAMES: DayOfWeek[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Inclusive list of ISO date strings between start and end. */
export function eachDateInRange(range: DateRange): string[] {
  const dates: string[] = [];
  const cursor = new Date(range.startDate + "T00:00:00Z");
  const end = new Date(range.endDate + "T00:00:00Z");
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function dayOfWeekFor(isoDate: string): DayOfWeek {
  const d = new Date(isoDate + "T00:00:00Z");
  return DAY_NAMES[d.getUTCDay()];
}

/**
 * Finds the highest-priority active seasonal adjustment whose date range
 * contains `isoDate`. Returns multiplier 1.0 if nothing matches — this is
 * the "off-season, no adjustment" default, so you don't need an explicit
 * 1.0x document for every gap in the calendar.
 */
function resolveSeasonalMultiplier(
  isoDate: string,
  seasons: SeasonalAdjustment[]
): number {
  const matches = seasons.filter(
    (s) => s.active && isoDate >= s.startDate && isoDate <= s.endDate
  );
  if (matches.length === 0) return 1.0;
  matches.sort((a, b) => b.priority - a.priority);
  return matches[0].multiplier;
}

/**
 * Computes the nightly rate for one package on one date:
 * dayOfWeek base rate * matching seasonal multiplier (or 1.0 if none).
 * Throws if no base rate is configured for that package/day — a missing
 * rate should fail loudly rather than silently charging $0.
 */
export function computeNightlyRate(
  isoDate: string,
  dayRates: DayOfWeekRate[],
  seasons: SeasonalAdjustment[]
): PriceBreakdownNight {
  const dow = dayOfWeekFor(isoDate);
  const rateDoc = dayRates.find((r) => r.dayOfWeek === dow);
  if (!rateDoc) {
    throw new Error(
      `No base rate configured for ${dow} (package ${dayRates[0]?.packageId ?? "unknown"})`
    );
  }
  const multiplier = resolveSeasonalMultiplier(isoDate, seasons);
  return {
    date: isoDate,
    dayOfWeek: dow,
    baseRate: rateDoc.baseRate,
    multiplier,
    nightRate: Math.round(rateDoc.baseRate * multiplier * 100) / 100,
  };
}

/**
 * Sums per-night rates across a date range for one package. This is the
 * single source of truth for price — call it for initial quotes, the
 * booking-hold transaction, and every upgrade/downgrade calculation.
 * Never compute price independently anywhere else.
 */
export async function getPriceForRange(
  packageId: string,
  range: DateRange
): Promise<{ total: number; nightlyBreakdown: PriceBreakdownNight[] }> {
  const [dayRatesSnap, seasonsSnap] = await Promise.all([
    db().collection("dayOfWeekRates").where("packageId", "==", packageId).get(),
    db().collection("seasonalAdjustments").get(),
  ]);

  const dayRates = dayRatesSnap.docs.map((d) => d.data() as DayOfWeekRate);
  const seasons = seasonsSnap.docs.map((d) => d.data() as SeasonalAdjustment);

  if (dayRates.length === 0) {
    throw new Error(`No day-of-week rates configured for package ${packageId}`);
  }

  const nightlyBreakdown = eachDateInRange(range).map((isoDate) =>
    computeNightlyRate(isoDate, dayRates, seasons)
  );
  const total = nightlyBreakdown.reduce((sum, n) => sum + n.nightRate, 0);

  return { total, nightlyBreakdown };
}
