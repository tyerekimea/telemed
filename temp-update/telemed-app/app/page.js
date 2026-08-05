import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: 24, textAlign: "center" }}>
      <h1>Telemed</h1>
      <p>Book a doctor. Talk to them by video. Get a visit summary.</p>
      <Link href="/login">Get started</Link>
    </main>
  );
}
