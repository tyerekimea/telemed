
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (!admin.getApps().length) {
  admin.initializeApp();
}

const {
  getFirestore,
  Timestamp,
  FieldValue,
} = require("firebase-admin/firestore");

const db = getFirestore();

// Set with:
// firebase functions:secrets:set DAILY_API_KEY
const dailyApiKey = defineSecret("DAILY_API_KEY");

// Set with:
// firebase functions:secrets:set PAYSTACK_SECRET_KEY
// Used only server-side to verify a payment actually happened — never
// exposed to the client. The client only ever sees the PUBLIC key
// (NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY), which is meant to be public and
// is only enough to open the checkout popup, not to confirm a charge.
const paystackSecretKey = defineSecret("PAYSTACK_SECRET_KEY");

// One flat fee for every doctor for now (per the current pricing model),
// in whole naira — converted to kobo (Paystack's smallest-unit
// convention for NGN) wherever it's actually compared against
// Paystack's API responses, since Paystack always reports amounts in
// kobo. This is a placeholder value — set it to your actual price
// before going live. Must match CONSULTATION_FEE_NGN in
// lib/payments.js on the client (duplicated rather than shared, same as
// CONSULTATION_MINUTES elsewhere in this file — Cloud Functions and the
// Next.js app are separate runtimes with no shared module between them).
const CONSULTATION_FEE_NGN = 5000;

const CONSULTATION_MINUTES = 15;
// Gap enforced between the end of one slot and the start of the next,
// so a doctor running slightly over on one consultation (or just needing
// a breather) has room before the next patient's slot begins — without
// this, back-to-back 15-minute slots gave doctors zero buffer, which was
// a real source of doctors joining late for the next patient.
const BREAK_MINUTES = 10;
const MAX_AVAILABILITY_HOURS = 12;

function validateDocumentId(value, fieldName) {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length === 0 ||
    value.includes("/")
  ) {
    throw new HttpsError(
      "invalid-argument",
      `${fieldName} must be a valid document ID.`
    );
  }
}

function validateBookAppointmentData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError(
      "invalid-argument",
      "doctorId, slotId, and txRef are required."
    );
  }

  const allowedKeys = new Set(["doctorId", "slotId", "txRef"]);
  const unexpectedKeys = Object.keys(data).filter(
    (key) => !allowedKeys.has(key)
  );

  if (unexpectedKeys.length > 0) {
    throw new HttpsError(
      "invalid-argument",
      "Only doctorId, slotId, and txRef may be provided."
    );
  }

  validateDocumentId(data.doctorId, "doctorId");
  validateDocumentId(data.slotId, "slotId");
  // txRef becomes the document ID of payments/{txRef}, so it needs the
  // same document-ID safety constraints as doctorId/slotId.
  validateDocumentId(data.txRef, "txRef");
}

function validateAvailabilityData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError(
      "invalid-argument",
      "date, startTime and endTime are required."
    );
  }

  const allowedKeys = new Set(["date", "startTime", "endTime"]);

  const unexpectedKeys = Object.keys(data).filter(
    (key) => !allowedKeys.has(key)
  );

  if (unexpectedKeys.length > 0) {
    throw new HttpsError(
      "invalid-argument",
      "Only date, startTime and endTime may be provided."
    );
  }

  if (
    typeof data.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.date)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "date must use YYYY-MM-DD format."
    );
  }

  if (
    typeof data.startTime !== "string" ||
    !/^\d{2}:\d{2}$/.test(data.startTime)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "startTime must use HH:MM format."
    );
  }

  if (
    typeof data.endTime !== "string" ||
    !/^\d{2}:\d{2}$/.test(data.endTime)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "endTime must use HH:MM format."
    );
  }

  const [startHour, startMinute] = data.startTime.split(":").map(Number);
  const [endHour, endMinute] = data.endTime.split(":").map(Number);

  if (
    startHour > 23 ||
    endHour > 23 ||
    startMinute > 59 ||
    endMinute > 59
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid start or end time."
    );
  }

  if (startMinute % 15 !== 0 || endMinute % 15 !== 0) {
    throw new HttpsError(
      "invalid-argument",
      "Availability times must be in 15-minute increments."
    );
  }
}

