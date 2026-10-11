import { hashString } from "./rng";
import type { NoteEvent, StyleId } from "./types";

// How a style is played, as one row per feel: how hard the metre is leaned on, how long a short
// note is held, how loose the time and the touch are, whether the bar breathes, and the line's
// habits (pushes onto the beat, dotted pairs, accent groupings that run across the bar). The
// notes are the engine's job; this is the hands. Each style plays its own row unless the chart
// picks another (a preset can put Glass's touch on a minimalist chart, or Laufey's on a bossa).
//
// The first five are touch, applied as the audio plays (and, for the rubato, in the pocket the
// animation shares). The rest move or mark a line's notes, only on a featured player's own lines:
// never the written melody, the bass or the comping (a bossa's bass and comping don't anticipate).

export type FeelId = StyleId | "glass" | "zimmer" | "chopin" | "debussy" | "laufey" | "fox" | "bach" | "basie";

export interface PlayingFeel {
  name: string;
  /** Scales the metric accent: the downbeat up, the off-beats down (0 = flat). */
  accent: number;
  /** Fraction of a short note's (under a beat) written length that sounds. */
  articulation: number;
  /** Peak random timing deviation of a pitched note, in seconds. */
  looseness: number;
  /** Peak random velocity deviation, as a fraction. */
  humanize: number;
  /** How the bar's time bends: not at all, a light push and pull over each two bars, or a breath. */
  rubato: "even" | "light" | "breathing";
  /** Chance a line's note on a beat inside the bar is struck half a beat early and held across. */
  push: number;
  /** Share of even eighth pairs a line plays long–short (straight styles only). */
  dotted: number;
  /** A comping figure keeps one speed through sparse bars (only its weight changes). */
  ostinato?: true;
  /** Accent groupings that regroup a running bar of sixteenths against the metre, a bar each in turn. */
  grouping?: readonly (readonly number[])[];
}

export const FEELS: Record<FeelId, PlayingFeel> = {
  swing: { name: "Swing", accent: 0.8, articulation: 0.9, looseness: 0.008, humanize: 0.06, rubato: "even", push: 0.12, dotted: 0 },
  bossa: { name: "Bossa", accent: 0.5, articulation: 0.95, looseness: 0.006, humanize: 0.04, rubato: "even", push: 0.2, dotted: 0 },
  funk: { name: "Funk", accent: 1.3, articulation: 0.65, looseness: 0.003, humanize: 0.05, rubato: "even", push: 0.15, dotted: 0, grouping: [[3, 3, 2, 3, 3, 2]] },
  pop: { name: "Pop", accent: 1, articulation: 0.9, looseness: 0.005, humanize: 0.04, rubato: "even", push: 0.3, dotted: 0.1 },
  neworleans: { name: "New Orleans", accent: 1.2, articulation: 0.88, looseness: 0.012, humanize: 0.08, rubato: "even", push: 0.1, dotted: 0.35 },
  minimal: { name: "Minimalist", accent: 0.9, articulation: 0.92, looseness: 0.001, humanize: 0.015, rubato: "even", push: 0, dotted: 0, ostinato: true },
  baroque: { name: "Baroque", accent: 0.8, articulation: 0.85, looseness: 0.003, humanize: 0.02, rubato: "even", push: 0, dotted: 0.07 },
  ambient: { name: "Ambient", accent: 0.4, articulation: 1, looseness: 0.015, humanize: 0.04, rubato: "breathing", push: 0.15, dotted: 0.05 },
  // the artists' hands (jev-playground's style voices, carried over to a band)
  bach: { name: "Bach", accent: 0.8, articulation: 0.9, looseness: 0.002, humanize: 0.016, rubato: "even", push: 0, dotted: 0.07 },
  chopin: { name: "Chopin", accent: 0.7, articulation: 1, looseness: 0.01, humanize: 0.024, rubato: "light", push: 0, dotted: 0.35 },
  debussy: { name: "Debussy", accent: 0.4, articulation: 1, looseness: 0.012, humanize: 0.03, rubato: "light", push: 0.15, dotted: 0.05 },
  glass: { name: "Glass", accent: 0.9, articulation: 0.92, looseness: 0.001, humanize: 0.008, rubato: "even", push: 0, dotted: 0, ostinato: true },
  zimmer: { name: "Zimmer", accent: 1, articulation: 1, looseness: 0.003, humanize: 0.016, rubato: "even", push: 0.1, dotted: 0.1, ostinato: true },
  laufey: { name: "Laufey", accent: 1.1, articulation: 0.9, looseness: 0.01, humanize: 0.04, rubato: "light", push: 0.35, dotted: 0.15 },
  fox: { name: "Elijah Fox", accent: 0.8, articulation: 1, looseness: 0.008, humanize: 0.03, rubato: "light", push: 0.15, dotted: 0.05, grouping: [[5, 5, 6], [7, 5, 4]] },
  basie: { name: "Basie", accent: 1.1, articulation: 0.8, looseness: 0.007, humanize: 0.05, rubato: "even", push: 0.18, dotted: 0 },
};

export const FEEL_IDS = Object.keys(FEELS) as FeelId[];

