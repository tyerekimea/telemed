const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

if (!admin.getApps().length) {
  admin.initializeApp();
}

const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const db = getFirestore();

// redeploy trigger
// Set with: firebase functions:secrets:set DAILY_API_KEY
// (get the key from the Daily.co dashboard → Developers tab)
const dailyApiKey = defineSecret("DAILY_API_KEY");

function validateDocumentId(value, fieldName) {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length === 0 ||
    value.includes("/")
  ) {
    throw new HttpsError("invalid-argument", `${fieldName} must be a valid document ID.`);
  }
}

function validateBookAppointmentData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "doctorId and slotId are required.");
  }

  const allowedKeys = new Set(["doctorId", "slotId"]);
  const unexpectedKeys = Object.keys(data).filter((key) => !allowedKeys.has(key));
  if (unexpectedKeys.length > 0) {
    throw new HttpsError("invalid-argument", "Only doctorId and slotId may be provided.");
  }

  validateDocumentId(data.doctorId, "doctorId");
  validateDocumentId(data.slotId, "slotId");
}

function requireFirestoreTimestamp(value, fieldName) {
  if (!value || typeof value.toMillis !== "function") {
    throw new HttpsError("failed-precondition", `${fieldName} must be a Firestore Timestamp.`);
  }
  return value;
}

async function createDailyRoomForStartTime(startTime) {
  const expSeconds = Math.floor(startTime.toMillis() / 1000) + 60 * 60; // 1 hour after start

  const response = await fetch("https://api.daily.co/v1/rooms", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${dailyApiKey.value()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      privacy: "public",
      properties: {
        exp: expSeconds,
        enable_chat: true,
        max_participants: 2,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Daily room creation failed:", errText);
    throw new HttpsError("internal", "Could not create the video room. Please try again.");
  }

  const room = await response.json();
  if (!room.url || typeof room.url !== "string") {
    console.error("Daily room creation returned no URL:", room);
    throw new HttpsError("internal", "Could not create the video room. Please try again.");
  }

  return room.url;
}

exports.bookAppointment = onCall({ secrets: [dailyApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  validateBookAppointmentData(request.data);

  const { doctorId, slotId } = request.data;
  const patientId = request.auth.uid;
  const patientRef = db.collection("users").doc(patientId);
  const doctorRef = db.collection("doctors").doc(doctorId);
  const slotRef = doctorRef.collection("slots").doc(slotId);

  const [patientSnap, doctorSnap, slotSnap] = await Promise.all([
    patientRef.get(),
    doctorRef.get(),
    slotRef.get(),
  ]);

  if (!patientSnap.exists || patientSnap.data().role !== "patient") {
    throw new HttpsError("permission-denied", "Only patients can book appointments.");
  }

  if (!doctorSnap.exists) {
    throw new HttpsError("not-found", "Doctor not found.");
  }

  const doctor = doctorSnap.data();
  if (doctor.verified !== true) {
    throw new HttpsError("failed-precondition", "Doctor is not available for booking.");
  }

  if (!slotSnap.exists) {
    throw new HttpsError("not-found", "Slot not found.");
  }

  const slot = slotSnap.data();
  if (slot.booked === true) {
    throw new HttpsError("already-exists", "That slot has already been booked.");
  }

  const startTime = requireFirestoreTimestamp(slot.startTime, "slot.startTime");
  const startTimeMillis = startTime.toMillis();
  if (startTimeMillis <= Date.now()) {
    throw new HttpsError("failed-precondition", "Cannot book a slot in the past.");
  }

  const roomUrl = await createDailyRoomForStartTime(startTime);
  const appointmentRef = db.collection("appointments").doc();

  const patient = patientSnap.data();
  const patientName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim();
  const doctorName = typeof doctor.name === "string" ? doctor.name : "";

  await db.runTransaction(async (transaction) => {
    const freshSlotSnap = await transaction.get(slotRef);

    if (!freshSlotSnap.exists) {
      throw new HttpsError("not-found", "Slot not found.");
    }

    const freshSlot = freshSlotSnap.data();
    if (freshSlot.booked === true) {
      throw new HttpsError("already-exists", "That slot has already been booked.");
    }

    const freshStartTime = requireFirestoreTimestamp(freshSlot.startTime, "slot.startTime");
    if (freshStartTime.toMillis() !== startTimeMillis) {
      throw new HttpsError("aborted", "Slot changed while booking. Please try again.");
    }

    if (freshStartTime.toMillis() <= Date.now()) {
      throw new HttpsError("failed-precondition", "Cannot book a slot in the past.");
    }

    transaction.update(slotRef, { booked: true });
    transaction.set(appointmentRef, {
      doctorId,
      doctorName,
      patientId,
      patientName,
      slotId,
      startTime: freshStartTime,
      status: "booked",
      roomUrl,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    appointmentId: appointmentRef.id,
    doctorName,
    startTimeMillis,
  };
});

// Called from the app right before a booking is written to Firestore (see
// handleBookSlot in app/patient/dashboard/page.js). Creates a fresh,
// unique Daily.co room for that specific appointment, valid until 1 hour
// after the appointment's scheduled start time — after which Daily
// auto-deletes it, keeping room count well under the free-tier cap.
exports.createDailyRoom = onCall({ secrets: [dailyApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { startTimeMillis } = request.data || {};
  if (!startTimeMillis || typeof startTimeMillis !== "number") {
    throw new HttpsError("invalid-argument", "startTimeMillis (number) is required.");
  }

  const startTime = Timestamp.fromMillis(startTimeMillis);
  return { roomUrl: await createDailyRoomForStartTime(startTime) };
});
