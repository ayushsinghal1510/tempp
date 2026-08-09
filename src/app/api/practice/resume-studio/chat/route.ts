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
import {
  compileLatex,
  TectonicMissingError,
  TectonicTimeoutError,
} from "@/lib/resume/compile";
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

// How many times the document may be compiled in one turn: the first write
// plus four repair passes. Every failure hands the TeX log back to the model,
// which rewrites and tries again, until it builds or this runs out.
//
// Enforced by counting failures in the handler rather than by the step budget
// alone. stepCountIs bounds how many times the MODEL may act, which is not the
// same quantity — a turn that spends a step on chat text would silently get
// fewer repair passes than one that doesn't, and the cap that matters here is
// on compiles, each of which can burn up to compile.ts's 60s timeout. The
// count is per-request, so a student who replies gets a fresh budget rather
// than inheriting an exhausted one.
const MAX_COMPILE_ATTEMPTS = 5;

// One step per compile attempt, plus a last one for the closing chat message.
// Unbounded steps would let a model that cannot fix its own LaTeX spin until
// the request times out, which the student experiences as the page hanging
// rather than as an error.
const MAX_STEPS = MAX_COMPILE_ATTEMPTS + 1;

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

  // Per-request, and deliberately outside the tool so they survive across the
  // steps of this one turn — the tool closure is re-entered on every call.
  let failedCompiles = 0;

  // Whether the next step MUST be another writeResume call.
  //
  // Asking the model to retry is not enough on its own. When a tool result says
  // "fix it and call writeResume again", a model is equally free to emit a
  // cheerful chat message instead — and because a step with text and no tool
  // call ends the loop, that single non-compliance silently converts a five-
  // attempt repair budget into one attempt, leaving the student a claim that
  // the resume was fixed sitting above a preview pane that never changed.
  // Forcing toolChoice removes the option: mid-repair, the only move available
  // is another write.
  //
  // Cleared on success, when the compiler itself is missing (retrying cannot
  // help) and when the budget runs out (the model has to be able to speak in
  // order to explain the failure).
  let mustRepair = false;

  // Pulled out of `studio` because the hoisted declaration below cannot see
  // the null-guard above it.
  const studioId = studio.id;

  /**
   * The write itself. Returns a result on every path it knows about; anything
   * it does not know about is caught by the wrapper at the call site.
   */
  async function writeResume(tex: string) {
    // The budget is announced in the previous tool result, but a model that
    // ignores it must still be stopped — otherwise "do not retry" is a
    // request, and each ignored one costs another compile (up to 60s) on a
    // document already known not to build.
    if (failedCompiles >= MAX_COMPILE_ATTEMPTS) {
      mustRepair = false;
      return {
        ok: false,
        note: "No repair attempts left in this turn. Your last version is saved. Stop calling writeResume and tell the student the draft won't compile, then ask them to reply so you can try again.",
      };
    }

    const body = sanitizeBody(tex);

    let compiled;
    try {
      compiled = await compileLatex(buildDocument(body));
    } catch (err) {
      // The toolchain is missing or broken. Telling the model to "fix its
      // LaTeX" would send it into a retry loop against a problem no amount of
      // correct LaTeX can solve, so this stops the loop and says so plainly.
      if (err instanceof TectonicMissingError) {
        console.error("[resume-studio]", err.message);
        // Saved before returning, for the same reason the compile-failure
        // branch below saves: the note tells the model to tell the student
        // their resume was saved, and that has to be true. This branch used to
        // return without writing anything, which discarded the document the
        // model had just produced — and on a server with no tectonic at all,
        // that is EVERY write, silently.
        await saveResumeTex(studioId, body, null);
        // Not a repair case: the LaTeX may be perfect. Forcing another write
        // here would spend the whole budget re-running a compiler that isn't
        // installed.
        mustRepair = false;
        return {
          ok: false,
          note:
            "STOP. The PDF compiler is not installed on this server, so NO resume can be rendered right now and no amount of correct LaTeX will change that. Do not call writeResume again.\n\n" +
            "Your version WAS saved, so nothing is lost. Now tell the student, in plain words, that their resume could not be rendered because the PDF compiler is unavailable on the server, and that this is a server problem for their administrator — not something they or you can fix by editing the resume.\n\n" +
            "Do NOT say the resume has been updated, tailored, rendered or is ready to download. It is not on screen and they cannot download it.",
        };
      }

      // A timeout, not a TeX error — the document may be perfectly valid and
      // there is no log to fix it from. Handled alongside the missing binary
      // rather than with compile failures: sending the model back to "repair"
      // this rewrites good content chasing an error that was never in the
      // LaTeX, and each attempt costs another full timeout.
      if (err instanceof TectonicTimeoutError) {
        console.error("[resume-studio]", err.message);
        await saveResumeTex(studioId, body, null);
        mustRepair = false;
        return {
          ok: false,
          note:
            "STOP. The compiler ran out of time and was stopped — this is NOT an error in your LaTeX, and rewriting it will not help. Do not call writeResume again.\n\n" +
            "Your version WAS saved. Tell the student the resume took too long to render this time, that their edit is saved, and that they can ask again in a moment.",
        };
      }

      throw err;
    }

    if (!compiled.ok) {
      // Saved anyway, with the PDF cache left null. The student's words are in
      // this document; discarding them because a brace is unbalanced would
      // lose real work, and the next turn starts from this text and repairs it.
      await saveResumeTex(studioId, body, null);
      failedCompiles++;
      const repairsLeft = MAX_COMPILE_ATTEMPTS - failedCompiles;
      // Force the next step back into the tool while there is still budget. At
      // zero the model needs its voice back to explain.
      mustRepair = repairsLeft > 0;
      console.warn(
        `[resume-studio] compile failed for ${studioId} (attempt ${failedCompiles}/${MAX_COMPILE_ATTEMPTS}, ${repairsLeft} left)`,
      );
      return { ok: false, note: compileFailureMessage(compiled.log, repairsLeft) };
    }

    await saveResumeTex(studioId, body, compiled.pdf);
    mustRepair = false;
    return {
      ok: true,
      note: "Compiled successfully. The student can see the updated resume. Now reply in chat, briefly.",
    };
  }

  const result = streamText({
    model: groq(MODEL),
    system,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    stopWhen: stepCountIs(MAX_STEPS),
    // The forcing half of the repair loop — see `mustRepair`. Left as the
    // model's own choice on every other step, so an ordinary turn (answer a
    // question, edit nothing) is completely unaffected.
    prepareStep: () =>
      mustRepair
        ? { toolChoice: { type: "tool" as const, toolName: "writeResume" as const } }
        : {},
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
        // Wrapped so that NOTHING escapes as a thrown error.
        //
        // A throw out of execute() becomes a tool part in state "output-error",
        // which carries no `output` at all — so the model finishes the turn
        // having seen no failure and cheerfully reports the edit it believes it
        // made, while the page shows no badge, keeps the previous PDF up and
        // says nothing. That is the exact shape of "it told me it changed the
        // resume and it didn't", and it is reachable from any unreachable
        // database or refused object-storage upload. Converting it into an
        // ordinary failed result means the model is told the truth, and so is
        // the student.
        execute: async ({ tex }) =>
          writeResume(tex).catch((err) => {
            console.error("[resume-studio] writeResume failed for", studioId, err);
            mustRepair = false;
            return {
              ok: false as const,
              note:
                "STOP. Saving the resume failed with a server error — this is NOT a problem with your LaTeX, and rewriting it will not help. Do not call writeResume again.\n\n" +
                "The resume on screen has NOT changed. Tell the student plainly that the change could not be saved because of a server error, that nothing was applied, and that they should try again shortly or tell their administrator. Do NOT claim the resume was updated or tailored.",
            };
          }),
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
      // Assistant messages can arrive with an empty id, and this transcript is
      // replayed straight into the client's keyed list on the next page load —
      // two of them collide on the key "" and React warns that it may drop or
      // duplicate one. Stamping ids here fixes it once, at the point the bad
      // value would be written down, rather than in every consumer.
      const withIds = finalMessages.map((m, i) =>
        m.id ? m : { ...m, id: `${studioId}-${Date.now()}-${i}` },
      );

      await prisma.practiceResumeStudio
        .update({
          where: { id: studioId },
          data: { messages: withIds as unknown as object[] },
        })
        .catch((err) => {
          console.error("[resume-studio] failed to persist transcript", err);
        });
    },
  });
}
