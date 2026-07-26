import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import InterviewRoom from "@/components/interview/InterviewRoom";
import { prisma } from "@/lib/db";
import { getResumeChatFor } from "@/lib/practice/access";
import { tierProfile } from "@/lib/research/tierProfiles";
import type { CompanyResearch } from "@/lib/research/companyResearch";
import type { PracticeDrive } from "@/lib/voice/practiceCustoms";
import type { ClinicalScenario } from "@/lib/research/scenarioGeneration";
import { normaliseWorkflow } from "@/lib/voice/workflowCustoms";
import { tenantConfig } from "@/lib/tenants/config";

export const dynamic = "force-dynamic";

export default async function PracticeInterviewLivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(["practice"], "/practice/login");
  const { features, copy } = tenantConfig(user.tenant);

  const round = await prisma.practiceRound.findUnique({
    where: { id },
    include: { company: true },
  });

  // Only the owning user can take their own round.
  if (!round || round.userId !== user.id) notFound();
  if (round.status === "completed") notFound();

  // On the clinical track the session is the educator's patient case and
  // there is no company, no resume and no research — so everything below it is
  // skipped entirely rather than computed and discarded.
  if (round.company?.kind === "workflow") {
    return (
      <InterviewRoom
        variant="practice"
        roundId={round.id}
        candidateName={user.name}
        workflow={normaliseWorkflow(round.company.workflow)}
        kindLabel={round.company.companyName}
        backHref="/practice"
      />
    );
  }

  const scenario =
    round.company?.kind === "scenario"
      ? (round.company.scenario as ClinicalScenario | null)
      : null;

  if (scenario) {
    return (
      <InterviewRoom
        variant="practice"
        roundId={round.id}
        candidateName={user.name}
        scenario={scenario}
        kindLabel={`Patient ${copy.sessionNoun}`}
        backHref="/practice"
      />
    );
  }

  // Scoped by user as well as company — this text goes straight into the
  // interviewer's system prompt, so a company-only lookup would hand one
  // student another student's resume once companies are shared.
  const resumeChat = features.resume
    ? round.companyId
      ? await getResumeChatFor(round.userId, round.companyId)
      : null
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
