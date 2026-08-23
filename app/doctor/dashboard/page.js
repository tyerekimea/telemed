"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";
import { useIsAdmin } from "../../../lib/useIsAdmin";
import { useUserProfile } from "../../../lib/useUserProfile";
import AppHeader from "../../../components/AppHeader";

// Doctor documents use the doctor's Firebase Auth uid as their document ID
// (see README — when adding a doctor manually in Firestore, set the
// Document ID field to their uid from the Authentication tab, not Auto-ID).
// That's what makes "the logged-in doctor" and "this doctors-collection
// entry" the same thing, so appointments can be filtered to just theirs.
//
// "Pending" here means startTime is now or in the future — this page is
// for appointments still to come. Anything already elapsed moves to
// /doctor/dashboard/past, where visit notes live instead.

export default function DoctorDashboard() {
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

  // Profile must be complete before anything else — see app/doctor/profile.
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
          .filter((appt) => (appt.startTime?.toMillis() ?? 0) >= now);
        loaded.sort((a, b) => (a.startTime?.toMillis() ?? 0) - (b.startTime?.toMillis() ?? 0));
        setAppointments(loaded);
      } catch (err) {
        console.error(err);
        setApptsError("Couldn't load your appointments. Please try again.");
      }
    }
    loadAppointments();
  }, [user]);

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
        backHref="/"
        right={
          <>
            {isAdmin && (
              <button onClick={() => router.push("/admin")} className="btnSecondary">
                Admin
              </button>
            )}
            <button
              onClick={() => router.push("/doctor/availability")}
              className="btnSecondary"
            >
              My availability
            </button>
            <button
              onClick={() => router.push("/doctor/dashboard/past")}
              className="btnSecondary"
            >
              Past appointments
            </button>
          </>
        }
      />
      <div className="container">
        <p className="eyebrow">Doctor dashboard</p>
        <h1 className="pageTitle" style={{ marginBottom: 24 }}>
          Pending appointments
        </h1>
        {apptsError && <p className="errorBox">{apptsError}</p>}
        {!apptsError && appointments.length === 0 && (
          <p className="emptyState">No upcoming appointments.</p>
        )}
        {appointments.map((appt) => (
          <div key={appt.id} className="card">
            <p className="cardTitle">{appt.patientName || "(name not on file)"}</p>
            <p className="cardMeta">{appt.startTime?.toDate().toLocaleString()}</p>
            <div className="rowGap">
              <button
                onClick={() => router.push(`/call?appointmentId=${appt.id}&mode=video`)}
                className="btnPrimary"
              >
                Video call
              </button>
              <button
                onClick={() => router.push(`/call?appointmentId=${appt.id}&mode=voice`)}
                className="btnSecondary"
              >
                Voice call
              </button>
            </div>
            {appt.attachments?.length > 0 && (
              <div className="subBlock">
                <p className="subBlockLabel">Files from patient</p>
                <ul className="fileList" style={{ marginTop: 0 }}>
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
          </div>
        ))}
      </div>
    </main>
  );
}
