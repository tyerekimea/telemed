"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";
import { useUserProfile } from "../../../lib/useUserProfile";

// Required before a patient can book — see the profileComplete check in
// patient/dashboard and patient/appointments. Also editable anytime after,
// by revisiting this page — it's not a one-time-only form.

export default function PatientProfileForm() {
  const { user, role, loading } = useAuth();
  const { profile, loadingProfile } = useUserProfile(user);
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (role && role !== "patient") {
      router.push("/doctor/dashboard");
    }
  }, [user, role, loading, router]);

  // Pre-fill the form if the patient's revisiting to edit an existing profile.
  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName || "");
    setLastName(profile.lastName || "");
    setDob(profile.dob || "");
    setPhone(profile.phone || "");
    setGender(profile.gender || "");
  }, [profile]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim() || !dob || !phone.trim() || !gender) {
      setError("Please fill in every field.");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob,
        phone: phone.trim(),
        gender,
        profileComplete: true,
      });
      router.push("/patient/dashboard");
    } catch (err) {
      console.error(err);
      setError("Couldn't save your details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadingProfile || !user || (role && role !== "patient")) {
    return <main style={{ padding: 24 }}>Loading...</main>;
  }

  return (
    <main style={{ padding: 24, maxWidth: 400, margin: "0 auto" }}>
      <h1>Complete your profile</h1>
      <p style={{ color: "#666" }}>
        We need a few details before you can book an appointment.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          First name
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={{ display: "block", width: "100%" }}
            required
          />
        </label>
        <label>
          Last name
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={{ display: "block", width: "100%" }}
            required
          />
        </label>
        <label>
          Date of birth
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            style={{ display: "block", width: "100%" }}
            required
          />
        </label>
        <label>
          Phone number
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ display: "block", width: "100%" }}
            required
          />
        </label>
        <label>
          Gender
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            style={{ display: "block", width: "100%" }}
            required
          >
            <option value="">Select...</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </label>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save and continue"}
        </button>
      </form>
    </main>
  );
}
