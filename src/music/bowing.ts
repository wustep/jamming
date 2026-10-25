import { hashString } from "./rng";
import type { InstrumentId, NoteEvent, Role, StyleId } from "./types";

// How a violinist plays a line: which notes share one bow (a slur), which way each stroke
// goes, where a phrase breathes, and how it swells. realize() writes it into the violin's part
// (the notes join up, a slurred note is marked, the dynamics follow the phrase); the audio
// engine reads it back (no new attack inside a slur, a swell on a long note, vibrato that comes
// in once a note has spoken) and so does the stage (the bow changes direction once a stroke,
// not once a note). Everything here is pure, so the sound and the picture agree.

/** Lines bowed this way: the violin's. (The cello keeps its own bowing.) */
export const bowsLines = (inst: InstrumentId | undefined) => inst === "violin";

const EPS = 1e-6;

/**
 * A gap this small (beats) after a note is the writer's, not the player's: lines are written a
 * hair short so a sampler lets go, and a violinist plays through it.
 */
export const joinGap = (dur: number) => Math.min(0.22, 0.06 + 0.05 * dur);

/** A rest this long (beats) or longer is a breath: the phrase ends and the bow comes off. */
export const BREATH = 0.5;

/** Strokes are at most this long (seconds of bow), and slur at most this many notes. */
const STROKE_SEC = 2.6;
const STROKE_NOTES = 8;

/** Notes this long (beats) get a bow of their own. */
const LONG = 1.5;

export interface BowOpts {
  beats: number;
  tempo: number;
  style: StyleId;
  /** The player's role at a beat: held tones in a backing part tie over instead of restriking. */
  roleAt?: (beat: number) => Role | undefined;
  /** Take-level seed, for the little differences between one phrase and the next. */
  seed?: number;
}

const touches = (a: NoteEvent, b: NoteEvent) => Math.abs(b.start - (a.start + a.dur)) < 1e-4;
const frac = (x: number) => x - Math.floor(x + EPS);

/** Phrases: runs of notes with no breath between them (index ranges into sorted notes). */
export function phrasesOf(notes: readonly NoteEvent[]): [number, number][] {
  const out: [number, number][] = [];
  let from = 0;
  for (let i = 1; i <= notes.length; i++) {
    const prev = notes[i - 1];
    const n = notes[i];
    if (!n || n.start - (prev.start + prev.dur) >= BREATH - EPS || n.art === "pizz" || prev.art === "pizz") {
      if (i > from) out.push([from, i - 1]);
      from = i;
    }
  }
  return out;
}

/** How short notes are grouped under one bow in a style: in beats, or swing's offbeat pairs. */
function groupOf(style: StyleId): number | "swing" {
  if (style === "swing") return "swing";
  if (style === "funk") return 0.5;
  if (style === "baroque" || style === "minimal" || style === "neworleans") return 1;
  return 2;
}

/** Can note `n` be slurred onto the stroke `prev` is in (which has lasted `beats` and has `count` notes)? */
function slurs(prev: NoteEvent, n: NoteEvent, stroke: { beats: number; count: number }, o: BowOpts): boolean {
  const spb = 60 / Math.max(30, o.tempo);
  if (!touches(prev, n)) return false;
  if (prev.art === "pizz" || n.art === "pizz" || prev.art === "staccato" || n.art === "staccato" || n.art === "accent") return false;
  // the same note again is a new bow (slurred, it would just be held); a big leap gets its own
  if (n.pitch === prev.pitch || Math.abs(n.pitch - prev.pitch) > 9) return false;
  if (n.dur >= LONG - EPS || prev.dur >= LONG - EPS || n.dur * spb > 1.1) return false;
  if (stroke.count >= STROKE_NOTES || (stroke.beats + n.dur) * spb > STROKE_SEC) return false;
  const g = groupOf(o.style);
  if (g === "swing") {
    // jazz bowing: the offbeat eighth starts a bow and slurs into the beat after it
    if (n.dur <= 0.5 + EPS && Math.abs(frac(n.start) - 0.5) < EPS) return false;
    return stroke.count < 2 || frac(n.start) > EPS;
  }
  // baroque sixteenths: four to a bow, or two and two, beat by beat
  let group = g;
  if (g === 1 && n.dur <= 0.25 + EPS && hashString(`${o.seed ?? 0}:${Math.floor(n.start + EPS)}`) % 5 < 2) group = 0.5;
  const onGroup = Math.abs(n.start / group - Math.round(n.start / group)) < EPS;
  // a beat (or half beat) to a bow: the bow changes on it; a longer, singing slur changes on the
  // half bar once it has had a beat
  return group <= 1 ? !onGroup : !(onGroup && stroke.beats >= 1 - EPS);
}

