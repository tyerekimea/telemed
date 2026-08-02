"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";

// MVP note: roomUrl is hardcoded per doctor for now (see doctors collection
// docs — add a `roomUrl` field, e.g. https://your-domain.daily.co/dr-amara).
// Every appointment with that doctor uses the same room. This is fine for
// a first version since only one appointment happens at a time per doctor,
// but the room link never expires or rotates. Generating a unique room per
// appointment is the real version — that needs a serverless function (see
// README) because creating rooms requires a secret Daily.co API key that
// can't live in this app.
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
// Chat: Daily's prebuilt call UI includes an in-call chat panel by default —
// nothing to build here, just make sure "Chat" is left enabled in the room's
// settings in the Daily.co dashboard (it is by default).
//
// Voice vs video: both use the exact same Daily room and call frame — the
// only difference is whether the camera starts on or off, controlled by
// ?mode=voice in the URL. Either party can still toggle their own camera
// during the call regardless of which button they joined from.

function CallPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");
  const mode = searchParams.get("mode") === "voice" ? "voice" : "video";
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
      const doctorSnap = await getDoc(doc(db, "doctors", appt.doctorId));
      const roomUrl = doctorSnap.exists() ? doctorSnap.data().roomUrl : null;
      if (!roomUrl) {
        setError("This doctor doesn't have a video room set up yet.");
        return;
      }
      setAppointment({ ...appt, roomUrl });
    }
    loadAppointment();
  }, [user, appointmentId]);

  useEffect(() => {
    if (!appointment || !containerRef.current) return;

    let cancelled = false;
    import("@daily-co/daily-js").then(({ default: DailyIframe }) => {
      if (cancelled) return;
      const frame = DailyIframe.createFrame(containerRef.current, {
        showLeaveButton: true,
        iframeStyle: { width: "100%", height: "500px", border: "0" },
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
    return <main style={{ padding: 24 }}>Loading...</main>;
  }

  if (!appointmentId) {
    return <main style={{ padding: 24 }}>No appointment specified.</main>;
  }

  if (error) {
    return (
      <main style={{ padding: 24 }}>
        <p>{error}</p>
        <button onClick={() => router.back()}>Go back</button>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>{mode === "voice" ? "Voice call" : "Video call"}</h1>
      <div ref={containerRef} />
    </main>
  );
}

export default function CallPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Loading...</main>}>
      <CallPageInner />
    </Suspense>
  );
}

