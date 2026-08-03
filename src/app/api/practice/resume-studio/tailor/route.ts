import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { getAccessibleCompany } from "@/lib/practice/access";
import { getResumeStudio } from "@/lib/practice/resumeStudio";

export const runtime = "nodejs";

/**
 * Fork the base resume into a variant tailored for one company.
 *
 * A copy, not a reference. The student keeps editing both afterwards and the
 * whole point of a tailored resume is that it diverges — a variant that tracked
 * the base would undo its own tailoring the next time they edited the original.
 *
 * The fork deliberately carries `resumeTex` and `sourceText` but NOT `messages`:
 * the new conversation should open on "here's your Acme version, what should I
 * emphasise?", not on twenty turns of history about a different document.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const companyId = typeof body?.companyId === "string" ? body.companyId : null;
  if (!companyId) {
    return NextResponse.json({ error: "companyId required" }, { status: 400 });
  }

  const [company, base, existing] = await Promise.all([
    getAccessibleCompany(user.id, companyId),
    getResumeStudio(user.id, null),
    getResumeStudio(user.id, companyId),
  ]);

  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing) {
    // Already forked — send them to it rather than replacing it. Re-tailoring
    // over the top would silently discard whatever they'd already refined.
    return NextResponse.json({ ok: true, id: existing.id, existed: true });
  }
  if (!base) {
    return NextResponse.json(
      { error: "Build your base resume first." },
      { status: 409 },
    );
  }

  const variant = await prisma.practiceResumeStudio.create({
    data: {
      userId: user.id,
      companyId,
      resumeTex: base.resumeTex,
      sourceText: base.sourceText,
      // Copied so the variant renders immediately instead of paying a compile
      // on first paint. It is a byte-identical document until the agent
      // rewrites it, so the cache is valid.
      pdf: base.pdf,
      messages: [],
    },
  });

  return NextResponse.json({ ok: true, id: variant.id, existed: false });
}
