"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, updateDoc, query, where } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { useAuth } from "../../../../lib/useAuth";
import { useIsAdmin } from "../../../../lib/useIsAdmin";
import { useUserProfile } from "../../../../lib/useUserProfile";

// "Past" means startTime has already elapsed — see the note in
// /doctor/dashboard/page.js. Visit notes live here for now; call buttons
// and file attachments stay on the Pending page since they're only
// relevant before/during the appointment.

export default function PastAppointments() {
  const { user, role, loading } = useAuth();
  const isAdmin = useIsAdmin(user);
  const { profile, loadingProfile } = useUserProfile(user);
  const router = useRouter();
  const [appointments, setAppointments] = useState([]);
  const [apptsError, setApptsError] = useState("");
  const [draftNotes, setDraftNotes] = useState({}); // { [appointmentId]: text being edited }
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (role && role !== "doctor") {
      router.push("/patient/dashboard");
    }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (loading || loadingProfile) return;
    if (user && role === "doctor" && profile && !profile.profileComplete) {
      router.push("/doctor/profile");
    }
  }, [user, role, profile, loading, loadingProfile, router]);

  useEffect(() => {
    if (!user) return;
    async function loadAppointments() {
      try {
        const q = query(collection(db, "appointments"), where("doctorId", "==", user.uid));
        const snapshot = await getDocs(q);
        const now = Date.now();
        const loaded = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((appt) => (appt.startTime?.toMillis() ?? 0) < now);
        // Most recent past appointment first.
        loaded.sort((a, b) => (b.startTime?.toMillis() ?? 0) - (a.startTime?.toMillis() ?? 0));
        setAppointments(loaded);
        const initialDrafts = {};
        loaded.forEach((appt) => {
          initialDrafts[appt.id] = appt.notes || "";
        });
        setDraftNotes(initialDrafts);
      } catch (err) {
        console.error(err);
        setApptsError("Couldn't load your appointments. Please try again.");
      }
    }
    loadAppointments();
  }, [user]);

  async function handleSaveNotes(appointmentId) {
    setSavingId(appointmentId);
    try {
      await updateDoc(doc(db, "appointments", appointmentId), {
        notes: draftNotes[appointmentId] || "",
      });
      setAppointments((prev) =>
        prev.map((appt) =>
          appt.id === appointmentId ? { ...appt, notes: draftNotes[appointmentId] } : appt
        )
      );
    } catch (err) {
      console.error(err);
      alert("Couldn't save notes. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  if (
    loading ||
    loadingProfile ||
    !user ||
    (role && role !== "doctor") ||
    (profile && !profile.profileComplete)
  ) {
    return <main style={{ padding: 24 }}>Loading...</main>;
  }

  if (profile?.verified === false) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Almost there</h1>
        <p>Your account is pending verification. We'll let you know once an admin approves it.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Past appointments</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && <button onClick={() => router.push("/admin")}>Admin</button>}
          <button onClick={() => router.push("/doctor/dashboard")}>Pending appointments</button>
        </div>
      </div>
      {apptsError && <p style={{ color: "red" }}>{apptsError}</p>}
      {!apptsError && appointments.length === 0 && <p>No past appointments yet.</p>}
      {appointments.map((appt) => (
        <div key={appt.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <p style={{ margin: "0 0 4px" }}>
            <strong>{appt.patientName || "(name not on file)"}</strong>
          </p>
          <p style={{ margin: "0 0 8px", color: "#666" }}>
            {appt.startTime?.toDate().toLocaleString()}
          </p>
          <div>
            <label style={{ display: "block", marginBottom: 4, fontSize: 14, color: "#666" }}>
              Visit notes
            </label>
            <textarea
              value={draftNotes[appt.id] ?? ""}
              onChange={(e) =>
                setDraftNotes((prev) => ({ ...prev, [appt.id]: e.target.value }))
              }
              rows={3}
              style={{ width: "100%", maxWidth: 400, display: "block", marginBottom: 8 }}
              placeholder="Diagnosis, prescription, follow-up..."
            />
            <button
              onClick={() => handleSaveNotes(appt.id)}
              disabled={savingId === appt.id}
            >
              {savingId === appt.id ? "Saving..." : "Save notes"}
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}
