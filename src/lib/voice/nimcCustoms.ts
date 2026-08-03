// The `nimc` call graph — outbound admissions calling.
//
// This is a faithful port of the reference deployment's telephony payload, and
// "faithful" is the whole design rule here. What actually goes out from
// frontendt is assets/jsons/restraunts/workflow.json with exactly three fields
// replaced (system_prompt, the greeting's speak, webhook-url) plus a fixed
// block of stt/pre-fire/inactivity overrides applied at dial time
// (server.js:156-193). This file reproduces that and nothing else.
//
// So the graph below carries things that look like oversights and are not:
// input_variables described in terms of "the customer" rather than a student,
// generic speak/hangup descriptions, and five workflow variables
// (llm_response, analysis, next_step, total_score, net_score) that no node
// reads. They are in the reference. Removing them would make this a workflow
// nobody has ever placed a call with, which is a worse position to debug from
// than carrying five dead declarations.
//
// It is NOT ported from practiceCustoms.ts, and that difference matters. The
// practice graph is a single blocking `llm` node, fine over WebRTC where the
// round trip is short. A PSTN call needs the telephony shape:
//
//   - `llm-streaming` rather than `llm`, so audio starts before the model has
//     finished the sentence;
//   - a `prev_llm` filler node that speaks a 2-3 word acknowledgement while
//     the real reply is still streaming, so the line is never silent (this is
//     why the script forbids the main model from opening with "Okay"/"Sure" —
//     it would be said twice);
//   - `ask_for_input.next` as an ARRAY, fanning out to prev_llm, llm and
//     transcription in parallel;
//   - interruption enabled on the main node, since a person on a phone talks
//     over the agent constantly.
//
// NO MID-CALL EXTRACTION. An earlier version had the main node return four
// extra fields (name, course, percentage, residence) alongside `speak`. It has
// been removed: asking a streaming node for structured output on every turn
// costs tokens ahead of first audio and pulls against a script whose central
// instruction is "TALK LIKE A REAL HUMAN, NOT A FORM". Those fields are meant
// to come from a single pass over the finished transcript instead. NIMC_FIELD_KEYS
// survives below because that pass and the webhook's parser still need it.

import { WEBHOOK_URL } from "./customs";
import { nimcGreeting, nimcSystemPrompt } from "./nimcPrompt";

/**
 * The practice webhook URL is built the same way (practiceCustoms.ts). The
 * trailing-slash strip matters: NEXT_PUBLIC_WEBHOOK_URL is frequently set with
 * one, and "https://host//api/..." is not the same route to every proxy.
 */
export const NIMC_WEBHOOK_URL = `${WEBHOOK_URL.replace(/\/+$/, "")}/api/nimc/webhook`;

/**
 * The flat fields a call is eventually meant to yield. Strings throughout,
 * including the percentage — the student says "around eighty two" or "first
 * division" and coercing that to a number would throw away the only record of
 * what was actually claimed.
 *
 * Nothing in the graph produces these any more (see the header). They are kept
 * as the single source of truth for the webhook's tolerant parser and for the
 * post-call extraction pass, so that turning extraction back on is a change in
 * one place rather than four.
 */
export const NIMC_FIELD_KEYS = [
  "name",
  "course",
  "academic_percent",
  "residence",
] as const;

export type NimcFieldKey = (typeof NIMC_FIELD_KEYS)[number];

export type NimcCustomsOptions = {
  /** Institution name substituted into the script and the greeting. */
  brand?: string;
};

