/*
 * Firebase Cloud Messaging service worker — handles push notifications
 * for the web app while the tab isn't focused (or isn't open at all).
 * Required for web push specifically; the native Android app doesn't use
 * this file at all — it registers through @capacitor/push-notifications
 * instead (see lib/notifications.js).
 *
 * This MUST be a plain static file served from exactly this path
 * (/firebase-messaging-sw.js) at the site's root — it can't go through
 * Next.js's normal build pipeline or read process.env values, which is
 * why the config below is filled in directly rather than imported.
 *
 * Fill in the six values below with the SAME values from your
 * .env.local (the NEXT_PUBLIC_FIREBASE_* ones) — these are not secrets,
 * they're already public in the app's client bundle either way, so
 * duplicating them here is fine.
 */

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "FILL_IN_NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "FILL_IN_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "FILL_IN_NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "FILL_IN_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "FILL_IN_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "FILL_IN_NEXT_PUBLIC_FIREBASE_APP_ID",
});

const messaging = firebase.messaging();

// Shows a system notification when a push arrives while no tab has focus.
// (A push that arrives while a tab IS focused is instead handled by
// onMessage() in the app itself, if you add a foreground handler later —
// this service worker only covers the background case.)
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "MedAxis Wellness", {
    body: body || "You have a new notification.",
    // No app icon exists in public/ yet — browsers fall back to a
    // generic icon without one, which is harmless, but add a real
    // public/icon-192.png (192x192) and reference it here once you have
    // proper app icon assets.
  });
});
