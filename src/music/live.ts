import { removeFeel } from "@/audio/feel";
import { fitOctave, holdable, nearestIn } from "./harmony";
import { INSTRUMENTS } from "./instruments";
import { harmonyOf, isFeaturedRole } from "./realize";
import { mod } from "./theory";
import type { NoteEvent, Role, Score } from "./types";

// Playing along: what a MIDI keyboard (or the on-screen keys, or the computer keyboard) says,
// where on the band's grid a note was meant to land, and the call-and-response game where the
// band leaves you a few bars and the soloist answers with what you played. Pure: the engine
// and the UI do the sounding and the drawing.

// ─── MIDI messages ───────────────────────────────────────────────────────────

export type MidiMessage =
  | { type: "on"; pitch: number; vel: number; channel: number }
  | { type: "off"; pitch: number; channel: number }
  | { type: "sustain"; down: boolean; channel: number }
  | { type: "alloff"; channel: number };

/**
 * One MIDI message off the wire. Note-on with velocity 0 is a note-off (most keyboards send it
 * that way); the sustain pedal (CC64) and all-notes-off (CC120/123) are kept; clock, active
 * sensing, aftertouch and the rest are dropped.
 */
export function parseMidi(data: ArrayLike<number> | null | undefined): MidiMessage | null {
  if (!data || data.length < 1) return null;
  const status = data[0];
  if (status < 0x80 || status >= 0xf0) return null;
  const kind = status & 0xf0;
  const channel = status & 0x0f;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;
  if (kind === 0x90 && data.length >= 3) return d2 > 0 ? { type: "on", pitch: d1, vel: d2 / 127, channel } : { type: "off", pitch: d1, channel };
  if (kind === 0x80 && data.length >= 2) return { type: "off", pitch: d1, channel };
  if (kind === 0xb0 && data.length >= 3) {
    if (d1 === 64) return { type: "sustain", down: d2 >= 64, channel };
    if (d1 === 120 || d1 === 123) return { type: "alloff", channel };
  }
  return null;
}

// ─── Computer keyboard ───────────────────────────────────────────────────────

/**
 * The home row plays the white keys and the row above it the black ones, as on most music
 * apps' "typing keyboard": A is C, W is C#, S is D … K is the next C. Z and X shift octaves.
 */
export const TYPING_KEYS: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
  Quote: 17,
};

/** The pitch a key plays with the typing keyboard's C at `base`, or null for other keys. */
export function typingPitch(code: string, base: number): number | null {
  const semis = TYPING_KEYS[code];
  return semis === undefined ? null : base + semis;
}

/** The letter printed on a typing key, for labelling the on-screen keys. */
export function typingLabel(semis: number): string | null {
  const code = Object.keys(TYPING_KEYS).find((k) => TYPING_KEYS[k] === semis);
  if (!code) return null;
  return code === "Semicolon" ? ";" : code === "Quote" ? "'" : code.replace("Key", "");
}

// ─── Timing ──────────────────────────────────────────────────────────────────

/** How hard a note is pulled onto the band's grid: off, or a light pull toward the nearest 8th. */
export type QuantizeMode = "off" | "light";

export interface Quantize {
  /** Grid step in (straight) beats: 0.5 = 8th notes. */
  grid: number;
  /** 0 leaves the note where it was played, 1 puts it on the grid. */
  strength: number;
}

export const QUANTIZE: Record<QuantizeMode, Quantize | null> = {
  off: null,
  light: { grid: 0.5, strength: 0.5 },
};

/**
 * Where on the chart a note played at a heard position belongs. `heard` is the beat that was
 * coming out of the speakers when the key went down (latency already taken off), on the felt
 * (swung) timeline; the result is on the chart's straight grid, pulled toward the nearest grid
 * step when quantizing.
 */
export function placeNote(heard: number, swing: number, q: Quantize | null): number {
  const straight = removeFeel(heard, swing);
  if (!q || !(q.grid > 0)) return straight;
  const target = Math.round(straight / q.grid) * q.grid;
  return straight + (target - straight) * Math.max(0, Math.min(1, q.strength));
}

