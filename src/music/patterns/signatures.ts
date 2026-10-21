import { chordAt, harmAt, velFor, type BarCtx } from "../context";
import type { Harm } from "../harmony";
import { parseDrumGrid } from "../notation";
import type { Signature } from "../playing";
import { hashString } from "../rng";
import { fold, mod, nearestPc, pcOf, SCALES } from "../theory";
import type { NoteEvent } from "../types";
import { bassNote, voiceChord } from "./voicing";

// An artist's own figures, played where the style's would be: Miles's "So What" answer, a son
// montuno over a tumbao, Fela's interlocking guitar and keys, Stevie's clavinet, Guaraldi's left
// hand, Satie's bass-and-chord, Einaudi's broken chords, Frahm's repeated note, Sakamoto's
// pentatonic bells, Hisaishi's waltz. Each returns null where the artist would play the style's
// own part (Miles's pianist comps normally under a solo), so the caller falls back to it.

const twoHanded = (ctx: BarCtx) => ctx.inst.id === "piano" || ctx.inst.id === "organ";

/** The head, the intro and the out chorus: where a band plays its arrangement rather than blows. */
const arranged = (ctx: BarCtx) => ["intro", "head", "out", "vamp", "tag"].includes(ctx.section.kind);

function hit(pitches: number[], start: number, dur: number, vel: number, art?: NoteEvent["art"]): NoteEvent[] {
  return pitches.map((p, i) => ({ pitch: p, start, dur, vel: vel * (i === pitches.length - 1 ? 1.05 : 0.95), art }));
}

/** A chord voiced in [lo, hi], voice-led from the player's last one. */
function voiced(ctx: BarCtx, h: Harm, fam: Parameters<typeof voiceChord>[1], lo: number, hi: number): number[] {
  const v = voiceChord(h.chord, fam, lo, hi, ctx.mem.lastVoicing, h);
  ctx.mem.lastVoicing = v;
  return v;
}

/** Under the tune when someone's carrying it, so a figure doesn't sit on top of the melody. */
function under(ctx: BarCtx, lo: number, hi: number): [number, number] {
  if (!ctx.featured.length || ctx.role === "solo" || ctx.role === "lead") return [lo, hi];
  const low = Math.min(...ctx.featured.map((n) => n.pitch));
  const top = Math.min(hi, low - 1);
  return top - lo >= 10 ? [lo, top] : [lo, hi];
}

const harmNext = (ctx: BarCtx) => ctx.harmony.at(ctx.start + ctx.beats);

/** The chord's 3rd and 5th as intervals over its root (a chord's tones are intervals). */
function fifthOf(h: Harm): number {
  return mod(h.chord.tones[2] ?? 7, 12);
}

function thirdOf(h: Harm): number {
  return mod(h.chord.tones[1] ?? 4, 12);
}

/** A pitch class in the chord's scale, a step from `iv` (in semitones over the root), if it's there. */
function inScale(h: Harm, iv: number): boolean {
  return h.scale.includes(mod(h.chord.root + iv, 12));
}

// ─── Comping figures ─────────────────────────────────────────────────────────

/**
 * Miles's "So What": the bass states the riff, the piano answers it with two chords, the second
 * a step lower in the mode ("so what"), on the and of 3 and on 4 of every other bar. Under a solo
 * the pianist comps in the same voicing (the style's comping takes over).
 */
function amen(ctx: BarCtx): NoteEvent[] | null {
  if (!arranged(ctx) || ctx.beats !== 4 || ctx.peerIndex >= 1) return null;
  if (ctx.barInSection % 2 === 0) return [];
  const h = harmAt(ctx, 2.5);
  const vel = velFor(ctx, 0.62);
  // under the tune: the answer mustn't cloud the melody it answers
  const v = voiced(ctx, h, "sowhat", ...under(ctx, 48, 79));
  // the answer: the same shape, every voice down a step in the mode
  const down = v.map((p) => {
    for (let q = p - 1; q >= p - 2; q--) if (h.scale.includes(mod(q, 12))) return q;
    return p - 2;
  });
  return [...hit(v, 2.5, 0.5, vel * 1.05, "accent"), ...hit(down, 3, 1, vel)];
}

/** A montuno: two bars of syncopated octaves on the chord's tones, leaning into the next chord. */
const MONTUNO: { pos: number; tone: number; next?: true }[][] = [
  [
    { pos: 0, tone: 2 },
    { pos: 1, tone: 1 },
    { pos: 1.5, tone: 2 },
    { pos: 2.5, tone: 0 },
    { pos: 3, tone: 1 },
    { pos: 3.5, tone: 2 },
  ],
  [
    { pos: 0.5, tone: 1 },
    { pos: 1, tone: 2 },
    { pos: 2, tone: 0 },
    { pos: 2.5, tone: 1 },
    { pos: 3.5, tone: 2, next: true },
  ],
];

