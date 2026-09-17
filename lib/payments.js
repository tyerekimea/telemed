// Paystack Inline JS, loaded as a plain script tag rather than a
// React-specific SDK wrapper — same lightweight-dependency approach as
// @daily-co/daily-js elsewhere in this app (dynamically loaded, no extra
// npm package pulled in just for this).
const PAYSTACK_SCRIPT_URL = "https://js.paystack.co/v2/inline.js";
let scriptLoadingPromise = null;

// One flat fee for every doctor for now (per the current pricing model),
// in whole naira for display purposes — converted to kobo (Paystack's
// smallest-unit convention for NGN, so ₦1 = 100) wherever it's actually
// sent to or compared against Paystack's API. Must match
// CONSULTATION_FEE_NGN in functions/index.js — duplicated rather than
// shared, since the Cloud Function and this Next.js app are separate
// runtimes with no shared module between them (same reasoning as
// CONSULTATION_MINUTES elsewhere in this app). This is a placeholder
// value — set it to your actual price before going live.
export const CONSULTATION_FEE_NGN = 5000;

function loadPaystackScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Payments can only be initiated in the browser."));
  }
  if (window.PaystackPop) {
    return Promise.resolve();
  }
  if (!scriptLoadingPromise) {
    scriptLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = PAYSTACK_SCRIPT_URL;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptLoadingPromise = null; // allow retrying on a later attempt
        reject(new Error("Couldn't load the payment provider. Check your connection and try again."));
      };
      document.body.appendChild(script);
    });
  }
  return scriptLoadingPromise;
}

// Opens Paystack's checkout popup for the flat consultation fee.
// Resolves with { txRef } once the popup itself reports success, or null
// if the patient closes it without paying. IMPORTANT: this result is
// only ever a client-side signal to proceed to the next step — it is NOT
// treated as proof of payment anywhere in this app. functions/index.js's
// bookAppointment independently re-verifies the same reference directly
// against Paystack's servers before ever creating an appointment; this
// function's job is only to collect the payment and hand back a
// reference to check.
//
// Field kept as "txRef" in this app's own request shape (matching what
// bookAppointment already expects) even though Paystack itself calls
// this a "reference" — avoids renaming the Cloud Function's contract for
// what's purely a provider-terminology difference.
//
// NOTE: verified against Paystack's current documented Inline JS v2 API
// (new PaystackPop().newTransaction({...}) with onSuccess/onCancel
// callbacks) as of when this was written. Worth a quick check against
// their current docs the first time you actually test a real payment,
// in case anything's shifted since.
export async function payForConsultation({ email, name, phone }) {
  await loadPaystackScript();

  const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error(
      "Payments aren't configured yet — set NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY in .env.local."
    );
  }

  const txRef = `medaxis-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return new Promise((resolve) => {
    const popup = new window.PaystackPop();
    popup.newTransaction({
      key: publicKey,
      email,
      amount: CONSULTATION_FEE_NGN * 100, // Paystack expects kobo, not naira
      currency: "NGN",
      reference: txRef,
      channels: ["card", "bank", "ussd", "bank_transfer"],
      metadata: {
        name,
        phone_number: phone,
        custom_fields: [
          {
            display_name: "Consultation fee",
            variable_name: "consultation_fee",
            value: "MedAxis Wellness",
          },
        ],
      },
      onSuccess: () => {
        resolve({ txRef });
      },
      onCancel: () => {
        resolve(null);
      },
      onError: (error) => {
        console.error("Paystack checkout error:", error);
        resolve(null);
      },
    });
  });
}
