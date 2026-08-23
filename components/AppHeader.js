"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

// Shared top nav for every page except the landing page (which has its
// own header in app/page.js). Two ways back, matching how people expect
// web/app navigation to work:
//   - "Back" replays browser history (router.back()), or goes to
//     backHref if one's supplied — useful when a page can be reached by a
//     direct link with no real history behind it (e.g. /call?...).
//   - The wordmark always goes to "/", the marketing home page.
// `right` is an optional slot for page-specific actions (e.g. an Admin
// link, a "Past appointments" toggle) rendered on the right side.
export default function AppHeader({ backHref, right }) {
  const router = useRouter();

  function handleBack() {
    if (backHref) {
      router.push(backHref);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <header className="header">
      <div className="headerLeft">
        <button type="button" onClick={handleBack} className="backLink" aria-label="Go back">
          ← Back
        </button>
        <Link href="/" className="wordmark">
          MedAxis Wellness
        </Link>
      </div>
      {right && <div className="headerRight">{right}</div>}
    </header>
  );
}
