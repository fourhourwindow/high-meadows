import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { AvailabilityCalendar } from "../components/AvailabilityCalendar";
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
                  onClick={() => setSelectedPackage(pkg)}
                >
                  <h3>{pkg.name}</h3>
                  <p className="package-card__desc">{pkg.description}</p>
                  <div className="package-card__meta">
                    <span className="package-card__price">
                      {from !== null ? `From $${from.toLocaleString()}/night` : "Contact for pricing"}
                    </span>
                    <span className="package-card__guests">Up to {pkg.maxGuestCount} guests</span>
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
          {selectedPackage && <AvailabilityCalendar unitIds={selectedPackage.unitIds} />}
          <p className="booking-layout__note">
            Select a package to check its availability. Booking and deposit
            checkout come next — this calendar currently shows open dates
            only.
          </p>
        </div>
      </div>
    </div>
  );
}
