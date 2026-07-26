"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { getAccessibleCompany, getResumeChatFor } from "@/lib/practice/access";
import { joinGroupByCode } from "@/lib/practice/joinGroup";
import { researchCompany } from "@/lib/research/companyResearch";
import { tierForSalary } from "@/lib/research/tierProfiles";
import { userTag, companyTag, roundTag } from "@/lib/practice/cacheTags";
import { tenantConfig } from "@/lib/tenants/config";
import { deadlineState } from "@/lib/practice/deadline";

export type ActionResult = { ok?: true; error?: string };

export type CompanyResult =
  { ok: true; companyId: string } | { ok?: false; error: string };

/**
 * Register a company — self-served by the student, once per company. Runs
 * the same Groq-based research used by the admin flow, exactly once (not
 * per session). Unlike the admin flow, there's no manual research-review
 * step first: research runs inline and, if it fails (e.g. Groq is down),
 * the company is still created with companyResearch left null rather than
 * blocking the student.
 */
export async function createCompany(
  _prev: CompanyResult,
  formData: FormData,
): Promise<CompanyResult> {
  const user = await requireUser(["practice"], "/practice/login");

  // Enforced here and not only by hiding the form: on the clinical track a
  // student has no business registering their own company, and the UI being
  // absent is not an access control.
  if (!tenantConfig(user.tenant).features.company) {
    return { error: "Your sessions are set by your educator." };
  }

  const companyName = String(formData.get("companyName") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const jobDescription = String(formData.get("jobDescription") ?? "").trim();
  const salaryLpa = Number(formData.get("salaryLpa"));

  if (!companyName) return { error: "Company name is required." };
  if (!jobTitle) return { error: "Job title is required." };
  if (!Number.isFinite(salaryLpa) || salaryLpa <= 0) {
    return { error: "Enter a valid salary (LPA)." };
  }

  const tier = tierForSalary(salaryLpa) ?? "tier_3";

  const research = await researchCompany({
    companyName,
    jobTitle,
    jobDescription,
    tier,
    salaryLpa,
  }).catch(() => null);

  const company = await prisma.practiceCompany.create({
    data: {
      userId: user.id,
      companyName,
      jobTitle,
      jobDescription,
      salaryLpa,
      tier,
      companyResearch: research
        ? (research as Prisma.InputJsonValue)
        : undefined,
    },
  });

  updateTag(userTag(user.id));
  revalidatePath("/practice");
  return { ok: true, companyId: company.id };
}

/**
 * Enrol in an educator's class with a code they shared. Any companies the
 * educator already assigned to that class become available immediately.
 */
export async function joinClass(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser(["practice"], "/practice/login");

  const outcome = await joinGroupByCode(
    user.id,
    String(formData.get("joinCode") ?? ""),
  );
  if (!outcome.ok) return { error: outcome.error };

  updateTag(userTag(user.id));
  revalidatePath("/practice");
  revalidatePath("/practice/companies");
  return { ok: true };
}

/** Start a new practice session under an existing company. */
export async function createSession(companyId: string): Promise<never> {
  const user = await requireUser(["practice"], "/practice/login");

  const company = await getAccessibleCompany(user.id, companyId);
  if (!company) {
    throw new Error("Company not found.");
  }

  // Resume-grounded interviews: the resume has to exist before a session can
  // start at all — send them to upload it first instead of creating a round.
  // Per-student, not per-company: on a shared company each student uploads
  // their own.
  //
  // Gated on the tenant because the clinical track has no resume at all: the
  // session is the educator's patient case, so there is nothing for a student
  // to upload and nothing to gate on.
  if (tenantConfig(user.tenant).features.resume) {
    const resumeChat = await getResumeChatFor(user.id, companyId);
    if (!resumeChat) {
      redirect(`/practice/companies/${companyId}/resume-chat`);
    }
  }

  // A locked assignment is refused here, not just hidden in the UI. The button
  // is disabled on the list, but this action is reachable directly, and the
  // check must run BEFORE the session pool is decremented below — otherwise a
  // refused start would still burn one of the class's paid seats.
  const assignment = await prisma.practiceAssignment.findUnique({
    where: { companyId_userId: { companyId, userId: user.id } },
    select: { dueDate: true, unlockedAt: true },
  });
  if (assignment && !deadlineState(assignment).canStart) {
    throw new Error(
      "This session is past its deadline and has been locked. Ask your educator to reopen it.",
    );
  }

  // Org-owned companies draw on the educator's contracted session pool. Check
  // and increment together so two tabs can't both slip through on the last
  // seat — the conditional updateMany returns 0 when the pool is already
  // spent. Self-registered companies are unmetered, as before.
  if (company.orgId) {
    const { count } = await prisma.practiceOrg.updateMany({
      where: {
        id: company.orgId,
        sessionsUsed: { lt: prisma.practiceOrg.fields.sessionsAllotted },
      },
      data: { sessionsUsed: { increment: 1 } },
    });
    if (count === 0) {
      throw new Error(
        "Your class has used all of its practice sessions. Ask your educator to top up.",
      );
    }
  }

  const round = await prisma.practiceRound.create({
    data: { userId: user.id, companyId: company.id },
  });

  updateTag(userTag(user.id));
  updateTag(companyTag(companyId));
  revalidatePath(`/practice/companies/${companyId}`);
  redirect(`/practice/rounds/${round.id}/brief`);
}

/** Mark a practice round in-progress when the student actually starts the interview. */
export async function startPracticeRound(
  roundId: string,
): Promise<ActionResult> {
  const user = await requireUser(["practice"], "/practice/login");

  const round = await prisma.practiceRound.findUnique({
    where: { id: roundId },
  });
  if (!round || round.userId !== user.id) {
    return { error: "Round not found." };
  }

  if (round.status === "pending") {
    await prisma.practiceRound.update({
      where: { id: roundId },
      data: { status: "in_progress", startedAt: new Date() },
    });
    updateTag(userTag(user.id));
    updateTag(roundTag(roundId));
    if (round.companyId) updateTag(companyTag(round.companyId));
    revalidatePath("/practice");
  }

  return { ok: true };
}

/**
 * Mark a practice round completed when the student leaves the interview.
 * For now, leaving simply ends the round — no separate "did it actually
 * finish properly" signal yet.
 */
export async function completePracticeRound(
  roundId: string,
  /**
   * True when the browser is about to push a recording for this round in the
   * background. Recorded here, before the student navigates away, so the
   * results page knows to wait for a file rather than concluding there is
   * none — the upload itself reports `ready` when it lands.
   */
  recordingExpected = false,
): Promise<ActionResult> {
  const user = await requireUser(["practice"], "/practice/login");

  const round = await prisma.practiceRound.findUnique({
    where: { id: roundId },
  });
  if (!round || round.userId !== user.id) {
    return { error: "Round not found." };
  }

  if (round.status !== "completed") {
    await prisma.practiceRound.update({
      where: { id: roundId },
      data: {
        status: "completed",
        completedAt: new Date(),
        // Never downgrade: a fast upload can beat this write, and clobbering
        // `ready` back to `processing` would leave the page polling forever.
        ...(recordingExpected && round.recordingStatus !== "ready"
          ? { recordingStatus: "processing" as const }
          : {}),
      },
    });
    updateTag(userTag(user.id));
    updateTag(roundTag(roundId));
    revalidatePath("/practice");
    revalidatePath(`/practice/rounds/${roundId}`);
    if (round.companyId) {
      updateTag(companyTag(round.companyId));
      revalidatePath(`/practice/companies/${round.companyId}`);
    }
  }

  return { ok: true };
}
