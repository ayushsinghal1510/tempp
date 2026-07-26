import type { PracticeAssignmentMode } from "@prisma/client";

/**
 * "Who can see this round" — shown before the student speaks a single word.
 *
 * Extracted into one component because it appears on both the interview brief
 * and the clinical brief, and it is the one piece of copy on either page that
 * must never drift: it is the student's only notice that an educator may be
 * about to read their transcript or watch their recording.
 */
export default function RoundVisibilityNote({
  mode,
  assigned,
  unitSingular,
}: {
  mode: PracticeAssignmentMode | null;
  /** False when the student created this themselves. */
  assigned: boolean;
  /** "company" or "scenario", from the tenant copy. */
  unitSingular: string;
}) {
  return (
    <section
      className={`card p-5 text-sm ${
        mode === "assessment"
          ? "border-warning/40 bg-warning-soft text-warning"
          : "text-muted"
      }`}
    >
      {mode === "assessment" ? (
        <>
          <strong className="font-semibold">Graded assessment.</strong> Your
          educator can see your scores, the full transcript, and the recording
          of this round.
        </>
      ) : assigned ? (
        <>
          <strong className="font-semibold text-ink">Private drill.</strong>{" "}
          Your educator sees your scores and progress — never the transcript or
          the recording.
        </>
      ) : (
        <>
          <strong className="font-semibold text-ink">Private to you.</strong>{" "}
          You added this {unitSingular} yourself, so nobody else can see this
          round.
        </>
      )}
    </section>
  );
}
