"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";
import { useUserProfile } from "../../../lib/useUserProfile";

// Required before a doctor can reach their dashboard — same pattern as the
// patient profile form. Filled in before the verification-pending check,
// so an admin reviewing pending doctors in /admin already has a real name
// to go on, not just an email. Also editable anytime after, by revisiting
// this page.
//
// This data feeds directly into the doctors collection entry created
// automatically when an admin approves this account — see app/admin/page.js.

export default function DoctorProfileForm() {
  const { user, role, loading } = useAuth();
  const { profile, loadingProfile } = useUserProfile(user);
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (role && role !== "doctor") {
      router.push("/patient/dashboard");
    }
  }, [user, role, loading, router]);

  // Pre-fill if revisiting to edit an existing profile.
  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.firstName || "");
    setLastName(profile.lastName || "");
    setSpecialty(profile.specialty || "");
    setPhone(profile.phone || "");
  }, [profile]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!firstName.trim() || !lastName.trim() || !specialty.trim() || !phone.trim()) {
      setError("Please fill in every field.");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        specialty: specialty.trim(),
        phone: phone.trim(),
        profileComplete: true,
      });
      router.push("/doctor/dashboard");
    } catch (err) {
      console.error(err);
      setError("Couldn't save your details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || loadingProfile || !user || (role && role !== "doctor")) {
    return <main style={{ padding: 24 }}>Loading...</main>;
  }

  return (
    <main style={{ padding: 24, maxWidth: 400, margin: "0 auto" }}>
      <h1>Complete your profile</h1>
      <p style={{ color: "#666" }}>
        Patients will see this once your account is approved.
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
          Specialty
          <input
            type="text"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="e.g. General Practice"
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
        {error && <p style={{ color: "red" }}>{error}</p>}
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save and continue"}
        </button>
      </form>
    </main>
  );
}
