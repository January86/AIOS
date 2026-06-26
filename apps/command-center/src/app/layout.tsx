import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIOS Command Center",
  description: "AIOS Autonomous AI Operating System",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body style={{ background: "#0a0a0f", color: "#e2e2f0", minHeight: "100vh" }}>
        {children}
      </body>
    </html>
  );
}
