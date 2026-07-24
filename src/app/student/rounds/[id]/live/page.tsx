import { redirect } from "next/navigation";

// Temporarily disabled — practice-only mode. Bounces to /practice, which
// bounces unauthenticated visitors on to /practice/login itself.
export default function DisabledPage() {
  redirect("/practice");
}

// ---- practice-only mode: original implementation commented out below ----
// import { notFound } from "next/navigation";
// import { requireUser } from "@/lib/auth/session";
// import InterviewRoom from "@/components/interview/InterviewRoom";
// import { buildCompanyContext } from "@/lib/voice/companyContext";
// import { tierProfile } from "@/lib/research/tierProfiles";
// import type { CompanyResearch } from "@/lib/research/companyResearch";
// import { prisma } from "@/lib/db";
//
// export const dynamic = "force-dynamic";
//
// export default async function InterviewLivePage({
//   params,
// }: {
//   params: Promise<{ id: string }>;
// }) {
//   const { id } = await params;
//   const user = await requireUser(["student"]);
//
//   const round = await prisma.round.findUnique({
//     where: { id },
//     include: {
//       session: {
//         include: {
//           student: true,
//           cohort: { include: { vacancies: true } },
//         },
//       },
//     },
//   });
//
//   // Only the owning student can take their own interview.
//   if (!round || round.session.student.userId !== user.id) notFound();
//   if (round.status === "completed") {
//     // Already done → send them to the analytics, not back into the room.
//     notFound();
//   }
//
//   const cohort = round.session.cohort;
//   const vacancy = cohort.vacancies[0];
//   const kindLabel =
//     round.type === "coaching"
//       ? `Coaching round ${round.roundNumber}`
//       : `Test round ${round.roundNumber}`;
//
//   const research = (cohort.companyResearch as CompanyResearch | null) ?? null;
//   const profile = tierProfile(vacancy?.tier);
//
//   const company = buildCompanyContext({
//     companyName: cohort.companyName,
//     candidateName: round.session.student.name,
//     jobTitle: vacancy?.jobTitle,
//     jobDescription: vacancy?.jobDescription,
//     tier: vacancy?.tier ?? null,
//     salaryLpa: vacancy?.salaryLpa ?? null,
//     skillPriorities: Array.isArray(vacancy?.skillPriorities)
//       ? (vacancy?.skillPriorities as string[])
//       : [],
//     research: research
//       ? {
//           about: research.about,
//           domain: research.domain,
//           interviewStyle: research.interviewStyle,
//           signatureTopics: research.signatureTopics,
//           sampleQuestions: research.sampleQuestions,
//           values: research.values,
//         }
//       : null,
//     tierProfile: profile
//       ? {
//           bar: profile.bar,
//           interviewerStyle: profile.interviewerStyle,
//           questionFlow: profile.questionFlow,
//           studentExpectations: profile.studentExpectations,
//           coachingObjective: profile.coachingObjective,
//           testingObjective: profile.testingObjective,
//         }
//       : null,
//     roundKind: round.type === "test" ? "test" : "coaching",
//   });
//
//   return (
//     <InterviewRoom
//       roundId={round.id}
//       candidateName={round.session.student.name}
//       company={company}
//       kindLabel={kindLabel}
//       backHref="/student"
//     />
//   );
// }
//
