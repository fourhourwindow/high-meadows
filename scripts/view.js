/**
 * Reads and prints every document in the collections this project uses.
 * Handy for confirming seed.js worked, or checking booking state without
 * opening the Firebase console.
 *
 * USAGE
 *   cd scripts
 *   GOOGLE_APPLICATION_CREDENTIALS=../secrets/google-application-creds.json node view.js
 *
 * Optionally pass a collection name to see just one:
 *   GOOGLE_APPLICATION_CREDENTIALS=../secrets/google-application-creds.json node view.js bookings
 */

const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const db = admin.firestore();

const TOP_LEVEL_COLLECTIONS = [
  "units",
  "packages",
  "dayOfWeekRates",
  "seasonalAdjustments",
  "bookings",
  "changeRequests",
];

async function printCollection(name) {
  const snap = await db.collection(name).get();
  console.log(`\n=== ${name} (${snap.size} doc${snap.size === 1 ? "" : "s"}) ===`);
  if (snap.empty) {
    console.log("  (empty)");
    return;
  }
  snap.forEach((doc) => {
    console.log(`\n  id: ${doc.id}`);
    console.log(indent(JSON.stringify(doc.data(), null, 2)));
  });
}

/**
 * `availability` is a collection of subcollections (availability/{unitId}/dates/{date}),
 * so it needs a slightly different walk than the flat collections above.
 */
async function printAvailability() {
  const unitsSnap = await db.collection("availability").listDocuments();
  console.log(`\n=== availability (${unitsSnap.length} unit${unitsSnap.length === 1 ? "" : "s"} with entries) ===`);
  if (unitsSnap.length === 0) {
    console.log("  (empty)");
    return;
  }
  for (const unitRef of unitsSnap) {
    const datesSnap = await unitRef.collection("dates").get();
    console.log(`\n  unit: ${unitRef.id} (${datesSnap.size} date entr${datesSnap.size === 1 ? "y" : "ies"})`);
    datesSnap.forEach((doc) => {
      console.log(`    ${doc.id}: ${JSON.stringify(doc.data())}`);
    });
  }
}

function indent(text) {
  return text
    .split("\n")
    .map((line) => "    " + line)
    .join("\n");
}

async function main() {
  const requested = process.argv[2]; // optional single collection name

  if (requested) {
    if (requested === "availability") {
      await printAvailability();
    } else {
      await printCollection(requested);
    }
  } else {
    for (const name of TOP_LEVEL_COLLECTIONS) {
      await printCollection(name);
    }
    await printAvailability();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to read Firestore:", err);
  process.exit(1);
});