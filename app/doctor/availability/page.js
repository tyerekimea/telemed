"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";
import { useUserProfile } from "../../../lib/useUserProfile";
import AppHeader from "../../../components/AppHeader";

const setDoctorAvailability = httpsCallable(
  functions,
  "setDoctorAvailability"
);

function formatDate(dateString) {
  if (!dateString) return "";

  return new Date(`${dateString}T00:00:00`).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export default function DoctorAvailability() {
  const { user, role, loading } = useAuth();
  const { profile, loadingProfile } = useUserProfile(user);
  const router = useRouter();

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    if (role && role !== "doctor") {
      router.push("/patient/dashboard");
    }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (loading || loadingProfile) return;

    if (
      user &&
      role === "doctor" &&
      profile &&
      !profile.profileComplete
    ) {
      router.push("/doctor/profile");
    }
  }, [
    user,
    role,
    profile,
    loading,
    loadingProfile,
    router,
  ]);

  function getTodayString() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  async function handleSaveAvailability(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!date) {
      setError("Please select a date.");
      return;
    }

    if (!startTime || !endTime) {
      setError("Please select both a start and end time.");
      return;
    }

    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      setError("End time must be later than start time.");
      return;
    }

    const duration = endMinutes - startMinutes;

    if (duration < 15) {
      setError(
        "Availability must be at least 15 minutes."
      );
      return;
    }

    if (startMinutes % 15 !== 0 || endMinutes % 15 !== 0) {
      setError(
        "Please use times in 15-minute increments."
      );
      return;
    }

    setSaving(true);

    try {
      const result = await setDoctorAvailability({
        date,
        startTime,
        endTime,
      });

      const data = result.data || {};

      setMessage(
        `Availability saved. ${data.created || 0} consultation slot${
          data.created === 1 ? "" : "s"
        } created.`
      );

      // Clear the form after successful submission.
      setDate("");
      setStartTime("09:00");
      setEndTime("12:00");
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "Couldn't save your availability. Please try again."
      );
    } finally {
      setSaving(false);
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
            Your account is pending verification. You'll be able to add
            availability once an admin approves your account.
          </p>
        </div>
      </main>
    );
  }

  const today = getTodayString();

  return (
    <main className="shell">
      <AppHeader
        backHref="/doctor/dashboard"
        right={
          <button onClick={() => router.push("/doctor/dashboard")} className="btnSecondary">
            Dashboard
          </button>
        }
      />
      <div className="container">
        <p className="eyebrow">Doctor dashboard</p>
        <h1 className="pageTitle">My availability</h1>
        <p className="pageSubtext">
          Tell patients when you're available for consultations.
        </p>

        <section className="card" style={{ padding: 24, marginBottom: 20 }}>
          <p className="cardTitle" style={{ fontSize: 18, marginBottom: 4 }}>
            Add availability
          </p>
          <p className="cardMeta" style={{ marginBottom: 18 }}>
            Each consultation is 15 minutes, with a 10-minute break built in
            afterward. You can add different
            availability periods for different days.
          </p>

          <form onSubmit={handleSaveAvailability}>
            <div className="field">
              <label htmlFor="availability-date" className="label">
                Date
              </label>
              <input
                id="availability-date"
                type="date"
                min={today}
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="input"
                style={{ maxWidth: 320 }}
              />
              {date && (
                <p style={{ marginTop: 8, color: "var(--ink-soft)", fontSize: 14 }}>
                  {formatDate(date)}
                </p>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
                marginBottom: 20,
              }}
            >
              <div>
                <label htmlFor="start-time" className="label">
                  Available from
                </label>
                <input
                  id="start-time"
                  type="time"
                  step="900"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="input"
                />
              </div>

              <div>
                <label htmlFor="end-time" className="label">
                  Available until
                </label>
                <input
                  id="end-time"
                  type="time"
                  step="900"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="input"
                />
              </div>
            </div>

            {message && <p className="successBox">{message}</p>}
            {error && <p className="errorBox">{error}</p>}

            <button type="submit" disabled={saving} className="btnPrimary">
              {saving ? "Saving..." : "Save availability"}
            </button>
          </form>
        </section>

        <section className="card" style={{ padding: 24 }}>
          <p className="cardTitle" style={{ fontSize: 18, marginBottom: 10 }}>
            How your availability works
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, color: "var(--ink-soft)", fontSize: 15, lineHeight: 1.7 }}>
            <li>You choose the exact dates and times you are available.</li>
            <li>The system divides your availability into 15-minute consultation slots, with a 10-minute break automatically added after each one.</li>
            <li>You can have availability on completely different days and times.</li>
            <li>Patients only see available, unbooked slots.</li>
            <li>A booked slot cannot be overwritten by another availability submission.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
