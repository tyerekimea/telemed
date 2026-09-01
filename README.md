# MedAxis Wellness

A telemedicine MVP: patients book a doctor, video/voice call them (with
in-call chat), attach files to help with diagnosis, and get visit notes
afterward. Built for Nigerian/West African users, targeting web (Vercel)
and native Android/iOS (via Capacitor) from one codebase.

## Architecture

- **Frontend** — Next.js 14 (App Router), plain JavaScript. Built as a
  **static export** (`output: "export"` in `next.config.js`) so the same
  build can be wrapped by Capacitor into a native app. This is also what's
  deployed to Vercel — same static files either way.
- **Backend** — Firebase: Auth, Firestore, Storage, and one Cloud
  Function. There's no traditional server; the app talks to Firebase
  directly from the client for everything except the one thing that
  needs a secret (see below).
- **Video/voice/chat** — Daily.co. A fresh room is created per
  appointment via the Cloud Function, set to auto-expire 1 hour after the
  appointment's scheduled start.
- **Hosting** — Vercel (web) and Capacitor (Android/iOS wrapper around
  the same static export).

### Why a Cloud Function instead of a Next.js API route

Capacitor needs a folder of static files, not a running server — static
export disables Next.js API routes entirely, including on the Vercel
deployment, since it's the same build. Creating a Daily.co room requires
a secret API key that can never be client-side code. That one piece lives
in a Firebase Cloud Function (`functions/index.js`, `createDailyRoom`)
instead, called from the app over the Firebase SDK. It's the only
backend piece in the app, and it exists for exactly this one reason.

## Data model (Firestore)

```
users/{uid}
  role: "patient" | "doctor"
  verified: bool          — doctors start false, admin approves
  profileComplete: bool   — gates dashboard access until filled in
  email
  # patient profile fields: firstName, lastName, dob, phone, gender
  # doctor profile fields:  firstName, lastName, specialty, phone,
  #                         licenseNumber (medical registration/MDCN no.)
  fcmTokens: string[]     — push notification device/browser tokens,
                            registered via lib/notifications.js, used by
                            sendBookingNotification in functions/index.js

doctors/{uid}              — public listing, uid = the doctor's own Auth uid
  name, specialty, verified: true
  # auto-created when an admin approves a doctor in /admin
  # (licenseNumber is NOT copied here — stays private on users/{uid},
  # only surfaced on issued documents, see below)
  slots/{slotId}
    startTime, booked

appointments/{id}
  doctorId, doctorName, patientId, patientName
  slotId, startTime, status, roomUrl
  notes                 — doctor-editable, free text
  prescription          — doctor-editable: { diagnosis, medications,
                           doctorName, specialty, licenseNumber, issuedAt }
  investigationRequest  — doctor-editable: { clinicalNotes, testsRequested,
                           urgency, doctorName, specialty, licenseNumber, issuedAt }
  attachments            — patient-editable, array of {name, url, uploadedAt}
  createdAt

admins/{uid}                — existence-only marker; presence gates /admin
```

Note on `prescription`/`investigationRequest`: the doctor's name,
specialty, and license number are copied into the document at the moment
it's issued, rather than looked up live from their profile — a
prescription should stay accurate to who actually issued it even if the
doctor's profile changes later. See `lib/printDocument.js`.

## Security model

- **Firestore rules** are field-level, not just document-level — e.g. a
  doctor can update an appointment's `notes` field and nothing else; a
  patient can update `attachments` and nothing else; profile self-updates
  are restricted to an explicit per-role field allow-list. See
  `firestore.rules` for the exact rules and comments on each.
- **Storage rules** require being signed in, cap files at 10MB, and only
  allow PNG/JPG/PDF/Word. One honest limitation: Storage rules can't read
  Firestore, so they can't verify "is this really this patient's
  appointment" the way Firestore rules can — access is effectively gated
  by "signed in + know the exact (unguessable) appointment ID," which the
  app only ever hands to the two people involved. See the comment in
  `storage.rules` for what a tighter version would need (a Cloud
  Function).
- **The Cloud Function** holds the Daily.co API key in Cloud Secret
  Manager — never in code, never client-visible — and checks
  `request.auth` before doing anything.

## Auth & access flow

1. Sign up → choose role (patient or doctor)
2. Both roles must complete a profile form before reaching their
   dashboard — patient: name/DOB/phone/gender at `/patient/profile`;
   doctor: name/specialty/phone at `/doctor/profile`
