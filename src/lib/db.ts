import { Prisma, PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across hot reloads in dev to avoid exhausting
// database connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

// We connect directly to Neon (not through its PgBouncer pooler) because the
// pooler measured a flat ~1s tax on every single query. The tradeoff: Neon
// auto-suspends its compute when idle and drops direct connections out from
// under a long-lived server, surfacing as Prisma error P1017/P1001. Retry
// once on exactly that error instead of paying the pooler's cost to avoid it.
function isStaleConnectionError(err: unknown) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === "P1017" || err.code === "P1001")
  );
}

export const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ args, query }) {
      try {
        return await query(args);
      } catch (err) {
        if (!isStaleConnectionError(err)) throw err;
        await basePrisma.$disconnect();
        return await query(args);
      }
    },
  },
});
