"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";
import { useUserProfile } from "../../../lib/useUserProfile";
import { printPrescription, printInvestigationRequest } from "../../../lib/printDocument";
import AppHeader from "../../../components/AppHeader";

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB, matches storage.rules

export default function PatientAppointments() {
  const { user, role, loading } = useAuth();
  const { profile, loadingProfile } = useUserProfile(user);
  const router = useRouter();
  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(true);
  const [apptsError, setApptsError] = useState("");
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadError, setUploadError] = useState({}); // { [appointmentId]: message }

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (role && role !== "patient") {
      router.push("/doctor/dashboard");
    }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (loading || loadingProfile) return;
    if (user && role === "patient" && profile && !profile.profileComplete) {
      router.push("/patient/profile");
    }
  }, [user, role, profile, loading, loadingProfile, router]);

  useEffect(() => {
    if (!user) return;
    async function loadAppointments() {
      try {
        // Only a "where" here, no "orderBy" — see the same note in
        // patient/dashboard/page.js about avoiding composite indexes.
        const q = query(collection(db, "appointments"), where("patientId", "==", user.uid));
        const snapshot = await getDocs(q);
        const loaded = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        loaded.sort((a, b) => (a.startTime?.toMillis() ?? 0) - (b.startTime?.toMillis() ?? 0));
        setAppointments(loaded);
      } catch (err) {
        console.error(err);
        setApptsError("Couldn't load your appointments. Please try again.");
      } finally {
        setLoadingAppts(false);
      }
    }
    loadAppointments();
  }, [user]);

  async function handleFileSelect(appointmentId, event) {
    const file = event.target.files?.[0];
    event.target.value = ""; // reset so selecting the same file again still fires onChange
    if (!file) return;

    setUploadError((prev) => ({ ...prev, [appointmentId]: "" }));

    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError((prev) => ({
        ...prev,
        [appointmentId]: "Only PNG, JPG, PDF, or Word documents are allowed.",
      }));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError((prev) => ({ ...prev, [appointmentId]: "File must be under 10MB." }));
      return;
    }

    setUploadingId(appointmentId);
    try {
      // Prefix with a timestamp so two files with the same name don't collide.
      const storagePath = `appointments/${appointmentId}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      const attachment = { name: file.name, url, uploadedAt: new Date().toISOString() };

      await updateDoc(doc(db, "appointments", appointmentId), {
        attachments: arrayUnion(attachment),
      });

      setAppointments((prev) =>
        prev.map((appt) =>
          appt.id === appointmentId
            ? { ...appt, attachments: [...(appt.attachments || []), attachment] }
            : appt
        )
      );
    } catch (err) {
      console.error(err);
      setUploadError((prev) => ({
        ...prev,
        [appointmentId]: "Upload failed. Please try again.",
      }));
    } finally {
      setUploadingId(null);
    }
  }

  if (loading || loadingProfile || !user || (profile && !profile.profileComplete)) {
    return <main className="loadingShell">Loading...</main>;
  }

  return (
    <main className="shell">
      <AppHeader backHref="/patient/dashboard" />
      <div className="container">
        <p className="eyebrow">Patient dashboard</p>
        <h1 className="pageTitle" style={{ marginBottom: 24 }}>
          Your appointments
        </h1>
        {loadingAppts && <p className="emptyState">Loading...</p>}
        {apptsError && <p className="errorBox">{apptsError}</p>}
        {!loadingAppts && !apptsError && appointments.length === 0 && (
          <p className="emptyState">No appointments booked yet. Head back to find a doctor.</p>
        )}
        {appointments.map((appt) => (
          <div key={appt.id} className="card">
            <p className="cardTitle">{appt.doctorName}</p>
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
              <button
                onClick={() => router.push(`/call?appointmentId=${appt.id}&mode=chat`)}
                className="btnSecondary"
              >
                Chat
              </button>
            </div>

            {appt.notes && (
              <div className="subBlock">
                <p className="subBlockLabel">Visit notes</p>
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{appt.notes}</p>
              </div>
            )}

            {appt.prescription?.medications && (
              <div className="subBlock">
                <p className="subBlockLabel">Prescription</p>
                {appt.prescription.diagnosis && (
                  <p style={{ margin: "0 0 6px" }}>
                    <strong>Diagnosis:</strong> {appt.prescription.diagnosis}
                  </p>
                )}
                <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
                  {appt.prescription.medications}
                </p>
                <button
                  onClick={() =>
                    printPrescription({ ...appt.prescription, patientName: appt.patientName })
                  }
                  className="btnSecondary"
                >
                  Print
                </button>
              </div>
            )}

            {appt.investigationRequest?.testsRequested && (
              <div className="subBlock">
                <p className="subBlockLabel">
                  Investigation request
                  {appt.investigationRequest.urgency === "urgent" && (
                    <span className="badgeUrgent">Urgent</span>
                  )}
                </p>
                <p style={{ margin: "0 0 12px", whiteSpace: "pre-wrap" }}>
                  {appt.investigationRequest.testsRequested}
                </p>
                <button
                  onClick={() =>
                    printInvestigationRequest({
                      ...appt.investigationRequest,
                      patientName: appt.patientName,
                    })
                  }
                  className="btnSecondary"
                >
                  Print
                </button>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <label className="labelMuted">
                Attach a file for the doctor (PNG, JPG, PDF, or Word — max 10MB)
              </label>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
                disabled={uploadingId === appt.id}
                onChange={(e) => handleFileSelect(appt.id, e)}
              />
              {uploadingId === appt.id && (
                <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--ink-soft)" }}>
                  Uploading...
                </p>
              )}
              {uploadError[appt.id] && (
                <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--danger)" }}>
                  {uploadError[appt.id]}
                </p>
              )}
              {appt.attachments?.length > 0 && (
                <ul className="fileList">
                  {appt.attachments.map((file, i) => (
                    <li key={i}>
                      <a href={file.url} target="_blank" rel="noopener noreferrer">
                        {file.name}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
