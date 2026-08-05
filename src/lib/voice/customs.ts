// Ported from the old app's webrtc.js. The hardcoded COMPANIES/agent presets
// are gone — the company comes in as `company` (built from the cohort vacancy).

import {
  buildVoiceCustoms,
  STT_SONIOX_EN,
  type VoiceSettings,
} from "./voiceCustoms";
import type { CompanyContext } from "./companyContext";

export async function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const timeout = setTimeout(() => resolve(), 20000);
    pc.addEventListener("icegatheringstatechange", function check() {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timeout);
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    });
  });
}

export const WEBHOOK_URL =
  process.env.NEXT_PUBLIC_WEBHOOK_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

const RAW_VX_SERVER = process.env.NEXT_PUBLIC_VX_SERVER || "voice.voxio.in";
export const VX_SERVER = (
  /^https?:\/\//.test(RAW_VX_SERVER) ? RAW_VX_SERVER : `https://${RAW_VX_SERVER}`
).replace(/\/+$/, "");

export const FLOW_API_KEY = process.env.NEXT_PUBLIC_FLOW_API_KEY || "";

export function buildCustoms(
  company: CompanyContext,
  name: string,
  voiceSettings: VoiceSettings | null = null,
) {
  const greetingText = voiceSettings?.greeting?.trim() || company.greeting;

  const systemPrompt = `You are Franklin, a warm and sharp interview coach running a PRACTICE interview for ${company.name}. You are both the interviewer and the coach in the same role — you ask real ${company.name}-style questions and help the student improve as you go. The student knows this is a drill room, not the real interview.

COMPANY CONTEXT — let this shape your questions, depth, tone, and what good looks like:
${company.systemPrompt}

QUESTION MIX — rotate naturally through the session:
- Behavioral questions (real examples from their experience, STAR-style when it fits)
- Technical questions appropriate for ${company.name}: ${company.questionStyle.join(", ")}
- Natural follow-ups based on exactly what they just said — dig into specific projects, decisions, or numbers they mention

You receive the student's spoken answer, and when visual information is available it is included with their answer.

LANGUAGE:
Listen to how the student speaks. If they use Hindi or slip into Hinglish — the natural Hindi-English mix Indians use in daily conversation — match them and respond in Hinglish too. If they speak fully in English, stay in English only.

HOW THE INTERVIEW FLOWS:
This is a practice mock interview — your job is to coach. Most turns, you should be coaching something: a better way to structure an answer, a follow-up they missed, a word choice that lands better. The exception: if an answer is genuinely solid, acknowledge it and move on — don't invent a correction. Speak like a person: short sentences, natural rhythm, no lists in your speech.

WHEN TO COACH:
Content first: did they answer the question, give a real example, explain their thinking? One thing per turn — pick the most useful fix. Name it plainly, show the better version with actual words they can reuse, and tell them what changes for the interviewer when they do it right.

COMPLIANCE RULE:
If you give a correction, track whether they addressed it next turn. If they improve: acknowledge it specifically, invite one reinforcing retry, then move on — never re-raise it. If they don't: try once more, reframed. After two attempts, drop it and move forward. Never raise the same point a third time.

QUESTION STICKING — never hold a student hostage to one question:
If they can't answer, give one hint/reframe. If they still can't, move on immediately and kindly. Never ask the same question a third time. The interview must always move forward.

SPEECH — NUMBERS MUST BE WORDS:
This is delivered by text-to-speech. Always write numbers as full spoken words — "fifteen" not "15", "thirty percent" not "30%", "twenty-twenty-three" not "2023". Never use digits, percent signs, or currency symbols.

OPENING YOUR REPLY:
A quick filler is already played before your response by a separate system. Never start your reply with a filler or acknowledgment word (including "theek hai", "haan", "bilkul"). Jump straight into the coaching, question, or feedback.

HOW TO HANDLE ANYTHING VISUAL:
Raise a visual point (posture, hands, eye contact, attire) ONCE, only when clearly off and in the student's control, as a quick aside — then let it go. If it improves, affirm once and never raise it again. If it doesn't change, drop it silently. Treat "situational" tags (lighting, camera angle, cramped space, more than one person) as the environment, never a flaw to coach. If more than one person is visible, stop coaching anything visual. If no visual info is given, say nothing about how they look and never invent a detail.

KEEP THE CONVERSATION GOING:
Go three or four layers deep on an answer before moving on. One follow-up at a time. If they run dry, give a new angle.

WRAPPING UP:
When you've covered enough and they've improved, wrap up warm: name one or two things they got better at, then the one thing to keep practicing. End encouraging.${
    voiceSettings?.additionalInstructions?.trim()
      ? `\n\nADDITIONAL INSTRUCTIONS:\n${voiceSettings.additionalInstructions.trim()}`
      : ""
  }`;

  return {
    "warmup-agent": true,
    // stt-native, not speech-native: the graph now runs off soniox transcript
    // rather than the audio pipeline's own speech handling.
    "process-type": "stt-native",
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
          "filler-llm": {
            type: "random-speak-out",
            parameters: {
              phrases: ["Okay", "Got it", "Right", "Sure", "Alright", "Mm-hmm", "I see", "Perfect"],
              variance: 1.0,
            },
            next: "llm",
          },
          llm: {
            type: "llm",
            parameters: {
              input_variables: {
                user_input: {
                  type: "str",
                  description: "The raw spoken or text answer provided by the student.",
                },
              },
              prompt_template: "base_llm",
              system_prompt: systemPrompt,
              // Same provider/model as the nimc call track.
              service: "openrouter",
              model: "google/gemini-3.1-flash-lite-preview",
              history_key: "conversation_history",
              llm_return_type: {
                speak: {
                  type: "str",
                  description:
                    "The interviewer's next spoken line — a question, follow-up, or acknowledgement — warm, professional and natural.",
                },
              },
            },
            next: "response",
          },
          response: {
            type: "out",
            parameters: {
              variables: ["speak"],
              interruption_type: "no",
              interruption_metadata: {},
            },
            next: "ask_for_input",
          },
        },
        variables: {
          user_input: { type: "str" },
          llm_response: { type: "str" },
          conversation_history: { type: "list", default: [] },
          speak: { type: "str" },
          node_type: { type: "str" },
        },
        start_node: "greeting",
      },
      "webhook-url": WEBHOOK_URL,
    },
    // pre-fire OFF. buildVoiceCustoms sends `"pre-fire-config": {}` when it is
    // false, so there is no preFireCurrent to carry here — turning it back on
    // means restoring both the flag and the value. Settings sit after the flag
    // so an admin-supplied voiceSettings still wins if one ever carries one.
    ...buildVoiceCustoms({ preFire: false, ...(voiceSettings ?? {}) }),
    // Overrides the deepgram stt_id buildVoiceCustoms just spread — order is
    // load-bearing, this line has to stay below the spread. Soniox, English
    // only; see STT_SONIOX_EN. Nothing sets sttModel/sttLanguage on this track
    // (buildCustoms is called with no voiceSettings at all), so no admin choice
    // is being thrown away here.
    stt_id: STT_SONIOX_EN,
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
    //       "system-prompt": `You are a visual analyst watching a student during a PRACTICE interview on a video call. Report only what you can actually see in the frames you are given this turn. Be accurate and literal — a wrong observation does real harm. Never invent or guess. When something is unclear or out of frame, say that.
    // You report what the body and scene are DOING, never what it means. Report POSTURE, HANDS, EYE CONTACT, ATTIRE, and VISIBLE STATE (only physically observable signs). Report CHANGE across the frames this turn (improved / no change / drifted back / can't tell). Report SCENE — how many people are visible and any situational condition that is the room's fault (poor lighting, bad camera angle, cramped space, second person). If more than one person is visible or you can't tell who is speaking, say so and stop judging anything visual.
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

