import Link from "next/link";
import styles from "./page.module.css";
export const metadata = {
  title: "MedAxis Wellness — See a doctor without the road, the queue, or the wait",
  description:
    "Book verified doctors for video, voice, or chat consultations. Share photos and lab results, get prescriptions and investigation requests you can print.",
};

export default function Home() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.wordmark}>MedAxis Wellness</span>
        <Link href="/login" className={styles.headerLink}>
          Log in
        </Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Consultations by video · voice · chat</p>
          <h1 className={styles.headline}>
            See a doctor without the road,
            <br />
            the queue, or the <em>wait</em>.
          </h1>
          <p className={styles.subhead}>
            Browse verified doctors, book a slot that suits you, and consult from
            wherever you are. Share photos or lab results securely, and walk away
            with a prescription you can print.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/login" className={styles.primaryCta}>
              Find a doctor
            </Link>
            <Link href="/login" className={styles.secondaryCta}>
              I'm a doctor — join MedAxis Wellness
            </Link>
          </div>
        </div>

        <div className={styles.heroArt} aria-hidden="true">
          <CallCard />
        </div>
      </section>

      <section className={styles.steps}>
        <p className={styles.sectionLabel}>How it works</p>
        <ol className={styles.stepList}>
          <li className={styles.step}>
            <span className={styles.stepMark}>Find</span>
            <h3>Find a doctor</h3>
            <p>Browse by specialty and see who's available, verified and approved.</p>
          </li>
          <li className={styles.step}>
            <span className={styles.stepMark}>Book</span>
            <h3>Book your slot</h3>
            <p>Pick a time that works for you — no calling around, no waiting room.</p>
          </li>
          <li className={styles.step}>
            <span className={styles.stepMark}>Consult</span>
            <h3>Video, voice, or chat</h3>
            <p>Talk it through, share a photo or lab result, get notes to keep.</p>
          </li>
        </ol>
      </section>

      <section className={styles.trustStrip}>
        <p>Admin-verified doctors</p>
        <span className={styles.dot} />
        <p>Secure file sharing</p>
        <span className={styles.dot} />
        <p>Printable prescriptions</p>
      </section>

      <footer className={styles.footer}>
        <span className={styles.wordmark}>MedAxis Wellness</span>
        <p>Built for Nigeria and West Africa.</p>
      </footer>
    </main>
  );
}

function CallCard() {
  return (
    <div className={styles.card}>
      <div className={styles.cardFrame}>
        <div className={styles.cardTop}>
          <span className={styles.livePill}>
            <span className={styles.liveDot} /> Live
          </span>
          <span className={styles.cardMode}>Video call</span>
        </div>

        <svg viewBox="0 0 260 140" className={styles.avatars} role="img" aria-label="A doctor and patient connected on a video call">
          <path
            d="M 70 70 Q 130 20 190 70"
            className={styles.connectLine}
            fill="none"
            strokeWidth="2"
            strokeDasharray="1 9"
            strokeLinecap="round"
          />
          <circle cx="70" cy="78" r="34" className={styles.avatarDoctor} />
          <circle cx="190" cy="78" r="34" className={styles.avatarPatient} />
          <text x="70" y="83" textAnchor="middle" className={styles.avatarLabel}>Dr</text>
          <text x="190" y="83" textAnchor="middle" className={styles.avatarLabel}>You</text>
        </svg>

        <div className={styles.ticket}>
          <span className={styles.ticketTime}>10:00 — Today</span>
          <span className={styles.ticketDoctor}>Dr. Adéyemi · General Practice</span>
        </div>
      </div>
    </div>
  );
}
