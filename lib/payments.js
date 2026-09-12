// Flutterwave inline checkout, loaded as a plain script tag rather than
// a React-specific SDK wrapper — same lightweight-dependency approach as
// @daily-co/daily-js elsewhere in this app (dynamically loaded, no extra
// npm package pulled in just for this).
const FLUTTERWAVE_SCRIPT_URL = "https://checkout.flutterwave.com/v3.js";
let scriptLoadingPromise = null;

// One flat fee for every doctor for now (per the current pricing model).
// Must match CONSULTATION_FEE_NGN in functions/index.js — duplicated
// rather than shared, since the Cloud Function and this Next.js app are
// separate runtimes with no shared module between them (same reasoning
// as CONSULTATION_MINUTES elsewhere in this app). This is a placeholder
// value — set it to your actual price before going live.
export const CONSULTATION_FEE_NGN = 5000;

function loadFlutterwaveScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Payments can only be initiated in the browser."));
  }
  if (window.FlutterwaveCheckout) {
    return Promise.resolve();
  }
  if (!scriptLoadingPromise) {
    scriptLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = FLUTTERWAVE_SCRIPT_URL;
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

// Opens Flutterwave's checkout widget for the flat consultation fee.
// Resolves with { txRef } once the widget itself reports success, or
// null if the patient closes it without paying. IMPORTANT: this result
// is only ever a client-side signal to proceed to the next step — it is
// NOT treated as proof of payment anywhere in this app. functions/index.js's
// bookAppointment independently re-verifies the same txRef directly
// against Flutterwave's servers before ever creating an appointment;
// this function's job is only to collect the payment and hand back a
// reference to check.
//
// NOTE: verified against Flutterwave's long-standing documented inline
// checkout API (FlutterwaveCheckout({...}) with a callback/onclose
// pair). Flutterwave does periodically revise its SDK — worth a quick
// check against their current docs the first time you actually test a
// real payment, in case field names have shifted since this was written.
export async function payForConsultation({ email, name, phone }) {
  await loadFlutterwaveScript();

  const publicKey = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error(
      "Payments aren't configured yet — set NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY in .env.local."
    );
  }

  const txRef = `medaxis-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return new Promise((resolve) => {
    window.FlutterwaveCheckout({
      public_key: publicKey,
      tx_ref: txRef,
      amount: CONSULTATION_FEE_NGN,
      currency: "NGN",
      payment_options: "card, banktransfer, ussd",
      customer: {
        email,
        name,
        phone_number: phone,
      },
      customizations: {
        title: "MedAxis Wellness",
        description: "Consultation fee",
      },
      callback: (response) => {
        if (response?.status === "successful" || response?.status === "completed") {
          resolve({ txRef });
        } else {
          resolve(null);
        }
      },
      onclose: () => {
        // Fires if the patient closes the widget — including right
        // after a successful payment, once Flutterwave's own UI is
        // done. The callback above will already have resolved by then
        // in the success case, so this only matters for the
        // closed-without-paying case.
        resolve(null);
      },
    });
  });
}
