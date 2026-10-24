import { describe, expect, it } from "vitest";
import { harmonyOf } from "./realize";
import { ANIMALS, INSTRUMENTS, defaultMembers } from "./instruments";
import { defaultSettings, generateLocal } from "./local";
import { getPreset, type PresetId } from "./presets";
import { getStandard } from "./standards";
import { STYLES } from "./styles";
import { mod } from "./theory";
import type { Member, Score, StyleId } from "./types";

// The band listening to itself (ensemble.ts), checked where a note-by-note audit of hundreds of
// takes found it sounding wrong.

const take = (band: Member[], style: StyleId, seed: number, extra: Record<string, unknown> = {}) =>
  generateLocal({ ...defaultSettings(band), style, tempo: STYLES[style].tempo.default, key: { ...STYLES[style].key }, seed, bars: 32, ...extra }, band).score;

function presetTake(id: PresetId, seed: number) {
  const p = getPreset(id)!;
  const band: Member[] = p.band.map((b) => ({ id: b.animal, animal: b.animal, name: ANIMALS[b.animal].name, instrument: b.instrument }));
  return generateLocal({ ...defaultSettings(band), style: p.style, feel: p.feel, harmony: p.harmony, preset: p.id, tempo: p.tempo, key: { ...p.key }, meter: { beats: p.meter ?? 4 }, leaderId: band[0].id, soloists: p.soloists, seed, bars: 32 }, band).score;
}

const halfStep = (a: number, b: number) => Math.abs(a - b) % 12 === 1 || Math.abs(a - b) % 12 === 11;
const featured = (score: Score, bar: number, id: string) => ["lead", "solo", "trade"].includes(score.plan[bar]?.roles[id] ?? "");

