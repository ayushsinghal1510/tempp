import PracticeLoginForm from "./PracticeLoginForm";

export const metadata = { title: "Sign in — Practice Interview" };

export default function PracticeLoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-xl font-bold text-brand">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-primary-foreground">
              P
            </span>
            Practice Interview
          </div>
          <p className="mt-2 text-sm text-muted">
            A standalone space to run a practice interview and see your results.
          </p>
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Separate from the main PrepAI login — just for practice rounds.
          </p>
          <PracticeLoginForm />
        </div>
      </div>
    </main>
  );
}
