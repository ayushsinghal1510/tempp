import { redirect } from "next/navigation";

// Temporarily disabled — practice-only mode. Bounces to /practice, which
// bounces unauthenticated visitors on to /practice/login itself.
export default function DisabledPage() {
  redirect("/practice");
}

// ---- practice-only mode: original implementation commented out below ----
// import Link from "next/link";
// import { requireUser } from "@/lib/auth/session";
// import DashboardShell from "@/components/dashboard/DashboardShell";
// import { ADMIN_NAV } from "@/lib/nav";
// import { prisma } from "@/lib/db";
//
// export const dynamic = "force-dynamic";
//
// const TIER_LABEL: Record<string, string> = {
//   tier_1: "Tier 1",
//   tier_2: "Tier 2",
//   tier_3: "Tier 3",
// };
//
// export default async function CohortsPage() {
//   const user = await requireUser(["admin"]);
//
//   const cohorts = user.universityId
//     ? await prisma.cohort.findMany({
//         where: { universityId: user.universityId },
//         orderBy: { createdAt: "desc" },
//         include: {
//           vacancies: true,
//           _count: { select: { cohortStudents: true } },
//         },
//       })
//     : [];
//
//   return (
//     <DashboardShell user={user} nav={ADMIN_NAV} title="Cohorts">
//       <div className="space-y-6">
//         <div className="flex items-start justify-between gap-4">
//           <p className="text-sm text-muted">
//             One cohort per company drive. Starting a cohort enrolls students and
//             creates their interview rounds.
//           </p>
//           <Link
//             href="/admin/cohorts/new"
//             className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
//           >
//             + Start a cohort
//           </Link>
//         </div>
//
//         {cohorts.length === 0 ? (
//           <div className="card p-10 text-center text-muted">
//             No cohorts yet — start your first one.
//           </div>
//         ) : (
//           <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
//             {cohorts.map((c) => {
//               const v = c.vacancies[0];
//               return (
//                 <Link
//                   key={c.id}
//                   href={`/admin/cohorts/${c.id}`}
//                   className="card p-6 transition hover:border-brand/40"
//                 >
//                   <div className="flex items-center justify-between">
//                     <div className="text-lg font-semibold text-ink">
//                       {c.companyName}
//                     </div>
//                     <span className="rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium capitalize text-success">
//                       {c.status}
//                     </span>
//                   </div>
//                   {v && (
//                     <div className="mt-1 text-sm text-muted">
//                       {v.jobTitle}
//                       {v.tier ? ` · ${TIER_LABEL[v.tier]}` : ""}
//                       {v.salaryLpa != null ? ` · ${v.salaryLpa} LPA` : ""}
//                     </div>
//                   )}
//                   <div className="mt-4 flex items-baseline gap-1">
//                     <span className="text-3xl font-bold tabular-nums text-brand">
//                       {c._count.cohortStudents}
//                     </span>
//                     <span className="text-sm text-muted">students enrolled</span>
//                   </div>
//                   <div className="mt-3 text-sm font-medium text-brand">
//                     Open cohort →
//                   </div>
//                 </Link>
//               );
//             })}
//           </section>
//         )}
//       </div>
//     </DashboardShell>
//   );
// }
//