/**
 * Son: the piano's montuno, broken octaves with a chord tone between them, two bars against the
 * clave; a guitar (the tres) plays the other bar's half of it, single notes up high.
 */
function montuno(ctx: BarCtx): NoteEvent[] {
  const second = ctx.inst.id === "guitar" || ctx.peerIndex >= 1;
  const cell = MONTUNO[(ctx.bar + (second ? 1 : 0)) % 2].filter((x) => x.pos < ctx.beats);
  const sparse = ctx.args.includes("sparse") || ctx.texture === "sparse";
  const vel = velFor(ctx, second ? 0.5 : 0.56);
  const [lo, hi] = under(ctx, second ? 62 : 60, second ? 79 : 77);
  const out: NoteEvent[] = [];
  for (const [i, x] of cell.entries()) {
    if (sparse && i % 2 === 1) continue;
    const h = x.next && !ctx.lastBar ? harmNext(ctx) : harmAt(ctx, x.pos);
    const v = voiced(ctx, h, "triad", lo, hi);
    const top = v[x.tone % v.length];
    const dur = Math.min(0.5, ctx.beats - x.pos);
    const accent = x.pos % 1 === 0.5 ? 1.08 : 1;
    if (second) out.push({ pitch: top, start: x.pos, dur, vel: vel * accent, art: "staccato" });
    else {
      // the octave, with a chord tone between on the beats that lean
      const mid = v.find((p) => p > top - 12 && p < top && mod(p - top, 12) !== 0);
      out.push(...hit([top - 12, ...(x.pos % 1 === 0.5 && mid !== undefined ? [mid] : []), top], x.pos, dur, vel * accent));
    }
  }
  return out;
}

/**
 * Stevie Wonder's clavinet: a one-bar 16th riff on the chord's pentatonic, ghosted notes between
 * the struck ones and a double-stop on the backbeat, the same riff all section long.
 */
const CLAV: { pos: number; deg: number; ghost?: true; dyad?: true }[][] = [
  [
    { pos: 0, deg: 0 },
    { pos: 0.5, deg: 0, ghost: true },
    { pos: 0.75, deg: 1 },
    { pos: 1, deg: 2, dyad: true },
    { pos: 1.5, deg: 1 },
    { pos: 1.75, deg: 0, ghost: true },
    { pos: 2.25, deg: 3 },
    { pos: 2.5, deg: 2 },
    { pos: 3, deg: 1, dyad: true },
    { pos: 3.5, deg: 0 },
    { pos: 3.75, deg: 4, ghost: true },
  ],
  [
    { pos: 0, deg: 0 },
    { pos: 0.25, deg: 0, ghost: true },
    { pos: 0.75, deg: 2 },
    { pos: 1, deg: 1, dyad: true },
    { pos: 1.75, deg: 3 },
    { pos: 2, deg: 2 },
    { pos: 2.5, deg: 1, ghost: true },
    { pos: 2.75, deg: 0 },
    { pos: 3, deg: 2, dyad: true },
    { pos: 3.5, deg: 4 },
  ],
];

function clav(ctx: BarCtx): NoteEvent[] {
  const riff = CLAV[(hashString(`${ctx.seed}:${ctx.member.id}:${ctx.section.start}`) + ctx.peerIndex) % CLAV.length];
  const sparse = ctx.args.includes("sparse") || ctx.texture === "sparse";
  const vel = velFor(ctx, 0.6);
  const out: NoteEvent[] = [];
  for (const x of riff) {
    if (x.pos >= ctx.beats || (sparse && x.ghost)) continue;
    const h = harmAt(ctx, x.pos);
    const minorish = thirdOf(h) === 3 || h.chord.quality === "dom";
    const pent = (minorish ? SCALES.minorPentatonic : SCALES.majorPentatonic).map((i) => mod(h.chord.root + i, 12));
    // the riff keeps its shape on each chord: degree n of the chord's pentatonic, low and percussive
    const base = fold(nearestPc(h.chord.root, 55), 50, 61);
    const p = base + mod(pent[x.deg % pent.length] - h.chord.root, 12);
    // the double-stop: the pentatonic note two above it, struck with it
    const notes = x.dyad ? [p, p + mod(pent[(x.deg + 2) % pent.length] - pent[x.deg % pent.length], 12)] : [p];
    for (const q of notes) out.push({ pitch: q, start: x.pos, dur: 0.2, vel: vel * (x.ghost ? 0.4 : x.pos % 1 === 0 ? 1.05 : 0.95), art: x.ghost ? "ghost" : "staccato" });
  }
  return out;
}

/**
 * Afrobeat: the guitar chops a two-note 16th figure, muted, that never changes; the keys answer
 * with a short chord off the beat. Together they interlock with the bass, never doubling it.
 */
