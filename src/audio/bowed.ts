import type { Storage } from "smplr";
import { VIBRATO_CURVE, VIBRATO_HZ, vibratoAt } from "@/music/bowing";
import { hashString } from "@/music/rng";
import type { NoteEvent, StyleId } from "@/music/types";

// The violin's own voice. A soundfont played through smplr starts every note at full level with
// the sample's bow bite, holds it flat and stops it with a fixed fade: each note sounded like a
// new bow stroke, slurred or not, with no swell and vibrato that never changed. Here each note
// gets its own envelope: a new bow speaks, a slurred note crossfades in under the one before it
// with no new attack, a long note swells and eases off, vibrato comes in once the note has
// spoken, and a slurred shift slides a little into the new note. The samples are the same
// soundfont (decoded once); levels match smplr's exactly at the envelope's plateau.

/** A note as the engine schedules it (times in context seconds). */
export interface BowedNote {
  time: number;
  /** How long it's written to last (s): to the next note's onset when they join. */
  dur: number;
  pitch: number;
  /** 0..1, after the engine's touch (accent, metre, humanising). */
  vel: number;
  art?: NoteEvent["art"];
  slur?: boolean;
}

/** How a note is joined to the one before it: slurred, a change of bow, or a new bow out of silence. */
export type BowJoin = "slur" | "change" | "fresh";

/** Everything the voice does for one note, relative to its onset. */
export interface BowPlan {
  time: number;
  pitch: number;
  /** The voice's level at the envelope's plateau (smplr's velocity curve). */
  gain: number;
  /** Envelope points [s after onset, level × gain], ramped between, ending at 0. */
  env: [number, number][];
  /** When the sample stops (s after onset), once the envelope is at 0. */
  stop: number;
  /** Vibrato depth points [s after onset, cents]. */
  vib: [number, number][];
  /** Where the pitch starts (cents from the note) and how quickly it slides in (time constant, s). */
  slide: { from: number; tau: number } | null;
}

/** Vibrato depth (cents) at full width, by style: barely there in baroque, wide in a ballad. */
const VIB_CENTS: Record<StyleId, number> = { baroque: 7, minimal: 9, funk: 8, swing: 13, neworleans: 14, bossa: 12, pop: 13, ambient: 15 };
/** Styles that slide between notes (portamento) now and then. */
const SLIDES: Partial<Record<StyleId, number>> = { swing: 0.35, neworleans: 0.4, bossa: 0.35, pop: 0.4, ambient: 0.5 };

/** smplr's velocity curve (vel² over 127²). */
export const velGain = (vel: number) => {
  const v = Math.round(1 + Math.min(1, Math.max(0, vel)) * 126);
  return (v * v) / 16129;
};

/**
 * Plan one bowed note: how it starts (`join` to the note before), how it swells, when it lets
 * go (into the next note's onset when they join, `nextIn` seconds after this one starts), its
 * vibrato and any slide into it.
 */
