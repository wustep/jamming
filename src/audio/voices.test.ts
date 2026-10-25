import { describe, expect, it } from "vitest";
import { ANIMALS } from "@/music/instruments";
import { defaultSettings, generateLocal } from "@/music/local";
import { getPreset } from "@/music/presets";
import type { InstrumentId, Member } from "@/music/types";
import { VOICE_CAP, VoiceBook, drumRing } from "./voices";

describe("what a player has ringing", () => {
  it("lets a restruck pitch go as the new note starts, through its release", () => {
    const stopped: [string, number | undefined][] = [];
    const book = new VoiceBook(8);
    book.add(60, 0, 4, (t) => stopped.push(["held C", t]));
    book.add(64, 0, 4, (t) => stopped.push(["held E", t]));
    expect(book.admit(60, 1)).toBe(1);
    expect(stopped).toEqual([["held C", 1]]);
    // a chord with a doubled note isn't a restrike
    book.add(67, 2, 4, () => stopped.push(["G", 2]));
    expect(book.admit(67, 2.005)).toBe(0);
  });

  it("drums ring over each other (a ride struck every beat), until the cap", () => {
    const book = new VoiceBook(3, false);
    let let_go = 0;
    for (let i = 0; i < 6; i++) {
      let_go += book.admit(51, i * 0.5);
      book.add(51, i * 0.5, i * 0.5 + drumRing(51), () => {});
      expect(book.count(i * 0.5)).toBeLessThanOrEqual(3);
    }
    expect(let_go).toBe(3);
  });

  it("never holds more than its cap: the oldest goes first", () => {
    const book = new VoiceBook(4);
    const order: number[] = [];
    for (let i = 0; i < 10; i++) {
      book.admit(40 + i, i * 0.1);
      book.add(40 + i, i * 0.1, 10, () => order.push(40 + i));
      expect(book.count(i * 0.1)).toBeLessThanOrEqual(4);
    }
    expect(order).toEqual([40, 41, 42, 43, 44, 45]);
  });

  it("forgets voices that have finished on their own", () => {
    const book = new VoiceBook(2);
    book.add(60, 0, 1, () => {
      throw new Error("already finished: never let go again");
    });
    expect(book.admit(60, 2)).toBe(0);
  });

  it("caps leave room for a real band: no player in a big preset reaches its cap on notes alone", () => {
    // the cap is a backstop for release tails and pile-ups, not a limit on what's written
    for (const id of ["basie", "chopin", "zimmer", "glass", "einaudi"] as const) {
      const p = getPreset(id)!;
      const band: Member[] = p.band.map((b) => ({ id: b.animal, animal: b.animal, name: ANIMALS[b.animal].name, instrument: b.instrument }));
      const { score } = generateLocal({ ...defaultSettings(band), style: p.style, feel: p.feel, harmony: p.harmony, preset: p.id, tempo: p.tempo, key: { ...p.key }, meter: { beats: p.meter ?? 4 }, leaderId: band[0].id, soloists: p.soloists, seed: 3, bars: 32 }, band);
      for (const m of band) {
        const notes = score.parts[m.id];
        let most = 0;
        for (const n of notes) most = Math.max(most, notes.filter((x) => x.start <= n.start + 1e-6 && x.start + x.dur > n.start + 1e-6).length);
        expect(most, `${id} ${m.instrument}`).toBeLessThan(VOICE_CAP[m.instrument as InstrumentId]);
      }
    }
  });
});
