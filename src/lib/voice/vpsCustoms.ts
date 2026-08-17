// The `vps` roleplay graph — Mr Suresh Nair in the consulting room.
//
// cherylCustoms.ts with the content swapped and ONE structural difference.
// Read that file first: the faces, the split feedback/summary debrief and the
// running `score` fed back in as an input are all identical here and their
// reasoning is not repeated.
//
// The difference is that this graph has NO `hold_frame` node — mm and pr both
// follow `response` with a bare-`frame` out to pin the lipsync silent slot, and
// it was tested here and does nothing. See the comment on `response` below.
//
// The three things worth saying about THIS one:
//
//   1. `actions` are clinical props, and only two of the five have anything to
//      draw. `shows-foot` and `companion-cuts-in` are recorded on the turn and
//      deliberately absent from the room's SCENE_PROPS map — the same gap
//      `turn-away` already sits in on `pr`. See the note by VPS_ACTIONS.
//
//   2. `end_diagnosis` fires LATE on purpose. The scenario does not end on the
//      patient's disclosure but a turn or two after it, so the trainee has to do
//      something with what they were just told. The condition lives in the
//      prompt; the graph is the same conditional `pr` uses.
//
//   3. Everything the model is told is in vpsPrompt.ts. This file inlines no
//      scenario text at all, which is what makes the prompt rewrite that is
//      coming a one-file change.
//
// BORROWED FACES — see VPS_FACES below. The UUIDs are Mr Muthu's and Mr
// Cheryl's, reused deliberately until this patient's own clips are cut.

import { buildVoiceCustoms, STT_SONIOX_EN } from "./voiceCustoms";
import {
  VX_SERVER,
  FLOW_API_KEY,
  PARTICIPANTS_VIDEO,
  waitForIceGathering,
} from "./customs";
import { PRACTICE_WEBHOOK_URL } from "./practiceCustoms";
import {
  VPS_FEEDBACK_PROMPT,
  VPS_OPENING_FRAME,
  VPS_PROMPT,
  VPS_SUMMARY_PROMPT,
  type VpsFrame,
} from "./vpsPrompt";

export { VX_SERVER, FLOW_API_KEY, PARTICIPANTS_VIDEO, waitForIceGathering };

/**
 * The three avatar poses, by the labels the model returns as `frame`.
 *
 * THE CLIPS ARE POSES, NOT EXPRESSIONS. Unlike `mm` and `pr`, whose two clips
 * are an angry face and a settled one, these are a body sitting normally and
 * the same body with one hand raised. Nothing here encodes mood — see the
 * banner note in vpsPrompt.ts's header for why that distinction has to be held
 * all the way through.
 *
 * THE RESTING CLIP WAS DELIVERED AS "normal" AND IS LABELLED "main" HERE. That
 * rename is required, not cosmetic: the lipsync engine resolves its idle
 * expression as `'main' if 'main' in expressions else …` (lipsync_client_.py),
 * and the idle expression is what the avatar falls back to. Labelling a raised
 * hand "main" — or leaving the resting pose under any other name — would leave
 * the patient sitting there with an arm in the air between turns.
 *
 * These are the EXPRESSIONS half of the manifest. The bridge clips that play
 * between them are VPS_TRANSITIONS below.
 */
export const VPS_FACES: { uuid: string; label: VpsFrame; usage: string }[] = [
  {
    uuid: "e8eb1ead-dc4e-44f5-871a-7e00be740944",
    label: "main",
    usage:
      "default and idle — sitting normally, hands in his lap. The encounter opens here and returns here whenever a hand is lowered.",
  },
  {
    uuid: "f8baed69-a8bb-41d9-9076-bfa6b74b55b6",
    label: "right-hand",
    usage:
      "right hand held up. Entered only when the trainee asks for it, and held until they ask him to lower it or to switch hands.",
  },
  {
    uuid: "34db4124-f98d-4a26-8ecd-4ff1a37a20a3",
    label: "left-hand",
    usage:
      "left hand held up. Same rules as the right; only ever one hand up at a time.",
  },
];

