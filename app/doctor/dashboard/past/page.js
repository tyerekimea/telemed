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
//
// Each appointment collapses to a compact summary row (name, date, a
// documentation-status badge) and expands on click to reveal the full
// forms. Previously all three forms for every past appointment rendered
// fully expanded at once, which got long and repetitive fast — a doctor
// with more than a couple of past visits was scrolling past a wall of
// mostly-empty textareas to find the one they actually wanted to open.
// Nothing starts expanded; the doctor picks what to open.
const CONSULTATION_MINUTES = 15; // must match functions/index.js

function documentationStatus(appt) {
  const parts = [];
  if (appt.notes) parts.push("Notes");
  if (appt.prescription?.medications) parts.push("Prescription");
  if (appt.investigationRequest?.testsRequested) parts.push("Investigation");
  return parts;
}

export default function PastAppointments() {
  const { user, role, loading } = useAuth();
  const isAdmin = useIsAdmin(user);
  const { profile, loadingProfile } = useUserProfile(user);
  const router = useRouter();
  const [appointments, setAppointments] = useState([]);
  const [apptsError, setApptsError] = useState("");
  const [expandedIds, setExpandedIds] = useState(new Set());

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

  function toggleExpanded(appointmentId) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(appointmentId)) {
        next.delete(appointmentId);
      } else {
        next.add(appointmentId);
      }
      return next;
    });
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
        {appointments.map((appt) => {
          const isOpen = expandedIds.has(appt.id);
          const docParts = documentationStatus(appt);
          return (
            <div key={appt.id} className="card">
              <button
                type="button"
                onClick={() => toggleExpanded(appt.id)}
                className="collapsibleHeader"
                aria-expanded={isOpen}
              >
                <div>
                  <p className="cardTitle" style={{ marginBottom: 4 }}>
                    {appt.patientName || "(name not on file)"}
                  </p>
                  <p className="cardMeta" style={{ marginBottom: 0 }}>
                    {appt.startTime?.toDate().toLocaleString()}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {docParts.length > 0 ? (
                    <span className="badgeDone">{docParts.join(" · ")}</span>
                  ) : (
                    <span className="badgePending">Needs documentation</span>
                  )}
                  <span className={`chevron ${isOpen ? "chevronOpen" : ""}`}>▶</span>
                </div>
              </button>
              {isOpen && (
                <div className="collapsibleBody">
                  <ConsultationForms
                    appointment={appt}
                    doctorProfile={profile}
                    onSaved={(field, value) => handleSaved(appt.id, field, value)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
