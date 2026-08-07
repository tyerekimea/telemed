"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

// Returns true/false once checked, null while still loading. Pass the
// current user from useAuth() — returns false immediately if there's no
// user yet, no separate loading state needed for that case.
export function useIsAdmin(user) {
  const [isAdmin, setIsAdmin] = useState(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, "admins", user.uid)).then((snap) => {
      if (!cancelled) setIsAdmin(snap.exists());
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return isAdmin;
}
