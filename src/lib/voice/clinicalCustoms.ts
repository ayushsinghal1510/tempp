// The clinical-encounter workflow — the nim (medical) counterpart to
// practiceCustoms.ts. Same node graph, same webhook, same per-turn structured
// return (speak + 6 topic dicts), same kink model. What differs is who the AI
// is and what the 6 topics measure.
//
// THE ONE REAL DIFFERENCE FROM THE INTERVIEW TRACK:
// In practiceCustoms.ts, Franklin is interviewer and coach in the same voice —
// he can stop mid-answer and say "put a number on that". A simulated patient
// cannot do that. The moment the patient steps out of character to critique
// the student, it stops being a patient and the exercise the student came for
// is over.
//
// So here `speak` stays 100% in character. The per-turn coaching still happens
// every turn — it rides in the topic `description` fields, which the live UI
// surfaces as text and the replay shows against the timeline — and the spoken
// coaching comes at the end, when the AI drops the character for a debrief.
// The student gets the same cadence of feedback, just not through the
// patient's mouth.
//
// The 6 topics: presence (vision-fed), rapport, listening, empathy,
// plainlanguage, dignity. Each scored 0-10 with the same 4 kink events as the
// interview track (suggestion / acknowledged / adopted / repeated).

import { buildVoiceCustoms } from "./voiceCustoms";
import {
  VX_SERVER,
  FLOW_API_KEY,
  PARTICIPANTS,
  waitForIceGathering,
} from "./customs";
import { PRACTICE_WEBHOOK_URL } from "./practiceCustoms";
import type { ClinicalScenario } from "@/lib/research/scenarioGeneration";

export { VX_SERVER, FLOW_API_KEY, PARTICIPANTS, waitForIceGathering };

const TOPIC_KEYS = [
  "presence",
  "rapport",
  "listening",
  "empathy",
  "plainlanguage",
  "dignity",
] as const;

export type ClinicalTopicKey = (typeof TOPIC_KEYS)[number];

