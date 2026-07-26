"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";
import DoctorCard from "../../../components/DoctorCard";

// MVP note: doctors are read from a "doctors" collection you seed manually
// in Firestore for now (id, name, specialty, verified: true). Real doctor
// self-signup + admin approval comes later.

export default function PatientDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (role && role !== "patient") {
      router.push("/doctor/dashboard");
    }
  }, [user, role, loading, router]);

  useEffect(() => {
    async function loadDoctors() {
      const snapshot = await getDocs(collection(db, "doctors"));
      setDoctors(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    loadDoctors();
  }, []);

  async function handleBook(doctor) {
    setSelectedDoctor(doctor);
    // TODO: replace with a real date/time picker. For MVP, this books "now".
    await addDoc(collection(db, "appointments"), {
      doctorId: doctor.id,
      doctorName: doctor.name,
      status: "booked",
      createdAt: serverTimestamp(),
    });
    alert(`Booked with ${doctor.name}. You'll see this in your appointments soon.`);
  }

  if (loading || !user || (role && role !== "patient")) {
    return <main style={{ padding: 24 }}>Loading...</main>;
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Find a doctor</h1>
      {doctors.length === 0 && <p>No doctors available yet — seed the "doctors" collection in Firestore.</p>}
      {doctors.map((doc) => (
        <DoctorCard key={doc.id} doctor={doc} onBook={handleBook} />
      ))}
    </main>
  );
}