3. Doctors additionally need admin approval (`verified: true`) before
   their dashboard unlocks. Approving in `/admin` also auto-creates their
   public `doctors` listing, using their own uid as the Document ID —
   that's what lets the app know which appointments belong to them.
4. Admin access is a separate check (does a doc exist at `admins/{uid}`)
   — not a "role." The same login can be a patient or doctor *and* an
   admin.

## Booking & video call flow

1. Patient picks an open slot → the Cloud Function creates a fresh Daily
   room server-side → a Firestore transaction atomically re-checks the
   slot is still open, marks it booked, and creates the appointment with
   the new room's URL attached. Room creation happens *before* the
   transaction, since a transaction shouldn't make an external network
   call.
2. Either party opens `/call?appointmentId=...&mode=video|voice`. The
   page loads the appointment — Firestore rules ensure only the involved
   patient or doctor can read it — then joins the room directly using its
   `roomUrl`. Rooms are created `public` with no meeting-token step;
   access is effectively gated by the Firestore read permission plus the
   room URL being unguessable, not by a separate Daily-level auth layer.
3. Daily's prebuilt call UI includes in-call chat with zero extra code.
   Voice mode just starts the call with the camera off
   (`startVideoOff: true`); either party can still turn their camera on
   mid-call regardless of which button they used to join.

## Doctor dashboard

Split into two pages, purely by comparing each appointment's `startTime`
to the current time client-side — no stored status field for this:

- **`/doctor/dashboard`** (Pending) — upcoming appointments: patient
  name, Video/Voice call buttons, any files the patient uploaded
- **`/doctor/dashboard/past`** — elapsed appointments: visit notes,
  prescription, and investigation request — three independent free-text
  forms, each with its own save button (a doctor can save one without
  touching the others). Prescription and investigation request also get
  a **Print** button once they have content, opening a clean
  letterhead-style printable version (patient name, date, doctor's name/
  specialty/license number) via the browser's print dialog — the
  standard way to get a savable PDF without a PDF library or backend
  rendering service. The patient sees read-only versions of all three,
  with their own matching Print buttons, on `/patient/appointments`.

## Project structure

```
app/
  page.js                        landing page
  login/page.js                  signup/login, password reset
  patient/profile/page.js        required patient registration form
  patient/dashboard/page.js      browse doctors, book a slot
  patient/appointments/page.js   own bookings, join call, attach files
  doctor/profile/page.js         required doctor registration form
  doctor/dashboard/page.js       pending appointments
  doctor/dashboard/past/page.js  past appointments, notes, prescription, investigation request
  call/page.js                   the actual video/voice call screen
  admin/page.js                  approve pending doctors
components/
  DoctorCard.js
lib/
  firebase.js         Firebase init (reads from .env.local)
  useAuth.js           current user + role
  useIsAdmin.js         checks the admins collection
  useUserProfile.js      fetches a user's profile doc (patient or doctor)
  printDocument.js        letterhead-style print helpers for Rx/investigation
functions/
  index.js              Cloud Function: creates a Daily.co room per booking
scripts/
  seedSlots.js           test-data generator for doctor availability
firestore.rules
storage.rules
firebase.json             Firebase CLI config (functions + rules deploy)
capacitor.config.json      points Capacitor at the Next.js export output
```

## Local setup

1. Create a Firebase project. Enable **Authentication → Email/Password**,
   **Firestore Database**, and **Storage**.
2. Copy `.env.local.example` to `.env.local` and fill in your Firebase
   web config (Project settings → General → Your apps).
3. Install the Firebase CLI (`npm install -g firebase-tools`), then
   `firebase login`. Confirm `.firebaserc` points at your project ID, or
   run `firebase use --add`.
4. Deploy the rules:
   ```
   firebase deploy --only firestore:rules,storage:rules
   ```
