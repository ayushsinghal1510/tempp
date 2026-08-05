import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { userTag, companyTag, roundTag } from "./cacheTags";
import { memberOrgIds } from "./access";

// Data changes only through the handful of mutations in actions/practice.ts
// and the webhook route, and every one of them calls revalidateTag with the
// matching tag below — so this TTL is just a safety net, not the primary
// invalidation mechanism.
const TTL_SECONDS = 60;

// unstable_cache JSON-serializes whatever it stores, so every Date field
// comes back out as a plain string on a cache hit — even though the return
// type (inherited from Prisma) still says Date, which is why this breaks at
// runtime (e.g. `.getTime()`) rather than at compile time. Revive exactly the
// known Date fields by key name after every cached read.
//
// Every DateTime column that can reach a cached read below has to be listed:
// a missing key silently yields a string where the types promise a Date.
const DATE_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "startedAt",
  "completedAt",
  "timestamp",
  "dueDate",
  "joinedAt",
]);

function reviveDates<T>(value: T): T {
  // A cache MISS returns the live Prisma result, where these are already real
  // Dates. Without this guard they fall through to the object branch below,
  // and since a Date has no enumerable own properties `Object.entries` gives
  // `[]` — rebuilding it as `{}` and destroying it. That produced a page that
  // rendered fine on a cache hit and threw on a miss (i.e. right after any
  // tag revalidation), plus NaN durations, since `{}` is truthy and so slips
  // past every `if (!round.completedAt)` guard downstream.
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(reviveDates) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] =
        DATE_KEYS.has(k) && typeof v === "string" ? new Date(v) : reviveDates(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Every company this student may use, with THEIR rounds — dashboard and
 * companies list.
 *
 * Three ways in, mirroring getAccessibleCompany exactly: they registered it
 * themselves, an educator assigned it (and published it — a draft is still
 * being reviewed), or it is a published workflow in an org they belong to.
 * Rounds and assignments are both filtered to this user, so a shared company
 * shows the student only their own history.
 *
 * The org lookup runs OUTSIDE the cached callback and its ids go into the
 * cache key: membership is not derivable from userId inside the closure, and
 * baking a stale org list into a cached row would keep showing a workflow to
 * someone who has left.
 */
export async function getUserCompaniesWithRounds(userId: string) {
  const orgIds = await memberOrgIds(userId);
  const result = await unstable_cache(
    () =>
      prisma.practiceCompany.findMany({
        where: {
          OR: [
            { userId },
            { status: "published", assignments: { some: { userId } } },
            { status: "published", kind: "workflow", orgId: { in: orgIds } },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: {
          rounds: {
            where: { userId },
            include: { turns: { select: { topics: true } } },
            orderBy: { createdAt: "asc" },
          },
          assignments: { where: { userId }, take: 1 },
        },
        relationLoadStrategy: "join",
      }),
    [`practice-user-companies-${userId}-${orgIds.join(",")}`],
    { tags: [userTag(userId)], revalidate: TTL_SECONDS },
  )();
  return reviveDates(result);
}

/** Every round (+ its company) for a user — sessions list. */
export async function getUserRoundsWithCompany(userId: string) {
  const result = await unstable_cache(
    () =>
      prisma.practiceRound.findMany({
        where: { userId },
        include: { turns: { select: { topics: true } }, company: true },
        orderBy: { createdAt: "asc" },
        relationLoadStrategy: "join",
      }),
    [`practice-user-rounds-${userId}`],
    { tags: [userTag(userId)], revalidate: TTL_SECONDS },
  )();
  return reviveDates(result);
}

/** Lightweight {id, companyName} list for the company-switcher dropdown. */
export async function getUserCompanyList(userId: string) {
  const orgIds = await memberOrgIds(userId);
  // No Date fields in this shape — nothing to revive.
  return unstable_cache(
    () =>
      prisma.practiceCompany.findMany({
        where: {
          OR: [
            { userId },
            { status: "published", assignments: { some: { userId } } },
            { status: "published", kind: "workflow", orgId: { in: orgIds } },
          ],
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, companyName: true },
      }),
    [`practice-user-company-list-${userId}-${orgIds.join(",")}`],
    { tags: [userTag(userId)], revalidate: TTL_SECONDS },
  )();
}

/**
 * One company + THIS user's rounds/turns (topics only) — company detail page.
 *
 * The rounds are scoped by userId, not just companyId: a company is no longer
 * necessarily private to one student, so an unscoped include would show a
 * student every other student's sessions on a shared company. The educator's
 * roll-up uses a separate, deliberately unscoped query rather than widening
 * this one.
 */
export async function getCompanyWithRounds(companyId: string, userId: string) {
  const result = await unstable_cache(
    () =>
      prisma.practiceCompany.findUnique({
        where: { id: companyId },
        include: {
          rounds: {
            where: { userId },
            include: { turns: { select: { topics: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        relationLoadStrategy: "join",
      }),
    [`practice-company-${companyId}-${userId}`],
    {
      tags: [companyTag(companyId), userTag(userId)],
      revalidate: TTL_SECONDS,
    },
  )();
  return reviveDates(result);
}

/** One round + its full turns (transcript/speak included) — round results page. */
export async function getRoundWithTurns(roundId: string) {
  const result = await unstable_cache(
    () =>
      prisma.practiceRound.findUnique({
        where: { id: roundId },
        include: {
          turns: { orderBy: { turnNumber: "asc" } },
          // Two fields only. The results page names what the session was
          // against — a student who ran four in a row otherwise has nothing on
          // the page telling them which one they are looking at. `companyId`
          // was already here for the back link, but an id is not a name.
          company: { select: { id: true, companyName: true, jobTitle: true } },
        },
        relationLoadStrategy: "join",
      }),
    [`practice-round-${roundId}`],
    { tags: [roundTag(roundId)], revalidate: TTL_SECONDS },
  )();
  return reviveDates(result);
}