export function buildNimcCustoms({ brand }: NimcCustomsOptions = {}) {
  return {
    "warmup-agent": true,
    // The main node streams; this is how long the runtime waits for the first
    // chunk before falling back. Below ~2s the filler and the reply collide.
    "streaming-grace-ms": 2500,
    "process-type": "speech-native",
    agent_id: {
      workflow: {
        nodes: {
          greeting: {
            type: "out",
            parameters: {
              // Injected, exactly as server.js injects it into out_dict.speak.
              out_dict: { speak: nimcGreeting(brand) },
              interruption_type: "no",
              interruption_metadata: {},
            },
            next: "ask_for_input",
          },
          ask_for_input: {
            type: "input",
            parameters: { input_variables: { user_input: "str" } },
            // Array, not a string: all three run off the same input. The
            // filler and the real reply start together, and `transcription`
            // emits the student's words without waiting on either.
            next: ["prev_llm", "llm", "transcription"],
          },
          // Emits what the student said, so the webhook gets their side of the
          // conversation even on turns where the main model is still thinking.
          transcription: {
            type: "out",
            parameters: {
              variables: ["user_input"],
              interruption_type: "no",
              interruption_metadata: {},
            },
          },
          // Audio filler only. Its output is spoken but deliberately NOT
          // treated as transcript by the webhook — "Theek hai" is a mouth
          // noise covering latency, not something the agent said.
          prev_llm: {
            type: "llm-streaming",
            parameters: {
              input_variables: {
                user_input: {
                  type: "str",
                  description:
                    "The raw spoken or text response provided by the customer.",
                },
              },
              prompt_template: "base_llm",
              system_prompt:
                "You are a quick acknowledgment assistant. Respond with ONLY 2-3 words max like: 'Okay', 'Got it', 'Sure', 'Bilkul', 'Theek hai'. Be brief and natural in Hinglish.",
              service: "groq",
              model: "openai/gpt-oss-20b",
              // Its own history key, so the filler's throwaway lines never
              // pollute the main model's conversation.
              history_key: "conversation_history_prev",
              stream_timeout: 0.5,
              interruption_type: "no",
              interruption_metadata: {},
              llm_return_type: {
                speak: {
                  type: "str",
                  description: "Brief 2-3 word acknowledgment in Hinglish.",
                },
                hangup: {
                  type: "bool",
                  description: "Always false for acknowledgment.",
                },
              },
            },
          },
          llm: {
            type: "llm-streaming",
            parameters: {
              input_variables: {
                user_input: {
                  type: "str",
                  description:
                    "The raw spoken or text response provided by the customer.",
                },
              },
              prompt_template: "base_llm",
              // The only substantive difference from the reference file.
              system_prompt: nimcSystemPrompt(brand),
              service: "openrouter",
              model: "google/gemini-3.1-flash-lite-preview",
              history_key: "conversation_history",
              interruption_type: "full",
              interruption_metadata: {
                "min-interruption-delay": 15,
                "min-interruption-debounce": 2,
              },
              // speak and hangup only. The reference wording is kept even
              // though it says "customer" and frames hangup as end-of-flow —
              // the admissions script overrides both in the system prompt,
              // where it says in as many words that the student ends the call
              // and the agent never decides that itself.
              llm_return_type: {
                speak: {
                  type: "str",
                  description:
                    "The full conversational response in Hinglish that seamlessly follows the quick acknowledgment. Natural, warm, and logically complete.",
                },
                hangup: {
                  type: "bool",
                  description:
                    "Set true ONLY after the entire conversation flow is complete or if customer indicates they're done.",
                },
              },
            },
            next: ["response", "ask_for_input"],
          },
          response: {
            type: "out",
            parameters: {
              variables: ["speak", "hangup"],
              interruption_type: "no",
              interruption_metadata: {},
            },
          },
        },
        // Verbatim from the reference, dead declarations included — see header.
        variables: {
          user_input: { type: "str" },
          llm_response: { type: "str" },
          conversation_history: { type: "list", default: [] },
          conversation_history_prev: { type: "list", default: [] },
          speak: { type: "str" },
          analysis: { type: "str" },
          next_step: { type: "str" },
          total_score: { type: "int" },
          net_score: { type: "int" },
          hangup: { type: "bool", default: false },
          node_type: { type: "str" },
        },
        start_node: "greeting",
      },
      // A sibling of `workflow`, not a node in it. The runtime POSTs here
      // every time the graph reaches ask_for_input — i.e. once per turn.
      "webhook-url": NIMC_WEBHOOK_URL,
    },
    tts_id: { service: "sarvam", speaker: "simran" },

    // ── Everything below matches server.js's dial-time overrides, NOT the
    // workflow.json template.
    //
    // That distinction cost a bug once and is worth spelling out: server.js
    // loads workflow.json and then overwrites stt_id, pre-fire-config and
    // inactivity-metadata on every outbound call (server.js:181-193). The
    // values sitting in the template are therefore dead — no real call has
    // ever used them. These are the ones that have actually been running.

    // soniox rather than the practice track's deepgram, and the language hint
    // is the load-bearing part: this is 8kHz phone audio with Hindi and
    // English mixed inside single sentences.
    stt_id: { service: "soniox", language: ["hi", "en"] },
    "pre-fire": true,
    "pre-fire-config": { min: 10, max: 5000, current: 40 },
    "grain-voice": false,
    "grain-level": 0.025,
    inactivity: true,
    "inactivity-metadata": {
      // 1000, as in the reference. Large enough that the nudge effectively
      // never fires — kept as-is rather than "corrected" to the template's
      // 10.0, because matching what has actually been running matters more
      // than matching what the template says it should be.
      "time-period": 1000,
      "max-times": 3,
      "inactivity-type": "static",
      message:
        "Are you still there? No rush — take your time and answer whenever you're ready.",
      "interruption-type": "full",
      "interruption-metadata": {},
    },
  };
}
