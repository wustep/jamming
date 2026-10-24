import { describe, expect, it } from "vitest";
import { phraseArc } from "@/music/bowing";
import type { PresetId } from "@/music/presets";
import type { StyleId } from "@/music/types";
import { auditTake, summarize } from "./audit";
import { rigTake } from "./take";

// The violinist bows the way the line is bowed (bowing.ts): one stroke per slur, the bow going
// one way through it, and the body moving with the phrase rather than the clock.

const CASES: [string, StyleId, PresetId | undefined, boolean][] = [
  ["bach", "baroque", "bach", false],
  ["hisaishi", "pop", "hisaishi", false],
  ["swing solo", "swing", undefined, true],
  ["ambient solo", "ambient", undefined, true],
];

function play(style: StyleId, preset: PresetId | undefined, solo: boolean) {
  const { frames, onsets, issues } = auditTake("violin", style, { frames: true, preset, solo, seed: 3 });
  const take = rigTake("violin", style, { seed: 3, solo, preset });
  return { recs: frames!, onsets, issues, take };
}

describe("the violinist's bow", () => {
  it("changes direction once a stroke, not on every note", () => {
    for (const [label, style, preset, solo] of CASES) {
      const { recs, onsets, issues } = play(style, preset, solo);
      expect(summarize(issues), label).toEqual([]);
      let reversals = 0;
      let dir = 0;
      const offStroke: number[] = [];
      for (let i = 1; i < recs.length; i++) {
        const d = recs[i].mem!.bs - recs[i - 1].mem!.bs;
        if (Math.abs(d) < 1e-4) continue;
        if (dir && Math.sign(d) !== dir) {
          reversals++;
          // a reversal comes with a new stroke (or while the bow is off the string, being set for one)
          const recent = recs.slice(Math.max(0, i - 3), i + 1);
          const newStroke = recent.some((r, k) => k > 0 && r.mem!.strokeId !== recent[k - 1].mem!.strokeId);
          if (!newStroke && (recs[i].mem!.lift ?? 0) < 0.3) offStroke.push(+recs[i].beat.toFixed(2));
        }
        dir = Math.sign(d);
      }
      const arco = onsets.filter((o) => o.art !== "pizz").length;
      // it used to be ~0.97: a new bow for every note, sawing back and forth through a run
      expect(reversals / arco, label).toBeLessThan(label === "bach" ? 0.5 : 0.85);
      expect(offStroke, label).toEqual([]);
    }
  }, 120_000);

  it("keeps the frog in the paw, the arms their length and every stop under its finger", () => {
    // (the audit: reach, detached, miss, pop, shake...) across tempos where a run is fast
    for (const tempo of [72, 120, 160]) {
      const { issues } = auditTake("violin", "baroque", { seed: 7, solo: true, tempo });
      expect(summarize(issues), `baroque ${tempo}`).toEqual([]);
    }
  }, 120_000);
});

describe("the violinist's body", () => {
  it("lifts the scroll toward the top of a phrase and settles as it ends", () => {
    for (const [label, style, preset, solo] of CASES) {
      const { recs, take } = play(style, preset, solo);
      let peak = 0;
      let nPeak = 0;
      let edge = 0;
      let nEdge = 0;
      for (const r of recs) {
        const ph = take.frames.compute(take.id, r.beat, true, take.spb).phrase;
        if (!ph || ph.durSec < 2) continue;
        const arc = phraseArc(ph.progress, ph.peak);
        const angle = (Math.atan2(r.W[1], r.W[0]) * 180) / Math.PI;
        if (arc > 0.85) {
          peak += angle;
          nPeak++;
        } else if (arc < 0.15) {
          edge += angle;
          nEdge++;
        }
      }
      expect(nPeak, label).toBeGreaterThan(30);
      // (rotation is clockwise-positive on screen: a lifted scroll turns the other way)
      expect(peak / nPeak, label).toBeLessThan(edge / nEdge - 0.8);
    }
  }, 120_000);
});
