"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db, functions } from "../../../lib/firebase";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../../../lib/useAuth";
import { useIsAdmin } from "../../../lib/useIsAdmin";
import { useUserProfile } from "../../../lib/useUserProfile";
import DoctorCard from "../../../components/DoctorCard";

const bookAppointment = httpsCallable(functions, "bookAppointment");

// MVP note: doctors are read from a "doctors" collection you seed manually
// in Firestore for now (id, name, specialty, verified: true). Slots come
// from scripts/seedSlots.js — see README.

export default function PatientDashboard() {
  const { user, role, loading } = useAuth();
  const isAdmin = useIsAdmin(user);
  const { profile, loadingProfile } = useUserProfile(user);
  const router = useRouter();
  const [doctors, setDoctors] = useState([]);
  const [openDoctorId, setOpenDoctorId] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [bookingSlotId, setBookingSlotId] = useState(null);
  const [bookingError, setBookingError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (role && role !== "patient") {
      router.push("/doctor/dashboard");
    }
  }, [user, role, loading, router]);

  // Booking requires a completed profile — see app/patient/profile/page.js.
  useEffect(() => {
    if (loading || loadingProfile) return;
    if (user && role === "patient" && profile && !profile.profileComplete) {
      router.push("/patient/profile");
    }
  }, [user, role, profile, loading, loadingProfile, router]);

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
      // A slot can still exist as "unbooked" in Firestore after its actual
      // time has passed — nobody ever booked it, so nothing ever marked it
      // stale. Filter those out here rather than showing an appointment
      // time that's already gone (and would fail room creation anyway,
      // since Daily rejects an expiry time that's already in the past).
      const now = Date.now();
      const futureSlots = loadedSlots.filter((s) => s.startTime.toMillis() > now);
      setSlots(futureSlots);
    } catch (err) {
      console.error(err);
      setSlotsError("Couldn't load available times. Please try again.");
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleBookSlot(doctor, slot) {
    setConfirmation("");
    setBookingError("");
    setBookingSlotId(slot.id);

    try {
    await bookAppointment({
      doctorId: doctor.id,
      slotId: slot.id,
    });

    setSlots((prev) => prev.filter((s) => s.id !== slot.id));

    setConfirmation(
      `Booked with ${doctor.name} for ${slot.startTime
        .toDate()
        .toLocaleString()}.`
    );
  } catch (err) {
    console.error(err);

    if (err.code === "functions/already-exists") {
      setBookingError(
        "That time was just booked by someone else — pick another."
      );
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
    } else {
      setBookingError(
        err.message || "Couldn't book that slot. Please try again."
      );
    }
  } finally {
    setBookingSlotId(null);
  }
}

  if (
    loading ||
    loadingProfile ||
    !user ||
    (role && role !== "patient") ||
    (profile && !profile.profileComplete)
  ) {
    return <main style={{ padding: 24 }}>Loading...</main>;
  }

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Find a doctor</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && <button onClick={() => router.push("/admin")}>Admin</button>}
          <button onClick={() => router.push("/patient/appointments")}>My appointments</button>
        </div>
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
              {bookingError && <p style={{ color: "red" }}>{bookingError}</p>}
              {!slotsLoading && !slotsError && slots.length === 0 && <p>No open slots right now.</p>}
              {!slotsLoading &&
                !slotsError &&
                slots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => handleBookSlot(doctor, slot)}
                    disabled={bookingSlotId === slot.id}
                    style={{ marginRight: 8, marginBottom: 8 }}
                  >
                    {bookingSlotId === slot.id
                      ? "Booking..."
                      : slot.startTime.toDate().toLocaleString([], {
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

