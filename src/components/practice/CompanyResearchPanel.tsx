import type { CompanyResearch } from "@/lib/research/companyResearch";

/** The company-specific research blocks — shared by the pre-round brief page
 * and the company page's collapsible "research & prep" section. */
export default function CompanyResearchPanel({
  research,
  companyName,
}: {
  research: CompanyResearch | null;
  companyName: string;
}) {
  if (!research) {
    return (
      <section className="card p-6 text-center text-sm text-muted">
        Company research isn&apos;t available for this drive — you can still
        run the interview, it just won&apos;t be as targeted.
      </section>
    );
  }

  return (
    <>
      {(research.signatureTopics.length > 0 ||
        research.sampleQuestions.length > 0 ||
        research.interviewStyle) && (
        <section className="card p-6">
          <h3 className="font-semibold text-ink">
            What {companyName} tends to ask
          </h3>
          {research.interviewStyle && (
            <p className="mt-1 text-sm text-muted">{research.interviewStyle}</p>
          )}
          {research.signatureTopics.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {research.signatureTopics.map((t, i) => (
                <span
                  key={i}
                  className="rounded-full border border-line px-3 py-1 text-xs text-ink"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {research.sampleQuestions.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-sm text-ink">
              {research.sampleQuestions.map((q, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-brand">?</span>
                  {q}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {research.values.length > 0 && (
        <section className="card p-6">
          <h3 className="font-semibold text-ink">What they value</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-ink">
            {research.values.map((v, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-success">✓</span>
                {v}
              </li>
            ))}
          </ul>
        </section>
      )}

      {research.techStack.length > 0 && (
        <section className="card p-6">
          <h3 className="font-semibold text-ink">Their stack</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {research.techStack.map((t, i) => (
              <span
                key={i}
                className="rounded-md bg-canvas px-2.5 py-1 text-xs text-ink"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
