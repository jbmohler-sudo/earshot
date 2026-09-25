import type { Metadata } from "next";
import { Chivo, Chivo_Mono, Silkscreen } from "next/font/google";
import "./globals.css";

const display = Silkscreen({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-display" });
const body = Chivo({ weight: ["400", "600", "700"], subsets: ["latin"], variable: "--font-body" });
const mono = Chivo_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Earshot",
  description: "A pixel-art music world. Your avatar stands at the venue of whatever you're playing, next to everyone else listening.",
  metadataBase: new URL("https://earshot.world"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