function afro(ctx: BarCtx): NoteEvent[] {
  const out: NoteEvent[] = [];
  const h = harmAt(ctx, 0);
  if (ctx.inst.id === "guitar") {
    const vel = velFor(ctx, 0.5);
    const root = fold(nearestPc(h.chord.root, 64), 60, 71);
    const fifth = fold(root + 7, 60, 74);
    const steps = [1, 2, 5, 6, 7, 9, 10, 13, 14, 15].filter((s) => s < ctx.beats * 4);
    for (const s of steps) {
      const p = s % 4 === 1 ? fifth : root + (s % 4 === 3 ? 12 : 0);
      out.push({ pitch: p, start: s / 4, dur: 0.18, vel: vel * (s % 4 === 2 ? 1.05 : 0.85), art: "staccato" });
    }
    return out;
  }
  const vel = velFor(ctx, 0.52);
  const [lo, hi] = under(ctx, 57, 79);
  const sparse = ctx.args.includes("sparse") || ctx.texture === "sparse";
  const hits = ctx.beats === 4 ? (sparse ? [1.5] : [0.5, 1.5, 3]) : [0.5, 2];
  for (const pos of hits) {
    const v = voiced(ctx, harmAt(ctx, pos), "quartal", lo, hi);
    out.push(...hit(v, pos, pos === 3 ? 0.75 : 0.35, vel * (pos % 1 ? 1.05 : 0.9), pos === 3 ? undefined : "staccato"));
  }
  return out;
}

/**
 * Guaraldi's left hand: a syncopated root–fifth–octave figure in straight 8ths that keeps going
 * under everything (Linus and Lucy), with the right hand answering on the offbeats when comping.
 */
const GUARALDI: { pos: number; iv: number }[] = [
  { pos: 0, iv: 0 },
  { pos: 0.5, iv: 7 },
  { pos: 1, iv: 12 },
  { pos: 1.5, iv: 14 },
  { pos: 2.5, iv: 12 },
  { pos: 3, iv: 7 },
  { pos: 3.5, iv: 10 },
];

function guaraldiLeft(ctx: BarCtx): NoteEvent[] {
  const out: NoteEvent[] = [];
  const vel = velFor(ctx, ctx.hasBass ? 0.48 : 0.6);
  for (const x of GUARALDI) {
    if (x.pos >= ctx.beats) continue;
    const h = harmAt(ctx, x.pos);
    const r = bassNote(h.chord, 36, 47, ctx.mem.lastPitch);
    // the 9th and 7th only where the chord has them; otherwise the octave and the 5th
    let iv = x.iv;
    if (iv === 14 && !inScale(h, 2)) iv = 12;
    if (iv === 10) iv = h.tones.some((t) => mod(t - h.chord.root, 12) === 10) ? 10 : 7;
    out.push({ pitch: r + iv, start: x.pos, dur: 0.5, vel: vel * (x.pos % 1 ? 1.06 : 1) });
  }
  return out;
}

function guaraldi(ctx: BarCtx): NoteEvent[] {
  if (!twoHanded(ctx)) return stabs(ctx, [1.5, 3.5]);
  const vel = velFor(ctx, 0.55);
  const out = guaraldiLeft(ctx);
  const [lo, hi] = under(ctx, 57, 77);
  for (const pos of [1.5, 3.5].filter((p) => p < ctx.beats)) out.push(...hit(voiced(ctx, harmAt(ctx, pos), "triad", lo, hi), pos, 0.45, vel, "staccato"));
  return out;
}

/** Short triads on the offbeats (a guitar or vibes with Guaraldi's trio). */
function stabs(ctx: BarCtx, at: number[]): NoteEvent[] {
  const vel = velFor(ctx, 0.5);
  const [lo, hi] = under(ctx, 55, 76);
  return at.filter((p) => p < ctx.beats).flatMap((pos) => hit(voiced(ctx, harmAt(ctx, pos), "triad", lo, hi), pos, 0.45, vel, "staccato"));
}

/**
 * Satie: a low bass note on the downbeat, the chord on the second beat held through the bar,
 * nothing else (the Gymnopédies); in 4/4 the pattern goes round twice.
 */
function satie(ctx: BarCtx): NoteEvent[] {
  const out: NoteEvent[] = [];
  const vel = velFor(ctx, 0.5);
  const [lo, hi] = under(ctx, 55, 74);
  const span = ctx.beats === 4 ? 2 : ctx.beats;
  for (let g = 0; g < ctx.beats; g += span) {
    const h = harmAt(ctx, g);
    if (twoHanded(ctx) || !ctx.hasBass) {
      const b = bassNote(h.chord, 38, 50, ctx.mem.lastPitch);
      ctx.mem.lastPitch = b;
      out.push({ pitch: b, start: g, dur: 1, vel: vel * (ctx.hasBass ? 0.7 : 0.95) });
    }
    const v = voiced(ctx, harmAt(ctx, g + 1), "open", lo, hi);
    out.push(...hit(v, g + 1, span - 1, vel * 0.85, "legato"));
  }
  return out;
}

