import { describe, expect, it } from "vitest";
import { DRUM, defaultMembers } from "./instruments";
import { defaultSettings, generateLocal } from "./local";
import { STYLES } from "./styles";
import { harmonyOf } from "./realize";
import { techniqueAt } from "./teach";
import { mod } from "./theory";
import type { Member, NoteEvent, Score, StyleId } from "./types";

// Each style sounds like itself: the one thing a player of it would miss if it weren't there.

const band = defaultMembers(); // Bruno (piano), Lily (bass), Hoot (drums), Rusty (trumpet)
function take(style: StyleId, seed: number, o: { bars?: number; members?: Member[] } = {}): Score {
  const members = o.members ?? band;
  return generateLocal({ ...defaultSettings(members), style, bars: o.bars ?? 32, seed, key: { tonic: "C", mode: "major" } }, members).score;
}
const barOf = (s: Score, n: NoteEvent) => Math.floor(n.start / s.frame.meter.beats + 1e-9);
const inBar = (s: Score, id: string, b: number) => s.parts[id].filter((n) => barOf(s, n) === b).map((n) => ({ ...n, start: n.start - b * s.frame.meter.beats }));
const share = (xs: boolean[]) => xs.filter(Boolean).length / Math.max(1, xs.length);
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

describe("each style sounds like itself", () => {
  it("swing: the walking bass lands on a chord tone on beat 3, a passing note between", () => {
    let on3 = 0;
    let tones = 0;
    for (const seed of SEEDS) {
      const s = take("swing", seed);
      const H = harmonyOf(s.frame, s.plan);
      for (let b = 0; b < s.frame.bars; b++) {
        if (s.plan[b].directives?.frog !== "@walk" || s.plan[b].chords.length > 1) continue;
        const three = inBar(s, "frog", b).find((n) => Math.abs(n.start - 2) < 1e-6);
        if (!three) continue;
        on3++;
        if (H.at(b * 4 + 2).tones.includes(mod(three.pitch, 12))) tones++;
      }
    }
    expect(on3).toBeGreaterThan(100);
    expect(tones / on3).toBeGreaterThan(0.95);
  });

  it("bossa: the chords lean into a change, the new chord an 8th early on the and of 4", () => {
    let changes = 0;
    let early = 0;
    for (const seed of SEEDS) {
      const s = take("bossa", seed);
      for (let b = 0; b < s.frame.bars - 1; b++) {
        if (s.plan[b].roles.bear !== "comp" || s.plan[b].chords.at(-1)!.symbol === s.plan[b + 1].chords[0].symbol) continue;
        changes++;
        if (inBar(s, "bear", b).some((n) => Math.abs(n.start - 3.5) < 1e-6)) early++;
      }
    }
    expect(changes).toBeGreaterThan(50);
    expect(early / changes).toBeGreaterThan(0.9);
  });

  it("funk: sixteenths on the hi-hat, and every other bar it opens on the and of 4", () => {
    for (const seed of [1, 2, 3]) {
      const s = take("funk", seed);
      const head = s.frame.sections.find((x) => x.kind === "head")!;
      const bars = Array.from({ length: head.length - 1 }, (_, i) => head.start + i).filter((b) => s.plan[b].texture === "groove");
      const hats = (b: number) => inBar(s, "owl", b).filter((n) => (n.pitch === DRUM.hatClosed || n.pitch === DRUM.hatOpen) && n.start < 3);
      // the first three beats untouched by fills: twelve 16ths
      expect(share(bars.map((b) => hats(b).length === 12))).toBeGreaterThan(0.8);
      const opens = bars.filter((b) => inBar(s, "owl", b).some((n) => n.pitch === DRUM.hatOpen && Math.abs(n.start - 3.5) < 1e-6));
      expect(opens.length).toBeGreaterThan(0);
      expect(opens.every((b) => b % 2 === 1)).toBe(true);
    }
  });

  it("pop: the drummer builds the bar before the last chorus on the snare, 8ths then 16ths, louder all the way", () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = take("pop", seed);
      const last = s.frame.sections.find((x) => x.kind === "out")!;
      const b = last.start - 1;
      expect(s.plan[b].directives?.owl).toBe("@groove build");
      expect(techniqueAt(s, "owl", b).name).toBe("snare build");
      const snare = inBar(s, "owl", b).filter((n) => n.pitch === DRUM.snare).sort((x, y) => x.start - y.start);
      expect(snare.filter((n) => n.start < 2).length).toBe(4);
      expect(snare.filter((n) => n.start >= 2).length).toBe(8);
      expect(snare.at(-1)!.vel).toBeGreaterThan(snare[0].vel * 1.8);
      // and nowhere else
      expect(s.plan.filter((bp) => bp.directives?.owl === "@groove build").length).toBe(1);
    }
  });

  it("New Orleans: the bass drum's Big Four, an accent on beat 4 of every second bar", () => {
    const s = take("neworleans", 3);
    const head = s.frame.sections.find((x) => x.kind === "head")!;
    const kicks = (b: number) => inBar(s, "owl", b).filter((n) => n.pitch === DRUM.kick && n.start < 3.5);
    // the first pair of bars in each four (the second pair ends the phrase with a fill)
    expect(head.start % 2).toBe(0);
    for (let first = head.start; first + 1 < head.start + head.length; first += 4) {
      const second = first + 1;
      expect(kicks(second).some((n) => Math.abs(n.start - 3) < 1e-6 && n.art === "accent"), `bar ${second + 1}`).toBe(true);
      expect(kicks(first).some((n) => Math.abs(n.start - 3) < 1e-6), `bar ${first + 1}`).toBe(false);
    }
  });

  it("minimal: the head builds its motif a note at a time (the additive process)", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = take("minimal", seed);
      const head = s.frame.sections.find((x) => x.kind === "head")!;
      expect([0, 1, 2].map((i) => s.plan[head.start + i].directives?.fox)).toEqual(["@motif add 2", "@motif add 3", "@motif add 4"]);
      expect(techniqueAt(s, "fox", head.start).name).toBe("additive process");
      // the first bar is two notes on repeat (its last note may bend onto the chord as it lands)
      const one = inBar(s, "fox", head.start).sort((a, b) => a.start - b.start).slice(0, -1);
      expect(one.length).toBeGreaterThanOrEqual(4);
      expect(new Set(one.map((n) => n.pitch)).size).toBe(2);
      expect(one.every((n, i) => i < 2 || n.pitch === one[i - 2].pitch)).toBe(true);
    }
  });

  it("baroque: the cadence before the last chord is trilled from the note above", () => {
    let trilled = 0;
    for (const seed of SEEDS) {
      const s = take("baroque", seed);
      const lead = inBar(s, s.frame.leaderId, s.frame.bars - 2).sort((a, b) => a.start - b.start);
      // four 16ths shaking between two notes a step apart, the upper first
      const ok = lead.some((n, i) => {
        const q = lead.slice(i, i + 4);
        return (
          q.length === 4 &&
          q.every((x, k) => Math.abs(x.start - (n.start + k * 0.25)) < 1e-6) &&
          q[0].pitch === q[2].pitch &&
          q[1].pitch === q[3].pitch &&
          q[0].pitch - q[1].pitch >= 1 &&
          q[0].pitch - q[1].pitch <= 2
        );
      });
      if (ok) trilled++;
    }
    expect(trilled / SEEDS.length).toBeGreaterThan(0.8);
  });

  it("ambient: the bass doesn't strike a held chord again, it rings on through the next bar", () => {
    let long = 0;
    for (const seed of SEEDS) {
      const s = take("ambient", seed);
      for (let b = 1; b < s.frame.bars; b++) {
        const ringing = s.parts.frog.some((n) => n.start < b * 4 - 1e-6 && n.start + n.dur > b * 4 + 1e-6);
        if (ringing) expect(inBar(s, "frog", b).filter((n) => n.start < 1e-6), `seed ${seed} bar ${b + 1}`).toEqual([]);
      }
      long += s.parts.frog.filter((n) => n.dur > 4).length;
    }
    expect(long).toBeGreaterThan(50);
  });
});

