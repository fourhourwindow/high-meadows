/**
 * Seeds Firestore with starter units, packages, day-of-week rates, and a
 * sample seasonal adjustment. Run this once against a fresh project (or
 * again later to reset test data) — it's safe to re-run since every
 * document uses a fixed, predictable ID.
 *
 * SETUP
 *   1. In the Firebase console: Project settings > Service accounts >
 *      "Generate new private key" — downloads a JSON file.
 *   2. Save it somewhere OUTSIDE your git repo, e.g. ~/secrets/firebase-admin-key.json
 *   3. cd scripts && npm install
 *   4. GOOGLE_APPLICATION_CREDENTIALS=~/secrets/firebase-admin-key.json node seed.js
 *
 * EDIT BEFORE RUNNING
 *   The placeholder names, prices, and dates below are just examples —
 *   replace them with your actual package names, real pricing, and this
 *   year's season windows before seeding real data.
 */

const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

// ---------------------------------------------------------------------------
// UNITS
// ---------------------------------------------------------------------------
const units = [
  {
    id: "venue-grounds",
    name: "Venue Grounds",
    type: "event_space",
    description: "The ceremony and reception grounds.",
  },
  {
    id: "cottage",
    name: "Cottage",
    type: "lodging",
    bedrooms: 1,
    bathrooms: 2,
    description:
      "Detached cottage with a small kitchen, large living room, and deck.",
  },
  {
    id: "main-house",
    name: "Main House",
    type: "lodging",
    bedrooms: 6,
    bathrooms: 8,
    description: "Main house lodging, booked as a single unit.",
  },
];

// ---------------------------------------------------------------------------
// PACKAGES — tiered bundles of the units above. Adjust names/guest caps to
// match your real offering before seeding.
// ---------------------------------------------------------------------------
const packages = [
  {
    id: "venue-only",
    name: "Venue Only",
    unitIds: ["venue-grounds"],
    maxGuestCount: 150,
    description: "Ceremony and reception space only, no overnight lodging.",
    active: true,
  },
  {
    id: "venue-plus-cottage",
    name: "Venue + Cottage",
    unitIds: ["venue-grounds", "cottage"],
    maxGuestCount: 150,
    description: "Venue plus the detached cottage for the couple or family.",
    active: true,
  },
  {
    id: "full-property-buyout",
    name: "Full Property Buyout",
    unitIds: ["venue-grounds", "cottage", "main-house"],
    maxGuestCount: 150,
    description: "Full use of the venue, cottage, and main house.",
    active: true,
  },
];

// ---------------------------------------------------------------------------
// DAY-OF-WEEK BASE RATES — one per package per day. EXAMPLE NUMBERS ONLY.
// Fill in every day of the week for every package; a missing day/package
// combo will cause getPriceForRange to throw at booking time.
// ---------------------------------------------------------------------------
const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Simple flat example: weekdays cheaper, Fri/Sat priciest. Replace with
// your real numbers per package.
const baseRatesByPackage = {
  "venue-only": {
    Sunday: 4000,
    Monday: 3000,
    Tuesday: 3000,
    Wednesday: 3000,
    Thursday: 3500,
    Friday: 7000,
    Saturday: 8000,
  },
  "venue-plus-cottage": {
    Sunday: 4800,
    Monday: 3600,
    Tuesday: 3600,
    Wednesday: 3600,
    Thursday: 4200,
    Friday: 8200,
    Saturday: 9400,
  },
  "full-property-buyout": {
    Sunday: 6500,
    Monday: 5000,
    Tuesday: 5000,
    Wednesday: 5000,
    Thursday: 5800,
    Friday: 11000,
    Saturday: 13000,
  },
};

const dayOfWeekRates = Object.entries(baseRatesByPackage).flatMap(
  ([packageId, rates]) =>
    DAYS.map((dayOfWeek) => ({
      id: `${packageId}_${dayOfWeek}`,
      packageId,
      dayOfWeek,
      baseRate: rates[dayOfWeek],
    }))
);

// ---------------------------------------------------------------------------
// SEASONAL ADJUSTMENTS — EXAMPLE WINDOWS ONLY. Update the dates and
// multipliers to match your actual peak/off-peak calendar.
// ---------------------------------------------------------------------------
const seasonalAdjustments = [
  {
    id: "peak-season-early",
    name: "Peak Season — Spring",
    startDate: "2027-04-01",
    endDate: "2027-05-31",
    multiplier: 1.2,
    priority: 1,
    active: true,
  },
  {
    id: "peak-season-late",
    name: "Peak Season — Fall",
    startDate: "2027-09-01",
    endDate: "2027-10-31",
    multiplier: 1.1,
    priority: 1,
    active: true,
  },
];

// ---------------------------------------------------------------------------

async function seedCollection(collectionName, docs) {
  const batch = db.batch();
  docs.forEach((doc) => {
    const { id, ...data } = doc;
    batch.set(db.collection(collectionName).doc(id), data);
  });
  await batch.commit();
  console.log(`Seeded ${docs.length} doc(s) into ${collectionName}`);
}

async function main() {
  await seedCollection("units", units);
  await seedCollection("packages", packages);
  await seedCollection("dayOfWeekRates", dayOfWeekRates);
  await seedCollection("seasonalAdjustments", seasonalAdjustments);
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});