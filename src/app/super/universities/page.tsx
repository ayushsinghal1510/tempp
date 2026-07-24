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
// import AddUniversityForm from "@/components/super/AddUniversityForm";
// import { SUPER_NAV } from "@/lib/nav";
// import { prisma } from "@/lib/db";
//
// export const dynamic = "force-dynamic";
//
// export default async function UniversitiesPage() {
//   const user = await requireUser(["super_admin"]);
//
//   const universities = await prisma.university.findMany({
//     orderBy: { name: "asc" },
//     include: { _count: { select: { students: true, cohorts: true } } },
//   });
//
//   return (
//     <DashboardShell user={user} nav={SUPER_NAV} title="Universities">
//       <div className="space-y-6">
//         <div className="flex items-start justify-between gap-4">
//           <p className="text-sm text-muted">
//             Each university carries its own contracted session pool.
//           </p>
//           <AddUniversityForm />
//         </div>
//
//         {universities.length === 0 ? (
//           <div className="card p-10 text-center text-muted">
//             No universities yet — add your first one to get started.
//           </div>
//         ) : (
//           <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
//             {universities.map((u) => {
//               const pct =
//                 u.sessionsAllotted > 0
//                   ? Math.round((u.sessionsUsed / u.sessionsAllotted) * 100)
//                   : 0;
//               return (
//                 <Link
//                   key={u.id}
//                   href={`/super/universities/${u.id}`}
//                   className="card p-6 transition hover:border-brand/40"
//                 >
//                   <div className="font-semibold text-ink">{u.name}</div>
//                   <div className="mt-4 h-2 overflow-hidden rounded-full bg-canvas">
//                     <div
//                       className="h-full rounded-full"
//                       style={{
//                         width: `${Math.min(100, pct)}%`,
//                         background:
//                           pct >= 70
//                             ? "var(--danger)"
//                             : pct >= 50
//                               ? "var(--warning)"
//                               : "var(--brand)",
//                       }}
//                     />
//                   </div>
//                   <div className="mt-2 flex items-center justify-between text-xs text-muted">
//                     <span className="tabular-nums">
//                       {u.sessionsUsed}/{u.sessionsAllotted} sessions · {pct}%
//                     </span>
//                     <span className="tabular-nums">
//                       {u._count.students} students · {u._count.cohorts} cohorts
//                     </span>
//                   </div>
//                 </Link>
//               );
//             })}
//           </div>
//         )}
//       </div>
//     </DashboardShell>
//   );
// }
//
