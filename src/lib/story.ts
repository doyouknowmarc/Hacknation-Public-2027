// The scripted demo. Spoken lines are pre-rendered to /public/story/<id>.mp3
// by `npm run story:audio`; without a clip the player estimates its timing.
// Lines use Eleven v4 voice acting: [audio tags] direct the delivery, "..."
// adds a pause and CAPS add emphasis. Tags are never shown in subtitles.
export type Speaker = "narrator" | "sensei" | "expert" | "intern";
export const SPEAKERS: Record<
  Speaker,
  // rate: browser playback speed (v4 has no speed setting); pitch is preserved
  { name: string; role: string; voiceId: string; stability: number; rate?: number }
> = {
  // Alice: clear, brisk British educator
  narrator: { name: "Narrator", role: "", voiceId: "Xb7hH8MSUJpSbSDYk0k2", stability: 0.6 },
  // Orion: warm, authoritative British male (library voice), played a touch faster
  sensei: { name: "Sensei", role: "AI mentor", voiceId: "VuLPiW02W0Qm8465ksBZ", stability: 0.5, rate: 1.12 },
  // Carol: older American woman, natural and unhurried (library voice)
  expert: { name: "Sabine", role: "expert · 30 years", voiceId: "5u41aNhyCU6hXOcjPPv0", stability: 0.4 },
  // Jessica: young, bright American woman
  intern: { name: "Lena", role: "new hire", voiceId: "cgSgspJ2msm6clMCkdW9", stability: 0.3 },
};
// Subtitle text: the line without its audio tags.
export const spoken = (text: string) =>
  text.replace(/\[[^\]]*\]\s*/g, "").replace(/\s+/g, " ").trim();
export const STORY_MODEL = "eleven_v4_turbo";

export type Scene = "expert" | "debrief" | "map" | "intern";
export type Chapter = "capture" | "debrief" | "map" | "teach" | "end";
export type Line = { id: string; speaker: Speaker; text: string };
export type Rule = { rule: string; quote: string; owner: string; release: string };
export type Target =
  | `invoice-${string}`
  | "approve"
  | "request"
  | "approver"
  | "note"
  | "confirm"
  | "back";
export type Action =
  | { type: "select"; id: string }
  | { type: "modal"; modal: "approve" | "approval" | null }
  | { type: "approver"; value: string }
  | { type: "note"; value: string }
  | { type: "complete"; status: string }
  | { type: "review"; state: "pending" | "stop" | "ok" };
export type Step =
  | {
      kind: "card";
      chapter?: Chapter;
      title: string;
      body?: string;
      line?: Line;
      ms?: number;
      hold?: number;
      // A coloured slide that wipes across and changes the scene underneath.
      switchTo?: { speaker: Speaker; scene: Scene; label: string };
    }
  | { kind: "scene"; scene: Scene; rules?: Rule[] }
  | ({ kind: "say" } & Line)
  | { kind: "click"; target: Target; then?: Action }
  | { kind: "type"; target: "note"; text: string }
  | { kind: "act"; action: Action }
  | { kind: "see"; text: string; tacit?: boolean }
  | { kind: "wait"; ms: number };

