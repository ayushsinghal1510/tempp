import type { ClinicalScenario } from "@/lib/research/scenarioGeneration";

/**
 * What the student reads before walking into a simulated encounter — the
 * clinical counterpart to CompanyResearchPanel.
 *
 * Deliberately shows LESS than the educator sees. `hiddenConcern` and
 * `educatorNotes` are withheld: the hidden concern only surfaces if the
 * student earns it in conversation, so printing it here would remove the
 * single thing the encounter is built to test.
 */
export default function ScenarioBrief({
  scenario,
}: {
  scenario: ClinicalScenario;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-semibold text-ink">
          {scenario.patientName}, {scenario.patientAge}
        </h3>
        {scenario.accompaniedBy && (
          <p className="mt-0.5 text-sm text-muted">
            Accompanied by {scenario.accompaniedBy}
          </p>
        )}
      </div>

      {scenario.patientBackground && (
        <section>
          <h4 className="text-xs font-medium uppercase tracking-wide text-faint">
            Background
          </h4>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">
            {scenario.patientBackground}
          </p>
        </section>
      )}

      {scenario.presentingIssue && (
        <section>
          <h4 className="text-xs font-medium uppercase tracking-wide text-faint">
            Why they&apos;re here
          </h4>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">
            {scenario.presentingIssue}
          </p>
        </section>
      )}

      {scenario.communicationBarriers.length > 0 && (
        <section>
          <h4 className="text-xs font-medium uppercase tracking-wide text-faint">
            Things to work around
          </h4>
          <ul className="mt-1.5 space-y-1">
            {scenario.communicationBarriers.map((b) => (
              <li key={b} className="text-sm leading-relaxed text-ink">
                • {b}
              </li>
            ))}
          </ul>
        </section>
      )}

      {scenario.learningObjectives.length > 0 && (
        <section>
          <h4 className="text-xs font-medium uppercase tracking-wide text-faint">
            What this encounter is practising
          </h4>
          <ul className="mt-1.5 space-y-1">
            {scenario.learningObjectives.map((o) => (
              <li key={o} className="text-sm leading-relaxed text-ink">
                • {o}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="rounded-lg bg-brand-soft px-4 py-3 text-sm text-ink">
        You are not being marked on the diagnosis. You&apos;re being marked on
        how you talk to them — whether they leave feeling heard, respected and
        clear on what happens next.
      </p>
    </div>
  );
}
