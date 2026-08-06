import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { UIMessage } from "ai";
import { requireUser } from "@/lib/auth/session";
import { tenantConfig } from "@/lib/tenants/config";
import { getAccessibleCompany } from "@/lib/practice/access";
import { getResumeStudio, listResumeStudios } from "@/lib/practice/resumeStudio";
import PracticeHeader from "@/components/practice/PracticeHeader";
import ResumeStudio from "@/components/practice/ResumeStudio";
import ResumeStudioStart from "@/components/practice/ResumeStudioStart";
import VariantSwitcher from "@/components/practice/ResumeVariantSwitcher";

export const dynamic = "force-dynamic";

export default async function ResumeStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company: companyParam } = await searchParams;
  const companyId = companyParam ?? null;

  const user = await requireUser(["practice"], "/practice/login");

  // Gated on the same feature as the resume chat. `features.resume` is true on
  // `jer` alone, and a resume builder means nothing on the clinical, custom,
  // calling or roleplay tracks — this is a 404 rather than a redirect because
  // on those tenants the route genuinely does not exist.
  const { features } = tenantConfig(user.tenant);
  if (!features.resume) notFound();

  // Re-checked on every load, not trusted from the variant row: an assignment
  // can be revoked after the variant was forked, and that must stop the
  // company's research reaching the student's prompt.
  const company = companyId ? await getAccessibleCompany(user.id, companyId) : null;
  if (companyId && !company) notFound();

  const [studio, variants] = await Promise.all([
    getResumeStudio(user.id, companyId),
    listResumeStudios(user.id),
  ]);

  // A variant can't exist before the base does, and landing on a tailored URL
  // with nothing to fork from would otherwise render the "upload your resume"
  // screen and then create the BASE resume at this URL.
  if (companyId && !studio) redirect("/practice/resume-studio");

  return (
    <main className="practice-page min-h-screen bg-canvas text-ink">
      <PracticeHeader userName={user.name} tenant={user.tenant} />

      <div className="mx-auto w-full max-w-[1800px] space-y-6 px-6 py-10">
        <section className="card flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <h1 className="text-2xl font-bold text-ink">Resume Studio</h1>
            <p className="mt-1 text-sm text-muted">
              Build your resume by talking. Written in LaTeX, rendered as a real
              PDF, yours to download any time.
            </p>
          </div>
          {studio && variants.length > 0 && (
            <VariantSwitcher variants={variants} currentCompanyId={companyId} />
          )}
        </section>

        {studio ? (
          <ResumeStudio
            companyId={companyId}
            companyName={company?.companyName ?? null}
            initialMessages={studio.messages as unknown as UIMessage[]}
            // No `pdfKey` means the last write didn't compile. Passed in so
            // the first paint shows the repair message rather than flashing an
            // iframe that will 409.
            initiallyRenderable={studio.pdfKey !== null}
          />
        ) : (
          <ResumeStudioStart />
        )}

        <p className="text-sm text-muted">
          Want feedback on a resume instead of building one?{" "}
          <Link href="/practice/companies" className="text-brand hover:underline">
            Open a company and use Resume &amp; career chat
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