export function planBow(
  cur: BowedNote,
  o: { join: BowJoin; prevPitch: number | null; nextIn: number | null; nextSlur: boolean; style: StyleId; seed?: number },
): BowPlan {
  const d = Math.max(0.03, cur.dur);
  const env: [number, number][] = [];
  const accent = cur.art === "accent";
  const staccato = cur.art === "staccato";
  // ── the start ──
  if (o.join === "slur") {
    // no new bow: it fades in under the note before as that one lets go
    env.push([0, 0], [0.045, 1]);
  } else if (o.join === "change") {
    // a change of bow mid-line: quick and soft, never a gap
    env.push([0, 0.3], [0.035, accent ? 1.08 : 0.97], [0.08, 1]);
  } else if (accent || staccato) {
    env.push([0, 0.55], [0.018, accent ? 1.1 : 1], [0.07, 1]);
  } else if (d >= 0.8) {
    // a long note out of silence: the bow sets in and the note speaks
    env.push([0, 0], [0.07, 0.62], [0.17, 0.92]);
  } else {
    env.push([0, 0], [0.035, 0.8], [0.09, 1]);
  }
  // ── the body: a long note swells toward its middle and eases off ──
  const joined = o.nextIn !== null;
  const endLevel = joined ? 0.9 : d >= 0.9 ? 0.7 : 0.85;
  if (d >= 0.9) env.push([d * 0.55, 1.15], [d, endLevel]);
  else if (d >= 0.4) env.push([d * 0.5, 1.06], [d, joined ? 0.95 : 0.85]);
  else env.push([d, joined ? 1 : 0.95]);
  // ── the end ──
  let releaseAt: number;
  let release: number;
  if (staccato) {
    releaseAt = Math.max(0.05, d * 0.5);
    release = 0.06;
  } else if (joined && o.nextSlur) {
    // let go as the next note fades in under it: a slur with no gap and no bump
    releaseAt = Math.max(0.02, o.nextIn! + 0.012);
    release = 0.08;
  } else if (joined) {
    releaseAt = Math.max(0.02, o.nextIn! + 0.008);
    release = 0.045;
  } else {
    // the bow comes off and the string rings a moment
    releaseAt = d;
    release = d >= 0.4 ? 0.22 : 0.12;
  }
  const g = velGain(cur.vel);
  const shaped = clipEnvelope(env, releaseAt).map(([t, v]) => [t, v * g] as [number, number]);
  shaped.push([releaseAt + release, 0]);

  // ── vibrato: none on short notes; on a held one it waits, then widens in ──
  const vib: [number, number][] = [];
  const cents = VIB_CENTS[o.style] ?? 12;
  if (!staccato && d >= VIBRATO_CURVE.min) {
    const { delay, rise } = VIBRATO_CURVE;
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const t = delay + rise * k;
      if (t >= releaseAt) break;
      vib.push([t, cents * vibratoAt(d, t)]);
    }
    if (vib.length) {
      const last = vib[vib.length - 1];
      if (releaseAt > last[0]) vib.push([releaseAt, last[1]]);
      vib.push([releaseAt + release, 0]);
    }
  }

  // ── a slide into the note: a slurred shift, now and then, in styles that do it ──
  let slide: BowPlan["slide"] = null;
  const leap = o.prevPitch === null ? 0 : cur.pitch - o.prevPitch;
  const roll = (hashString(`${o.seed ?? 0}:${cur.time.toFixed(3)}:${cur.pitch}`) % 1000) / 1000;
  const chance = SLIDES[o.style] ?? 0;
  if (o.join === "slur" && Math.abs(leap) >= 3 && d >= 0.3 && roll < chance * (Math.abs(leap) >= 5 ? 1 : 0.5)) {
    slide = { from: -leap * 100 * 0.55, tau: 0.018 + 0.003 * Math.min(12, Math.abs(leap)) };
  } else if (o.join === "fresh" && leap >= 4 && d >= 0.9 && roll < chance * 0.3) {
    // a scoop up into a long note at the top of a leap
    slide = { from: -110, tau: 0.03 };
  }
  return { time: cur.time, pitch: cur.pitch, gain: g, env: shaped, stop: releaseAt + release + 0.01, vib, slide };
}

/** Envelope points up to `at` (interpolating the level there), times strictly increasing. */
function clipEnvelope(env: [number, number][], at: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < env.length; i++) {
    const [t, v] = env[i];
    if (t < at - 1e-6) {
      if (!out.length || t > out[out.length - 1][0] + 1e-6) out.push([t, v]);
      continue;
    }
    const prev = out[out.length - 1] ?? [0, v];
    const k = t - prev[0] > 1e-9 ? (at - prev[0]) / (t - prev[0]) : 1;
    out.push([at, prev[1] + (v - prev[1]) * Math.min(1, Math.max(0, k))]);
    return out;
  }
  // held at its last level until the release
  const last = out[out.length - 1];
  if (last && at > last[0] + 1e-6) out.push([at, last[1]]);
  return out;
}

// ─── The voice ───────────────────────────────────────────────────────────────

interface Sample {
  buffer: AudioBuffer;
  /** Loop points (s), when the sample has them. */
  loop?: [number, number];
}

interface Sounding {
  src: AudioBufferSourceNode;
  env: GainNode;
  vib: GainNode;
  end: number;
}

