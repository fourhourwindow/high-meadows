import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { auth, db, extendBookingHold } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { AdminAvailabilityManager } from "../components/AdminAvailabilityManager";
import type {
  Package,
  Unit,
  DayOfWeekRate,
  SeasonalAdjustment,
  DayOfWeek,
  Booking,
  CancellationTier,
} from "../types";
import "./Admin.css";

const DAYS: DayOfWeek[] = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

export function Admin() {
  const { user } = useAuth();
  const [packages, setPackages] = useState<Package[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [rates, setRates] = useState<DayOfWeekRate[]>([]);
  const [seasons, setSeasons] = useState<SeasonalAdjustment[]>([]);
  const [heldBookings, setHeldBookings] = useState<Booking[]>([]);
  const [cancellationTiers, setCancellationTiers] = useState<CancellationTier[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  async function loadAll() {
    const [packagesSnap, unitsSnap, ratesSnap, seasonsSnap, heldSnap, policySnap] =
      await Promise.all([
        getDocs(query(collection(db, "packages"), where("active", "==", true))),
        getDocs(collection(db, "units")),
        getDocs(collection(db, "dayOfWeekRates")),
        getDocs(collection(db, "seasonalAdjustments")),
        getDocs(query(collection(db, "bookings"), where("status", "==", "held"))),
        getDoc(doc(db, "settings", "cancellationPolicy")),
      ]);
    setPackages(packagesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Package)));
    setUnits(unitsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Unit)));
    setRates(ratesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as DayOfWeekRate)));
    setSeasons(seasonsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SeasonalAdjustment)));
    setHeldBookings(heldSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Booking)));
    setCancellationTiers(
      policySnap.exists() ? ((policySnap.data().tiers as CancellationTier[]) ?? []) : []
    );
  }

  useEffect(() => {
    loadAll();
  }, []);

  function flash(message: string) {
    setStatus(message);
    setTimeout(() => setStatus(null), 2500);
  }

  async function saveRate(packageId: string, dayOfWeek: DayOfWeek, baseRate: number) {
    const id = `${packageId}_${dayOfWeek}`;
    await setDoc(doc(db, "dayOfWeekRates", id), { packageId, dayOfWeek, baseRate });
    setRates((prev) => {
      const others = prev.filter((r) => r.id !== id);
      return [...others, { id, packageId, dayOfWeek, baseRate }];
    });
    flash(`Saved ${dayOfWeek} rate for ${packageId}`);
  }

  async function saveSeason(season: SeasonalAdjustment) {
    await setDoc(doc(db, "seasonalAdjustments", season.id), {
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
      multiplier: season.multiplier,
      priority: season.priority,
      active: season.active,
    });
    flash(`Saved ${season.name || "season"}`);
    loadAll();
  }

  async function deleteSeason(id: string) {
    await deleteDoc(doc(db, "seasonalAdjustments", id));
    setSeasons((prev) => prev.filter((s) => s.id !== id));
    flash("Season removed");
  }

  async function extendHold(bookingId: string, additionalDays: number) {
    const booking = heldBookings.find((b) => b.id === bookingId);
    if (!booking) return;
    const currentExpiry = new Date(booking.holdExpiresAt ?? Date.now());
    const newExpiresAt = new Date(
      currentExpiry.getTime() + additionalDays * 24 * 60 * 60 * 1000
    ).toISOString();

    try {
      await extendBookingHold({ bookingId, newExpiresAt });
      flash(`Extended hold for ${booking.clientName}`);
      loadAll();
    } catch (err) {
      console.error(err);
      flash("Couldn't extend that hold — see console for details");
    }
  }

  function addBlankSeason() {
    const id = doc(collection(db, "seasonalAdjustments")).id;
    setSeasons((prev) => [
      ...prev,
      { id, name: "", startDate: "", endDate: "", multiplier: 1, priority: 1, active: true },
    ]);
  }

  function updateTier(index: number, updated: CancellationTier) {
    setCancellationTiers((prev) => prev.map((t, i) => (i === index ? updated : t)));
  }

  function addBlankTier() {
    setCancellationTiers((prev) => [...prev, { minDaysBeforeEvent: 0, refundPercent: 0 }]);
  }

  function deleteTier(index: number) {
    setCancellationTiers((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveCancellationPolicy() {
    // Store sorted highest-notice-first — purely for readability when
    // someone opens this in the Firestore console; the actual lookup logic
    // (in cancelConfirmedBooking.ts) sorts independently either way.
    const sorted = [...cancellationTiers].sort(
      (a, b) => b.minDaysBeforeEvent - a.minDaysBeforeEvent
    );
    await setDoc(doc(db, "settings", "cancellationPolicy"), { tiers: sorted });
    setCancellationTiers(sorted);
    flash("Saved cancellation policy");
  }

  return (
    <div className="container admin-page">
      <div className="admin-page__header">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>Availability &amp; pricing</h1>
          <p className="admin-page__signed-in">Signed in as {user?.email}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => signOut(auth)}>
          Sign out
        </button>
      </div>

      {status && <div className="admin-page__toast">{status}</div>}

      <section className="admin-section">
        <h2>Active holds</h2>
        <p className="admin-section__hint">
          Each hold's price was locked in the moment it was created — it
          stays this exact number no matter what you change below, so
          nobody ever gets surprised by a rate change mid-hold. Holds
          release automatically 48 hours after they're created unless
          extended here.
        </p>
        {heldBookings.length === 0 && <p>No active holds right now.</p>}
        <div className="holds-list">
          {heldBookings.map((booking) => (
            <div key={booking.id} className="hold-row">
              <div className="hold-row__info">
                <strong>{booking.clientName}</strong> — {booking.email}
                <div className="hold-row__meta">
                  {booking.packageSnapshot.name} · {booking.dateRange.startDate}
                  {booking.dateRange.startDate !== booking.dateRange.endDate &&
                    ` – ${booking.dateRange.endDate}`}
                </div>
                <div className="hold-row__price">
                  Locked price: ${booking.packageSnapshot.totalPrice.toLocaleString()}
                </div>
                <div className="hold-row__expiry">
                  Expires {new Date(booking.holdExpiresAt ?? "").toLocaleString()}
                </div>
              </div>
              <div className="hold-row__actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => extendHold(booking.id, 5)}
                >
                  +5 days
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => extendHold(booking.id, 14)}
                >
                  +14 days
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <h2>Day-of-week base rates</h2>
        <p className="admin-section__hint">
          The starting nightly rate per package before any seasonal
          adjustment is applied.
        </p>
        {packages.map((pkg) => (
          <div key={pkg.id} className="rate-table">
            <h3>{pkg.name}</h3>
            <div className="rate-table__grid">
              {DAYS.map((day) => {
                const existing = rates.find(
                  (r) => r.packageId === pkg.id && r.dayOfWeek === day
                );
                return (
                  <RateInput
                    key={day}
                    day={day}
                    value={existing?.baseRate}
                    onSave={(value) => saveRate(pkg.id, day, value)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="admin-section">
        <div className="admin-section__header-row">
          <h2>Seasonal adjustments</h2>
          <button type="button" className="btn btn-secondary" onClick={addBlankSeason}>
            + Add season
          </button>
        </div>
        <p className="admin-section__hint">
          A multiplier applied on top of the day-of-week rate for dates
          inside its range. Higher priority wins if ranges overlap.
        </p>
        <div className="seasons-list">
          {seasons.map((season) => (
            <SeasonRow
              key={season.id}
              season={season}
              onChange={(updated) =>
                setSeasons((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
              }
              onSave={() => saveSeason(seasons.find((s) => s.id === season.id)!)}
              onDelete={() => deleteSeason(season.id)}
            />
          ))}
        </div>
      </section>

      <section className="admin-section">
        <div className="admin-section__header-row">
          <h2>Cancellation policy</h2>
          <button type="button" className="btn btn-secondary" onClick={addBlankTier}>
            + Add tier
          </button>
        </div>
        <p className="admin-section__hint">
          Sliding-scale refund for cancelling a CONFIRMED (deposit-paid)
          booking, based on notice given before the event. The tier with the
          highest day threshold the notice still satisfies wins — e.g. 95
          days' notice matches a 90-day tier, not a 60-day one below it. You
          can still type a different refund amount by hand when actually
          cancelling a specific booking; this is just the starting default.
        </p>
        <div className="cancellation-tiers-list">
          {cancellationTiers.map((tier, index) => (
            <div key={index} className="cancellation-tier-row">
              <label>
                At least
                <input
                  type="number"
                  min={0}
                  value={tier.minDaysBeforeEvent}
                  onChange={(e) =>
                    updateTier(index, { ...tier, minDaysBeforeEvent: Number(e.target.value) })
                  }
                />
                days' notice →
              </label>
              <label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={tier.refundPercent}
                  onChange={(e) =>
                    updateTier(index, { ...tier, refundPercent: Number(e.target.value) })
                  }
                />
                % refund
              </label>
              <button
                type="button"
                className="cancellation-tier-row__delete"
                onClick={() => deleteTier(index)}
                aria-label="Delete tier"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-primary" onClick={saveCancellationPolicy}>
          Save policy
        </button>
      </section>

      <section className="admin-section">
        <h2>Block or unblock dates</h2>
        <p className="admin-section__hint">
          For personal use, maintenance, or anything else that should take a
          unit off the calendar without a booking behind it. Check one or
          more units below, then click dates on the calendar to toggle them.
        </p>
        <AdminAvailabilityManager units={units} onDone={(msg) => flash(msg)} />
      </section>
    </div>
  );
}

function RateInput({
  day,
  value,
  onSave,
}: {
  day: DayOfWeek;
  value: number | undefined;
  onSave: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "");

  useEffect(() => {
    setDraft(value?.toString() ?? "");
  }, [value]);

  return (
    <label className="rate-input">
      <span>{day}</span>
      <div className="rate-input__row">
        <span className="rate-input__prefix">$</span>
        <input
          type="number"
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          className="rate-input__save"
          onClick={() => {
            const parsed = Number(draft);
            if (!Number.isNaN(parsed) && parsed >= 0) onSave(parsed);
          }}
        >
          Save
        </button>
      </div>
    </label>
  );
}

function SeasonRow({
  season,
  onChange,
  onSave,
  onDelete,
}: {
  season: SeasonalAdjustment;
  onChange: (season: SeasonalAdjustment) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="season-row">
      <input
        placeholder="Name (e.g. Peak Season — Fall)"
        value={season.name}
        onChange={(e) => onChange({ ...season, name: e.target.value })}
      />
      <input
        type="date"
        value={season.startDate}
        onChange={(e) => onChange({ ...season, startDate: e.target.value })}
      />
      <input
        type="date"
        value={season.endDate}
        onChange={(e) => onChange({ ...season, endDate: e.target.value })}
      />
      <input
        type="number"
        step="0.01"
        min={0}
        title="Multiplier (e.g. 1.2 for +20%)"
        value={season.multiplier}
        onChange={(e) => onChange({ ...season, multiplier: Number(e.target.value) })}
      />
      <input
        type="number"
        title="Priority"
        value={season.priority}
        onChange={(e) => onChange({ ...season, priority: Number(e.target.value) })}
      />
      <label className="season-row__active">
        <input
          type="checkbox"
          checked={season.active}
          onChange={(e) => onChange({ ...season, active: e.target.checked })}
        />
        Active
      </label>
      <button type="button" className="btn btn-primary" onClick={onSave}>
        Save
      </button>
      <button type="button" className="season-row__delete" onClick={onDelete} aria-label="Delete season">
        ×
      </button>
    </div>
  );
}


