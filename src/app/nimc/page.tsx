import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { requireCounsellorOrgId } from "@/lib/nimc/access";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { NIMC_NAV } from "@/lib/nav";
import { prisma } from "@/lib/db";
import { formatPhone } from "@/lib/nimc/phone";
import Dialler from "./Dialler";
import CallRows from "./CallRows";

export const dynamic = "force-dynamic";

export default async function NimcDiallerPage() {
  const user = await requireUser(["nimc_counsellor"], "/nimc/login");
  const orgId = await requireCounsellorOrgId(user.id);

  const recent = await prisma.leadCall.findMany({
    where: { lead: { orgId } },
    orderBy: { startedAt: "desc" },
    take: 10,
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
    <DashboardShell user={user} nav={NIMC_NAV} title="Dialler">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div>
          <Dialler />
          <p className="mt-3 text-xs text-muted">
            The call connects to the number you enter. Sneha introduces
            herself, and everything said is written down here as it happens.
          </p>
        </div>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink">Recent calls</h2>
            <Link href="/nimc/calls" className="text-xs text-brand hover:underline">
              All calls
            </Link>
          </div>
          <CallRows
            rows={recent.map((c) => ({
              id: c.id,
              phone: formatPhone(c.phone),
              name: c.lead.name,
              course: c.lead.courseInterest,
              startedAt: c.startedAt.toISOString(),
              outcome: c.outcome,
              turns: c._count.turns,
            }))}
          />
        </section>
      </div>
    </DashboardShell>
  );
}
