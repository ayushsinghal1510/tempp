"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import {
  researchCompany,
  type CompanyResearch,
} from "@/lib/research/companyResearch";
import { tierForSalary } from "@/lib/research/tierProfiles";

export type ActionResult = { ok?: true; error?: string };

export type ResearchResult =
  { ok: true; research: CompanyResearch } | { ok?: false; error: string };

const DEFAULT_STUDENT_PASSWORD = "password123";

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Add a student to the admin's university (creates their login too). */
export async function createStudent(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireUser(["admin"]);
  if (!admin.universityId) {
    return { error: "This admin account has no university." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const course = String(formData.get("course") ?? "").trim();
  const rollNumber = String(formData.get("rollNumber") ?? "").trim();
  const sems = [1, 2, 3, 4].map((i) => Number(formData.get(`sem${i}`)));

  if (!name) return { error: "Name is required." };
  if (!rollNumber) return { error: "Roll number is required." };
  if (!course) return { error: "Course is required." };
  if (sems.some((s) => !Number.isFinite(s) || s < 0 || s > 100)) {
    return { error: "Each semester score must be a percentage 0–100." };
  }

  const academicPercent =
    Math.round((sems.reduce((a, b) => a + b, 0) / sems.length) * 10) / 10;

  const uni = await prisma.university.findUnique({
    where: { id: admin.universityId },
  });
  if (!uni) return { error: "University not found." };

  // Derive a login email from the roll number so the student can sign in.
  const email = `${slug(rollNumber)}@${slug(uni.name)}.prepai.in`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "A student with that roll number already exists." };
  }

  const passwordHash = await hashPassword(DEFAULT_STUDENT_PASSWORD);

  await prisma.user.create({
    data: {
      role: "student",
      name,
      email,
      passwordHash,
      universityId: admin.universityId,
      student: {
        create: {
          universityId: admin.universityId,
          name,
          email,
          academicPercent,
          course,
          rollNumber,
          semesterScores: sems,
        },
      },
    },
  });

  revalidatePath("/admin/students");
  return { ok: true };
}

// The five interviews every enrolled student gets, all "pending" until run.
const SESSION_ROUNDS = [
  { type: "coaching", roundNumber: 1 },
  { type: "coaching", roundNumber: 2 },
  { type: "coaching", roundNumber: 3 },
  { type: "test", roundNumber: 4 },
  { type: "test", roundNumber: 5 },
] as const;

const DEFAULT_SKILL_PRIORITIES = [
  "Framing",
  "Ownership",
  "Quantification",
  "Concision",
  "Approach",
];

/**
 * Step 1 of cohort creation: research the company via Groq compound. Returns an
 * editable draft the admin reviews before approving. Not persisted here — the
 * approved (possibly edited) object is submitted with createCohort.
 */
export async function runCompanyResearch(input: {
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  salaryLpa: number;
}): Promise<ResearchResult> {
  await requireUser(["admin"]);

  const companyName = input.companyName?.trim();
  const jobTitle = input.jobTitle?.trim();
  const jobDescription = input.jobDescription?.trim() ?? "";
  const salaryLpa = Number(input.salaryLpa);

  if (!companyName) return { error: "Company name is required to research." };
  if (!jobTitle) return { error: "Job title is required to research." };
  if (!Number.isFinite(salaryLpa) || salaryLpa <= 0) {
    return { error: "Enter a valid salary before researching." };
  }

  try {
    const research = await researchCompany({
      companyName,
      jobTitle,
      jobDescription,
      tier: tierForSalary(salaryLpa) ?? "tier_3",
      salaryLpa,
    });
    return { ok: true, research };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Research failed." };
  }
}

/**
 * Start a cohort: create the cohort + vacancy, enroll the chosen students, and
 * give each a full session (3 coaching + 2 test rounds, all pending). Each
 * enrolled student consumes one unit of the university's session pool.
 */
export async function createCohort(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireUser(["admin"]);
  if (!admin.universityId) {
    return { error: "This admin account has no university." };
  }

  const companyName = String(formData.get("companyName") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const jobDescription = String(formData.get("jobDescription") ?? "").trim();
  const salaryLpa = Number(formData.get("salaryLpa"));
  const studentIds = formData.getAll("studentIds").map(String).filter(Boolean);

  // When the drive / interviews happen (optional). Accepts a yyyy-mm-dd or full
  // datetime string from the form.
  const driveDateRaw = String(formData.get("driveDate") ?? "").trim();
  const driveDate = driveDateRaw ? new Date(driveDateRaw) : null;
  const driveDateValid =
    driveDate && !Number.isNaN(driveDate.getTime()) ? driveDate : null;

  // The approved (possibly edited) company research from step 1, if any.
  let companyResearch: CompanyResearch | null = null;
  const researchRaw = String(formData.get("companyResearch") ?? "").trim();
  if (researchRaw) {
    try {
      companyResearch = JSON.parse(researchRaw) as CompanyResearch;
    } catch {
      companyResearch = null;
    }
  }

  if (!companyName) return { error: "Company name is required." };
  if (!jobTitle) return { error: "Job title is required." };
  if (!jobDescription) return { error: "Job description is required." };
  if (!Number.isFinite(salaryLpa) || salaryLpa <= 0) {
    return { error: "Salary (LPA) must be a positive number." };
  }
  if (studentIds.length === 0) {
    return { error: "Select at least one student for the cohort." };
  }

  const uni = await prisma.university.findUnique({
    where: { id: admin.universityId },
  });
  if (!uni) return { error: "University not found." };

  // Only enroll students that actually belong to this university.
  const validStudents = await prisma.student.findMany({
    where: { id: { in: studentIds }, universityId: admin.universityId },
    select: { id: true },
  });
  if (validStudents.length === 0) {
    return { error: "None of the selected students are at your university." };
  }

  const need = validStudents.length;
  const left = uni.sessionsAllotted - uni.sessionsUsed;
  if (need > left) {
    return {
      error: `Not enough session pool — ${left} left, this cohort needs ${need}. Ask the operator to raise the quota.`,
    };
  }

  const tier = tierForSalary(salaryLpa);

  await prisma.$transaction(async (tx) => {
    const cohort = await tx.cohort.create({
      data: {
        universityId: admin.universityId!,
        companyName,
        status: "active",
        companyResearch: companyResearch
          ? (companyResearch as object)
          : undefined,
        driveDate: driveDateValid ?? undefined,
        vacancies: {
          create: {
            jobTitle,
            jobDescription,
            skillPriorities: DEFAULT_SKILL_PRIORITIES,
            salaryLpa,
            tier,
          },
        },
      },
      include: { vacancies: true },
    });
    const vacancyId = cohort.vacancies[0]?.id;

    for (const s of validStudents) {
      await tx.cohortStudent.create({
        data: { cohortId: cohort.id, studentId: s.id, vacancyId },
      });
      await tx.session.create({
        data: {
          cohortId: cohort.id,
          studentId: s.id,
          sessionNumber: 1,
          status: "pending",
          scheduledAt: driveDateValid ?? undefined,
          rounds: {
            create: SESSION_ROUNDS.map((r) => ({
              type: r.type,
              roundNumber: r.roundNumber,
              status: "pending",
            })),
          },
        },
      });
    }

    await tx.university.update({
      where: { id: admin.universityId! },
      data: { sessionsUsed: { increment: need } },
    });
  });

  revalidatePath("/admin/cohorts");
  revalidatePath("/super/universities");
  revalidatePath("/student");
  return { ok: true };
}