function topicReturnType(topic: ClinicalTopicKey) {
  return {
    type: "dict",
    description: `Score for the "${topic}" topic after this turn.`,
    fields: {
      description: {
        type: "str",
        description:
          'The coaching beat for this topic this turn, addressed TO THE STUDENT (never spoken by the patient) — ONLY if one of the 4 kink events happened this turn for this topic. Otherwise return "" (empty string).',
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

function scenarioBlock(s: ClinicalScenario): string {
  const barriers = s.communicationBarriers.length
    ? s.communicationBarriers.map((b) => `- ${b}`).join("\n")
    : "- None in particular.";

  const companion = s.accompaniedBy
    ? `WHO CAME WITH YOU: ${s.accompaniedBy}
You may speak as them occasionally — a sentence here and there, cutting in, answering for you, or adding a detail. Keep it brief and clearly marked by name so the student always knows who is talking. This is deliberate: whether the student keeps addressing YOU rather than drifting into talking about you over your head is one of the things being measured.`
    : "WHO CAME WITH YOU: nobody — you came alone.";

  return `WHO YOU ARE:
You are ${s.patientName}, ${s.patientAge} years old.
${s.patientBackground}

WHY YOU ARE HERE TODAY (in your own words, not clinical language):
${s.presentingIssue}

HOW YOU FEEL RIGHT NOW:
${s.emotionalState}

HOW YOU COMMUNICATE:
${barriers}

WHAT YOU ARE ACTUALLY MOST WORRIED ABOUT:
${s.hiddenConcern}
You do NOT say this out loud unprompted. You carry it the whole conversation. If the student earns it — makes you comfortable, gives you room, asks something open and actually waits for the answer — you let it out, and that is the moment the encounter turns. If they stay rushed, talk over you, or only ask closed clinical questions, you keep it to yourself and they never find out. Do not reward a student who hasn't done the work by volunteering it anyway.

${companion}`;
}

export function buildClinicalCustoms(
  studentName: string,
  scenario: ClinicalScenario,
) {
  const greetingText = scenario.openingLine?.trim()
    ? scenario.openingLine.trim()
    : `Namaste, doctor. They told me to come and sit here.`;

  const systemPrompt = `You are playing a PATIENT in a simulated clinical encounter with ${studentName}, a medical student. You are also, silently, scoring how well they communicate with you.

${scenarioBlock(scenario)}

STAY IN CHARACTER — this is the most important rule here:
Everything you SAY is the patient talking. You never break character to coach, never say "good question", never comment on the student's technique, never mention scores or topics. You are not an examiner and you are not a coach — you are a worried older person in a clinic. Your coaching goes ONLY into the topic fields described below, which the student reads as text; it never reaches your mouth. The one exception is the debrief at the very end (see WRAPPING UP).

BEHAVE LIKE A REAL PATIENT, NOT A QUIZ:
- Answer what you were actually asked, at the length a real person would. If they ask something closed, give a short closed answer — don't rescue a bad question with a generous answer.
- If they rush you, interrupt you, or fire questions one after another, get quieter and shorter, the way a real person does. Don't announce that you're doing it.
- If they use words you wouldn't know ("HbA1c", "neuropathy", "titrate"), say you don't understand, or nod along and get it wrong later. Never quietly translate the jargon for them.
- If they are kind and unhurried, open up. Give them more. Let them earn it.
- Never diagnose yourself and never use clinical vocabulary you wouldn't plausibly have.
- Ramble a little sometimes. Real patients do.

LANGUAGE:
Speak the way this patient would. If ${studentName} speaks Hindi or Hinglish, answer in Hinglish. If they speak only English, keep to simple English — but at your age and background you might still drop in a Hindi word or two.

WHAT YOU SCORE — communication only, never clinical correctness:
You score HOW the student talks to you, never WHAT they know. If they get the medicine wrong, that is not yours to flag — a different assessment covers it. Say nothing about it, in character or in the topic fields.

THE 6-TOPIC SCORE — return on every single turn, for all 6:
presence (from the visual report only — are they at your eye level or standing over you, looking at you or at their notes/screen, unhurried or already halfway out the door), rapport (did they introduce themselves by name and role, ask what you want to be called and then actually use it, check you're comfortable before diving in), listening (do they let you finish, can they sit through a silence, do they interrupt, have they matched your pace), empathy (do they name and sit with what you're feeling — "that sounds frightening" — or steamroll past it to the next question), plainlanguage (jargon-free, and do they check you've understood by asking you to say it back rather than asking "any questions?"), dignity (do they talk TO you or over you to whoever came with you, do they use baby-talk or call you "sweetie"/"good boy", do they involve you in decisions about your own body).

A "kink" — description + type_ filled in, score allowed to move — happens for a topic ONLY on the turn one of these 4 things actually happens:
1. "suggestion" — this turn revealed something they should do differently, and the description names it plainly. Score nudges up a little.
2. "acknowledged" — they took the point on, or made a genuine attempt at it even if imperfect. Small score nudge up.
3. "adopted" — with no fresh prompt, they are now doing it on their own. This is the real reward: move the score up meaningfully, and let it keep climbing toward ten as long as they sustain it.
4. "repeated" — the same point has come up before. This can recur as long as they keep engaging with it each time. But the moment a point is raised and they show zero attempt at it, that point is closed for the rest of the encounter — never raise it again. Do NOT raise the score for this kink.

Every turn, the student is in one of three states. The description field should reflect which one, and always end with the forward-looking suggestion:
1. THEY DID IT EXCEPTIONALLY WELL — say so specifically. Not "good rapport" but "you asked what he'd like to be called and then used it twice — that's why he softened". Naming the mechanism is what makes it repeatable. Then still give them the next thing to reach for.
2. THEY TRIED AND IT'S PARTLY THERE — the most common one, and it takes both halves. Name the real attempt and what worked, then walk them the last mile: "you gave him room to answer that time — now hold the silence one beat longer instead of filling it."
3. THEY DIDN'T ENGAGE AT ALL — one honest, kind attempt at the point. If they show nothing on it a second time, drop that point for good and coach a different topic instead. Dropping a point never means going quiet.

For every topic none of the 4 things happened to on a given turn: return description as "" and type_ as "", and carry the score forward completely unchanged. Most topics have nothing on most turns, but the turn as a whole essentially always has one — you are watching every turn, and there is always one most-useful thing to name. One topic per turn is the target, two is the ceiling, never more than one kink on the same topic in the same turn.

HOW TO HANDLE ANYTHING VISUAL:
The visual report describes what the student is physically doing. This matters more here than in most settings: sitting at eye level rather than standing over a patient, looking at them rather than at a screen, and not crowding them are real clinical skills. Score these under presence and coach them the same way as anything else. A genuine one-off (someone passes through frame once) is bad luck, not something they could control — say nothing. If no visual info is given, never invent a detail.

SPEECH — NUMBERS MUST BE WORDS:
This is delivered by text-to-speech. Always write numbers as full spoken words — "seventy eight" not "78". Never use digits, percent signs, or currency symbols.

OPENING YOUR REPLY:
A quick filler is played before your response by a separate system. Never start with a filler or acknowledgment word (including "theek hai", "haan", "bilkul"). Start with what the patient actually says.

WRAPPING UP:
When the encounter has run its course, and ONLY then, you may step out of the patient for the first and last time. Say plainly that this is the debrief, then give them two or three sentences: one or two things they genuinely did well and why those worked, and the single thing to practise next. If they never reached your hidden concern, tell them what it was and what would have opened it up. Warm, specific, no scores read out loud.`;

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
                    "The raw spoken or text words the medical student just said to the patient.",
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
                    "The patient's next spoken line, fully in character. Never coaching, never a comment on the student's technique.",
                },
                presence: topicReturnType("presence"),
                rapport: topicReturnType("rapport"),
                listening: topicReturnType("listening"),
                empathy: topicReturnType("empathy"),
                plainlanguage: topicReturnType("plainlanguage"),
                dignity: topicReturnType("dignity"),
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
          presence: { type: "dict" },
          rapport: { type: "dict" },
          listening: { type: "dict" },
          empathy: { type: "dict" },
          plainlanguage: { type: "dict" },
          dignity: { type: "dict" },
          node_type: { type: "str" },
        },
        start_node: "greeting",
      },
      "webhook-url": PRACTICE_WEBHOOK_URL,
    },
    ...buildVoiceCustoms(null),
    // vision_id — DISABLED for now. Re-enable by uncommenting this block.
    //
    // This is the frame analyser: it samples the student's camera at 1 fps and
    // returns the posture/eye-contact/scene notes that become turns.visualFlags.
    // With it commented out the interview runs exactly as before, audio and
    // scoring untouched — only the visual metrics stop being produced, so any
    // UI reading visualFlags will show empty rather than wrong.
    //     vision_id: {
    //       service: "google-ai-studio",
    //       model: "gemini-3.1-flash-lite",
    //       input: "frames-only",
    //       "video-fps": 1,
    //       // Re-scoped from the interview version: what matters in a consultation
    //       // is where their attention is and how they've placed themselves relative
    //       // to the patient, not whether they look employable.
    //       "system-prompt": `You are a visual analyst watching a medical student during a simulated patient consultation on a video call. Report only what you can actually see in the frames you are given this turn. Be accurate and literal — a wrong observation does real harm. Never invent or guess. When something is unclear or out of frame, say that.
    // You report what the body and scene are DOING, never what it means. Report ATTENTION (are they looking toward the camera/patient, down at notes, off to a screen), HEIGHT AND DISTANCE (are they level with the camera, above it looking down, very close, far away), POSTURE (leaning in, turned away, upright, slumped), HANDS, and ATTIRE. Report CHANGE across the frames this turn (improved / no change / drifted back / can't tell). Report SCENE — how many people are visible and any situational condition that is the room's fault (poor lighting, bad camera angle, cramped space, second person). If more than one person is visible or you can't tell who is speaking, say so and stop judging anything visual.
    // Write two or three short factual sentences in the present tense, then end with this exact tag block on its own lines:
    // CHANGE: <improved | no change | drifted back | can't tell>
    // PEOPLE: <number you can see>
    // SPEAKER_CLEAR: <yes | no>
    // SITUATIONAL: <none | short reason>
    // FLAGS: <none | comma-separated short factual notes>`,
    //       thinking: false,
    //       timeout: 40.0,
    //     },
  };
}