/** Einaudi's left hand: root, fifth, tenth, fifth in even 8ths, the same shape on every chord. */
function einaudiLeft(ctx: BarCtx): NoteEvent[] {
  const out: NoteEvent[] = [];
  const vel = velFor(ctx, 0.5);
  for (let i = 0; i < ctx.beats * 2; i++) {
    const t = i / 2;
    const h = harmAt(ctx, t);
    const r = bassNote(h.chord, 36, 48, ctx.mem.lastPitch);
    if (i === 0) ctx.mem.lastPitch = r;
    const fifth = r + fifthOf(h);
    const tenth = r + 12 + thirdOf(h);
    const p = [r, fifth, tenth, fifth][i % 4];
    out.push({ pitch: p, start: t, dur: 0.5, vel: vel * (i % 4 === 0 ? 1.08 : 0.9), art: "legato" });
  }
  return out;
}

function einaudi(ctx: BarCtx): NoteEvent[] {
  const out = einaudiLeft(ctx);
  // the right hand holds the top of the chord over it, re-struck where the harmony moves
  const [lo, hi] = under(ctx, 60, 79);
  const vel = velFor(ctx, 0.42);
  for (const c of ctx.chords) {
    const end = ctx.chords.find((x) => x.beat > c.beat)?.beat ?? ctx.beats;
    const v = voiced(ctx, harmAt(ctx, c.beat), "triad", lo, hi);
    out.push(...hit(v.slice(-2), c.beat, end - c.beat, vel, "legato"));
  }
  return out;
}

/**
 * Nils Frahm: one note of the chord repeated in soft 8ths, swelling over the phrase, over an
 * open fifth held in the left hand. It changes pitch only when the chord makes it.
 */
function frahmPulse(ctx: BarCtx, withBass: boolean): NoteEvent[] {
  const out: NoteEvent[] = [];
  const swell = 0.8 + 0.1 * (ctx.barInSection % 4);
  const vel = velFor(ctx, 0.42) * swell;
  // one note per chord, under the tune (the melody stays on top) and clear of it: not its unison,
  // not a half step or a ninth from anything it plays around here
  const tune = ctx.role !== "lead" && ctx.role !== "solo" ? [...ctx.featuredPrev.filter((n) => n.start + n.dur > -0.5), ...ctx.featured] : [];
  const hi = Math.min(76, tune.length ? Math.min(...tune.map((n) => n.pitch)) - 1 : 76);
  const lo = Math.max(55, ctx.inst.range[0]);
  const clear = (p: number) => tune.every((n) => ![0, 1, 11, 13].includes(Math.abs(n.pitch - p)));
  const pick = (h: Harm): number => {
    // the 5th first, then the 9th where it can be held, the root, the 3rd
    const ivs = [7, ...(h.stable.includes(mod(h.chord.root + 2, 12)) ? [2] : []), 0, thirdOf(h)];
    for (const iv of ivs) {
      for (let p = hi - mod(hi - (h.chord.root + iv), 12); p >= lo; p -= 12) if (clear(p)) return p;
    }
    const p = hi - mod(hi - (h.chord.root + 7), 12);
    return p < lo ? p + 12 : p;
  };
  const notes = new Map<number, number>();
  for (let i = 0; i < ctx.beats * 2; i++) {
    const t = i / 2;
    const h = harmAt(ctx, t);
    if (!notes.has(h.start)) notes.set(h.start, pick(h));
    const p = notes.get(h.start)!;
    out.push({ pitch: p, start: t, dur: 0.5, vel: vel * (i % 2 === 0 ? 1 : 0.82) });
  }
  if (withBass) {
    for (const c of ctx.chords) {
      const end = ctx.chords.find((x) => x.beat > c.beat)?.beat ?? ctx.beats;
      const r = bassNote(c.chord, 36, 50, ctx.mem.lastPitch);
      ctx.mem.lastPitch = r;
      out.push({ pitch: r, start: c.beat, dur: end - c.beat, vel: vel * 0.9, art: "legato" }, { pitch: r + 7, start: c.beat, dur: end - c.beat, vel: vel * 0.75, art: "legato" });
    }
  }
  return out;
}

/**
 * Sakamoto: a bell-like ostinato in the key's pentatonic, eight 8ths a bar in octaves, the notes
 * the chord can hold. A second player (the vibes) rings the same cell an 8th behind.
 */
const BELLS = [0, 2, 4, 3, 1, 3, 2, 4];

