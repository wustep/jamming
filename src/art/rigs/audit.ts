import { applyFeel, pocketOf } from "@/audio/feel";
import { DRUM } from "@/music/instruments";
import type { InstrumentId, StyleId } from "@/music/types";
import { type Mat, type Pt, ap, chain } from "../affine";
import { clarinet, tromboneSlide, trumpetValves, woodwind } from "../fingering";
import { type Glitch, SHAKE_WINDOW, flicker, glitchesOf, shake } from "../glitch";
import { Motion } from "../motion";
import { RIGS } from ".";
import { KEY_TOP, keyX } from "./piano";
import { LOWER_TOP, ORGAN_SPLIT, UPPER_TOP, organKeyX } from "./organ";
import { PAD_KEY_TOP, padKeyX } from "./pad";
import { STOP_AT } from "./strings";
import { rigTake } from "./take";
import { barX } from "./vibes";
import { Bag, type Frame, type RigCtx } from "./types";

// A musician played frame by frame (60 fps) through a real take, the way the stage plays it, and
// everything that would look wrong on screen, with the beat it happens on:
//
//   the arms: crossed, a paw teleporting, out of reach, laid across the chest (glitch.ts);
//   jitter: a paw shaking back and forth from frame to frame;
//   pop: the instrument, or what's in the paws (a bow, sticks, mallets), jumping in one frame;
//   clip: a paw or what it holds leaving the sprite's frame;
//   miss: the note sounds with no paw on its key or at its stop, or the valves, keys or slide
//         showing another note's fingering;
//   late: a keyboard paw that isn't down in the keys when its note sounds;
//   detached: a stick, a mallet or the bow's frog drawn away from the paw that holds it.
//
// The art lab steps to these; the rig tests hold every instrument to none.

export type AuditKind = Glitch | "jitter" | "pop" | "clip" | "miss" | "late" | "detached";

export interface AuditIssue {
  kind: AuditKind;
  beat: number;
  detail: string;
}

const FPS = 60;
/** The sprite's frame: a paw or what it holds drawn outside this is cut off on the stage. */
export const FRAME_BOX = { x0: -14, y0: -12, x1: 254, y1: 262 };
/** The instrument moving or turning this much in one frame is a pop, not a motion. */
export const POP_PX = 9;
export const POP_DEG = 9;
/** What's held (a stick tip, a bow end) moving this much farther than the paw in one frame snapped round. */
export const HELD_POP_PX = 24;
/** A stick, mallet or bow frog farther than this from its paw has come out of its grip. */
export const GRIP_PX = 8;

type Attrs = Record<string, Record<string, string>>;

function recordingBag() {
  const bag = new Bag();
  const store: Attrs = {};
  bag.el = new Proxy({} as Record<string, SVGElement | null>, {
    get: (_t, k: string) => {
      store[k] ??= {};
      return { setAttribute: (n: string, v: string) => (store[k][n] = v), style: {} } as unknown as SVGElement;
    },
  });
  return { bag, store };
}

/** An SVG transform attribute as a matrix ("matrix(…)", "translate(x y)" and plain rotations). */
export function parseTransform(s: string | undefined): Mat {
  if (!s) return [1, 0, 0, 1, 0, 0];
  const m = /matrix\(([^)]+)\)/.exec(s);
  if (m) return m[1].split(/[\s,]+/).map(Number) as Mat;
  const t = /translate\(([-\d.]+)[\s,]+([-\d.]+)\)/.exec(s);
  if (t) return [1, 0, 0, 1, +t[1], +t[2]];
  return [1, 0, 0, 1, 0, 0];
}

const angleOf = (m: Mat) => (Math.atan2(m[1], m[0]) * 180) / Math.PI;

interface Rec {
  t: number;
  beat: number;
  hands: Record<"L" | "R", Pt>;
  spread: Record<"L" | "R", number>;
  shoulders: Record<"L" | "R", Pt>;
  /** The instrument's world matrix (the body's follow matrix × its own placement). */
  W: Mat;
  attrs: Attrs;
  held: Pt[];
  /** What was sounding and coming up (for tracing a frame). */
  sounding: number[];
  coming: string[];
  /** The rig's own memory after the frame (for tracing). */
  mem?: Record<string, number>;
}

