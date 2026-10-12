import { describe, expect, it } from "vitest";
import { defaultMembers } from "@/music/instruments";
import { defaultSettings, generateLocal } from "@/music/local";
import { getStandard } from "@/music/standards";
import { headerAt } from "./header";

const band = defaultMembers();
const std = getStandard("f-blues")!;
const score = generateLocal({ ...defaultSettings(band), style: std.style, standard: std.id, key: { ...std.key }, bars: std.bars.length, seed: 4 }, band).score;
const beats = score.frame.meter.beats;

describe("the stage's header", () => {
  it("counts in before the downbeat", () => {
    expect(headerAt(score, -2)).toEqual({ bar: -1, section: "count-in…", counter: "", chord: "", next: "" });
  });

  it("names the section, the bar and the chord sounding", () => {
    const h = headerAt(score, 0);
    expect(h.bar).toBe(0);
    expect(h.section).toBe(score.plan[0].section);
    expect(h.counter).toBe(`· bar 1/${score.frame.bars}`);
    expect(h.chord).toBe(score.frame.chords[0][0].symbol);
  });

  it("reads ahead to the next change", () => {
    for (let b = 0; b < score.frame.bars - 1; b++) {
      const h = headerAt(score, b * beats + 0.01);
      if (!h.next) continue;
      expect(h.next.startsWith("→ ")).toBe(true);
      expect(h.next.slice(2)).not.toBe(h.chord);
    }
  });

  it("stays on the last bar past the end", () => {
    expect(headerAt(score, score.frame.bars * beats + 10).bar).toBe(score.frame.bars - 1);
  });
});
