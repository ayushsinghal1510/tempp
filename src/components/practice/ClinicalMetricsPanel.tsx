import type { ClinicalRoundMetrics } from "@/lib/practice/clinicalMetrics";

/**
 * The two counted (not judged) metrics for a clinical encounter.
 *
 * Presented plainly and without a verdict: these are observations, and the
 * right balance depends on the encounter. A student who talked 70% of the way
 * through breaking bad news may have done exactly the right thing; the same
 * number while taking a history usually means they steamrolled someone.
 */
export default function ClinicalMetricsPanel({
  metrics,
  showTerms = true,
}: {
  metrics: ClinicalRoundMetrics;
  /**
   * The COUNTS are analytics and safe everywhere. The individual terms are
   * words the student actually said, i.e. transcript content — so on the
   * educator side this is false for a `drill` assignment, where the educator
   * is entitled to the numbers but not the words.
   */
  showTerms?: boolean;
}) {
  const { talk, jargon } = metrics;
  const pct = talk.ratio != null ? Math.round(talk.ratio * 100) : null;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <section>
        <h4 className="text-xs font-medium uppercase tracking-wide text-faint">
          Who did the talking
        </h4>
        {pct == null ? (
          <p className="mt-2 text-sm text-muted">Nothing was said this round.</p>
        ) : (
          <>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-ink">
                {pct}%
              </span>
              <span className="text-sm text-muted">you</span>
            </div>
            <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-canvas">
              <div className="bg-brand" style={{ width: `${pct}%` }} />
              <div className="flex-1 bg-line" />
            </div>
            <p className="mt-2 text-xs text-muted">
              {talk.studentWords} words from you, {talk.patientWords} from the
              patient. No target here — but a patient who barely got a word in
              rarely leaves feeling heard.
            </p>
          </>
        )}
      </section>

      <section>
        <h4 className="text-xs font-medium uppercase tracking-wide text-faint">
          Words they wouldn&apos;t follow
        </h4>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-ink">
            {jargon.total}
          </span>
          <span className="text-sm text-muted">
            {jargon.total === 1 ? "time" : "times"}
          </span>
        </div>
        {!showTerms ? (
          <p className="mt-2 text-xs text-muted">
            Which terms these were is part of the transcript, so it&apos;s
            withheld on a private drill.
          </p>
        ) : jargon.hits.length === 0 ? (
          <p className="mt-2 text-xs text-muted">
            No clinical jargon — everything you said was in plain language.
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {jargon.hits.slice(0, 8).map((h) => (
                <span
                  key={h.term}
                  className="rounded-md bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning"
                >
                  {h.term}
                  {h.count > 1 && ` ×${h.count}`}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Each of these has a plain-English version. Saying it the simple way
              the first time saves explaining it twice.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
