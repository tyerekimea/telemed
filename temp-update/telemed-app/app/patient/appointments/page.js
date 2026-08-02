"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";

export default function PatientAppointments() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [apptsError, setApptsError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (role && role !== "patient") {
      router.push("/doctor/dashboard");
    }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (!user) return;
    async function loadAppointments() {
      try {
        // Only a "where" here, no "orderBy" — see the same note in
        // patient/dashboard/page.js about avoiding composite indexes.
        const q = query(collection(db, "appointments"), where("patientId", "==", user.uid));
        const snapshot = await getDocs(q);
        const loaded = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        loaded.sort((a, b) => (a.startTime?.toMillis() ?? 0) - (b.startTime?.toMillis() ?? 0));
        setAppointments(loaded);
      } catch (err) {
        console.error(err);
        setApptsError("Couldn't load your appointments. Please try again.");
      } finally {
        setLoadingAppts(false);
      }
    }
    loadAppointments();
  }, [user]);

  if (loading || !user) {
    return <main style={{ padding: 24 }}>Loading...</main>;
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Your appointments</h1>
      {loadingAppts && <p>Loading...</p>}
      {apptsError && <p style={{ color: "red" }}>{apptsError}</p>}
      {!loadingAppts && !apptsError && appointments.length === 0 && (
        <p>No appointments booked yet. Head back to find a doctor.</p>
      )}
      {appointments.map((appt) => (
        <div key={appt.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <p style={{ margin: "0 0 4px" }}><strong>{appt.doctorName}</strong></p>
          <p style={{ margin: "0 0 8px", color: "#666" }}>
            {appt.startTime?.toDate().toLocaleString()}
          </p>
          <button onClick={() => router.push(`/call?appointmentId=${appt.id}`)}>Join video call</button>
          {appt.notes && (
            <div style={{ marginTop: 12, padding: 12, background: "#f7f7f7", borderRadius: 6 }}>
              <p style={{ margin: "0 0 4px", fontSize: 14, color: "#666" }}>Visit notes</p>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{appt.notes}</p>
            </div>
          )}
        </div>
      ))}
    </main>
  );
}
