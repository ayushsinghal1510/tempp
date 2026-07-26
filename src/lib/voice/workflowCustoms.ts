// The `cus` workflow — the third and simplest voice build.
//
// practiceCustoms.ts and clinicalCustoms.ts both return a structured 7-element
// result (speak + 6 scored topic dicts) because those products exist to score
// someone. This one returns `speak` and nothing else. There is no rubric, no
// vision pipeline, no kink model, and no coaching layer, because the customer
// running it did not ask for any of that — they asked for a voice agent whose
// greeting and instructions they control outright.
//
// What that buys them: the two strings below ARE the product. An admin edits
// the prompt and the very next session their whole organisation runs uses it,
// with no publish gate, no assignment, and nobody in the loop.
//
// The webhook is shared with the other two. It stores transcript and speak per
// turn exactly as it does for them, and simply finds no topic keys to parse
// (topicsFor("cus") is empty), so turns land unscored without a special case.

import { buildVoiceCustoms } from "./voiceCustoms";
import {
  VX_SERVER,
  FLOW_API_KEY,
  PARTICIPANTS,
  waitForIceGathering,
} from "./customs";
import { PRACTICE_WEBHOOK_URL } from "./practiceCustoms";

export { VX_SERVER, FLOW_API_KEY, PARTICIPANTS, waitForIceGathering };

/** The entire definition of a cus session. Both fields are admin-owned. */
export type CustomWorkflow = {
  /** Spoken first, before the user says anything. */
  greeting: string;
  /** The agent's system prompt, verbatim. */
  prompt: string;
};

export const DEFAULT_WORKFLOW: CustomWorkflow = {
  greeting: "Hello, thanks for joining. Whenever you're ready, go ahead.",
  prompt:
    "You are a helpful, professional voice assistant. Listen carefully, answer clearly, and keep your replies short enough to be comfortable to listen to.",
};

/** Fills in the defaults for a row whose workflow JSON is missing or partial. */
export function normaliseWorkflow(raw: unknown): CustomWorkflow {
  const o = (raw ?? {}) as Record<string, unknown>;
  const greeting = String(o.greeting ?? "").trim();
  const prompt = String(o.prompt ?? "").trim();
  return {
    greeting: greeting || DEFAULT_WORKFLOW.greeting,
    prompt: prompt || DEFAULT_WORKFLOW.prompt,
  };
}

export function buildWorkflowCustoms(
  userName: string,
  workflow: CustomWorkflow,
) {
  const { greeting, prompt } = normaliseWorkflow(workflow);

  // Appended rather than merged into the admin's text, and kept to the two
  // things that are properties of the CHANNEL rather than of the task: this is
  // spoken aloud by TTS, and a filler word is already played before each reply.
  // Everything about what the agent should actually do stays the admin's.
  const systemPrompt = `${prompt}

— — —
DELIVERY NOTES (these are about the voice channel, not your task):
You are speaking to ${userName} out loud over a live voice call.
Write numbers as full words — "fifteen" not "15", "thirty percent" not "30%" — since digits and symbols are read badly by text-to-speech.
A short filler word is played automatically before each of your replies, so never open with one ("okay", "sure", "theek hai", "haan"). Start with the substance.`;

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
              out_dict: { speak: greeting },
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
                  description: "What the user just said.",
                },
              },
              prompt_template: "base_llm",
              system_prompt: systemPrompt,
              service: "groq",
              model: "openai/gpt-oss-120b",
              history_key: "conversation_history",
              // The whole return shape: one spoken line. No scored topics,
              // because nothing here is scored.
              llm_return_type: {
                speak: {
                  type: "str",
                  description: "The agent's next spoken line.",
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
          conversation_history: { type: "list", default: [] },
          speak: { type: "str" },
          node_type: { type: "str" },
        },
        start_node: "greeting",
      },
      "webhook-url": PRACTICE_WEBHOOK_URL,
    },
    ...buildVoiceCustoms(null),
    // No vision_id on purpose. The other two tracks score posture/presence off
    // a frame analyser; nothing here reads the video, so paying for a
    // per-second vision model would buy the customer nothing. The webcam
    // recording is captured client-side by MediaRecorder and is unaffected.
  };
}
