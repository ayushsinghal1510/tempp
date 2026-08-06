export type Scenario = {
  id: string;
  tab: string;
  title: string;
  /** What this customer's configuration calls a session. */
  word: string;
  agent: string;
  state: string;
  /** One line on the card face. */
  blurb: string;
  /** The two things the configuration fixes, shown as tags. */
  tags: [string, string];
  duration: string;
  /** Placeholder art — swap the file, keep the path. */
  image: string;
};

export const scenarios: Scenario[] = [
  {
    id: "interview",
    tab: "Interview",
    title: "Interview coaching",
    word: "interview",
    agent: "Interviewer",
    state: "Listening",
    blurb: "Practise against a real company, scored on how you build an answer.",
    tags: ["Voice + video", "Rubric scored"],
    duration: "08:42",
    image: "/assets/scenarios/interview.webp",
  },
  {
    id: "patient",
    tab: "Patient",
    title: "Clinical communication",
    word: "encounter",
    agent: "Simulated patient",
    state: "Speaking",
    blurb: "Talk to a patient your teacher wrote, scored on empathy and plain language.",
    tags: ["Authored by staff", "Empathy rubric"],
    duration: "11:05",
    image: "/assets/scenarios/patient.webp",
  },
  {
    id: "roleplay",
    tab: "Roleplay",
    title: "Service recovery",
    word: "roleplay",
    agent: "Unhappy customer",
    state: "Escalating",
    blurb: "Face a hostile counter, with a running score you watch move.",
    tags: ["Escalating", "Live score"],
    duration: "06:18",
    image: "/assets/scenarios/roleplay.webp",
  },
  {
    id: "call",
    tab: "Call",
    title: "Admissions calling",
    word: "call",
    agent: "Agent",
    state: "Dialling",
    blurb: "The agent dials a real number and returns a transcript and the facts.",
    tags: ["Outbound", "Consent logged"],
    duration: "03:11",
    image: "/assets/scenarios/call.webp",
  },
  {
    id: "own",
    tab: "Your own",
    title: "Bring your own",
    word: "session",
    agent: "Your agent",
    state: "Waiting",
    blurb: "Your admin writes the greeting and the prompt. The org has it immediately.",
    tags: ["Admin authored", "Custom rubric"],
    duration: "—",
    image: "/assets/scenarios/own.webp",
  },
];

/** Guarantees, not a sequence — so they carry no numbers. */
export const rules = [
  { title: "Starts at zero", body: "0 means not shown yet. Nothing is deducted from a number you never had." },
  { title: "Asymmetric", body: "+3 gained at most, −1 lost at most, and a drop needs two turns." },
  { title: "Nothing unsaid", body: "A criticism only lands on a turn where it was said out loud." },
  { title: "Two models", body: "The scorer reads the finished speech, so it can't credit itself." },
];

/** The signature graphic: one dimension, turn by turn, with the sentence that moved it. */
export type LedgerTurn = {
  turn: number;
  value: number;
  quote?: string;
  delta?: string;
};

export const ledger: LedgerTurn[] = [
  { turn: 1, value: 0 },
  { turn: 2, value: 0 },
  { turn: 3, value: 2, quote: "Named the read pattern before the index.", delta: "+2" },
  { turn: 4, value: 2 },
  { turn: 5, value: 4, quote: "Gave a number without being asked to.", delta: "+2" },
  { turn: 6, value: 3, quote: "Two turns in a row without an assumption.", delta: "−1" },
  { turn: 7, value: 6, quote: "Chose one option and said why the other loses.", delta: "+3" },
  { turn: 8, value: 7, quote: "Closed on the trade-off it opened with.", delta: "+1" },
];

/**
 * Each observation is pinned to where in the camera frame it was
 * read. Coordinates are percentages of the displayed frame.
 */
export const vision = [
  { pin: 1, tag: "Framing", text: "Face straight on, eyes to lens", x: 44, y: 36 },
  { pin: 2, tag: "Posture", text: "Square to camera, shoulders level", x: 47, y: 61 },
  { pin: 3, tag: "Gesture", text: "Hands visible while explaining", x: 29, y: 85 },
  { pin: 4, tag: "Scene", text: "Fully in frame, evenly lit", x: 12, y: 15 },
];

/** A real sequence — turn order carries the meaning, so these stay numbered. */
export const rhythm = [
  { n: "01", label: "Asks about the trade-off you chose", kind: "Ask" as const },
  { n: "02", label: "Follows the thread you opened", kind: "Ask" as const },
  { n: "03", label: "Presses on the number you gave", kind: "Ask" as const },
  { n: "04", label: "Stops. Two points, from turns 1–4.", kind: "Checkpoint" as const },
  { n: "05", label: "Moves to the next area", kind: "Ask" as const },
  { n: "06", label: "Listens without interrupting", kind: "Ask" as const },
  { n: "07", label: "Asks you to be concrete", kind: "Ask" as const },
  { n: "08", label: "Stops. One point, from turns 5–8.", kind: "Checkpoint" as const },
];

export const navLinks = [
  { href: "#session", label: "The session" },
  { href: "#scoring", label: "Scoring" },
  { href: "#educators", label: "For educators" },
];