/** The feel a chart plays with: its own pick, or its style's. */
export function feelOf(settings: { style: StyleId; feel?: FeelId | null }): PlayingFeel {
  return FEELS[settings.feel ?? settings.style] ?? FEELS[settings.style];
}

// ─── Touch, as the notes play ────────────────────────────────────────────────

/**
 * The metric weight of a position in the bar: the downbeat leans in, the middle of the bar a
 * little, the off-beat eighths and sixteenths back off. Scaled by the feel's accent.
 */
export function metricLift(feel: PlayingFeel, posInBar: number, beats: number): number {
  const f = posInBar - Math.floor(posInBar + 1e-6);
  let w: number;
  if (posInBar < 1e-6) w = 0.06;
  else if (f < 1e-6) w = beats === 4 && Math.abs(posInBar - 2) < 1e-6 ? 0.03 : 0.01;
  else if (Math.abs(f - 0.5) < 1e-6) w = -0.03;
  else w = -0.05;
  return 1 + w * feel.accent;
}

/** How long a note sounds, given its written length in beats and seconds. */
export function articulate(feel: PlayingFeel, beats: number, sec: number, art?: NoteEvent["art"]): number {
  if (beats >= 1 - 1e-6 || art === "legato" || art === "staccato") return sec;
  return sec * feel.articulation;
}

/**
 * Seconds the whole band leans ahead (−) of or behind (+) the grid at a beat: everyone together,
 * so the ensemble stays tight while the bar breathes. A light rubato pushes into the middle of
 * each two-bar phrase and pulls back into its end; a breath is the same, slower and deeper.
 */
export function rubatoSec(feel: PlayingFeel, beat: number, beatsPerBar: number, spb: number): number {
  if (feel.rubato === "even") return 0;
  const span = beatsPerBar * (feel.rubato === "breathing" ? 4 : 2);
  const x = (beat % span) / span;
  const depth = feel.rubato === "breathing" ? 0.09 : 0.05;
  // ahead through the first half, behind into the cadence, back on time at the barline
  return -Math.sin(x * Math.PI * 2) * depth * spb;
}

// ─── A line's habits ──────────────────────────────────────────────────────────

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/**
 * A featured player's line with the feel's habits on it: some notes on an inner beat are pushed
 * half a beat early and held across, even eighth pairs go long–short, and a bar of running
 * sixteenths takes the feel's accent grouping. Deterministic per `seed` and bar. Written notes
 * (the tune itself) are left as written.
 */
export function playLine(notes: NoteEvent[], feel: PlayingFeel, opts: { bar: number; beats: number; seed: string; straight: boolean }): NoteEvent[] {
  if (!notes.length || notes.some((n) => n.written)) return notes;
  const roll = (k: string) => (hashString(`${opts.seed}:${opts.bar}:${k}`) % 10000) / 10000;
  let out = notes.map((n) => ({ ...n }));
  const sorted = () => out.sort((a, b) => a.start - b.start);
  sorted();

  // pushes: a note on an inner beat, with room before it, comes in on the "and" before
  if (feel.push > 0) {
    for (let i = 0; i < out.length; i++) {
      const n = out[i];
      if (n.start < 1 - 1e-6 || !near(n.start, Math.round(n.start)) || n.art === "ghost") continue;
      const prev = out.filter((m) => m.start < n.start - 1e-6).at(-1);
      // only into silence or a held note that can let go: never over a moving line
      if (prev && prev.start > n.start - 1 + 1e-6) continue;
      if (roll(`push${i}`) >= feel.push) continue;
      if (prev && prev.start + prev.dur > n.start - 0.5) prev.dur = Math.max(0.25, n.start - 0.5 - prev.start);
      n.start -= 0.5;
      n.dur += 0.5;
    }
    sorted();
  }

  // dotted pairs: two even eighths in a beat lean long–short (swing does this its own way)
  if (opts.straight && feel.dotted > 0) {
    for (let i = 0; i + 1 < out.length; i++) {
      const a = out[i];
      const b = out[i + 1];
      if (!near(a.start, Math.floor(a.start + 1e-6)) || !near(a.dur, 0.5) || !near(b.start, a.start + 0.5) || !near(b.dur, 0.5)) continue;
      if (out.some((m) => m !== a && near(m.start, a.start))) continue; // chords stay even
      if (roll(`dot${i}`) >= feel.dotted) continue;
      a.dur = 0.75;
      b.start = a.start + 0.75;
      b.dur = 0.25;
      i++;
    }
  }

  // groupings: a bar of running sixteenths is accented in groups across the barline's metre
  if (feel.grouping?.length) {
    const onsets = [...new Set(out.map((n) => Math.round(n.start * 4)))];
    if (onsets.length >= opts.beats * 3) {
      const groups = feel.grouping[opts.bar % feel.grouping.length];
      let at = 0;
      const starts = new Set<number>();
      for (const g of groups) {
        starts.add(at);
        at += g;
      }
      out = out.map((n) => (starts.has(Math.round(n.start * 4)) && !n.art ? { ...n, art: "accent" as const } : n));
    }
  }
  return out;
}