5. Set up the Cloud Function (requires the **Blaze** plan — Spark can't
   make outbound calls to Daily's API):
   ```
   firebase functions:secrets:set DAILY_API_KEY
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```
   If you hit a CORS/permission error calling it afterward, check Cloud
   Run (console.cloud.google.com/run) → the function's service → Security
   tab → set to "Allow public access." The real auth check happens
   inside the function via `request.auth`, so this is safe.
6. Add yourself as an admin: Firestore → **Start collection** →
   `admins` → Document ID: your own Auth UID (Authentication tab) → no
   fields needed.
7. `npm install && npm run dev`
8. Add a test doctor: sign up via `/login` (role: doctor), fill in
   `/doctor/profile`, then approve them from `/admin`. This auto-creates
   their public listing — no manual Firestore step.
9. Seed test availability for them:
   ```
   node scripts/seedSlots.js
   ```
   (needs `scripts/serviceAccountKey.json` — Firebase console → Project
   settings → Service accounts → Generate new private key. Already
   gitignored.) Safe to re-run anytime; it skips times that already
   exist or have passed.
10. For video calling to actually connect: create a free daily.co
    account and copy the API key into step 5's secret.

## Turning this into a mobile app

```
npm run build            # builds the static export into /out
npx cap add android
npx cap add ios          # requires a Mac with Xcode
npx cap sync
npx cap open android      # or: npx cap open ios
```

## Push notifications setup

Doctors get a push notification when a patient books them (see
`sendBookingNotification` in `functions/index.js`). Web and mobile use
different registration mechanisms (see `lib/notifications.js`), and both
need a one-time manual setup in the Firebase Console before either will
actually deliver anything — none of this can be scripted, since it needs
your own console access:

1. **Web push (browser notifications):**
   - Firebase Console → Project Settings → Cloud Messaging → Web Push
     certificates → generate a key pair.
   - Add that key to `.env.local` as `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
   - Fill in the six placeholder values at the top of
     `public/firebase-messaging-sw.js` with the same values as your
     `.env.local` (`NEXT_PUBLIC_FIREBASE_*`) — this file can't read
     `.env.local` itself, since it's a plain static file, not something
     Next.js's build processes.
2. **Mobile push (the Android app):**
   - Firebase Console → Project Settings → Add app → Android, using
     package name `com.medaxiswellness.app` (if not already registered).
   - Download the resulting `google-services.json` and place it at
     `android/app/google-services.json` — Capacitor's Android template
     already has the Gradle plugin wired up to pick this up automatically
     once the file exists (see `android/app/build.gradle`).
   - Run `npx cap sync` afterward so the newly added
     `@capacitor/push-notifications` plugin gets pulled into the native
     project.
3. **Enabling it as a doctor:** once both of the above are done, a
   verified doctor sees an "Enable notifications" prompt on
   `/doctor/dashboard` — this requires an explicit tap (browsers/OSes
   both require a user gesture to grant notification permission, it
   can't be requested automatically on page load).

No iOS push setup is included yet, since no iOS project exists in this
repo — it would need the same Firebase Console app registration
(iOS this time) plus an Apple Push Notification service key uploaded to
Firebase, done after `npx cap add ios`.

## Known limitations / not yet built

- **Prescriptions and investigation requests are free-text**, not
  structured per-drug/per-test rows with dose/frequency validation —
  the doctor types medications and tests as plain text. This means no
  drug-interaction checking, no formulary lookup, no structured data a
  pharmacy system could parse automatically. It's a documentation tool,
  not clinical decision support.
- **Email verification** — signup only checks an email is
  *syntactically* valid, not real or owned by the signer-upper. Fix:
  `sendEmailVerification()` plus a dashboard gate on Auth's
  `emailVerified` flag, same pattern as the existing profile/approval
  gates.
- **Appointment cancellation** — scoped but not built. Open questions:
  who can cancel (patient only, or doctor too), and whether there's a
  notice-period cutoff.
- **No appointment status lifecycle** — no in-progress/completed/
  no-show tracking. Pending vs. past is purely a `startTime` comparison;
  an appointment shows as pending right up until its scheduled time
  passes, whether or not the call happened.
- **Storage rules can't verify patientId/doctorId** the way Firestore
  rules can — see the Security model section above.
- **NDPR compliance** — no privacy policy, DPIA, NDPC registration, or
  cross-border data transfer review yet. Deliberately deferred until
  closer to a real launch with real patient data.
- **Mobile build untested** — the Capacitor Android/iOS wrapper has
  never been built and run end-to-end; everything's been verified on
  web only so far.
- **Payments** — not built.

## Test data

`scripts/seedSlots.js` generates 10am–4pm slots (with a lunch gap) for 5
days starting from whenever it's run, for every doctor currently in the
`doctors` collection.
