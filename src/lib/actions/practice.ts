"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { researchCompany } from "@/lib/research/companyResearch";
import { tierForSalary } from "@/lib/research/tierProfiles";
import { userTag, companyTag, roundTag } from "@/lib/practice/cacheTags";

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

/** Start a new practice session under an existing company. */
export async function createSession(companyId: string): Promise<never> {
  const user = await requireUser(["practice"], "/practice/login");

  const company = await prisma.practiceCompany.findUnique({
    where: { id: companyId },
  });
  if (!company || company.userId !== user.id) {
    throw new Error("Company not found.");
  }

  // Resume-grounded interviews: the resume has to exist before a session can
  // start at all — send them to upload it first instead of creating a round.
  const resumeChat = await prisma.practiceResumeChat.findUnique({
    where: { companyId },
    select: { id: true },
  });
  if (!resumeChat) {
    redirect(`/practice/companies/${companyId}/resume-chat`);
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
      data: { status: "completed", completedAt: new Date() },
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
