"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";
import AppHeader from "../../components/AppHeader";

// Access to this page is gated by the "admins" collection in Firestore —
// see README for how to add yourself as the one admin account. This is
// separate from the "role" field on users (patient/doctor); being an
// admin isn't a role a user signs up for.

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [approvingId, setApprovingId] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    getDoc(doc(db, "admins", user.uid)).then((snap) => {
      setIsAdmin(snap.exists());
      setCheckingAdmin(false);
    });
  }, [user, loading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    async function loadPending() {
      try {
        const q = query(
          collection(db, "users"),
          where("role", "==", "doctor"),
          where("verified", "==", false)
        );
        const snapshot = await getDocs(q);
        setPendingDoctors(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
        setLoadError("Couldn't load pending doctors. Please try again.");
      } finally {
        setLoadingDoctors(false);
      }
    }
    loadPending();
  }, [isAdmin]);

  async function handleApprove(doctorUser) {
    setApprovingId(doctorUser.id);
    try {
      await updateDoc(doc(db, "users", doctorUser.id), { verified: true });

      // Also create their public doctors entry, using their own uid as the
      // document ID — same convention as the old manual approach, just
      // automated now. Only do this if they've filled in their profile;
      // otherwise there's no name/specialty to show patients yet.
      if (doctorUser.firstName && doctorUser.lastName && doctorUser.specialty) {
        await setDoc(
          doc(db, "doctors", doctorUser.id),
          {
            name: `${doctorUser.firstName} ${doctorUser.lastName}`,
            specialty: doctorUser.specialty,
            verified: true,
          },
          { merge: true }
        );
      }

      setPendingDoctors((prev) => prev.filter((d) => d.id !== doctorUser.id));
    } catch (err) {
      console.error(err);
      alert("Couldn't approve this doctor. Please try again.");
    } finally {
      setApprovingId(null);
    }
  }

  if (loading || checkingAdmin) {
    return <main className="loadingShell">Loading...</main>;
  }

  if (!isAdmin) {
    return (
      <main className="shell">
        <AppHeader backHref="/" />
        <div className="container">
          <p className="emptyState">You don't have access to this page.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <AppHeader backHref="/" />
      <div className="container">
        <p className="eyebrow">Admin</p>
        <h1 className="pageTitle" style={{ marginBottom: 24 }}>
          Pending doctor approvals
        </h1>
        {loadError && <p className="errorBox">{loadError}</p>}
        {loadingDoctors && <p className="emptyState">Loading...</p>}
        {!loadingDoctors && !loadError && pendingDoctors.length === 0 && (
          <p className="emptyState">No doctors waiting for approval.</p>
        )}
        {pendingDoctors.map((doctor) => {
          const profileComplete = doctor.firstName && doctor.lastName && doctor.specialty;
          return (
            <div key={doctor.id} className="card">
              <p className="cardTitle">
                {profileComplete
                  ? `Dr. ${doctor.firstName} ${doctor.lastName}`
                  : doctor.email || "(no email on file)"}
              </p>
              {profileComplete && <p className="cardMeta">{doctor.specialty}</p>}
              {!profileComplete && (
                <p style={{ margin: "0 0 6px", color: "var(--amber-deep)", fontSize: 14 }}>
                  Hasn't completed their profile yet — approving unlocks their dashboard,
                  but they won't appear to patients until they do.
                </p>
              )}
              <p style={{ margin: "0 0 14px", color: "var(--ink-faint)", fontSize: 13 }}>
                uid: {doctor.id}
              </p>
              <button
                onClick={() => handleApprove(doctor)}
                disabled={approvingId === doctor.id}
                className="btnPrimary"
              >
                {approvingId === doctor.id ? "Approving..." : "Approve"}
              </button>
            </div>
          );
        })}
        <p style={{ marginTop: 24, color: "var(--ink-soft)", fontSize: 14 }}>
          Approving a doctor with a completed profile automatically creates their
          public listing — no manual Firestore step needed anymore.
        </p>
      </div>
    </main>
  );
}
