import { describe, expect, it } from "vitest";
import { DRUM_KITS, PAD_VOICES, PIANO_PACKS, ROOMS } from "@/audio/packs";
import { decodeShare, encodeShare } from "@/state/share";
import { HARMONY_BOOKS } from "./harmony-books";
import { ANIMALS, INSTRUMENTS } from "./instruments";
import { defaultSettings, generateLocal } from "./local";
import { FEELS } from "./playing";
import { PRESETS } from "./presets";
import { STYLES } from "./styles";
import { chordPcs, mod, parseChord } from "./theory";
import type { Member, Score } from "./types";

const bandOf = (p: (typeof PRESETS)[number]): Member[] => p.band.map((b) => ({ id: b.animal, animal: b.animal, name: ANIMALS[b.animal].name, instrument: b.instrument }));

const takeOf = (p: (typeof PRESETS)[number], seed: number): Score => {
  const band = bandOf(p);
  return generateLocal({ ...defaultSettings(band), style: p.style, feel: p.feel, harmony: p.harmony, preset: p.id, tempo: p.tempo, key: p.key, leaderId: band[0].id, soloists: p.soloists, seed, bars: 32 }, band).score;
};

describe("artist presets", () => {
  it("set a style, a feel, a book and sounds this build has, and a band that can play", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) {
      expect(STYLES[p.style], p.id).toBeTruthy();
      expect(FEELS[p.feel], p.id).toBeTruthy();
      expect(HARMONY_BOOKS[p.harmony], p.id).toBeTruthy();
      expect(ROOMS).toContain(p.sounds.room);
      if (p.sounds.piano) expect(PIANO_PACKS).toContain(p.sounds.piano);
      if (p.sounds.pad) expect(PAD_VOICES).toContain(p.sounds.pad);
      expect(DRUM_KITS.length).toBeGreaterThan(0);
      // a stage holds six; every animal once; the leader carries a tune
      expect(p.band.length, p.id).toBeLessThanOrEqual(6);
      expect(new Set(p.band.map((b) => b.animal)).size, p.id).toBe(p.band.length);
      for (const b of p.band) expect(INSTRUMENTS[b.instrument], `${p.id} ${b.instrument}`).toBeTruthy();
      expect(p.band[0].instrument, p.id).not.toBe("drums");
      for (const a of p.soloists) expect(p.band.map((b) => b.animal), p.id).toContain(a);
      // inside the tempo slider (the style's range, give or take 20)
      expect(p.tempo, p.id).toBeGreaterThanOrEqual(STYLES[p.style].tempo.min - 20);
      expect(p.tempo, p.id).toBeLessThanOrEqual(STYLES[p.style].tempo.max + 20);
    }
  });

  it("each plays a take in its own feel and changes, and a link to it plays the same take", () => {
    for (const p of PRESETS) {
      const band = bandOf(p);
      const settings = { ...defaultSettings(band), style: p.style, feel: p.feel, harmony: p.harmony, preset: p.id, tempo: p.tempo, key: p.key, leaderId: band[0].id, soloists: p.soloists, seed: 11, bars: 32 };
      const { score } = generateLocal(settings, band);
      expect(score.frame.feel ?? score.frame.style, p.id).toBe(p.feel === p.style ? p.style : p.feel);
      for (const m of band) expect(score.parts[m.id].length, `${p.id} ${m.instrument}`).toBeGreaterThan(0);
      const shared = decodeShare(encodeShare(score))!;
      expect(shared.settings).toMatchObject({ feel: p.feel, harmony: p.harmony, preset: p.id });
      expect(generateLocal({ ...defaultSettings(shared.members), ...shared.settings }, shared.members).score.parts).toEqual(score.parts);
    }
  });

  it("change the changes: a preset's book writes a different chart than the style's own", () => {
    const glass = PRESETS.find((p) => p.id === "zimmer")!;
    const band = bandOf(glass);
    const base = { ...defaultSettings(band), style: glass.style, key: glass.key, seed: 5, bars: 16 };
    const own = generateLocal(base, band).score.frame.chords.flat().map((c) => c.symbol);
    const film = generateLocal({ ...base, harmony: glass.harmony }, band).score.frame.chords.flat().map((c) => c.symbol);
    expect(film).not.toEqual(own);
  });

  it("a minimalist's tonic pedal steps onto the chord's bass where the tonic would grind against it", () => {
    // Elijah Fox: E major, Emaj7 to F#maj7; an E pedal under F#maj7 rubs a half step on its E#
    let bad = 0;
    let held = 0;
    for (const p of PRESETS.filter((x) => x.style === "minimal")) {
      for (const seed of [1, 2, 3, 4]) {
        const score = takeOf(p, seed);
        const beats = score.frame.meter.beats;
        for (const m of score.members) {
          for (const n of score.parts[m.id]) {
            const bar = Math.floor(n.start / beats + 1e-9);
            if (score.plan[bar]?.roles[m.id] !== "bass") continue;
            let sym = score.frame.chords[bar][0].symbol;
            for (const c of score.frame.chords[bar]) if (c.beat <= n.start - bar * beats + 1e-6) sym = c.symbol;
            const chord = parseChord(sym);
            const pc = mod(n.pitch, 12);
            held++;
            if (pc !== chord.bass && chordPcs(chord).some((x) => mod(x - pc, 12) === 1 || mod(pc - x, 12) === 1)) bad++;
          }
        }
      }
    }
    expect(held).toBeGreaterThan(500);
    expect(bad).toBe(0);
  });

  it("held supporting voices don't rub a half step, quarters played legato included", () => {
    const SUPPORT = ["comp", "pad", "counter", "fill", "bass"];
    let rubs = 0;
    let pairs = 0;
    for (const p of PRESETS) {
      for (const seed of [1, 2, 3, 4]) {
        const score = takeOf(p, seed);
        const beats = score.frame.meter.beats;
        const roleOf = (id: string, t: number) => score.plan[Math.floor(t / beats + 1e-9)]?.roles[id] ?? "rest";
        const ids = score.members.filter((m) => m.instrument !== "drums").map((m) => m.id);
        for (const a of ids) {
          for (const n of score.parts[a]) {
            if (n.dur < 0.95 || roleOf(a, n.start) === "bass" || !SUPPORT.includes(roleOf(a, n.start))) continue;
            for (const b of ids) {
              if (b === a) continue;
              for (const x of score.parts[b]) {
                if (x.dur < 0.95 || !SUPPORT.includes(roleOf(b, x.start))) continue;
                if (Math.min(x.start + x.dur, n.start + n.dur) - Math.max(x.start, n.start) < 0.95) continue;
                pairs++;
                if (Math.abs(x.pitch - n.pitch) === 1 || Math.abs(x.pitch - n.pitch) === 13) rubs++;
              }
            }
          }
        }
      }
    }
    // 18 of 17,281 are left where no free note was near (60 before legato quarters counted)
    expect(pairs).toBeGreaterThan(5000);
    expect(rubs / pairs, `${rubs} of ${pairs}`).toBeLessThan(0.0025);
  });

  it("a minimalist's bass pulse doesn't strike a half step against a note someone is holding", () => {
    // Elijah Fox: the cello's octave pulse used to land on E3 against the piano's held D#3 (84 in
    // these takes). A walking or running bass keeps its passing tones; those aren't counted here.
    for (const p of PRESETS.filter((x) => x.style === "minimal")) {
      let rubs = 0;
      for (const seed of [1, 2, 3, 4]) {
        const score = takeOf(p, seed);
        const beats = score.frame.meter.beats;
        for (const m of score.members) {
          for (const n of score.parts[m.id]) {
            if (score.plan[Math.floor(n.start / beats + 1e-9)]?.roles[m.id] !== "bass" || n.written) continue;
            for (const o of score.members) {
              if (o.id === m.id || o.instrument === "drums") continue;
              for (const x of score.parts[o.id]) {
                const held = x.dur >= 0.95 && x.start < n.start - 1e-6 && x.start + x.dur > n.start + 1e-6;
                if (held && (Math.abs(x.pitch - n.pitch) === 1 || Math.abs(x.pitch - n.pitch) === 13)) rubs++;
              }
            }
          }
        }
      }
      expect(rubs, p.id).toBe(0);
    }
  });
});
