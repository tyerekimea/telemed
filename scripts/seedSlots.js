// One-off script to seed test slots for every doctor in Firestore.
// Run with: node scripts/seedSlots.js
//
// Safe to re-run at any time (e.g. after adding a new doctor) — it checks
// each doctor's existing slots first and only adds times that aren't
// already there, so it won't duplicate slots or touch ones already booked.
//
// Requires a service account key (Firebase console > Project settings >
// Service accounts > Generate new private key). Save it as
// scripts/serviceAccountKey.json — this file should NEVER be committed,
// it grants full admin access to your Firebase project. Add it to
// .gitignore before running this.

const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Slot times offered each day (24h format).
const DAILY_TIMES = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];
const DAYS_AHEAD = 5;

async function seedSlots() {
  const doctorsSnap = await db.collection("doctors").get();

  if (doctorsSnap.empty) {
    console.log("No doctors found. Add at least one doctor document first.");
    return;
  }

  for (const doctorDoc of doctorsSnap.docs) {
    const slotsRef = doctorDoc.ref.collection("slots");

    // Check what this doctor already has before adding anything — this is
    // what makes the script safe to re-run (e.g. after adding a new
    // doctor) without duplicating existing doctors' slots, and without
    // touching any slot that's already been booked.
    const existingSnap = await slotsRef.get();
    const existingTimes = new Set(
      existingSnap.docs.map((d) => d.data().startTime.toMillis())
    );

    let created = 0;
    let skipped = 0;

    for (let dayOffset = 1; dayOffset <= DAYS_AHEAD; dayOffset++) {
      const date = new Date();
      date.setDate(date.getDate() + dayOffset);

      for (const time of DAILY_TIMES) {
        const [hour, minute] = time.split(":").map(Number);
        const slotDate = new Date(date);
        slotDate.setHours(hour, minute, 0, 0);
        const slotMillis = slotDate.getTime();

        if (existingTimes.has(slotMillis)) {
          skipped++;
          continue;
        }

        await slotsRef.add({
          startTime: admin.firestore.Timestamp.fromDate(slotDate),
          booked: false,
        });
        created++;
      }
    }

    const label = doctorDoc.data().name || doctorDoc.id;
    console.log(`${label}: created ${created}, skipped ${skipped} (already existed)`);
  }
}

seedSlots()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
