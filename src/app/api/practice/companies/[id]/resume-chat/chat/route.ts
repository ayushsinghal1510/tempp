import { NextResponse } from "next/server";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { groq } from "@ai-sdk/groq";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import type { CompanyResearch } from "@/lib/research/companyResearch";

export const runtime = "nodejs";

const MODEL = "openai/gpt-oss-120b";

function assistantMessage(text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    parts: [{ type: "text", text }],
  };
}

function researchBlock(research: CompanyResearch | null): string {
  if (!research) return "";
  const lines = [
    research.about && `About: ${research.about}`,
    research.domain && `Domain: ${research.domain}`,
    research.interviewStyle && `Interview style: ${research.interviewStyle}`,
    research.signatureTopics?.length &&
      `Topics they drill: ${research.signatureTopics.join(", ")}`,
    research.sampleQuestions?.length &&
      `Representative questions: ${research.sampleQuestions.join(" | ")}`,
    research.values?.length && `What they value: ${research.values.join(", ")}`,
  ].filter(Boolean);
  return lines.length ? `\nCOMPANY RESEARCH:\n${lines.join("\n")}` : "";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: companyId } = await params;

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [chat, company, profile] = await Promise.all([
    prisma.practiceResumeChat.findUnique({ where: { companyId } }),
    prisma.practiceCompany.findUnique({
      where: { id: companyId },
      select: {
        userId: true,
        companyName: true,
        jobTitle: true,
        companyResearch: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, course: true, cgpa: true },
    }),
  ]);

  if (!chat || !company || company.userId !== user.id || chat.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const systemPrompt = `You are a warm, encouraging career coach helping ${profile?.name ?? "the student"} prepare for their ${company.companyName} interview${company.jobTitle ? ` for ${company.jobTitle}` : ""}.

You have their resume and this company's real research below — use both together to answer questions about their weak points, what to study, what concepts to brush up on, and how to present their experience well for this specific company. Be specific and grounded in their actual resume content and this company's actual interview style — never generic, one-size-fits-all advice.

KEEP EVERY REPLY SHORT AND STRAIGHT TO THE POINT. Students don't want to read an essay. A few short sentences or a short bullet list (3-6 items) is almost always enough — never write multi-week schedules, big tables, or numbered mega-sections unless they explicitly ask for a detailed plan. When in doubt, cut it down. Use markdown for light structure (a short heading, a bullet list, bold for one or two key words) — never emojis, ever, and never pad with filler.

BE GENUINE, NOT GENERIC. Short does not mean vague. Every answer must be grounded in something real — an actual line from their resume, an actual thing from this company's research — never advice so generic it could apply to any student at any company. If you don't have something specific and true to say, say less, don't pad it with filler that sounds helpful but isn't.

Be encouraging and constructive, even when pointing out real gaps — but say it in a couple of sentences, not a report.
${profile?.course ? `\nSTUDENT: ${profile.course}${profile.cgpa != null ? `, CGPA ${profile.cgpa}` : ""}` : ""}
${researchBlock(company.companyResearch as CompanyResearch | null)}

RESUME:
${chat.resumeText}`;

  const result = streamText({
    model: groq(MODEL),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 700,
    onFinish: async ({ text }) => {
      await prisma.practiceResumeChat.update({
        where: { companyId },
        data: { messages: [...messages, assistantMessage(text)] },
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
