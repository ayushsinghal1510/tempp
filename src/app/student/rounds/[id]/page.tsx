import { redirect } from "next/navigation";

// Temporarily disabled — practice-only mode. Bounces to /practice, which
// bounces unauthenticated visitors on to /practice/login itself.
export default function DisabledPage() {
  redirect("/practice");
}

// ---- practice-only mode: original implementation commented out below ----
// import Link from "next/link";
// import { notFound } from "next/navigation";
// import { requireUser } from "@/lib/auth/session";
// import DashboardShell from "@/components/dashboard/DashboardShell";
// import SkillRadar from "@/components/charts/bklit/SkillRadar";
// import CoachingAnalytics from "@/components/prepai/CoachingAnalytics";
// import { STUDENT_NAV } from "@/lib/nav";
// import { getStudentRoundDetail } from "@/lib/queries/student-detail";
// import { buildRoundAnalytics } from "@/lib/coaching-analytics";
//
// export const dynamic = "force-dynamic";
//
// export default async function RoundDetail({
//   params,
// }: {
//   params: Promise<{ id: string }>;
// }) {
//   const { id } = await params;
//   const user = await requireUser(["student"]);
//   const detail = await getStudentRoundDetail(user.id, id);
//   if (!detail) notFound();
//
//   const isCoaching = detail.type === "coaching";
//   const kindLabel = isCoaching ? "Coaching round" : "Test round";
//
//   // The per-interview skill graph, synced to the recording. Coaching rounds carry
//   // the agent's intervention kinks; test rounds (proctored) carry none.
//   const replay = buildRoundAnalytics({
//     roundId: id,
//     company: detail.company,
//     kind: isCoaching ? "coaching" : "test",
//     videoUrl: detail.recordingUrl,
//   });
//
//   return (
//     <DashboardShell
//       user={user}
//       nav={STUDENT_NAV}
//       title={`${detail.company} · ${kindLabel} ${detail.sessionNumber}`}
//       org={isCoaching ? "Private to you" : "Test round"}
//       showPrivacyNote
//     >
//       <div className="space-y-6">
//         <div className="flex flex-wrap items-center justify-between gap-3">
//           <Link
//             href={`/student/companies/${detail.cohortId}`}
//             className="text-sm text-muted hover:text-ink"
//           >
//             ← {detail.company} prep
//           </Link>
//           {detail.overallScore != null && (
//             <div className="text-right">
//               <div className="text-xs text-muted">Round score</div>
//               <div className="text-2xl font-bold tabular-nums text-brand">
//                 {detail.overallScore.toFixed(1)}
//                 <span className="text-base font-medium text-muted">/10</span>
//               </div>
//             </div>
//           )}
//         </div>
//
//         {/* Recording + the 5-skill graph, synced to the video */}
//         <section className="card p-6">
//           <h3 className="font-semibold text-ink">
//             {isCoaching ? "Coaching replay" : "Test replay"}
//           </h3>
//           <p className="mt-0.5 text-xs text-muted">
//             {isCoaching
//               ? "Your five skills across the 20-minute session (0–3). Markers show where the coach stepped in — hover one to see what changed. Private to you."
//               : "Your five skills across the 20-minute proctored test (0–3). No coaching here — the score is your own. Private to you."}
//           </p>
//           <div className="mt-4">
//             <CoachingAnalytics replay={replay} />
//           </div>
//         </section>
//
//         {/* Radar vs previous round */}
//         {detail.radar && (
//           <section className="card p-6">
//             <h3 className="font-semibold text-ink">Versus your last round</h3>
//             <p className="mt-0.5 text-xs text-muted">
//               Where you moved since the previous completed round.
//             </p>
//             <div className="mt-4 max-w-xl">
//               <SkillRadar
//                 baseline={detail.radar.baseline}
//                 latest={detail.radar.latest}
//                 baselineLabel="Previous"
//                 latestLabel="This round"
//               />
//             </div>
//           </section>
//         )}
//
//         {/* Feedback */}
//         {detail.feedback && (
//           <section className="card p-6">
//             <h3 className="font-semibold text-ink">Round feedback</h3>
//             {detail.feedback.summaryMd && (
//               <p className="mt-2 max-w-2xl text-sm text-ink">{detail.feedback.summaryMd}</p>
//             )}
//             <div className="mt-4 grid gap-6 sm:grid-cols-2">
//               <div>
//                 <div className="text-xs font-medium uppercase tracking-wide text-success">
//                   Went well
//                 </div>
//                 <ul className="mt-2 space-y-1.5 text-sm text-ink">
//                   {detail.feedback.whatWentWell.map((w, i) => (
//                     <li key={i} className="flex gap-2">
//                       <span className="text-success">✓</span>
//                       {w}
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//               <div>
//                 <div className="text-xs font-medium uppercase tracking-wide text-warning">
//                   To fix
//                 </div>
//                 <ul className="mt-2 space-y-1.5 text-sm text-ink">
//                   {detail.feedback.areasToImprove.map((w, i) => (
//                     <li key={i} className="flex gap-2">
//                       <span className="text-warning">→</span>
//                       {w}
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             </div>
//           </section>
//         )}
//
//         {/* Transcript with running score */}
//         {detail.turns.length > 0 && (
//           <section className="card p-6">
//             <h3 className="font-semibold text-ink">Transcript</h3>
//             <p className="mt-0.5 text-xs text-muted">
//               Your running score was captured live and shown here after the round.
//             </p>
//             <div className="mt-4 space-y-3">
//               {detail.turns.map((t) => (
//                 <div key={t.id} className="flex gap-3">
//                   <span
//                     className={`mt-0.5 w-16 shrink-0 text-xs font-medium uppercase tracking-wide ${
//                       t.speaker === "agent" ? "text-muted" : "text-brand"
//                     }`}
//                   >
//                     {t.speaker === "agent" ? "Coach" : "You"}
//                   </span>
//                   <p className="flex-1 text-sm text-ink">{t.transcript}</p>
//                   {t.runningScore != null && (
//                     <span className="shrink-0 text-xs tabular-nums text-muted">
//                       {t.runningScore.toFixed(1)}
//                       {t.delta != null && (
//                         <span className={t.delta >= 0 ? "text-success" : "text-danger"}>
//                           {" "}
//                           {t.delta >= 0 ? "+" : ""}
//                           {t.delta.toFixed(1)}
//                         </span>
//                       )}
//                     </span>
//                   )}
//                 </div>
//               ))}
//             </div>
//           </section>
//         )}
//       </div>
//     </DashboardShell>
//   );
// }
//