/** Notes held down, turned into finished notes when they're let go (beats in, NoteEvents out). */
export class PhraseCapture {
  private held = new Map<number, { start: number; vel: number }>();
  readonly notes: NoteEvent[] = [];

  on(pitch: number, vel: number, beat: number) {
    if (this.held.has(pitch)) this.off(pitch, beat);
    this.held.set(pitch, { start: beat, vel });
  }

  off(pitch: number, beat: number): NoteEvent | null {
    const h = this.held.get(pitch);
    if (!h) return null;
    this.held.delete(pitch);
    const note: NoteEvent = { pitch, start: h.start, dur: Math.max(0.1, beat - h.start), vel: h.vel };
    this.notes.push(note);
    return note;
  }

  /** Let go of everything still held at `beat` (the end of a call, or the transport stopping). */
  release(beat: number): NoteEvent[] {
    return [...this.held.keys()].map((p) => this.off(p, beat)).filter((n): n is NoteEvent => !!n);
  }

  heldPitches(): number[] {
    return [...this.held.keys()];
  }

  clear() {
    this.held.clear();
    this.notes.length = 0;
  }
}

// ─── Call and response ───────────────────────────────────────────────────────

export interface Block {
  kind: "call" | "answer";
  /** First bar of the block. */
  start: number;
  bars: number;
  /** Which call this is (a call and its answer share it). */
  round: number;
}

/**
 * The chart cut into turns: `every` bars for you (the call), then `every` bars for the band's
 * answer, and again, from the first chorus (after any intro) to the end. The last turn may be short.
 */
export function callBlocks(score: Score, every: number): Block[] {
  const n = Math.max(1, Math.floor(every));
  const total = score.frame.bars;
  const out: Block[] = [];
  let bar = Math.max(0, Math.min(total, score.frame.intro ?? 0));
  let k = 0;
  while (bar < total) {
    const kind = k % 2 === 0 ? "call" : "answer";
    const bars = Math.min(n, total - bar);
    out.push({ kind, start: bar, bars, round: Math.floor(k / 2) });
    bar += bars;
    k++;
  }
  return out;
}

export function blockAt(blocks: Block[], bar: number): Block | null {
  return blocks.find((b) => bar >= b.start && bar < b.start + b.bars) ?? null;
}

/** Roles that carry a tune or a solo: the ones that step back to leave you room. */
const OUT_FRONT: Role[] = ["lead", "solo", "counter", "fill", "trade"];

/** Does this player step back in a bar where it's your turn (the rhythm section keeps going)? */
function stepsBack(score: Score, memberId: string, bar: number): boolean {
  const m = score.members.find((x) => x.id === memberId);
  if (!m || m.instrument === "drums" || INSTRUMENTS[m.instrument]?.fn === "bass") return false;
  const role = score.plan[bar]?.roles[memberId];
  return !!role && OUT_FRONT.includes(role);
}

/**
 * Who answers you in a turn: whoever is out front at its start (not the drummer), else the
 * leader, else anyone who can carry a line.
 */
export function echoerFor(score: Score, bar: number): string | null {
  const ms = score.members.filter((m) => m.instrument !== "drums" && INSTRUMENTS[m.instrument]?.fn !== "bass");
  const roles = score.plan[bar]?.roles ?? {};
  const featured = ms.find((m) => isFeaturedRole(roles[m.id]));
  if (featured) return featured.id;
  if (ms.some((m) => m.id === score.frame.leaderId)) return score.frame.leaderId;
  return (ms.find((m) => INSTRUMENTS[m.instrument].fn === "melodic") ?? ms[0])?.id ?? null;
}

/**
 * The soloist's answer: your phrase moved to their turn, following the changes (a phrase over
 * C7 answered over F7 moves up a fourth), with every note fitted to the chord it now lands on,
 * folded into their register, and thinned to a single line for an instrument that can't play
 * chords.
 */
