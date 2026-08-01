"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";

export default function PatientAppointments() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(true);

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
      const q = query(
        collection(db, "appointments"),
        where("patientId", "==", user.uid),
        orderBy("startTime")
      );
      const snapshot = await getDocs(q);
      setAppointments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingAppts(false);
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
      {!loadingAppts && appointments.length === 0 && (
        <p>No appointments booked yet. Head back to find a doctor.</p>
      )}
      {appointments.map((appt) => (
        <div key={appt.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <p style={{ margin: "0 0 4px" }}><strong>{appt.doctorName}</strong></p>
          <p style={{ margin: "0 0 8px", color: "#666" }}>
            {appt.startTime?.toDate().toLocaleString()}
          </p>
          <button onClick={() => router.push(`/call?appointmentId=${appt.id}`)}>Join video call</button>
        </div>
      ))}
    </main>
  );
}
