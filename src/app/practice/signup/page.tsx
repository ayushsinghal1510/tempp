import PracticeSignupForm from "./PracticeSignupForm";

export const metadata = { title: "Create account — Practice Interview" };

export default function PracticeSignupPage() {
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
          <h1 className="text-lg font-semibold text-ink">Create account</h1>
          <p className="mt-1 text-sm text-muted">
            Just for practice rounds — separate from the main PrepAI login.
          </p>
          <PracticeSignupForm />
        </div>
      </div>
    </main>
  );
}
