"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

// Login / signup page.
//
// IMPORTANT:
// During login we do NOT rely on the role selected in the signup dropdown.
// The user's actual role is read from:
// users/{uid}
//
// Doctors are routed to /doctor/availability after login so they can
// manage their available consultation times.
// Patients are routed to /patient/dashboard.

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("patient");
  const [mode, setMode] = useState("login"); // "login" | "signup" | "reset"
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  async function handleReset(e) {
    e.preventDefault();

    setError("");
    setResetSent(false);
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      // Don't reveal whether an email address is registered.
      if (err.code === "auth/user-not-found") {
        setResetSent(true);
      } else {
        console.error(err);
        setError(err.message || "Unable to send password reset email.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      /*
       * ============================================================
       * SIGN UP
       * ============================================================
       */
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

        const userDoc = {
          role,
          email,

          // Patients are immediately verified.
          // Doctors remain unverified until an admin approves them.
          verified: role === "patient",

          // Both roles complete their profile after signup.
          profileComplete: false,

          createdAt: serverTimestamp(),
        };

        await setDoc(
          doc(db, "users", cred.user.uid),
          userDoc
        );

        /*
         * After signup:
         *
         * Doctor → doctor profile first.
         * Patient → patient profile first.
         *
         * The profile pages can then redirect to the appropriate
         * dashboard/availability area after completion.
         */
        if (role === "doctor") {
          router.push("/doctor/profile");
        } else {
          router.push("/patient/profile");
        }

        return;
      }

      /*
       * ============================================================
       * LOGIN
       * ============================================================
       */

      const cred = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      /*
       * IMPORTANT:
       *
       * Do NOT use the local `role` state here.
       *
       * On login the dropdown isn't displayed, so `role` would still
       * normally contain its default value ("patient").
       *
       * Instead, read the user's actual role from Firestore.
       */
      const userRef = doc(db, "users", cred.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        throw new Error(
          "Your account profile could not be found. Please contact an administrator."
        );
      }

      const userData = userSnap.data();
      const actualRole = userData.role;

      /*
       * Validate that the account has a recognized role.
       */
      if (actualRole !== "doctor" && actualRole !== "patient") {
        throw new Error(
          "Your account has an invalid role. Please contact an administrator."
        );
      }

      /*
       * ============================================================
       * DOCTOR LOGIN
       * ============================================================
       *
       * Doctors go to their profile if it isn't complete yet.
       *
       * Once their profile is complete, they go directly to the
       * availability page where they can submit their available
       * dates and times.
       */
      if (actualRole === "doctor") {
        if (userData.profileComplete !== true) {
          router.push("/doctor/profile");
        } else {
          router.push("/doctor/availability");
        }

        return;
      }

      /*
       * ============================================================
       * PATIENT LOGIN
       * ============================================================
       */
      if (actualRole === "patient") {
        if (userData.profileComplete !== true) {
          router.push("/patient/profile");
        } else {
          router.push("/patient/dashboard");
        }

        return;
      }
    } catch (err) {
      console.error("Authentication error:", err);

      /*
       * Firebase errors are often useful during development, but
       * provide a cleaner message for the user where possible.
       */
      switch (err.code) {
        case "auth/invalid-credential":
          setError("Incorrect email or password.");
          break;

        case "auth/user-not-found":
          setError("Incorrect email or password.");
          break;

        case "auth/wrong-password":
          setError("Incorrect email or password.");
          break;

        case "auth/invalid-email":
          setError("Please enter a valid email address.");
          break;

        case "auth/email-already-in-use":
          setError("An account already exists with this email address.");
          break;

        case "auth/weak-password":
          setError("Password must be at least 6 characters.");
          break;

        default:
          setError(
            err.message ||
              "Something went wrong. Please try again."
          );
      }
    } finally {
      setLoading(false);
    }
  }

  /*
   * ================================================================
   * PASSWORD RESET SCREEN
   * ================================================================
   */
  if (mode === "reset") {
    return (
      <main
        style={{
          padding: 24,
          maxWidth: 360,
          margin: "0 auto",
        }}
      >
        <h1>Reset password</h1>

        {resetSent ? (
          <>
            <p>
              If an account exists for{" "}
              <strong>{email}</strong>, a reset link has been
              sent. Check your inbox and spam folder.
            </p>

            <button
              onClick={() => {
                setMode("login");
                setResetSent(false);
                setError("");
              }}
              style={{
                background: "none",
                border: "none",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <p style={{ color: "#666" }}>
              Enter your email and we'll send you a link to
              reset your password.
            </p>

            <form
              onSubmit={handleReset}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />

              {error && (
                <p style={{ color: "red" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Sending..."
                  : "Send reset link"}
              </button>
            </form>

            <button
              onClick={() => {
                setMode("login");
                setError("");
              }}
              style={{
                marginTop: 12,
                background: "none",
                border: "none",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Back to login
            </button>
          </>
        )}
      </main>
    );
  }

  /*
   * ================================================================
   * LOGIN / SIGNUP SCREEN
   * ================================================================
   */
  return (
    <main
      style={{
        padding: 24,
        maxWidth: 360,
        margin: "0 auto",
      }}
    >
      <h1>
        {mode === "signup"
          ? "Create account"
          : "Log in"}
      </h1>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />

        {mode === "signup" && (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={loading}
          >
            <option value="patient">
              I'm a patient
            </option>

            <option value="doctor">
              I'm a doctor
            </option>
          </select>
        )}

        {error && (
          <p style={{ color: "red" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Please wait..."
            : mode === "signup"
            ? "Sign up"
            : "Log in"}
        </button>
      </form>

      {mode === "login" && (
        <button
          onClick={() => {
            setMode("reset");
            setError("");
          }}
          style={{
            marginTop: 8,
            background: "none",
            border: "none",
            textDecoration: "underline",
            display: "block",
            cursor: "pointer",
          }}
        >
          Forgot password?
        </button>
      )}

      <button
        onClick={() => {
          setMode(
            mode === "signup"
              ? "login"
              : "signup"
          );
          setError("");
        }}
        style={{
          marginTop: 12,
          background: "none",
          border: "none",
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        {mode === "signup"
          ? "Already have an account? Log in"
          : "New here? Sign up"}
      </button>
    </main>
  );
}

