import type { Metadata } from "next";
import { cookies } from "next/headers";
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
  title: "Voxio.Prep — practise the conversation, scored",
  description:
    "A live voice-and-video session with an AI that asks real questions, coaches at the right moments, and scores every turn against a rubric. Your educator reads the same session afterwards.",
  icons: { icon: "/favicon.svg" },
};

export default async function LandingPage() {
  // A signed-in visitor still gets the marketing page; the nav's Login CTA
  // becomes a link into whichever dashboard their role owns.
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;

  return (
    <>
      <Nav dashboardHref={user ? homePathForRole(user.role) : null} />
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
