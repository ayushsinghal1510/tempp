"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

// NOTE: company research here is a canned generator standing in for the
// Groq tool-calling web search described in the brief (§9). The New Cohort UI
// and the create/schedule flow are real; the research call is stubbed.
export async function researchCompany(name: string) {
  await new Promise((r) => setTimeout(r, 1200)); // simulate the research call
  return {
    summary: `${name} — profile assembled from public sources: interview focus areas, question style, and what strong candidates demonstrate.`,
    questionThemes: [
      { theme: "Role-specific technical depth", frequency: 0.9 },
      { theme: "Behavioral (ownership, STAR)", frequency: 0.75 },
      { theme: "Problem solving under ambiguity", frequency: 0.6 },
      { theme: "Communication & business awareness", frequency: 0.45 },
    ],
    focusAreas: ["Fundamentals", "Applied problem solving", "Communication"],
  };
}

const schema = z.object({
  companyName: z.string().min(1),
  jobTitle: z.string().min(1),
  jobDescription: z.string().min(1),
  skillPriorities: z.string().default(""),
  salaryLpa: z.string().optional(),
  minAcademicPercent: z.string().optional(),
  students: z.string().default(""), // one per line: Name, email, academic%, branch
});

export type CreateCohortResult = { ok: boolean; error?: string; cohortId?: string };

export async function createCohort(
  raw: z.infer<typeof schema>,
): Promise<CreateCohortResult> {
  const user = await currentUser();
  if (!user || user.role !== "admin" || !user.universityId) {
    return { ok: false, error: "Not authorised" };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Please fill the required fields." };
  const d = parsed.data;

  const research = await researchCompany(d.companyName);
  const passwordHash = await hashPassword("password123");

  const cohort = await prisma.cohort.create({
    data: {
      universityId: user.universityId,
      companyName: d.companyName,
      status: "active",
      companyResearch: research,
      vacancies: {
        create: {
          jobTitle: d.jobTitle,
          jobDescription: d.jobDescription,
          skillPriorities: d.skillPriorities
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          salaryLpa: d.salaryLpa ? Number(d.salaryLpa) : null,
          minAcademicPercent: d.minAcademicPercent
            ? Number(d.minAcademicPercent)
            : null,
        },
      },
    },
    include: { vacancies: true },
  });
  const vacancyId = cohort.vacancies[0]?.id;

  // Parse + import students, then schedule Session 1 for each.
  const lines = d.students
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const scheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  for (const line of lines) {
    const [name, email, academic, branch] = line.split(",").map((s) => s.trim());
    if (!name || !email) continue;
    const academicPercent = Number(academic) || 0;

    const existing = await prisma.user.findUnique({ where: { email } });
    let studentId: string;
    if (existing) {
      const stu = await prisma.student.findUnique({ where: { userId: existing.id } });
      if (!stu) continue;
      studentId = stu.id;
    } else {
      const created = await prisma.user.create({
        data: {
          role: "student",
          universityId: user.universityId,
          name,
          email,
          passwordHash,
          student: {
            create: {
              universityId: user.universityId,
              name,
              email,
              academicPercent,
              branch: branch || null,
            },
          },
        },
        include: { student: true },
      });
      studentId = created.student!.id;
    }

    await prisma.cohortStudent.upsert({
      where: { cohortId_studentId: { cohortId: cohort.id, studentId } },
      create: { cohortId: cohort.id, studentId, vacancyId },
      update: { vacancyId },
    });
    await prisma.session.create({
      data: {
        cohortId: cohort.id,
        studentId,
        sessionNumber: 1,
        status: "pending",
        scheduledAt,
      },
    });
  }

  revalidatePath("/admin/cohorts");
  revalidatePath("/admin");
  return { ok: true, cohortId: cohort.id };
}
