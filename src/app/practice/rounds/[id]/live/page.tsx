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
    // `mm` stores its row as a workflow too, so the kind alone can't tell the
    // two apart — the tenant does. On mm the row's greeting/prompt are seeded
    // copies for the admin to read; the customs the call actually runs on come
    // from muthuPrompt.ts, which is why nothing from the row is passed here.
    // Same on pr (cherylPrompt.ts) and vps (vpsPrompt.ts).
    if (features.roleplay) {
      return (
        <InterviewRoom
          variant="practice"
          roundId={round.id}
          // The tenant, not a boolean: `features.roleplay` is true on mm, pr
          // and vps, and this is what picks Mr Muthu, Mr Cheryl or Mr Nair.
          //
          // Passed straight through rather than mapped, with `mm` as the
          // fallback the union needs. The cast is doing real work: `features`
          // has already established this is one of the three, but it cannot
          // narrow `user.tenant` for the type checker. Adding a fourth roleplay
          // tenant and forgetting an entry in the room's ROLEPLAYS map is
          // caught there, at the lookup, not silently defaulted here.
          roleplay={
            user.tenant === "pr" || user.tenant === "vps" ? user.tenant : "mm"
          }
          candidateName={user.name}
          kindLabel={round.company.companyName}
          backHref="/practice"
        />
      );
    }
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

  // Offered here and nowhere else. buildPracticeCustoms is the only flow on
  // this route declaring `stt-native`, which is what the backend forces the
  // moment push-to-talk is on — offering it on a `speech-native` track would
  // have the process type changed underneath a running session.
  return (
    <InterviewRoom
      variant="practice"
      roundId={round.id}
      candidateName={user.name}
      drive={drive}
      kindLabel="Practice interview"
      backHref="/practice"
      pushToTalk
    />
  );
}
