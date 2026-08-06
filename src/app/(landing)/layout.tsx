import { Instrument_Sans, Instrument_Serif, IBM_Plex_Mono } from "next/font/google";
import "./landing.css";

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`landing ${instrumentSans.variable} ${instrumentSerif.variable} ${plexMono.variable}`}
    >
      {children}
    </div>
  );
}
