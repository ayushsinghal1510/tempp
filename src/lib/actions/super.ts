"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export type ActionResult = { ok?: true; error?: string };

/** Add a new university with an initial session quota (super admin only). */
export async function createUniversity(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser(["super_admin"]);

  const name = String(formData.get("name") ?? "").trim();
  const allotted = Number(formData.get("sessionsAllotted") ?? 0);

  if (!name) return { error: "University name is required." };
  if (!Number.isFinite(allotted) || allotted < 0) {
    return { error: "Session quota must be a number ≥ 0." };
  }

  const existing = await prisma.university.findFirst({ where: { name } });
  if (existing) return { error: "A university with that name already exists." };

  await prisma.university.create({
    data: { name, sessionsAllotted: Math.round(allotted) },
  });

  revalidatePath("/super/universities");
  revalidatePath("/super");
  return { ok: true };
}

/** Update a university's session quota (super admin only). */
export async function updateUniversityQuota(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireUser(["super_admin"]);

  const id = String(formData.get("id") ?? "");
  const allotted = Number(formData.get("sessionsAllotted") ?? 0);

  if (!id) return { error: "Missing university id." };
  if (!Number.isFinite(allotted) || allotted < 0) {
    return { error: "Session quota must be a number ≥ 0." };
  }

  const uni = await prisma.university.findUnique({ where: { id } });
  if (!uni) return { error: "University not found." };
  if (Math.round(allotted) < uni.sessionsUsed) {
    return {
      error: `Quota can't be below sessions already used (${uni.sessionsUsed}).`,
    };
  }

  await prisma.university.update({
    where: { id },
    data: { sessionsAllotted: Math.round(allotted) },
  });

  revalidatePath(`/super/universities/${id}`);
  revalidatePath("/super/universities");
  revalidatePath("/super");
  return { ok: true };
}
