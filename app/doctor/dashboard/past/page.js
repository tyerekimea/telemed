"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, doc, updateDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { useAuth } from "../../../../lib/useAuth";
import { useIsAdmin } from "../../../../lib/useIsAdmin";
import { useUserProfile } from "../../../../lib/useUserProfile";
import { printPrescription, printInvestigationRequest } from "../../../../lib/printDocument";
import AppHeader from "../../../../components/AppHeader";

// "Past" means startTime has already elapsed — see the note in
// /doctor/dashboard/page.js. Visit notes, prescriptions, and investigation
// requests all live here — call buttons and file attachments stay on the
// Pending page since they're only relevant before/during the appointment.
// Prescriptions and investigation requests are simple free-text fields by
// design (not structured per-drug/per-test rows) — see README.

export default function PastAppointments() {
  const { user, role, loading } = useAuth();
  const isAdmin = useIsAdmin(user);
  const { profile, loadingProfile } = useUserProfile(user);
  const router = useRouter();
  const [appointments, setAppointments] = useState([]);
  const [apptsError, setApptsError] = useState("");
  const [draftNotes, setDraftNotes] = useState({}); // { [appointmentId]: text being edited }
  const [draftPrescription, setDraftPrescription] = useState({}); // { [id]: { diagnosis, medications } }
  const [draftInvestigation, setDraftInvestigation] = useState({}); // { [id]: { clinicalNotes, testsRequested, urgency } }
  const [savingId, setSavingId] = useState(null); // which field+appointment is saving, e.g. "notes:abc123"

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
          .filter((appt) => (appt.startTime?.toMillis() ?? 0) < now);
        // Most recent past appointment first.
        loaded.sort((a, b) => (b.startTime?.toMillis() ?? 0) - (a.startTime?.toMillis() ?? 0));
        setAppointments(loaded);
        const initialDrafts = {};
        const initialPrescriptions = {};
        const initialInvestigations = {};
        loaded.forEach((appt) => {
          initialDrafts[appt.id] = appt.notes || "";
          initialPrescriptions[appt.id] = {
            diagnosis: appt.prescription?.diagnosis || "",
            medications: appt.prescription?.medications || "",
          };
          initialInvestigations[appt.id] = {
            clinicalNotes: appt.investigationRequest?.clinicalNotes || "",
            testsRequested: appt.investigationRequest?.testsRequested || "",
            urgency: appt.investigationRequest?.urgency || "routine",
          };
        });
        setDraftNotes(initialDrafts);
        setDraftPrescription(initialPrescriptions);
        setDraftInvestigation(initialInvestigations);
      } catch (err) {
        console.error(err);
        setApptsError("Couldn't load your appointments. Please try again.");
      }
    }
    loadAppointments();
  }, [user]);

  async function handleSaveNotes(appointmentId) {
    setSavingId(`notes:${appointmentId}`);
    try {
      await updateDoc(doc(db, "appointments", appointmentId), {
        notes: draftNotes[appointmentId] || "",
      });
      setAppointments((prev) =>
        prev.map((appt) =>
          appt.id === appointmentId ? { ...appt, notes: draftNotes[appointmentId] } : appt
        )
      );
    } catch (err) {
      console.error(err);
      alert("Couldn't save notes. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSavePrescription(appointmentId) {
    setSavingId(`prescription:${appointmentId}`);
    try {
      const draft = draftPrescription[appointmentId];
      const prescription = {
        diagnosis: draft.diagnosis || "",
        medications: draft.medications || "",
        // Snapshot the doctor's credentials at the moment of issue, rather
        // than linking live to their profile — a prescription should stay
        // accurate to who actually issued it even if their profile changes later.
        doctorName: `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim(),
        specialty: profile?.specialty || "",
        licenseNumber: profile?.licenseNumber || "",
        issuedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "appointments", appointmentId), { prescription });
      setAppointments((prev) =>
        prev.map((appt) =>
          appt.id === appointmentId
            ? { ...appt, prescription: { ...prescription, issuedAt: new Date() } }
            : appt
        )
      );
    } catch (err) {
      console.error(err);
      alert("Couldn't save the prescription. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveInvestigation(appointmentId) {
    setSavingId(`investigation:${appointmentId}`);
    try {
      const draft = draftInvestigation[appointmentId];
      const investigationRequest = {
        clinicalNotes: draft.clinicalNotes || "",
        testsRequested: draft.testsRequested || "",
        urgency: draft.urgency || "routine",
        doctorName: `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim(),
        specialty: profile?.specialty || "",
        licenseNumber: profile?.licenseNumber || "",
        issuedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "appointments", appointmentId), { investigationRequest });
      setAppointments((prev) =>
        prev.map((appt) =>
          appt.id === appointmentId
            ? { ...appt, investigationRequest: { ...investigationRequest, issuedAt: new Date() } }
            : appt
        )
      );
    } catch (err) {
      console.error(err);
      alert("Couldn't save the investigation request. Please try again.");
    } finally {
      setSavingId(null);
    }
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

            <div>
              <label className="labelMuted">Visit notes</label>
              <textarea
                value={draftNotes[appt.id] ?? ""}
                onChange={(e) =>
                  setDraftNotes((prev) => ({ ...prev, [appt.id]: e.target.value }))
                }
                rows={3}
                className="textarea"
                style={{ maxWidth: 460, marginBottom: 10 }}
                placeholder="Diagnosis, prescription, follow-up..."
              />
              <button
                onClick={() => handleSaveNotes(appt.id)}
                disabled={savingId === `notes:${appt.id}`}
                className="btnSecondary"
              >
                {savingId === `notes:${appt.id}` ? "Saving..." : "Save notes"}
              </button>
            </div>

            <hr className="divider" />
            <p className="cardTitle" style={{ fontSize: 16, marginBottom: 10 }}>
              Prescription
            </p>
            <label className="labelMuted">Diagnosis</label>
            <input
              type="text"
              value={draftPrescription[appt.id]?.diagnosis ?? ""}
              onChange={(e) =>
                setDraftPrescription((prev) => ({
                  ...prev,
                  [appt.id]: { ...prev[appt.id], diagnosis: e.target.value },
                }))
              }
              className="input"
              style={{ maxWidth: 460, marginBottom: 10 }}
              placeholder="e.g. Malaria (uncomplicated)"
            />
            <label className="labelMuted">
              Medications (drug, dose, frequency, duration)
            </label>
            <textarea
              value={draftPrescription[appt.id]?.medications ?? ""}
              onChange={(e) =>
                setDraftPrescription((prev) => ({
                  ...prev,
                  [appt.id]: { ...prev[appt.id], medications: e.target.value },
                }))
              }
              rows={4}
              className="textarea"
              style={{ maxWidth: 460, marginBottom: 10 }}
              placeholder={"e.g.\nArtemether/Lumefantrine 80/480mg — 1 tab twice daily for 3 days\nParacetamol 500mg — 1-2 tabs every 6 hours as needed for fever"}
            />
            <div className="rowGap">
              <button
                onClick={() => handleSavePrescription(appt.id)}
                disabled={savingId === `prescription:${appt.id}`}
                className="btnSecondary"
              >
                {savingId === `prescription:${appt.id}` ? "Saving..." : "Save prescription"}
              </button>
              {appt.prescription?.medications && (
                <button
                  onClick={() =>
                    printPrescription({
                      ...appt.prescription,
                      patientName: appt.patientName,
                    })
                  }
                  className="btnGhost"
                >
                  Print
                </button>
              )}
            </div>

            <hr className="divider" />
            <p className="cardTitle" style={{ fontSize: 16, marginBottom: 10 }}>
              Investigation request
            </p>
            <label className="labelMuted">
              Clinical notes / provisional diagnosis
            </label>
            <textarea
              value={draftInvestigation[appt.id]?.clinicalNotes ?? ""}
              onChange={(e) =>
                setDraftInvestigation((prev) => ({
                  ...prev,
                  [appt.id]: { ...prev[appt.id], clinicalNotes: e.target.value },
                }))
              }
              rows={2}
              className="textarea"
              style={{ maxWidth: 460, marginBottom: 10 }}
              placeholder="Brief clinical picture to help the lab interpret results"
            />
            <label className="labelMuted">Tests requested</label>
            <textarea
              value={draftInvestigation[appt.id]?.testsRequested ?? ""}
              onChange={(e) =>
                setDraftInvestigation((prev) => ({
                  ...prev,
                  [appt.id]: { ...prev[appt.id], testsRequested: e.target.value },
                }))
              }
              rows={3}
              className="textarea"
              style={{ maxWidth: 460, marginBottom: 10 }}
              placeholder={"e.g.\nFull Blood Count\nMalaria parasite (RDT/microscopy)\nRandom blood sugar"}
            />
            <label className="labelMuted">Urgency</label>
            <select
              value={draftInvestigation[appt.id]?.urgency ?? "routine"}
              onChange={(e) =>
                setDraftInvestigation((prev) => ({
                  ...prev,
                  [appt.id]: { ...prev[appt.id], urgency: e.target.value },
                }))
              }
              className="select"
              style={{ maxWidth: 220, marginBottom: 10 }}
            >
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
            </select>
            <div className="rowGap">
              <button
                onClick={() => handleSaveInvestigation(appt.id)}
                disabled={savingId === `investigation:${appt.id}`}
                className="btnSecondary"
              >
                {savingId === `investigation:${appt.id}`
                  ? "Saving..."
                  : "Save investigation request"}
              </button>
              {appt.investigationRequest?.testsRequested && (
                <button
                  onClick={() =>
                    printInvestigationRequest({
                      ...appt.investigationRequest,
                      patientName: appt.patientName,
                    })
                  }
                  className="btnGhost"
                >
                  Print
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
