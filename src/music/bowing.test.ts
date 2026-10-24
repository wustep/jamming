import { describe, expect, it } from "vitest";
import { BREATH, bowLine, phraseArc, phrasesOf, strokesOf, swellsOf, vibratoAt } from "./bowing";
import { ANIMALS, defaultMembers } from "./instruments";
import { defaultSettings, generateLocal } from "./local";
import { PRESETS, getPreset, type PresetId } from "./presets";
import type { Member, NoteEvent, StyleId } from "./types";

const n = (start: number, dur: number, pitch: number, extra: Partial<NoteEvent> = {}): NoteEvent => ({ pitch, start, dur, vel: 0.8, ...extra });
const opts = (style: StyleId, tempo = 100) => ({ beats: 4, tempo, style, seed: 1 });

function presetTake(id: PresetId, seed = 3) {
  const p = getPreset(id)!;
  const band: Member[] = p.band.map((b) => ({ id: b.animal, animal: b.animal, name: ANIMALS[b.animal].name, instrument: b.instrument }));
  const settings = { ...defaultSettings(band), style: p.style, feel: p.feel, harmony: p.harmony, preset: p.id, tempo: p.tempo, key: { ...p.key }, meter: { beats: p.meter ?? 4 }, leaderId: band[0].id, soloists: p.soloists, seed, bars: 32 };
  return { score: generateLocal(settings, band).score, band };
}

describe("a violin line, bowed", () => {
  it("joins the gaps a line was written with, but keeps real rests, pitches and onsets", () => {
    // a sampler-friendly line: every note a hair short, then a real rest
    const line = [n(0, 0.48, 69), n(0.5, 0.475, 71), n(1, 0.95, 72), n(2, 1.9, 74), n(4.5, 0.5, 76)];
    const out = bowLine(line, opts("pop"));
    expect(out.map((x) => [x.start, x.pitch])).toEqual(line.map((x) => [x.start, x.pitch]));
    expect(out.slice(0, 3).map((x) => x.dur)).toEqual([0.5, 0.5, 1]);
    // the half note before the rest keeps its length: that gap is a breath
    expect(out[3].dur).toBeCloseTo(1.9);
    expect(phrasesOf(out)).toEqual([
      [0, 3],
      [4, 4],
    ]);
  });

  it("slurs sixteenths in a baroque run two or four to a bow, beat by beat", () => {
    const run = Array.from({ length: 16 }, (_, i) => n(i * 0.25, 0.23, 62 + (i % 8)));
    const out = bowLine(run, opts("baroque", 96));
    const { strokes } = strokesOf(out, 4);
    // every bow starts on a beat or half beat, and holds two or four notes
    for (const s of strokes) {
      expect([2, 4]).toContain(s.last - s.first + 1);
      expect((out[s.first].start * 2) % 1).toBe(0);
    }
    expect(strokes.length).toBeLessThanOrEqual(8);
    expect(strokes.length).toBeGreaterThanOrEqual(4);
  });

  it("swings its eighths in pairs: the offbeat starts a bow and slurs into the beat", () => {
    const line = Array.from({ length: 8 }, (_, i) => n(i * 0.5, 0.475, 67 + (i % 4)));
    const out = bowLine(line, opts("swing", 160));
    const slurred = out.filter((x) => x.slur).map((x) => x.start);
    expect(slurred).toEqual([1, 2, 3]);
  });

  it("never slurs a repeated note, an accent, a staccato or a big leap: each gets a new bow", () => {
    const out = bowLine([n(0, 0.5, 69), n(0.5, 0.5, 69), n(1, 0.5, 71, { art: "accent" }), n(1.5, 0.5, 72, { art: "staccato" }), n(2, 0.5, 74), n(2.5, 0.5, 86)], opts("pop"));
    expect(out.map((x) => !!x.slur)).toEqual([false, false, false, false, false, false]);
  });

  it("gives a long note its own bow, and alternates bows, down-bow on the downbeat and up-bow for a pickup", () => {
    const out = bowLine([n(3.5, 0.5, 67), n(4, 2, 72), n(6, 0.5, 71), n(6.5, 0.5, 69), n(7, 1, 67)], opts("pop"));
    const { strokes, strokeOf } = strokesOf(out, 4);
    expect(strokes.map((s) => s.dir)).toEqual([-1, 1, -1]);
    expect(strokeOf).toEqual([0, 1, 2, 2, 2]);
    // after a breath, a phrase on the downbeat starts down-bow again
    const again = strokesOf(bowLine([n(0, 1, 67), n(1 + BREATH + 1, 1, 69), n(8, 1, 71)], opts("pop")), 4);
    expect(again.strokes.map((s) => s.dir)).toEqual([1, -1, 1]);
  });

  it("swells toward a phrase's high point and eases off at its end, without the beat-by-beat stamping", () => {
    // written loud on the beats and soft off them, as the line generator does
    const line = Array.from({ length: 12 }, (_, i) => n(i * 0.5, 0.48, [64, 65, 67, 69, 71, 72, 74, 76, 74, 72, 71, 69][i], { vel: i % 2 ? 0.7 : 0.8 }));
    const out = bowLine(line, opts("pop"));
    const v = out.map((x) => x.vel);
    const top = out.findIndex((x) => x.pitch === 76);
    expect(v[top]).toBeGreaterThan(v[0] + 0.08);
    expect(v[top]).toBeGreaterThan(v[v.length - 1] + 0.08);
    // it rises and falls once, instead of see-sawing 0.8 / 0.7 note by note
    let flips = 0;
    for (let i = 2; i < v.length; i++) if (Math.sign(v[i] - v[i - 1]) !== Math.sign(v[i - 1] - v[i - 2])) flips++;
    expect(flips).toBeLessThanOrEqual(4);
    // and the phrase is as loud on the whole as it was written
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean(v)).toBeGreaterThan(mean(line.map((x) => x.vel)) - 0.04);
  });

  it("ties a held backing tone over instead of bowing it again", () => {
    const out = bowLine([n(0, 3.8, 64), n(4, 3.8, 64), n(8, 3.8, 67)], { ...opts("bossa"), roleAt: () => "pad" });
    expect(out.map((x) => [x.start, x.dur, x.pitch])).toEqual([
      [0, 8, 64],
      [8, 3.8, 67],
    ]);
    // the featured line's repeated notes are its rhythm: they stay
    expect(bowLine([n(0, 1.9, 64), n(2, 1.9, 64)], { ...opts("bossa"), roleAt: () => "lead" })).toHaveLength(2);
  });

  it("shapes a long breathless line in spans of about two bars", () => {
    const run = Array.from({ length: 64 }, (_, i) => n(i * 0.25, 0.23, 62 + (i % 8)));
    const spans = swellsOf(bowLine(run, opts("baroque", 96)), 4);
    expect(spans.length).toBe(2);
    expect(phraseArc(0, 0.5)).toBeCloseTo(0);
    expect(phraseArc(0.5, 0.5)).toBeCloseTo(1);
  });

  it("vibrato waits for a note to speak, then widens in; a short note has none", () => {
    expect(vibratoAt(0.2, 0.15)).toBe(0);
    expect(vibratoAt(1.5, 0.1)).toBe(0);
    expect(vibratoAt(1.5, 0.3)).toBeGreaterThan(0);
    expect(vibratoAt(1.5, 0.3)).toBeLessThan(vibratoAt(1.5, 0.6));
    expect(vibratoAt(2, 1)).toBeGreaterThan(vibratoAt(0.5, 1));
  });
});

