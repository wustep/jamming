import { describe, expect, it } from "vitest";
import { defaultMembers, isCymbal } from "@/music/instruments";
import { defaultSettings, generateLocal } from "@/music/local";
import { FrameComputer } from "./frames";

describe("the drummer on stage", () => {
  const band = defaultMembers();
  const score = generateLocal({ ...defaultSettings(band), style: "ambient", seed: 13, bars: 32 }, band).score;
  const frames = new FrameComputer(score);
  const roll = score.parts.owl.find((n) => n.art === "roll")!;

  it("holds soft mallets in an ambient take", () => {
    expect(frames.compute("owl", 1, true, 1).mallets).toBe(true);
  });

  it("plays a cymbal roll as strokes that grow louder up to where it lands", () => {
    expect(roll).toBeDefined();
    const end = roll.start + roll.dur;
    // every cymbal onset the drummer sees from the roll's start to just before it lands
    const seen: { at: number; vel: number }[] = [];
    for (let k = 0; k <= roll.dur * 48; k++) {
      const beat = roll.start + k / 48;
      const r = frames.compute("owl", beat, true, 1).recent[0];
      if (r && isCymbal(r.pitch) && r.age < 1e-6 + 1 / 48 && beat - r.age < end - 0.05 && !seen.some((s) => Math.abs(s.at - (beat - r.age)) < 1e-6)) seen.push({ at: beat - r.age, vel: r.vel });
    }
    expect(seen.length).toBeGreaterThanOrEqual(roll.dur * 4);
    for (let i = 1; i < seen.length; i++) expect(seen[i].vel).toBeGreaterThan(seen[i - 1].vel);
    // the last stroke, just before it lands (give or take the drummer's pocket), at the roll's full touch
    expect(seen[seen.length - 1].vel).toBeCloseTo(roll.vel, 5);
    expect(end - seen[seen.length - 1].at).toBeLessThan(0.3);
  });
});
