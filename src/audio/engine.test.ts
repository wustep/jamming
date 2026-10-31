import { describe, expect, it } from "vitest";
import { defaultMembers } from "@/music/instruments";
import { defaultSettings, generateLocal } from "@/music/local";
import { notesHintFromScore, TroopAudio, volumeGain } from "./engine";
import { MALLET_KEY, SWELLS } from "./packs";

describe("what a take needs loaded", () => {
  const band = defaultMembers();
  const score = (style: "ambient" | "swing") => generateLocal({ ...defaultSettings(band), style, seed: 5 }, band).score;

  it("includes an ambient drummer's mallets and swells, and nobody else's", () => {
    const hint = notesHintFromScore(score("ambient"));
    expect(hint.owl).toContain(MALLET_KEY[49]);
    expect(hint.owl.some((k) => SWELLS.some((s) => s.key === k))).toBe(true);
    expect(hint.bear.every((n) => n < 100)).toBe(true);
    // a swing drummer plays sticks; the ring ending's roll swells, on only the swells it fits
    const swing = notesHintFromScore(score("swing"));
    expect(swing.owl).not.toContain(MALLET_KEY[49]);
    const swells = swing.owl.filter((k) => SWELLS.some((s) => s.key === k));
    expect(swells.length).toBeGreaterThan(0);
    expect(swells.length).toBeLessThan(SWELLS.length);
  });
});

describe("the volume slider", () => {
  it("follows the ear: full is the whole mix, halfway is −12 dB, the bottom is silence", () => {
    expect(volumeGain(1)).toBe(1);
    expect(20 * Math.log10(volumeGain(0.5))).toBeCloseTo(-12, 0);
    expect(volumeGain(0)).toBe(0);
  });

  it("can be set before there's any sound (it's kept for when there is)", () => {
    const audio = new TroopAudio();
    expect(() => audio.setVolume(0.5)).not.toThrow();
    expect(() => audio.setVolume(Number.NaN)).not.toThrow();
  });
});
