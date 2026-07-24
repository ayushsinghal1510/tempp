// Shared cache-tag names so read-side `unstable_cache` calls and write-side
// `revalidateTag` calls can never drift apart and silently stop invalidating.
export const userTag = (userId: string) => `practice:user:${userId}`;
export const companyTag = (companyId: string) => `practice:company:${companyId}`;
export const roundTag = (roundId: string) => `practice:round:${roundId}`;