function sakamoto(ctx: BarCtx): NoteEvent[] {
  const out: NoteEvent[] = [];
  const second = ctx.peerIndex >= 1 || ctx.inst.id === "vibes";
  const vel = velFor(ctx, second ? 0.4 : 0.48);
  const tonic = pcOf(ctx.key.tonic);
  const pent = (ctx.key.mode === "minor" ? SCALES.minorPentatonic : SCALES.majorPentatonic).map((i) => mod(tonic + i, 12));
  const [lo, hi] = under(ctx, second ? 67 : 62, second ? 88 : 81);
  const slots = Array.from({ length: ctx.beats * 2 }, (_, i) => i / 2 + (second ? 0.5 : 0)).filter((t) => t < ctx.beats);
  for (const [i, t] of slots.entries()) {
    const h = harmAt(ctx, t);
    // the pentatonic notes this chord holds (a passing one on the off-8ths), low to high from the bottom of the range
    const ok = pent.filter((pc) => h.stable.includes(pc) || (i % 2 === 1 && !h.avoid.includes(pc) && h.scale.includes(pc)));
    const pool: number[] = [];
    for (let p = lo; p <= hi && pool.length < 5; p++) if (ok.includes(mod(p, 12))) pool.push(p);
    if (!pool.length) continue;
    const p = pool[BELLS[(i + (second ? 3 : 0)) % BELLS.length] % pool.length];
    out.push({ pitch: p, start: t, dur: 0.5, vel: vel * (t % 1 === 0 ? 1 : 0.88) });
    if (!second && twoHanded(ctx) && p - 12 >= 52) out.push({ pitch: p - 12, start: t, dur: 0.5, vel: vel * 0.7 });
  }
  if (!second && twoHanded(ctx) && !ctx.hasBass) {
    const r = bassNote(chordAt(ctx, 0), 36, 50, ctx.mem.lastPitch);
    ctx.mem.lastPitch = r;
    out.push({ pitch: r, start: 0, dur: ctx.beats, vel: vel * 0.8, art: "legato" });
  }
  return out;
}

/**
 * Hisaishi's waltz: the bass note on one and the chord on two and three (in 4/4, oom-pah with
 * the fifth on three). A second chord player plays the chords only.
 */
function waltz(ctx: BarCtx): NoteEvent[] {
  const out: NoteEvent[] = [];
  const vel = velFor(ctx, 0.52);
  const [lo, hi] = under(ctx, 55, 74);
  const bassBeats = ctx.beats === 3 ? [0] : [0, 2];
  const chordBeats = ctx.beats === 3 ? [1, 2] : [1, 3];
  if (twoHanded(ctx) && ctx.peerIndex < 1) {
    for (const b of bassBeats) {
      const h = harmAt(ctx, b);
      let p = bassNote(h.chord, 36, 50, ctx.mem.lastPitch);
      if (b > 0 && ctx.chords.every((c) => c.beat !== b)) p = fold(p + fifthOf(h), 36, 52);
      else ctx.mem.lastPitch = p;
      out.push({ pitch: p, start: b, dur: 1, vel: vel * (ctx.hasBass ? 0.7 : 1) });
    }
  }
  for (const b of chordBeats) {
    const v = voiced(ctx, harmAt(ctx, b), "triad", lo, hi);
    // the bottom note doubled an octave up when it fits: a fuller chord, with a note to spare
    // when one has to step out of the way of the tune or a held line
    const full = v[0] + 12 <= hi && !v.includes(v[0] + 12) ? [...v, v[0] + 12] : v;
    out.push(...hit(full, b, 0.8, vel * (b === chordBeats[0] ? 0.9 : 0.8)));
  }
  return out;
}

/** The chordal player's figure for an artist, or null for the style's own comping. */
export function compFigure(ctx: BarCtx, sig: NonNullable<Signature["comp"]>): NoteEvent[] | null {
  switch (sig) {
    case "amen":
      return amen(ctx);
    case "montuno":
      return montuno(ctx);
    case "clav":
      return clav(ctx);
    case "afro":
      return afro(ctx);
    case "guaraldi":
      return guaraldi(ctx);
    case "satie":
      return satie(ctx);
    case "einaudi":
      return twoHanded(ctx) ? einaudi(ctx) : null;
    case "frahm":
      return frahmPulse(ctx, twoHanded(ctx) && (!ctx.hasBass || ctx.peerIndex < 1));
    case "sakamoto":
      return sakamoto(ctx);
    case "waltz":
      return waltz(ctx);
  }
}

/**
 * What a keyboard player's left hand does under their own tune, for the artists whose left hand
 * is the signature (Guaraldi's ostinato, Einaudi's broken chords, Frahm's open fifths, Satie's
 * bass note, Hisaishi's oom-pah); null for the usual sparse shells.
 */
