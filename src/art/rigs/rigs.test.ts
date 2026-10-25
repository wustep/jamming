import { describe, expect, it } from "vitest";
import { applyFeel, pocketOf } from "@/audio/feel";
import { DRUM, INSTRUMENT_LIST } from "@/music/instruments";
import { PRESETS } from "@/music/presets";
import { STYLES } from "@/music/styles";
import type { InstrumentId, StyleId } from "@/music/types";
import { acrossBy, glitchesOf } from "../glitch";
import { Motion } from "../motion";
import { RIGS } from ".";
import { rigTake } from "./take";
import { auditTake, summarize } from "./audit";
import { barX } from "./vibes";
import { Bag, type Frame, type RigCtx, armOf } from "./types";

// Drive a rig frame by frame (60 fps) through a real take, the way the stage does, and
// record what it draws. Then check each onset against what's on screen at that moment.

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

const FPS = 60;

function perform(inst: InstrumentId, style: StyleId, seed = 3, solo = false, record = true, tempo?: number) {
  const { score, id, spb, beats, frames: fc } = rigTake(inst, style, { seed, solo, tempo });
  const pocket = pocketOf(score, id);
  // heard time: swing plus the player's pocket, as the audio engine schedules it
  const onsets = [...score.parts[id]].map((n) => ({ t: applyFeel(n.start, score.swing) * spb + pocket(n), pitch: n.pitch })).sort((a, b) => a.t - b.t);
  const { bag, store } = recordingBag();
  // the mouth sits at y 130–141 across the cast
  const ctx: RigCtx = { bag, animal: "cat", ink: "#000", fill: "#fff", light: "#fff", feet: "#000", seed: 1, mouth: { x: 120, y: 133 }, mem: {} };
  const end = beats * spb;
  const frames: Attrs[] = [];
  const glitches: { beat: number; kinds: string[] }[] = [];
  // the biggest change of a paw's velocity from one frame to the next (px/frame)
  let snap = { px: 0, beat: 0 };
  const vel = { L: { x: 0, y: 0 }, R: { x: 0, y: 0 } };
  // the body moves as on stage (lean, slide, bounce), and the arms start where its shoulders are
  const motion = new Motion({ follow: RIGS[inst].follow, seated: !!RIGS[inst].seated, ears: null, tail: null, seed: 7 });
  let hands: Frame["arms"] = { L: { hand: { x: 80, y: 190 } }, R: { hand: { x: 160, y: 190 } } };
  for (let i = 0; i * (1 / FPS) < end; i++) {
    const t = i / FPS + 0.004;
    const prev = { L: { ...hands.L.hand }, R: { ...hands.R.hand } };
    const s = fc.compute(id, t / spb, true, spb);
    const pose = motion.pose(s, t, 1 / FPS);
    const f: Frame = { s, t, dt: 1 / FPS, M: pose.M, arms: { L: { hand: { ...prev.L } }, R: { hand: { ...prev.R } } }, shoulders: pose.shoulders, reach: armOf(RIGS[inst]).reach, look: { mouthCovered: false, cheeks: 0, inhale: 0, bliss: false, lean: 0, dip: 0 } };
    RIGS[inst].update(ctx, f);
    motion.settle(f.look, 1 / FPS);
    // the first frames settle from the default pose
    const kinds = i > 5 ? glitchesOf({ L: f.arms.L.hand, R: f.arms.R.hand }, prev, pose.shoulders, f.reach) : [];
    if (kinds.length) glitches.push({ beat: +(t / spb).toFixed(2), kinds });
    for (const k of ["L", "R"] as const) {
      const v = { x: f.arms[k].hand.x - prev[k].x, y: f.arms[k].hand.y - prev[k].y };
      const dv = Math.hypot(v.x - vel[k].x, v.y - vel[k].y);
      if (i > 10 && dv > snap.px) snap = { px: dv, beat: +(t / spb).toFixed(2) };
      vel[k] = v;
    }
    hands = { L: { ...f.arms.L }, R: { ...f.arms.R } };
    if (record) frames.push(JSON.parse(JSON.stringify(store)));
  }
  /** First frame drawn at or after time t. */
  const frameAt = (t: number) => frames[Math.max(0, Math.min(frames.length - 1, Math.ceil((t - 0.004) * FPS)))];
  return { onsets, frameAt, glitches, snap };
}

