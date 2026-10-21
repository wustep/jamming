import { describe, expect, it } from "vitest";
import { DRUM_KITS, PAD_VOICES, PIANO_PACKS, ROOMS } from "@/audio/packs";
import { decodeShare, encodeJam, jamOf } from "@/state/share";
import { HARMONY_BOOKS } from "./harmony-books";
import { ANIMALS, INSTRUMENTS } from "./instruments";
import { defaultSettings, generateLocal } from "./local";
import { FEELS } from "./playing";
import { PRESET_GROUPS, PRESETS, searchPresets, type PresetId } from "./presets";
import { harmonyOf } from "./realize";
import { STYLES } from "./styles";
import { chordPcs, mod, parseChord, pcOf } from "./theory";
import type { Member, NoteEvent, Score } from "./types";

const bandOf = (p: (typeof PRESETS)[number]): Member[] => p.band.map((b) => ({ id: b.animal, animal: b.animal, name: ANIMALS[b.animal].name, instrument: b.instrument }));

const takeOf = (p: (typeof PRESETS)[number], seed: number): Score => {
  const band = bandOf(p);
  return generateLocal({ ...defaultSettings(band), style: p.style, feel: p.feel, harmony: p.harmony, preset: p.id, tempo: p.tempo, key: p.key, meter: { beats: p.meter ?? 4 }, leaderId: band[0].id, soloists: p.soloists, seed, bars: 32 }, band).score;
};

