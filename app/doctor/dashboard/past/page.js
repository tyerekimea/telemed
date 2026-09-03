"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { useAuth } from "../../../../lib/useAuth";
import { useIsAdmin } from "../../../../lib/useIsAdmin";
import { useUserProfile } from "../../../../lib/useUserProfile";
import AppHeader from "../../../../components/AppHeader";
import ConsultationForms from "../../../../components/ConsultationForms";

// "Past" means the appointment's consultation window has fully elapsed —
// see the note in /doctor/dashboard/page.js for why this is the window
// end, not the bare startTime. Visit notes, prescriptions, and
// investigation requests all live here (via ConsultationForms, shared
// with the live version on the call page — see app/call/page.js) — call
// buttons and file attachments stay on the Pending page since they're
// only relevant before/during the appointment.
const CONSULTATION_MINUTES = 15; // must match functions/index.js

export default function PastAppointments() {
  const { user, role, loading } = useAuth();
  const isAdmin = useIsAdmin(user);
  const { profile, loadingProfile } = useUserProfile(user);
  const router = useRouter();
  const [appointments, setAppointments] = useState([]);
  const [apptsError, setApptsError] = useState("");

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
          .filter(
            (appt) =>
              (appt.startTime?.toMillis() ?? 0) + CONSULTATION_MINUTES * 60 * 1000 < now
          );
        // Most recent past appointment first.
        loaded.sort((a, b) => (b.startTime?.toMillis() ?? 0) - (a.startTime?.toMillis() ?? 0));
        setAppointments(loaded);
      } catch (err) {
        console.error(err);
        setApptsError("Couldn't load your appointments. Please try again.");
      }
    }
    loadAppointments();
  }, [user]);

  function handleSaved(appointmentId, field, value) {
    setAppointments((prev) =>
      prev.map((appt) => (appt.id === appointmentId ? { ...appt, [field]: value } : appt))
    );
  }

  if (
    loading ||
    loadingProfile ||
    !user ||
    (role && role !== "doctor") ||
    (profile && !profile.profileComplete)
  ) {
    return <main className="loadingShell">Loading...</main>;
  }

  if (profile?.verified === false) {
    return (
      <main className="shell">
        <AppHeader backHref="/" />
        <div className="container">
          <p className="eyebrow">Doctor dashboard</p>
          <h1 className="pageTitle">Almost there</h1>
          <p className="pageSubtext">
            Your account is pending verification. We'll let you know once an admin approves it.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <AppHeader
        backHref="/doctor/dashboard"
        right={
          <>
            {isAdmin && (
              <button onClick={() => router.push("/admin")} className="btnSecondary">
                Admin
              </button>
            )}
            <button
              onClick={() => router.push("/doctor/dashboard")}
              className="btnSecondary"
            >
              Pending appointments
            </button>
          </>
        }
      />
      <div className="container">
        <p className="eyebrow">Doctor dashboard</p>
        <h1 className="pageTitle" style={{ marginBottom: 24 }}>
          Past appointments
        </h1>
        {apptsError && <p className="errorBox">{apptsError}</p>}
        {!apptsError && appointments.length === 0 && (
          <p className="emptyState">No past appointments yet.</p>
        )}
        {appointments.map((appt) => (
          <div key={appt.id} className="card">
            <p className="cardTitle">{appt.patientName || "(name not on file)"}</p>
            <p className="cardMeta">{appt.startTime?.toDate().toLocaleString()}</p>
            <ConsultationForms
              appointment={appt}
              doctorProfile={profile}
              onSaved={(field, value) => handleSaved(appt.id, field, value)}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