// where each drum is struck (see drums.tsx)
const STRIKE: Record<string, { x: number; y: number }> = {
  hat: { x: 54, y: 147 },
  crash: { x: 62, y: 100 },
  tom: { x: 104, y: 158 },
  ride: { x: 188, y: 135 },
  snare: { x: 150, y: 186 },
  floor: { x: 204, y: 206 },
};
function drumOf(p: number) {
  if (p === DRUM.floorTom || p === DRUM.lowTom) return "floor";
  if (p === DRUM.snare || p === DRUM.stick || p === DRUM.clap) return "snare";
  if (p === DRUM.hatClosed || p === DRUM.hatOpen) return "hat";
  if (p === DRUM.ride || p === DRUM.rideBell) return "ride";
  if (p === DRUM.crash) return "crash";
  return "tom";
}

describe("rigs follow the notes frame by frame", () => {
  it("a stick tip is on the drum at every stick hit", () => {
    for (const style of ["swing", "funk", "bossa", "neworleans"] as StyleId[]) {
      const { onsets, frameAt } = perform("drums", style);
      const hits = onsets.filter((o) => o.pitch !== DRUM.kick && o.pitch !== DRUM.hatPedal);
      const on = hits.filter((o) => {
        const fr = frameAt(o.t);
        const at = STRIKE[drumOf(o.pitch)];
        return ["L", "R"].some((a) => Math.hypot(+fr["tip" + a].cx - at.x, +fr["tip" + a].cy - at.y) < 12);
      });
      expect(on.length / hits.length, style).toBeGreaterThan(0.98);
    }
  });

  it("a vibes mallet is on the bar at every note, chords included", () => {
    for (const style of ["swing", "bossa", "minimal"] as StyleId[]) {
      const { onsets, frameAt } = perform("vibes", style);
      const on = onsets.filter((o) => {
        const fr = frameAt(o.t);
        return ["L0", "L1", "R1", "R0"].some((k) => Math.abs(+fr["m" + k].x2 - barX(o.pitch)) < 8);
      });
      expect(on.length / onsets.length, style).toBeGreaterThan(0.98);
    }
  });

  it("nothing looks wrong, for any instrument, soloing or comping: arms, shakes, pops, clipping, and every note under its paw", () => {
    // what the art lab's "next glitch" stops on (audit.ts). Found by it, and fixed: drums crossed
    // reaching for a hat under a crash, and again when a ghost snare took the ride's arm; the bow
    // jumped to the other end for a long note, and swung through the floor on every pizz; the
    // clarinet's lower hand reached across; the bassist's hand stretched over its head for the
    // nut; stick tips snapped round between drums; a keyboard paw flickered between an old key
    // and a new one, and slid off the keyboard when it stopped mid-glide; horns and strings
    // jolted at every breath; stopping paws, the slide and the bass shifted only after the note
    const found: string[] = [];
    const runs: [StyleId, number | undefined, number][] = [
      ["swing", undefined, 3],
      ["swing", undefined, 7],
      ["swing", STYLES.swing.tempo.max, 3],
      ["swing", STYLES.swing.tempo.min, 3],
      ["funk", undefined, 3],
      ["bossa", undefined, 3],
      ["baroque", undefined, 3],
      ["minimal", undefined, 3],
      ["ambient", STYLES.ambient.tempo.min, 3],
    ];
    for (const inst of INSTRUMENT_LIST)
      for (const [style, tempo, seed] of runs)
        for (const solo of [false, true]) {
          const { issues, onsets } = auditTake(inst, style, { seed, solo, tempo });
          // a mallet can miss a bar in a fast run, as the vibes test allows; nothing else may happen
          const misses = issues.filter((i) => i.kind === "miss");
          const shown = issues.filter((i) => i.kind !== "miss" || misses.length > onsets.length * 0.02);
          if (shown.length) found.push(`${inst} ${style}${tempo ? ` ${tempo}` : ""} seed ${seed}${solo ? " solo" : ""}: ${summarize(shown).join(" | ")}`);
        }
    expect(found).toEqual([]);
  }, 600_000);

  it("every artist preset's band passes the audit in its own takes", () => {
    // a preset seats players in parts the default band never gives them: Elijah Fox's cello on the
    // bass line, Ray Charles's organ leading, Zimmer's trombone in a low pad
    const found: string[] = [];
    for (const p of PRESETS)
      for (const b of p.band)
        for (const seed of [3, 7]) {
          const { issues, onsets } = auditTake(b.instrument, p.style, { seed, preset: p.id });
          const misses = issues.filter((i) => i.kind === "miss");
          const shown = issues.filter((i) => i.kind !== "miss" || misses.length > onsets.length * 0.02);
          if (shown.length) found.push(`${p.id} ${b.instrument} seed ${seed}: ${summarize(shown).join(" | ")}`);
        }
    expect(found).toEqual([]);
  }, 600_000);

  it("paws ease into and out of their moves rather than snapping to full speed", () => {
    // an exponential ease starts at full speed: a hand leapt 15–21 px in the first frame of a
    // shift. A stick or mallet really does reverse at the head, so drums and vibes get more room.
    const LIMIT: Partial<Record<InstrumentId, number>> = { drums: 24, vibes: 20 };
    const found: string[] = [];
    for (const inst of INSTRUMENT_LIST)
      for (const style of ["swing", "funk", "baroque", "ambient"] as StyleId[])
        for (const solo of [false, true]) {
          const { snap } = perform(inst, style, 3, solo, false);
          if (snap.px > (LIMIT[inst] ?? 14)) found.push(`${inst} ${style}${solo ? " solo" : ""}: ${snap.px.toFixed(1)} px/frame @${snap.beat}`);
        }
    expect(found).toEqual([]);
  }, 120_000);
});

