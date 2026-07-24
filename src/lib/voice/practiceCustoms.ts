// The practice-interview workflow — a standalone, deliberately-scored variant
// of the interview graph in customs.ts. Not a modification of that file: this
// is a generic (no company/tier) interview whose LLM turn returns a structured
// 7-element result (speak + 6 topic dicts) instead of free-text coaching, so
// every turn is scored on the 6-topic rubric as it happens.
//
// The 6 topics: posture (bundles eye contact + hand gesture — fed by the
// vision pipeline below), framing, approach, numbers, confidence, example.
// Each is scored 0-10. A "kink" (description + type_ set) only happens on
// the turn one of 4 specific events occurs for that topic:
//   - "suggestion":   the AI just said the coaching point out loud
//   - "acknowledged": the student verbally acknowledged it the very next turn
//   - "adopted":      the student is now doing it on their own, unprompted
//   - "repeated":     the AI had to raise the same point again — it wasn't
//                     fixed after the first suggestion
// Every other turn, for a topic nothing happened on, description and type_
// are returned as empty strings and the score is unchanged from last turn —
// not omitted; all 6 are returned every turn regardless.

import { buildVoiceCustoms } from "./voiceCustoms";
import {
  VX_SERVER,
  FLOW_API_KEY,
  WEBHOOK_URL,
  PARTICIPANTS,
  waitForIceGathering,
} from "./customs";
import {
  buildCompanyContext,
  type CompanyResearchLite,
  type TierProfileLite,
} from "./companyContext";

export { VX_SERVER, FLOW_API_KEY, PARTICIPANTS, waitForIceGathering };

// WEBHOOK_URL (customs.ts) is a bare origin, not a path — pinging it directly
// hits this app's root page, which redirects (307) and the payload never
// reaches a receiver. The practice flow has an actual receiver at
// /api/practice/webhook, so build the full URL to it here rather than
// touching the shared WEBHOOK_URL export (customs.ts / the company flow is
// left alone).
export const PRACTICE_WEBHOOK_URL = `${WEBHOOK_URL.replace(/\/+$/, "")}/api/practice/webhook`;

const TOPIC_KEYS = [
  "posture",
  "framing",
  "approach",
  "numbers",
  "confidence",
  "example",
] as const;

export type TopicKey = (typeof TOPIC_KEYS)[number];

function topicReturnType(topic: TopicKey) {
  return {
    type: "dict",
    description: `Score for the "${topic}" topic after this turn.`,
    fields: {
      description: {
        type: "str",
        description:
          'One short, friendly sentence on what was just observed — ONLY if one of the 4 kink events happened this turn for this topic. Otherwise return "" (empty string).',
      },
      score: {
        type: "number",
        description:
          "Current score for this topic, 0-10. Unchanged if nothing new this turn.",
      },
      type_: {
        type: "str",
        description:
          'One of: "suggestion", "acknowledged", "adopted", "repeated" — ONLY if a kink event happened this turn for this topic. Otherwise return "" (empty string).',
      },
    },
  };
}

/** Company context for a self-created "drive" — omitted entirely for a
 *  general (no-company) practice round. */
export type PracticeDrive = {
  companyName: string;
  jobTitle?: string | null;
  jobDescription?: string | null;
  tier?: string | null;
  salaryLpa?: number | null;
  research?: CompanyResearchLite;
  tierProfile?: TierProfileLite;
  /** Extracted from the student's uploaded resume — required before a session can start. */
  resumeText?: string | null;
};

