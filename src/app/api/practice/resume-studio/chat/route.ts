import { NextResponse } from "next/server";
import {
  streamText,
  tool,
  stepCountIs,
  convertToModelMessages,
  type UIMessage,
} from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { getAccessibleCompany } from "@/lib/practice/access";
import { getResumeStudio, saveResumeTex } from "@/lib/practice/resumeStudio";
import { compileLatex, TectonicMissingError } from "@/lib/resume/compile";
import { buildDocument, sanitizeBody } from "@/lib/resume/template";
import { buildSystemPrompt, compileFailureMessage } from "@/lib/resume/prompt";
import type { CompanyResearch } from "@/lib/research/companyResearch";

export const runtime = "nodejs";

// Same model as the resume chat. A resume body runs 800-1500 tokens and a
// compile retry sends the whole thing again, so the budget is much larger than
// the coach route's 700 — a truncated document is a guaranteed compile failure
// and burns a retry to discover it.
const MODEL = "openai/gpt-oss-120b";
const MAX_OUTPUT_TOKENS = 6_000;

// One initial attempt plus up to two compile-failure retries, then the closing
// chat message. Unbounded retries would let a model that cannot fix its own
// LaTeX spin until the request times out, which the student experiences as the
// page hanging rather than as an error.
const MAX_STEPS = 4;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const companyId = url.searchParams.get("company");

  const [studio, profile] = await Promise.all([
    getResumeStudio(user.id, companyId),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, course: true, cgpa: true },
    }),
  ]);

  if (!studio || !profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // A variant's companyId came off the student's own row, so it was authorised
  // when the variant was created — but re-checking here is what keeps an
  // un-assigned company's research out of the prompt after access is revoked.
  const company = companyId ? await getAccessibleCompany(user.id, companyId) : null;
  if (companyId && !company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const system = buildSystemPrompt({
    studentName: profile.name,
    studentEmail: profile.email,
    course: profile.course,
    cgpa: profile.cgpa,
    sourceText: studio.sourceText,
    currentTex: studio.resumeTex || null,
    company: company
      ? {
          name: company.companyName,
          jobTitle: company.jobTitle,
          jobDescription: company.jobDescription,
          research: company.companyResearch as CompanyResearch | null,
        }
      : null,
  });

  const result = streamText({
    model: groq(MODEL),
    system,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    stopWhen: stepCountIs(MAX_STEPS),
    tools: {
      writeResume: tool({
        description:
          "Replace the student's resume with a new version. Pass the COMPLETE " +
          "LaTeX body — everything you pass replaces the whole document, so " +
          "anything you leave out is deleted. Call this every time the resume " +
          "should change.",
        inputSchema: z.object({
          tex: z
            .string()
            .describe(
              "The complete LaTeX body, from the \\begin{center} header block " +
                "to the last section. No preamble, no \\begin{document}.",
            ),
        }),
        execute: async ({ tex }) => {
          const body = sanitizeBody(tex);

          let compiled;
          try {
            compiled = await compileLatex(buildDocument(body));
          } catch (err) {
            // The toolchain is missing or broken. Telling the model to "fix its
            // LaTeX" would send it into a retry loop against a problem no
            // amount of correct LaTeX can solve, so this stops the loop and
            // says so plainly.
            if (err instanceof TectonicMissingError) {
              console.error("[resume-studio]", err.message);
              return {
                ok: false,
                note: "The PDF compiler is unavailable on the server. Do not retry — tell the student their resume was saved but cannot be rendered right now.",
              };
            }
            throw err;
          }

          if (!compiled.ok) {
            // Saved anyway, with the PDF cache left null. The student's words
            // are in this document; discarding them because a brace is
            // unbalanced would lose real work, and the next turn starts from
            // this text and can repair it.
            await saveResumeTex(studio.id, body, null);
            return { ok: false, note: compileFailureMessage(compiled.log) };
          }

          await saveResumeTex(studio.id, body, compiled.pdf);
          return {
            ok: true,
            note: "Compiled successfully. The student can see the updated resume. Now reply in chat, briefly.",
          };
        },
      }),
    },
    onError: ({ error }) => {
      console.error("[resume-studio] stream error", error);
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    // Persisting from here rather than streamText's onFinish: this callback
    // hands back full UIMessages including the tool-call parts, which is what
    // the client needs to re-render the transcript on reload. streamText's
    // onFinish only sees the final text, so a reloaded page would show the
    // assistant's closing sentence with no sign the resume was ever rewritten.
    onFinish: async ({ messages: finalMessages }) => {
      await prisma.practiceResumeStudio
        .update({
          where: { id: studio.id },
          data: { messages: finalMessages as unknown as object[] },
        })
        .catch((err) => {
          console.error("[resume-studio] failed to persist transcript", err);
        });
    },
  });
}