describe("arms play the way players hold their instruments", () => {
  /** A take played frame by frame through the audit, with the frame drawn when a time sounds. */
  const take = (inst: InstrumentId, style: StyleId) => {
    const { frames, onsets } = auditTake(inst, style, { seed: 3, frames: true });
    const recs = frames!;
    return { recs, onsets, at: (t: number) => recs[Math.max(0, Math.min(recs.length - 1, Math.ceil((t - 0.004) * FPS)))] };
  };
  const turn = (a: number) => Math.abs(((((a * 180) / Math.PI + 540) % 360) - 180));

  it("a drumstick carries on the line of the forearm that swings it", () => {
    // the paw sat beside the drum with its forearm pointing away and the stick bent back across
    // it (a wrist turned 110–140°); the elbow now sits behind the paw, along the stick
    for (const style of ["swing", "funk", "bossa", "neworleans"] as StyleId[]) {
      const { onsets, at } = take("drums", style);
      const hits = onsets.filter((o) => o.pitch !== DRUM.kick && o.pitch !== DRUM.hatPedal);
      const bent: string[] = [];
      for (const o of hits) {
        const r = at(o.t);
        for (const side of ["L", "R"] as const) {
          const h = r.hands[side];
          const e = r.elbows[side];
          const s = r.attrs["stick" + side];
          const wrist = turn(Math.atan2(+s.y2 - h.y, +s.x2 - h.x) - Math.atan2(h.y - e.y, h.x - e.x));
          if (wrist > 65) bent.push(`${side} ${wrist.toFixed(0)}° @${r.beat.toFixed(2)}`);
        }
      }
      expect(bent.length / (hits.length * 2), `${style}: ${bent.slice(0, 4).join(", ")}`).toBeLessThan(0.03);
    }
  });

  it("a tenor hangs at the player's right: left hand on the upper stack, right on the lower, no arm across the chest", () => {
    for (const style of ["swing", "funk", "bossa"] as StyleId[]) {
      const { recs } = take("sax", style);
      const wrong: string[] = [];
      for (const r of recs.slice(30)) {
        if (!r.sounding.length) continue;
        // the viewer-right arm is the player's left: it's on the upper stack, above the other paw
        if (r.hands.R.y > r.hands.L.y - 20) wrong.push(`paws level @${r.beat.toFixed(2)}`);
        // the horn hangs at the viewer-left, both paws on that side of the far shoulder
        if (r.hands.L.x > r.hands.R.x) wrong.push(`lower paw right of the upper @${r.beat.toFixed(2)}`);
        if (Math.max(acrossBy("L", r.hands.L, r.shoulders), acrossBy("R", r.hands.R, r.shoulders)) > 0) wrong.push(`across the chest @${r.beat.toFixed(2)}`);
      }
      expect(wrong.slice(0, 4), style).toEqual([]);
    }
  });

  it("a bassist's finger pulls each note across the string and swings back", () => {
    // it nudged down and out a few px and back, which read as a twitch rather than a pluck
    for (const style of ["swing", "funk", "bossa"] as StyleId[]) {
      const { onsets, at } = take("bass", style);
      const spaced = onsets.filter((o, i) => i > 0 && o.t - onsets[i - 1].t > 0.15 && o.t > 1);
      const pulled = spaced.filter((o) => {
        // where the finger set on the string, and how far it pulled through (a player's pocket
        // moves the drawn pluck a little off the heard onset)
        const paws = Array.from({ length: 14 }, (_, i) => at(o.t - 0.1 + i / FPS).hands.L);
        const set = paws.slice(0, 7).reduce((a, b) => (b.x < a.x ? b : a));
        const through = paws.slice(4).reduce((a, b) => (b.x > a.x ? b : a));
        // across the strings toward E (viewer-right), not along them
        return through.x - set.x > 6 && Math.abs(through.y - set.y) < through.x - set.x;
      });
      expect(pulled.length / spaced.length, style).toBeGreaterThan(0.9);
    }
  });
});