export function leftHandFigure(ctx: BarCtx, sig: Signature | undefined): NoteEvent[] | null {
  switch (sig?.comp) {
    case "guaraldi":
      return guaraldiLeft(ctx);
    case "einaudi":
      return einaudiLeft(ctx);
    case "frahm": {
      const out: NoteEvent[] = [];
      const vel = velFor(ctx, 0.4);
      for (const c of ctx.chords) {
        const end = ctx.chords.find((x) => x.beat > c.beat)?.beat ?? ctx.beats;
        const r = bassNote(c.chord, 36, 50, ctx.mem.lastPitch);
        ctx.mem.lastPitch = r;
        out.push({ pitch: r, start: c.beat, dur: end - c.beat, vel, art: "legato" }, { pitch: r + 7, start: c.beat, dur: end - c.beat, vel: vel * 0.8, art: "legato" });
      }
      return out;
    }
    case "satie":
    case "waltz": {
      const vel = velFor(ctx, 0.45);
      const out: NoteEvent[] = [];
      const h = harmAt(ctx, 0);
      const b = bassNote(h.chord, 38, 50, ctx.mem.lastPitch);
      ctx.mem.lastPitch = b;
      out.push({ pitch: b, start: 0, dur: 1, vel });
      const v = voiceChord(h.chord, "triad", 50, 62, null, h);
      out.push(...hit(v, 1, sig.comp === "satie" ? ctx.beats - 1 : 0.8, vel * 0.8, sig.comp === "satie" ? "legato" : undefined));
      if (sig.comp === "waltz" && ctx.beats >= 3) out.push(...hit(v, 2, 0.8, vel * 0.75));
      return out;
    }
    default:
      return null;
  }
}

// ─── Bass figures ────────────────────────────────────────────────────────────

/** Bass register (an upright's, or a cellist's covering the chair). */
function bassRange(ctx: BarCtx): [number, number] {
  return ctx.inst.id === "cello" ? [36, 55] : [28, 52];
}

function rootIn(ctx: BarCtx, h: Harm, near: number | null): number {
  const [lo, hi] = bassRange(ctx);
  return bassNote(h.chord, lo, Math.min(hi, lo + 14), near);
}

/**
 * Miles's "So What" bass: a riff up the mode into the next bar, held under the piano's answer.
 * In the solos the bass walks (null: the style's own).
 */
function soWhat(ctx: BarCtx): NoteEvent[] | null {
  if (!arranged(ctx) || ctx.beats !== 4) return null;
  const vel = velFor(ctx, 0.78);
  const h = harmAt(ctx, 0);
  const r = rootIn(ctx, h, ctx.mem.lastPitch);
  ctx.mem.lastPitch = r;
  if (ctx.barInSection % 2 === 1) return [{ pitch: r, start: 0, dur: 2.5, vel }];
  // up the mode from the fifth below: 5 R 2 b3 4 2, the call the piano answers
  const scaleUp = (from: number, steps: number) => {
    let p = from;
    for (let k = 0; k < steps; k++) {
      p++;
      while (!h.scale.includes(mod(p, 12))) p++;
    }
    return p;
  };
  const five = r - 5;
  const line = [five, r, scaleUp(r, 1), scaleUp(r, 2), scaleUp(r, 3), scaleUp(r, 1)];
  return line.map((p, i) => ({ pitch: p, start: 1 + i * 0.5, dur: i === line.length - 1 ? 1 : 0.5, vel: vel * (i === 0 ? 0.9 : 1) }));
}

/**
 * The tumbao: nothing on one, the fifth on the and of two, and the next chord's root on four,
 * held over the barline, so the bass is always a beat ahead of the harmony.
 */
function tumbao(ctx: BarCtx): NoteEvent[] {
  const vel = velFor(ctx, 0.8);
  const out: NoteEvent[] = [];
  const h = harmAt(ctx, 0);
  const r = rootIn(ctx, h, ctx.mem.lastPitch);
  if (ctx.beats !== 4) return [{ pitch: r, start: 0, dur: 1.5, vel }, { pitch: rootIn(ctx, harmNext(ctx), r), start: 2, dur: 1, vel: vel * 0.9 }];
  // the first bar (and a bar after silence) has nothing ringing into it: the root on one
  if (ctx.firstBar || ctx.sectionStart) out.push({ pitch: r, start: 0, dur: 1.5, vel });
  const h2 = harmAt(ctx, 1.5);
  const r2 = rootIn(ctx, h2, r);
  const next = ctx.lastBar ? r2 : rootIn(ctx, harmNext(ctx), r2);
  // the fifth above or below, whichever sits between the two roots (C3 then G1 is a twelfth down)
  const [lo, hi] = bassRange(ctx);
  const fifth = [r2 + fifthOf(h2), r2 + fifthOf(h2) - 12]
    .filter((p) => p >= lo && p <= hi)
    .reduce((a, b) => (Math.abs(b - r2) + Math.abs(b - next) < Math.abs(a - r2) + Math.abs(a - next) ? b : a), fold(r2 + fifthOf(h2), lo, hi));
  out.push({ pitch: fifth, start: 1.5, dur: 1.5, vel: vel * 0.95 });
  out.push({ pitch: next, start: 3, dur: 1, vel: vel * 1.05, art: "accent" });
  ctx.mem.lastPitch = next;
  return out;
}