/** At most this many notes ring at once (a slur overlaps two; a fast run's tails a few more). */
export const BOWED_VOICES = 4;
/** How fast a voice fades when it's cut (s): long enough never to click. */
const CUT = 0.03;
/** A held (played-along) note sounds at most this long (s) if it's never let go. */
const HOLD_SEC = 30;

export class BowedVoice {
  private lfo: OscillatorNode;
  private sounding: Sounding[] = [];
  constructor(
    private ctx: BaseAudioContext,
    private out: AudioNode,
    private samples: Map<number, Sample>,
  ) {
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = VIBRATO_HZ;
    this.lfo.start();
  }

  private sampleFor(pitch: number): [number, Sample] | null {
    let best: [number, Sample] | null = null;
    for (const [root, s] of this.samples) if (!best || Math.abs(root - pitch) < Math.abs(best[0] - pitch)) best = [root, s];
    return best;
  }

  /**
   * A note held until the returned function lets it go (playing along on the keys): the bow sets
   * in and the note speaks, its vibrato widens in, and letting go is a release, not a cut.
   */
  hold(pitch: number, vel: number, time: number, style: StyleId = "pop"): (at?: number) => void {
    const g = velGain(vel);
    const { vib } = planBow({ time, dur: HOLD_SEC, pitch, vel }, { join: "fresh", prevPitch: null, nextIn: null, nextSlur: false, style });
    const env: [number, number][] = [
      [0, 0],
      [0.07, 0.62 * g],
      [0.17, 0.92 * g],
      [0.4, g],
      [HOLD_SEC, g],
      [HOLD_SEC + 0.2, 0],
    ];
    const s = this.play({ time, pitch, gain: g, env, stop: HOLD_SEC + 0.21, vib, slide: null });
    return (at) => {
      if (s) this.cut(s, Math.max(this.ctx.currentTime, at ?? 0), 0.18);
    };
  }

  play(p: BowPlan): Sounding | null {
    const found = this.sampleFor(p.pitch);
    if (!found) return null;
    const [root, sample] = found;
    const ctx = this.ctx;
    const t = Math.max(p.time, ctx.currentTime);
    // too many ringing: the oldest lets go (quickly, but with a fade)
    this.sounding = this.sounding.filter((s) => s.end > t);
    while (this.sounding.length >= BOWED_VOICES) this.cut(this.sounding.shift()!, t);

    const src = ctx.createBufferSource();
    src.buffer = sample.buffer;
    if (sample.loop && sample.loop[1] > sample.loop[0]) {
      src.loop = true;
      src.loopStart = sample.loop[0];
      src.loopEnd = sample.loop[1];
    }
    const cents = (p.pitch - root) * 100;
    src.detune.setValueAtTime(cents + (p.slide?.from ?? 0), t);
    if (p.slide) src.detune.setTargetAtTime(cents, t + 0.005, p.slide.tau);
    const vib = ctx.createGain();
    vib.gain.setValueAtTime(0, t);
    for (const [at, c] of p.vib) vib.gain.linearRampToValueAtTime(c, t + at);
    this.lfo.connect(vib).connect(src.detune);
    const env = ctx.createGain();
    env.gain.setValueAtTime(p.env[0][1], t);
    for (const [at, v] of p.env.slice(1)) env.gain.linearRampToValueAtTime(v, t + at);
    src.connect(env).connect(this.out);
    src.start(t);
    src.stop(t + p.stop);
    const s: Sounding = { src, env, vib, end: t + p.stop };
    src.onended = () => {
      try {
        src.disconnect();
        env.disconnect();
        vib.disconnect();
        this.lfo.disconnect(vib);
      } catch {
        /* already gone */
      }
      this.sounding = this.sounding.filter((x) => x !== s);
    };
    this.sounding.push(s);
    return s;
  }

