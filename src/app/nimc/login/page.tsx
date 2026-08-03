import NimcLoginForm from "./NimcLoginForm";

export const metadata = { title: "Counsellor sign in — Admissions calling" };

export default function NimcLoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-xl font-bold text-brand">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-primary-foreground">
              P
            </span>
            Admissions calling
          </div>
          <p className="mt-2 text-sm text-muted">
            Counsellor console — call prospective students and read back what
            was said.
          </p>
        </div>

        <div className="card p-6">
          <h1 className="text-lg font-semibold text-ink">Sign in</h1>
          <NimcLoginForm />
        </div>
      </div>
    </main>
  );
}
