import { requireUser } from "@/lib/auth/session";
import { requireCounsellorOrgId } from "@/lib/nimc/access";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { NIMC_NAV } from "@/lib/nav";
import { prisma } from "@/lib/db";
import { formatPhone } from "@/lib/nimc/phone";
import CallRows from "../CallRows";

export const dynamic = "force-dynamic";

export default async function NimcCallsPage() {
  const user = await requireUser(["nimc_counsellor"], "/nimc/login");
  const orgId = await requireCounsellorOrgId(user.id);

  // Org-wide rather than per-counsellor: a desk shares its leads, and a call
  // history that hid a colleague's attempt would let two people dial the same
  // person an hour apart. Capped rather than paginated — pagination is worth
  // building against real volume, not ahead of it.
  const calls = await prisma.leadCall.findMany({
    where: { lead: { orgId } },
    orderBy: { startedAt: "desc" },
    take: 200,
    select: {
      id: true,
      phone: true,
      startedAt: true,
      outcome: true,
      lead: { select: { name: true, courseInterest: true } },
      _count: { select: { turns: true } },
    },
  });

  return (
    <DashboardShell user={user} nav={NIMC_NAV} title="Calls">
      <CallRows
        rows={calls.map((c) => ({
          id: c.id,
          phone: formatPhone(c.phone),
          name: c.lead.name,
          course: c.lead.courseInterest,
          startedAt: c.startedAt.toISOString(),
          outcome: c.outcome,
          turns: c._count.turns,
        }))}
      />
    </DashboardShell>
  );
}
