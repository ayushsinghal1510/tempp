import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { userTag, companyTag, roundTag } from "./cacheTags";

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
const DATE_KEYS = new Set([
  "createdAt",
  "updatedAt",
  "startedAt",
  "completedAt",
  "timestamp",
]);

function reviveDates<T>(value: T): T {
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

/** Every company + its rounds/turns (topics only) for a user — dashboard & companies list. */
export async function getUserCompaniesWithRounds(userId: string) {
  const result = await unstable_cache(
    () =>
      prisma.practiceCompany.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          rounds: {
            include: { turns: { select: { topics: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        relationLoadStrategy: "join",
      }),
    [`practice-user-companies-${userId}`],
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
export function getUserCompanyList(userId: string) {
  // No Date fields in this shape — nothing to revive.
  return unstable_cache(
    () =>
      prisma.practiceCompany.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, companyName: true },
      }),
    [`practice-user-company-list-${userId}`],
    { tags: [userTag(userId)], revalidate: TTL_SECONDS },
  )();
}

/** One company + its rounds/turns (topics only) — company detail page. */
export async function getCompanyWithRounds(companyId: string) {
  const result = await unstable_cache(
    () =>
      prisma.practiceCompany.findUnique({
        where: { id: companyId },
        include: {
          rounds: {
            include: { turns: { select: { topics: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        relationLoadStrategy: "join",
      }),
    [`practice-company-${companyId}`],
    { tags: [companyTag(companyId)], revalidate: TTL_SECONDS },
  )();
  return reviveDates(result);
}

/** One round + its full turns (transcript/speak included) — round results page. */
export async function getRoundWithTurns(roundId: string) {
  const result = await unstable_cache(
    () =>
      prisma.practiceRound.findUnique({
        where: { id: roundId },
        include: { turns: { orderBy: { turnNumber: "asc" } } },
        relationLoadStrategy: "join",
      }),
    [`practice-round-${roundId}`],
    { tags: [roundTag(roundId)], revalidate: TTL_SECONDS },
  )();
  return reviveDates(result);
}
