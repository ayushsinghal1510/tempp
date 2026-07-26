/**
 * The deadline rule, in one place.
 *
 * A due date on its own was decoration until now — it was stored, shown to the
 * student, and read by nothing. This module is what gives it teeth, and it is
 * deliberately the only definition of "late" in the codebase: the student's
 * badge, the educator's roster and the server-side refusal all call in here,
 * so they cannot drift into telling different stories about the same date.
 */

/**
 * How long after the due date a student can still start the session.
 *
 * Two days rather than zero because a hard cutoff at midnight punishes the
 * wrong thing — a student who was ill, or who tried at eleven and hit a broken
 * mic, loses the assignment entirely over a few hours. The window is short
 * enough that the deadline still means something and long enough that the
 * lock, when it comes, is genuinely about not doing the work.
 */
export const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;

export type DeadlineStatus =
  /** No due date was ever set — this assignment simply has no deadline. */
  | "none"
  /** Due date is still ahead. */
  | "upcoming"
  /** Past due, inside the grace window — can still be started, counts as late. */
  | "grace"
  /** Past due and past grace — cannot be started until an educator reopens it. */
  | "locked"
  /** Was locked, and an educator reopened it. Never locks again. */
  | "unlocked";

export type DeadlineState = {
  status: DeadlineStatus;
  dueDate: Date | null;
  /** The instant the lock takes effect. Null when there's no due date. */
  locksAt: Date | null;
  /** When the educator reopened it, if they did. */
  unlockedAt: Date | null;
  /** The single question every caller actually asks. */
  canStart: boolean;
  /** True once past the due date, whether or not it's locked or was reopened. */
  isLate: boolean;
};

export type DeadlineInput = {
  dueDate: Date | string | null;
  unlockedAt: Date | string | null;
};

/**
 * `now` is injectable so tests don't depend on the wall clock, and so a single
 * page render classifies every row against one instant rather than drifting
 * across a long list.
 */
export function deadlineState(
  assignment: DeadlineInput,
  now: Date = new Date(),
): DeadlineState {
  const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
  const unlockedAt = assignment.unlockedAt ? new Date(assignment.unlockedAt) : null;

  // A due date that won't parse is treated as no deadline at all. Locking a
  // student out on the strength of an unreadable date is the worse failure.
  if (!dueDate || Number.isNaN(dueDate.getTime())) {
    return {
      status: "none",
      dueDate: null,
      locksAt: null,
      unlockedAt,
      canStart: true,
      isLate: false,
    };
  }

  const locksAt = new Date(dueDate.getTime() + GRACE_PERIOD_MS);
  const isLate = now.getTime() > dueDate.getTime();

  // Checked before the time comparisons: an educator's reopen is permanent and
  // outranks the clock, otherwise the assignment would re-lock the instant
  // they walked away from it.
  if (unlockedAt) {
    return { status: "unlocked", dueDate, locksAt, unlockedAt, canStart: true, isLate };
  }

  if (!isLate) {
    return { status: "upcoming", dueDate, locksAt, unlockedAt, canStart: true, isLate };
  }

  if (now.getTime() <= locksAt.getTime()) {
    return { status: "grace", dueDate, locksAt, unlockedAt, canStart: true, isLate };
  }

  return { status: "locked", dueDate, locksAt, unlockedAt, canStart: false, isLate: true };
}

/** Short label for a badge. Kept here so student and educator read identically. */
export const DEADLINE_LABEL: Record<DeadlineStatus, string> = {
  none: "",
  upcoming: "Due",
  grace: "Overdue",
  locked: "Locked",
  unlocked: "Reopened",
};
