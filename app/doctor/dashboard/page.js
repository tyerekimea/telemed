"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";

// MVP note: this should filter to appointments where doctorId === the
// logged-in doctor's uid, once booking is tied to the real signed-in doctor.
// Shows everything for now.

export default function DoctorDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [verified, setVerified] = useState(null);
  const [appointments, setAppointments] = useState([]);

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
    async function loadAppointments() {
      const snapshot = await getDocs(collection(db, "appointments"));
      setAppointments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    loadAppointments();
  }, []);

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
      <h1>Your appointments</h1>
      {appointments.length === 0 && <p>No appointments yet.</p>}
      {appointments.map((appt) => (
        <div key={appt.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <p><strong>Status:</strong> {appt.status}</p>
          <button>Join video call</button>
        </div>
      ))}
    </main>
  );
}
