"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";
import DoctorCard from "../../../components/DoctorCard";

// MVP note: doctors are read from a "doctors" collection you seed manually
// in Firestore for now (id, name, specialty, verified: true). Slots come
// from scripts/seedSlots.js — see README.

export default function PatientDashboard() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [doctors, setDoctors] = useState([]);
  const [openDoctorId, setOpenDoctorId] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [confirmation, setConfirmation] = useState("");

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

  async function handleSelectDoctor(doctor) {
    setConfirmation("");
    setSlotsError("");
    if (openDoctorId === doctor.id) {
      setOpenDoctorId(null);
      return;
    }
    setOpenDoctorId(doctor.id);
    setSlotsLoading(true);
    try {
      // Note: only a "where" here, no "orderBy" — combining an equality
      // filter with orderBy on a different field needs a Firestore
      // composite index. Sorting client-side avoids that entirely.
      const slotsQuery = query(
        collection(db, "doctors", doctor.id, "slots"),
        where("booked", "==", false)
      );
      const snapshot = await getDocs(slotsQuery);
      const loadedSlots = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      loadedSlots.sort((a, b) => a.startTime.toMillis() - b.startTime.toMillis());
      setSlots(loadedSlots);
    } catch (err) {
      console.error(err);
      setSlotsError("Couldn't load available times. Please try again.");
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleBookSlot(doctor, slot) {
    // Flip the slot to booked, then create the appointment tied to it.
    await updateDoc(doc(db, "doctors", doctor.id, "slots", slot.id), {
      booked: true,
    });
    await addDoc(collection(db, "appointments"), {
      doctorId: doctor.id,
      doctorName: doctor.name,
      patientId: user.uid,
      slotId: slot.id,
      startTime: slot.startTime,
      status: "booked",
      createdAt: serverTimestamp(),
    });
    setSlots((prev) => prev.filter((s) => s.id !== slot.id));
    setConfirmation(
      `Booked with ${doctor.name} for ${slot.startTime.toDate().toLocaleString()}.`
    );
  }

  if (loading || !user || (role && role !== "patient")) {
    return <main style={{ padding: 24 }}>Loading...</main>;
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Find a doctor</h1>
        <button onClick={() => router.push("/patient/appointments")}>My appointments</button>
      </div>
      {confirmation && <p style={{ color: "green" }}>{confirmation}</p>}
      {doctors.length === 0 && <p>No doctors available yet — seed the "doctors" collection in Firestore.</p>}
      {doctors.map((doctor) => (
        <div key={doctor.id}>
          <DoctorCard doctor={doctor} onBook={handleSelectDoctor} />
          {openDoctorId === doctor.id && (
            <div style={{ margin: "-4px 0 16px", paddingLeft: 16 }}>
              {slotsLoading && <p>Loading times...</p>}
              {slotsError && <p style={{ color: "red" }}>{slotsError}</p>}
              {!slotsLoading && !slotsError && slots.length === 0 && <p>No open slots right now.</p>}
              {!slotsLoading &&
                !slotsError &&
                slots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => handleBookSlot(doctor, slot)}
                    style={{ marginRight: 8, marginBottom: 8 }}
                  >
                    {slot.startTime.toDate().toLocaleString([], {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </button>
                ))}
            </div>
          )}
        </div>
      ))}
    </main>
  );
}

