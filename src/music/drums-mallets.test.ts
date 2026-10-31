import { describe, expect, it } from "vitest";
import { DRUM, defaultMembers, isCymbal } from "./instruments";
import { defaultSettings, generateLocal } from "./local";
import { STYLES } from "./styles";
import type { Member, NoteEvent, Score, StyleId } from "./types";

const quartet: Member[] = defaultMembers();
const take = (style: StyleId, seed: number, bars = 16): Score => generateLocal({ ...defaultSettings(quartet), style, bars, seed, tempo: STYLES[style].tempo.default }, quartet).score;
const drumsOf = (score: Score): NoteEvent[] => score.parts[score.members.find((m) => m.instrument === "drums")!.id];

describe("an ambient drummer", () => {
  const takes = [11, 12, 13, 14, 15, 16, 17, 18].flatMap((seed) => [take("ambient", seed), take("ambient", seed, 32)]);

  it("plays soft mallets: cymbal blooms and swells and a low tom, never time", () => {
    expect(STYLES.ambient.mallets).toBe(true);
    for (const score of takes) {
      const pieces = new Set(drumsOf(score).map((n) => n.pitch));
      for (const p of pieces) expect([DRUM.crash, DRUM.floorTom], `pitch ${p}`).toContain(p);
    }
  });

  it("rolls on a cymbal up to a bar line, and the swell's peak is that bar's bloom (nothing else there)", () => {
    let rolls = 0;
    for (const score of takes) {
      const beats = score.frame.meter.beats;
      const drums = drumsOf(score);
      for (const r of drums.filter((n) => n.art === "roll")) {
        rolls++;
        expect(isCymbal(r.pitch)).toBe(true);
        const lands = r.start + r.dur;
        // a roll lands on a bar line (or, in the last bar, on the cut-off)
        if (lands <= score.frame.bars * beats) expect(lands % beats).toBeCloseTo(0, 6);
        expect(drums.filter((n) => isCymbal(n.pitch) && Math.abs(n.start - lands) < 1e-6)).toEqual([]);
      }
    }
    expect(rolls).toBeGreaterThan(takes.length);
  });

  it("is heard: every cymbal is struck at a touch the kit sounds, not a tick under the band", () => {
    for (const score of takes) {
      const cymbals = drumsOf(score).filter((n) => isCymbal(n.pitch));
      expect(cymbals.length).toBeGreaterThan(0);
      // (they were written at 0.05 to 0.18, which the kit plays 40 dB under the band)
      for (const n of cymbals) expect(n.vel, `${score.id} beat ${n.start}`).toBeGreaterThanOrEqual(0.25);
    }
  });
});

describe("a big band ending", () => {
  it("rolls on the cymbal under the held chord all the way to the cut-off", () => {
    for (const style of ["swing", "pop", "neworleans"] as StyleId[]) {
      for (const seed of [21, 22, 23]) {
        const score = take(style, seed);
        const beats = score.frame.meter.beats;
        const last = (score.frame.bars - 1) * beats;
        const end = drumsOf(score).filter((n) => n.start >= last - 1e-6);
        const crash = end.find((n) => n.pitch === DRUM.crash && n.start === last)!;
        const roll = end.find((n) => n.art === "roll")!;
        expect(roll, `${style} ${seed}`).toBeDefined();
        expect(isCymbal(roll.pitch)).toBe(true);
        // it ends where the held chord (and the crash on it) is let go
        expect(roll.start + roll.dur).toBeCloseTo(crash.start + crash.dur, 6);
        expect(roll.start + roll.dur).toBeGreaterThan(last + beats);
      }
    }
  });
});