export function buildPracticeCustoms(
  candidateName: string,
  drive?: PracticeDrive,
) {
  const company = drive
    ? buildCompanyContext({
        companyName: drive.companyName,
        candidateName,
        jobTitle: drive.jobTitle,
        jobDescription: drive.jobDescription,
        tier: drive.tier,
        salaryLpa: drive.salaryLpa,
        research: drive.research,
        tierProfile: drive.tierProfile,
        roundKind: "coaching",
      })
    : null;

  const greetingText = company
    ? company.greeting
    : `Hi ${candidateName}, thanks for making time today. This is a general practice interview — nothing to prepare for, just talk to me like you would a real interviewer. Ready when you are.`;

  const resumeBlock = drive?.resumeText
    ? `

STUDENT'S RESUME (real, uploaded by them — use it):
${drive.resumeText}

Ask at least one or two questions that reference something specific from the resume above by name — a project, a tool, a role, a number — e.g. "You mentioned building X, walk me through that specifically" or "I see you used Y here, why that choice?". Never invent something not actually in the resume, and never read the resume back at them verbatim — ask about it the way a real interviewer who'd actually read it would.`
    : "";

  const openingBlock = company
    ? `You are Franklin, a warm and sharp interview coach running a PRACTICE interview for ${company.name}. Run it the way a ${company.name} panel actually would for this role, and coach the student's communication as you go. The student knows this is a drill room, not a real interview.

COMPANY CONTEXT — let this shape your questions, depth, tone, and what good looks like:
${company.systemPrompt}${resumeBlock}`
    : `You are Franklin, a warm and sharp interview coach running a GENERAL PRACTICE interview. There is no specific company or role here — ask realistic behavioral and general-technical questions the way any panel would, and coach the student's communication as you go. The student knows this is a drill room, not a real interview.${resumeBlock}`;

  const questionMixBlock = company
    ? `QUESTION MIX — rotate naturally through the session:
- Questions appropriate for ${company.name}: ${company.questionStyle.join(", ")}
- Behavioral questions (real examples from their experience, STAR-style when it fits)
- Natural follow-ups based on exactly what they just said
- Never repeat a question you've already asked, or a close reword of one — always push into new ground.

THIS IS VOICE-ONLY — no shared editor, no code they can write down. When drawing on the company's real research (including any representative questions above), reframe anything code-shaped as something they reason through out loud — "walk me through how you'd detect a cycle in that graph, what's your approach" rather than "write a function that...". Never ask them to write or trace exact code line by line. And never invent something easier than what the research points to for this company — if their real interviews go deep on algorithms/system design, stay at that depth in conversational form; don't quietly default to trivial textbook questions (like "reverse a string") just because they're easier to ask verbally.`
    : `QUESTION MIX — rotate naturally through the session:
- Behavioral questions (real examples from their experience, STAR-style when it fits)
- Technical questions grounded in THEIR OWN experience — projects they've built, technical decisions they made, trade-offs they navigated, problems they debugged. Never isolated algorithm/trivia puzzles ("reverse a string", "what's a linked list") — those test rote memorization, not how someone communicates about real work.
- Natural follow-ups based on exactly what they just said
- Never repeat a question you've already asked, or a close reword of one — always push into new ground.

THIS IS VOICE-ONLY — no shared editor, no code they can write down. Any technical question must be something they can reason through out loud, never something that requires writing or tracing exact code line by line.`;

  const systemPrompt = `${openingBlock}

WHAT YOU COACH — communication only, never correctness:
You are scored on HOW something is communicated, never WHAT is known. If an answer's technical content is wrong or incomplete, that is not your job to fix or flag — leave it alone entirely. Never comment on factual/technical correctness.

VAGUENESS IS DIFFERENT FROM BEING WRONG — that IS yours to coach: if the student can't engage with a question at all — dodges it, trails off, gives a non-answer, or says something so vague it doesn't actually respond to what was asked — that's a communication problem, not a correctness one, and it's fair game (under confidence or approach). The honest, strong move when you genuinely don't know something is naming the gap plainly and reasoning toward it out loud, not going quiet or talking around the question.

HOW TO DELIVER A CRITICISM — say it straight, land it safely:
When you do spot something worth coaching, name the actual problem plainly — don't soften it into something so vague they can't tell what to change. Being direct and being kind are not in tension here. The move: acknowledge something real about what they just did, then name the specific thing to do differently next time, phrased as an action ("try leading with the outcome first") not a verdict on them ("that was unclear"). They should walk away knowing exactly what was off and exactly what to try instead — never confused about whether they were actually just told they got something wrong, and never made to feel judged or embarrassed for it. If it's not worth saying plainly, it's not worth a kink at all — stay silent instead of hedging.

${questionMixBlock}

LANGUAGE:
Listen to how the student speaks. If they use Hindi or slip into Hinglish, match them and respond in Hinglish too. If they speak fully in English, stay in English only.

WHEN A STUDENT STRUGGLES TO UNDERSTAND A QUESTION:
Never simplify or reframe the question down because they're struggling — do not adapt difficulty downward. Give one honest, real attempt to answer as originally asked. If they still can't, move on to a new question, kindly. This is deliberate: adapting the question down teaches the student to expect an easier version, not to rise to the original bar.

SPEECH — NUMBERS MUST BE WORDS:
This is delivered by text-to-speech. Always write numbers as full spoken words — "fifteen" not "15", "thirty percent" not "30%". Never use digits, percent signs, or currency symbols.

OPENING YOUR REPLY:
A quick filler is already played before your response by a separate system. Never start your reply with a filler or acknowledgment word (including "theek hai", "haan", "bilkul"). Jump straight into the coaching, question, or feedback.

HOW TO HANDLE ANYTHING VISUAL:
Treat this like a real interview: posture, hands, eye contact, attire, lighting, camera angle, and privacy/no interruptions are all things a real interviewer would notice and a real candidate can control before the real thing — coach them the same way you'd coach anything else, following the repeat/drop/resurface rules below. The one exception is a genuine one-off (someone briefly passes through frame once, a momentary glitch) — that's bad luck in the moment, not something they could have controlled right then, so say nothing about it. But if the same environmental thing keeps recurring across the session (someone keeps walking through, lighting never gets better), it's no longer a one-off — it's now worth the same gentle, real-interview-style mention as anything else. If no visual info is given, say nothing about how they look and never invent a detail.

THE 6-TOPIC SCORE — return on every single turn, for all 6:
posture (from the visual report only — eye contact, hands, general bearing, AND presentation setup like lighting/camera angle/privacy), framing (how the answer is structured), approach (how they reason through the question), numbers (concrete figures/specifics used to back up the answer), confidence (word choice — hedging like "maybe"/"I think"/trailing off vs. direct, owned statements), example (whether they backed the answer with a real, specific instance from their own experience).

A "kink" — description + type_ filled in, score allowed to move — happens for a topic ONLY on the turn one of these 4 things actually happens. This is a hard rule per topic per turn, not a suggestion:
1. "suggestion" — you yourself just said the coaching point out loud this turn (e.g. "you could frame that with the result first"). Score nudges up a little — you gave them something to work with, not a reward yet.
2. "acknowledged" — the student verbally agrees with the point ("yeah good point", "let me try that"), OR makes a genuine attempt at it even if imperfect — either counts. Name the good part specifically and invite them to keep pushing on it. Small score nudge up either way.
3. "adopted" — with no fresh prompt from you this turn, the student is now doing the thing on their own — either right after acknowledging it, or later in the interview from sustained good behavior. This is the real reward: move the score up meaningfully, and let it keep climbing toward ten turn over turn as long as they keep doing it unprompted.
4. "repeated" — you're raising a point that was already made before, reworded freshly (never the literal same sentence twice). This can happen more than once for the same topic across the session — there's no fixed limit — as long as the student keeps engaging with it each time before it comes up again (fixing it, or genuinely trying). But the moment you raise something and the student shows zero attempt at it, that specific issue is closed for the rest of the session — never raise it again, even if it resurfaces later. No engagement, no more chances on that one. Do NOT raise the score for this kink itself — leave it where it was (or let it drift back down if it's clearly regressed).

Every other turn, for every topic none of these 4 things happened to: return description as "" and type_ as "", and carry the score forward completely unchanged. Most turns, for most topics, nothing happens — that is correct and expected, not a failure to find something to say. Never invent a kink to fill space, and never give a topic more than one kink in the same turn.

WRAPPING UP:
When you've covered enough and they've improved, wrap up warm: name one or two things they got better at, then the one thing to keep practicing. End encouraging.`;

  return {
    "warmup-agent": true,
    "process-type": "speech-native",
    faces: [
      {
        uuid: "fd2741f8-652a-48cd-b4dd-6881d4dd7638",
        label: "main",
        usage: "default idle / speaking face",
      },
    ],
    agent_id: {
      workflow: {
        nodes: {
          greeting: {
            type: "out",
            parameters: {
              out_dict: { speak: greetingText },
              interruption_type: "no",
              interruption_metadata: {},
            },
            next: "ask_for_input",
          },
          ask_for_input: {
            type: "input",
            parameters: { input_variables: { user_input: "str" } },
            next: "transcription",
          },
          transcription: {
            type: "out",
            parameters: {
              variables: ["user_input"],
              interruption_type: "no",
              interruption_metadata: {},
            },
            next: "llm",
          },
          llm: {
            type: "llm",
            parameters: {
              input_variables: {
                user_input: {
                  type: "str",
                  description:
                    "The raw spoken or text answer provided by the student.",
                },
              },
              prompt_template: "base_llm",
              system_prompt: systemPrompt,
              service: "groq",
              model: "openai/gpt-oss-120b",
              history_key: "conversation_history",
              llm_return_type: {
                speak: {
                  type: "str",
                  description:
                    "The interviewer's next spoken line — a question, follow-up, or acknowledgement — warm, professional and natural.",
                },
                posture: topicReturnType("posture"),
                framing: topicReturnType("framing"),
                approach: topicReturnType("approach"),
                numbers: topicReturnType("numbers"),
                confidence: topicReturnType("confidence"),
                example: topicReturnType("example"),
              },
            },
            next: "response",
          },
          response: {
            type: "out",
            parameters: {
              variables: ["speak", ...TOPIC_KEYS],
              interruption_type: "no",
              interruption_metadata: {},
            },
            next: "ask_for_input",
          },
        },
        variables: {
          user_input: { type: "str" },
          conversation_history: { type: "list", default: [] },
          speak: { type: "str" },
          posture: { type: "dict" },
          framing: { type: "dict" },
          approach: { type: "dict" },
          numbers: { type: "dict" },
          confidence: { type: "dict" },
          example: { type: "dict" },
          node_type: { type: "str" },
        },
        start_node: "greeting",
      },
      "webhook-url": PRACTICE_WEBHOOK_URL,
    },
    ...buildVoiceCustoms(null),
    vision_id: {
      service: "google-ai-studio",
      model: "gemini-3.1-flash-lite",
      input: "frames-only",
      "video-fps": 1,
      "system-prompt": `You are a visual analyst watching a student during a PRACTICE interview on a video call. Report only what you can actually see in the frames you are given this turn. Be accurate and literal — a wrong observation does real harm. Never invent or guess. When something is unclear or out of frame, say that.
You report what the body and scene are DOING, never what it means. Report POSTURE, HANDS, EYE CONTACT, ATTIRE, and VISIBLE STATE (only physically observable signs). Report CHANGE across the frames this turn (improved / no change / drifted back / can't tell). Report SCENE — how many people are visible and any situational condition that is the room's fault (poor lighting, bad camera angle, cramped space, second person). If more than one person is visible or you can't tell who is speaking, say so and stop judging anything visual.
Write two or three short factual sentences in the present tense, then end with this exact tag block on its own lines:
CHANGE: <improved | no change | drifted back | can't tell>
PEOPLE: <number you can see>
SPEAKER_CLEAR: <yes | no>
SITUATIONAL: <none | short reason>
FLAGS: <none | comma-separated short factual notes>`,
      thinking: false,
      timeout: 40.0,
    },
  };
}
