/**
 * The `pr` running score — parsing and labelling for `STATUS_VALUE` strings.
 *
 * Mr Cheryl returns his judgement of the trainee every turn as one token:
 * `"pass_9"`, `"retry_5"`, `"fail_1"`. A single string rather than two fields
 * because it comes back from a language model, and one token it either produces
 * or doesn't beats two that can disagree with each other.
 *
 * Shared between the live room (which shows it moving) and the results page
 * (which shows where it landed), so the two can never label the same score
 * differently.
 */

export type ScoreStatus = "pass" | "retry" | "fail";

export type ParsedScore = {
  status: ScoreStatus;
  /** 0-10, or null when the model returned a status with no usable number. */
  value: number | null;
};

const STATUSES: ScoreStatus[] = ["pass", "retry", "fail"];

/**
 * Split a STATUS_VALUE token, or null if it is not one.
 *
 * Tolerant by design: the status is matched case-insensitively and the value is
 * optional, because the alternative to accepting `"Pass"` or a bare `"retry"`
 * is showing the trainee nothing at all. Anything whose status is not one of
 * the three is rejected outright — a made-up status has no banner to map to,
 * and inventing one would misreport the outcome of someone's assessment.
 */
export function parseRunningScore(raw: string | null | undefined): ParsedScore | null {
  if (!raw) return null;

  const [statusPart, valuePart] = raw.trim().toLowerCase().split("_");
  const status = STATUSES.find((s) => s === statusPart);
  if (!status) return null;

  const parsed = Number.parseInt(valuePart ?? "", 10);
  return { status, value: Number.isFinite(parsed) ? parsed : null };
}

/** The line shown to the trainee for each outcome, as specified. */
export const OUTCOME_LABEL: Record<ScoreStatus, string> = {
  pass: "Good day",
  retry: "You can retry",
  fail: "You failed",
};

/** Longer-form, for the results page where there is room to say why. */
export const OUTCOME_DETAIL: Record<ScoreStatus, string> = {
  pass: "You handled Mr Cheryl well and the complaint reached a proper resolution.",
  retry: "This one didn't quite land, but nothing went badly wrong. Run it again.",
  fail: "Mr Cheryl walked out. Read the feedback below before your next attempt.",
};

/** Which semantic colour each outcome takes. Kept here so it never drifts. */
export const OUTCOME_TONE: Record<ScoreStatus, "success" | "warning" | "danger"> =
  {
    pass: "success",
    retry: "warning",
    fail: "danger",
  };
