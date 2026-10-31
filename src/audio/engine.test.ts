import { describe, expect, it } from "vitest";
import { TroopAudio, volumeGain } from "./engine";

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
