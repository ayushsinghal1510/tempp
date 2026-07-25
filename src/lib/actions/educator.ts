"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { Prisma, PracticeAssignmentMode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { requireEducatorOrgId } from "@/lib/practice/access";
import { userTag, companyTag } from "@/lib/practice/cacheTags";
import {
  researchCompany,
  type CompanyResearch,
} from "@/lib/research/companyResearch";
import { tierForSalary } from "@/lib/research/tierProfiles";

export type ActionResult = { ok?: true; error?: string };

/** Every educator action starts here: session + role + org, in one call. */
async function requireEducator(): Promise<{ userId: string; orgId: string }> {
  const user = await requireUser(["practice_admin"], "/educator/login");
  const orgId = await requireEducatorOrgId(user.id);
  return { userId: user.id, orgId };
}

// Unambiguous alphabet — no O/0, I/1/L. These get read off a slide and typed
// by a room full of students, so the cost of a lookalike character is high.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join(
    "",
  );
}

/** A code no group currently holds. Retries rather than trusting randomness. */
async function uniqueJoinCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = randomCode();
    const taken = await prisma.practiceGroup.findUnique({
      where: { joinCode: code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  throw new Error("Could not allocate a join code — try again.");
}

// ─────────────────────────── companies ────────────────────────────

export type CompanyResult =
  | { ok: true; companyId: string }
  | { ok?: false; error: string };

/**
 * Register a company for the whole org and research it once.
 *
 * Unlike the student's self-serve createCompany, the result lands as `draft`:
 * the educator reviews and edits the generated research before any student
 * sees it. Research failure is not fatal here either — the educator can write
 * the brief by hand rather than being blocked on Groq.
 */
export async function createOrgCompany(
  _prev: CompanyResult,
  formData: FormData,
): Promise<CompanyResult> {
  const { orgId } = await requireEducator();

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
      orgId,
      userId: null,
      status: "draft",
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

  revalidatePath("/educator/companies");
  return { ok: true, companyId: company.id };
}

/** The company, scoped to the caller's org. Null when it isn't theirs. */
async function ownedCompany(orgId: string, companyId: string) {
  const company = await prisma.practiceCompany.findUnique({
    where: { id: companyId },
    select: { id: true, orgId: true, status: true },
  });
  return company && company.orgId === orgId ? company : null;
}

/** Save the educator's edits to the generated research brief. */
export async function updateCompanyResearch(
  companyId: string,
  research: CompanyResearch,
): Promise<ActionResult> {
  const { orgId } = await requireEducator();
  if (!(await ownedCompany(orgId, companyId))) {
    return { error: "Company not found." };
  }

  await prisma.practiceCompany.update({
    where: { id: companyId },
    data: { companyResearch: research as unknown as Prisma.InputJsonValue },
  });

  revalidatePath(`/educator/companies/${companyId}`);
  return { ok: true };
}

/**
 * Publish (or unpublish) a company. Draft companies are invisible to students
 * even where an assignment already exists — see getAccessibleCompany.
 */
export async function setCompanyPublished(
  companyId: string,
  published: boolean,
): Promise<ActionResult> {
  const { orgId } = await requireEducator();
  if (!(await ownedCompany(orgId, companyId))) {
    return { error: "Company not found." };
  }

  await prisma.practiceCompany.update({
    where: { id: companyId },
    data: { status: published ? "published" : "draft" },
  });

  // Assigned students' company lists change the moment this flips.
  const assignees = await prisma.practiceAssignment.findMany({
    where: { companyId },
    select: { userId: true },
  });
  for (const a of assignees) updateTag(userTag(a.userId));
  updateTag(companyTag(companyId));

  revalidatePath("/educator/companies");
  revalidatePath(`/educator/companies/${companyId}`);
  return { ok: true };
}

// ─────────────────────────── assignments ────────────────────────────

/**
 * Assign a company to every current member of a class.
 *
 * Students who join later are backfilled by joinGroupByCode, so the educator
 * doesn't have to remember to re-assign after each new enrolment.
 */
export async function assignCompanyToGroup(
  companyId: string,
  groupId: string,
  mode: PracticeAssignmentMode,
  dueDate: Date | null,
): Promise<ActionResult> {
  const { orgId } = await requireEducator();
  if (!(await ownedCompany(orgId, companyId))) {
    return { error: "Company not found." };
  }

  const group = await prisma.practiceGroup.findUnique({
    where: { id: groupId },
    select: { orgId: true, members: { select: { userId: true } } },
  });
  if (!group || group.orgId !== orgId) return { error: "Class not found." };

  // skipDuplicates leans on the (companyId, userId) unique so re-assigning
  // never disturbs a student who already has this company.
  await prisma.practiceAssignment.createMany({
    data: group.members.map((m) => ({
      companyId,
      userId: m.userId,
      groupId,
      mode,
      dueDate,
    })),
    skipDuplicates: true,
  });

  for (const m of group.members) updateTag(userTag(m.userId));
  updateTag(companyTag(companyId));
  revalidatePath(`/educator/companies/${companyId}`);
  return { ok: true };
}

/** Change the visibility mode of every assignment for one company + class. */
export async function setAssignmentMode(
  companyId: string,
  groupId: string,
  mode: PracticeAssignmentMode,
): Promise<ActionResult> {
  const { orgId } = await requireEducator();
  if (!(await ownedCompany(orgId, companyId))) {
    return { error: "Company not found." };
  }

  const affected = await prisma.practiceAssignment.findMany({
    where: { companyId, groupId },
    select: { userId: true },
  });
  await prisma.practiceAssignment.updateMany({
    where: { companyId, groupId },
    data: { mode },
  });

  for (const a of affected) updateTag(userTag(a.userId));
  updateTag(companyTag(companyId));
  revalidatePath(`/educator/companies/${companyId}`);
  return { ok: true };
}

// ─────────────────────────── classes ────────────────────────────

export async function createGroup(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { orgId } = await requireEducator();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Class name is required." };

  await prisma.practiceGroup.create({
    data: { orgId, name, joinCode: await uniqueJoinCode() },
  });

  revalidatePath("/educator/groups");
  return { ok: true };
}

/**
 * Issue a fresh join code. Existing members keep their membership — this only
 * stops new students joining with the old code (e.g. after it leaks beyond
 * the class).
 */
export async function rotateJoinCode(groupId: string): Promise<ActionResult> {
  const { orgId } = await requireEducator();

  const group = await prisma.practiceGroup.findUnique({
    where: { id: groupId },
    select: { orgId: true },
  });
  if (!group || group.orgId !== orgId) return { error: "Class not found." };

  await prisma.practiceGroup.update({
    where: { id: groupId },
    data: { joinCode: await uniqueJoinCode() },
  });

  revalidatePath("/educator/groups");
  revalidatePath(`/educator/groups/${groupId}`);
  return { ok: true };
}

/**
 * Remove a student from a class.
 *
 * Their assignments and past rounds are deliberately left alone: the sessions
 * really happened, and deleting the assignment rows would silently revoke the
 * student's access to companies they already have history against.
 */
export async function removeMember(
  groupId: string,
  userId: string,
): Promise<ActionResult> {
  const { orgId } = await requireEducator();

  const group = await prisma.practiceGroup.findUnique({
    where: { id: groupId },
    select: { orgId: true },
  });
  if (!group || group.orgId !== orgId) return { error: "Class not found." };

  await prisma.practiceMember.deleteMany({ where: { groupId, userId } });

  revalidatePath(`/educator/groups/${groupId}`);
  return { ok: true };
}