function requireFirestoreTimestamp(value, fieldName) {
  if (!value || typeof value.toMillis !== "function") {
    throw new HttpsError(
      "failed-precondition",
      `${fieldName} must be a Firestore Timestamp.`
    );
  }

  return value;
}

function createDateTimeFromParts(dateString, timeString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hour, minute] = timeString.split(":").map(Number);

  const date = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
    0
  );

  // Prevent JavaScript from silently normalising invalid dates such as
  // February 31.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid calendar date."
    );
  }

  return date;
}

async function createDoctorAvailability(request) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Must be signed in."
    );
  }

  validateAvailabilityData(request.data);

  const doctorId = request.auth.uid;
  const { date, startTime, endTime } = request.data;

  const doctorRef = db.collection("doctors").doc(doctorId);
  const doctorSnap = await doctorRef.get();

  if (!doctorSnap.exists) {
    throw new HttpsError(
      "not-found",
      "Doctor profile not found."
    );
  }

  const doctor = doctorSnap.data();

  if (doctor.role && doctor.role !== "doctor") {
    throw new HttpsError(
      "permission-denied",
      "Only doctors can create availability."
    );
  }

  if (doctor.verified !== true) {
    throw new HttpsError(
      "failed-precondition",
      "Your doctor account must be verified before you can add availability."
    );
  }

  const startDate = createDateTimeFromParts(date, startTime);
  const endDate = createDateTimeFromParts(date, endTime);

  const durationMinutes =
    (endDate.getTime() - startDate.getTime()) / (60 * 1000);

  if (durationMinutes <= 0) {
    throw new HttpsError(
      "invalid-argument",
      "End time must be after start time."
    );
  }

  if (durationMinutes < CONSULTATION_MINUTES) {
    throw new HttpsError(
      "invalid-argument",
      `Availability must be at least ${CONSULTATION_MINUTES} minutes.`
    );
  }

  if (durationMinutes > MAX_AVAILABILITY_HOURS * 60) {
    throw new HttpsError(
      "invalid-argument",
      `A single availability period cannot exceed ${MAX_AVAILABILITY_HOURS} hours.`
    );
  }

  if (startDate.getTime() <= Date.now()) {
    throw new HttpsError(
      "failed-precondition",
      "Availability must start in the future."
    );
  }

  if (
    startDate.getMinutes() % CONSULTATION_MINUTES !== 0 ||
    endDate.getMinutes() % CONSULTATION_MINUTES !== 0
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Start and end times must be in 15-minute increments."
    );
  }

  const slotsRef = doctorRef.collection("slots");

  const existingSnap = await slotsRef
    .where("startTime", ">=", Timestamp.fromDate(startDate))
    .where("startTime", "<", Timestamp.fromDate(endDate))
    .get();

  const existingByMillis = new Map();

  for (const slotDoc of existingSnap.docs) {
    const slot = slotDoc.data();

    if (!slot.startTime) {
      continue;
    }

    existingByMillis.set(slot.startTime.toMillis(), {
      id: slotDoc.id,
      ...slot,
    });
  }

  const batch = db.batch();

  let created = 0;
  let skipped = 0;

  const slotMillis = CONSULTATION_MINUTES * 60 * 1000;
  const stepMillis = (CONSULTATION_MINUTES + BREAK_MINUTES) * 60 * 1000;

  // Loop bound is "does this slot fit before the window closes" rather
  // than "has the cursor passed the window", so a trailing period too
  // short for a full slot (e.g. the last few minutes before endTime) is
  // simply left unused rather than creating a slot that runs past the
  // time the doctor actually said they're available until.
  for (
    let cursor = startDate.getTime();
    cursor + slotMillis <= endDate.getTime();
    cursor += stepMillis
  ) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor + slotMillis);

    const existing = existingByMillis.get(cursor);

    if (existing) {
      // Never modify an existing slot here. In particular, never touch
      // a slot that has already been booked.
      skipped++;
      continue;
    }

    const slotRef = slotsRef.doc();

    batch.set(slotRef, {
      startTime: Timestamp.fromDate(slotStart),
      endTime: Timestamp.fromDate(slotEnd),
      booked: false,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: doctorId,
    });

    created++;
  }

  if (created > 0) {
    await batch.commit();
  }

  return {
    created,
    skipped,
    date,
    startTime,
    endTime,
    consultationMinutes: CONSULTATION_MINUTES,
    breakMinutes: BREAK_MINUTES,
  };
}

