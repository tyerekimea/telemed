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
3. In Firestore, manually add a couple of documents to a `doctors`
   collection to test with, e.g. `{ name: "Dr. Amara Obi", specialty:
   "General practice" }`.
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
4. **Video call** — add `@daily-co/daily-js` to the join-call button; room
   URLs can be hardcoded per-doctor at first, then generated dynamically via
   a small serverless function once that's needed.
5. **Visit notes** — a text field on the doctor's side, saved to the
   appointment doc, visible on the patient's history view.

Payments, e-prescriptions, and admin tooling are deliberately left out —
add them once the core loop (book → call → notes) works end to end.
