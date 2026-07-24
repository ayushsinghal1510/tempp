import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { tierProfile } from "@/lib/research/tierProfiles";
import type { CompanyResearch } from "@/lib/research/companyResearch";
import {
  academicTierForCgpa,
  expectationRow,
  DEGREE_LABEL,
  ACADEMIC_TIER_LABEL,
} from "@/lib/research/expectationMatrix";
import CompanyResearchPanel from "@/components/practice/CompanyResearchPanel";
import FocusTable from "@/components/practice/FocusTable";

export const dynamic = "force-dynamic";

// The pre-interview briefing for a self-created "drive" — mirrors
// src/app/student/rounds/[id]/brief/page.tsx's 2-column layout (company
// research left, hardcoded tier brief right) but trimmed to what a
// PracticeRound actually has, plus a new personalized section built from the
// degree/academic-tier expectation matrix.
export default async function PracticeBriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sessionUser = await requireUser(["practice"], "/practice/login");

  const round = await prisma.practiceRound.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!round || round.userId !== sessionUser.id) notFound();
  if (round.status === "completed") notFound();
  // Legacy general rounds (predating PracticeCompany) have no brief — go
  // straight to the live page, unchanged.
  if (!round.companyId && !round.companyName) {
    redirect(`/practice/rounds/${round.id}/live`);
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { course: true, cgpa: true },
  });

  const companyName = round.company?.companyName ?? round.companyName!;
  const jobTitle = round.company?.jobTitle ?? round.jobTitle;
  const tier = round.company?.tier ?? round.tier;
  const research =
    ((round.company?.companyResearch ??
      round.companyResearch) as CompanyResearch | null) ?? null;
  const profile = tierProfile(tier);

  // Course/CGPA are optional at signup — default to B.Tech Tier 1 so this
  // section always has something to show instead of blocking on profile data.
  const usedDefaultProfile = user?.course == null || user?.cgpa == null;
  const effectiveCourse = user?.course ?? "btech";
  const effectiveAcademicTier =
    user?.cgpa != null ? academicTierForCgpa(user.cgpa) : "tier_1";
  const focus = expectationRow(effectiveCourse, effectiveAcademicTier);

  return (
    <main className="min-h-screen bg-canvas px-6 py-10 text-ink">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <Link
          href={round.companyId ? `/practice/companies/${round.companyId}` : "/practice"}
          className="text-sm text-muted hover:text-ink"
        >
          ← Back
        </Link>

        <section className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-ink">{companyName}</h1>
              {jobTitle && (
                <p className="mt-0.5 text-sm text-muted">{jobTitle}</p>
              )}
            </div>
            {profile && (
              <span className="rounded-lg border border-line px-3 py-1 text-xs font-semibold text-muted">
                {profile.label} · {profile.salaryBand}
              </span>
            )}
          </div>
          {research?.about && (
            <p className="mt-3 text-sm text-ink">{research.about}</p>
          )}
          {research?.domain && (
            <p className="mt-1 text-xs text-muted">{research.domain}</p>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          {/* ── LEFT: what THIS company asks (research) ── */}
          <div className="space-y-6">
            <CompanyResearchPanel research={research} companyName={companyName} />

            {/* Personalized focus, from the degree/academic-tier matrix */}
            <section className="card p-6">
              <h3 className="font-semibold text-ink">
                What we&apos;ll focus on for you
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                {DEGREE_LABEL[effectiveCourse]} ·{" "}
                {ACADEMIC_TIER_LABEL[effectiveAcademicTier]}
                {usedDefaultProfile && (
                  <>
                    {" "}
                    — default, add your course &amp; CGPA to{" "}
                    <Link
                      href="/practice/signup"
                      className="text-brand hover:underline"
                    >
                      personalize this
                    </Link>
                  </>
                )}
              </p>
              <div className="mt-4">
                <FocusTable focus={focus} />
              </div>
            </section>
          </div>

          {/* ── RIGHT: the company-tier brief (hardcoded, done once) ── */}
          {profile && (
            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <section className="card p-6">
                <div className="text-xs font-medium uppercase tracking-wide text-faint">
                  {profile.label} · {profile.salaryBand}
                </div>
                <h3 className="mt-1 font-semibold text-ink">
                  What this tier expects
                </h3>
                <p className="mt-1 text-sm text-muted">{profile.bar}</p>
                <ul className="mt-4 space-y-1.5 text-sm text-ink">
                  {profile.studentExpectations.map((e, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-brand">•</span>
                      {e}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="card p-6">
                <h3 className="font-semibold text-ink">
                  How your interviewer will talk
                </h3>
                <p className="mt-1 text-sm text-muted">
                  {profile.interviewerStyle}
                </p>
              </section>

              <section className="card p-6">
                <h3 className="font-semibold text-ink">How the round flows</h3>
                <ol className="mt-3 space-y-2 text-sm text-ink">
                  {profile.questionFlow.map((q, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-canvas text-xs font-semibold text-muted">
                        {i + 1}
                      </span>
                      {q}
                    </li>
                  ))}
                </ol>
              </section>
            </aside>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/practice/rounds/${round.id}/live`}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
          >
            Begin interview →
          </Link>
          <Link
            href={round.companyId ? `/practice/companies/${round.companyId}` : "/practice"}
            className="text-sm text-muted hover:text-ink"
          >
            Not yet
          </Link>
        </div>
      </div>
    </main>
  );
}
