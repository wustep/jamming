import { describe, expect, it } from "vitest";
import { parseNotes } from "./notation";
import { STANDARDS, melodyBar, searchStandards } from "./standards";

describe("searchStandards", () => {
  const ids = (q: string) => searchStandards(q).map((s) => s.id);

  it("keeps every tune for an empty query", () => {
    expect(searchStandards("   ")).toHaveLength(STANDARDS.length);
  });
  it("matches names ignoring case and accents", () => {
    expect(ids("autumn")).toEqual(["autumn"]);
    expect(ids("frere")).toEqual(["frere-jacques"]);
    expect(ids("IPANEMA")).toEqual(["girl-from-ipanema"]);
  });
  it("needs every word, and finds tunes by feel, key and meter", () => {
    expect(ids("bossa")).toContain("blue-bossa");
    expect(ids("bossa minor").every((id) => STANDARDS.find((s) => s.id === id)!.key.mode === "minor")).toBe(true);
    expect(ids("waltz")).toEqual(expect.arrayContaining(["jazz-waltz", "all-blues", "someday"]));
    expect(ids("blues bb")).toEqual(expect.arrayContaining(["blue-monk", "tenor-madness"]));
  });
  it("comes back empty when nothing matches", () => {
    expect(ids("zzz nope")).toEqual([]);
  });
});

describe("written melodies", () => {
  const sung = STANDARDS.filter((s) => s.melody);

  it("every tune that isn't a generic form has its melody", () => {
    const generic = ["f-blues", "minor-blues", "rhythm-changes", "so-what", "jazz-waltz", "four-chords", "doo-wop", "dorian-vamp"];
    expect(STANDARDS.filter((s) => !s.melody).map((s) => s.id)).toEqual(generic);
    for (const std of sung) {
      expect(std.name, std.id).not.toMatch(/\(changes\)/);
      expect(std.motif, std.id).toBeTruthy();
    }
  });

  it("has a bar of melody for every bar of changes, each one exactly filling the meter", () => {
    for (const std of sung) {
      expect(std.melody!.length, std.id).toBe(std.bars.length);
      std.melody!.forEach((bar, i) => {
        const r = parseNotes(bar, std.meter);
        expect(r.errors, `${std.id} bar ${i + 1}: ${bar}`).toEqual([]);
        expect(r.covered, `${std.id} bar ${i + 1}: ${bar}`).toBeCloseTo(std.meter, 6);
      });
    }
  });

  it("has a pickup that fits in one bar, and the melody's last bar ends with it", () => {
    for (const std of sung.filter((s) => s.pickup)) {
      const pickup = parseNotes(std.pickup!, std.meter);
      expect(pickup.errors, std.id).toEqual([]);
      expect(pickup.covered, `${std.id} pickup`).toBeCloseTo(std.meter, 6);
      expect(pickup.notes.length, `${std.id} pickup`).toBeGreaterThan(0);
      const from = pickup.notes[0].start;
      const last = parseNotes(std.melody!.at(-1)!, std.meter).notes.filter((n) => n.start >= from - 1e-6);
      expect(last.map((n) => [n.pitch, n.start, n.dur]), `${std.id} last bar`).toEqual(pickup.notes.map((n) => [n.pitch, n.start, n.dur]));
    }
  });

  it("ties over a barline into the same note, and never from the last bar round to the first", () => {
    for (const std of sung) {
      const bars = std.melody!;
      expect(bars.at(-1), `${std.id} last bar`).not.toMatch(/~\s*$/);
      bars.forEach((bar, i) => {
        if (!/~\s*$/.test(bar)) return;
        const held = parseNotes(bar, std.meter).notes.at(-1)!;
        const next = parseNotes(bars[i + 1], std.meter).notes[0];
        expect(held.start + held.dur, `${std.id} bar ${i + 1} holds to the barline`).toBeCloseTo(std.meter, 6);
        expect([next?.start, next?.pitch], `${std.id} bar ${i + 2} continues the tie`).toEqual([0, held.pitch]);
      });
    }
  });

  it("plays a tied note once, held through", () => {
    const fly = STANDARDS.find((s) => s.id === "fly-me")!;
    // "...hold my hand": the G rings through bar 11 and on into bar 12
    expect(melodyBar(fly, 10, 4)!.map((n) => [n.start, n.dur])).toEqual([[0, 7]]);
    expect(melodyBar(fly, 11, 4)!.map((n) => n.start)).toEqual([3]);
    expect(melodyBar(fly, 10, 4, { stop: true })!.map((n) => n.dur)).toEqual([4]);
    expect(melodyBar(fly, 11, 4, { alone: true })!.map((n) => n.start)).toEqual([0, 3]);
  });
});