  /** Fade a voice out from `at` (never a click), and stop it. */
  private cut(s: Sounding, at: number, fade = CUT) {
    if (s.end <= at) return;
    try {
      const g = s.env.gain as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam };
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(at);
      else {
        g.cancelScheduledValues(at);
        g.setValueAtTime(g.value, at);
      }
      g.linearRampToValueAtTime(0, at + fade);
      s.src.stop(at + fade + 0.005);
      s.end = at + fade;
    } catch {
      /* already stopped */
    }
  }

  /** Every note lets go now (the take stopped, or the player was muted). */
  stopAll(): void {
    const now = this.ctx.currentTime;
    for (const s of this.sounding) this.cut(s, now);
    this.sounding = [];
  }

  dispose(): void {
    this.stopAll();
    try {
      this.lfo.stop();
      this.lfo.disconnect();
    } catch {
      /* already gone */
    }
  }
}

/** The bowed voice behind a smplr instrument (its channel carries the pan, level and reverb). */
const VOICES = new WeakMap<object, BowedVoice>();
export const bowedOf = (inst: object | null | undefined): BowedVoice | undefined => (inst ? VOICES.get(inst) : undefined);
export const setBowed = (inst: object, voice: BowedVoice) => VOICES.set(inst, voice);

// ─── Loading: a MIDI.js soundfont, decoded once ──────────────────────────────

const NOTE = /^([A-G])(b|#)?(-?\d)$/;
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** MIDI number of a MIDI.js note name ("Bb3" → 58). */
export function noteMidi(name: string): number | null {
  const m = NOTE.exec(name);
  if (!m) return null;
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === "b" ? -1 : m[2] === "#" ? 1 : 0);
}

/** The note → data-URL map in a MIDI.js soundfont file (the same reading smplr does). */
export function parseMidiJs(source: string): Record<string, string> {
  const header = source.indexOf("MIDI.Soundfont.");
  if (header < 0) throw new Error("not a MIDI.js soundfont");
  const start = source.indexOf("=", header) + 2;
  const end = source.lastIndexOf(",");
  return JSON.parse(source.slice(start, end) + "}");
}

function oggOk(): boolean {
  try {
    return typeof document !== "undefined" && document.createElement("audio").canPlayType('audio/ogg; codecs="vorbis"') !== "";
  } catch {
    return false;
  }
}

function base64Buffer(dataUrl: string): ArrayBuffer {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/**
 * Decode a soundfont's notes in [lo, hi] (the gleitz MIDI.js files smplr loads, through the same
 * storage), with the loop points the plain soundfont would use (`loopUrl`; goldst.dev's otherwise).
 */
export async function loadBowedSamples(
  ctx: BaseAudioContext,
  storage: Storage,
  name: string,
  kit: "MusyngKite" | "FluidR3_GM",
  [lo, hi]: [number, number],
  onProgress?: (loaded: number, total: number) => void,
  loopUrl = `https://goldst.dev/midi-js-soundfonts/${kit}/${name}-loop.json`,
): Promise<Map<number, Sample>> {
  const format = oggOk() ? "ogg" : "mp3";
  const res = await storage.fetch(`https://gleitz.github.io/midi-js-soundfonts/${kit}/${name}-${format}.js`);
  if (res.status !== 200) throw new Error(`soundfont ${name} (${res.status})`);
  const notes = Object.entries(parseMidiJs(await res.text()))
    .map(([k, url]) => [noteMidi(k), url] as const)
    .filter((x): x is readonly [number, string] => x[0] !== null && x[0] >= lo - 2 && x[0] <= hi + 2);
  let loops: Record<string, [number, number]> = {};
  try {
    const l = await fetch(loopUrl);
    if (l.ok) loops = await l.json();
  } catch {
    /* no loop points: notes hold as long as the samples do */
  }
  const out = new Map<number, Sample>();
  let done = 0;
  onProgress?.(0, notes.length);
  await Promise.all(
    notes.map(async ([midi, url]) => {
      try {
        const buffer = await ctx.decodeAudioData(base64Buffer(url));
        const name = Object.keys(loops).find((k) => noteMidi(k) === midi);
        const lp = name ? loops[name] : undefined;
        out.set(midi, { buffer, loop: lp ? [lp[0] / 44100, lp[1] / 44100] : undefined });
      } catch {
        /* that note falls back to its neighbour */
      }
      onProgress?.(++done, notes.length);
    }),
  );
  if (!out.size) throw new Error(`soundfont ${name}: nothing decoded`);
  return out;
}
