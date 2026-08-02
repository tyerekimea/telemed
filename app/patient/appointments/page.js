"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";

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

  if (loading || !user) {
    return <main style={{ padding: 24 }}>Loading...</main>;
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Your appointments</h1>
      {loadingAppts && <p>Loading...</p>}
      {apptsError && <p style={{ color: "red" }}>{apptsError}</p>}
      {!loadingAppts && !apptsError && appointments.length === 0 && (
        <p>No appointments booked yet. Head back to find a doctor.</p>
      )}
      {appointments.map((appt) => (
        <div key={appt.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <p style={{ margin: "0 0 4px" }}><strong>{appt.doctorName}</strong></p>
          <p style={{ margin: "0 0 8px", color: "#666" }}>
            {appt.startTime?.toDate().toLocaleString()}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => router.push(`/call?appointmentId=${appt.id}&mode=video`)}>
              Video call
            </button>
            <button onClick={() => router.push(`/call?appointmentId=${appt.id}&mode=voice`)}>
              Voice call
            </button>
          </div>
          {appt.notes && (
            <div style={{ marginTop: 12, padding: 12, background: "#f7f7f7", borderRadius: 6 }}>
              <p style={{ margin: "0 0 4px", fontSize: 14, color: "#666" }}>Visit notes</p>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{appt.notes}</p>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 4, fontSize: 14, color: "#666" }}>
              Attach a file for the doctor (PNG, JPG, PDF, or Word — max 10MB)
            </label>
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
              disabled={uploadingId === appt.id}
              onChange={(e) => handleFileSelect(appt.id, e)}
            />
            {uploadingId === appt.id && <p style={{ margin: "4px 0", fontSize: 14 }}>Uploading...</p>}
            {uploadError[appt.id] && (
              <p style={{ margin: "4px 0", fontSize: 14, color: "red" }}>{uploadError[appt.id]}</p>
            )}
            {appt.attachments?.length > 0 && (
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
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
    </main>
  );
}