const say = (id: string, speaker: Speaker, text: string): Step => ({
  kind: "say",
  id,
  speaker,
  text,
});
const rule: Rule = {
  rule: "Claude spend above €100 per project per month needs the project lead’s approval. Urgency is not approval.",
  quote: "The monthly total per project. Earlier invoices count.",
  owner: "Project lead",
  release: "Business reason documented and project lead approves",
};
const end: Step = {
  kind: "card",
  chapter: "end",
  title: "Sensei, teach the next generation.",
  line: {
    id: "x-slogan",
    speaker: "narrator",
    text: "[clear, confident] Sensei. [warm] Teach the next generation.",
  },
  hold: 800,
};
// Lena's half is the same in both cuts apart from what is said.
const teach = (stop: Line, reply: Line, praise?: Line): Step[] => [
  { kind: "scene", scene: "intern" },
  { kind: "click", target: "invoice-2051", then: { type: "select", id: "2051" } },
  { kind: "click", target: "approve", then: { type: "modal", modal: "approve" } },
  { kind: "act", action: { type: "review", state: "pending" } },
  { kind: "wait", ms: 500 },
  { kind: "act", action: { type: "review", state: "stop" } },
  { kind: "say", ...stop },
  { kind: "say", ...reply },
  { kind: "click", target: "back", then: { type: "modal", modal: null } },
  { kind: "click", target: "request", then: { type: "modal", modal: "approval" } },
  { kind: "click", target: "approver", then: { type: "approver", value: "Project lead" } },
  { kind: "act", action: { type: "note", value: "Orion at €130 this month · data migration" } },
  { kind: "act", action: { type: "review", state: "pending" } },
  { kind: "wait", ms: 400 },
  { kind: "act", action: { type: "review", state: "ok" } },
  { kind: "click", target: "confirm", then: { type: "complete", status: "Awaiting approval" } },
  ...(praise ? [{ kind: "say", ...praise } as Step] : []),
];