describe("the violin in real takes", () => {
  const violinParts = () => {
    const out: { label: string; notes: NoteEvent[]; tempo: number }[] = [];
    for (const p of PRESETS) {
      if (!p.band.some((b) => b.instrument === "violin")) continue;
      const { score, band } = presetTake(p.id);
      const v = band.find((m) => m.instrument === "violin")!;
      out.push({ label: p.id, notes: score.parts[v.id], tempo: score.frame.tempo });
    }
    for (const style of ["swing", "bossa", "baroque", "ambient", "pop"] as StyleId[]) {
      const band: Member[] = [{ id: "bunny", animal: "bunny", name: "Clover", instrument: "violin" }, ...defaultMembers().filter((m) => m.instrument !== "trumpet")];
      const { score } = generateLocal({ ...defaultSettings(band), style, seed: 3, bars: 32, leaderId: "bunny", soloists: ["bunny", "bear"] }, band);
      out.push({ label: style, notes: score.parts.bunny, tempo: score.frame.tempo });
    }
    return out;
  };

  it("moves from note to note: the line only stops where it breathes", () => {
    // every note used to stop short of the next (a gap the writer left, then the feel's own
    // articulation on top): a violin line that never once joined two notes
    for (const { label, notes } of violinParts()) {
      let joined = 0;
      let tiny = 0;
      for (let i = 1; i < notes.length; i++) {
        const gap = notes[i].start - (notes[i - 1].start + notes[i - 1].dur);
        if (Math.abs(gap) < 1e-6) joined++;
        else if (gap > 0 && gap < 0.2 && notes[i - 1].art !== "staccato") tiny++;
      }
      // (a part of a few held pad tones has rests between most of them: only a line is held to joining up)
      if (notes.length >= 40) expect(joined, label).toBeGreaterThan((notes.length - 1) * 0.6);
      expect(tiny, label).toBeLessThanOrEqual(Math.ceil(notes.length * 0.02));
    }
  });

  it("slurs: a bow carries a few notes where the line runs, so the bow changes far less often than the notes", () => {
    for (const { label, notes } of violinParts()) {
      if (notes.length < 40) continue;
      const { strokes } = strokesOf(notes, 4);
      const arco = notes.filter((x) => x.art !== "pizz").length;
      expect(strokes.length / arco, label).toBeLessThan(label === "bach" || label === "baroque" ? 0.55 : 0.92);
    }
  });

  it("never stamps a velocity at the ceiling: a phrase's peak eases toward the top", () => {
    for (const { label, notes } of violinParts()) {
      const top = notes.filter((x) => x.vel > 0.995);
      expect(top.length, label).toBe(0);
    }
  });

  it("keeps its solos singing below the whistle register", () => {
    for (const { label, notes } of violinParts()) {
      const high = notes.filter((x) => x.pitch > 91);
      expect(high.length, label).toBe(0);
    }
  });

  it("leaves the cello's bowing to the cello", () => {
    const { score, band } = presetTake("bach");
    const cello = band.find((m) => m.instrument === "cello")!;
    expect(score.parts[cello.id].some((x) => x.slur)).toBe(false);
  });
});
