import { redirect } from "next/navigation";

// Temporarily disabled — practice-only mode. Bounces to /practice, which
// bounces unauthenticated visitors on to /practice/login itself.
export default function DisabledPage() {
  redirect("/practice");
}

// ---- practice-only mode: original implementation commented out below ----
// import { requireUser } from "@/lib/auth/session";
// import DashboardShell from "@/components/dashboard/DashboardShell";
// import AddStudentForm from "@/components/admin/AddStudentForm";
// import { ADMIN_NAV } from "@/lib/nav";
// import { prisma } from "@/lib/db";
//
// export const dynamic = "force-dynamic";
//
// export default async function StudentsPage() {
//   const user = await requireUser(["admin"]);
//
//   const students = user.universityId
//     ? await prisma.student.findMany({
//         where: { universityId: user.universityId },
//         orderBy: { name: "asc" },
//         include: { _count: { select: { cohortStudents: true } } },
//       })
//     : [];
//
//   return (
//     <DashboardShell user={user} nav={ADMIN_NAV} title="Students">
//       <div className="space-y-5">
//         <div className="flex items-start justify-between gap-4">
//           <p className="text-sm text-muted">
//             Students at your university. Academic % is the average of the four
//             prior-semester scores.
//           </p>
//           <AddStudentForm />
//         </div>
//
//         <section className="card overflow-hidden">
//           {students.length === 0 ? (
//             <div className="px-6 py-10 text-center text-muted">
//               No students yet — add your first one.
//             </div>
//           ) : (
//             <div className="overflow-x-auto">
//               <table className="w-full text-sm">
//                 <thead>
//                   <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
//                     <th className="px-6 py-2.5 font-medium">Name</th>
//                     <th className="px-6 py-2.5 font-medium">Roll no.</th>
//                     <th className="px-6 py-2.5 font-medium">Course</th>
//                     <th className="px-6 py-2.5 font-medium">Academic %</th>
//                     <th className="px-6 py-2.5 font-medium">Cohorts</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {students.map((s) => (
//                     <tr
//                       key={s.id}
//                       className="border-b border-line last:border-0 hover:bg-canvas"
//                     >
//                       <td className="px-6 py-3 font-medium text-ink">{s.name}</td>
//                       <td className="px-6 py-3 tabular-nums text-muted">
//                         {s.rollNumber ?? "—"}
//                       </td>
//                       <td className="px-6 py-3 text-muted">{s.course ?? "—"}</td>
//                       <td className="px-6 py-3 tabular-nums text-muted">
//                         {s.academicPercent}%
//                       </td>
//                       <td className="px-6 py-3 tabular-nums text-muted">
//                         {s._count.cohortStudents}
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           )}
//         </section>
//       </div>
//     </DashboardShell>
//   );
// }
//