exports.setDoctorAvailability = onCall(async (request) => {
  return createDoctorAvailability(request);
});

async function createDailyRoomForStartTime(startTime) {
  const expSeconds =
    Math.floor(startTime.toMillis() / 1000) + 60 * 60;

  const response = await fetch(
    "https://api.daily.co/v1/rooms",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${dailyApiKey.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        privacy: "public",
        properties: {
          exp: expSeconds,
          // Daily's own chat panel is disabled — the app now provides its
          // own chat (appointments/{id}/messages in Firestore), rendered
          // alongside the call in app/call/page.js. Turning it off here at
          // the room level, rather than trying to hide it client-side, is
          // what actually removes it from Daily's prebuilt UI.
          enable_chat: false,
          max_participants: 2,
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error(
      "Daily room creation failed:",
      errText
    );

    throw new HttpsError(
      "internal",
      "Could not create the video room. Please try again."
    );
  }

  const room = await response.json();

  if (!room.url || typeof room.url !== "string") {
    console.error(
      "Daily room creation returned no URL:",
      room
    );

    throw new HttpsError(
      "internal",
      "Could not create the video room. Please try again."
    );
  }

  return room.url;
}

// Best-effort — a notification failing to send should never fail the
// booking itself, since the appointment is already committed by the time
// this runs. Reads tokens from users/{doctorId}.fcmTokens (not the public
// doctors/{doctorId} doc, which only holds name/specialty/verified) —
// see lib/notifications.js on the client for how tokens get registered
// there in the first place.
async function sendBookingNotification(doctorId, patientName, startTime) {
  try {
    const doctorUserSnap = await db.collection("users").doc(doctorId).get();
    const tokens = doctorUserSnap.exists ? doctorUserSnap.data().fcmTokens : null;

    if (!Array.isArray(tokens) || tokens.length === 0) {
      return;
    }

    const when = startTime.toDate().toLocaleString("en-NG", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    });

    const response = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "New appointment booked",
        body: `${patientName || "A patient"} booked ${when}`,
      },
    });

    // Clean up tokens FCM says are no longer valid (uninstalled app,
    // revoked browser permission, etc.) so the array doesn't grow stale
    // forever and future sends don't keep wasting calls on dead tokens.
    const deadTokens = [];
    response.responses.forEach((result, i) => {
      const code = result.error?.code;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        deadTokens.push(tokens[i]);
      }
    });
    if (deadTokens.length > 0) {
      await db.collection("users").doc(doctorId).update({
        fcmTokens: FieldValue.arrayRemove(...deadTokens),
      });
    }
  } catch (err) {
    console.error("sendBookingNotification failed:", err);
  }
}