/**
 * A violin part played like a violinist: the writer's gaps closed (a line moves from note to
 * note), held tones in a backing part tied over instead of struck again, notes slurred in
 * groups under one bow (`slur` marks a note bowed with the one before it), and each phrase
 * swelling toward its high point and easing off at the end. Pitches and onsets never move.
 */
export function bowLine(notes: readonly NoteEvent[], o: BowOpts): NoteEvent[] {
  const out = notes
    .filter((n) => n.dur > 0)
    .map((n) => {
      const c = { ...n };
      delete c.slur;
      return c;
    })
    .sort((a, b) => a.start - b.start || b.pitch - a.pitch);

  // 1. a line moves from note to note: close the gaps it was written with
  for (let i = 0; i + 1 < out.length; i++) {
    const n = out[i];
    const gap = out[i + 1].start - (n.start + n.dur);
    if (gap < -EPS) n.dur = Math.max(0.05, out[i + 1].start - n.start);
    else if (gap > EPS && gap <= joinGap(n.dur) + EPS && n.art !== "staccato" && n.art !== "pizz") n.dur = out[i + 1].start - n.start;
  }

  // 2. behind the band, a held tone that the next chord keeps is tied over, not bowed again
  for (let i = 0; i + 1 < out.length; i++) {
    const n = out[i];
    const nx = out[i + 1];
    const backing = (b: number) => {
      const r = o.roleAt?.(b);
      return r === "pad" || r === "counter";
    };
    if (n.written || nx.written || n.pitch !== nx.pitch || !touches(n, nx) || n.art === "pizz" || nx.art === "pizz") continue;
    if (n.dur < 1 - EPS || nx.dur < 1 - EPS || n.dur + nx.dur > 2 * o.beats + EPS || !backing(n.start) || !backing(nx.start)) continue;
    n.dur += nx.dur;
    n.vel = Math.max(n.vel, nx.vel);
    out.splice(i + 1, 1);
    i--;
  }

  // 3. slurs
  let stroke = { beats: 0, count: 0 };
  for (let i = 0; i < out.length; i++) {
    const n = out[i];
    if (i > 0 && slurs(out[i - 1], n, stroke, o)) {
      n.slur = true;
      stroke = { beats: stroke.beats + n.dur, count: stroke.count + 1 };
    } else stroke = { beats: n.dur, count: 1 };
  }

  // 4. dynamics: a phrase swells toward its high point and eases off as it ends
  shapeDynamics(out, o);
  return out;
}

/** 0 → 1 → 0 across a phrase, peaking at `peak` (0..1), smooth at both ends. */
export function phraseArc(x: number, peak: number): number {
  const p = Math.min(0.85, Math.max(0.15, peak));
  const k = Math.min(1, Math.max(0, x));
  return k <= p ? 0.5 - 0.5 * Math.cos((Math.PI * k) / p) : 0.5 + 0.5 * Math.cos((Math.PI * (k - p)) / (1 - p));
}

/**
 * The spans a line's dynamics are shaped over: its phrases, with a long one (a baroque line can
 * run sixteen bars without a breath) cut about every two bars, after a held note or at a barline.
 */
export function swellsOf(notes: readonly NoteEvent[], beats: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of phrasesOf(notes)) {
    let from = a;
    for (let i = a + 1; i <= b; i++) {
      const n = notes[i];
      const prev = notes[i - 1];
      const bar = Math.abs(n.start / beats - Math.round(n.start / beats)) < EPS;
      if (n.start - notes[from].start >= 2 * beats - EPS && (prev.dur >= 1 - EPS || bar) && b - i >= 1) {
        out.push([from, i - 1]);
        from = i;
      }
    }
    out.push([from, b]);
  }
  return out;
}

/** Loud notes ease toward the top instead of clipping at it (realize's softCeiling). */
const ceiling = (v: number) => (v <= 0.8 ? v : 0.8 + 0.2 * Math.tanh((v - 0.8) / 0.2));

