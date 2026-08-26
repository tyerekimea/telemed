/*
 * Tests the appointment-chat Firestore rules against a running local
 * emulator — the actual, programmatic replacement for the "Rules
 * Playground" that older emulator UI versions had built in. This one
 * doesn't, so this script does the same job: fire real reads/writes as
 * specific fake users and assert whether the rules allow or deny them.
 *
 * Requires the Firestore emulator already running separately:
 *   firebase emulators:start --only firestore
 *
 * Then, in another terminal:
 *   node scripts/testChatRules.js
 *
 * This does NOT touch your real production Firestore — it only talks to
 * 127.0.0.1:8080, the local emulator (matching the port set in
 * firebase.json). It seeds its own fake appointment doc and cleans up
 * after itself.
 */

const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  serverTimestamp,
} = require("firebase/firestore");
const fs = require("fs");
const path = require("path");

const PROJECT_ID = "medaxis-wellness-rules-test";
const APPOINTMENT_ID = "test-appt-1";
const PATIENT_UID = "patient-uid-1";
const DOCTOR_UID = "doctor-uid-1";
const OUTSIDER_UID = "random-uid-2";

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(
        path.resolve(__dirname, "../firestore.rules"),
        "utf8"
      ),
      host: "127.0.0.1",
      port: 8080,
    },
  });

  // Seed the appointment doc directly, bypassing all rules — this is
  // what withSecurityRulesDisabled is for: setting up test fixtures,
  // not the thing under test.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "appointments", APPOINTMENT_ID),
      { patientId: PATIENT_UID, doctorId: DOCTOR_UID }
    );
  });

  const patientDb = testEnv.authenticatedContext(PATIENT_UID).firestore();
  const doctorDb = testEnv.authenticatedContext(DOCTOR_UID).firestore();
  const outsiderDb = testEnv.authenticatedContext(OUTSIDER_UID).firestore();

  const messagesPath = `appointments/${APPOINTMENT_ID}/messages`;

  let failures = 0;

  async function check(label, promise, expectAllowed) {
    try {
      if (expectAllowed) {
        await assertSucceeds(promise);
      } else {
        await assertFails(promise);
      }
      console.log(`  PASS  ${label}`);
    } catch (err) {
      failures++;
      console.log(`  FAIL  ${label}`);
      console.log(`        ${err.message.split("\n")[0]}`);
    }
  }

  console.log("\nAppointment chat rules — " + messagesPath + "\n");

  await check(
    "patient can send a message",
    addDoc(collection(patientDb, messagesPath), {
      senderId: PATIENT_UID,
      text: "hello from patient",
      sentAt: serverTimestamp(),
    }),
    true
  );

  await check(
    "doctor can send a message",
    addDoc(collection(doctorDb, messagesPath), {
      senderId: DOCTOR_UID,
      text: "hello from doctor",
      sentAt: serverTimestamp(),
    }),
    true
  );

  await check(
    "outsider CANNOT send a message",
    addDoc(collection(outsiderDb, messagesPath), {
      senderId: OUTSIDER_UID,
      text: "I shouldn't be able to do this",
      sentAt: serverTimestamp(),
    }),
    false
  );

  await check(
    "patient CANNOT send a message pretending to be the doctor",
    addDoc(collection(patientDb, messagesPath), {
      senderId: DOCTOR_UID, // spoofed sender
      text: "pretending to be the doctor",
      sentAt: serverTimestamp(),
    }),
    false
  );

  await check(
    "a message with no text CANNOT be sent",
    addDoc(collection(patientDb, messagesPath), {
      senderId: PATIENT_UID,
      text: "",
      sentAt: serverTimestamp(),
    }),
    false
  );

  await check(
    "outsider CANNOT read the conversation",
    getDocs(collection(outsiderDb, messagesPath)),
    false
  );

  await check(
    "patient can read the conversation",
    getDocs(collection(patientDb, messagesPath)),
    true
  );

  console.log("");
  await testEnv.cleanup();

  if (failures > 0) {
    console.log(`${failures} check(s) failed — rules do not behave as expected.\n`);
    process.exit(1);
  } else {
    console.log("All checks passed — rules behave as expected.\n");
  }
}

main().catch((err) => {
  console.error("Test script crashed:", err);
  process.exit(1);
});
