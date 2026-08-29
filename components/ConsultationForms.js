"use client";

import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { printPrescription, printInvestigationRequest } from "../lib/printDocument";

// Visit notes, prescription, and investigation-request forms for a single
// appointment — shared between /doctor/dashboard/past (documenting after
// the fact) and app/call/page.js (documenting live, during the
// consultation itself). Each field saves independently, same as before —
// a doctor can jot notes mid-call without having to also fill in a
// prescription before anything is saved.
//
// `appointment` needs: id, notes, prescription, investigationRequest,
// patientName. `doctorProfile` needs: firstName, lastName, specialty,
// licenseNumber — snapshotted onto the prescription/investigation at
// save time (see the comment below on why it's a snapshot, not a live
// reference). `onSaved(field, value)` lets the parent page keep its own
// local appointment list in sync after a successful save.
export default function ConsultationForms({ appointment, doctorProfile, onSaved }) {
  const [draftNotes, setDraftNotes] = useState(appointment.notes || "");
  const [draftPrescription, setDraftPrescription] = useState({
    diagnosis: appointment.prescription?.diagnosis || "",
    medications: appointment.prescription?.medications || "",
  });
  const [draftInvestigation, setDraftInvestigation] = useState({
    clinicalNotes: appointment.investigationRequest?.clinicalNotes || "",
    testsRequested: appointment.investigationRequest?.testsRequested || "",
    urgency: appointment.investigationRequest?.urgency || "routine",
  });
  const [savingField, setSavingField] = useState(null); // "notes" | "prescription" | "investigation" | null
  const [currentPrescription, setCurrentPrescription] = useState(appointment.prescription || null);
  const [currentInvestigation, setCurrentInvestigation] = useState(
    appointment.investigationRequest || null
  );

  async function handleSaveNotes() {
    setSavingField("notes");
    try {
      await updateDoc(doc(db, "appointments", appointment.id), {
        notes: draftNotes || "",
      });
      onSaved?.("notes", draftNotes);
    } catch (err) {
      console.error(err);
      alert("Couldn't save notes. Please try again.");
    } finally {
      setSavingField(null);
    }
  }

  async function handleSavePrescription() {
    setSavingField("prescription");
    try {
      const prescription = {
        diagnosis: draftPrescription.diagnosis || "",
        medications: draftPrescription.medications || "",
        // Snapshot the doctor's credentials at the moment of issue, rather
        // than linking live to their profile — a prescription should stay
        // accurate to who actually issued it even if their profile changes later.
        doctorName: `${doctorProfile?.firstName || ""} ${doctorProfile?.lastName || ""}`.trim(),
        specialty: doctorProfile?.specialty || "",
        licenseNumber: doctorProfile?.licenseNumber || "",
        issuedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "appointments", appointment.id), { prescription });
      const savedPrescription = { ...prescription, issuedAt: new Date() };
      setCurrentPrescription(savedPrescription);
      onSaved?.("prescription", savedPrescription);
    } catch (err) {
      console.error(err);
      alert("Couldn't save the prescription. Please try again.");
    } finally {
      setSavingField(null);
    }
  }

  async function handleSaveInvestigation() {
    setSavingField("investigation");
    try {
      const investigationRequest = {
        clinicalNotes: draftInvestigation.clinicalNotes || "",
        testsRequested: draftInvestigation.testsRequested || "",
        urgency: draftInvestigation.urgency || "routine",
        doctorName: `${doctorProfile?.firstName || ""} ${doctorProfile?.lastName || ""}`.trim(),
        specialty: doctorProfile?.specialty || "",
        licenseNumber: doctorProfile?.licenseNumber || "",
        issuedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "appointments", appointment.id), { investigationRequest });
      const savedInvestigation = { ...investigationRequest, issuedAt: new Date() };
      setCurrentInvestigation(savedInvestigation);
      onSaved?.("investigationRequest", savedInvestigation);
    } catch (err) {
      console.error(err);
      alert("Couldn't save the investigation request. Please try again.");
    } finally {
      setSavingField(null);
    }
  }

  return (
    <div>
      <div>
        <label className="labelMuted">Visit notes</label>
        <textarea
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          rows={3}
          className="textarea"
          style={{ maxWidth: 460, marginBottom: 10 }}
          placeholder="Diagnosis, prescription, follow-up..."
        />
        <button
          onClick={handleSaveNotes}
          disabled={savingField === "notes"}
          className="btnSecondary"
        >
          {savingField === "notes" ? "Saving..." : "Save notes"}
        </button>
      </div>

      <hr className="divider" />
      <p className="cardTitle" style={{ fontSize: 16, marginBottom: 10 }}>
        Prescription
      </p>
      <label className="labelMuted">Diagnosis</label>
      <input
        type="text"
        value={draftPrescription.diagnosis}
        onChange={(e) =>
          setDraftPrescription((prev) => ({ ...prev, diagnosis: e.target.value }))
        }
        className="input"
        style={{ maxWidth: 460, marginBottom: 10 }}
        placeholder="e.g. Malaria (uncomplicated)"
      />
      <label className="labelMuted">
        Medications (drug, dose, frequency, duration)
      </label>
      <textarea
        value={draftPrescription.medications}
        onChange={(e) =>
          setDraftPrescription((prev) => ({ ...prev, medications: e.target.value }))
        }
        rows={4}
        className="textarea"
        style={{ maxWidth: 460, marginBottom: 10 }}
        placeholder={"e.g.\nArtemether/Lumefantrine 80/480mg — 1 tab twice daily for 3 days\nParacetamol 500mg — 1-2 tabs every 6 hours as needed for fever"}
      />
      <div className="rowGap">
        <button
          onClick={handleSavePrescription}
          disabled={savingField === "prescription"}
          className="btnSecondary"
        >
          {savingField === "prescription" ? "Saving..." : "Save prescription"}
        </button>
        {currentPrescription?.medications && (
          <button
            onClick={() =>
              printPrescription({
                ...currentPrescription,
                patientName: appointment.patientName,
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
      <label className="labelMuted">Clinical notes / provisional diagnosis</label>
      <textarea
        value={draftInvestigation.clinicalNotes}
        onChange={(e) =>
          setDraftInvestigation((prev) => ({ ...prev, clinicalNotes: e.target.value }))
        }
        rows={2}
        className="textarea"
        style={{ maxWidth: 460, marginBottom: 10 }}
        placeholder="Brief clinical picture to help the lab interpret results"
      />
      <label className="labelMuted">Tests requested</label>
      <textarea
        value={draftInvestigation.testsRequested}
        onChange={(e) =>
          setDraftInvestigation((prev) => ({ ...prev, testsRequested: e.target.value }))
        }
        rows={3}
        className="textarea"
        style={{ maxWidth: 460, marginBottom: 10 }}
        placeholder={"e.g.\nFull Blood Count\nMalaria parasite (RDT/microscopy)\nRandom blood sugar"}
      />
      <label className="labelMuted">Urgency</label>
      <select
        value={draftInvestigation.urgency}
        onChange={(e) =>
          setDraftInvestigation((prev) => ({ ...prev, urgency: e.target.value }))
        }
        className="select"
        style={{ maxWidth: 220, marginBottom: 10 }}
      >
        <option value="routine">Routine</option>
        <option value="urgent">Urgent</option>
      </select>
      <div className="rowGap">
        <button
          onClick={handleSaveInvestigation}
          disabled={savingField === "investigation"}
          className="btnSecondary"
        >
          {savingField === "investigation" ? "Saving..." : "Save investigation request"}
        </button>
        {currentInvestigation?.testsRequested && (
          <button
            onClick={() =>
              printInvestigationRequest({
                ...currentInvestigation,
                patientName: appointment.patientName,
              })
            }
            className="btnGhost"
          >
            Print
          </button>
        )}
      </div>
    </div>
  );
}