// Verifies a payment actually happened by asking Paystack's own servers
// directly — the client's claim that payment succeeded is never trusted
// on its own, since a malicious client could just lie about it. Checks
// status, amount, AND currency explicitly: checking status alone is a
// known way these integrations get exploited (e.g. a genuine but
// underpaid or wrong-currency transaction reported back as "success"
// for a different, cheaper item). Paystack reports amounts in kobo, so
// the comparison is against CONSULTATION_FEE_NGN * 100, not the raw
// naira figure.
async function verifyPaystackPayment(txRef) {
  let response;
  try {
    response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(txRef)}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecretKey.value()}`,
        },
      }
    );
  } catch (err) {
    console.error("Paystack verify request failed:", err);
    throw new HttpsError(
      "internal",
      "Couldn't confirm your payment. Please try again."
    );
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error("Paystack verify returned an error:", errText);
    throw new HttpsError(
      "internal",
      "Couldn't confirm your payment. Please try again."
    );
  }

  const result = await response.json();
  const txn = result?.data;

  if (
    result?.status !== true ||
    !txn ||
    txn.status !== "success" ||
    txn.currency !== "NGN" ||
    typeof txn.amount !== "number" ||
    txn.amount < CONSULTATION_FEE_NGN * 100 ||
    txn.reference !== txRef
  ) {
    console.error("Paystack transaction did not verify as paid:", result);
    throw new HttpsError(
      "failed-precondition",
      "Payment could not be verified."
    );
  }

  return {
    paystackTransactionId: txn.id,
    amount: txn.amount,
    currency: txn.currency,
  };
}

// Best-effort — used only for the rare case where payment verified
// successfully but the appointment couldn't actually be created (e.g.
// someone else took the slot in the moment between payment and
// booking). Never throws: if the refund call itself fails, that's
// logged for manual follow-up, but the patient still needs to see the
// real "please try again" error, not a confusing secondary one about
// the refund mechanism. Paystack's refund endpoint accepts either a
// transaction reference or numeric ID for the "transaction" field — the
// reference is used here since it's already on hand, with no need to
// separately track the numeric ID just for this call.
async function refundPaystackTransaction(txRef) {
  try {
    const response = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey.value()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transaction: txRef }),
    });
    if (!response.ok) {
      console.error(
        "Paystack refund failed for transaction",
        txRef,
        await response.text()
      );
    }
  } catch (err) {
    console.error("Paystack refund request failed:", err);
  }
}

exports.bookAppointment = onCall(
  { secrets: [dailyApiKey, paystackSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be signed in."
      );
    }

    validateBookAppointmentData(request.data);

    const { doctorId, slotId, txRef } = request.data;
    const patientId = request.auth.uid;

    // Verified first, before any Firestore reads — no point looking up a
    // doctor or slot at all if the payment behind this request isn't
    // real. See verifyPaystackPayment for what "verified" actually
    // checks (status, amount, currency, reference match — not just "it
    // didn't error").
    const { paystackTransactionId, amount, currency } =
      await verifyPaystackPayment(txRef);

    const patientRef = db
      .collection("users")
      .doc(patientId);

    const doctorRef = db
      .collection("doctors")
      .doc(doctorId);

    const slotRef = doctorRef
      .collection("slots")
      .doc(slotId);

    const [
      patientSnap,
      doctorSnap,
      slotSnap,
    ] = await Promise.all([
      patientRef.get(),
      doctorRef.get(),
      slotRef.get(),
    ]);

    if (
      !patientSnap.exists ||
      patientSnap.data().role !== "patient"
    ) {
      throw new HttpsError(
        "permission-denied",
        "Only patients can book appointments."
      );
    }

    if (!doctorSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Doctor not found."
      );
    }

    const doctor = doctorSnap.data();

    if (doctor.verified !== true) {
      throw new HttpsError(
        "failed-precondition",
        "Doctor is not available for booking."
      );
    }

    if (!slotSnap.exists) {
      throw new HttpsError(
        "not-found",
        "Slot not found."
      );
    }

    const slot = slotSnap.data();

    if (slot.booked === true) {
      throw new HttpsError(
        "already-exists",
        "That slot has already been booked."
      );
    }

    const startTime = requireFirestoreTimestamp(
      slot.startTime,
      "slot.startTime"
    );

    const startTimeMillis = startTime.toMillis();

    if (startTimeMillis <= Date.now()) {
      throw new HttpsError(
        "failed-precondition",
        "Cannot book a slot in the past."
      );
    }

    const roomUrl =
      await createDailyRoomForStartTime(startTime);

    const appointmentRef =
      db.collection("appointments").doc();

    // Doc ID is the txRef itself — the natural, simplest way to make
    // "has this payment already been used" a single existence check
    // rather than a query.
    const paymentRef = db.collection("payments").doc(txRef);

    const patient = patientSnap.data();

    const patientName =
      `${patient.firstName || ""} ${patient.lastName || ""}`.trim();

    const doctorName =
      typeof doctor.name === "string"
        ? doctor.name
        : "";

    // Tracks WHY the transaction failed, set from inside the callback
    // before throwing — used below to decide whether an automatic
    // refund is warranted. Only a genuine slot conflict warrants one; a
    // reused payment does not (that's the abuse case, not a failure the
    // patient's money should come back for).
    let slotConflict = false;

    try {
      await db.runTransaction(async (transaction) => {
        const [freshSlotSnap, paymentSnap] = await Promise.all([
          transaction.get(slotRef),
          transaction.get(paymentRef),
        ]);

        if (paymentSnap.exists) {
          throw new HttpsError(
            "already-exists",
            "This payment has already been used to book an appointment."
          );
        }

        if (!freshSlotSnap.exists) {
          slotConflict = true;
          throw new HttpsError(
            "not-found",
            "Slot not found."
          );
        }

        const freshSlot =
          freshSlotSnap.data();

        if (freshSlot.booked === true) {
          slotConflict = true;
          throw new HttpsError(
            "already-exists",
            "That slot has already been booked."
          );
        }

        const freshStartTime =
          requireFirestoreTimestamp(
            freshSlot.startTime,
            "slot.startTime"
          );

        if (
          freshStartTime.toMillis() !==
          startTimeMillis
        ) {
          slotConflict = true;
          throw new HttpsError(
            "aborted",
            "Slot changed while booking. Please try again."
          );
        }

        if (
          freshStartTime.toMillis() <=
          Date.now()
        ) {
          slotConflict = true;
          throw new HttpsError(
            "failed-precondition",
            "Cannot book a slot in the past."
          );
        }

        transaction.update(slotRef, {
          booked: true,
        });

        transaction.set(paymentRef, {
          appointmentId: appointmentRef.id,
          usedAt: FieldValue.serverTimestamp(),
        });

        transaction.set(appointmentRef, {
          doctorId,
          doctorName,
          patientId,
          patientName,
          slotId,
          startTime: freshStartTime,
          status: "booked",
          roomUrl,
          payment: {
            txRef,
            paystackTransactionId,
            amount,
            currency,
            paidAt: FieldValue.serverTimestamp(),
          },
          createdAt:
            FieldValue.serverTimestamp(),
        });
      });
    } catch (err) {
      if (slotConflict) {
        // A real payment went through but no appointment could be
        // created — refund rather than leave the patient charged with
        // nothing to show for it. Best-effort: if the refund call
        // itself fails, refundPaystackTransaction already logs it
        // for manual follow-up; the patient still needs to see this
        // clear message either way, not a secondary error about the
        // refund mechanism.
        await refundPaystackTransaction(txRef);
        throw new HttpsError(
          err.code || "aborted",
          `${err.message} Your payment has been refunded.`
        );
      }
      throw err;
    }

    await sendBookingNotification(doctorId, patientName, startTime);

    return {
      appointmentId:
        appointmentRef.id,
      doctorName,
      startTimeMillis,
    };
  }
);

exports.createDailyRoom = onCall(
  { secrets: [dailyApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Must be signed in."
      );
    }

    const {
      startTimeMillis,
    } = request.data || {};

    if (
      !startTimeMillis ||
      typeof startTimeMillis !== "number"
    ) {
      throw new HttpsError(
        "invalid-argument",
        "startTimeMillis (number) is required."
      );
    }

    const startTime =
      Timestamp.fromMillis(
        startTimeMillis
      );

    return {
      roomUrl:
        await createDailyRoomForStartTime(
          startTime
        ),
    };
  }
);