describe("the band listening to itself", () => {
  it("pushes into the next chord together: no one stays on the old chord a half step from the push", () => {
    // pop keys push the next bar's chord on the "and" of 4; the guitar answered on the old one
    // there, the pad held it and the bass played its fifth: a half-step clash on most changes
    const bands: Member[][] = [
      [...defaultMembers(), { id: "penguin", animal: "penguin", name: "Pip", instrument: "guitar" }, { id: "cat", animal: "cat", name: "Mochi", instrument: "vibes" }],
      [...defaultMembers(), { id: "raccoon", animal: "raccoon", name: "Rocco", instrument: "organ" }, { id: "deer", animal: "deer", name: "Fern", instrument: "pad" }],
    ];
    let changes = 0;
    let clashes = 0;
    for (const band of bands)
      for (const seed of [1, 2, 3]) {
        const score = take(band, "pop", seed);
        const beats = score.frame.meter.beats;
        for (let bar = 0; bar < score.frame.bars - 1; bar++) {
          if (score.plan[bar].chords.at(-1)!.symbol === score.plan[bar + 1].chords[0].symbol) continue;
          changes++;
          const at = (bar + 1) * beats - 0.5 + 0.01;
          const ringing = band.filter((m) => m.instrument !== "drums" && !featured(score, bar, m.id)).map((m) => ({ id: m.id, ps: score.parts[m.id].filter((n) => n.start <= at && n.start + n.dur > at).map((n) => n.pitch) }));
          if (ringing.some((a) => ringing.some((b) => a.id < b.id && a.ps.some((p) => b.ps.some((q) => halfStep(p, q)))))) clashes++;
        }
      }
    expect(changes).toBeGreaterThan(50);
    expect(clashes / changes).toBeLessThan(0.1);
  });

  it("keeps the written tune to the player playing it: a harmony or canon line is that player's own", () => {
    // copied with the melody's mark, a harmony line skipped every fix the band makes
    const band: Member[] = [...defaultMembers(), { id: "cat", animal: "cat", name: "Mochi", instrument: "sax" }, { id: "bunny", animal: "bunny", name: "Clover", instrument: "violin" }];
    for (const style of ["pop", "swing", "baroque", "bossa"] as StyleId[])
      for (const standard of ["fly-me", "autumn", "canon"]) {
        const score = take(band, style, 1, { standard, styleChosen: true });
        const beats = score.frame.meter.beats;
        for (const m of band)
          for (const n of score.parts[m.id]) {
            if (!n.written) continue;
            const bar = Math.floor(n.start / beats + 1e-9);
            // the leader's own notes (the tune held over a barline, a pickup) are the only written ones
            expect(m.id, `${style} ${standard} bar ${bar + 1}`).toBe(score.frame.leaderId);
          }
      }
  });

  it("never moves the bass off the root under its chord onto a colour someone holds", () => {
    // the piano's b9 over D7 (Eb3) moved the bass's D2 to Eb2, every chorus
    for (const seed of [1, 2, 3]) {
      const band = defaultMembers();
      const score = generateLocal({ ...defaultSettings(band), style: "bossa", tempo: STYLES.bossa.tempo.default, key: { ...getStandard("f-blues")!.key }, standard: "f-blues", styleChosen: true, seed, bars: 32 }, band).score;
      const h = harmonyOf(score.frame, score.plan);
      // a held bass note a half step over its chord's root (a passing note goes by quicker)
      for (const n of score.parts.frog) if (n.dur >= 1) expect(mod(n.pitch - h.at(n.start).chord.root, 12), `seed ${seed} beat ${n.start}`).not.toBe(1);
    }
  });

  it("keeps a second line out of the bass's register", () => {
    // Frahm's open fifths sat at E2–B2 against the cello holding the bass; an ambient cello's
    // drone doubled the bassist's pedal down there
    for (const seed of [1, 2, 3]) {
      const score = presetTake("frahm", seed);
      const last = (score.frame.bars - 1) * score.frame.meter.beats;
      // the fifths sit from C3 up (a fifth stepping under the tune can dip a little, once in a while)
      const low = score.parts.bear.filter((n) => n.pitch < 45 && n.start < last);
      expect(low.length, `frahm seed ${seed}`).toBeLessThanOrEqual(1);
    }
    const band: Member[] = [...defaultMembers(), { id: "sheep", animal: "sheep", name: "Olive", instrument: "cello" }];
    for (const seed of [1, 2]) {
      const score = take(band, "ambient", seed);
      const beats = score.frame.meter.beats;
      const drone = score.parts.sheep.filter((n) => n.pitch < 48 && score.plan[Math.floor(n.start / beats + 1e-9)]?.roles.sheep === "pad");
      expect(drone.length, `ambient seed ${seed}`).toBe(0);
    }
  });

  it("puts a low melody instrument's tune over the band, where its melodies live", () => {
    // Laufey's cello tune sat at B2–A3, under the piano's comping and the violin's pad
    for (const seed of [1, 2, 3]) {
      const score = presetTake("laufey", seed);
      const low = Math.min(...score.motif.notes.map((n) => n.pitch));
      expect(low, `seed ${seed}`).toBeGreaterThanOrEqual(INSTRUMENTS.cello.solo![0] + 3);
    }
  });

  it("in a big band, a doubled note splits off without dropping into the bass's register", () => {
    // with every chord tone taken, a pad's doubled E3 was moved down to A2, under the bassist
    const big: Member[] = [
      ...defaultMembers(),
      { id: "raccoon", animal: "raccoon", name: "Rocco", instrument: "organ" },
      { id: "deer", animal: "deer", name: "Fern", instrument: "pad" },
      { id: "penguin", animal: "penguin", name: "Pip", instrument: "vibes" },
      { id: "cat", animal: "cat", name: "Mochi", instrument: "guitar" },
    ];
    let low = 0;
    let notes = 0;
    for (const style of ["ambient", "bossa", "pop", "swing", "minimal", "baroque"] as StyleId[])
      for (const seed of [1, 2]) {
        const score = take(big, style, seed);
        const beats = score.frame.meter.beats;
        for (const id of ["raccoon", "deer", "penguin", "cat"])
          for (const n of score.parts[id]) {
            const bar = Math.floor(n.start / beats + 1e-9);
            if (!["comp", "pad"].includes(score.plan[bar]?.roles[id] ?? "") || bar === score.frame.bars - 1) continue;
            notes++;
            if (n.pitch < 48) low++;
          }
      }
    expect(notes).toBeGreaterThan(3000);
    expect(low / notes).toBeLessThan(0.002);
  });
});
