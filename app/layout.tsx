import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Geometric sans for the whole UI (the --font-geist-sans variable name is kept for the theme).
const sans = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Drifty",
  description:
    "Chat-first client rooms for agencies. AI turns client feedback into a confirmed change list, flags drift and records approvals.",
  applicationName: "Drifty",
  appleWebApp: { capable: true, title: "Drifty", statusBarStyle: "black-translucent" },
  openGraph: { title: "Drifty", description: "Stop chasing client feedback on WhatsApp.", images: ["/brand/drifty-logo.png"] },
};

export const viewport = { themeColor: "#0b0c0e", colorScheme: "dark" as const };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${sans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
