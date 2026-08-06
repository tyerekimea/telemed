"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";

// MVP note: role (patient vs doctor) is chosen at signup and should be saved
// on the user's profile document in Firestore. Doctor accounts should also
// be flagged "unverified" until an admin approves them — see README.

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("patient");
  const [mode, setMode] = useState("login"); // "login" | "signup" | "reset"
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();

  async function handleReset(e) {
    e.preventDefault();
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      // Don't reveal whether this email has an account — show the same
      // success state either way, so the message can't be used to check
      // who's registered. Only show a real error for genuine problems
      // (bad network, malformed email, etc.).
      if (err.code === "auth/user-not-found") {
        setResetSent(true);
      } else {
        setError(err.message);
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const userDoc = {
          role,
          email,
          // doctors start unverified until an admin approves them (see README)
          verified: role === "patient" ? true : false,
          // Both roles fill in details on first login — patient:
          // name/DOB/phone/gender (app/patient/profile), doctor:
          // name/specialty/phone (app/doctor/profile). Enforced by the
          // redirect in each role's dashboard/appointments pages.
          profileComplete: false,
          createdAt: serverTimestamp(),
        };
        await setDoc(doc(db, "users", cred.user.uid), userDoc);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push(role === "doctor" ? "/doctor/dashboard" : "/patient/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  if (mode === "reset") {
    return (
      <main style={{ padding: 24, maxWidth: 360, margin: "0 auto" }}>
        <h1>Reset password</h1>
        {resetSent ? (
          <>
            <p>
              If an account exists for <strong>{email}</strong>, a reset link has been sent.
              Check your inbox (and spam folder).
            </p>
            <button
              onClick={() => {
                setMode("login");
                setResetSent(false);
              }}
              style={{ background: "none", border: "none", textDecoration: "underline" }}
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <p style={{ color: "#666" }}>
              Enter your email and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && <p style={{ color: "red" }}>{error}</p>}
              <button type="submit">Send reset link</button>
            </form>
            <button
              onClick={() => setMode("login")}
              style={{ marginTop: 12, background: "none", border: "none", textDecoration: "underline" }}
            >
              Back to login
            </button>
          </>
        )}
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 360, margin: "0 auto" }}>
      <h1>{mode === "signup" ? "Create account" : "Log in"}</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {mode === "signup" && (
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="patient">I'm a patient</option>
            <option value="doctor">I'm a doctor</option>
          </select>
        )}
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit">{mode === "signup" ? "Sign up" : "Log in"}</button>
      </form>
      {mode === "login" && (
        <button
          onClick={() => {
            setMode("reset");
            setError("");
          }}
          style={{ marginTop: 8, background: "none", border: "none", textDecoration: "underline", display: "block" }}
        >
          Forgot password?
        </button>
      )}
      <button
        onClick={() => setMode(mode === "signup" ? "login" : "signup")}
        style={{ marginTop: 12, background: "none", border: "none", textDecoration: "underline" }}
      >
        {mode === "signup" ? "Already have an account? Log in" : "New here? Sign up"}
      </button>
    </main>
  );
}
