import { redirect } from "next/navigation";

// Temporarily disabled — practice-only mode. Bounces to /practice, which
// bounces unauthenticated visitors on to /practice/login itself.
export default function DisabledPage() {
  redirect("/practice");
}

// ---- practice-only mode: original implementation commented out below ----
// import { Suspense } from "react";
// import LoginForm from "./LoginForm";
//
// export const metadata = { title: "Sign in — PrepAI" };
//
// export default function LoginPage() {
//   return (
//     <main className="min-h-screen grid place-items-center px-4 py-12">
//       <div className="w-full max-w-sm">
//         <div className="mb-8 text-center">
//           <div className="inline-flex items-center gap-2 text-brand font-bold text-xl">
//             <span className="grid place-items-center h-8 w-8 rounded-lg bg-brand text-primary-foreground">
//               P
//             </span>
//             PrepAI
//           </div>
//           <p className="mt-2 text-sm text-muted">
//             Your AI interview coach for campus placements.
//           </p>
//         </div>
//
//         <div className="card p-6">
//           <h1 className="text-lg font-semibold">Sign in</h1>
//           <p className="mt-1 text-sm text-muted">
//             Use your placement-cell or student account.
//           </p>
//           <Suspense>
//             <LoginForm />
//           </Suspense>
//         </div>
//
//         <DemoCredentials />
//
//         <p className="mt-6 text-center text-xs text-faint">
//           Coaching rounds are private to the student. Educators see test rounds
//           only.
//         </p>
//       </div>
//     </main>
//   );
// }
//
// function DemoCredentials() {
//   const rows: Array<[string, string]> = [
//     ["Super admin", "ops@prepai.com"],
//     ["Admin (NIMS)", "tpo@nims.edu"],
//     ["Student · Ready", "aarav.mehta@nims.edu"],
//     ["Student · Unlocked", "ananya.rao@nims.edu"],
//   ];
//   return (
//     <div className="card mt-4 p-4">
//       <p className="text-xs font-medium text-muted">
//         Demo logins · password{" "}
//         <code className="rounded bg-canvas px-1 py-0.5 text-ink">
//           password123
//         </code>
//       </p>
//       <ul className="mt-2 space-y-1 text-xs">
//         {rows.map(([label, email]) => (
//           <li key={email} className="flex justify-between gap-4">
//             <span className="text-faint">{label}</span>
//             <code className="text-ink">{email}</code>
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// }
//
