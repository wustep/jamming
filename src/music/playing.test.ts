import { describe, expect, it } from "vitest";
import { defaultMembers } from "./instruments";
import { defaultSettings, generateLocal } from "./local";
import { FEELS, articulate, feelOf, metricLift, playLine, rubatoSec } from "./playing";
import { STYLES } from "./styles";
import type { NoteEvent, StyleId } from "./types";

const n = (start: number, dur: number, pitch = 60): NoteEvent => ({ pitch, start, dur, vel: 0.7 });

describe("playing feels", () => {
  it("every style plays its own row unless the chart picks another", () => {
    for (const style of Object.keys(STYLES) as StyleId[]) expect(feelOf({ style })).toBe(FEELS[style]);
    expect(feelOf({ style: "minimal", feel: "glass" })).toBe(FEELS.glass);
  });

  it("leans on the downbeat and backs off the off-beats, as hard as the feel says", () => {
    const funk = FEELS.funk;
    expect(metricLift(funk, 0, 4)).toBeGreaterThan(metricLift(funk, 2, 4));
    expect(metricLift(funk, 2, 4)).toBeGreaterThan(metricLift(funk, 1.5, 4));
    expect(metricLift(funk, 1.5, 4)).toBeGreaterThan(metricLift(funk, 1.25, 4));
    // an ambient touch is nearly flat
    expect(metricLift(FEELS.ambient, 0, 4) - metricLift(FEELS.ambient, 1.5, 4)).toBeLessThan(metricLift(funk, 0, 4) - metricLift(funk, 1.5, 4));
  });

  it("shortens short notes by the feel's articulation and leaves long and marked ones", () => {
    expect(articulate(FEELS.funk, 0.5, 0.25, undefined)).toBeCloseTo(0.25 * FEELS.funk.articulation);
    expect(articulate(FEELS.funk, 2, 1, undefined)).toBe(1);
    expect(articulate(FEELS.funk, 0.5, 0.25, "legato")).toBe(0.25);
  });

  it("bends time together and is back on the grid at each phrase's barline", () => {
    expect(rubatoSec(FEELS.swing, 3, 4, 0.5)).toBe(0);
    expect(rubatoSec(FEELS.chopin, 0, 4, 0.5)).toBeCloseTo(0);
    expect(rubatoSec(FEELS.chopin, 8, 4, 0.5)).toBeCloseTo(0);
    expect(rubatoSec(FEELS.chopin, 2, 4, 0.5)).toBeLessThan(0); // pushing into the phrase
    expect(rubatoSec(FEELS.chopin, 6, 4, 0.5)).toBeGreaterThan(0); // pulling back into its end
  });
});

describe("a line's habits", () => {
  const opts = { bar: 0, beats: 4, seed: "t", straight: true };

  it("pushes notes on an inner beat half a beat early into the silence before them", () => {
    const line = [n(0, 1), n(2, 2, 64)];
    const out = playLine(line, { ...FEELS.pop, push: 1 }, opts);
    expect(out.find((x) => x.pitch === 64)).toMatchObject({ start: 1.5, dur: 2.5 });
    // never the downbeat, and never over a moving line
    const busy = [n(0, 0.5), n(0.5, 0.5), n(1, 0.5), n(1.5, 0.5), n(2, 1, 64)];
    expect(playLine(busy, { ...FEELS.pop, push: 1, dotted: 0 }, opts).map((x) => x.start)).toEqual([0, 0.5, 1, 1.5, 2]);
  });

  it("dots even eighth pairs in a straight style only", () => {
    const pair = [n(0, 0.5), n(0.5, 0.5, 62)];
    expect(playLine(pair, { ...FEELS.baroque, dotted: 1 }, opts).map((x) => [x.start, x.dur])).toEqual([[0, 0.75], [0.75, 0.25]]);
    expect(playLine(pair, { ...FEELS.baroque, dotted: 1 }, { ...opts, straight: false }).map((x) => x.start)).toEqual([0, 0.5]);
  });

  it("accents a running bar in the feel's groups, 5+5+6", () => {
    const run = Array.from({ length: 16 }, (_, i) => n(i / 4, 0.25, 60 + (i % 5)));
    const out = playLine(run, FEELS.fox, opts);
    expect(out.filter((x) => x.art === "accent").map((x) => x.start * 4)).toEqual([0, 5, 10]);
  });

  it("leaves the tune as written", () => {
    const tune = [{ ...n(0, 1), written: true as const }, { ...n(2, 2, 64), written: true as const }];
    expect(playLine(tune, { ...FEELS.pop, push: 1 }, opts)).toEqual(tune);
  });

  it("only touches the featured lines: the bass and the comping keep their time", () => {
    const band = defaultMembers();
    const base = { ...defaultSettings(band), style: "bossa" as StyleId, seed: 4, bars: 32 };
    const plain = generateLocal(base, band).score;
    const pushed = generateLocal({ ...base, feel: "laufey" }, band).score;
    expect(pushed.parts.frog).toEqual(plain.parts.frog);
    expect(pushed.parts.owl).toEqual(plain.parts.owl);
    // the soloists' lines move
    const moved = band.filter((m) => JSON.stringify(pushed.parts[m.id]) !== JSON.stringify(plain.parts[m.id])).map((m) => m.id);
    expect(moved.length).toBeGreaterThan(0);
  });
});
