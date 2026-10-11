import { describe, expect, it } from "vitest";
import { BOOK_IDS, HARMONY_BOOKS, buildTune, isAxis } from "./harmony-books";
import { makeRng } from "./rng";
import { parseChord, pcOf, romanToChord } from "./theory";

const everyBar = (id: (typeof BOOK_IDS)[number], mode: "major" | "minor") => {
  const b = HARMONY_BOOKS[id][mode];
  return [...b.heads.flat(), ...b.seqs.flat(), ...Object.values(b.tails).flat(2), ...Object.values(b.phrases).flat(2), ...b.loops.flat(), ...b.codas.flat()];
};

describe("harmony books", () => {
  it("spell every bar as real chords in any key", () => {
    for (const id of BOOK_IDS)
      for (const mode of ["major", "minor"] as const)
        for (const tonic of ["C", "Eb", "F#"])
          for (const bar of everyBar(id, mode))
            for (const tok of bar.split(/\s+/)) {
              const sym = romanToChord(tok, { tonic, mode });
              expect(sym, `${id} ${mode} ${tok}`).toMatch(/^[A-G][#b]?/);
              const c = parseChord(sym);
              expect(c.tones.length, `${id} ${mode} ${tok} → ${sym}`).toBeGreaterThanOrEqual(3);
              expect(c.root, `${id} ${mode} ${tok} → ${sym}`).toBe(pcOf(sym.match(/^[A-G][#b]?/)![0]));
            }
  });

  it("build eight bars, a different tune most takes, and never I–V–vi–IV", () => {
    for (const id of BOOK_IDS)
      for (const mode of ["major", "minor"] as const) {
        const tunes = new Set<string>();
        for (let seed = 1; seed <= 40; seed++) {
          const tune = buildTune(HARMONY_BOOKS[id], mode, makeRng(seed));
          expect(tune, `${id} ${mode}`).toHaveLength(8);
          expect(isAxis(tune), `${id} ${mode}: ${tune.join(" | ")}`).toBe(false);
          tunes.add(tune.join("|"));
        }
        // a book that holds each chord two bars has fewer ways to fill eight bars
        expect(tunes.size, `${id} ${mode}`).toBeGreaterThan(HARMONY_BOOKS[id].holds ? 6 : 12);
      }
  });

  it("knows the axis progression in any rotation and colour", () => {
    expect(isAxis(["I", "V", "vi", "IV"])).toBe(true);
    expect(isAxis(["ii", "vi", "IV", "Iadd9", "V"])).toBe(true);
    expect(isAxis(["I", "IV", "vi", "V"])).toBe(false);
  });
});