function shapeDynamics(notes: NoteEvent[], o: BowOpts) {
  const orig = notes.map((n) => n.vel);
  for (const [a, b] of swellsOf(notes, o.beats)) {
    if (b - a < 1) continue;
    const t0 = notes[a].start;
    const t1 = notes[b].start + notes[b].dur;
    const span = Math.max(EPS, t1 - t0);
    // the high point: the top note (the later one if it comes back), or a long note in a flat line
    let peak = a;
    for (let i = a; i <= b; i++) if (notes[i].pitch > notes[peak].pitch || (notes[i].pitch === notes[peak].pitch && notes[i].dur >= notes[peak].dur)) peak = i;
    const xp = (notes[peak].start + notes[peak].dur * 0.3 - t0) / span;
    const shape = (i: number) => 0.84 + 0.26 * phraseArc((notes[i].start + notes[i].dur * 0.3 - t0) / span, xp);
    // keep the phrase as loud as it was written on the whole (by time), only shaped
    let w = 0;
    let m = 0;
    for (let i = a; i <= b; i++) {
      w += notes[i].dur;
      m += notes[i].dur * shape(i);
    }
    const norm = 0.99 / (m / Math.max(EPS, w));
    for (let i = a; i <= b; i++) {
      const n = notes[i];
      if (n.art === "ghost") continue;
      // the level the line was at here, without the beat-by-beat stamping (on-beats up, off-beats down)
      let s = 0;
      let k = 0;
      for (let j = a; j <= b; j++) {
        if (Math.abs(notes[j].start - n.start) > 1.5 || notes[j].art === "ghost") continue;
        s += orig[j];
        k++;
      }
      const base = k ? s / k : orig[i];
      const wobble = 1 + (((hashString(`${o.seed ?? 0}:${n.start.toFixed(3)}:${n.pitch}`) % 1000) / 1000) * 2 - 1) * 0.015;
      let v = base * shape(i) * norm * wobble * (n.slur ? 0.97 : 1);
      if (n.art === "accent") v = Math.max(v, orig[i]);
      n.vel = Math.max(0.05, Math.min(1, ceiling(v)));
    }
  }
}

/** One bow stroke: the notes it covers and which way it goes (+1 down-bow, −1 up-bow). */
export interface Stroke {
  first: number;
  last: number;
  dir: 1 | -1;
  start: number;
  end: number;
}

/** Is a beat strong enough to start a phrase down-bow (the downbeat, or the middle of a bar of four)? */
function strong(start: number, beats: number) {
  const p = start - Math.floor(start / beats + EPS) * beats;
  return p < EPS || (beats === 4 && Math.abs(p - 2) < EPS);
}

/**
 * The bow strokes of a bowed part (notes sorted by start). A phrase that starts on a strong
 * beat starts down-bow, a pickup up-bow, and the strokes alternate from there; a slurred note
 * stays in the stroke before it. Plucked notes have no stroke (−1 in `strokeOf`).
 */
export function strokesOf(notes: readonly NoteEvent[], beats: number): { strokes: Stroke[]; strokeOf: number[] } {
  const strokes: Stroke[] = [];
  const strokeOf: number[] = new Array(notes.length).fill(-1);
  let dir: 1 | -1 = 1;
  let prev: NoteEvent | null = null;
  for (let i = 0; i < notes.length; i++) {
    const n = notes[i];
    if (n.art === "pizz") {
      prev = null;
      continue;
    }
    const cur = strokes[strokes.length - 1];
    if (n.slur && prev && cur && cur.last === i - 1) {
      cur.last = i;
      cur.end = Math.max(cur.end, n.start + n.dur);
    } else {
      const breath = !prev || n.start - (prev.start + prev.dur) >= BREATH - EPS;
      dir = breath ? (strong(n.start, beats) ? 1 : -1) : (-dir as 1 | -1);
      strokes.push({ first: i, last: i, dir, start: n.start, end: n.start + n.dur });
    }
    strokeOf[i] = strokes.length - 1;
    prev = n;
  }
  return { strokes, strokeOf };
}

// ─── Vibrato: the same for the ear and the eye ───────────────────────────────

/** Vibrato speed (Hz). */
export const VIBRATO_HZ = 5.6;
/** A note shorter than this (s) gets none; a longer one waits this long before it starts, then widens over this. */
const VIB_MIN = 0.32;
const VIB_DELAY = 0.18;
const VIB_RISE = 0.38;

/** How much vibrato (0..1 of full) a note `durSec` long has `age` seconds in: none at first, then widening in. */
export function vibratoAt(durSec: number, age: number): number {
  if (durSec < VIB_MIN || age <= VIB_DELAY) return 0;
  const k = Math.min(1, (age - VIB_DELAY) / VIB_RISE);
  // longer notes sing with more of it
  const depth = Math.min(1, 0.55 + 0.45 * ((durSec - VIB_MIN) / 1.2));
  return k * k * (3 - 2 * k) * depth;
}

/** When a note's vibrato starts and is fully in (s after its onset), for scheduling it. */
export const VIBRATO_CURVE = { min: VIB_MIN, delay: VIB_DELAY, rise: VIB_RISE } as const;
