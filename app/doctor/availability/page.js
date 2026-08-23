"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../lib/firebase";
import { useAuth } from "../../../lib/useAuth";
import { useUserProfile } from "../../../lib/useUserProfile";

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
    return (
      <main style={{ padding: 24 }}>
        Loading...
      </main>
    );
  }

  if (profile?.verified === false) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Almost there</h1>
        <p>
          Your account is pending verification. You'll be able
          to add availability once an admin approves your
          account.
        </p>
      </main>
    );
  }

  const today = getTodayString();

  return (
    <main
      style={{
        maxWidth: 700,
        margin: "0 auto",
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>
            My availability
          </h1>

          <p style={{ color: "#666", marginTop: 8 }}>
            Tell patients when you're available for
            consultations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/doctor/dashboard")}
        >
          Dashboard
        </button>
      </div>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          Add availability
        </h2>

        <p style={{ color: "#666" }}>
          Each consultation is 15 minutes. You can add
          different availability periods for different days.
        </p>

        <form onSubmit={handleSaveAvailability}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="availability-date"
              style={{
                display: "block",
                marginBottom: 6,
                fontWeight: 600,
              }}
            >
              Date
            </label>

            <input
              id="availability-date"
              type="date"
              min={today}
              value={date}
              onChange={(event) =>
                setDate(event.target.value)
              }
              style={{
                padding: 10,
                width: "100%",
                maxWidth: 320,
                boxSizing: "border-box",
              }}
            />

            {date && (
              <p
                style={{
                  marginTop: 6,
                  color: "#666",
                }}
              >
                {formatDate(date)}
              </p>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <label
                htmlFor="start-time"
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                Available from
              </label>

              <input
                id="start-time"
                type="time"
                step="900"
                value={startTime}
                onChange={(event) =>
                  setStartTime(event.target.value)
                }
                style={{
                  padding: 10,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="end-time"
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                Available until
              </label>

              <input
                id="end-time"
                type="time"
                step="900"
                value={endTime}
                onChange={(event) =>
                  setEndTime(event.target.value)
                }
                style={{
                  padding: 10,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {message && (
            <p
              style={{
                color: "green",
                background: "#eef9f0",
                padding: 12,
                borderRadius: 8,
              }}
            >
              {message}
            </p>
          )}

          {error && (
            <p
              style={{
                color: "#b00020",
                background: "#fff0f0",
                padding: 12,
                borderRadius: 8,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "11px 18px",
              cursor: saving
                ? "not-allowed"
                : "pointer",
            }}
          >
            {saving
              ? "Saving..."
              : "Save availability"}
          </button>
        </form>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          How your availability works
        </h2>

        <ul>
          <li>
            You choose the exact dates and times you are
            available.
          </li>
          <li>
            The system divides your availability into
            15-minute consultation slots.
          </li>
          <li>
            You can have availability on completely
            different days and times.
          </li>
          <li>
            Patients only see available, unbooked slots.
          </li>
          <li>
            A booked slot cannot be overwritten by another
            availability submission.
          </li>
        </ul>
      </section>
    </main>
  );
}
