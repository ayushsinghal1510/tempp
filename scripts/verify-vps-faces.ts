// Asserts the `vps` face/frame contract — the pairing between the strings the
// model is told to return as `frame` and the `label` fields on the avatar clips.
//
// This is the one thing about the track that fails SILENTLY and at a distance.
// TypeScript already proves each label is a valid VpsFrame, which is why the
// obvious mistake (a typo'd label) is caught at build time. It cannot prove the
// other three, and each of them is a live session that looks fine until it
// doesn't:
//
//   1. A frame with NO clip. The model returns "left-hand", the renderer finds
//      nothing under that label, and the avatar simply does not move — during a
//      demo, indistinguishable from the model having ignored the instruction.
//   2. The resting pose not labelled "main". lipsync_client_.py resolves idle as
//      `'main' if 'main' in expressions else config['face-label'] else the FIRST
//      expression loaded`, so a set without "main" falls back to whichever clip
//      loaded first — and the patient sits there between turns with a hand in
//      the air.
//   3. A duplicated label or uuid, where one clip shadows another and one pose
//      becomes unreachable.
//
// Run: npx tsx scripts/verify-vps-faces.ts
//
// Deliberately reads vpsPrompt.ts rather than re-listing the frames here: a copy
// of the expected set in the test is a copy that can drift with the thing it is
// checking, and would then agree with itself while disagreeing with the prompt
// the model is actually given.

import {
  VPS_FACES,
  VPS_FACE_MANIFEST,
  VPS_TRANSITIONS,
} from "../src/lib/voice/vpsCustoms";
import { VPS_FRAMES, VPS_OPENING_FRAME } from "../src/lib/voice/vpsPrompt";

let failed = 0;

function check(label: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`✓  ${label}`);
  } else {
    failed += 1;
    console.log(`✗ FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const labels = VPS_FACES.map((f) => f.label);
const uuids = VPS_FACES.map((f) => f.uuid);

for (const frame of VPS_FRAMES) {
  check(
    `frame "${frame}" has a clip`,
    labels.includes(frame),
    "the model can return it but nothing would render",
  );
}

check(
  'the idle clip is labelled "main"',
  labels.includes("main"),
  "lipsync falls back to the first clip loaded, so the avatar would rest mid-pose",
);

check(
  `the opening frame ("${VPS_OPENING_FRAME}") has a clip`,
  labels.includes(VPS_OPENING_FRAME),
);

check(
  "no duplicate labels",
  new Set(labels).size === labels.length,
  `got ${labels.join(", ")}`,
);

check(
  "no duplicate uuids",
  new Set(uuids).size === uuids.length,
  "two labels pointing at one clip means a pose is unreachable",
);

check(
  "every clip is reachable from a frame",
  labels.every((l) => (VPS_FRAMES as readonly string[]).includes(l)),
  "a clip the prompt never names is dead weight",
);

check(
  "every uuid looks like a uuid",
  uuids.every((u) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(u),
  ),
);

// ── Transitions ──────────────────────────────────────────────────────────────
//
// Every one of these fails the same way at runtime: the bridge silently does not
// play and the engine hard-cuts, which is exactly what it does when no
// transition is defined. There is no error and no visual tell beyond "that
// looked abrupt", so none of it is caught by watching a session.

const transitionUuids = VPS_TRANSITIONS.map((t) => t.uuid);
const pairs = VPS_TRANSITIONS.map((t) => `${t.from}->${t.to}`);

check(
  "transitions are nested inside the faces manifest",
  Array.isArray(VPS_FACE_MANIFEST.transitions) &&
    VPS_FACE_MANIFEST.transitions.length === VPS_TRANSITIONS.length,
  "a sibling `transitions` customs key is read by nothing",
);

check(
  "the manifest is an object, not a bare list",
  !Array.isArray(VPS_FACE_MANIFEST) &&
    Array.isArray(VPS_FACE_MANIFEST.expressions),
  "a list is wrapped as expressions-only and drops every transition",
);

for (const t of VPS_TRANSITIONS) {
  check(
    `transition ${t.from}->${t.to}: both labels exist as expressions`,
    labels.includes(t.from) && labels.includes(t.to),
    "resolves to nothing and hard-cuts",
  );
}

check(
  "no transition is a self-loop",
  VPS_TRANSITIONS.every((t) => t.from !== t.to),
  "the engine only bridges on a label CHANGE",
);

check(
  "no duplicate (from,to) pairs",
  new Set(pairs).size === pairs.length,
  `resolved into a map, so a repeat silently wins — got ${pairs.join(", ")}`,
);

check(
  "no transition uuid collides with an expression uuid",
  transitionUuids.every((u) => !uuids.includes(u)),
  "a pose clip used as its own bridge",
);

check(
  "every transition uuid looks like a uuid",
  transitionUuids.every((u) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(u),
  ),
);

// Reported, never failed. One-directional is the documented contract and the
// reverse clips do not exist yet — this exists so the asymmetry stays visible
// rather than being rediscovered by someone wondering why lowering a hand snaps.
const unbridged: string[] = [];
for (const from of VPS_FRAMES) {
  for (const to of VPS_FRAMES) {
    if (from === to) continue;
    if (!pairs.includes(`${from}->${to}`)) unbridged.push(`${from}->${to}`);
  }
}

console.log(
  failed === 0
    ? `\nOK — ${VPS_FACES.length} clips, ${VPS_FRAMES.length} frames, ` +
        `${VPS_TRANSITIONS.length} bridged (${pairs.join(", ")}).` +
        (unbridged.length
          ? `\n   hard-cuts (no bridge clip, by design): ${unbridged.join(", ")}`
          : "")
    : `\n${failed} ASSERTION(S) FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
