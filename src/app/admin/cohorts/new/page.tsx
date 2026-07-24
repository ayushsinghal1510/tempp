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
// import NewCohortForm from "@/components/admin/NewCohortForm";
// import { ADMIN_NAV } from "@/lib/nav";
// import { prisma } from "@/lib/db";
//
// export const dynamic = "force-dynamic";
//
// export default async function NewCohortPage() {
//   const user = await requireUser(["admin"]);
//
//   const students = user.universityId
//     ? await prisma.student.findMany({
//         where: { universityId: user.universityId },
//         orderBy: { name: "asc" },
//         select: {
//           id: true,
//           name: true,
//           rollNumber: true,
//           academicPercent: true,
//         },
//       })
//     : [];
//
//   return (
//     <DashboardShell user={user} nav={ADMIN_NAV} title="Start a cohort">
//       <div className="max-w-5xl space-y-5">
//         <Link href="/admin/cohorts" className="text-sm text-muted hover:text-ink">
//           ← Cohorts
//         </Link>
//         <NewCohortForm students={students} />
//       </div>
//     </DashboardShell>
//   );
// }
//
