// The `mm` roleplay graph — a two-faced avatar.
//
// Structurally this is workflowCustoms.ts with two differences, and they are
// the entire reason it is a separate file rather than a flag on that one:
//
//   1. `faces` carries TWO entries instead of one. The runtime renders whichever
//      face the current `frame` value names, so the avatar visibly switches
//      expression mid-session.
//   2. The LLM node returns `speak` AND `frame`, and the `response` out-node
//      emits both. A single-face graph has nothing to do with a second variable,
//      so bolting this onto buildWorkflowCustoms would have meant every cus
//      session paying for a field its avatar cannot show.
//
// FACE UUIDs AND LABELS MUST AGREE WITH THE PROMPT. The model is told to return
// the literal strings "angry" and "normal" (muthuPrompt.ts), and the runtime
// matches a frame to a face by its `label`. Renaming a label here without
// renaming it there does not error — it silently leaves the avatar stuck on
// whichever face it was last showing, which looks like the model ignoring the
// instruction rather than like a config mismatch. Keep the two in step.
//
// There is no filler node here on purpose. cus and jer play a "Okay / Got it"
// acknowledgement while the real reply generates; Muthu politely acknowledging
// the officer before laying into them would undercut the character in the first
// half-second of every turn. He is allowed to be a beat slow instead.

import { buildVoiceCustoms } from "./voiceCustoms";
import {
  VX_SERVER,
  FLOW_API_KEY,
  PARTICIPANTS_VIDEO,
  waitForIceGathering,
} from "./customs";
import { PRACTICE_WEBHOOK_URL } from "./practiceCustoms";
import {
  MUTHU_DEBRIEF_PROMPT,
  MUTHU_GREETING,
  MUTHU_OPENING_FRAME,
  MUTHU_PROMPT,
  type MuthuFrame,
} from "./muthuPrompt";

export { VX_SERVER, FLOW_API_KEY, PARTICIPANTS_VIDEO, waitForIceGathering };

/**
 * The two avatar faces, by the labels the model returns as `frame`.
 *
 * `main` IS the angry face. The label is not cosmetic: avatar_.py keys the
 * loaded expressions by exactly these strings (`resolved_expressions[label]`),
 * and the lipsync engine picks its idle/default face as `'main'` first,
 * `config['face-label']` second, and the first-loaded expression only as a last
 * resort. Naming the hostile face `main` is what pins the default to it by name
 * — which matters because the idle face is what the avatar falls back to every
 * time a turn's audio ends. See muthuPrompt.ts.
 */
export const MUTHU_FACES: { uuid: string; label: MuthuFrame; usage: string }[] =
  [
    {
      uuid: "11f6dbe7-797c-4a1b-8da1-12164c5dfeae",
      label: "main",
      usage:
        "default and idle — agitated, hostile, shouting. The session opens here.",
    },
    {
      uuid: "de60e205-5aff-49e4-809d-bd51679ed65c",
      label: "normal",
      usage:
        "guarded but no longer shouting — only once the officer has de-escalated him, and revertible.",
    },
  ];

/** Who the user is talking to, for every label the room puts on screen. */
export const MUTHU_NAME = "Mr Muthu";

