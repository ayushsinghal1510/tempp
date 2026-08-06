import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/jwt";
import { homePathForRole } from "@/lib/auth/session";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Session from "./components/Session";
import Audiences from "./components/Audiences";
import Scoring from "./components/Scoring";
import Vision from "./components/Vision";
import Rhythm from "./components/Rhythm";
import Cta from "./components/Cta";
import Footer from "./components/Footer";

export const metadata: Metadata = {
  title: "PrepAI — Practise the conversation, scored",
  description:
    "A live voice-and-video session with an AI that asks real questions, coaches at the right moments, and scores every turn against a rubric.",
  icons: { icon: "/favicon.svg" },
};

export default async function LandingPage() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const user = await verifySessionToken(token);
    if (user) redirect(homePathForRole(user.role));
  }

  return (
    <>
      <Nav />
      <main>
        <div className="shell">
          <Hero />
        </div>
        <Vision />
        <Session />
        <Audiences />
        <Scoring />
        <Rhythm />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
