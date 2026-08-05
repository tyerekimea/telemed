"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// Returns { profile, loadingProfile }. profile is null until loaded, then
// either the users/{uid} doc's data or null if it somehow doesn't exist.
// profile.profileComplete is what gates access to booking — see
// app/patient/profile/page.js and README.
export function usePatientProfile(user) {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoadingProfile(false);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (cancelled) return;
      setProfile(snap.exists() ? snap.data() : null);
      setLoadingProfile(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { profile, loadingProfile };
}
