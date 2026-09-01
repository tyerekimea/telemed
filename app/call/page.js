"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";
import { useUserProfile } from "../../lib/useUserProfile";
import AppHeader from "../../components/AppHeader";
import ChatPanel from "../../components/ChatPanel";
import ConsultationForms from "../../components/ConsultationForms";

// roomUrl is created per-appointment at booking time (see createDailyRoom
// in functions/index.js and handleBookSlot in patient/dashboard/page.js),
// via a Cloud Function that holds the Daily.co API key server-side — the
// key can never live in this app since it's client-side code. Each room
// auto-expires 1 hour after the appointment's start time.
//
// Older appointments booked before this existed won't have a roomUrl on
// the appointment itself — for those, this page falls back to the
// doctor's static roomUrl field (the original approach).
//
// This page reads ?appointmentId= from the URL rather than a dynamic route
// segment (e.g. /call/[id]) because the app builds as a static export for
// Capacitor — a static export can't pre-render pages for IDs that don't
// exist yet at build time, but a fixed page reading a query param works fine.
//
// Next.js requires any component calling useSearchParams() to sit inside a
// <Suspense> boundary when the page is statically prerendered, or the build
// fails — hence the split into an inner component wrapped below.
//
// Chat: Daily's own in-call chat panel is disabled at room creation
// (enable_chat: false in functions/index.js). Chat is instead our own —
// see components/ChatPanel.js, backed by Firestore under
// appointments/{appointmentId}/messages, scoped to the same two people
// who can access the appointment and the call itself.
//
// mode=chat is its own option alongside video/voice, not just something
// that shows up once you're already in a call — a patient or doctor can
// go straight to texting without ever creating/joining a Daily room at
// all. When mode is "chat", the Daily iframe is skipped entirely and no
// roomUrl is required, so an appointment can be chatted on even before
// (or instead of) any video/voice call ever happens for it.
//
// Consultation forms: visit notes, prescription, and investigation
// request (see components/ConsultationForms.js, shared with the same
// forms on /doctor/dashboard/past) are rendered here too, doctor-only,
// so a doctor can document a consultation as it happens rather than
// having to wait until the appointment moves to Past appointments after
// the fact. Each field still saves independently and immediately, same
// as before.
//
// Voice vs video: both use the exact same Daily room and call frame — the
// only difference is whether the camera starts on or off, controlled by
// ?mode=voice in the URL. Either party can still toggle their own camera
// during the call regardless of which button they joined from.

function CallPageInner() {
  const { user, loading } = useAuth();
  const { profile } = useUserProfile(user);
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");
  const modeParam = searchParams.get("mode");
  const mode = modeParam === "voice" ? "voice" : modeParam === "chat" ? "chat" : "video";
  const callFrameRef = useRef(null);
  const containerRef = useRef(null);
  const [appointment, setAppointment] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !appointmentId) return;
    async function loadAppointment() {
      const snap = await getDoc(doc(db, "appointments", appointmentId));
      if (!snap.exists()) {
        setError("Appointment not found.");
        return;
      }
      const appt = snap.data();
      if (mode === "chat") {
        // No video/voice room needed for a chat-only visit.
        setAppointment(appt);
        return;
      }
      let roomUrl = appt.roomUrl;
      if (!roomUrl) {
        // Fallback for appointments booked before dynamic room creation.
        const doctorSnap = await getDoc(doc(db, "doctors", appt.doctorId));
        roomUrl = doctorSnap.exists() ? doctorSnap.data().roomUrl : null;
      }
      if (!roomUrl) {
        setError("This appointment doesn't have a video room set up.");
        return;
      }
      setAppointment({ ...appt, roomUrl });
    }
    loadAppointment();
  }, [user, appointmentId, mode]);

  function handleSaved(field, value) {
    setAppointment((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  useEffect(() => {
    if (!appointment || !containerRef.current || mode === "chat") return;

    let cancelled = false;
    import("@daily-co/daily-js").then(({ default: DailyIframe }) => {
      if (cancelled) return;
      const frame = DailyIframe.createFrame(containerRef.current, {
        showLeaveButton: true,
        iframeStyle: { width: "100%", height: "500px", border: "0", borderRadius: "14px" },
      });
      frame.join({ url: appointment.roomUrl, startVideoOff: mode === "voice" });
      callFrameRef.current = frame;
    });

    return () => {
      cancelled = true;
      callFrameRef.current?.destroy();
    };
  }, [appointment, mode]);

  if (loading || !user) {
    return <main className="loadingShell">Loading...</main>;
  }

  if (!appointmentId) {
    return (
      <main className="shell">
        <AppHeader backHref="/" />
        <div className="container">
          <p className="emptyState">No appointment specified.</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="shell">
        <AppHeader backHref="/" />
        <div className="container">
          <p className="errorBox">{error}</p>
          <button onClick={() => router.back()} className="btnSecondary">
            Go back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <AppHeader />
      <div className="container">
        <p className="eyebrow">
          {mode === "chat" ? "Chat" : mode === "voice" ? "Voice call" : "Video call"}
        </p>
        <h1 className="pageTitle" style={{ marginBottom: 20 }}>
          {mode === "chat" ? "Chat" : mode === "voice" ? "Voice call" : "Video call"}
        </h1>
        <div
          style={{
            display: "flex",
            gap: 20,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          {mode !== "chat" && (
            <div ref={containerRef} style={{ flex: "2 1 480px", minWidth: 280 }} />
          )}
          <div style={{ flex: mode === "chat" ? "1 1 100%" : "1 1 300px", minWidth: 280, maxWidth: mode === "chat" ? 560 : undefined }}>
            <ChatPanel
              appointmentId={appointmentId}
              currentUserId={user.uid}
              otherPartyName={
                appointment &&
                (user.uid === appointment.patientId
                  ? appointment.doctorName
                  : appointment.patientName)
              }
            />
          </div>
        </div>

        {appointment && user.uid === appointment.doctorId && (
          <div className="card" style={{ marginTop: 20 }}>
            <p className="cardTitle" style={{ marginBottom: 4 }}>
              Consultation notes
            </p>
            <p className="cardMeta" style={{ marginBottom: 16 }}>
              Document as you go — each field saves on its own, no need to
              fill in everything before saving.
            </p>
            <ConsultationForms
              appointment={{ ...appointment, id: appointmentId }}
              doctorProfile={profile}
              onSaved={handleSaved}
            />
          </div>
        )}
      </div>
    </main>
  );
}

export default function CallPage() {
  return (
    <Suspense fallback={<main className="loadingShell">Loading...</main>}>
      <CallPageInner />
    </Suspense>
  );
}
