"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, getDoc, updateDoc, query, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";
import { useIsAdmin } from "../../../lib/useIsAdmin";

// Doctor documents use the doctor's Firebase Auth uid as their document ID
// (see README — when adding a doctor manually in Firestore, set the
// Document ID field to their uid from the Authentication tab, not Auto-ID).
// That's what makes "the logged-in doctor" and "this doctors-collection
// entry" the same thing, so appointments can be filtered to just theirs.

export default function DoctorDashboard() {
  const { user, role, loading } = useAuth();
  const isAdmin = useIsAdmin(user);
  const router = useRouter();
  const [verified, setVerified] = useState(null);
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
    } else if (user) {
      getDoc(doc(db, "users", user.uid)).then((snap) => {
        setVerified(snap.exists() ? !!snap.data().verified : false);
      });
    }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function loadAppointments() {
      try {
        const q = query(collection(db, "appointments"), where("doctorId", "==", user.uid));
        const snapshot = await getDocs(q);
        const loaded = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
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

  if (loading || !user || (role && role !== "doctor")) {
    return <main style={{ padding: 24 }}>Loading...</main>;
  }

  if (verified === false) {
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
        <h1>Your appointments</h1>
        {isAdmin && <button onClick={() => router.push("/admin")}>Admin</button>}
      </div>
      {apptsError && <p style={{ color: "red" }}>{apptsError}</p>}
      {!apptsError && appointments.length === 0 && <p>No appointments yet.</p>}
      {appointments.map((appt) => (
        <div key={appt.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <p><strong>Status:</strong> {appt.status}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => router.push(`/call?appointmentId=${appt.id}&mode=video`)}>
              Video call
            </button>
            <button onClick={() => router.push(`/call?appointmentId=${appt.id}&mode=voice`)}>
              Voice call
            </button>
          </div>
          {appt.attachments?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: "0 0 4px", fontSize: 14, color: "#666" }}>
                Files from patient
              </p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {appt.attachments.map((file, i) => (
                  <li key={i}>
                    <a href={file.url} target="_blank" rel="noopener noreferrer">
                      {file.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
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