describe("the tune on top", () => {
  it("a funk rhythm section plays under the tune, and only there", () => {
    // a funk head's bass plays nearly three times the notes of a swing head's, and the drums twice
    // the hits, at the same touch: bounced, the tune sat 3 LU under the rest of the band (Stevie
    // Wonder's 5) where a swing tune sits 4 over. Played 0.8 of the touch, it's 1–2 LU over.
    const plain = (seed: number) => {
      const under = STYLES.funk.underTune;
      delete STYLES.funk.underTune;
      try {
        return take("funk", seed);
      } finally {
        STYLES.funk.underTune = under;
      }
    };
    for (const seed of [1, 2, 3]) {
      const s = take("funk", seed);
      const was = plain(seed);
      const beats = s.frame.meter.beats;
      let under = 0;
      for (const id of ["bear", "frog", "owl", "fox"]) {
        s.parts[id].forEach((n, i) => {
          const bar = barOf(s, n);
          const kind = s.frame.sections.find((x) => bar >= x.start && bar < x.start + x.length)!.kind;
          const role = s.plan[bar].roles[id];
          const tuneHere = (kind === "head" || kind === "out") && Object.values(s.plan[bar].roles).includes("lead");
          const rhythm = role === "bass" || role === "groove" || role === "comp";
          const ratio = n.vel / was.parts[id][i].vel;
          expect(was.parts[id][i].start, `${seed} ${id}`).toBeCloseTo(n.start, 6);
          if (tuneHere && rhythm) {
            under++;
            expect(ratio, `${seed} ${id} bar ${bar + 1}`).toBeCloseTo(0.8, 3);
          } else expect(ratio, `${seed} ${id} bar ${bar + 1} (${kind}, ${role}) at ${n.start - bar * beats}`).toBeCloseTo(1, 3);
        });
      }
      expect(under).toBeGreaterThan(100);
    }
  });

  it("an ambient pianist's shimmer is played to be heard under the tune", () => {
    // its bells were written at 0.42 of the touch, 25 LU under the band in a head: inaudible
    for (const seed of [1, 2, 3]) {
      const s = take("ambient", seed);
      const head = s.frame.sections.find((x) => x.kind === "head")!;
      const beats = s.frame.meter.beats;
      const bells = s.parts.bear.filter((n) => n.start >= head.start * beats && n.start < (head.start + head.length) * beats && n.pitch >= 67);
      const tune = s.parts.fox.filter((n) => n.start >= head.start * beats && n.start < (head.start + head.length) * beats);
      const mean = (xs: NoteEvent[]) => xs.reduce((x, n) => x + n.vel, 0) / Math.max(1, xs.length);
      expect(bells.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(mean(bells) / mean(tune), `seed ${seed}`).toBeGreaterThan(0.45);
    }
  });
});
