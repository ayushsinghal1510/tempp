import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie, homePathForRole } from "@/lib/auth/session";
import { joinGroupByCode } from "@/lib/practice/joinGroup";
import { autoEnrol } from "@/lib/practice/autoEnrol";
import { tenantForEmail, acceptedDomains, TENANTS } from "@/lib/tenants/config";

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
  // Optional: enrols the new account in an educator's class straight away.
  joinCode: z.string().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();

  // Which product this account gets is decided here, once, from the domain —
  // and then stored. An unrecognised domain can't sign up at all. This gate is
  // on signup only: login reads the stored tenant, so accounts created before
  // this rule existed are unaffected.
  const tenant = tenantForEmail(email);
  if (!tenant) {
    return NextResponse.json(
      {
        error: `Sign-ups are limited to institute email addresses (${acceptedDomains().join(", ")}). Use your institute address, or ask your educator.`,
      },
      { status: 403 },
    );
  }

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
      tenant,
      universityId: null,
      // Degree/CGPA key the expectation matrix, which is engineering-shaped.
      // A tenant that doesn't collect them must not store them either, even
      // if a hand-crafted request supplies them.
      ...(TENANTS[tenant].features.courseField
        ? { course: parsed.data.course, cgpa: parsed.data.cgpa }
        : {}),
    },
  });

  // A bad class code must never cost the student their new account — the
  // signup has already succeeded by here, so a failed join is reported
  // alongside it rather than thrown.
  let joinedGroup: string | null = null;
  let joinError: string | null = null;
  if (parsed.data.joinCode?.trim()) {
    const outcome = await joinGroupByCode(user.id, parsed.data.joinCode);
    if (outcome.ok) joinedGroup = outcome.groupName;
    else joinError = outcome.error;
  } else if (TENANTS[tenant].features.autoEnroll) {
    // One customer, one org: asking their staff for a code to reach the thing
    // their own admin published would be friction with nothing behind it.
    // Best-effort — a customer whose org isn't set up yet still gets an
    // account, they just see nothing until it is.
    joinedGroup = await autoEnrol(user.id, tenant);
  }

  const sessionUser = {
    id: user.id,
    role: user.role,
    tenant: user.tenant,
    universityId: user.universityId,
    name: user.name,
    email: user.email,
  };
  await setSessionCookie(sessionUser);

  return NextResponse.json({
    user: sessionUser,
    joinedGroup,
    joinError,
    redirect: homePathForRole(user.role),
  });
}
