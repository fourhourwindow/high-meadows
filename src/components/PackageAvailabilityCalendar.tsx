import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Package, PriceBreakdownNight } from "../types";

interface DateRangeInput {
  startDate: string;
  endDate: string;
}

interface PackageAvailability {
  pkg: Package;
  available: boolean;
  unavailableUnitIds: string[];
}

interface Props {
  dateRange: DateRangeInput;
  onSelectPackage: (pkg: Package) => void;
}

/**
 * Given a selected date range, checks every active package's units against
 * the public `availability` collection and shows which packages are fully
 * bookable. This is a read-only convenience check for UX — the actual
 * atomic guarantee happens server-side in createBookingHold, since a date
 * could be grabbed by someone else between this check and checkout.
 */
export function PackageAvailabilityCalendar({ dateRange, onSelectPackage }: Props) {
  const [results, setResults] = useState<PackageAvailability[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dateRange.startDate || !dateRange.endDate) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const packagesSnap = await getDocs(
          query(collection(db, "packages"), where("active", "==", true))
        );
        const packages = packagesSnap.docs.map((d) => d.data() as Package);
        const dates = eachDateInRange(dateRange);

        const checked = await Promise.all(
          packages.map(async (pkg) => {
            const unavailable: string[] = [];
            for (const unitId of pkg.unitIds) {
              for (const date of dates) {
                const snap = await getDoc(
                  doc(db, "availability", unitId, "dates", date)
                );
                if (snap.exists()) {
                  const status = snap.data().status;
                  if (status === "booked" || status === "blocked" || status === "held") {
                    unavailable.push(unitId);
                    break;
                  }
                }
              }
            }
            return { pkg, available: unavailable.length === 0, unavailableUnitIds: unavailable };
          })
        );

        if (!cancelled) setResults(checked);
      } catch (err) {
        if (!cancelled) setError("Couldn't check availability. Please try again.");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dateRange.startDate, dateRange.endDate]);

  if (!dateRange.startDate || !dateRange.endDate) {
    return <p>Pick a date range to see available packages.</p>;
  }
  if (loading) return <p>Checking availability…</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!results) return null;

  return (
    <ul>
      {results.map(({ pkg, available }) => (
        <li key={pkg.id}>
          <button disabled={!available} onClick={() => onSelectPackage(pkg)}>
            {pkg.name} {available ? "" : "— not available for these dates"}
          </button>
        </li>
      ))}
    </ul>
  );
}

function eachDateInRange({ startDate, endDate }: DateRangeInput): string[] {
  const dates: string[] = [];
  const cursor = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

// Re-exported so a parent can render the nightly price breakdown once a
// package is selected, without importing the Cloud Function's copy.
export type { PriceBreakdownNight };
