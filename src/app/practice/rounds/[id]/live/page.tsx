import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import InterviewRoom from "@/components/interview/InterviewRoom";
import { prisma } from "@/lib/db";
import { tierProfile } from "@/lib/research/tierProfiles";
import type { CompanyResearch } from "@/lib/research/companyResearch";
import type { PracticeDrive } from "@/lib/voice/practiceCustoms";

export const dynamic = "force-dynamic";

export default async function PracticeInterviewLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(["practice"], "/practice/login");

  const round = await prisma.practiceRound.findUnique({
    where: { id },
    include: { company: true },
  });

  // Only the owning user can take their own round.
  if (!round || round.userId !== user.id) notFound();
  if (round.status === "completed") notFound();

  const resumeChat = round.companyId
    ? await prisma.practiceResumeChat.findUnique({
        where: { companyId: round.companyId },
        select: { resumeText: true },
      })
    : null;

  const companyName = round.company?.companyName ?? round.companyName;
  const tier = round.company?.tier ?? round.tier;
  const drive: PracticeDrive | undefined = companyName
    ? {
        companyName,
        jobTitle: round.company?.jobTitle ?? round.jobTitle,
        jobDescription: round.company?.jobDescription ?? round.jobDescription,
        tier,
        salaryLpa: round.company?.salaryLpa ?? round.salaryLpa,
        research: (round.company?.companyResearch ??
          round.companyResearch) as CompanyResearch | null,
        tierProfile: tierProfile(tier),
        resumeText: resumeChat?.resumeText,
      }
    : undefined;

  return (
    <InterviewRoom
      variant="practice"
      roundId={round.id}
      candidateName={user.name}
      drive={drive}
      kindLabel="Practice interview"
      backHref="/practice"
    />
  );
}