/** Points of what's held, in world coordinates: bow ends, stick tips, mallet heads. */
function heldPoints(a: Attrs): Pt[] {
  const out: Pt[] = [];
  const line = (k: string) => {
    const l = a[k];
    if (l?.x1 !== undefined) out.push({ x: +l.x1, y: +l.y1 }, { x: +l.x2, y: +l.y2 });
  };
  for (const k of ["hair", "stick", "mL0", "mL1", "mR0", "mR1"]) line(k);
  for (const k of ["tipL", "tipR"]) if (a[k]?.cx !== undefined) out.push({ x: +a[k].cx, y: +a[k].cy });
  return out;
}

export function auditTake(inst: InstrumentId, style: StyleId, opts: { seed?: number; solo?: boolean; tempo?: number; frames?: boolean } = {}) {
  const { score, id, spb, beats, frames: fc } = rigTake(inst, style, { seed: opts.seed ?? 3, solo: opts.solo, tempo: opts.tempo });
  const pocket = pocketOf(score, id);
  const onsets = [...score.parts[id]]
    .map((n) => ({ t: applyFeel(n.start, score.swing) * spb + pocket(n), pitch: n.pitch, dur: n.dur * spb, art: n.art }))
    .sort((a, b) => a.t - b.t);
  const { bag, store } = recordingBag();
  const ctx: RigCtx = { bag, animal: "cat", ink: "#000", fill: "#fff", light: "#fff", feet: "#000", seed: 1, mouth: { x: 120, y: 133 }, mem: {} };
  const rig = RIGS[inst];
  const motion = new Motion({ follow: rig.follow, seated: !!rig.seated, ears: null, tail: null, seed: 7 });
  let hands: Frame["arms"] = { L: { hand: { x: 100, y: 205 } }, R: { hand: { x: 140, y: 205 } } };
  const recs: Rec[] = [];
  const end = beats * spb;
  for (let i = 0; i / FPS < end; i++) {
    const t = i / FPS + 0.004;
    const prev = { L: { ...hands.L.hand }, R: { ...hands.R.hand } };
    const s = fc.compute(id, t / spb, true, spb);
    const pose = motion.pose(s, t, 1 / FPS);
    const f: Frame = { s, t, dt: 1 / FPS, M: pose.M, arms: { L: { hand: { ...prev.L } }, R: { hand: { ...prev.R } } }, look: { mouthCovered: false, cheeks: 0, inhale: 0, bliss: false, lean: 0, dip: 0 } };
    rig.update(ctx, f);
    motion.settle(f.look, 1 / FPS);
    hands = { L: { ...f.arms.L }, R: { ...f.arms.R } };
    const attrs: Attrs = JSON.parse(JSON.stringify(store));
    recs.push({
      t,
      beat: t / spb,
      hands: { L: { ...f.arms.L.hand }, R: { ...f.arms.R.hand } },
      spread: { L: f.arms.L.spread ?? 1, R: f.arms.R.spread ?? 1 },
      shoulders: pose.shoulders,
      W: chain(pose.M, parseTransform(attrs.inst?.transform)),
      attrs,
      held: heldPoints(attrs),
      sounding: s.active.map((n) => n.pitch),
      coming: (s.upcoming ?? []).slice(0, 4).map((u) => `${u.pitch}@${u.inSec.toFixed(2)}`),
      ...(opts.frames ? { mem: { ...ctx.mem } } : {}),
    });
  }
  const issues: AuditIssue[] = [];
  const at = (beat: number, kind: AuditKind, detail: string) => issues.push({ kind, beat: +beat.toFixed(2), detail });

  // ── frame by frame (the first frames settle from the default pose) ──
  for (let i = 6; i < recs.length; i++) {
    const r = recs[i];
    const p = recs[i - 1];
    for (const g of glitchesOf(r.hands, p.hands, r.shoulders)) at(r.beat, g, "");
    // jitter and flicker (glitch.ts), unless the paw is following a run of notes: changing
    // direction with them is playing
    const notesInWindow = onsets.filter((o) => o.t > recs[i - SHAKE_WINDOW].t - 0.05 && o.t <= r.t + 0.05).length;
    if (i >= SHAKE_WINDOW + 1 && notesInWindow < 2) {
      for (const k of ["L", "R"] as const) {
        const path = recs.slice(i - SHAKE_WINDOW, i + 1).map((q) => q.hands[k]);
        const sh = shake(path);
        if (sh) at(r.beat, "jitter", `${k} paw: ${sh.flips} reversals in ${SHAKE_WINDOW} frames, ${sh.mean.toFixed(1)}px a frame`);
        const fl = flicker(path.slice(-4));
        if (fl) at(r.beat, "jitter", `${k} paw darted ${fl.toFixed(1)}px sideways and back`);
      }
    }
    // pop: the instrument jumps or snaps round; what's held jumps
    const dW = Math.hypot(r.W[4] - p.W[4], r.W[5] - p.W[5]);
    let dA = Math.abs(angleOf(r.W) - angleOf(p.W));
    if (dA > 180) dA = 360 - dA;
    if (dW > POP_PX || dA > POP_DEG) at(r.beat, "pop", `instrument moved ${dW.toFixed(1)}px / turned ${dA.toFixed(1)}° in a frame`);
    // what's held pops when it moves far more than the paw holding it (it snapped round), not
    // when it's carried fast
    const pawMove = Math.max(Math.hypot(r.hands.L.x - p.hands.L.x, r.hands.L.y - p.hands.L.y), Math.hypot(r.hands.R.x - p.hands.R.x, r.hands.R.y - p.hands.R.y));
    for (let j = 0; j < Math.min(r.held.length, p.held.length); j++) {
      const d = Math.hypot(r.held[j].x - p.held[j].x, r.held[j].y - p.held[j].y);
      if (d - pawMove > HELD_POP_PX) at(r.beat, "pop", `held point ${j} jumped ${d.toFixed(1)}px (the paw ${pawMove.toFixed(1)}px)`);
    }
    // detached: what's held comes away from the paw holding it
    const grips: [string, "L" | "R"][] =
      inst === "drums" ? [["stickL", "L"], ["stickR", "R"]] : inst === "vibes" ? [["mL0", "L"], ["mL1", "L"], ["mR0", "R"], ["mR1", "R"]] : inst === "violin" || inst === "cello" ? [["hair", "L"]] : [];
    for (const [key, k] of grips) {
      const a = r.attrs[key];
      if (a?.x1 === undefined) continue;
      const d = Math.hypot(+a.x1 - r.hands[k].x, +a.y1 - r.hands[k].y);
      if (d > GRIP_PX) at(r.beat, "detached", `${key} ${d.toFixed(0)}px from the ${k} paw`);
    }
    // clip: out of the sprite's frame
    for (const q of [r.hands.L, r.hands.R, ...r.held])
      if (q.x < FRAME_BOX.x0 || q.x > FRAME_BOX.x1 || q.y < FRAME_BOX.y0 || q.y > FRAME_BOX.y1) {
        at(r.beat, "clip", `(${q.x.toFixed(0)}, ${q.y.toFixed(0)}) outside the sprite`);
        break;
      }
  }

  // ── each note against what's on screen when it sounds (one frame of smoothing allowed) ──
  const frameAt = (t: number) => recs[Math.max(0, Math.min(recs.length - 1, Math.ceil((t - 0.004) * FPS) + 1))];
  const groups: (typeof onsets)[] = [];
  for (const o of onsets) {
    const g = groups.at(-1);
    if (g && Math.abs(g[0].t - o.t) < 0.02) g.push(o);
    else groups.push([o]);
  }
  const keyboard =
    inst === "piano" ? { x: keyX, top: () => KEY_TOP } : inst === "organ" ? { x: organKeyX, top: (p: number) => (p >= ORGAN_SPLIT ? UPPER_TOP : LOWER_TOP) } : inst === "pad" ? { x: padKeyX, top: () => PAD_KEY_TOP } : null;
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const r = frameAt(g[0].t);
    // the first half second: a take started cold (no count-in) has a horn still coming up
    if (r.t < 0.5) continue;
    const beat = r.beat;
    const name = g.map((o) => o.pitch).join("+");
    if (keyboard) {
      // every key of the chord is under a paw, and that paw is down in the keys
      // a paw reaches about 16px either side of its centre, more for a chord it has to spread over
      const xs = g.map((o) => keyboard.x(o.pitch));
      const reach = Math.min(34, Math.max(16, (Math.max(...xs) - Math.min(...xs)) / 2 + 8));
      for (const o of g) {
        const x = keyboard.x(o.pitch);
        const near = (["L", "R"] as const).filter((k) => Math.abs(r.hands[k].x - x) <= Math.max(reach, 16 + 8 * (r.spread[k] - 1)));
        if (!near.length) at(beat, "miss", `${o.pitch} at x=${x.toFixed(0)}, paws at ${r.hands.L.x.toFixed(0)} and ${r.hands.R.x.toFixed(0)}`);
        else if (!near.some((k) => r.hands[k].y >= keyboard.top(o.pitch) - 1)) at(beat, "late", `${o.pitch}: the paw over it is still up (y=${Math.max(...near.map((k) => r.hands[k].y)).toFixed(0)})`);
      }
    } else if (inst === "vibes") {
      // struck on the onset frame (in a fast line the mallet is already rebounding a frame later)
      const struck = frameAt(g[0].t - 1 / FPS);
      for (const o of g)
        if (![r, struck].some((q) => ["L0", "L1", "R1", "R0"].some((k) => q.attrs["m" + k] && Math.abs(+q.attrs["m" + k].x2 - barX(o.pitch)) < 8))) at(beat, "miss", `${o.pitch}: no mallet on its bar`);
    } else if (inst === "trumpet") {
      const o = g[0];
      const want = trumpetValves(o.pitch);
      const got = [0, 1, 2].map((i) => parseTransform(r.attrs["v" + i]?.transform)[5] > 2);
      if (want.some((w, i) => w !== got[i])) at(beat, "miss", `${o.pitch}: valves ${got.map(Number).join("")} for ${want.map(Number).join("")}`);
    } else if (inst === "sax" || inst === "clarinet" || inst === "flute") {
      const o = g[0];
      const fg = inst === "sax" ? woodwind(o.pitch + 14, 74) : inst === "clarinet" ? clarinet(o.pitch + 2) : woodwind(o.pitch, 74);
      const got = [0, 1, 2, 3, 4, 5].map((i) => r.attrs["k" + i]?.fill);
      const pearl = got.filter((x) => x === "#fffaf0").length;
      const want = fg.holes.filter((h) => !h).length;
      if (pearl !== want) at(beat, "miss", `${o.pitch}: ${6 - pearl} keys closed for ${6 - want}`);
    } else if (inst === "trombone") {
      const o = g[0];
      const want = (tromboneSlide(o.pitch) - 1) * 8.5;
      const got = parseTransform(r.attrs.slide?.transform)[4];
      // more than two positions in under 0.12 s is past any player (54 to 53 is fifth to first,
      // and 54 has no other position): the slide gets there as fast as it can
      const prev = groups[gi - 1]?.[0];
      const impossible = !!prev && o.t - prev.t < 0.12 && Math.abs(tromboneSlide(o.pitch) - tromboneSlide(prev.pitch)) > 2;
      if (!impossible && Math.abs(got - want) > 3) at(beat, "miss", `${o.pitch}: slide at ${got.toFixed(1)} for position ${tromboneSlide(o.pitch)} (${want.toFixed(1)})`);
    } else if (inst === "violin" || inst === "cello" || inst === "bass" || (inst === "guitar" && g.length === 1)) {
      // the stopping paw is at the note's stop (a double-stop sits between two; skip those)
      if (g.length > 1 || g[0].art === "pizz" && inst !== "bass") continue;
      const local = STOP_AT[inst](g[0].pitch);
      if (!local) continue;
      const want = ap(r.W, local.x, local.y);
      const paw = inst === "violin" || inst === "cello" ? r.hands.R : r.hands.R;
      const d = Math.hypot(paw.x - want.x, paw.y - want.y);
      if (d > 9) at(beat, "miss", `${name}: stopping paw ${d.toFixed(0)}px from the stop`);
    } else if (inst === "drums") {
      // the stick tests in rigs.test.ts already hold every hit to its drum
      void DRUM;
    }
  }
  return { issues, frames: opts.frames ? recs : undefined, onsets };
}

/** One line per kind: how many, and the first few beats. */
export function summarize(issues: AuditIssue[]): string[] {
  const by = new Map<AuditKind, AuditIssue[]>();
  for (const i of issues) by.set(i.kind, [...(by.get(i.kind) ?? []), i]);
  return [...by].map(([k, v]) => `${k} ×${v.length}: ${v.slice(0, 3).map((i) => `@${i.beat} ${i.detail}`).join("; ")}`);
}