/**
 * The bridge clips, played once when the engine leaves one pose for another
 * instead of hard-cutting between them.
 *
 * `from`/`to` are EXPRESSION LABELS, matched against the `label` fields above —
 * not uuids, and not the names the clips were delivered under. Hence "main"
 * rather than "normal" on the left of both: the resting clip is labelled "main"
 * for the idle-resolution reason given above, and a transition naming a label
 * that no expression carries resolves to nothing and silently hard-cuts.
 *
 * ONE-DIRECTIONAL, AND THAT IS THE POINT OF THE PAIR WE HAVE. `resolve_flow_avatar`
 * keys these as `(from_label, to_label)` and the README is explicit that the
 * reverse of a defined pair is NOT implied. So:
 *
 *   main       -> right-hand   bridged (he raises the arm)
 *   main       -> left-hand    bridged
 *   right-hand -> main         HARD CUT — no reverse clip exists
 *   left-hand  -> main         HARD CUT
 *   right-hand <-> left-hand   HARD CUT — deliberate, per the clip set we have
 *
 * Raising is smooth and lowering snaps. That asymmetry is a property of the
 * clips that were cut, not a bug to work around here — the fix is two reverse
 * clips, at which point they are two more entries in this list and nothing else
 * in this file changes.
 *
 * `label`/`usage` are accepted on a transition entry by the DB's manifest
 * builder but are never read at runtime (avatar_.py reads uuid/from/to only), so
 * they are omitted rather than written as decoration that looks load-bearing.
 *
 * ⚠️ These clips must be 25 fps. The lipsync processor advances exactly one clip
 * frame per 40 ms tick and never reads `media.fps`, so a 30 fps clip plays at
 * 0.83x and a 60 fps one at ~0.42x. A looping pose survives that (it is a body
 * holding still); a transition does not, because it is a motion the eye tracks
 * from A to B. If the arm rises in slow motion, this is why — check the source
 * clips, not this file.
 */
export const VPS_TRANSITIONS: { uuid: string; from: VpsFrame; to: VpsFrame }[] =
  [
    {
      uuid: "b300ff6b-a1e9-4193-8f41-55d0f4f2b8dc",
      from: "main",
      to: "right-hand",
    },
    {
      uuid: "0dc83a39-a92a-4570-adb8-bce679aaedce",
      from: "main",
      to: "left-hand",
    },
  ];

/**
 * The avatar manifest, as the voice backend wants it.
 *
 * AN OBJECT, NOT THE BARE LIST every other track here sends. That difference is
 * the entire reason transitions reach the engine at all, and it is worth
 * spelling out because the obvious alternative fails silently.
 *
 * `resolve_flow_avatar` (voicebot/connection/avatar_.py) accepts `faces` in two
 * shapes: a LIST, which it wraps as `{expressions: [...]}` with no transitions
 * by construction, or anything else, which it takes as the manifest as-is and
 * reads `expressions` and `transitions` off. Every other builder in this
 * directory sends the list, which is why none of them can bridge.
 *
 * THE TRANSITIONS MUST BE NESTED HERE, NOT SENT AS A SIBLING CUSTOMS KEY. The
 * database's write API (POST/PUT /flow) does take `faces` and `transitions` as
 * two separate fields — but it merges them into this one object before storing,
 * and the runtime only ever reads the merged form. Customs replaces
 * `flow_details['faces']` wholesale and nothing reads `flow_details['transitions']`,
 * so a top-level `transitions` key would be accepted, stored, and ignored
 * without a single log line.
 *
 * `version` is deliberately absent. On the DB path it is a content hash of the
 * referenced uuids used for cache invalidation; here it is only ever logged. The
 * handle cache that matters is keyed by `<uuid>:<face doc version>`, taken from
 * each face document at fetch time, so omitting this changes no caching
 * behaviour.
 *
 * Status worth knowing: this shape is UNBLOCKED RATHER THAN BLESSED. It works
 * because customs is applied as a blind `flow_details[k] = v` before anything is
 * read, and because the resolver branches on type rather than validating. The
 * DB manifest is the designed route and no test fixture covers this one, so if
 * avatars ever go missing on this tenant, suspect this first — the failure mode
 * is a fallback to the local asset, logged as
 * `[AVATAR] flow `faces` manifest references no expressions`.
 */
export const VPS_FACE_MANIFEST = {
  expressions: VPS_FACES,
  transitions: VPS_TRANSITIONS,
};

/** Who the trainee is talking to, for every label the room puts on screen. */
export const VPS_NAME = "Mr Nair";