/** Afrobeat bass: a one-bar riff full of rests, the same all night, on the chord's own tones. */
const AFRO_BASS: { pos: number; iv: "R" | "3" | "4" | "5" | "7"; dur: number }[] = [
  { pos: 0, iv: "R", dur: 0.5 },
  { pos: 0.75, iv: "R", dur: 0.25 },
  { pos: 1.5, iv: "3", dur: 0.5 },
  { pos: 2.5, iv: "4", dur: 0.25 },
  { pos: 2.75, iv: "5", dur: 0.5 },
  { pos: 3.5, iv: "7", dur: 0.5 },
];

/** Herbie's "Chameleon": a 16th synth-bass riff that falls from the octave, never resting long. */
const CHAMELEON: { pos: number; iv: "R" | "8" | "7" | "5" | "4" | "3" | "-7"; dur: number }[] = [
  { pos: 0, iv: "R", dur: 0.5 },
  { pos: 0.75, iv: "R", dur: 0.25 },
  { pos: 1, iv: "8", dur: 0.25 },
  { pos: 1.5, iv: "7", dur: 0.25 },
  { pos: 1.75, iv: "5", dur: 0.5 },
  { pos: 2.5, iv: "4", dur: 0.25 },
  { pos: 2.75, iv: "3", dur: 0.25 },
  { pos: 3, iv: "R", dur: 0.5 },
  { pos: 3.75, iv: "-7", dur: 0.25 },
];

function riffBass(ctx: BarCtx, riff: { pos: number; iv: string; dur: number }[]): NoteEvent[] {
  const vel = velFor(ctx, 0.82);
  const out: NoteEvent[] = [];
  let last = ctx.mem.lastPitch;
  for (const x of riff) {
    if (x.pos >= ctx.beats) continue;
    const h = harmAt(ctx, x.pos);
    const r = rootIn(ctx, h, ctx.mem.lastPitch);
    const tone = (i: number, fallback: number) => mod(h.chord.tones[i] ?? fallback, 12);
    // a triad has no 7th: the octave stands in for it
    const seventh = h.chord.tones[3] !== undefined ? tone(3, 10) : 12;
    const iv = { R: 0, "8": 12, "3": tone(1, 4), "4": 5, "5": tone(2, 7), "7": seventh, "-7": seventh - 12 }[x.iv] ?? 0;
    // a 4th that rubs the chord's major 3rd is a passing note only; on a long note it's the 5th
    const p = r + (iv === 5 && x.dur > 0.25 && tone(1, 4) === 4 ? tone(2, 7) : iv);
    out.push({ pitch: p, start: x.pos, dur: x.dur, vel: vel * (x.pos === 0 ? 1.1 : x.pos % 1 ? 0.9 : 1), art: x.pos === 0 ? "accent" : "staccato" });
    last = r;
  }
  ctx.mem.lastPitch = last;
  return out;
}

/**
 * In two: the root on one, held (in 4/4 the fifth on three as well, or the new root where the
 * chord moves). A waltz's bass, and a trio bassist under a busy left hand.
 */
function twoFeel(ctx: BarCtx): NoteEvent[] {
  const vel = velFor(ctx, 0.72);
  const out: NoteEvent[] = [];
  const at = ctx.beats === 3 ? [0] : [0, 2];
  for (const b of at) {
    const h = harmAt(ctx, b);
    const r = rootIn(ctx, h, ctx.mem.lastPitch);
    const moved = ctx.chords.some((c) => c.beat === b);
    const p = b === 0 || moved ? r : fold(r + fifthOf(h), ...bassRange(ctx));
    if (b === 0 || moved) ctx.mem.lastPitch = r;
    out.push({ pitch: p, start: b, dur: ctx.beats === 3 ? 2 : 1.5, vel: vel * (b === 0 ? 1 : 0.85) });
  }
  return out;
}

/** The bass player's figure for an artist, or null for the style's own. */
export function bassFigure(ctx: BarCtx, sig: NonNullable<Signature["bass"]>): NoteEvent[] | null {
  switch (sig) {
    case "sowhat":
      return soWhat(ctx);
    case "tumbao":
      return tumbao(ctx);
    case "afro":
      return riffBass(ctx, AFRO_BASS);
    case "chameleon":
      return riffBass(ctx, CHAMELEON);
    case "two":
      return twoFeel(ctx);
  }
}

// ─── Drum grooves ────────────────────────────────────────────────────────────

const lane = (name: string, steps: number[], len: number, mark = "x") => `${name}:${Array.from({ length: len }, (_, i) => (steps.includes(i) ? mark : ".")).join("")}`;

/**
 * Grooves an artist brings: brushes (a soft swirl on the snare, the hi-hat on 2 and 4), the son's
 * 2–3 clave with bongo bell and conga, and Tony Allen's afrobeat (busy hats, a snare that dances
 * around the backbeat, a kick that leaves the one open half the time).
 */
