import type { Prisma, RoundType } from "@prisma/client";
import type { SessionUser } from "./jwt";

// ────────────────────────────────────────────────────────────────────────────
// API-LAYER PRIVACY ENFORCEMENT (brief §1, §5, §8)
//
// This is the load-bearing security boundary of the product. It is enforced
// here, at the data-access layer, NOT merely by hiding UI elements.
//
//   • Coaching-round analytics  → the owning STUDENT only.
//   • Test-round analytics      → the owning student + their university's ADMIN
//                                 + the super_admin (money/ops aggregates).
//   • Webcam visual metrics (turns.visualFlags: posture / eye-contact / fidget)
//                               → the owning STUDENT only, even on test rounds.
//
// Note on the "delivery" score dimension: §8 bars *webcam* visual/delivery
// signals, but §9 explicitly places the Delivery score on the admin-facing
// radar. So the 5 score dimensions (incl. delivery) are visible to admins; the
// hard boundary is the raw webcam observations in turns.visualFlags.
// ────────────────────────────────────────────────────────────────────────────

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Context needed to decide access to a round, without loading its analytics. */
export type RoundContext = {
  type: RoundType;
  studentUserId: string; // User.id of the student who owns the round
  universityId: string; // university the student belongs to
};

/** True when this viewer is the student who owns the round. */
export function isRoundOwner(viewer: SessionUser, ctx: RoundContext): boolean {
  return viewer.role === "student" && viewer.id === ctx.studentUserId;
}

/** Can this viewer see this round's analytics at all? */
export function canViewRound(viewer: SessionUser, ctx: RoundContext): boolean {
  // The owning student sees everything about their own rounds.
  if (isRoundOwner(viewer, ctx)) return true;

  // Coaching rounds are private to the student — no educator or operator sees them.
  if (ctx.type === "coaching") return false;

  // Test rounds: the student's own university admin, and the platform operator.
  if (viewer.role === "admin") return viewer.universityId === ctx.universityId;
  if (viewer.role === "super_admin") return true;

  return false;
}

/** Throws ForbiddenError if the viewer may not see the round. */
export function assertCanViewRound(
  viewer: SessionUser,
  ctx: RoundContext,
): void {
  if (!canViewRound(viewer, ctx)) {
    throw new ForbiddenError("You do not have access to this round.");
  }
}

/**
 * Prisma `where` fragment restricting Round queries to what the viewer may see.
 * Compose it into any round listing so the privacy rule is applied in the query
 * itself rather than after the fact.
 */
export function roundWhereForViewer(
  viewer: SessionUser,
): Prisma.RoundWhereInput {
  if (viewer.role === "student") {
    // Both coaching and test rounds, but only the student's own.
    return { session: { student: { userId: viewer.id } } };
  }
  if (viewer.role === "admin") {
    return {
      type: "test",
      session: {
        student: { universityId: viewer.universityId ?? "__no_university__" },
      },
    };
  }
  // super_admin: test rounds across all universities.
  return { type: "test" };
}

/**
 * Safely narrow the viewer's round scope with an additional filter.
 *
 * IMPORTANT: always compose with this rather than spreading
 * `{ ...roundWhereForViewer(v), ...extra }`. A spread lets `extra` OVERRIDE the
 * guard's own `type`/`session` constraints (e.g. re-adding `type: "coaching"`),
 * silently widening access. AND-combining can only ever narrow it.
 */
export function scopedRoundWhere(
  viewer: SessionUser,
  extra?: Prisma.RoundWhereInput,
): Prisma.RoundWhereInput {
  const guard = roundWhereForViewer(viewer);
  return extra ? { AND: [guard, extra] } : guard;
}

/**
 * Strip the webcam visual metrics from turns when the viewer is not the owning
 * student. Apply to any turn payload leaving the API for an admin/operator.
 */
export function sanitizeTurnsForViewer<T extends { visualFlags?: unknown }>(
  turns: T[],
  viewer: SessionUser,
  ctx: RoundContext,
): Array<Omit<T, "visualFlags"> & { visualFlags: unknown | null }> {
  const owner = isRoundOwner(viewer, ctx);
  return turns.map((t) => ({
    ...t,
    visualFlags: owner ? (t.visualFlags ?? null) : null,
  }));
}

/**
 * True when the viewer may see raw webcam visual metrics for this round.
 * Only ever the owning student.
 */
export function canViewVisualMetrics(
  viewer: SessionUser,
  ctx: RoundContext,
): boolean {
  return isRoundOwner(viewer, ctx);
}
