# Telemed — MVP scaffold

Book a doctor, video-call them, get a visit summary. Built with Next.js
(App Router), Firebase (Auth + Firestore), and Capacitor for Android/iOS.

## Why this stack

- **Next.js** — same framework as Definition Detective, so the learning curve
  is mostly new features, not a new language.
- **Static export** (`output: "export"` in `next.config.js`) — Capacitor
  wraps a folder of static files, not a running server. This means Next.js
  **API routes won't work inside the mobile app** — anything that needs a
  secret key runs as a Firebase Cloud Function instead (see `functions/`),
  called from the app over the Firebase SDK rather than a Next.js API route.
- **Firebase** — Auth, Firestore, Storage, and now Cloud Functions are all
  used directly from the app. Functions is the one exception to "no custom
  backend" — it exists specifically for the one thing that needs a secret
  (creating Daily.co rooms) and nothing else.

## Project structure

```
app/
  page.js                  landing page
  login/page.js             signup/login (role: patient or doctor)
  patient/dashboard/page.js browse doctors, book a slot
  patient/profile/page.js  required registration form (name, DOB, phone, gender)
  doctor/dashboard/page.js  pending appointments — call buttons, patient files
  doctor/dashboard/past/page.js  past appointments — visit notes only
  doctor/profile/page.js   required registration form (name, specialty, phone)
components/
  DoctorCard.js
lib/
  firebase.js               Firebase init (reads from .env.local)
  useAuth.js                current user + role
  useIsAdmin.js             checks the admins collection
  useUserProfile.js         fetches a user's profile doc (patient or doctor)
firestore.rules             starter security rules
storage.rules                security rules for patient file uploads
functions/index.js           Cloud Function: creates a Daily.co room per booking
firebase.json                Firebase CLI config (functions + rules deploy targets)
capacitor.config.json       points Capacitor at the Next.js export output
```

## Setup

1. Create a Firebase project at console.firebase.google.com, enable
   **Authentication → Email/Password**, **Firestore Database**, and
   **Storage** (this last one is needed for patient file attachments —
   click Storage in the sidebar → Get started, defaults are fine).
   After enabling Storage, deploy `storage.rules` the same way as
   `firestore.rules` — Firebase console → Storage → Rules tab → paste the
   contents of `storage.rules` → Publish.
2. Copy `.env.local.example` to `.env.local` and fill in your Firebase
   config values (Project settings → General → Your apps → Web app).
3. Add a doctor for testing — this is now fully automated, no manual
   Firestore step needed:
   - Sign up through `/login` with role: doctor (this creates their Auth
     account, `verified: false`, `profileComplete: false`)
   - Log in as that account and fill in `/doctor/profile` (First name,
     Last name, Specialty, Phone)
   - Add yourself as an admin (see step 5 below) if you haven't, then go
     to `/admin` and click **Approve** on their card
   - Approving automatically sets `verified: true` on their `users` doc
     *and* creates their public `doctors` entry (name, specialty,
     `verified: true`) — using their own uid as the Document ID, which is
     what lets the doctor dashboard know which appointments are theirs.
   If you have old test doctors added the manual way before this existed
   (Auto-ID document, no real login behind them), they're unaffected and
   still work for patient-side browsing/booking — they just won't have a
   real doctor dashboard behind them unless recreated through this flow.
4. Set up dynamic video rooms via Cloud Functions (this replaces manually
   creating a Daily.co room per doctor — rooms are now created
   automatically per booking):
   - Create a free account at daily.co, then go to **Developers** in the
     dashboard sidebar and copy your API key.
   - Firebase Functions require the **Blaze (pay-as-you-go)** plan — Spark
     doesn't allow outbound calls to external services like Daily's API.
     Upgrading needs a payment method on file, but at low volume you'll
     likely stay within the free monthly quota (2M function invocations,
     10K free Secret Manager accesses).
   - Install the Firebase CLI if you don't have it: `npm install -g firebase-tools`,
     then `firebase login`.
   - From the project root, set the secret:
     ```
     firebase functions:secrets:set DAILY_API_KEY
     ```
     (paste your Daily API key when prompted)
   - Install the function's dependencies and deploy:
     ```
     cd functions && npm install && cd ..
     firebase deploy --only functions
     ```
   - You can also deploy `firestore.rules` and `storage.rules` this way
     from now on, instead of pasting them into the console manually:
     ```
     firebase deploy --only firestore:rules,storage:rules
     ```
   Existing doctors don't need a `roomUrl` field anymore — that was the
   old approach. `app/call/page.js` still checks for one as a fallback,
   in case any appointment was booked before this change.
