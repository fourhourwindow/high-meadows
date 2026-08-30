import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { AvailabilityCalendar, type DateRangeValue } from "../components/AvailabilityCalendar";
import { BookingFlow } from "../components/BookingFlow";
import { placeholderPhoto, MAIN_HOUSE_PHOTO_URL } from "../lib/placeholderImages";
import type { Package, DayOfWeekRate } from "../types";
import "./Booking.css";

interface AddOn {
  id: string;
  name: string;
  description: string;
  priceLabel: string;
}

// Placeholder add-ons — not in Firestore yet. If these become real bookable
// items, give them the same shape as `packages` (their own collection,
// probably referenced from a booking the same way packageId is) rather than
// keeping them hardcoded here.
const ADD_ONS: AddOn[] = [
  {
    id: "food-beverage",
    name: "Food & Beverage Service",
    description: "Full-service catering and bar staff for your event.",
    priceLabel: "Priced per guest — contact for a quote",
  },
  {
    id: "limo-service",
    name: "Limo Service",
    description: "Round-trip transportation between the venue and downtown Scottsville or Charlottesville.",
    priceLabel: "Priced per trip — contact for a quote",
  },
];

export function Booking() {
  const [packages, setPackages] = useState<Package[] | null>(null);
  const [rates, setRates] = useState<DayOfWeekRate[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [range, setRange] = useState<DateRangeValue>({ start: null, end: null });
  const [calendarKey, setCalendarKey] = useState(0);

  function selectPackage(pkg: Package) {
    setSelectedPackage(pkg);
    setRange({ start: null, end: null });
  }

  function resetSelection() {
    setRange({ start: null, end: null });
    // Remounts the calendar so it re-fetches availability — matters after
    // a successful hold, since dates that were "available" a moment ago
    // are now "held" and shouldn't still look clickable.
    setCalendarKey((k) => k + 1);
  }

  useEffect(() => {
    (async () => {
      const [packagesSnap, ratesSnap] = await Promise.all([
        getDocs(query(collection(db, "packages"), where("active", "==", true))),
        getDocs(collection(db, "dayOfWeekRates")),
      ]);
      const loadedPackages = packagesSnap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Package)
      );
      setPackages(loadedPackages);
      setRates(ratesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DayOfWeekRate)));
      setSelectedPackage((prev) => prev ?? loadedPackages[0] ?? null);
    })();
  }, []);

  function lowestNightlyRate(packageId: string): number | null {
    const packageRates = rates.filter((r) => r.packageId === packageId);
    if (packageRates.length === 0) return null;
    return Math.min(...packageRates.map((r) => r.baseRate));
  }

  // Picks whichever unit best represents this package for its thumbnail —
  // the full property shows the main house, venue+cottage shows the
  // cottage, venue-only falls back to the grounds. Update this once real
  // photos exist per package rather than per unit, if that fits better.
  function thumbnailFor(pkg: Package): string {
    if (pkg.unitIds.includes("main-house")) return MAIN_HOUSE_PHOTO_URL;
    if (pkg.unitIds.includes("cottage")) return placeholderPhoto("cottage", 300, 200);
    return placeholderPhoto("grounds", 300, 200);
  }

  return (
    <div className="container booking-page">
      <span className="eyebrow">Availability &amp; Pricing</span>
      <h1>Find your date.</h1>
      <p className="booking-page__lede">
        Base rates shown below vary by day of week and season — Friday and
        Saturday dates, and dates in peak season, run higher than the
        starting price shown. Exact pricing for your date is confirmed when
        you request a hold.
      </p>

      <div className="booking-layout">
        <div>
          <h2 className="booking-layout__heading">Packages</h2>
          <div className="packages">
            {packages === null && <p>Loading packages…</p>}
            {packages?.map((pkg) => {
              const from = lowestNightlyRate(pkg.id);
              const isSelected = selectedPackage?.id === pkg.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  className={`package-card ${isSelected ? "package-card--selected" : ""}`}
                  onClick={() => selectPackage(pkg)}
                >
                  <img
                    className="package-card__thumb"
                    src={thumbnailFor(pkg)}
                    alt=""
                    aria-hidden="true"
                  />
                  <div className="package-card__body">
                    <h3>{pkg.name}</h3>
                    <p className="package-card__desc">{pkg.description}</p>
                    <div className="package-card__meta">
                      <span className="package-card__price">
                        {from !== null ? `From $${from.toLocaleString()}/night` : "Contact for pricing"}
                      </span>
                      <span className="package-card__guests">Up to {pkg.maxGuestCount} guests</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <h2 className="booking-layout__heading">Add-Ons</h2>
          <div className="add-ons">
            {ADD_ONS.map((addOn) => (
              <div key={addOn.id} className="add-on-card">
                <h3>{addOn.name}</h3>
                <p>{addOn.description}</p>
                <span className="add-on-card__price">{addOn.priceLabel}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="booking-layout__calendar">
          <h2 className="booking-layout__heading">
            {selectedPackage ? `${selectedPackage.name} — Availability` : "Availability"}
          </h2>
          {selectedPackage && (
            <AvailabilityCalendar
              key={`${selectedPackage.id}-${calendarKey}`}
              unitIds={selectedPackage.unitIds}
              range={range}
              onRangeChange={setRange}
            />
          )}

          {selectedPackage && range.start && range.end && (
            <BookingFlow
              pkg={selectedPackage}
              dateRange={{ startDate: range.start, endDate: range.end }}
              onDone={resetSelection}
            />
          )}
        </div>
      </div>
    </div>
  );
}
