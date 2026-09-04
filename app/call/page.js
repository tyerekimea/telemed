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
// auto-expires 1 hour after the appointment's start time — a generous
// outer bound; the real enforcement is the consultation window below.
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
// (or instead of) any video/voice call ever happens for it. Chat IS
// gated by the same consultation window as video/voice (see below) —
// text access to an appointment follows the same slot boundaries as a
// call would.
//
// Consultation forms: visit notes, prescription, and investigation
// request (see components/ConsultationForms.js, shared with the same
// forms on /doctor/dashboard/past) are rendered here too, doctor-only,
// so a doctor can document a consultation as it happens rather than
// having to wait until the appointment moves to Past appointments after
// the fact. Each field still saves independently and immediately, same
// as before — and, deliberately, these forms are also NOT gated by the
// consultation window, since a doctor should still be able to write up
// notes after a call ends.
//
// Voice vs video: both use the exact same Daily room and call frame — the
// only difference is whether the camera starts on or off, controlled by
// ?mode=voice in the URL. Either party can still toggle their own camera
// during the call regardless of which button they joined from.
//
// Consultation window (applies to video, voice, and chat alike): access
// is only allowed from LEAD_MINUTES before the scheduled start through
// CONSULTATION_MINUTES after it — matching the slot length set in
// functions/index.js (duplicated here as a plain constant rather than
// shared, since Cloud Functions and this Next.js app are separate
// runtimes with no shared module between them; keep these two in sync by
// hand if the consultation length ever changes). Before the window
// opens, no Daily room is joined and the chat panel doesn't render.
// Once the window closes — even mid-call, even mid-conversation — access
// is force-ended: the effect below that creates the Daily frame depends
// on windowStatus, so React's cleanup mechanism destroys the frame the
// instant windowStatus stops being "active", with no separate imperative
// "kick everyone out" code needed; the chat panel simply stops being
// rendered the same way.
const LEAD_MINUTES = 5;
const CONSULTATION_MINUTES = 15; // must match functions/index.js

function computeWindowStatus(startMillis) {
  const now = Date.now();
  const windowStart = startMillis - LEAD_MINUTES * 60 * 1000;
  const windowEnd = startMillis + CONSULTATION_MINUTES * 60 * 1000;
  if (now < windowStart) return "too-early";
  if (now >= windowEnd) return "ended";
  return "active";
}

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
  const [windowStatus, setWindowStatus] = useState(null); // "too-early" | "active" | "ended" | null (chat mode / not yet known)

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

  function renderWindowMessage(status) {
    if (status === "too-early" && appointment?.startTime) {
      return (
        <div className="card">
          <p className="cardTitle" style={{ marginBottom: 6 }}>
            Not quite time yet
          </p>
          <p style={{ margin: 0, color: "var(--ink-soft)" }}>
            This consultation is scheduled for{" "}
            {appointment.startTime.toDate().toLocaleString([], {
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            . You can join up to {LEAD_MINUTES} minutes early.
          </p>
        </div>
      );
    }
    if (status === "ended") {
      return (
        <div className="card">
          <p className="cardTitle" style={{ marginBottom: 6 }}>
            This consultation window has ended
          </p>
          <p style={{ margin: 0, color: "var(--ink-soft)" }}>
            The {CONSULTATION_MINUTES}-minute window for this appointment is
            over.
          </p>
        </div>
      );
    }
    return null;
  }

  // Schedules exactly one timeout to the next real transition
  // (too-early -> active, or active -> ended) rather than polling, and
  // reschedules itself each time it fires. Applies to every mode,
  // including chat — see the file-level comment above.
  useEffect(() => {
    if (!appointment?.startTime) return;

    const startMillis = appointment.startTime.toMillis();
    const windowStart = startMillis - LEAD_MINUTES * 60 * 1000;
    const windowEnd = startMillis + CONSULTATION_MINUTES * 60 * 1000;

    let timeoutId = null;

    function tick() {
      const status = computeWindowStatus(startMillis);
      setWindowStatus(status);

      const now = Date.now();
      let delay = null;
      if (status === "too-early") delay = windowStart - now;
      else if (status === "active") delay = windowEnd - now;

      if (delay !== null) {
        timeoutId = setTimeout(tick, Math.max(delay, 0) + 250);
      }
    }

    tick();
    return () => clearTimeout(timeoutId);
  }, [appointment, mode]);

  useEffect(() => {
    if (!appointment || !containerRef.current || mode === "chat") return;
    if (windowStatus !== "active") return;

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
  }, [appointment, mode, windowStatus]);

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
        {windowStatus === "active" ? (
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
            <div
              style={{
                flex: mode === "chat" ? "1 1 100%" : "1 1 300px",
                minWidth: 280,
                maxWidth: mode === "chat" ? 560 : undefined,
              }}
            >
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
        ) : (
          renderWindowMessage(windowStatus)
        )}

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
