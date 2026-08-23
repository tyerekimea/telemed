import "./globals.css";

export const metadata = {
  title: "MedAxis Wellness",
  description: "Book and video-call a doctor",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