export const cuts = {
  two: {
    label: "2 min",
    steps: [
      {
        kind: "card",
        chapter: "capture",
        title: "Her best rules were never written down.",
        line: {
          id: "s-intro",
          speaker: "narrator",
          text: "Sabine has cleared invoices for twelve years. Her best rules were never written down. Sensei watches her work.",
        },
      },
      { kind: "scene", scene: "expert" },
      { kind: "click", target: "invoice-2042", then: { type: "select", id: "2042" } },
      { kind: "see", text: "INV 2042 · €180 Claude · Project Atlas · allowance €100 per month" },
      say(
        "s-sab1",
        "expert",
        "A hundred and eighty euros of Claude for Project Atlas. The allowance is a hundred, so this goes to the project lead.",
      ),
      { kind: "click", target: "request", then: { type: "modal", modal: "approval" } },
      { kind: "click", target: "approver", then: { type: "approver", value: "Project lead" } },
      { kind: "type", target: "note", text: "€80 over allowance · urgent release" },
      { kind: "click", target: "confirm", then: { type: "complete", status: "Awaiting approval" } },
      { kind: "see", text: "Approval requested · payment pending", tacit: true },
      say("s-q1", "sensei", "What must be documented before this can be released?"),
      say(
        "s-a1",
        "expert",
        "Why the extra usage was needed, and the project lead's approval. Urgent isn't enough.",
      ),
      {
        kind: "card",
        chapter: "debrief",
        title: "The debrief",
        line: {
          id: "s-debrief",
          speaker: "narrator",
          text: "Afterwards, Sensei asks what the screen couldn't show.",
        },
      },
      { kind: "scene", scene: "debrief" },
      say(
        "s-q2",
        "sensei",
        "Does the hundred euro limit apply per invoice, or to the project's total for the month?",
      ),
      say("s-a2", "expert", "The monthly total per project. Earlier invoices count."),
      say(
        "s-teachback",
        "sensei",
        "So: Claude spend above a hundred euros per project per month needs the project lead's approval. Did I capture that correctly?",
      ),
      say("s-confirm", "expert", "Exactly."),
      { kind: "scene", scene: "map", rules: [rule] },
      say(
        "s-map",
        "narrator",
        "That rule is now part of Sabine's work map, linked to her own words.",
      ),
      {
        kind: "card",
        chapter: "teach",
        title: "A case Sabine never saw",
        line: {
          id: "s-monday",
          speaker: "narrator",
          text: "Monday. Lena, a new hire, gets an invoice Sabine never saw.",
        },
      },
      ...teach(
        {
          id: "s-stop",
          speaker: "sensei",
          text: "Pause. Sabine explained that the limit applies to monthly project spend. With the forty euros from earlier, Orion is at a hundred and thirty. What needs to happen before release?",
        },
        { id: "s-lena", speaker: "intern", text: "Then I need the project lead's approval." },
        { id: "s-praise", speaker: "sensei", text: "Exactly how Sabine would handle it." },
      ),
      end,
    ] as Step[],
  },
  one: {
    label: "1 min",
    steps: [
      { kind: "scene", scene: "expert" },
      say(
        "o-intro",
        "narrator",
        "[clear, engaging] Sabine has thirty years of judgment, and NONE of it is written down. Sensei watches her work.",
      ),
      { kind: "click", target: "invoice-2042", then: { type: "select", id: "2042" } },
      { kind: "click", target: "request", then: { type: "modal", modal: "approval" } },
      { kind: "act", action: { type: "approver", value: "Project lead" } },
      { kind: "act", action: { type: "note", value: "€80 over allowance · urgent release" } },
      { kind: "wait", ms: 300 },
      { kind: "click", target: "confirm", then: { type: "complete", status: "Awaiting approval" } },
      { kind: "see", text: "Approval requested · payment pending", tacit: true },
      say(
        "o-q",
        "sensei",
        "[calm, authoritative] Sabine... is that limit per invoice, [deliberate] or per project, per month?",
      ),
      say(
        "o-a",
        "expert",
        "[unhurried, knowing] Per project, per month. [matter-of-fact] Earlier invoices count.",
      ),
      { kind: "scene", scene: "map", rules: [{ ...rule, quote: "Per project, per month. Earlier invoices count." }] },
      say("o-map", "narrator", "[clear] Her answer becomes a rule."),
      {
        kind: "card",
        chapter: "teach",
        title: "Lena",
        body: "the apprentice · day one",
        switchTo: { speaker: "intern", scene: "intern", label: "Switching to" },
        line: {
          id: "o-lena-intro",
          speaker: "narrator",
          text: "[bright, clear] Now meet Lena, the apprentice. It's her first day.",
        },
      },
      { kind: "click", target: "invoice-2051", then: { type: "select", id: "2051" } },
      say(
        "o-lena1",
        "intern",
        "[curious, upbeat] Ninety euros... that's under the hundred, right? [cheerful] I'll approve it!",
      ),
      ...teach(
        {
          id: "o-stop",
          speaker: "sensei",
          text: "[firm but kind] Pause, Lena. [measured] With the forty from earlier, this project reaches a hundred and THIRTY euros. [gently] What would Sabine do?",
        },
        {
          id: "o-lena2",
          speaker: "intern",
          text: "[surprised, then eager] Oh! The earlier spend counts... [happy] So the project lead approves first. Got it!",
        },
      ).slice(2),
      end,
    ] as Step[],
  },
};
export type Cut = keyof typeof cuts;
// Every clip used by any cut, for preloading and rendering.
export function storyLines(): Line[] {
  const lines = new Map<string, Line>();
  for (const cut of Object.values(cuts))
    for (const s of cut.steps) {
      if (s.kind === "say") lines.set(s.id, { id: s.id, speaker: s.speaker, text: s.text });
      if (s.kind === "card" && s.line) lines.set(s.line.id, s.line);
    }
  return [...lines.values()];
}
export const storyInvoices = {
  expert: [
    { id: "2041", supplier: "Bürobedarf Schäfer GmbH", what: "Office supplies · quarterly replenishment", net: 700, docs: ["PO-26-0412 · quarterly supplies schedule · €700 · approved"] },
    { id: "2042", supplier: "Anthropic", what: "Claude usage · Project Atlas", net: 180, remark: "Extra usage: urgent development before the Helios customer release.", docs: ["Project Atlas · Claude allowance €100 per month", "No earlier Claude invoices in December"] },
    { id: "2043", supplier: "Westpark Immobilien GmbH", what: "Office rent · December", net: 3000, docs: ["Lease WP-2019-07 · monthly rent €2,400"] },
  ],
  intern: [
    { id: "2051", supplier: "Anthropic", what: "Claude usage · Project Orion (top-up)", net: 90, remark: "Additional usage for Orion data migration.", docs: ["Project Orion · Claude allowance €100 per month", "1 Dec · Claude usage · €40 · Approved for payment"] },
  ],
} as const;
