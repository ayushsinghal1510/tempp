import EducatorLoginForm from "./EducatorLoginForm";

export const metadata = { title: "Educator sign in — Practice Interview" };

export default function EducatorLoginPage() {
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
            Educator console — set up companies, classes, and see how your
            students are doing.
          </p>
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            For educators. Students sign in at{" "}
            <a href="/practice/login" className="text-brand hover:underline">
              /practice/login
            </a>
            .
          </p>
          <EducatorLoginForm />
        </div>
      </div>
    </main>
  );
}
