// The `pr` roleplay graph — Mr Cheryl at the returns counter.
//
// muthuCustoms.ts with three additions. Read that file first: the face plumbing
// here is identical and its reasoning is not repeated.
//
//   1. `actions` — physical scene events, emitted on the response node and read
//      off the webhook payload by the room, which renders a receipt, a shirt, a
//      phone or an escalation form. NOT the voice backend's web-action
//      mechanism: that one only fires at <|web_action|> markers inside `speak`,
//      expects dict entries rather than bare strings, and blocks on a data
//      channel ack. None of that is used or wanted here.
//
//   2. `score` — a RUNNING score, and the only variable in either roleplay that
//      is both an input to the LLM and an output from it. The reference flow
//      declares it `float`; it is `str` here because the value it actually
//      carries is "pass_9" — a status and a number in one token.
//
//   3. A second debrief node. `mm` computes its whole assessment in one call;
//      this track marks out of twenty across four dimensions AND writes prose,
//      so the marking and the summary are split the way the reference flow
//      splits them, sharing one history key so both read the same transcript.
//
// SAME FACES AS `mm`, DELIBERATELY. The two UUIDs below are the same avatar
// clips Mr Muthu uses. That is a product decision, not an oversight — Mr Cheryl
// has no clips of his own yet, and a firm-but-not-abusive customer reads
// acceptably on the same two expressions. Swap the UUIDs when his own are cut;
// nothing else in this file needs to change.

import { buildVoiceCustoms, STT_SONIOX_EN } from "./voiceCustoms";
import {
  VX_SERVER,
  FLOW_API_KEY,
  PARTICIPANTS_VIDEO,
  waitForIceGathering,
} from "./customs";
import { PRACTICE_WEBHOOK_URL } from "./practiceCustoms";
import {
  CHERYL_FEEDBACK_PROMPT,
  CHERYL_GREETING,
  CHERYL_OPENING_FRAME,
  CHERYL_PROMPT,
  CHERYL_SUMMARY_PROMPT,
  type CherylFrame,
} from "./cherylPrompt";

export { VX_SERVER, FLOW_API_KEY, PARTICIPANTS_VIDEO, waitForIceGathering };

/** The two avatar faces, by the labels the model returns as `frame`. */
export const CHERYL_FACES: { uuid: string; label: CherylFrame; usage: string }[] =
  [
    {
      uuid: "11f6dbe7-797c-4a1b-8da1-12164c5dfeae",
      label: "main",
      usage:
        "default and idle — firm, impatient, arms crossed. Levels 3 to 5. The session opens here.",
    },
    {
      uuid: "de60e205-5aff-49e4-809d-bd51679ed65c",
      label: "normal",
      usage:
        "settled and cooperative — levels 1 and 2, once the trainee has handled him well. Revertible.",
    },
  ];

/** Who the trainee is talking to, for every label the room puts on screen. */
export const CHERYL_NAME = "Mr Cheryl";