export function drumGrid(ctx: BarCtx, sig: NonNullable<Signature["drums"]>, which: "base" | "light" | "peak"): string {
  const n = ctx.beats * 4;
  switch (sig) {
    case "brushes": {
      const swirl = Array.from({ length: n / 2 }, (_, i) => i * 2);
      const foot = ctx.beats === 3 ? [4, 8] : [4, 12];
      const lanes = [lane("sd", swirl, n, "g"), lane("ph", foot, n)];
      if (which === "peak") lanes.push(lane("rd", ctx.beats === 3 ? [0, 4, 6, 8] : [0, 4, 6, 8, 12, 14], n));
      if (which !== "light") lanes.push(lane("bd", [0], n, "g"));
      return lanes.join(" ");
    }
    case "son": {
      if (ctx.beats !== 4) return `${lane("rim", [0, 6], n)} ${lane("cb", [0, 4, 8], n)}`;
      // 2–3 son clave across two bars: two notes, then three
      const clave = ctx.bar % 2 === 0 ? [4, 8] : [0, 6, 12];
      const lanes = [lane("rim", clave, n), lane("cg", [4, 12], n), lane("cgl", [14, 15], n)];
      if (which !== "light") lanes.push(lane("cb", [0, 4, 8, 12], n), lane("bd", [12], n, "g"));
      if (which === "peak") lanes.push(lane("cb", [0, 2, 4, 6, 8, 10, 12, 14], n));
      return lanes.join(" ");
    }
    case "afrobeat": {
      if (ctx.beats !== 4) return `${lane("hh", [0, 2, 3, 4, 6, 7, 8, 10, 11], n)} ${lane("sd", [6], n)} ${lane("bd", [0, 8], n)}`;
      const lanes = [
        lane("hh", [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 15], n),
        lane("oh", [14], n),
        `sd:...g..X..g..X.g.`,
        lane("bd", ctx.bar % 2 === 0 ? [0, 3, 10] : [3, 8, 10], n),
      ];
      if (which !== "light") lanes.push(lane("sh", Array.from({ length: n }, (_, i) => i), n, "g"));
      if (which === "peak") lanes.push(lane("cb", [0, 3, 6, 10, 12], n));
      return lanes.join(" ");
    }
  }
}

/** Parsed hits for an artist's groove at this bar. */
export function sigGroove(ctx: BarCtx, sig: NonNullable<Signature["drums"]>, which: "base" | "light" | "peak"): NoteEvent[] {
  return parseDrumGrid(drumGrid(ctx, sig, which), ctx.beats).notes;
}

// ─── Line colours ────────────────────────────────────────────────────────────

/**
 * A featured line in the artist's colour. Whole-tone: over a dominant, now and then the back of
 * the bar becomes a run down the whole-tone scale (Monk's signature); pentatonic: a held or
 * on-the-beat note outside the chord's pentatonic moves to the nearest one in it. Written notes
 * (the tune) are left alone.
 */
export function colorLine(notes: NoteEvent[], ctx: BarCtx, sig: Signature | undefined): NoteEvent[] {
  if (!sig?.line || !notes.length || notes.some((n) => n.written)) return notes;
  if (sig.line === "wholetone") {
    const at = ctx.beats - 2;
    const h = harmAt(ctx, at);
    if (h.chord.quality !== "dom" || hashString(`${ctx.seed}:wt:${ctx.member.id}:${ctx.bar}`) % 100 >= 45) return notes;
    const before = notes.filter((n) => n.start < at - 1e-6);
    const from = before.at(-1)?.pitch ?? notes[0].pitch;
    const whole = [0, 2, 4, 6, 8, 10].map((i) => mod(h.chord.root + i, 12));
    let p = from + 2;
    while (!whole.includes(mod(p, 12))) p--;
    const [lo, hi] = ctx.inst.solo ?? ctx.inst.sweet;
    if (p - 6 < lo) p += 12;
    if (p > hi) p -= 12;
    const vel = (before.at(-1)?.vel ?? notes[0].vel) * 0.95;
    const run = Array.from({ length: 4 }, (_, i) => ({ pitch: p - 2 * i, start: at + i * 0.5, dur: 0.5, vel: vel * (i === 0 ? 1.05 : 1) }));
    for (const n of before) if (n.start + n.dur > at) n.dur = Math.max(0.25, at - n.start);
    return [...before, ...run];
  }
  // pentatonic
  return notes.map((n) => {
    const onBeat = Math.abs(n.start - Math.round(n.start)) < 1e-6;
    if (!onBeat && n.dur < 0.75) return n;
    const h = harmAt(ctx, n.start);
    const minorish = thirdOf(h) === 3;
    const pent = (minorish ? SCALES.minorPentatonic : SCALES.majorPentatonic).map((i) => mod(h.chord.root + i, 12));
    const ok = [...new Set([...pent.filter((pc) => !h.avoid.includes(pc)), ...h.tones])];
    if (ok.includes(mod(n.pitch, 12))) return n;
    for (const d of [-1, 1, -2, 2]) if (ok.includes(mod(n.pitch + d, 12))) return { ...n, pitch: n.pitch + d };
    return n;
  });
}
