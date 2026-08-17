"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import fixWebmDuration from "fix-webm-duration";
import {
  buildCustoms,
  waitForIceGathering,
  PARTICIPANTS,
  PARTICIPANTS_VIDEO,
  VX_SERVER,
  VX_SERVER_GPU,
  FLOW_API_KEY,
} from "@/lib/voice/customs";
import {
  buildPracticeCustoms,
  INTERVIEWERS,
  type InterviewerGender,
  type PracticeDrive,
} from "@/lib/voice/practiceCustoms";
import { buildClinicalCustoms } from "@/lib/voice/clinicalCustoms";
import {
  buildWorkflowCustoms,
  type CustomWorkflow,
} from "@/lib/voice/workflowCustoms";
import { buildMuthuCustoms, MUTHU_NAME } from "@/lib/voice/muthuCustoms";
import { buildCherylCustoms, CHERYL_NAME } from "@/lib/voice/cherylCustoms";
import { buildVpsCustoms, VPS_NAME } from "@/lib/voice/vpsCustoms";
import {
  OUTCOME_LABEL,
  OUTCOME_TONE,
  parseRunningScore,
} from "@/lib/practice/runningScore";
import type { ClinicalScenario } from "@/lib/research/scenarioGeneration";
import type { CompanyContext } from "@/lib/voice/companyContext";
import { startRound } from "@/lib/actions/student";
import {
  startPracticeRound,
  completePracticeRound,
} from "@/lib/actions/practice";
import { beginBackgroundUpload } from "@/lib/practice/recordingUpload";

type ConnState = "connecting" | "connected" | "failed";
type AiState = "waiting" | "listening" | "thinking" | "speaking";

/**
 * How the room lays the two video panes out.
 *
 *   split — both panes side by side, sharing the stage equally.
 *   focus — the AI fills the stage, you shrink to a corner tile.
 *   ai    — the AI alone, nothing else on screen.
 *   you   — you alone, for checking your own framing and lighting.
 *
 * Crucially this only ever changes CLASSES. Both <video> elements stay mounted
 * in every mode, because each one's `srcObject` is assigned once when the call
 * connects and unmounting the element would drop the stream for good — and
 * because the recording canvas composites straight from these two elements, so
 * a pane that stopped rendering would leave a frozen half in the saved video.
 * That is also why the off-stage pane is hidden with `opacity-0` and not with
 * `hidden`: `display: none` lets the browser stop decoding frames.
 */
type ViewMode = "split" | "focus" | "ai" | "you";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "split", label: "Side by side" },
  { value: "focus", label: "AI large, you in the corner" },
  { value: "ai", label: "AI only" },
  { value: "you", label: "You only" },
];

const VIEW_MODE_KEY = "prepai.interviewRoom.viewMode";

function readSavedViewMode(): ViewMode {
  if (typeof window === "undefined") return "split";
  try {
    const saved = window.localStorage.getItem(VIEW_MODE_KEY);
    return VIEW_MODES.some((m) => m.value === saved)
      ? (saved as ViewMode)
      : "split";
  } catch {
    // Storage disabled (private mode, blocked cookies) — the default stands.
    return "split";
  }
}

/** Full stage. */
const PANE_ON =
  "relative min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border";
/** Corner tile — the picture-in-picture position in `focus`. */
const PANE_PIP =
  "absolute bottom-4 right-4 z-10 aspect-video w-36 overflow-hidden rounded-xl border-2 shadow-xl sm:w-52";
/** Off stage, but still laid out and still decoding. See ViewMode above. */
const PANE_OFF = `${PANE_PIP} pointer-events-none opacity-0`;

/**
 * Splits a flat pipe-table string (possibly all on one line with no newlines)
 * into rows by counting columns. Detects the header row's column count,
 * then splits the remaining cells into rows of that width.
 */
function parseInlineTable(tableStr: string): { header: string[]; body: string[][] } | null {
  // Remove leading/trailing pipes and split all cells
  const trimmed = tableStr.trim().replace(/^\||\|$/g, "");
  const allCells = trimmed.split("|").map((c) => c.trim());

  if (allCells.length < 2) return null;

  // Heuristic: detect column count from the first few cells.
  // Look for a repeated pattern. Try widths 2-6 (common table widths).
  // The header is the first `width` cells, skip separator rows (all dashes).
  for (let width = 2; width <= 6; width++) {
    if (allCells.length % width === 0 || (allCells.length - width) % width === 0) {
      const header = allCells.slice(0, width);
      let restStart = width;
      // Skip separator row if present (all cells are just dashes/colons)
      const maybeSep = allCells.slice(width, width * 2);
      if (maybeSep.length === width && maybeSep.every((c) => /^[-:]+$/.test(c))) {
        restStart = width * 2;
      }
      const rest = allCells.slice(restStart);
      if (rest.length === 0 || rest.length % width !== 0) continue;
      const body: string[][] = [];
      for (let i = 0; i < rest.length; i += width) {
        body.push(rest.slice(i, i + width));
      }
      // Sanity: header should look like labels, not numbers/long text
      if (header.some((h) => h.length > 0)) {
        return { header, body };
      }
    }
  }
  return null;
}