export function buildCherylCustoms(userName: string) {
  // The trainee's name is baked into the prompt rather than passed as a
  // workflow input variable. The reference flow does the latter, with a
  // {trainee_name} placeholder and a `trainee_name` variable; this is the shape
  // `mm` already proves out in this codebase, and it removes a whole class of
  // failure where the placeholder survives into spoken output.
  const systemPrompt = `${CHERYL_PROMPT}

— — —
THE PERSON IN FRONT OF YOU:
You are speaking out loud, at a retail service counter, to a frontline trainee named ${userName}. They are the one who has to sort this out. Use their name the way an impatient customer uses a name — to press them — never as small talk.`;

  return {
    "warmup-agent": true,
    // stt-native, not speech-native: the graph now runs off soniox transcript
    // rather than the audio pipeline's own speech handling.
    "process-type": "stt-native",
    faces: CHERYL_FACES,
    agent_id: {
      workflow: {
        nodes: {
          // No `frame`. Both lipsync slots start on the idle face, and the idle
          // face IS the firm one (`main`), so he opens at Level 3 unprompted.
          greeting: {
            type: "out",
            parameters: {
              out_dict: { speak: CHERYL_GREETING },
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
                  description: "What the trainee just said to Mr Cheryl.",
                },
                // Fed back in so the score is genuinely running. Without this
                // the model re-derives the trainee's standing from the
                // transcript every turn and the number wanders.
                score: {
                  type: "str",
                  description:
                    "Mr Cheryl's running judgement of the trainee so far, in STATUS_VALUE form (e.g. \"retry_5\"). Carry it forward and return it updated.",
                },
              },
              prompt_template: "base_llm",
              system_prompt: systemPrompt,
              // Same provider/model as the nimc call track — and as `feedback`
              // and `summary` below, which moved with it rather than being left
              // on groq.
              service: "openrouter",
              model: "google/gemini-3.1-flash-lite-preview",
              history_key: "conversation_history",
              // Deepgram TTS: no emotion tagging. The reference flow set this
              // true against ElevenLabs v3, whose bracketed tags this voice
              // would simply pronounce.
              emotion: false,
              llm_return_type: {
                speak: {
                  type: "str",
                  description:
                    "Mr Cheryl's next spoken line — short, clipped, in character. Plain text, numbers written as words, and never any bracketed tag.",
                },
                frame: {
                  type: "str",
                  description:
                    "Which face Mr Cheryl is wearing for this line. EXACTLY one of: \"main\" (firm, impatient, hostile — emotional levels three to five, the default, and where the conversation starts) or \"normal\" (settled and cooperative — levels one and two, once the trainee has handled him politely; revert to \"main\" the moment they stonewall, blame him, or use a prohibited phrase). Required on every reply. Never any other word.",
                },
                // Enumerated in full. The reference flow's description named
                // only "receipt" while its system prompt defined five, which
                // is the surest way to get the other four silently dropped —
                // a structured-output description binds harder than prose.
                actions: {
                  type: "list",
                  description:
                    "The physical things Mr Cheryl does this turn, as a list of strings. Empty list [] on most turns. Allowed values, and ONLY these five: \"receipt\" (the turn he hands over his receipt, after being asked for proof of purchase), \"shirt\" (the turn the trainee asks to inspect/see/check/examine the shirt or the defect — required on that turn even if he is complaining while he passes it over), \"get-details\" (the exact turn the trainee FIRST mentions or offers an escalation form, service alert or supervisor review — not at the end of the session), \"phone\" (only if pushed to level five and he raises his phone to threaten a post), \"turn-away\" (only on the exit turn, when he gives up and walks out). Fire each at most once per session.",
                },
                end_diagnosis: {
                  type: "str",
                  description:
                    "Whether the scenario is now over. EXACTLY the lowercase word \"yes\" or the lowercase word \"no\" — never capitalised, never \"true\". \"no\" on almost every turn. \"yes\" only when the trainee confirms the escalation form has been submitted, or calls the manager proactively (both passes), or when Mr Cheryl walks out on hostility (a fail).",
                },
                score: {
                  type: "str",
                  description:
                    "The running score in STATUS_VALUE form, e.g. \"pass_9\", \"retry_5\", \"fail_1\". VALUE is a whole number zero to ten carried forward from the value you were given and adjusted; STATUS is \"pass\", \"retry\" or \"fail\". Required on every reply including the last.",
                },
              },
            },
            next: ["response", "judge_scenario_end"],
          },
          response: {
            type: "out",
            parameters: {
              variables: ["speak", "frame", "actions", "score", "end_diagnosis"],
              interruption_type: "no",
              interruption_metadata: {},
            },
            next: "hold_frame",
          },
          // `frame` alone, no `speak` — writes the SILENT lipsync slot so the
          // face survives past the end of the turn's audio. Terminal: the loop
          // back to input belongs to the conditional and nothing else.
          hold_frame: {
            type: "out",
            parameters: {
              variables: ["frame"],
              interruption_type: "no",
              interruption_metadata: {},
            },
          },
          judge_scenario_end: {
            type: "conditional",
            parameters: {
              input_variables: { end_diagnosis: {} },
              mappings: {
                yes: ["feedback", "summary"],
                no: "ask_for_input",
              },
            },
          },
          feedback: {
            type: "llm",
            parameters: {
              input_variables: {
                conversation_history: {
                  type: "list",
                  description:
                    "The full transcript of the exchange between the trainee and Mr Cheryl.",
                },
              },
              prompt_template: "base_llm",
              system_prompt: CHERYL_FEEDBACK_PROMPT,
              service: "openrouter",
              model: "google/gemini-3.1-flash-lite-preview",
              history_key: "feedback_conversation_history",
              emotion: false,
              llm_return_type: {
                // Its own field rather than something we regex back out of the
                // markdown — the prose is the model's to reformat, the number
                // is the page's to render.
                total: {
                  type: "str",
                  description:
                    "The trainee's total out of twenty. Digits only — no \"/20\", no words.",
                },
                feedback: {
                  type: "str",
                  description:
                    "The full markdown report in the structure given: SUMMARY, HOW THE CONVERSATION WENT, then the four per-dimension blocks, then TOTAL.",
                },
              },
            },
            next: "feedback_out",
          },
          summary: {
            type: "llm",
            parameters: {
              input_variables: {
                conversation_history: {
                  type: "list",
                  description:
                    "The full transcript of the exchange between the trainee and Mr Cheryl.",
                },
              },
              prompt_template: "base_llm",
              system_prompt: CHERYL_SUMMARY_PROMPT,
              service: "openrouter",
              model: "google/gemini-3.1-flash-lite-preview",
              // Shared with `feedback` on purpose: both are reading the same
              // finished conversation, and neither is a participant in it.
              history_key: "feedback_conversation_history",
              emotion: false,
              llm_return_type: {
                summary: {
                  type: "str",
                  description:
                    "Markdown prose: **What Went Well:**, **Areas for Improvement:**, **Key Takeaway:**.",
                },
              },
            },
            next: "summary_out",
          },
          // Both terminal, and neither carries `speak` — an out payload with
          // that key goes to TTS, and the trainee would hear their own marking
          // read aloud.
          feedback_out: {
            type: "out",
            parameters: {
              variables: ["total", "feedback"],
              interruption_type: "no",
              interruption_metadata: {},
            },
          },
          summary_out: {
            type: "out",
            parameters: {
              variables: ["summary"],
              interruption_type: "no",
              interruption_metadata: {},
            },
          },
        },
        variables: {
          user_input: { type: "str" },
          conversation_history: { type: "list", default: [] },
          speak: { type: "str" },
          frame: { type: "str", default: CHERYL_OPENING_FRAME },
          actions: { type: "list", default: [] },
          // Seeded at the midpoint with a recoverable status: a trainee who has
          // not yet said anything has neither passed nor failed, and starting
          // at "pass_10" or "fail_0" would bias every later adjustment.
          score: { type: "str", default: "retry_5" },
          end_diagnosis: { type: "str", default: "no" },
          feedback_conversation_history: { type: "list", default: [] },
          total: { type: "str" },
          feedback: { type: "str" },
          summary: { type: "str" },
          node_type: { type: "str" },
        },
        start_node: "greeting",
      },
      "webhook-url": PRACTICE_WEBHOOK_URL,
    },
    // Same voice as `mm`. Not a placeholder — you asked to leave it, and the two
    // tenants never share a listener, so there is nothing to distinguish.
    //
    // The inactivity nudge is his, not Mr Muthu's: a queue is building behind
    // him and a silent counter is exactly what a man in a hurry comments on.
    ...buildVoiceCustoms({
      ttsModel: "aura-2-odysseus-en",
      // Off — sends `"pre-fire": false` and an empty pre-fire-config.
      preFire: false,
      inactivityMessage:
        "Hello? I am still standing here. There are people waiting behind me, you know.",
    }),
    // Below the spread on purpose — it replaces the deepgram stt_id that
    // buildVoiceCustoms sets. Soniox, English only; see STT_SONIOX_EN.
    stt_id: STT_SONIOX_EN,
  };
}
