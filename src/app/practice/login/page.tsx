import PracticeLoginForm from "./PracticeLoginForm";

export const metadata = { title: "Sign in — Practice Interview" };

export default function PracticeLoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 text-xl font-bold text-brand">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-primary-foreground shadow-sm">
              P
            </span>
            <span className="text-left">
              Practice Interview
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-brass">
                Personal studio
              </span>
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">
            A standalone space to run a practice interview and see your results.
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Welcome back</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Separate from the main PrepAI login — just for practice rounds.
          </p>
          <PracticeLoginForm />
        </div>
      </div>
    </main>
  );
}
