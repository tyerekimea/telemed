"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../lib/useAuth";

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

  async function handleApprove(doctorUserId) {
    setApprovingId(doctorUserId);
    try {
      await updateDoc(doc(db, "users", doctorUserId), { verified: true });
      setPendingDoctors((prev) => prev.filter((d) => d.id !== doctorUserId));
    } catch (err) {
      console.error(err);
      alert("Couldn't approve this doctor. Please try again.");
    } finally {
      setApprovingId(null);
    }
  }

  if (loading || checkingAdmin) {
    return <main style={{ padding: 24 }}>Loading...</main>;
  }

  if (!isAdmin) {
    return (
      <main style={{ padding: 24 }}>
        <p>You don't have access to this page.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Pending doctor approvals</h1>
      {loadError && <p style={{ color: "red" }}>{loadError}</p>}
      {loadingDoctors && <p>Loading...</p>}
      {!loadingDoctors && !loadError && pendingDoctors.length === 0 && (
        <p>No doctors waiting for approval.</p>
      )}
      {pendingDoctors.map((doctor) => (
        <div
          key={doctor.id}
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12 }}
        >
          <p style={{ margin: "0 0 4px" }}>
            <strong>{doctor.email || "(no email on file)"}</strong>
          </p>
          <p style={{ margin: "0 0 8px", color: "#666", fontSize: 14 }}>
            uid: {doctor.id}
          </p>
          <button onClick={() => handleApprove(doctor.id)} disabled={approvingId === doctor.id}>
            {approvingId === doctor.id ? "Approving..." : "Approve"}
          </button>
        </div>
      ))}
      <p style={{ marginTop: 24, color: "#666", fontSize: 14 }}>
        Note: approving here only unlocks their dashboard. To make them bookable by
        patients, you still need to add a matching entry in the "doctors" collection
        using this same uid as the Document ID — see README.
      </p>
    </main>
  );
}