export function echoPhrase(score: Score, call: NoteEvent[], from: Block, to: Block, echoerId: string): NoteEvent[] {
  const echoer = score.members.find((m) => m.id === echoerId);
  if (!echoer || !call.length) return [];
  const inst = INSTRUMENTS[echoer.instrument];
  const beats = score.frame.meter.beats;
  const shift = (to.start - from.start) * beats;
  const end = (to.start + to.bars) * beats;
  const harmony = harmonyOf(score.frame, score.plan);
  let notes = call
    .filter((n) => n.start >= from.start * beats - 1e-6 && n.start < (from.start + from.bars) * beats)
    .sort((a, b) => a.start - b.start || b.pitch - a.pitch);
  if (!inst.poly) {
    // the top of each chord is the tune
    notes = notes.filter((n, i) => i === 0 || Math.abs(n.start - notes[i - 1].start) > 0.08);
  }
  const moved = notes
    .map((n) => {
      const start = n.start + shift;
      if (start >= end - 1e-6) return null;
      const was = harmony.at(n.start);
      const now = harmony.at(start);
      const by = mod(now.chord.root - was.chord.root + 6, 12) - 6;
      let pitch = n.pitch + by;
      if (!now.scale.includes(mod(pitch, 12))) pitch = nearestIn(pitch, now.scale);
      // a long note or one on the beat has to sit on the chord, not rub against it
      const strong = Math.abs(start - Math.round(start)) < 0.05 || n.dur >= 1;
      if (strong && !holdable(now, mod(pitch, 12), score.frame.style)) pitch = nearestIn(pitch, now.stable);
      const dur = Math.min(n.dur, end - start);
      const next: NoteEvent = { pitch, start, dur: Math.max(0.1, dur), vel: Math.max(0.45, Math.min(0.95, n.vel)) };
      if (inst.bowed) next.art = "legato";
      return next;
    })
    .filter((n): n is NoteEvent => !!n);
  // a single line can't overlap itself
  if (!inst.poly) for (let i = 0; i + 1 < moved.length; i++) moved[i].dur = Math.max(0.1, Math.min(moved[i].dur, moved[i + 1].start - moved[i].start));
  const [lo, hi] = inst.solo ?? inst.sweet;
  return fitOctave(moved, lo, hi);
}

/**
 * The chart with room left for you: in each of your turns the players out front step back
 * (the rhythm section keeps playing), and in each answer the one who answers plays your
 * phrase back, if you played one (otherwise they play what they had). Everyone else out front
 * stays quiet through the answer so it's heard.
 */
export function leaveSpace(score: Score, every: number, calls: Record<number, NoteEvent[]> = {}): Score {
  const beats = score.frame.meter.beats;
  const blocks = callBlocks(score, every);
  const parts: Record<string, NoteEvent[]> = {};
  const echoes: Record<string, NoteEvent[]> = {};
  const answerOf = new Map<number, string | null>();
  for (const b of blocks) {
    if (b.kind !== "answer") continue;
    const who = echoerFor(score, b.start);
    answerOf.set(b.start, who);
    const call = blocks.find((c) => c.kind === "call" && c.round === b.round);
    const phrase = calls[b.round];
    if (!who || !call || !phrase?.length) continue;
    (echoes[who] ??= []).push(...echoPhrase(score, phrase, call, b, who));
  }
  const echoed = (memberId: string, b: Block) => answerOf.get(b.start) === memberId && (calls[b.round]?.length ?? 0) > 0;
  for (const m of score.members) {
    parts[m.id] = (score.parts[m.id] ?? []).filter((n) => {
      const bar = Math.floor(n.start / beats + 1e-9);
      const b = blockAt(blocks, bar);
      if (!b) return true;
      if (b.kind === "call") return !stepsBack(score, m.id, bar);
      // the answer: the echo replaces the answerer's own notes; the rest out front wait
      if (answerOf.get(b.start) === m.id) return !echoed(m.id, b);
      return !stepsBack(score, m.id, bar);
    });
    if (echoes[m.id]) parts[m.id] = [...parts[m.id], ...echoes[m.id]].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  }
  return { ...score, parts };
}