5. To use the admin panel at `/admin`, add yourself as an admin: in the
   Firebase console → Firestore → **Start collection** → Collection ID
   `admins` → Document ID: your own Auth UID (from the Authentication tab)
   → no fields needed, just create the document. Admin access is checked
   by whether this document exists, separate from the "role" field on
   your `users` doc.
6. Seed open time slots for those doctors:
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
   This creates open 10am–4pm slots (with a lunch gap) for 5 days starting
   today, for every doctor. Safe to re-run anytime — it skips times that
   already exist or have already passed.
7. Install dependencies and run:
   ```
   npm install
   npm run dev
   ```
8. Deploy `firestore.rules` and `storage.rules` (see step 4's CLI command
   above, or via the Firebase console) before you go any further than
   local testing — the default rules lock everything down.

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
8. **Chat, voice call, and file attachments — done.**
   - **Chat** — no new code; Daily's prebuilt call UI includes an in-call
     chat panel automatically, as long as it's left enabled on the room
     (see setup step 4).
   - **Voice call** — "Video call" and "Voice call" buttons now sit side
     by side on both the patient and doctor appointment cards. Both join
     the exact same Daily room; voice mode just starts with the camera
     off (`startVideoOff: true`) via `?mode=voice` in the URL. Either
     person can still turn their camera on mid-call regardless of which
     button they used.
   - **File attachments** — patients can attach a PNG, JPG, PDF, or Word
     doc (10MB max) to an appointment, uploaded to Firebase Storage at
     `appointments/{appointmentId}/{filename}` and recorded in an
     `attachments` array on the appointment doc. The doctor's dashboard
     lists them as clickable links under "Files from patient." Security:
     `firestore.rules` lets only the booking patient update the
     `attachments` field (mirrors how only the doctor can update `notes`);
     `storage.rules` caps file size/type and requires being signed in —
     see the comment in that file for why it can't check patientId/
     doctorId directly the way Firestore rules can, and what the
     tighter version would need (a Cloud Function).
9. **Doctor dashboard split into Pending / Past — done.** `/doctor/dashboard`
   now shows only appointments with `startTime` still upcoming — booking
   details, Video/Voice call buttons, and the patient's file attachments.
   `/doctor/dashboard/past` shows everything already elapsed, with just
   the visit notes editor (no call buttons or attachments — they don't
   apply once the appointment's over). The split is purely by comparing
   `startTime` to the current time client-side; no new appointment status
   field or Firestore rule changes were needed. A nav button on each page
   switches to the other, alongside the existing Admin button.
10. **Patient registration form — done.** New patients are marked
    `profileComplete: false` at signup; `patient/dashboard` and
    `patient/appointments` both redirect to `/patient/profile` until
    they've filled in First name, Last name, D.O.B, Phone, and Gender.
    The form is also revisitable anytime afterward to edit those details
    (it's not locked after first submission). Booking now attaches the
    patient's name to the appointment (`patientName`), so both doctor
    dashboard pages show who each appointment is with, instead of no
    identifying info at all. `firestore.rules` lets a patient update only
    their own profile fields on their `users` doc — separate from, and
    alongside, the existing admin-only `verified` permission.
11. **Dynamic per-appointment video rooms — done.** This is the first
    real backend piece in the app: a Firebase Cloud Function
    (`functions/index.js`, `createDailyRoom`) holds the Daily.co API key
    server-side (via Cloud Secret Manager — never in code, never
    client-visible) and creates a fresh room for each booking, set to
    auto-expire 1 hour after the appointment's start time. The room is
    created *before* the booking transaction runs (a transaction
    shouldn't make external network calls), and its URL is stored on the
    appointment itself. `app/call/page.js` reads the appointment's own
    `roomUrl` first, falling back to the doctor's old static `roomUrl`
    only for appointments booked before this existed. Requires the
    Firebase Blaze plan — see setup step 4. This replaces the old
    "manually create a room per doctor in the Daily dashboard" step
    entirely going forward.
12. **Doctor profile form + auto-provisioning on approval — done.**
    Doctors now fill in `/doctor/profile` (First name, Last name,
    Specialty, Phone) before reaching their dashboard, same required-form
    pattern as the patient side. `lib/usePatientProfile.js` was renamed to
    `lib/useUserProfile.js` since it's generic to either role. Approving a
    doctor in `/admin` now automatically creates their public `doctors`
    entry (name, specialty, `verified: true`) using their own uid as the
    Document ID — the manual Firestore step from setup step 3 is gone.
    If a doctor hasn't completed their profile yet, `/admin` shows a
    warning and approving still unlocks their dashboard, but skips
    creating the public entry (nothing to show patients yet).
    `firestore.rules` changed `doctors` writes from `if false` to
    `if isAdmin()` to allow this.

Payments, e-prescriptions, and admin tooling are deliberately left out —
add them once the core loop (book → call → notes) works end to end.