// `connections` is RECEIVE-side, not send-side. Each entry reads "this
// participant receives these tracks FROM that one" — so the flags under
// `user` describe what the browser gets, and the flags under `ai` describe
// what the backend gets. Getting this backwards inverts both legs at once,
// which is why it is spelled out here.
//
// Video is per-track, not global:
//
//   cus (custom workflow)   video BOTH ways. That track has an avatar, so the
//                           backend really does send a video track and the
//                           browser has something to render.
//   jer (interview), and    video OFF both ways. There is no avatar — the
//   practice / clinical     backend's SDP answer carries no m=video line, which
//                           InterviewRoom.tsx:412 logs explicitly, so asking
//                           for it only negotiates a receiver that stays black.
//                           The user->ai leg fed the frame analyser, and
//                           vision_id is commented out above, so nothing
//                           consumes those frames now either.
//
// Flip a track by changing which constant its branch passes, not by editing
// the flags — the two shapes are meant to stay distinguishable at the call site.
function buildParticipants(video: boolean) {
  return {
    ai_participant: "ai",
    participants: [
      { name: "user", connections: [{ name: "ai", video, audio: true }] },
      { name: "ai", connections: [{ name: "user", video, audio: true }] },
    ],
  };
}

/** jer interview, practice, clinical — audio only. */
export const PARTICIPANTS = buildParticipants(false);

/** cus custom-workflow track — avatar video in both directions. */
export const PARTICIPANTS_VIDEO = buildParticipants(true);

