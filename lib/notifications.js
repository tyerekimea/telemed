import { Capacitor } from "@capacitor/core";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db, app } from "./firebase";

// Registers this device/browser for push notifications and saves its FCM
// token onto users/{uid}.fcmTokens (an array, since one doctor may have
// several devices/tabs registered — see firestore.rules for the field
// this is allowed to touch, and functions/index.js's
// sendBookingNotification for where these tokens actually get used).
//
// Branches on platform because "push notifications" means two genuinely
// different mechanisms depending on where the app is running:
//   - Native (the Capacitor Android app): goes through
//     @capacitor/push-notifications, which registers with FCM at the OS
//     level and gets real system notification tray delivery.
//   - Web (a normal browser tab): goes through the Firebase JS SDK's
//     messaging module, which needs a service worker
//     (public/firebase-messaging-sw.js) to receive pushes while the tab
//     isn't focused, and a VAPID key from the Firebase console to
//     authorize this web app to request tokens at all.
//
// Both are dynamically imported rather than imported at the top of this
// file, same pattern as @daily-co/daily-js in app/call/page.js — avoids
// pulling browser/native-only code into the build's static prerender
// pass, and means this file has no cost for anyone who never calls
// enableNotifications().
export async function enableNotifications(user) {
  if (!user) {
    return { ok: false, reason: "not-signed-in" };
  }

  if (Capacitor.isNativePlatform()) {
    return enableNativeNotifications(user);
  }
  return enableWebNotifications(user);
}

async function enableNativeNotifications(user) {
  const { PushNotifications } = await import("@capacitor/push-notifications");

  const permStatus = await PushNotifications.requestPermissions();
  if (permStatus.receive !== "granted") {
    return { ok: false, reason: "permission-denied" };
  }

  return new Promise((resolve) => {
    PushNotifications.addListener("registration", async (token) => {
      try {
        await saveToken(user.uid, token.value);
        resolve({ ok: true });
      } catch (err) {
        console.error(err);
        resolve({ ok: false, reason: "save-failed" });
      }
    });
    PushNotifications.addListener("registrationError", (err) => {
      console.error(err);
      resolve({ ok: false, reason: "registration-error" });
    });
    PushNotifications.register();
  });
}

async function enableWebNotifications(user) {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("Notification" in window)
  ) {
    return { ok: false, reason: "unsupported" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: "permission-denied" };
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.error(
      "NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set — generate one in " +
        "Firebase Console > Project Settings > Cloud Messaging > Web " +
        "Push certificates, and add it to .env.local."
    );
    return { ok: false, reason: "not-configured" };
  }

  try {
    const { getMessaging, getToken } = await import("firebase/messaging");
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) {
      return { ok: false, reason: "no-token" };
    }
    await saveToken(user.uid, token);
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, reason: "registration-error" };
  }
}

async function saveToken(uid, token) {
  await updateDoc(doc(db, "users", uid), {
    fcmTokens: arrayUnion(token),
  });
}