/** Detects markdown tables in text and renders them as HTML tables, leaving other text as paragraphs. */
function RichText({ text }: { text: string }) {
  // Detect if there's a pipe-table anywhere in the text (even inline/single-line).
  // A table needs at least 2 pipes with content between them repeated.
  const tableMatch = text.match(/(\|[^|]+(?:\|[^|]*)+\|)/);

  if (!tableMatch) {
    return <p className="mt-0.5 text-sm leading-relaxed text-ink">{text}</p>;
  }

  const tableStr = tableMatch[1];
  const beforeTable = text.slice(0, tableMatch.index).trim();
  const afterTable = text.slice(tableMatch.index! + tableStr.length).trim();

  const parsed = parseInlineTable(tableStr);

  if (!parsed) {
    return <p className="mt-0.5 text-sm leading-relaxed text-ink">{text}</p>;
  }

  const segments: { type: "text" | "table"; content?: string; parsed?: { header: string[]; body: string[][] } }[] = [];
  if (beforeTable) segments.push({ type: "text", content: beforeTable });
  segments.push({ type: "table", parsed });
  if (afterTable) segments.push({ type: "text", content: afterTable });

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return (
            <p key={i} className="mt-0.5 text-sm leading-relaxed text-ink">
              {seg.content}
            </p>
          );
        }
        const { header, body } = seg.parsed!;
        return (
          <div key={i} className="mt-2 overflow-x-auto">
            <table className="w-full text-xs border-collapse border border-line rounded">
              <thead>
                <tr className="bg-canvas">
                  {header.map((h, hi) => (
                    <th key={hi} className="border border-line px-2 py-1.5 text-left font-semibold text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "" : "bg-canvas/50"}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-line px-2 py-1.5 text-ink">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

/**
 * The fixed roleplays, and the two things the room needs from each: whose name
 * goes on every label, and which builder produces the customs.
 *
 * A map rather than the ternary chain this replaced. With two roleplays the
 * chain was readable; the third arm pushed it to five levels of nesting sharing
 * a fallthrough with `workflow` and `scenario`, where a misplaced branch reads
 * as valid code and sends a trainee into the wrong simulation. Adding a fourth
 * is now one entry here plus one key on the prop's union.
 *
 * Keyed by tenant, because the tenant key is the only thing that says who is on
 * the other side — `features.roleplay` is true on all three.
 */
const ROLEPLAYS = {
  mm: { name: MUTHU_NAME, build: buildMuthuCustoms, moodFrames: true },
  pr: { name: CHERYL_NAME, build: buildCherylCustoms, moodFrames: true },
  // moodFrames FALSE, and it is the whole reason this flag exists. On mm and pr
  // the avatar's two clips are an angry face and a settled one, so a `frame`
  // change genuinely is a mood change and the banner below reports it. Mr Nair's
  // clips are a resting pose and two raised hands — his frame changes because a
  // trainee asked him to lift an arm, and nothing about it says how he feels.
  // With the banner on, every hand raise would announce "you've lost him — Mr
  // Nair is agitated again" over a patient who is simply doing as he was told.
  vps: { name: VPS_NAME, build: buildVpsCustoms, moodFrames: false },
} as const;

/**
 * How the `vps` poses read on screen. Keyed by the same strings VPS_FACES
 * labels its clips with — that pairing is the contract, so a pose missing here
 * renders no chip rather than a raw "right-hand".
 *
 * `main` is deliberately absent: "sitting normally" is the absence of an
 * instruction, and a chip announcing it would be on screen for most of the
 * session saying nothing.
 */
const POSE_LABELS: Record<string, string> = {
  "right-hand": "Right hand raised",
  "left-hand": "Left hand raised",
};

/** One exchange as stored by the webhook: what the student said, what came back. */
type LiveTurn = {
  turnNumber: number;
  transcript: string;
  speak: string | null;
  frame: string | null;
  /** `pr` only — the physical scene events on this turn, e.g. ["receipt"]. */
  actions?: string[] | null;
  /** `pr` only — the running STATUS_VALUE score, e.g. "retry_5". */
  runningScore?: string | null;
};

/**
 * The props Mr Cheryl puts on the counter, and what the room shows for each.
 *
 * Placeholder imagery on purpose — these are stand-ins until the real assets
 * exist, and they are external URLs rather than files in /public precisely so
 * that a missing asset is obvious rather than a silent broken layout.
 *
 * `get-details` is not an image: it is the escalation form the trainee is being
 * asked to raise, so it renders as an actual form. `turn-away` is recorded and
 * shown as nothing for now — it coincides with the session ending, which the
 * room already announces on its own.
 */
const SCENE_PROPS: Record<
  string,
  { label: string; image?: string; form?: true; receipt?: true; recording?: true }
> = {
  receipt: {
    label: "Receipt",
    receipt: true,
  },
  shirt: {
    label: "The shirt",
    image:
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&q=80",
  },
  phone: {
    label: "His phone",
    recording: true,
  },
  "get-details": { label: "Escalation form", form: true },

  // `vps` — what Mr Nair puts on the desk. Placeholder imagery on the same
  // terms as Mr Cheryl's above: external URLs, so a missing asset is obvious.
  //
  // Only two of that track's five actions appear here. `shows-foot` is a body
  // and this product is not going to render one; `companion-cuts-in` is a
  // speech event the trainee has already heard; `turn-away` coincides with the
  // session ending, which the room announces itself. All three fall out at
  // `visibleProps` exactly as `turn-away` already did — see the note there.
  "medication-bag": {
    label: "His tablets",
    image:
      "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80",
  },
  "report-sheet": {
    label: "Blood test report",
    image:
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80",
  },
};

/**
 * The banner shown when Mr Muthu's face changes — `mm` only.
 *
 * `tone` is what he moved TO, not a judgement of the officer: `calm` is the
 * good direction and `angry` is the bad one, and the copy is written to be read
 * in half a second while someone is mid-conversation and cannot afford to
 * study it.
 */
type MoodShift = { id: number; tone: "calm" | "angry"; text: string };

/** How long a mood banner stays up before fading itself out. */
const MOOD_BANNER_MS = 6000;

/**
 * Longest the room will wait for Mr Muthu's closing line to finish before
 * tearing the call down anyway. Only reached when the VAD never reports him
 * speaking — otherwise the room leaves as soon as he falls silent.
 */
const SESSION_END_MAX_WAIT_MS = 15000;

/**
 * How often the live transcript polls. The turns it reads are written by the
 * voice server's webhook, which lands a turn or two behind the audio the
 * student just heard — so this is a running record to read back, never a
 * real-time caption track, and polling faster would only add load without
 * making it any more current.
 */
const TRANSCRIPT_POLL_MS = 3000;

// How long the backend waits after `ptt_up` before committing the turn. The
// streaming STT provider emits its final transcript slightly after the audio,
// so committing on the release itself clips the last word or two. 400ms is the
// server default, restated here because it is a number worth tuning from the
// client: raise it (500-700) if ends of turns are getting cut, lower it
// (250-300) if the gap between release and reply feels sluggish.
//
// A re-press inside this window CANCELS the pending commit and continues the
// same turn — which is why a student who releases, thinks of one more thing,
// and presses again gets one coherent answer rather than two fragments.
const PTT_RELEASE_GRACE_MS = 400;

/**
 * How long "Got it…" is allowed to stand before the button falls back to
 * "Hold to talk".
 *
 * The commit indicator used to clear on one signal only: the reply starting.
 * That leaves two ways to strand it forever, and both are reachable by tapping
 * the button rather than holding it.
 *   1. A tap so short it captures no speech commits an empty turn, the server
 *      has nothing to answer, no reply ever comes, and the button sits on
 *      "Got it…" for the rest of the session.
 *   2. Releasing while the AI is already mid-sentence never produces the
 *      false→true transition on `aiSpeaking` that the reset watches for, so
 *      the indicator stays stuck even though the turn resolved fine.
 * Either way the student sees a permanently busy button, presses it again
 * because nothing is happening, and gets the same result — the loop they
 * cannot get out of.
 *
 * Generous on purpose: this is a backstop for a stuck indicator, not a
 * timeout on the turn. A real reply almost always lands well inside it and
 * clears the state through the normal path.
 */
const PTT_COMMIT_TIMEOUT_MS = 8000;

/** idle → (press) → open → (release) → committing → (reply starts) → idle */
type PttState = "idle" | "open" | "committing";

export default function InterviewRoom({
  roundId,
  candidateName,
  company,
  drive,
  scenario,
  workflow,
  roleplay,
  kindLabel,
  backHref,
  variant = "company",
  pushToTalk = false,
}: {
  roundId: string;
  candidateName: string;
  /** Required for variant "company"; ignored for "practice". */
  company?: CompanyContext;
  /** Optional for variant "practice" — a self-created drive's company context. */
  drive?: PracticeDrive;
  /**
   * Set on the clinical track: runs the simulated-patient workflow instead of
   * the interviewer one. Everything else about a practice round — the round
   * lifecycle, the recording, the webhook — is genuinely identical between the
   * two, which is why this is a swapped workflow rather than a third variant.
   */
  scenario?: ClinicalScenario;
  /**
   * Set on the `cus` track: runs the customer's own greeting+prompt with no
   * scoring and no vision. Mutually exclusive with `scenario`.
   */
  workflow?: CustomWorkflow;
  /**
   * WHICH fixed roleplay this is, or undefined for the tracks that aren't one.
   * Takes no content prop because there is none to pass — each roleplay's
   * greeting and prompt are compiled into its own module. Like `workflow` it
   * renders an avatar, but a two-faced one that switches expression on the
   * `frame` the model returns each turn. Mutually exclusive with `workflow`
   * and `scenario`.
   *
   * A discriminator rather than the boolean it started as: `features.roleplay`
   * is now true on three tenants, and the tenant key is the only thing that says
   * whether the person on the other side is Mr Muthu, Mr Cheryl or Mr Nair.
   * Every truthiness check against this prop still reads as "is this a
   * roleplay", which is why the branches below did not have to change.
   *
   * Kept as a literal union rather than widened to `Tenant`: it is what makes
   * the ROLEPLAYS lookup above exhaustive, so adding a roleplay tenant without
   * a builder is a type error rather than a crash at connect time.
   */
  roleplay?: keyof typeof ROLEPLAYS;
  kindLabel: string;
  backHref: string;
  /** "practice" runs the generic, deliberately-scored practice workflow instead. */
  variant?: "company" | "practice";
  /**
   * Whether this track OFFERS push-to-talk, not whether it is on — the student
   * picks that on the preflight screen and the default is off (free-flowing,
   * exactly as before). Passed only by the tracks whose flow is set up for it:
   * the backend forces `stt-native` when PTT is on, so a flow still running
   * `speech-native` would have its process type changed underneath it.
   */
  pushToTalk?: boolean;
}) {
  const interviewerName =
    variant === "practice"
      ? roleplay
        ? ROLEPLAYS[roleplay].name
        : (scenario?.patientName ?? drive?.companyName ?? "Practice Interviewer")
      : company!.name;
  // Which voice backend this session talks to. Same branch as the
  // PARTICIPANTS_VIDEO one further down and for the same reason: cus
  // (`workflow`) and the two roleplays are the tracks that render an avatar, so
  // they run against the GPU deployment. Both legs of the handshake — the ICE
  // config and the SDP offer — have to agree, so it is picked once here rather
  // than at each fetch.
  const vxServer = workflow || roleplay ? VX_SERVER_GPU : VX_SERVER;
  // How the AI video sits in its pane — a property of the AVATAR CLIPS, not of
  // the room. Every other track's clips are landscape, so `object-cover` fills
  // the pane with no visible loss. vps's were shot PORTRAIT, and cover on a
  // landscape pane crops the left and right off a standing figure — which here
  // means cropping the very hands the exercise is about.
  //
  // `object-contain` rather than a portrait-shaped pane: the stage is fluid
  // (PANE_ON is `flex-1`) and its shape changes with viewMode and viewport, so
  // there is no fixed box to match a ratio against. Letterboxing against the
  // card background always shows the whole figure, whatever shape the pane
  // happens to be. The candidate pane is untouched — that is a webcam, and
  // webcams are landscape.
  const aiVideoFit = roleplay === "vps" ? "object-contain" : "object-cover";
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [connState, setConnState] = useState<ConnState>("connecting");
  const [aiState, setAiState] = useState<AiState>("waiting");
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  // The student's choice on the preflight screen. Off by default: the ordinary
  // session is free-flowing, and PTT is the option for anyone who wants the
  // turn to end when THEY say it does rather than when a silence threshold
  // does — someone who blocks or stammers, thinks in long pauses, or is
  // sitting somewhere noisy.
  const [usePtt, setUsePtt] = useState(false);
  // Which interviewer the student meets. Client state only, exactly like the
  // PTT choice above — it is a per-session preference, not a fact about the
  // student, so nothing is persisted and there is no schema for it.
  //
  // Female is the default: it is the Deepgram voice "aura-2-thalia-en", which
  // is what buildVoiceCustoms falls back to anyway; the male counterpart is
  // "aura-2-odysseus-en". With the picker disabled this never moves off
  // "female".
  // Mirrored for the same reason usePttRef exists: the WebRTC bootstrap effect
  // below reads this while building customs and must not re-run when it moves.
  const interviewerRef = useRef<InterviewerGender>("female");
  const [pttState, setPttState] = useState<PttState>("idle");
  const [hasUserVid, setHasUserVid] = useState(false);
  const [hasAiVid, setHasAiVid] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [moodShift, setMoodShift] = useState<MoodShift | null>(null);
  // Roleplay only: the agent has ended the session and the debrief has been
  // written. Set from the poll, acted on once the closing line has played out.
  const [sessionEnded, setSessionEnded] = useState(false);
  // `pr` only. The running score as last returned ("retry_5"), and every scene
  // action fired so far this session, in the order they happened.
  const [runningScore, setRunningScore] = useState<string | null>(null);
  // `vps` only — the pose the patient is currently holding, so the trainee can
  // see that an instruction actually landed. State rather than the existing
  // lastFrameRef because this one is rendered: a ref would update silently and
  // the chip would sit on whatever pose it happened to mount with.
  const [poseFrame, setPoseFrame] = useState<string | null>(null);
  const [sceneActions, setSceneActions] = useState<string[]>([]);
  const [formDone, setFormDone] = useState(false);
  // How the two video panes are arranged. A per-person preference rather than
  // a per-session one — someone who only ever wants to watch the avatar wants
  // that on every session — so it is remembered in localStorage.
  //
  // Reading storage straight in the initialiser is safe here, unusually: this
  // value is only ever read below the `if (!started)` gate, and `started` is
  // false on the server, so the remembered layout cannot reach the SSR output
  // and cannot disagree with it.
  const [viewMode, setViewMode] = useState<ViewMode>(readSavedViewMode);
  // Whether the transcript rail is open. Independent of `showTranscript`,
  // which decides whether there is a transcript to open at all: closing the
  // rail must not stop the poll that fills it, or reopening it would show a
  // hole where the turns spoken while it was shut should be.
  const [transcriptOpen, setTranscriptOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const roomRef = useRef<HTMLDivElement>(null);

  const parsedRunningScore = parseRunningScore(runningScore);
  // `turn-away` is in SCENE_PROPS' gaps on purpose — it is recorded on the turn
  // but has nothing to render, so it falls out here rather than being special-
  // cased at the render site.
  const visibleProps = sceneActions
    .map((key) => ({ key, prop: SCENE_PROPS[key] }))
    .filter((entry): entry is { key: string; prop: (typeof SCENE_PROPS)[string] } =>
      Boolean(entry.prop),
    );
  // Whether the score + props rail is on screen. Read twice — once to render
  // it, once to reserve the room it needs on the stage — so it is computed once
  // here rather than being two expressions that can drift.
  //
  // `pr` AND `vps`, the two roleplays whose graphs return a running score and
  // scene actions. Not `mm`, which returns neither, so the rail would be an
  // empty box pinned over his face for the whole session. vps adds a third
  // trigger of its own: the pose chip, which can be the only thing in the rail
  // (he raises a hand long before he has scored or handed anything over).
  const sideRailVisible =
    (roleplay === "pr" || roleplay === "vps") &&
    Boolean(
      parsedRunningScore ||
        visibleProps.length > 0 ||
        (poseFrame && POSE_LABELS[poseFrame]),
    );

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // The PTT data channel, and whether a key/pointer is currently down.
  //
  // `usePtt` is mirrored into a ref because the WebRTC bootstrap effect reads
  // it inside `connect()` and keys only off `started`. The value cannot change
  // once a session is running (the toggle only exists on the preflight screen),
  // so this is about reading it without re-arming the connection, not about
  // tracking changes.
  const pttChannelRef = useRef<RTCDataChannel | null>(null);
  const pttHeldRef = useRef(false);
  const usePttRef = useRef(false);
  // Deadline on the "committing" indicator — see PTT_COMMIT_TIMEOUT_MS.
  const pttCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors `aiSpeaking` so the VAD callback can tell a reply STARTING from
  // the same reply still going: it fires per audio frame, not per utterance.
  const aiSpeakingRef = useRef(false);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const aiAudioRef = useRef<HTMLAudioElement>(null);
  const aiVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingMimeTypeRef = useRef<string>("");
  const recordingStartedAtRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  // Read inside the poll without making it a dependency — re-creating the
  // interval on every new turn would reset the timer and drift the cadence.
  const lastTurnRef = useRef(0);
  // The last face we actually saw, for the same reason: the poll needs to
  // compare against it without the comparison itself re-arming the interval.
  // Starts null so the FIRST face of a session is only recorded, never
  // announced — Mr Muthu opening angry is the premise, not a change.
  const lastFrameRef = useRef<string | null>(null);

  function changeViewMode(next: ViewMode) {
    setViewMode(next);
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, next);
    } catch {
      // Not being able to remember the choice is not a reason to refuse it.
    }
  }

  // Fullscreen is tracked by listening rather than by assuming: Escape and the
  // browser's own controls exit it without going through our button, and a
  // toggle that still says "Exit fullscreen" afterwards is worse than none.
  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await roomRef.current?.requestFullscreen();
      }
    } catch {
      // iOS Safari has no Element.requestFullscreen. The room is already
      // h-screen, so refusing here costs the student nothing.
    }
  }

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [started]);

  // Live transcript. Only the practice variant has a webhook receiver writing
  // turns (customs.ts posts to a bare origin that never reaches one), so
  // anywhere else this would poll forever for rows that are never created.
  const showTranscript = variant === "practice";

  useEffect(() => {
    if (!started || !showTranscript) return;
    let stopped = false;

    async function poll() {
      try {
        const r = await fetch(
          `/api/practice/rounds/${roundId}/turns?after=${lastTurnRef.current}`,
          { cache: "no-store" },
        );
        if (!r.ok || stopped) return;
        const data = (await r.json()) as {
          turns: LiveTurn[];
          status?: string;
        };
        // Checked before the early return below, because the payload that
        // completes the round can carry no new turns at all.
        if (roleplay && data.status === "completed") setSessionEnded(true);
        if (stopped || !data.turns?.length) return;

        lastTurnRef.current = data.turns[data.turns.length - 1].turnNumber;
        // Append rather than replace: the request only asks for turns after
        // the last one seen, so what comes back is the delta, not the whole
        // conversation.
        setTurns((prev) => [...prev, ...data.turns]);

        if (roleplay) {
          // Walk the whole delta in order. A slow poll can return several turns
          // at once, and only the LAST transition in that batch is still true —
          // announcing every one of them would flash two contradictory banners
          // for a mood the officer already moved past.
          //
          // Gated on moodFrames: only mm and pr have clips whose change MEANS a
          // mood change. vps's frames are body poses, so a transition there is
          // the patient lifting an arm he was asked to lift and there is nothing
          // to announce. See the note on ROLEPLAYS.
          let shift: MoodShift | null = null;
          if (ROLEPLAYS[roleplay].moodFrames) {
            for (const turn of data.turns) {
              if (!turn.frame) continue;
              const previous = lastFrameRef.current;
              lastFrameRef.current = turn.frame;
              if (!previous || previous === turn.frame) continue;
              shift =
                turn.frame === "normal"
                  ? {
                      id: turn.turnNumber,
                      tone: "calm",
                      text: `Good job — ${interviewerName} is settling down.`,
                    }
                  : {
                      id: turn.turnNumber,
                      tone: "angry",
                      text: `You've lost him — ${interviewerName} is agitated again.`,
                    };
            }
          }
          if (shift) setMoodShift(shift);

          // The pose half of the same walk, for the tracks whose frames are
          // bodies rather than moods. Last-wins: only the newest pose is the one
          // he is still holding.
          if (!ROLEPLAYS[roleplay].moodFrames) {
            const latestFrame = [...data.turns]
              .reverse()
              .find((t) => t.frame)?.frame;
            if (latestFrame) setPoseFrame(latestFrame);
          }

          // The running score and the scene actions, both `pr` only and both
          // read off the same delta. Last-wins for the score (it is a running
          // total, so only the newest is true); actions are collected across
          // the batch, since two of them landing in one poll are two things
          // that genuinely happened and both deserve to be shown.
          const latestScore = [...data.turns]
            .reverse()
            .find((t) => t.runningScore)?.runningScore;
          if (latestScore) setRunningScore(latestScore);

          const fired = data.turns.flatMap((t) => t.actions ?? []);
          if (fired.length) {
            setSceneActions((prev) => {
              // Deduplicated against everything already fired this session:
              // the prompt says fire each once, but a model that repeats
              // "shirt" should not reopen a prop the trainee already dealt with.
              const next = [...prev];
              for (const a of fired) if (!next.includes(a)) next.push(a);
              return next;
            });
          }
        }
      } catch {
        // A dropped poll is not worth surfacing — the transcript is a
        // convenience, and the next tick picks up whatever was missed.
      }
    }

    poll();
    const t = setInterval(poll, TRANSCRIPT_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [started, showTranscript, roundId, roleplay, interviewerName]);

  // Auto-dismiss, keyed on the banner's id so a second shift arriving while the
  // first is still up restarts the clock rather than inheriting its remainder.
  useEffect(() => {
    if (!moodShift) return;
    const t = setTimeout(() => setMoodShift(null), MOOD_BANNER_MS);
    return () => clearTimeout(t);
  }, [moodShift]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  // Lightweight VAD to drive the AI "listening/speaking" indicator.
  const startVAD = useCallback(
    (
      analyser: AnalyserNode,
      threshold: number,
      onSpeak: () => void,
      onSilence: () => void,
    ) => {
      const buf = new Uint8Array(analyser.fftSize);
      let speakFrames = 0;
      let silentFrames = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length) * 100;
        if (rms > threshold) {
          speakFrames++;
          silentFrames = 0;
          if (speakFrames > 3) onSpeak();
        } else {
          silentFrames++;
          speakFrames = 0;
          if (silentFrames > 8) onSilence();
        }
        requestAnimationFrame(tick);
      };
      tick();
    },
    [],
  );

  // ── Push-to-talk transport ──
  //
  // The two halves are deliberately separate. `pttDown`/`pttUp` are guarded by
  // a local `held` latch so a repeated keydown (browsers autorepeat ~30×/s
  // while a key is held) can never restart a turn that is already open, and so
  // a stray release can never send an unmatched `ptt_up`.
  const sendPtt = useCallback((type: "ptt_down" | "ptt_up") => {
    const ch = pttChannelRef.current;
    if (ch?.readyState === "open") ch.send(JSON.stringify({ type }));
  }, []);

  /** Cancels a pending commit-indicator deadline, if one is armed. */
  const clearCommitTimer = useCallback(() => {
    if (pttCommitTimerRef.current) {
      clearTimeout(pttCommitTimerRef.current);
      pttCommitTimerRef.current = null;
    }
  }, []);

  const pttDown = useCallback(() => {
    if (pttHeldRef.current) return;
    pttHeldRef.current = true;
    // A press inside the release grace window cancels the pending commit
    // server-side and continues the same turn, so the "Got it…" deadline that
    // went with it has to go too — otherwise it fires mid-turn and the button
    // says idle while the mic is open.
    clearCommitTimer();
    sendPtt("ptt_down");
    // Deliberately NOT setting "open" here. The indicator has to tell the
    // truth about what the server is capturing, and the gate opens when the
    // message lands — roughly one round trip later. The `ptt_state` ack is
    // what promotes this to "open".
  }, [sendPtt, clearCommitTimer]);

  const pttUp = useCallback(() => {
    if (!pttHeldRef.current) return;
    pttHeldRef.current = false;
    sendPtt("ptt_up");
    // "committing" covers the release grace window. Without a state here the
    // UI goes blank between release and the reply, which is the single biggest
    // source of "did it hear me?" double-presses.
    setPttState("committing");
    // ...and this is what guarantees it ends. See PTT_COMMIT_TIMEOUT_MS for
    // the two ways the reply-based reset never arrives.
    clearCommitTimer();
    pttCommitTimerRef.current = setTimeout(() => {
      pttCommitTimerRef.current = null;
      // Only if nothing else has moved it on: a press since then has the mic
      // open again, and stamping "idle" over that would be a lie.
      setPttState((s) => (s === "committing" ? "idle" : s));
    }, PTT_COMMIT_TIMEOUT_MS);
  }, [sendPtt, clearCommitTimer]);

  const cleanup = useCallback(() => {
    // Commit whatever the student managed to say before the transport goes.
    // A duplicate `ptt_up` is logged and ignored server-side, so this is free
    // insurance rather than something to be careful about.
    pttUp();
    clearCommitTimer();
    pttChannelRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    pcRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  }, [pttUp, clearCommitTimer]);

  // WebRTC bootstrap
  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const MAX_RECONNECTS = 5;

    // Retries once before giving up — TURN config is required for anyone on a
    // real network (mobile data, cross-region); silently proceeding with an
    // empty ICE server list produces a connection that can never complete for
    // exactly those users; returns null only after both attempts fail.
    async function fetchIceServers(): Promise<RTCIceServer[] | null> {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await fetch(`${vxServer}/rtc/ice-servers`, {
            signal: AbortSignal.timeout(5000),
            // The voice server is often an ngrok free-tier tunnel in dev — ngrok
            // intercepts real-browser requests (by User-Agent) with an HTML
            // "you're about to visit..." interstitial that has no CORS
            // headers, which the browser then reports as a CORS failure.
            // This header bypasses that page; harmless against any other host.
            headers: { "ngrok-skip-browser-warning": "true" },
          });
          if (r.ok) {
            const d = await r.json();
            const servers: RTCIceServer[] = d.ice_servers || [];
            console.log(
              `[ICE] fetched ${servers.length} ice server(s) on attempt ${attempt + 1}:`,
              servers.map((s) => s.urls),
            );
            return servers;
          }
          console.warn(
            `[ICE] attempt ${attempt + 1} got HTTP ${r.status} from ${vxServer}/rtc/ice-servers`,
          );
        } catch (e) {
          console.warn(`[ICE] attempt ${attempt + 1} threw:`, e);
        }
        // Give a transient blip (cold tunnel, brief network hiccup) a moment
        // to pass before the second attempt, instead of firing back-to-back.
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
      }
      console.error(
        `[ICE] both attempts to fetch ${vxServer}/rtc/ice-servers failed`,
      );
      return null;
    }

    async function connect(stream: MediaStream) {
      if (cancelled) return;

      const iceServers = await fetchIceServers();
      if (iceServers === null) {
        // Couldn't get TURN config after retrying — treat it as a connection
        // failure (same reconnect-with-backoff path as every other failure
        // below) instead of silently degrading into a doomed peer connection.
        if (!cancelled && reconnectAttempts < MAX_RECONNECTS) {
          reconnectAttempts++;
          setConnState("connecting");
          reconnectTimer = setTimeout(
            () => connect(stream),
            Math.min(1000 * reconnectAttempts, 5000),
          );
        } else if (!cancelled) {
          setConnState("failed");
        }
        return;
      }

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // The data channel MUST exist before createOffer() — the backend only
      // listens for one (`pc.on('datachannel')`) and never opens its own, so a
      // channel added later would need a renegotiation the server isn't going
      // to drive. Created here, it rides the first SDP.
      //
      // Ordered and reliable, i.e. the defaults, left explicitly alone: a
      // dropped or reordered `ptt_up` would leave the mic latched open on the
      // server with nothing in the UI to say so. That guarantee is the entire
      // reason this rides a data channel instead of anything cheaper.
      if (usePttRef.current) {
        const ch = pc.createDataChannel("chat");
        pttChannelRef.current = ch;
        // Reconnect safety. `connect()` runs again after a dropped connection,
        // and a student holding the key at the moment it dropped would leave
        // the latch stuck true — every later press then no-ops and the mic
        // never opens again for the rest of the session.
        pttHeldRef.current = false;
        setPttState("idle");
        ch.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg?.type !== "ptt_state") return;
            // Only "open" is taken from the ack. A "closed" arriving after a
            // release must NOT reset the indicator to idle — the turn is still
            // in flight through the grace window, and `committing` is what
            // says so. Idle is restored when the reply actually starts.
            if (msg.state === "open") setPttState("open");
          } catch {
            // A malformed frame is not worth breaking the call over.
          }
        };
        // The channel going means nothing can be in flight any more, so the
        // latch is dropped with the indicator. Leaving `held` true here is the
        // other way the mic never opens again: every later press no-ops.
        ch.onclose = () => {
          pttHeldRef.current = false;
          clearCommitTimer();
          setPttState("idle");
        };
      }

      pc.ontrack = (e) => {
        console.log(
          `[RTC] ontrack: kind=${e.track.kind} id=${e.track.id} readyState=${e.track.readyState} muted=${e.track.muted} streams=${e.streams.length} streamTracks=${e.streams[0]?.getTracks().length ?? 0} (audio=${e.streams[0]?.getAudioTracks().length ?? 0}, video=${e.streams[0]?.getVideoTracks().length ?? 0})`,
        );
        if (e.track.kind === "audio" && aiAudioRef.current) {
          aiAudioRef.current.srcObject = e.streams[0];
          if (!audioCtxRef.current) {
            audioCtxRef.current = new AudioContext();
          }
          const ctx = audioCtxRef.current;
          const src = ctx.createMediaStreamSource(e.streams[0]);
          const an = ctx.createAnalyser();
          an.fftSize = 512;
          an.smoothingTimeConstant = 0.7;
          src.connect(an);
          startVAD(
            an,
            10,
            () => {
              // The VAD calls this on every frame it hears speech, not once
              // per utterance — so anything that must happen at the START of a
              // reply is gated on the ref, and only the transition runs it.
              const wasSpeaking = aiSpeakingRef.current;
              aiSpeakingRef.current = true;
              setAiSpeaking(true);
              setAiState("speaking");
              // The reply arriving is what ends the commit window — not a
              // timer, and not the server's "closed" ack, both of which would
              // clear the indicator while the student is still waiting to find
              // out whether they were heard. (PTT_COMMIT_TIMEOUT_MS is the
              // backstop for when this signal never comes at all.)
              if (!wasSpeaking) {
                clearCommitTimer();
                setPttState((s) => (s === "committing" ? "idle" : s));
              }
            },
            () => {
              aiSpeakingRef.current = false;
              setAiSpeaking(false);
              setAiState("listening");
            },
          );
        }
        if (e.track.kind === "video") {
          if (!aiVideoRef.current) {
            console.warn(
              "[RTC] got a video track but aiVideoRef isn't mounted yet",
            );
          } else {
            aiVideoRef.current.srcObject = e.streams[0];
            setHasAiVid(true);
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[RTC] iceConnectionState -> ${pc.iceConnectionState}`);
      };
      pc.onicegatheringstatechange = () => {
        console.log(`[RTC] iceGatheringState -> ${pc.iceGatheringState}`);
      };
      pc.onicecandidateerror = (e) => {
        const ev = e as RTCPeerConnectionIceErrorEvent;
        console.warn(
          `[RTC] ICE candidate error: code=${ev.errorCode} text="${ev.errorText}" url=${ev.url}`,
        );
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        console.log(`[RTC] connectionState -> ${st}`);
        if (st === "connected") {
          reconnectAttempts = 0;
          setConnState("connected");
          setAiState("listening");
          // Flag the round as in-progress (best effort).
          void (variant === "practice"
            ? startPracticeRound(roundId)
            : startRound(roundId));
        }
        if (st === "failed" || st === "disconnected") {
          pc.close();
          if (!cancelled && reconnectAttempts < MAX_RECONNECTS) {
            reconnectAttempts++;
            setConnState("connecting");
            reconnectTimer = setTimeout(
              () => connect(stream),
              Math.min(1000 * reconnectAttempts, 5000),
            );
          } else if (!cancelled) {
            setConnState("failed");
          }
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      const baseCustoms =
        variant !== "practice"
          ? buildCustoms(company!, candidateName)
          : roleplay
            ? ROLEPLAYS[roleplay].build(candidateName)
            : workflow
                ? buildWorkflowCustoms(candidateName, workflow)
                : scenario
                  ? buildClinicalCustoms(candidateName, scenario)
                  : buildPracticeCustoms(
                      candidateName,
                      drive,
                      interviewerRef.current,
                    );

      // PTT is a per-session override, not a property of the flow — which is
      // what lets one builder serve both the student who chose it and the one
      // who didn't. The builder ships the free-flowing shape (speech-native,
      // pre-fire on) and this replaces the three keys that cannot survive a
      // held key:
      //
      //   process-type    the backend forces stt-native under PTT and logs a
      //                   warning; sending it ourselves means the flow and the
      //                   server agree instead of the server correcting us.
      //   pre-fire        it exists to predict where a turn ends. PTT states
      //                   the turn end outright, so the prediction is at best
      //                   redundant and at worst fires mid-thought.
      //   pre-fire-config emptied with it, the same way buildVoiceCustoms
      //                   empties it whenever the flag is false.
      const customs = usePttRef.current
        ? {
            ...baseCustoms,
            "push-to-talk": true,
            "ptt-release-grace-ms": PTT_RELEASE_GRACE_MS,
            "process-type": "stt-native",
            "pre-fire": false,
            "pre-fire-config": {},
          }
        : baseCustoms;

      // Same branch as above: `workflow` (cus) and the roleplays are the tracks
      // with an avatar to send video for, and the roleplays' is the point —
      // its face is what the user reads to know whether they're getting
      // through. Everything else negotiates audio only, since the backend's
      // answer carries no m=video line — see the note by PARTICIPANTS in
      // customs.ts.
      const participants =
        workflow || roleplay ? PARTICIPANTS_VIDEO : PARTICIPANTS;

      let resp: Response;
      try {
        resp = await fetch(`${vxServer}/rtc/offer/audio`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            api_key: FLOW_API_KEY,
            "ngrok-skip-browser-warning": "true",
          },
          body: JSON.stringify({
            sdp: pc.localDescription?.sdp,
            type: pc.localDescription?.type,
            participants,
            customs,
            session_id: roundId,
          }),
        });
      } catch (e) {
        console.error(`[RTC] POST ${vxServer}/rtc/offer/audio threw:`, e);
        if (!cancelled && reconnectAttempts < MAX_RECONNECTS) {
          reconnectAttempts++;
          setConnState("connecting");
          reconnectTimer = setTimeout(
            () => connect(stream),
            Math.min(1000 * reconnectAttempts, 5000),
          );
        } else {
          setConnState("failed");
        }
        return;
      }

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        console.error(
          `[RTC] POST ${vxServer}/rtc/offer/audio -> HTTP ${resp.status}:`,
          body.slice(0, 500),
        );
        setConnState("failed");
        return;
      }
      const answer = await resp.json();
      const videoLines = (answer.sdp?.match(/^m=video.*$/gm) ?? []).length;
      console.log(
        `[RTC] remote answer SDP has ${videoLines} m=video line(s)${videoLines === 0 ? " — the backend's answer never offers video at all, so no video track will ever arrive regardless of frontend code" : ""}`,
      );
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log(
        "[RTC] transceivers after setRemoteDescription:",
        pc.getTransceivers().map((t) => ({
          mid: t.mid,
          kind: t.receiver.track?.kind,
          direction: t.direction,
          currentDirection: t.currentDirection,
        })),
      );
    }

    async function start() {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } catch {
          setConnState("failed");
          return;
        }
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (stream.getVideoTracks().length && userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
        setHasUserVid(true);
      }
      connect(stream);
    }

    start();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // ── Push-to-talk: the space bar ──
  //
  // Three guards here and every one of them is load-bearing:
  //   e.repeat      — a held key autorepeats keydown ~30×/s, and each repeat
  //                   would otherwise restart the turn and cancel the commit.
  //                   The `held` latch inside pttDown makes this safe anyway;
  //                   both exist because the failure is silent.
  //   preventDefault— Space scrolls the page, and re-activates whatever button
  //                   happens to have focus (Leave, for instance).
  //   blur / hidden — alt-tabbing mid-press means keyup never arrives, and the
  //                   mic would stay latched open until the student came back
  //                   and pressed again.
  useEffect(() => {
    if (!started || !usePtt) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      pttDown();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      pttUp();
    };
    const onHide = () => {
      if (document.hidden) pttUp();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", pttUp);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", pttUp);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [started, usePtt, pttDown, pttUp]);

  // (The commit window is closed from the VAD's speech-start callback in
  // `connect()` — the reply actually starting is the signal, and doing it
  // there keeps it out of a render-cascading effect.)

  // ── Self-recorded side-by-side composite (replaces voxio's own server-side
  // recording) — entirely best-effort. Any unsupported API here must never
  // affect the actual call, so everything is wrapped and silently no-ops on
  // failure (this is the normal path on Safari, which has no `video/webm`
  // MediaRecorder support at all).
  useEffect(() => {
    if (variant !== "practice") return;
    if (connState !== "connected") return;
    // Guards against the WebRTC bootstrap's own reconnect logic (up to 5
    // retries) re-firing this effect and spawning a second recorder.
    if (mediaRecorderRef.current) return;

    let cancelled = false;

    function hasRealVideo(video: HTMLVideoElement | null): boolean {
      return !!video?.srcObject && video.readyState >= 2 && video.videoWidth > 0;
    }

    async function waitForAiAudio(maxMs: number): Promise<MediaStream | null> {
      const start = Date.now();
      while (Date.now() - start < maxMs) {
        if (cancelled) return null;
        const s = aiAudioRef.current?.srcObject as MediaStream | null;
        if (s && s.getAudioTracks().length > 0) return s;
        await new Promise((r) => setTimeout(r, 200));
      }
      return null;
    }

    async function setupRecording() {
      try {
        if (typeof MediaRecorder === "undefined") return;

        // Each pane is 4:3 — matches typical webcam capture, so a plain
        // stretch-to-fit never has to distort the picture. Fixed, and
        // deliberately unrelated to the on-screen layout: the saved file is
        // the same side-by-side composite whichever ViewMode the student was
        // watching in, which is why the off-stage pane is hidden with opacity
        // rather than unmounted or `display: none`.
        const PANE_W = 480;
        const PANE_H = 360;
        const CANVAS_W = PANE_W * 2;
        const CANVAS_H = PANE_H;
        const TARGET_FPS = 12;
        const FRAME_MS = 1000 / TARGET_FPS;

        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Crops the source to the pane's aspect ratio before scaling — same
        // effect as CSS `object-fit: cover`, so a 16:9/4:3/portrait camera
        // feed fills the pane without ever being squeezed.
        function drawCover(
          video: HTMLVideoElement,
          dx: number,
          dy: number,
          dWidth: number,
          dHeight: number,
        ) {
          if (!ctx) return;
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          if (!vw || !vh) return;
          const targetRatio = dWidth / dHeight;
          const srcRatio = vw / vh;
          let sx: number;
          let sy: number;
          let sWidth: number;
          let sHeight: number;
          if (srcRatio > targetRatio) {
            sHeight = vh;
            sWidth = vh * targetRatio;
            sx = (vw - sWidth) / 2;
            sy = 0;
          } else {
            sWidth = vw;
            sHeight = vw / targetRatio;
            sx = 0;
            sy = (vh - sHeight) / 2;
          }
          ctx.drawImage(video, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
        }

        function drawPane(
          video: HTMLVideoElement | null,
          x: number,
          label: string,
        ) {
          if (!ctx) return;
          if (hasRealVideo(video)) {
            drawCover(video as HTMLVideoElement, x, 0, PANE_W, PANE_H);
          } else {
            ctx.fillStyle = "#111318";
            ctx.fillRect(x, 0, PANE_W, PANE_H);
            ctx.fillStyle = "#555b66";
            ctx.font = "16px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(label, x + PANE_W / 2, PANE_H / 2);
          }
        }

        let lastDraw = 0;
        function draw(ts: number) {
          if (cancelled) return;
          if (ts - lastDraw >= FRAME_MS) {
            lastDraw = ts;
            drawPane(aiVideoRef.current, 0, "AI");
            drawPane(userVideoRef.current, PANE_W, candidateName);
          }
          rafIdRef.current = requestAnimationFrame(draw);
        }
        rafIdRef.current = requestAnimationFrame(draw);

        const canvasStream = canvas.captureStream(TARGET_FPS);

        // Real elapsed time can arrive after "connected" fires — wait a
        // bounded amount rather than a single one-shot check.
        const aiStream = await waitForAiAudio(5000);
        const micStream = streamRef.current;
        if (cancelled) return;
        if (!aiStream || !micStream || micStream.getAudioTracks().length === 0) {
          console.warn(
            "[recording] no AI/mic audio track available — skipping recording for this session",
          );
          if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
          return;
        }

        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        const audioCtx = audioCtxRef.current;
        if (audioCtx.state === "suspended") {
          await audioCtx.resume().catch(() => {});
        }

        const aiSource = audioCtx.createMediaStreamSource(aiStream);
        const userSource = audioCtx.createMediaStreamSource(micStream);
        const merger = audioCtx.createChannelMerger(2);
        aiSource.connect(merger, 0, 0); // AI -> output channel 0 (left)
        userSource.connect(merger, 0, 1); // student mic -> output channel 1 (right)
        const dest = audioCtx.createMediaStreamDestination();
        merger.connect(dest);

        const combined = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);

        const candidates = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm",
        ];
        const mimeType = candidates.find((c) => MediaRecorder.isTypeSupported(c));
        if (!mimeType || cancelled) return;

        recordingMimeTypeRef.current = mimeType;
        const recorder = new MediaRecorder(combined, {
          mimeType,
          videoBitsPerSecond: 1_000_000,
          audioBitsPerSecond: 96_000,
        });
        recordedChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recordingStartedAtRef.current = Date.now();
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
      } catch (err) {
        console.warn(
          "[recording] setup failed — continuing without recording:",
          err,
        );
      }
    }

    setupRecording();

    return () => {
      cancelled = true;
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      // Best-effort stop on unmount/reconnect teardown. The deliberate leave()
      // path stops + uploads explicitly before this cleanup ever runs.
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connState, variant]);

  /**
   * Seals the recording and hands it to the background uploader. Returns
   * whether a recording is actually on its way, which is what tells the server
   * to expect a file.
   *
   * Everything awaited here is local and fast — stopping the recorder and
   * patching the webm header. The network transfer deliberately is not
   * awaited: the student is done and shouldn't be held on the call screen
   * watching a progress bar for a file they've already finished producing.
   */
  const sealAndQueueRecording = useCallback(async (): Promise<boolean> => {
    try {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return false;

      if (recorder.state !== "inactive") {
        await new Promise<void>((resolve) => {
          recorder.addEventListener("stop", () => resolve(), { once: true });
          recorder.stop();
        });
      }
      mediaRecorderRef.current = null;

      const chunks = recordedChunksRef.current;
      recordedChunksRef.current = [];
      if (chunks.length === 0) return false;

      const mimeType = recordingMimeTypeRef.current || "video/webm";
      let blob = new Blob(chunks, { type: mimeType });

      // MediaRecorder writes webm without a real duration in the container
      // (it's left "unknown"), so browsers play it back like a live stream —
      // an always-full, unseekable scrubber. Patch in the actual recorded
      // length before upload.
      if (mimeType.includes("webm")) {
        const durationMs = Date.now() - recordingStartedAtRef.current;
        blob = await fixWebmDuration(blob, durationMs).catch(() => blob);
      }

      beginBackgroundUpload(roundId, blob, mimeType);
      return true;
    } catch (err) {
      console.warn("[recording] could not queue upload:", err);
      return false;
    }
  }, [roundId]);

  const toggleMic = () => {
    if (!streamRef.current) return;
    const next = !micMuted;
    setMicMuted(next);
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  const leaveTo = async (destination: string) => {
    let recordingExpected = false;
    if (variant === "practice") {
      setSaving(true);
      recordingExpected = await sealAndQueueRecording();
    }
    cleanup();
    if (variant === "practice") {
      // For now, leaving simply ends the round — considered complete. Must be
      // awaited (not fire-and-forget): this is what invalidates the cached
      // dashboard/company reads, and navigating before it completes can land
      // on `/practice` mid-invalidation. `recordingExpected` is also what
      // makes the results page wait for the upload instead of reporting that
      // there's no recording.
      await completePracticeRound(roundId, recordingExpected).catch(() => {});
    }
    router.push(destination);
  };

  const leave = () => leaveTo(backHref);

  // Mr Muthu ended the meeting. Tear the call down and send the officer to
  // their assessment instead of leaving them sitting in a room with a man who
  // has already walked out.
  //
  // This is client-side because it has to be: `trigger_hangup` is implemented
  // on the callbot (telephony) actions class only — the voicebot one this track
  // runs on has no equivalent, so nothing on the server can close a web call.
  //
  // It waits for `aiSpeaking` to fall rather than firing on the flag, because
  // the webhook lands while his closing line is still being spoken; navigating
  // on arrival would cut him off mid-sentence. The timeout is the backstop for
  // the case where the VAD never reports speech at all (he ended on a turn with
  // no audio, or the analyser was already torn down), so the room can't hang
  // here forever waiting for a sound that isn't coming.
  const autoLeftRef = useRef(false);
  useEffect(() => {
    if (!sessionEnded || autoLeftRef.current) return;

    const go = () => {
      if (autoLeftRef.current) return;
      autoLeftRef.current = true;
      void leaveTo(`/practice/rounds/${roundId}`);
    };

    const backstop = setTimeout(go, SESSION_END_MAX_WAIT_MS);
    const settle = setInterval(() => {
      if (!aiSpeaking) {
        clearInterval(settle);
        clearTimeout(backstop);
        go();
      }
    }, 500);

    return () => {
      clearInterval(settle);
      clearTimeout(backstop);
    };
    // `leaveTo` is deliberately not a dependency — it is recreated every render
    // and re-running this effect would restart both timers on each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionEnded, aiSpeaking, roundId]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // ── Preflight ──
  if (!started) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas px-6">
        <div className="w-full max-w-md">
          <div className="mb-4 inline-flex rounded-md bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
            {kindLabel}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">
            Ready when <span className="text-brand">you are.</span>
          </h1>
          <div className="mt-6 rounded-xl border border-line bg-card p-5">
            <Row
              label={variant === "practice" ? "Interviewer" : "Company"}
              value={interviewerName}
            />
            <div className="my-3 h-px bg-line" />
            <Row label="Candidate" value={candidateName} />
          </div>
          <p className="mt-4 text-sm text-muted">
            The AI interviewer opens the session. This is a practice run — speak
            naturally. Your microphone and camera will be requested.
          </p>
          {/* Offered, never imposed, and never framed as an accommodation the
              student has to identify themselves to claim: it is two ways of
              taking a turn, and either is a normal choice. Free-flowing stays
              the default so nothing changes for anyone who doesn't want it. */}
          {/* INTERVIEWER PICKER — DISABLED. Every student gets the female
              interviewer (Shreya, Deepgram voice "aura-2-thalia-en"), which is
              the default `buildPracticeCustoms` already falls back to, so
              removing the UI alone is enough to force it — no other change is
              needed.

              To re-enable: uncomment the block below and restore the
              `interviewer`/`setInterviewer` useState by the PTT state near the
              top of this component. `interviewerRef` is deliberately kept: it
              is what the WebRTC bootstrap reads, and with no UI to move it it
              simply stays on "female".

              The male option (Aakash, voice "aura-2-odysseus-en") is still
              wired end to end in practiceCustoms.ts and works if passed — it is
              the voice mm and cus already run on, so it is no longer the
              untested half of this pair, but it still wants a live check on
              this track before it goes back in front of students. */}
          {/*
          {variant === "practice" && !roleplay && !workflow && !scenario && (
            <fieldset className="mt-6 rounded-xl border border-line bg-card p-4">
              <legend className="px-1 text-xs uppercase tracking-wide text-muted">
                Who&rsquo;ll interview you
              </legend>
              <div className="mt-1 flex flex-col gap-2">
                {(
                  [
                    { value: "female", title: `${INTERVIEWERS.female.name} (female voice)` },
                    { value: "male", title: `${INTERVIEWERS.male.name} (male voice)` },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                      interviewer === option.value
                        ? "border-brand bg-brand-soft"
                        : "border-line hover:border-brand/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="interviewer"
                      className="mt-0.5 shrink-0 accent-brand"
                      checked={interviewer === option.value}
                      onChange={() => {
                        setInterviewer(option.value);
                        interviewerRef.current = option.value;
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">
                        {option.title}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-2 px-1 text-xs leading-snug text-muted">
                Only the voice and name change — the questions, the coaching and
                the scoring are identical either way.
              </p>
            </fieldset>
          )}
          */}
          {pushToTalk && (
            <fieldset className="mt-6 rounded-xl border border-line bg-card p-4">
              <legend className="px-1 text-xs uppercase tracking-wide text-muted">
                How you&rsquo;ll talk
              </legend>
              <div className="mt-1 flex flex-col gap-2">
                {(
                  [
                    {
                      value: false,
                      title: "Free-flowing",
                      hint: "Your turn ends when you pause.",
                    },
                    {
                      value: true,
                      title: "Hold to talk",
                      hint: "Hold space while you speak. Pause as long as you like.",
                    },
                  ] as const
                ).map((option) => (
                  <label
                    key={String(option.value)}
                    className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                      usePtt === option.value
                        ? "border-brand bg-brand-soft"
                        : "border-line hover:border-brand/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="turn-taking"
                      // shrink-0 or the radio itself gets squeezed to nothing
                      // once the label beside it runs long.
                      className="mt-0.5 shrink-0 accent-brand"
                      checked={usePtt === option.value}
                      onChange={() => {
                        setUsePtt(option.value);
                        usePttRef.current = option.value;
                      }}
                    />
                    {/* min-w-0 is the fix for the overflow: a flex child's
                        default min-width is auto, which refuses to shrink
                        below the longest unbroken run of text, so the hint
                        pushed straight out of the card instead of wrapping. */}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">
                        {option.title}
                      </span>
                      <span className="block text-xs leading-snug text-muted">
                        {option.hint}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="mt-6 w-full rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-brand-strong"
          >
            Begin interview →
          </button>
          <button
            type="button"
            onClick={() => router.push(backHref)}
            className="mt-3 w-full text-center text-sm text-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const connLabel: Record<ConnState, string> = {
    connecting: "Connecting…",
    connected: "Connected",
    failed: "Connection lost",
  };
  const aiLabel: Record<AiState, string> = {
    waiting: "Waiting",
    listening: "Listening",
    thinking: "Thinking…",
    speaking: "Speaking",
  };

  return (
    <div ref={roomRef} className="flex h-screen flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden text-xs font-medium uppercase tracking-wide text-muted sm:inline">
            {kindLabel}
          </span>
          <span className="truncate rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-brand">
            {interviewerName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Layout controls. A native <select> on purpose: it is one tap on a
              phone, it is keyboard-navigable for free, and this list will keep
              growing. */}
          <label className="flex items-center gap-1.5">
            <span className="sr-only">Adjust view</span>
            <select
              value={viewMode}
              onChange={(e) => changeViewMode(e.target.value as ViewMode)}
              className="rounded-full border border-line bg-card px-2.5 py-1 text-xs font-medium text-ink outline-none transition hover:border-brand/40 focus:border-brand"
              title="Adjust view"
            >
              {VIEW_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          {showTranscript && (
            <button
              type="button"
              onClick={() => setTranscriptOpen((v) => !v)}
              className={`hidden rounded-full border px-2.5 py-1 text-xs font-medium transition lg:inline-flex ${
                transcriptOpen
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line bg-card text-muted hover:border-brand/40"
              }`}
              title={
                transcriptOpen
                  ? "Hide the transcript and widen the video"
                  : "Show the transcript"
              }
            >
              Transcript
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-full border border-line bg-card px-2.5 py-1 text-xs font-medium text-ink transition hover:border-brand/40"
            title={isFullscreen ? "Exit fullscreen" : "Fill the whole screen"}
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
          <span className="hidden font-mono text-xs tabular-nums text-muted sm:inline">
            {fmt(elapsed)}
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              connState === "connected"
                ? "border-success text-success"
                : connState === "failed"
                  ? "border-danger text-danger"
                  : "border-warning text-warning"
            }`}
          >
            {connLabel[connState]}
          </span>
        </div>
      </header>

      <main className="relative flex flex-1 overflow-hidden">
        {/* Mr Muthu's face just changed. Floated over the room rather than
            placed in the layout: it appears and disappears mid-session, and
            anything that reflows the video panes every time he calms down or
            flares up would be more distracting than the news is useful.
            `pointer-events-none` so it can never swallow a click on the
            controls underneath it. */}
        {/* The running score, and the props Mr Cheryl has put on the counter.
            Pinned to the left rather than floated over the middle: unlike the
            mood banner these persist for the rest of the session, so they must
            not sit on top of the video. */}
        {sideRailVisible && (
          <aside className="absolute left-4 top-4 z-20 w-56 space-y-3">
            {/* What the patient is currently doing with his hands. Above the
                score on purpose: it is the thing that changes in response to
                what the trainee just said, so it is what they look for. */}
            {poseFrame && POSE_LABELS[poseFrame] && (
              <div className="flex items-center gap-2 rounded-xl border border-line bg-card p-3 shadow-lg">
                <span className="size-2 shrink-0 rounded-full bg-brand" />
                <span className="text-sm font-medium text-ink">
                  {POSE_LABELS[poseFrame]}
                </span>
              </div>
            )}
            {parsedRunningScore && (
              <div className="rounded-xl border border-line bg-card p-3 shadow-lg">
                <div className="text-xs uppercase tracking-wide text-muted">
                  Running score
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-ink">
                    {parsedRunningScore.value ?? "—"}
                    <span className="text-sm font-medium text-muted">/10</span>
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      OUTCOME_TONE[parsedRunningScore.status] === "success"
                        ? "text-success"
                        : OUTCOME_TONE[parsedRunningScore.status] === "danger"
                          ? "text-danger"
                          : "text-warning"
                    }`}
                  >
                    {OUTCOME_LABEL[parsedRunningScore.status]}
                  </span>
                </div>
              </div>
            )}

            {visibleProps.map(({ key, prop }) => (
              <div
                key={key}
                className="overflow-hidden rounded-xl border border-line bg-card shadow-lg"
              >
                <div className="border-b border-line px-3 py-1.5 text-xs font-medium text-muted">
                  {prop.label}
                </div>
                {prop.receipt ? (
                  <div className="p-3 space-y-2 text-xs text-ink font-mono">
                    <div className="text-center border-b border-dashed border-line pb-2">
                      <div className="font-bold text-sm">STORE RECEIPT</div>
                      <div className="text-muted">Order #4821</div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Polo T-Shirt (M)</span>
                        <span>$49.99</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Qty</span>
                        <span>1</span>
                      </div>
                    </div>
                    <div className="border-t border-dashed border-line pt-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>$49.99</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax</span>
                        <span>$4.50</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Total</span>
                        <span>$54.49</span>
                      </div>
                    </div>
                    <div className="text-center text-muted pt-1 border-t border-dashed border-line">
                      <div>Paid: VISA •••• 3721</div>
                      <div>14 Jul 2026 • 3:42 PM</div>
                    </div>
                  </div>
                ) : prop.recording ? (
                  <div className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-xs font-semibold text-red-400">REC</span>
                    </div>
                    <div className="text-xs text-muted">
                      Recording in progress
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div
                          key={i}
                          className="w-1 bg-red-400/70 rounded-full animate-pulse"
                          style={{
                            height: `${8 + Math.random() * 12}px`,
                            animationDelay: `${i * 0.1}s`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-[10px] text-muted mt-1">
                      This call may be recorded for quality and training purposes.
                    </div>
                  </div>
                ) : prop.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={prop.image}
                    alt={prop.label}
                    className="h-32 w-full object-cover"
                  />
                ) : (
                  <form
                    className="space-y-2 p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setFormDone(true);
                    }}
                  >
                    {formDone ? (
                      <p className="text-xs text-success">
                        Form logged. Tell Mr Cheryl it has been submitted.
                      </p>
                    ) : (
                      <>
                        <input
                          placeholder="Customer name"
                          className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink"
                        />
                        <input
                          placeholder="Contact number"
                          className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink"
                        />
                        <input
                          placeholder="Issue"
                          className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink"
                        />
                        <button
                          type="submit"
                          className="w-full rounded-md bg-brand px-2 py-1 text-xs font-medium text-white"
                        >
                          Log escalation
                        </button>
                      </>
                    )}
                  </form>
                )}
              </div>
            ))}
          </aside>
        )}

        {sessionEnded && (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-6"
          >
            <div className="rounded-full border border-brand bg-card px-4 py-2 text-sm font-medium text-brand shadow-lg">
              {MUTHU_NAME} has ended the meeting — bringing up your assessment…
            </div>
          </div>
        )}

        {/* Suppressed once the meeting is over: the notice above replaces it,
            and a "he's calming down" banner is noise next to "he has left". */}
        {moodShift && !sessionEnded && (
          <div
            key={moodShift.id}
            role="status"
            className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-6"
          >
            <div
              className={`rounded-full border px-4 py-2 text-sm font-medium shadow-lg ${
                moodShift.tone === "calm"
                  ? "border-success bg-card text-success"
                  : "border-warning bg-card text-warning"
              }`}
            >
              {moodShift.text}
            </div>
          </div>
        )}

      {/* The stage. Both panes fill it rather than sitting at a fixed 224×288:
          the point of this screen is the face on the other side, and on a
          laptop the old tiles used about a tenth of the room they had. */}
      <div
        className={`relative flex min-h-0 min-w-0 flex-1 gap-3 overflow-hidden p-3 sm:p-4 ${
          // Stacked on a phone, where two half-width panes are two thumbnails.
          viewMode === "split" ? "flex-col sm:flex-row" : ""
        } ${
          // Clear the `pr` prop rail. It is pinned over the stage and persists
          // for the rest of the session, so unlike the mood banner it must not
          // end up sitting on top of a face. Only from `sm` up — below that the
          // rail is off to one side of a stacked layout anyway.
          sideRailVisible ? "sm:pl-[15.5rem]" : ""
        }`}
      >
        {/* candidate */}
        <div
          className={`${
            viewMode === "split" || viewMode === "you"
              ? PANE_ON
              : viewMode === "focus"
                ? PANE_PIP
                : PANE_OFF
          } border-line bg-black`}
        >
          <video
            ref={userVideoRef}
            autoPlay
            playsInline
            muted
            className={hasUserVid ? "h-full w-full object-cover" : "hidden"}
          />
          {!hasUserVid && (
            <div className="grid h-full w-full place-items-center text-5xl">
              👤
            </div>
          )}
          {/* Overlaid rather than placed under the pane: a caption below the
              video is height the video could have had. */}
          <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            {candidateName} · you
          </span>
        </div>

        {/* interviewer */}
        <div
          className={`${
            viewMode === "you" ? PANE_OFF : PANE_ON
          } bg-card transition-colors ${
            aiSpeaking ? "border-brand" : "border-line"
          }`}
        >
          <video
            ref={aiVideoRef}
            autoPlay
            playsInline
            muted
            className={hasAiVid ? `h-full w-full ${aiVideoFit}` : "hidden"}
          />
          {!hasAiVid && (
            <div className="grid h-full w-full place-items-center">
              <span
                className={`text-6xl ${aiSpeaking ? "text-brand" : "text-faint"}`}
              >
                ◈
              </span>
            </div>
          )}
          <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
            {interviewerName} · AI {aiLabel[aiState]}
          </span>
        </div>
      </div>

      {showTranscript && transcriptOpen && (
        <aside className="hidden w-96 shrink-0 flex-col border-l border-line bg-card lg:flex">
          <div className="shrink-0 border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Transcript</h2>
            <p className="mt-0.5 text-xs text-muted">
              What you said, as it was heard. Read your own words back — that
              is where most of the fixes are.
            </p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {turns.length === 0 ? (
              <p className="text-xs text-faint">
                Your first answer will appear here a few seconds after you
                speak.
              </p>
            ) : (
              turns.map((t) => (
                <div key={t.turnNumber} className="space-y-2">
                  {t.transcript && (
                    <div className="ml-6 rounded-lg rounded-br-sm bg-brand-soft px-3 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-brand">
                        You
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-ink">
                        {t.transcript}
                      </p>
                    </div>
                  )}
                  {t.speak && (
                    <div className="mr-6 rounded-lg rounded-bl-sm border border-line px-3 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-wide text-muted">
                        {interviewerName}
                      </div>
                      <RichText text={t.speak} />
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        </aside>
      )}
      </main>

      <footer className="flex shrink-0 flex-wrap items-center justify-center gap-4 border-t border-line px-4 py-4">
        {/* Mute and hold-to-talk are mutually exclusive on purpose. With PTT on
            the mic is gated server-side, so a local mute would silently
            swallow a held turn and look exactly like the agent ignoring the
            student — the worst possible failure for the people this mode is
            for. The hold button replaces it rather than sitting beside it. */}
        {usePtt ? (
          <button
            type="button"
            // Pointer events, not click: this has to react to the press and
            // the release as separate moments. pointercancel is what fires
            // when the OS takes the gesture away (a scroll, an incoming call).
            //
            // setPointerCapture is what makes a press survive the cursor or
            // finger sliding off the button: every later event for that
            // pointer is delivered here regardless of where it physically is,
            // so the release is never lost to whatever is underneath. It also
            // fixes a self-inflicted misfire — this button shrinks to 0.98
            // while open, and a press near its edge moved the edge out from
            // under a stationary cursor, firing pointerleave and cutting the
            // turn the instant it started. That is the one that made repeated
            // clicking look broken.
            //
            // lostpointercapture is the release of last resort: it fires
            // whenever capture ends for any reason (including cancel), and
            // pttUp is idempotent through the `held` latch, so an extra one
            // costs nothing.
            onPointerDown={(e) => {
              e.preventDefault();
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                // Not supported / pointer already gone — the plain
                // up/cancel handlers still cover the ordinary case.
              }
              pttDown();
            }}
            onPointerUp={pttUp}
            onPointerCancel={pttUp}
            onLostPointerCapture={pttUp}
            className={`flex select-none items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition ${
              pttState === "open"
                ? "scale-[0.98] border-brand bg-brand text-primary-foreground"
                : pttState === "committing"
                  ? "border-brand/40 bg-brand-soft text-brand"
                  : "border-line bg-card text-ink hover:border-brand/40"
            }`}
          >
            <span aria-hidden>
              {pttState === "committing" ? "⏳" : "🎤"}
            </span>
            {pttState === "open"
              ? "Listening…"
              : pttState === "committing"
                ? "Got it…"
                : "Hold to talk (space)"}
          </button>
        ) : (
          <button
            type="button"
            onClick={toggleMic}
            className={`grid h-11 w-11 place-items-center rounded-full border transition ${
              micMuted
                ? "border-danger bg-danger text-white"
                : "border-line bg-card text-ink hover:border-brand/40"
            }`}
            title={micMuted ? "Unmute" : "Mute"}
          >
            {micMuted ? "🔇" : "🎤"}
          </button>
        )}
        <button
          type="button"
          onClick={leave}
          disabled={saving}
          className="rounded-full border border-danger/40 bg-danger/10 px-5 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {/* Only covers sealing the file, which is a second or two — the
              upload itself now runs after the student has already left. */}
          {saving ? "Wrapping up…" : "Leave"}
        </button>
      </footer>

      <audio ref={aiAudioRef} autoPlay />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}