describe("artist presets", () => {
  it("set a style, a feel, a book and sounds this build has, and a band that can play", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    expect(new Set(PRESETS.map((p) => p.name)).size).toBe(PRESETS.length);
    for (const p of PRESETS) {
      expect(PRESET_GROUPS.map((g) => g.id), p.id).toContain(p.group);
      expect(p.tags.length, p.id).toBeGreaterThan(0);
      expect([undefined, 3], p.id).toContain(p.meter);
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
      const settings = { ...defaultSettings(band), style: p.style, feel: p.feel, harmony: p.harmony, preset: p.id, tempo: p.tempo, key: p.key, meter: { beats: p.meter ?? 4 }, leaderId: band[0].id, soloists: p.soloists, seed: 11, bars: 32 };
      const { score } = generateLocal(settings, band);
      expect(score.frame.feel ?? score.frame.style, p.id).toBe(p.feel === p.style ? p.style : p.feel);
      // named for the artist, as the takes list names it (not "Minimalist" for Hans Zimmer)
      expect(score.title, p.id).toBe(p.name);
      for (const m of band) expect(score.parts[m.id].length, `${p.id} ${m.instrument}`).toBeGreaterThan(0);
      const shared = decodeShare(encodeJam(jamOf(score)))!;
      expect(shared.settings).toMatchObject({ feel: p.feel, harmony: p.harmony, preset: p.id });
      expect(generateLocal({ ...defaultSettings(shared.members), ...shared.settings }, shared.members).score.parts).toEqual(score.parts);
    }
  });


  it("sit on every shelf of the picker, and a search finds them by name, tune or genre", () => {
    for (const g of PRESET_GROUPS) expect(PRESETS.filter((p) => p.group === g.id).length, g.id).toBeGreaterThanOrEqual(3);
    expect(searchPresets("").length).toBe(PRESETS.length);
    expect(searchPresets("monk").map((p) => p.id)).toEqual(["monk"]);
    expect(searchPresets("kind of blue").map((p) => p.id)).toEqual(["miles"]);
    expect(searchPresets("Afrobeat").map((p) => p.id)).toEqual(["fela"]);
    expect(searchPresets("waltz").map((p) => p.id)).toEqual(expect.arrayContaining(["evans", "hisaishi"]));
    expect(searchPresets("nothing like this")).toEqual([]);
  });

  describe("bring their own figures, heard in the notes", () => {
    const takes = (id: PresetId) => [1, 2, 3].map((seed) => takeOf(PRESETS.find((p) => p.id === id)!, seed));
    const barOf = (s: Score, n: NoteEvent) => Math.floor(n.start / s.frame.meter.beats + 1e-9);
    const posOf = (s: Score, n: NoteEvent) => Math.round((n.start - barOf(s, n) * s.frame.meter.beats) * 4) / 4;
    /** Notes struck together, grouped by onset. */
    const chordsOf = (notes: NoteEvent[]) => {
      const by = new Map<number, NoteEvent[]>();
      for (const n of notes) by.set(Math.round(n.start * 48), [...(by.get(Math.round(n.start * 48)) ?? []), n]);
      return [...by.values()].filter((g) => g.length >= 3).map((g) => g.map((n) => n.pitch).sort((a, b) => a - b));
    };
    const roleIs = (s: Score, id: string, n: NoteEvent, ...roles: string[]) => roles.includes(s.plan[barOf(s, n)]?.roles[id] ?? "");
    const share = (xs: boolean[]) => xs.filter(Boolean).length / Math.max(1, xs.length);

    it("Bill Evans: rootless chords, five-note spreads when he comps, in three", () => {
      let rootless = 0;
      let all = 0;
      let spreads = 0;
      for (const s of takes("evans")) {
        expect(s.frame.meter.beats).toBe(3);
        const beats = s.frame.meter.beats;
        const groups = new Map<number, NoteEvent[]>();
        for (const n of s.parts.bear) groups.set(Math.round(n.start * 48), [...(groups.get(Math.round(n.start * 48)) ?? []), n]);
        for (const g of groups.values()) {
          if (g.length < 3) continue;
          all++;
          if (g.length >= 5) spreads++;
          // the root is the bassist's: count the chords that leave it out
          const t = g[0].start;
          const bar = Math.floor(t / beats + 1e-9);
          let sym = s.frame.chords[bar][0].symbol;
          for (const c of s.frame.chords[bar]) if (c.beat <= t - bar * beats + 1e-6) sym = c.symbol;
          if (!g.some((n) => mod(n.pitch, 12) === parseChord(sym).root)) rootless++;
        }
      }
      expect(rootless / all, `${rootless} of ${all}`).toBeGreaterThan(0.6);
      expect(spreads).toBeGreaterThan(20);
    });

    it("Monk: chords with a half step inside them, and whole-tone runs off the dominants", () => {
      let crunch = 0;
      let chords = 0;
      let runs = 0;
      for (const s of takes("monk")) {
        for (const c of chordsOf(s.parts.bear)) {
          chords++;
          if (c.some((p, i) => i > 0 && p - c[i - 1] === 1)) crunch++;
        }
        for (const id of ["bear", "cat"]) {
          const line = s.parts[id].filter((n) => roleIs(s, id, n, "lead", "solo") && n.pitch >= 55);
          for (let i = 0; i + 3 < line.length; i++) if ([1, 2, 3].every((k) => line[i + k - 1].pitch - line[i + k].pitch === 2 && Math.abs(line[i + k].start - line[i + k - 1].start - 0.5) < 1e-6)) runs++;
        }
      }
      expect(crunch / chords, `${crunch} of ${chords}`).toBeGreaterThan(0.3);
      expect(runs).toBeGreaterThanOrEqual(5);
    });

    it("Miles: the bass riff, and the piano's two-chord answer on the and of 3 and on 4", () => {
      for (const s of takes("miles")) {
        const heads = s.plan.map((b, i) => (b.section.startsWith("Head") ? i : -1)).filter((i) => i >= 0);
        expect(heads.length).toBeGreaterThan(4);
        const answers = heads.filter((bar) => {
          const at = (pos: number) => s.parts.bear.filter((n) => barOf(s, n) === bar && posOf(s, n) === pos).length >= 3;
          return at(2.5) && at(3);
        });
        const riffs = heads.filter((bar) => s.parts.frog.filter((n) => barOf(s, n) === bar && n.start % 1 === 0.5).length >= 3);
        expect(answers.length, s.frame.chords.map((b) => b[0].symbol).join(" ")).toBeGreaterThanOrEqual(heads.length / 2 - 1);
        expect(riffs.length).toBeGreaterThanOrEqual(heads.length / 2 - 1);
      }
    });

    it("son: a tumbao that skips the one and lands on 4, against a 2–3 clave", () => {
      for (const s of takes("son")) {
        const bars = s.plan.map((_, i) => i).filter((i) => i > 0 && s.plan[i].roles.frog === "bass" && i < s.frame.bars - 2);
        const on = (bar: number, pos: number) => s.parts.frog.some((n) => barOf(s, n) === bar && posOf(s, n) === pos);
        expect(share(bars.map((b) => on(b, 1.5) && on(b, 3)))).toBeGreaterThan(0.9);
        expect(share(bars.map((b) => !on(b, 0)))).toBeGreaterThan(0.6);
        // the 4 is the next bar's root, a beat early (not bent onto the chord it's leaving), and
        // the line around it stays inside an octave
        for (const b of bars.filter((b) => s.frame.chords[b + 1]?.[0].beat === 0)) {
          const four = s.parts.frog.find((n) => barOf(s, n) === b && posOf(s, n) === 3);
          if (four) expect(mod(four.pitch, 12), `bar ${b + 1}`).toBe(parseChord(s.frame.chords[b + 1][0].symbol).bass);
        }
        const line = s.parts.frog.filter((n) => n.art !== "ghost").sort((x, y) => x.start - y.start);
        expect(line.every((n, i) => i === 0 || Math.abs(n.pitch - line[i - 1].pitch) <= 12)).toBe(true);
        const rim = s.parts.owl.filter((n) => n.pitch === 37);
        const sides = new Set(s.plan.map((_, b) => rim.filter((n) => barOf(s, n) === b).length));
        expect([...sides].filter((k) => k === 2 || k === 3).length).toBe(2);
      }
    });

    it("Fela: the guitar chops sixteenths and the bass plays one riff all night", () => {
      for (const s of takes("fela")) {
        const groove = s.plan.map((_, i) => i).filter((i) => s.plan[i].roles.bear === "comp");
        expect(share(groove.map((b) => s.parts.bear.filter((n) => barOf(s, n) === b && n.start % 0.5 !== 0).length >= 4))).toBeGreaterThan(0.8);
        const rhythms = new Set(s.plan.map((_, b) => s.parts.frog.filter((n) => barOf(s, n) === b).map((n) => posOf(s, n)).join(",")).filter(Boolean));
        expect(rhythms.size).toBeLessThanOrEqual(4);
      }
    });

    it("Stevie: the clavinet plays sixteenths; Herbie: the synth-bass riff doesn't change", () => {
      for (const s of takes("stevie")) {
        const comp = s.parts.bear.filter((n) => roleIs(s, "bear", n, "comp"));
        expect(share(comp.map((n) => n.start % 0.5 !== 0))).toBeGreaterThan(0.2);
        expect(share(comp.map((n) => n.dur <= 0.25))).toBeGreaterThan(0.9);
      }
      for (const s of takes("herbie")) {
        const rhythms = new Set(s.plan.map((_, b) => s.parts.frog.filter((n) => barOf(s, n) === b).map((n) => posOf(s, n)).join(",")).filter(Boolean));
        expect(rhythms.size).toBeLessThanOrEqual(4);
      }
    });

    it("Guaraldi's and Einaudi's left hands run in 8ths under their own tune", () => {
      for (const id of ["guaraldi", "einaudi"] as const) {
        for (const s of takes(id)) {
          const lead = s.plan.map((_, i) => i).filter((i) => ["lead", "solo"].includes(s.plan[i].roles.bear) && i < s.frame.bars - 1);
          // the left hand: everything under the tune's register, on the 8ths (Einaudi's tenth reaches E4)
          const low = (b: number) => s.parts.bear.filter((n) => barOf(s, n) === b && n.pitch < 65 && n.start % 0.5 === 0).length;
          expect(share(lead.map((b) => low(b) >= s.frame.meter.beats * 2 - 1)), id).toBeGreaterThan(0.8);
        }
      }
    });

    it("Satie and Hisaishi: a bass note on one, the chord after it, in three", () => {
      for (const id of ["satie", "hisaishi"] as const) {
        for (const s of takes(id)) {
          expect(s.frame.meter.beats).toBe(3);
          const comp = s.plan.map((_, i) => i).filter((i) => s.plan[i].roles.bear === "comp" && i < s.frame.bars - 1);
          const ok = comp.map((b) => {
            const ns = s.parts.bear.filter((n) => barOf(s, n) === b);
            return ns.some((n) => posOf(s, n) === 0 && n.pitch < 52) && ns.filter((n) => posOf(s, n) === 1).length >= 3;
          });
          expect(share(ok), id).toBeGreaterThan(0.8);
        }
      }
    });

    it("Frahm: one note repeated; Sakamoto: bells in the key's pentatonic", () => {
      for (const s of takes("frahm")) {
        const bars = s.plan.map((_, i) => i).filter((i) => s.plan[i].roles.penguin === "comp" && i < s.frame.bars - 1);
        const repeated = bars.map((b) => {
          const ps = s.parts.penguin.filter((n) => barOf(s, n) === b).map((n) => n.pitch);
          const most = Math.max(...ps.map((p) => ps.filter((q) => q === p).length));
          return ps.length >= 6 && most >= ps.length - 2;
        });
        expect(share(repeated)).toBeGreaterThan(0.6);
      }
      for (const s of takes("sakamoto")) {
        const t = pcOf(s.frame.key.tonic);
        const pent = [0, 2, 4, 7, 9].map((i) => mod(t + i, 12));
        const bells = s.parts.penguin.filter((n) => roleIs(s, "penguin", n, "comp"));
        expect(bells.length).toBeGreaterThan(100);
        // a few step aside for the tune (the ensemble's moves)
        expect(share(bells.map((n) => pent.includes(mod(n.pitch, 12))))).toBeGreaterThan(0.9);
      }
    });
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
    // 16 of 18,581 are left where no free note was near (60 before legato quarters counted)
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

  it("a walking line steps off a held note instead of leaping an octave away from it", () => {
    // Basie, Evans, Miles, Monk and Bach: an approach note that rubbed against the piano used to
    // drop an octave (Ab2, A1, Bb2): 41 leaps past the octave in these takes, now 4.
    let leaps = 0;
    for (const id of ["basie", "evans", "miles", "monk", "bach"]) {
      const p = PRESETS.find((x) => x.id === id)!;
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const score = takeOf(p, seed);
        const beats = score.frame.meter.beats;
        for (const m of score.members) {
          const line = score.parts[m.id].filter((n) => n.art !== "ghost" && score.plan[Math.floor(n.start / beats + 1e-9)]?.roles[m.id] === "bass").sort((a, b) => a.start - b.start);
          for (let i = 1; i < line.length; i++) {
            if (line[i].start - line[i - 1].start <= 2 && Math.abs(line[i].pitch - line[i - 1].pitch) > 12) leaps++;
          }
        }
      }
    }
    expect(leaps).toBeLessThanOrEqual(4);
  });

  it("a bossa line leans on half steps now and then, not on every beat", () => {
    // every pair of beat notes a step apart had a chromatic note between them: Laufey's lines
    // crawled (F#, G#, G, F, F#, F, E over Gmaj9) with 31 of 1000 notes outside chord and key
    for (const [id, most] of [["laufey", 0.012], ["jobim", 0.015]] as const) {
      const p = PRESETS.find((x) => x.id === id)!;
      let n = 0;
      let out = 0;
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const score = takeOf(p, seed);
        const H = harmonyOf(score.frame, score.plan);
        const beats = score.frame.meter.beats;
        const tonic = pcOf(score.frame.key.tonic);
        const key = (score.frame.key.mode === "minor" ? [0, 2, 3, 5, 7, 8, 9, 10, 11] : [0, 2, 4, 5, 7, 9, 11]).map((i) => mod(tonic + i, 12));
        for (const m of score.members) {
          for (const x of score.parts[m.id]) {
            const role = score.plan[Math.floor(x.start / beats + 1e-9)]?.roles[m.id];
            if ((role !== "solo" && role !== "lead") || x.written) continue;
            const h = H.at(x.start);
            const pc = mod(x.pitch, 12);
            n++;
            if (!h.scale.includes(pc) && !h.blue.includes(pc) && !key.includes(pc)) out++;
          }
        }
      }
      expect(out / n, `${id}: ${out} of ${n}`).toBeLessThan(most);
    }
  });

  it("a comping chord isn't struck a half step against a note another player is still holding", () => {
    // Jobim: the piano anticipates G13 with its 7th (F4) and the guitar's own voicing strikes the
    // 13th (E4) under it; or the guitar comps against the soloing piano's left hand
    let rubs = 0;
    let chords = 0;
    for (const p of PRESETS) {
      for (const seed of [1, 2, 3, 4]) {
        const score = takeOf(p, seed);
        const beats = score.frame.meter.beats;
        const planOf = (t: number) => score.plan[Math.floor(t / beats + 1e-9)];
        for (const m of score.members) {
          if (!INSTRUMENTS[m.instrument].poly || INSTRUMENTS[m.instrument].fn === "rhythm") continue;
          for (const n of score.parts[m.id]) {
            const role = planOf(n.start)?.roles[m.id];
            if ((role !== "comp" && role !== "pad") || n.written) continue;
            chords++;
            for (const o of score.members) {
              if (o.id === m.id || o.instrument === "drums") continue;
              const soloing = planOf(n.start)?.roles[o.id] === "solo";
              for (const x of score.parts[o.id]) {
                const before = x.start < n.start - 1e-6 || (soloing && Math.abs(x.start - n.start) < 1e-6);
                const held = x.dur >= 0.95 && before && x.start + x.dur - n.start >= 0.25;
                if (held && (Math.abs(x.pitch - n.pitch) === 1 || Math.abs(x.pitch - n.pitch) === 13)) rubs++;
              }
            }
          }
        }
      }
    }
    // 6 of 20,468 are left where no free note was near: Debussy's vibes, and two of Hisaishi's
    // waltz chords under the flute's held 11th (84 before)
    expect(chords).toBeGreaterThan(5000);
    expect(rubs, `${rubs} of ${chords}`).toBeLessThanOrEqual(6);
  });
});
