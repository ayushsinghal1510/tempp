import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { requireCounsellorOrgId } from "@/lib/nimc/access";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { NIMC_NAV } from "@/lib/nav";
import { prisma } from "@/lib/db";
import { formatPhone } from "@/lib/nimc/phone";
import LiveCall, { type LeadProfile, type Turn } from "./LiveCall";

export const dynamic = "force-dynamic";

export default async function NimcCallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(["nimc_counsellor"], "/nimc/login");
  const orgId = await requireCounsellorOrgId(user.id);

  const call = await prisma.leadCall.findUnique({
    where: { id },
    select: {
      id: true,
      phone: true,
      startedAt: true,
      endedAt: true,
      lead: {
        select: {
          orgId: true,
          name: true,
          courseInterest: true,
          academics: true,
          residence: true,
          attemptCount: true,
        },
      },
      turns: {
        orderBy: { turnNumber: "asc" },
        select: { turnNumber: true, speaker: true, transcript: true },
      },
    },
  });
  if (!call || call.lead.orgId !== orgId) notFound();

  // The page renders whatever exists at request time and the client takes over
  // from there, so a call opened mid-conversation is never blank while the
  // first poll lands.
  const lead: LeadProfile = {
    name: call.lead.name,
    courseInterest: call.lead.courseInterest,
    academics: call.lead.academics as LeadProfile["academics"],
    residence: call.lead.residence,
  };

  return (
    <DashboardShell
      user={user}
      nav={NIMC_NAV}
      title={call.lead.name ?? formatPhone(call.phone)}
    >
      <p className="mb-4 text-sm text-muted">
        {formatPhone(call.phone)}
        {call.lead.attemptCount > 1 && ` · attempt ${call.lead.attemptCount}`}
        {` · ${call.startedAt.toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        })}`}
      </p>

      <LiveCall
        callId={call.id}
        initialTurns={call.turns as Turn[]}
        initialLead={lead}
        initiallyEnded={call.endedAt !== null}
      />
    </DashboardShell>
  );
}
