import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ANDKO PM Dashboard",
  description: "Planning and reporting from ClickUp",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
