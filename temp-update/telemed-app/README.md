# Telemed — MVP scaffold

Book a doctor, video-call them, get a visit summary. Built with Next.js
(App Router), Firebase (Auth + Firestore), and Capacitor for Android/iOS.

## Why this stack

- **Next.js** — same framework as Definition Detective, so the learning curve
  is mostly new features, not a new language.
- **Static export** (`output: "export"` in `next.config.js`) — Capacitor
  wraps a folder of static files, not a running server. This means Next.js
  **API routes won't work inside the mobile app** — anything that needs a
  secret key (like creating a Daily.co video room) has to live in a small
  serverless function you deploy separately (e.g. a free Vercel project),
  and the app calls it over `fetch()`. Not needed for the very first version
  below, but you'll hit this wall as soon as video rooms need to be created
  dynamically instead of hardcoded.
- **Firebase** — Auth and Firestore are used directly from the app (no
  custom backend needed for basic reads/writes), which sidesteps the
  static-export limitation above for everything except Daily.co room creation.

## Project structure

```
app/
  page.js                  landing page
  login/page.js             signup/login (role: patient or doctor)
  patient/dashboard/page.js browse doctors, book a slot
  doctor/dashboard/page.js  view booked appointments
components/
  DoctorCard.js
lib/
  firebase.js               Firebase init (reads from .env.local)
firestore.rules             starter security rules
capacitor.config.json       points Capacitor at the Next.js export output
```

## Setup

1. Create a Firebase project at console.firebase.google.com, enable
   **Authentication → Email/Password** and **Firestore Database**.
2. Copy `.env.local.example` to `.env.local` and fill in your Firebase
   config values (Project settings → General → Your apps → Web app).
3. In Firestore, add doctors for testing. **Important:** a doctor's document
   ID must be their own Firebase Auth UID, not an auto-generated one — this
   is what lets the doctor dashboard know which appointments are theirs.
   To add one properly:
   - Have the doctor sign up through `/login` (role: doctor) first — this
     creates their Auth account.
   - In the Firebase console → Authentication tab, copy their UID.
   - In Firestore → `doctors` collection → **Start collection**, and for
     Document ID, paste that UID (not Auto-ID). Add fields: `name`,
     `specialty`, `verified: true`.
   - Also set `verified: true` on their `users/{uid}` document (this is
     what unlocks their dashboard, separately from the `doctors` entry
     above which is what patients browse).
   If you added test doctors before this convention (e.g. with Auto-ID),
   their bookings won't show correctly on any real doctor login — delete
   and recreate them this way once you have real doctor accounts to test with.
4. For video calling: create a free account at daily.co, and for each test
   doctor, create a room in the Daily.co dashboard (e.g. named `dr-amara`).
   Add the room's URL to that doctor's Firestore document as a `roomUrl`
   field, e.g. `https://your-domain.daily.co/dr-amara`. Every appointment
   with that doctor currently joins the same room — see the note at the
   top of `app/call/page.js` for why, and what the real version looks like.
5. To use the admin panel at `/admin`, add yourself as an admin: in the
   Firebase console → Firestore → **Start collection** → Collection ID
   `admins` → Document ID: your own Auth UID (from the Authentication tab)
   → no fields needed, just create the document. Admin access is checked
   by whether this document exists, separate from the "role" field on
   your `users` doc.
4. Seed open time slots for those doctors:
   ```
   npm install
   ```
   Then in the Firebase console: Project settings → Service accounts →
   Generate new private key. Save the downloaded file as
   `scripts/serviceAccountKey.json` (already gitignored — never commit it).
   Then run:
   ```
   node scripts/seedSlots.js
   ```
   This creates 6 open slots a day, 5 weekdays out, for every doctor.
5. Install dependencies and run:
   ```
   npm install
   npm run dev
   ```
6. Deploy `firestore.rules` via the Firebase console or CLI before you go
   any further than local testing — the default rules lock everything down.

## Turning this into a mobile app

```
npm run build            # builds the static export into /out
npx cap add android
npx cap add ios          # requires a Mac with Xcode
npx cap sync
npx cap open android      # or: npx cap open ios
```

## Suggested build order from here

1. **Auth + role routing** — done. Signup saves `role` to `users/{uid}`,
   both dashboards redirect based on it, unverified doctors see a
   pending-approval screen.
2. **Real doctor data** — a simple admin script or Firebase console entries
   to replace the manual seeding.
3. **Real slot picker** — done. `scripts/seedSlots.js` generates open
   slots per doctor; the patient dashboard shows them and booking flips a
   slot to `booked: true` instead of booking "now".
4. **Video call** — done, for a first version. The join-call button (on
   both patient and doctor sides) opens `/call?appointmentId=...`, which
   loads the appointment, finds the doctor's `roomUrl`, and embeds the
   Daily.co call frame. Rooms are hardcoded per doctor, not generated per
   appointment — see the note in `app/call/page.js` for the upgrade path.
5. **Visit notes** — done. Each appointment card on the doctor dashboard
   has a notes textarea + save button, writing to a `notes` field on the
   appointment doc. The patient's appointment card displays it once saved.
   Security rules restrict this so only the assigned doctor can update an
   appointment, and only the `notes` field — nothing else about the
   booking can be changed this way.
6. **Admin panel** — done. `/admin` lists doctor accounts with
   `verified: false`, with an approve button that flips it. Access is
   gated by an `admins` Firestore collection (see setup step 5 above) —
   this is separate from the patient/doctor `role` field, since being an
   admin isn't something anyone signs up for. Note: approving here only
   unlocks the doctor's own dashboard — making them bookable by patients
   still requires manually adding their matching `doctors` collection
   entry (same uid as Document ID), which the admin panel doesn't
   automate yet. An "Admin" button now appears in the header of both the
   patient and doctor dashboards, but only for accounts whose uid exists
   in the `admins` collection (via a new `lib/useIsAdmin.js` hook) — it's
   simply not rendered for anyone else, though `/admin` itself was already
   properly access-controlled by the Firestore rules regardless.
7. **Booking race condition — fixed.** Booking used to be two separate
   writes (mark slot booked, then create the appointment), so two patients
   clicking the same slot at nearly the same moment could both succeed,
   double-booking it. `handleBookSlot` in `app/patient/dashboard/page.js`
   now uses a single Firestore transaction: it reads the slot, checks it's
   still open, and writes the slot update and the new appointment
   atomically. If someone else won the race, the patient sees "That time
   was just booked by someone else" instead of a silent double-booking.

Payments, e-prescriptions, and admin tooling are deliberately left out —
add them once the core loop (book → call → notes) works end to end.
