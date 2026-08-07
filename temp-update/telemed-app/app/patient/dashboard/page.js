"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  doc,
  serverTimestamp,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
import { db, functions } from "../../../lib/firebase";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../../../lib/useAuth";
import { useIsAdmin } from "../../../lib/useIsAdmin";
import { useUserProfile } from "../../../lib/useUserProfile";
import DoctorCard from "../../../components/DoctorCard";

const createDailyRoom = httpsCallable(functions, "createDailyRoom");

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
      setSlots(loadedSlots);
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

    let roomUrl;
    try {
      // Create the video room first, outside the transaction — a
      // transaction should only touch Firestore, not make an external
      // network call (createDailyRoom hits Daily.co's API server-side).
      const result = await createDailyRoom({ startTimeMillis: slot.startTime.toMillis() });
      roomUrl = result.data.roomUrl;
    } catch (err) {
      console.error(err);
      setBookingError("Couldn't set up the video room. Please try again.");
      setBookingSlotId(null);
      return;
    }

    const slotRef = doc(db, "doctors", doctor.id, "slots", slot.id);
    // Generate the appointment's ID up front so it can be written inside
    // the same transaction as the slot update.
    const appointmentRef = doc(collection(db, "appointments"));

    try {
      await runTransaction(db, async (transaction) => {
        const slotSnap = await transaction.get(slotRef);
        if (!slotSnap.exists() || slotSnap.data().booked) {
          // Someone else booked this exact slot between us loading the
          // list and clicking it — bail out before writing anything.
          // Note: the room created above just goes unused in this case;
          // it still auto-expires an hour after the slot's start time,
          // so nothing needs cleaning up manually.
          throw new Error("SLOT_TAKEN");
        }
        transaction.update(slotRef, { booked: true });
        transaction.set(appointmentRef, {
          doctorId: doctor.id,
          doctorName: doctor.name,
          roomUrl,
          patientId: user.uid,
          patientName: profile ? `${profile.firstName} ${profile.lastName}` : "",
          slotId: slot.id,
          startTime: slot.startTime,
          status: "booked",
          createdAt: serverTimestamp(),
        });
      });
      setSlots((prev) => prev.filter((s) => s.id !== slot.id));
      setConfirmation(
        `Booked with ${doctor.name} for ${slot.startTime.toDate().toLocaleString()}.`
      );
    } catch (err) {
      console.error(err);
      if (err.message === "SLOT_TAKEN") {
        setBookingError("That time was just booked by someone else — pick another.");
        setSlots((prev) => prev.filter((s) => s.id !== slot.id));
      } else {
        setBookingError("Couldn't book that slot. Please try again.");
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