export function buildVpsCustoms(userName: string) {
  // Baked into the prompt rather than passed as a workflow input variable —
  // same call as `mm` and `pr`, and it removes the class of failure where a
  // {trainee_name} placeholder survives into spoken output.
  const systemPrompt = `${VPS_PROMPT}

— — —
THE PERSON IN FRONT OF YOU:
You are speaking out loud, in a clinic consulting room, to a healthcare trainee named ${userName}. They are the one seeing you today. Use their name the way an older patient uses a young doctor's name — with a little formality, and more often once you have decided you trust them.`;

  return {
    "warmup-agent": true,
    // stt-native, matching pr: the graph runs off the soniox transcript rather
    // than the audio pipeline's own speech handling.
    "process-type": "stt-native",
    // The manifest object, not the bare list the other builders send — see
    // VPS_FACE_MANIFEST. This is what carries the bridge clips.
    faces: VPS_FACE_MANIFEST,
    agent_id: {
      workflow: {
        nodes: {
          // No greeting node — Mr Nair sits there and the trainee has to open,
          // which for a consultation is the more realistic start anyway: a
          // patient waits to be spoken to. Removed rather than emptied, for the
          // reason muthuCustoms and cherylCustoms record — an `out` node with
          // `speak: ""` still runs the TTS.
          //
          // Nothing about his state depended on it. `frame` defaults to "main"
          // and the idle clip IS the resting pose, so he starts sitting
          // normally; the emotional scale still opens at Level 3 from the
          // prompt. VPS_GREETING is kept in vpsPrompt.ts as the line he WOULD
          // have opened with — see the note there.
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
                  description: "What the trainee just said to Mr Nair.",
                },
                // Fed back in so the score is genuinely running. Without this
                // the model re-derives the trainee's standing from the
                // transcript every turn and the number wanders.
                score: {
                  type: "str",
                  description:
                    "Mr Nair's running judgement of the trainee so far, in STATUS_VALUE form (e.g. \"retry_5\"). Carry it forward and return it updated.",
                },
                // Fed back for exactly the same reason as `score` above, and it
                // is the whole mechanism by which a raised hand stays raised.
                //
                // `response` is the ONLY node in this graph that emits `frame` —
                // greeting sends `speak` alone, and nothing else touches it — so
                // the pose the avatar holds is, every turn, whatever the model
                // just returned. There is no state anywhere else to fall back
                // on. Asking it in prose to "return the same value as last turn"
                // made the pose depend on the model recalling a token it emitted
                // several turns ago, which is the weakest possible way to carry
                // state and is why the hand kept dropping.
                //
                // Handing it back turns that recall into an echo: the value it
                // must repeat is right there in the input. Same pattern, same
                // file, already proven on `score`.
                frame: {
                  type: "str",
                  description:
                    "The pose Mr Nair is CURRENTLY holding, one of \"main\", \"right-hand\" or \"left-hand\". This is his live body position, not a history — return it UNCHANGED unless the trainee asked him to move his hands this turn.",
                },
              },
              prompt_template: "base_llm",
              system_prompt: systemPrompt,
              service: "openrouter",
              model: "google/gemini-3.1-flash-lite-preview",
              history_key: "conversation_history",
              // Deepgram TTS has no emotion tagging; bracketed tags would be
              // pronounced. False on every node here, same as pr.
              emotion: false,
              llm_return_type: {
                speak: {
                  type: "str",
                  description:
                    "Mr Nair's next spoken line, fully in character — short and deflecting when guarded, longer and warmer once he has opened up. Never coaching, never a comment on the trainee's technique. Plain text, numbers written as words, and never any bracketed tag.",
                },
                frame: {
                  type: "str",
                  description:
                    "WHERE MR NAIR'S BODY IS for this line — a physical pose, NOT a mood, and never influenced by how the conversation is going. EXACTLY one of: \"main\" (sitting normally, hands in his lap), \"right-hand\" (his right hand is held up) or \"left-hand\" (his left hand is held up). START FROM THE `frame` VALUE YOU WERE GIVEN AS INPUT — that is the pose he is holding right now — and return it UNCHANGED unless the trainee asked him to move his hands THIS turn. Change it only for: right hand asked for -> \"right-hand\", left hand asked for -> \"left-hand\", both or unspecified -> \"right-hand\", told to put it down/lower it/relax or that they are finished looking -> \"main\". Everything else, including any change in his mood, leaves it exactly as it was. Returning \"main\" when you were given \"right-hand\" and were not asked to lower it will drop his arm mid-examination. Only one hand is ever up. Required on every reply. Never any other word.",
                },
                // Enumerated in full, for the reason cherylCustoms.ts records:
                // a structured-output description binds harder than prose, and
                // naming one value here while the prompt defines five is how
                // the other four get silently dropped.
                actions: {
                  type: "list",
                  description:
                    "The physical things that happen this turn, as a list of strings. Empty list [] on most turns. Allowed values, and ONLY these five: \"medication-bag\" (the turn he tips out the plastic bag of tablet strips, after being asked what he takes), \"report-sheet\" (the turn he hands over the folded blood test paper, after being asked about his sugar or previous tests), \"shows-foot\" (the turn the trainee asks to look at/see/check/examine the sore — required on that turn even if he is silent and withdrawn while he does it), \"companion-cuts-in\" (any turn on which his daughter Lakshmi speaks — this one MAY repeat), \"turn-away\" (only on the exit turn, when he closes the conversation and stands to leave). Apart from \"companion-cuts-in\", fire each at most once per session.",
                },
                end_diagnosis: {
                  type: "str",
                  description:
                    "Whether the encounter is now over. EXACTLY the lowercase word \"yes\" or the lowercase word \"no\" — never capitalised, never \"true\". \"no\" on almost every turn. \"yes\" only a turn or two AFTER the hidden concern has come out and been met as a person rather than as a clinical problem (a pass), or when Mr Nair closes the conversation himself and stands to leave after being rushed or dismissed (a fail). Never \"yes\" on the disclosure turn itself.",
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
          // TERMINAL — no `next`. The loop back to input is owned by the
          // conditional and nothing else; a `next` here would ask the trainee
          // for another answer at the same moment a finished encounter starts
          // its debrief.
          //
          // NO `hold_frame` NODE, UNLIKE mm AND pr. Both of those follow this
          // node with a second out carrying `frame` alone, on the reasoning that
          // a bare `frame` writes the lipsync SILENT slot (task_.py classifies by
          // `'speak' in action_out`) and so keeps the pose up after the turn's
          // audio ends. Reading lipsync_client_.py supports that: `_silent_label`
          // is independent, never tracks `_speaking_label`, and stays at idle
          // unless something sets it.
          //
          // It does not survive contact with a live session. Tested on this
          // track: the pose does not hold between turns either way, and the
          // extra node changed nothing — so it was removed rather than kept as
          // a plausible-looking no-op. Whatever the gap is between that source
          // reading and the deployed engine, it is not something this file can
          // fix, and a node that demonstrably does nothing is worse than absent
          // because the next person will build on it exactly as this file did.
          //
          // What actually carries a raised hand across turns is the STICKY rule
          // in vpsPrompt.ts: the model re-returns the same `frame` value every
          // turn, so each turn's speak+frame pair re-asserts the pose while he
          // is talking. That is now load-bearing rather than belt-and-braces —
          // see the note on the `frame` field below.
          response: {
            type: "out",
            parameters: {
              variables: ["speak", "frame", "actions", "score", "end_diagnosis"],
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
                    "The full transcript of the consultation between the trainee and Mr Nair.",
                },
              },
              prompt_template: "base_llm",
              system_prompt: VPS_FEEDBACK_PROMPT,
              service: "openrouter",
              model: "google/gemini-3.1-flash-lite-preview",
              history_key: "feedback_conversation_history",
              emotion: false,
              llm_return_type: {
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
                    "The full transcript of the consultation between the trainee and Mr Nair.",
                },
              },
              prompt_template: "base_llm",
              system_prompt: VPS_SUMMARY_PROMPT,
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
                    "Markdown prose: **What Went Well:**, **Areas for Improvement:**, **Key Takeaway:**. If the trainee never reached the hidden concern, this must name what it was.",
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
          frame: { type: "str", default: VPS_OPENING_FRAME },
          actions: { type: "list", default: [] },
          // Seeded at the midpoint with a recoverable status, same reasoning as
          // pr: a trainee who has not yet spoken has neither passed nor failed.
          score: { type: "str", default: "retry_5" },
          end_diagnosis: { type: "str", default: "no" },
          feedback_conversation_history: { type: "list", default: [] },
          total: { type: "str" },
          feedback: { type: "str" },
          summary: { type: "str" },
          node_type: { type: "str" },
        },
        start_node: "ask_for_input",
      },
      "webhook-url": PRACTICE_WEBHOOK_URL,
    },
    // A different voice from mm/pr — those two are the same clipped, irritated
    // register, and this patient is neither. `aura-2-arcas-en` is the warmer,
    // slower male voice in the Aura 2 set.
    //
    // The inactivity nudge is HIS, and it is written to stay in character while
    // doing the opposite of what Mr Cheryl's does: a patient who is met with
    // silence assumes he has said something wrong, and the line reads as the
    // deference of a man who does not want to be a nuisance. It is also, on
    // this track only, a small trap — a trainee who is holding a deliberate
    // therapeutic silence should not be rescued from it too early, which is why
    // the timer is left at the default rather than shortened.
    ...buildVoiceCustoms({
      ttsModel: "aura-2-arcas-en",
      // Off — sends `"pre-fire": false` and an empty pre-fire-config.
      preFire: false,
      inactivityMessage:
        "Sorry, doctor. Did I say something wrong? You carry on, I am listening.",
    }),
    // Below the spread on purpose — it replaces the deepgram stt_id that
    // buildVoiceCustoms sets. Soniox, English only; see STT_SONIOX_EN.
    stt_id: STT_SONIOX_EN,
  };
}
