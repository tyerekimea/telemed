const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

// redeploy trigger
// Set with: firebase functions:secrets:set DAILY_API_KEY
// (get the key from the Daily.co dashboard → Developers tab)
const dailyApiKey = defineSecret("DAILY_API_KEY");

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

  const expSeconds = Math.floor(startTimeMillis / 1000) + 60 * 60; // 1 hour after start

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
  return { roomUrl: room.url };
});
