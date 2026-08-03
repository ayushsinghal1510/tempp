import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  OUTCOME_DETAIL,
  OUTCOME_LABEL,
  OUTCOME_TONE,
  type ScoreStatus,
} from "@/lib/practice/runningScore";

/**
 * The `mm` end-of-session debrief — one score, a criteria table, and a written
 * summary, produced by the assessor model after Mr Muthu ends the meeting.
 *
 * This is the whole assessment surface for the roleplay track. `mm` is
 * `scoring: false` with `topics: []`, so there is no radar, no timeline and no
 * per-turn kink history to sit alongside it: everything the officer learns
 * about their own handling is on this card. That is why it renders the prose at
 * full width and unabridged rather than teasing it behind a "view report".
 *
 * A server component — markdown in, HTML out, no state.
 *
 * `remarkGfm` is not optional here. The feedback is specified as a pipe table
 * and GitHub-flavoured tables are not in core markdown; without the plugin it
 * renders as a paragraph of pipes.
 */

/** Shared by both sections so the table and the prose read as one document. */
const PROSE =
  "prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold " +
  "prose-p:text-ink prose-li:text-ink prose-strong:text-ink prose-td:text-ink prose-th:text-ink";

export default function DebriefPanel({
  agentNoun,
  score,
  total,
  outcome,
  feedback,
  summary,
}: {
  /** Who the trainee was up against — "Mr Muthu" or "Mr Cheryl". */
  agentNoun: string;
  score: number | null;
  /** `pr` only: the /20 rubric total. A different scale from `score`, not a view of it. */
  total?: number | null;
  /** `pr` only: pass / retry / fail, off the running score's status prefix. */
  outcome?: string | null;
  feedback: string | null;
  summary: string | null;
}) {
  const status = outcome as ScoreStatus | null | undefined;
  const known = status && status in OUTCOME_LABEL ? status : null;

  // Nothing to show at all — the caller decides whether that means "abandoned"
  // or "still running", so this just gets out of the way.
  if (score === null && total == null && !known && !feedback && !summary)
    return null;

  return (
    <section className="card p-6">
      {/* The verdict, first and biggest. On `pr` this is the thing the trainee
          came to read; the numbers underneath it are the justification. */}
      {known && (
        <div
          className={`mb-5 rounded-xl border p-4 ${
            OUTCOME_TONE[known] === "success"
              ? "border-success text-success"
              : OUTCOME_TONE[known] === "danger"
                ? "border-danger text-danger"
                : "border-warning text-warning"
          }`}
        >
          <div className="text-xl font-bold">{OUTCOME_LABEL[known]}</div>
          <p className="mt-1 text-sm text-muted">{OUTCOME_DETAIL[known]}</p>
        </div>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">How you handled it</h3>
          <p className="mt-0.5 text-xs text-muted">
            Assessed once, after {agentNoun} ended the session. He was scripted
            to be difficult — this is about you, not him.
          </p>
        </div>
        {total != null && (
          <div className="shrink-0 text-right">
            <div className="text-3xl font-bold text-ink">
              {total}
              <span className="text-base font-medium text-muted">/20</span>
            </div>
            <div className="text-xs text-faint">Rubric total</div>
          </div>
        )}
        {score !== null && (
          <div className="shrink-0 text-right">
            <div className="text-3xl font-bold text-ink">
              {/* Trailing ".0" dropped: the model may return either "7" or
                  "7.0" for the same score and they should not look different. */}
              {Number.isInteger(score) ? score : score.toFixed(1)}
              <span className="text-base font-medium text-muted">/10</span>
            </div>
            <div className="text-xs text-faint">
              {total != null ? "Final running score" : "Overall"}
            </div>
          </div>
        )}
      </div>

      {feedback && (
        <div className="mt-5">
          {/* The table is the one thing here that can outgrow a narrow screen,
              so it scrolls inside its own box rather than widening the page. */}
          <div className={`${PROSE} overflow-x-auto`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{feedback}</ReactMarkdown>
          </div>
        </div>
      )}

      {summary && (
        <div className="mt-6 border-t border-line pt-5">
          <div className={PROSE}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
          </div>
        </div>
      )}
    </section>
  );
}
