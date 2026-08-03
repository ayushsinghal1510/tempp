import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { counsellorOrgId } from "@/lib/nimc/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Polled by the live call page while the call is in progress. Mirrors
// /api/practice/rounds/[id]/turns, including the currentUser() choice:
// requireUser() redirects, fetch() follows redirects, and an expired session
// would then arrive here as a 200 containing the login page.
//
// This also returns the lead's extracted profile, because that is the half of
// the page that changes most visibly — the fields fill in as the agent learns
// them, and they are cheap enough to resend every poll.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = await counsellorOrgId(user.id);
  if (!orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const call = await prisma.leadCall.findUnique({
    where: { id },
    select: {
      endedAt: true,
      outcome: true,
      lead: {
        select: {
          orgId: true,
          name: true,
          courseInterest: true,
          academics: true,
          residence: true,
        },
      },
    },
  });
  // Scoped to the org, not to the counsellor who dialled: a desk shares its
  // leads, and one counsellor picking up another's call is normal here.
  if (!call || call.lead.orgId !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const afterRaw = new URL(req.url).searchParams.get("after");
  const after = Number.parseInt(afterRaw ?? "0", 10);
  const gt = Number.isFinite(after) && after > 0 ? after : 0;

  const turns = await prisma.leadTurn.findMany({
    where: { callId: id, turnNumber: { gt } },
    orderBy: { turnNumber: "asc" },
    select: { turnNumber: true, speaker: true, transcript: true },
  });

  const { orgId: _orgId, ...lead } = call.lead;

  return NextResponse.json(
    { turns, lead, ended: call.endedAt !== null, outcome: call.outcome },
    { headers: { "Cache-Control": "no-store" } },
  );
}
