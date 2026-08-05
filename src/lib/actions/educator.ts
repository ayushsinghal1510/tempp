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
import {
  generateScenario,
  normaliseScenario,
  type ClinicalScenario,
} from "@/lib/research/scenarioGeneration";
import { tenantConfig } from "@/lib/tenants/config";
import {
  normaliseWorkflow,
  DEFAULT_WORKFLOW,
  type CustomWorkflow,
} from "@/lib/voice/workflowCustoms";

export type ActionResult = { ok?: true; error?: string };

/** Every educator action starts here: session + role + org + tenant, in one call. */
async function requireEducator(): Promise<{
  userId: string;
  orgId: string;
  tenant: ReturnType<typeof tenantConfig>;
}> {
  const user = await requireUser(["practice_admin"], "/educator/login");
  const orgId = await requireEducatorOrgId(user.id);
  return { userId: user.id, orgId, tenant: tenantConfig(user.tenant) };
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
  const { orgId, tenant } = await requireEducator();
  if (!tenant.features.company) {
    return { error: "Your institute creates scenarios, not companies." };
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

// ─────────────────────────── scenarios (nim) ────────────────────────────

/**
 * Create a simulated patient encounter from the educator's one-line brief.
 *
 * Mirrors createOrgCompany exactly, including the posture on generation
 * failure: the row is still created (as a draft, with `scenario` null) so the
 * educator can write the case by hand rather than being blocked on Groq. It
 * shares PracticeCompany with the interview track — see PracticeCompanyKind —
 * which is what lets assignments, access control and the whole educator UI
 * work on it unchanged.
 */
export async function createOrgScenario(
  _prev: CompanyResult,
  formData: FormData,
): Promise<CompanyResult> {
  const { orgId, tenant } = await requireEducator();
  if (!tenant.features.scenario) {
    return { error: "Your institute creates companies, not scenarios." };
  }

  const brief = String(formData.get("brief") ?? "").trim();
  if (!brief) {
    return { error: "Describe the patient — even one line is enough." };
  }

  const scenario = await generateScenario({ brief }).catch(() => null);

  const company = await prisma.practiceCompany.create({
    data: {
      orgId,
      userId: null,
      status: "draft",
      kind: "scenario",
      // companyName is the display title for both kinds. Falling back to the
      // educator's own brief keeps the row identifiable when generation failed.
      companyName: scenario?.title || brief.slice(0, 120),
      scenario: scenario
        ? (scenario as unknown as Prisma.InputJsonValue)
        : undefined,
    },
  });

  revalidatePath("/educator/companies");
  return { ok: true, companyId: company.id };
}

/** Save the educator's edits to a generated patient case. */
export async function updateScenario(
  companyId: string,
  scenario: ClinicalScenario,
): Promise<ActionResult> {
  const { orgId } = await requireEducator();
  if (!(await ownedCompany(orgId, companyId))) {
    return { error: "Scenario not found." };
  }

  // Re-normalised server-side: this object is injected straight into the
  // simulated patient's system prompt, so it must not be shape-trusted just
  // because it came back from our own form.
  const clean = normaliseScenario(scenario);

  await prisma.practiceCompany.update({
    where: { id: companyId },
    data: {
      scenario: clean as unknown as Prisma.InputJsonValue,
      // The title is what students and the assign panel see.
      ...(clean.title ? { companyName: clean.title } : {}),
    },
  });

  updateTag(companyTag(companyId));
  revalidatePath(`/educator/companies/${companyId}`);
  return { ok: true };
}

// ─────────────────────────── workflows (cus) ────────────────────────────

/**
 * Create a custom voice workflow — a greeting and a prompt, nothing else.
 *
 * Created `published` rather than `draft`, unlike companies and scenarios.
 * Those two exist to be reviewed before a cohort sees them; this one belongs
 * to the customer who is also the only reviewer, and the whole point of the
 * tenant is that what they write reaches their people immediately.
 */
export async function createOrgWorkflow(
  _prev: CompanyResult,
  formData: FormData,
): Promise<CompanyResult> {
  const { orgId, tenant } = await requireEducator();
  if (!tenant.features.workflow) {
    return { error: "Your organisation doesn't use custom workflows." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the workflow a name." };

  const company = await prisma.practiceCompany.create({
    data: {
      orgId,
      userId: null,
      status: "published",
      kind: "workflow",
      companyName: name,
      workflow: DEFAULT_WORKFLOW as unknown as Prisma.InputJsonValue,
    },
  });

  await revalidateOrgMembers(orgId);
  revalidatePath("/educator/companies");
  return { ok: true, companyId: company.id };
}

/**
 * Save the greeting and prompt. This is the whole product for `cus`, so it
 * takes effect on the next session with no publish step in between.
 */
export async function updateWorkflow(
  companyId: string,
  workflow: CustomWorkflow,
): Promise<ActionResult> {
  const { orgId, tenant } = await requireEducator();
  const owned = await ownedCompany(orgId, companyId);
  if (!owned) return { error: "Workflow not found." };

  // Refused rather than ignored. `mm` stores its roleplay as a workflow row too
  // (see tenants/config.ts), but the call is built from muthuPrompt.ts and
  // never reads that JSON — so a save here would appear to succeed and change
  // nothing about the next session, which is the worse of the two failures.
  // The UI already renders it read-only; this is the half that can't be
  // bypassed by posting to the action directly.
  if (!tenant.features.workflow) {
    return { error: "This simulation is fixed and can't be edited." };
  }

  // Re-normalised server-side: this string becomes the agent's system prompt,
  // so it is not trusted for shape just because it came back from our own form.
  const clean = normaliseWorkflow(workflow);

  await prisma.practiceCompany.update({
    where: { id: companyId },
    data: { workflow: clean as unknown as Prisma.InputJsonValue },
  });

  // "Anything the admin does reflects to all users" is the contract, so every
  // member's cached company list is dropped here rather than waiting out the
  // 60s TTL.
  updateTag(companyTag(companyId));
  await revalidateOrgMembers(orgId);
  revalidatePath(`/educator/companies/${companyId}`);
  return { ok: true };
}

/** Drop the cached reads of every user in this org. */
async function revalidateOrgMembers(orgId: string): Promise<void> {
  const members = await prisma.practiceMember.findMany({
    where: { group: { orgId } },
    select: { userId: true },
  });
  for (const m of new Set(members.map((x) => x.userId))) updateTag(userTag(m));
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

/**
 * Reopen an assignment that locked when its deadline (plus grace) passed.
 *
 * One-way and permanent: `deadlineState` treats a set `unlockedAt` as
 * outranking the clock, so a reopened assignment never re-locks. That is the
 * point — an educator who reopens something for a student who was in hospital
 * should not have to keep reopening it every two days.
 */
export async function unlockAssignment(
  companyId: string,
  userId: string,
): Promise<ActionResult> {
  const { orgId } = await requireEducator();
  if (!(await ownedCompany(orgId, companyId))) {
    return { error: "Company not found." };
  }

  // updateMany, not update: scoped by companyId so an educator can't reopen an
  // assignment on someone else's company by passing a bare assignment id.
  const { count } = await prisma.practiceAssignment.updateMany({
    where: { companyId, userId, unlockedAt: null },
    data: { unlockedAt: new Date() },
  });
  if (count === 0) {
    // Already unlocked, or no such assignment. Both are fine to report as
    // success — the desired end state (the student can start) already holds.
    return { ok: true };
  }

  updateTag(userTag(userId));
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

// ─────────────────────────── student readiness ───────────────────────────

/**
 * Mark a student ready (or not) to sit a real interview.
 *
 * The educator's judgement, stored as-is. It is not derived from scores and
 * nothing recomputes it — see the StudentReadiness enum for why.
 *
 * REACHABILITY IS THE AUTHORISATION. There is no per-student ownership record
 * to check: a practice student belongs to classes and holds assignments, not
 * to an educator. So the check is the same one every educator read already
 * makes — does this student hold an assignment on one of my org's companies,
 * or sit in one of my org's classes. Either is enough, and a student who is in
 * neither is reported as not found rather than as forbidden, because from this
 * educator's side of the product they do not exist.
 */
export async function setStudentReadiness(
  userId: string,
  ready: boolean,
): Promise<ActionResult> {
  const { orgId } = await requireEducator();

  const reachable = await prisma.user.findFirst({
    where: {
      id: userId,
      role: "practice",
      OR: [
        { practiceAssignments: { some: { company: { orgId } } } },
        { practiceMemberships: { some: { group: { orgId } } } },
      ],
    },
    select: { id: true },
  });
  if (!reachable) return { error: "Student not found." };

  await prisma.user.update({
    where: { id: userId },
    data: { readiness: ready ? "ready" : "not_ready" },
  });

  // Every educator surface that shows the badge. The student's own pages are
  // deliberately not revalidated — nothing on their side reads this.
  revalidatePath("/educator");
  revalidatePath("/educator/students");
  revalidatePath(`/educator/students/${userId}`);
  revalidatePath("/educator/groups");
  return { ok: true };
}
