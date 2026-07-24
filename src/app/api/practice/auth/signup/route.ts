import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie, homePathForRole } from "@/lib/auth/session";

const DEGREES = [
  "btech",
  "mtech",
  "bba",
  "mba",
  "bca",
  "mca",
  "bcom",
  "mcom",
] as const;

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  course: z.enum(DEGREES).optional(),
  cgpa: z.number().min(0).max(10).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name.trim(),
      email,
      passwordHash,
      role: "practice",
      universityId: null,
      course: parsed.data.course,
      cgpa: parsed.data.cgpa,
    },
  });

  const sessionUser = {
    id: user.id,
    role: user.role,
    universityId: user.universityId,
    name: user.name,
    email: user.email,
  };
  await setSessionCookie(sessionUser);

  return NextResponse.json({
    user: sessionUser,
    redirect: homePathForRole(user.role),
  });
}