export function buildMuthuCustoms(userName: string) {
  // Only the channel facts are appended, and deliberately NOT the usual
  // "be warm / be helpful / keep it short" delivery notes — those would fight
  // the character. `userName` is given as the officer he is complaining TO, so
  // he can use it at them, not as someone to be pleasant with.
  const systemPrompt = `${MUTHU_PROMPT}

— — —
THE PERSON IN FRONT OF YOU:
You are speaking out loud, on a live call, to an officer named ${userName}. They are the one refusing you more money. Use their name the way an angry man uses a name — to press them — never as small talk.`;

  return {
    "warmup-agent": true,
    "process-type": "speech-native",
    faces: MUTHU_FACES,
    agent_id: {
      workflow: {
        nodes: {
          // No `frame` here. Both lipsync slots are initialised to the idle
          // face at avatar load, and the idle face IS the angry one (`main`),
          // so Muthu is already shouting on the greeting without being told.
          // Sending it would only re-set the speaking slot to what it already is.
          greeting: {
            type: "out",
            parameters: {
              out_dict: { speak: MUTHU_GREETING },
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
                  description: "What the officer just said to Mr Muthu.",
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
                    "Mr Muthu's next spoken line — abrupt, aggrieved, in character. Plain text, numbers written as words.",
                },
                // The description is where the two-value constraint actually
                // binds; the type system on the far side is just `str`.
                frame: {
                  type: "str",
                  description:
                    "Which face Mr Muthu is wearing for this line. EXACTLY one of: \"main\" (the name of his ANGRY face — agitated, hostile, the default, and where the conversation starts) or \"normal\" (guarded but no longer shouting; use ONLY once the officer has genuinely de-escalated him, and switch straight back to \"main\" the moment they deflect, refuse, or read from a script). Required on every reply. Never any other word.",
                },
                // Lowercase, and the description says so twice, because the
                // conditional below matches this string LITERALLY against its
                // mapping keys. "Yes" or "YES" matches neither branch.
                end_session: {
                  type: "str",
                  description:
                    "Whether the meeting is now over. EXACTLY the lowercase word \"yes\" or the lowercase word \"no\" — never capitalised, never \"true\", never a sentence. \"no\" on almost every turn. \"yes\" ONLY once Mr Muthu is genuinely leaving, either because the officer got somewhere concrete with him or because he has given up on them and is walking out. Required on every reply.",
                },
              },
            },
            // Fan-out. Both run off the same model reply: `response` speaks the
            // line while the conditional decides whether this was the last one.
            next: ["response", "judge_session_end"],
          },
          response: {
            type: "out",
            parameters: {
              // In this order. `frame` reaching the runtime is what makes the
              // avatar switch; `end_session` is carried so the webhook can see
              // the meeting ended even if the debrief model later fails, which
              // is the difference between a finished round and one stuck
              // "in progress" forever.
              variables: ["speak", "frame", "end_session"],
              interruption_type: "no",
              interruption_metadata: {},
            },
            next: "hold_frame",
          },
          // `frame` ALONE, with no `speak` beside it. This is not a duplicate of
          // the line above — the two land in different places.
          //
          // actions_/task_.py classifies a frame by `'speak' in action_out`, and
          // lipsync_client_.py keeps the result in one of two independent slots:
          // the SPEAKING face (honoured only while that turn's audio is flowing)
          // and the SILENT face (taken the instant the audio ends). `response`
          // pairs speak+frame, so it only ever writes the speaking slot; without
          // this node the silent slot stays on the load-time idle face forever
          // and the avatar snaps back to `main` the moment Muthu stops talking —
          // which looks exactly like the model refusing to calm down.
          //
          // `frame` still holds the value the LLM returned, so both slots end up
          // on the same face and it survives to the next turn.
          //
          // TERMINAL, with no `next`. The loop back to `ask_for_input` is owned
          // by the conditional below and by nothing else — if this node also
          // looped, a turn that ends the meeting would ask the officer for
          // another answer at the same moment the debrief starts running.
          hold_frame: {
            type: "out",
            parameters: {
              variables: ["frame"],
              interruption_type: "no",
              interruption_metadata: {},
            },
          },
          // The branch point. Reads the string the model just returned and
          // matches it against these keys literally — which is why the prompt
          // and the return-type description both insist on lowercase.
          //
          // "no" is the normal path and is what keeps the conversation going;
          // "yes" runs the debrief instead and never returns here, so the graph
          // simply stops having anything to ask for.
          judge_session_end: {
            type: "conditional",
            parameters: {
              input_variables: { end_session: {} },
              mappings: {
                yes: "debrief",
                no: "ask_for_input",
              },
            },
          },
          // The assessment. A second model with its OWN history key — it reads
          // the conversation, it does not join it, and nothing it writes can
          // reach Mr Muthu's context.
          debrief: {
            type: "llm",
            parameters: {
              input_variables: {
                conversation_history: {
                  type: "list",
                  description:
                    "The full transcript of the meeting between the officer and Mr Muthu.",
                },
              },
              prompt_template: "base_llm",
              system_prompt: MUTHU_DEBRIEF_PROMPT,
              service: "groq",
              model: "openai/gpt-oss-120b",
              history_key: "debrief_conversation_history",
              llm_return_type: {
                // `str`, not a numeric type, and parsed on our side. The wire
                // shape for a float return is unproven here — the reference
                // flow declares a float `score` variable and then never writes
                // it — and a number that arrives as "7.5" parses either way,
                // whereas a type the runtime mishandles loses the whole debrief.
                score: {
                  type: "str",
                  description:
                    "The officer's overall handling, zero to ten, as digits with at most one decimal place. The bare number only — no words, no \"/10\", no percent sign.",
                },
                feedback: {
                  type: "str",
                  description:
                    "A markdown table and nothing else, with the header row: | Criteria | Rating (1-10) | Brief justification | — one row per criterion, in the order given.",
                },
                summary: {
                  type: "str",
                  description:
                    "Markdown prose: a **What went well:** bulleted section followed by an **Areas for improvement:** bulleted section.",
                },
              },
            },
            next: "debrief_out",
          },
          // Terminal, and deliberately NOT named `speak`. An out-node whose
          // payload carries `speak` is sent to TTS — the officer would sit
          // there listening to a markdown table being read aloud. These names
          // make it data, which the webhook stores and the results page renders.
          debrief_out: {
            type: "out",
            parameters: {
              variables: ["score", "feedback", "summary"],
              interruption_type: "no",
              interruption_metadata: {},
            },
          },
        },
        variables: {
          user_input: { type: "str" },
          conversation_history: { type: "list", default: [] },
          speak: { type: "str" },
          frame: { type: "str", default: MUTHU_OPENING_FRAME },
          // Defaulted to "no" so the very first pass through the conditional
          // has something to match even if the model omits the key — an unset
          // variable there would end the meeting before it started.
          end_session: { type: "str", default: "no" },
          // The debrief's own history, separate from `conversation_history` so
          // the assessor never becomes part of what Mr Muthu remembers.
          debrief_conversation_history: { type: "list", default: [] },
          score: { type: "str" },
          feedback: { type: "str" },
          summary: { type: "str" },
          node_type: { type: "str" },
        },
        start_node: "greeting",
      },
      "webhook-url": PRACTICE_WEBHOOK_URL,
    },
    // A harder, lower voice than the practice tracks' default. Same mechanism
    // as cus: on Deepgram the voice IS the model id — `model` is the only key
    // that client reads (validate_keys in the monorepo's streaming deepgram_.py),
    // so this one line is the whole voice selection.
    //
    // The inactivity nudge is overridden because the shared default ("Are you
    // still there? No rush — take your time") is spoken IN MUTHU'S VOICE, and a
    // patient, reassuring Muthu breaks the character the instant the officer
    // pauses to think. He gets an impatient one instead.
    ...buildVoiceCustoms({
      ttsModel: "aura-2-odysseus-en",
      inactivityMessage:
        "Hello? You are still there or not? I'm sitting here waiting, you know!",
    }),
    // No vision_id. Nothing here is scored off the officer's camera, and the
    // avatar's face is driven by `frame` from the language model, not by any
    // frame analyser — the name collision between the two is unfortunate and
    // worth reading twice before changing anything in this file.
  };
}
