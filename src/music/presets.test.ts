import { describe, expect, it } from "vitest";
import { DRUM_KITS, PAD_VOICES, PIANO_PACKS, ROOMS } from "@/audio/packs";
import { decodeShare, encodeShare } from "@/state/share";
import { HARMONY_BOOKS } from "./harmony-books";
import { ANIMALS, INSTRUMENTS } from "./instruments";
import { defaultSettings, generateLocal } from "./local";
import { FEELS } from "./playing";
import { PRESETS } from "./presets";
import { STYLES } from "./styles";
import type { Member } from "./types";

const bandOf = (p: (typeof PRESETS)[number]): Member[] => p.band.map((b) => ({ id: b.animal, animal: b.animal, name: ANIMALS[b.animal].name, instrument: b.instrument }));

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
});
