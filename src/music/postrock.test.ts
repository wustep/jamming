import { describe, expect, it } from "vitest";
import { ECHO_BEATS, echoSeconds, echoSend } from "@/audio/echo";
import { parseBrief } from "./brief";
import { DRUM } from "./instruments";
import { defaultSettings, generateLocal } from "./local";
import { techniqueAt } from "./teach";
import { mod, parseChord, pcOf } from "./theory";
import type { Dynamic, KeySig, Member, NoteEvent, Score, StyleId } from "./types";

// Post-rock (Explosions in the Sky): one long crescendo, guitars ringing through a delay, a
// pedal bass, drums that start with nothing but swells and crest on crashes.

const band: Member[] = [
  { id: "fox", animal: "fox", name: "Rusty", instrument: "guitar" },
  { id: "cat", animal: "cat", name: "Mochi", instrument: "guitar" },
  { id: "penguin", animal: "penguin", name: "Pip", instrument: "vibes" },
  { id: "frog", animal: "frog", name: "Lily", instrument: "bass" },
  { id: "owl", animal: "owl", name: "Hoot", instrument: "drums" },
];
const E: KeySig = { tonic: "E", mode: "major" };

function take(seed: number, o: { bars?: number; key?: KeySig; style?: StyleId; members?: Member[] } = {}): Score {
  const members = o.members ?? band;
  return generateLocal({ ...defaultSettings(members), style: o.style ?? "postrock", key: o.key ?? E, tempo: 96, bars: o.bars ?? 32, seed, soloists: ["cat"] }, members).score;
}
const barOf = (s: Score, n: NoteEvent) => Math.floor(n.start / s.frame.meter.beats + 1e-9);
const inBar = (s: Score, id: string, b: number) => s.parts[id].filter((n) => barOf(s, n) === b).map((n) => ({ ...n, start: n.start - b * s.frame.meter.beats }));
const LOUD: Dynamic[] = ["pp", "p", "mp", "mf", "f", "ff"];
const crestOf = (s: Score) => s.frame.sections.find((x) => x.kind === "out")!.start;
const share = (xs: boolean[]) => xs.filter(Boolean).length / Math.max(1, xs.length);
const SEEDS = [1, 2, 3, 4, 5, 6];

describe("post-rock", () => {
  it("is one long crescendo: from pianissimo, never softer until the bar that rolls into the crest, then fortissimo", () => {
    for (const seed of SEEDS) {
      const s = take(seed);
      const crest = crestOf(s);
      expect(s.plan[0].dynamic).toBe("pp");
      for (let b = 1; b < crest - 1; b++) expect(LOUD.indexOf(s.plan[b].dynamic), `bar ${b + 1}`).toBeGreaterThanOrEqual(LOUD.indexOf(s.plan[b - 1].dynamic));
      expect(LOUD.indexOf(s.plan[crest - 2].dynamic)).toBeGreaterThanOrEqual(LOUD.indexOf("f"));
      expect(s.plan[crest - 1].texture).toBe("build");
      for (let b = crest; b < s.frame.bars; b++) expect(s.plan[b].dynamic).toBe("ff");
    }
  });

  it("starts from a guitar alone: the bass halfway through the intro, the drums only for its last bar", () => {
    const s = take(3);
    const intro = s.frame.sections.find((x) => x.kind === "intro")!;
    expect(intro.length).toBeGreaterThanOrEqual(2);
    const first = (id: string) => Math.min(...s.parts[id].map((n) => barOf(s, n)));
    expect(first("cat")).toBe(0);
    expect(first("frog")).toBe(intro.start + Math.floor(intro.length / 2));
    expect(first("owl")).toBe(intro.start + intro.length - 1);
    // no V7 turnaround into the head: post-rock just rings its own chords
    expect(s.frame.chords.slice(0, intro.length).flat().every((c) => parseChord(c.symbol).quality !== "dom")).toBe(true);
  });

  it("drums climb: no beat while it's quiet, floor tom as it builds, a snare roll into the crest, crashes on every 8th at the top", () => {
    for (const seed of SEEDS) {
      const s = take(seed);
      const crest = crestOf(s);
      for (let b = 0; b < crest - 1; b++) {
        const d = inBar(s, "owl", b);
        const level = LOUD.indexOf(s.plan[b].dynamic);
        // quiet: cymbals only (a bloom, a mallet roll), no kick or snare
        if (level <= LOUD.indexOf("p")) expect(d.filter((n) => n.pitch === DRUM.kick || n.pitch === DRUM.snare), `bar ${b + 1}`).toEqual([]);
        // building on the toms: a floor tom pulse, still no backbeat
        if (s.plan[b].dynamic === "mp" && s.plan[b].texture !== "sparse") {
          expect(d.filter((n) => n.pitch === DRUM.floorTom && n.start < 2).length, `bar ${b + 1}`).toBeGreaterThanOrEqual(3);
          expect(d.filter((n) => n.pitch === DRUM.snare && n.art !== "ghost" && n.start < 3).length, `bar ${b + 1}`).toBe(0);
        }
      }
      // the roll: the whole bar on the snare in 16ths, swelling
      const roll = inBar(s, "owl", crest - 1).filter((n) => n.pitch === DRUM.snare).sort((a, b) => a.start - b.start);
      expect(roll.length).toBeGreaterThanOrEqual(14);
      expect(roll[roll.length - 1].vel).toBeGreaterThan(roll[0].vel * 3);
      // the crest: crash on every 8th and the kick on every beat (the first half of the bar: a fill can take the end)
      const crestBars = Array.from({ length: s.frame.bars - 1 - crest }, (_, i) => crest + i);
      const full = crestBars.map((b) => {
        const d = inBar(s, "owl", b);
        const at = (p: number, t: number) => d.some((n) => n.pitch === p && Math.abs(n.start - t) < 1e-6);
        return [0, 0.5, 1, 1.5].every((t) => at(DRUM.crash, t)) && [0, 1].every((t) => at(DRUM.kick, t));
      });
      expect(share(full), `seed ${seed}`).toBeGreaterThan(0.8);
    }
  });

  it("the bass holds the tonic under the moving chords, then drives it in 8ths at the crest", () => {
    let under = 0;
    let tonic = 0;
    for (const seed of SEEDS) {
      const s = take(seed);
      const crest = crestOf(s);
      for (let b = 0; b < s.frame.bars - 1; b++) {
        const notes = inBar(s, "frog", b);
        if (!notes.length) continue;
        // quiet: one long note per chord
        if (LOUD.indexOf(s.plan[b].dynamic) <= LOUD.indexOf("p")) expect(notes.length, `seed ${seed} bar ${b + 1}`).toBe(s.plan[b].chords.length);
        if (b >= crest) expect(notes.length, `seed ${seed} bar ${b + 1}`).toBe(8);
        // over the IV and the vi the tonic stays down there
        for (const n of notes) {
          const c = parseChord(s.plan[b].chords.filter((x) => x.beat <= n.start + 1e-6).at(-1)!.symbol);
          if (c.root === pcOf("A") || c.root === pcOf("C#")) {
            under++;
            if (mod(n.pitch, 12) === pcOf("E")) tonic++;
          }
        }
      }
    }
    expect(under).toBeGreaterThan(50);
    expect(tonic / under).toBeGreaterThan(0.9);
  });

  it("the guitars ring open shapes and interlock, the tune sings over them, and the lead tremolos at the crest", () => {
    for (const seed of SEEDS) {
      const s = take(seed);
      const intro = s.frame.sections.find((x) => x.kind === "intro")!;
      for (let b = intro.start; b < intro.start + intro.length; b++) {
        const a = inBar(s, "fox", b);
        const c = inBar(s, "cat", b);
        // the first guitar's strings ring on; the second picks between them, never on top
        expect(share(a.map((n) => n.dur >= 1)), `bar ${b + 1}`).toBeGreaterThan(0.6);
        expect(c.filter((n) => a.some((x) => Math.abs(x.start - n.start) < 1e-6)), `bar ${b + 1}`).toEqual([]);
      }
      const head = s.frame.sections.find((x) => x.kind === "head")!;
      const tune = s.parts.fox.filter((n) => barOf(s, n) >= head.start && barOf(s, n) < head.start + head.length);
      expect(tune.reduce((sum, n) => sum + n.pitch, 0) / tune.length, `seed ${seed}`).toBeGreaterThan(64);
      // tremolo: the tune's long notes struck again and again in 16ths
      const crest = crestOf(s);
      const out = s.parts.fox.filter((n) => barOf(s, n) >= crest && barOf(s, n) < s.frame.bars - 1).sort((a, b) => a.start - b.start);
      let run = 1;
      let best = 1;
      for (let i = 1; i < out.length; i++) {
        run = out[i].pitch === out[i - 1].pitch && Math.abs(out[i].start - out[i - 1].start - 0.25) < 1e-6 ? run + 1 : 1;
        best = Math.max(best, run);
      }
      expect(best, `seed ${seed}`).toBeGreaterThanOrEqual(6);
    }
  });

  it("changes in add9 colours, home from IV (bVI in minor), never a V7", () => {
    for (const key of [E, { tonic: "D", mode: "minor" } as KeySig]) {
      for (let seed = 1; seed <= 20; seed++) {
        const s = take(seed, { key });
        const all = s.frame.chords.flat().map((c) => parseChord(c.symbol));
        expect(all.filter((c) => c.quality === "dom").map((c) => c.symbol)).toEqual([]);
        const last = s.frame.chords[s.frame.bars - 1][0].symbol;
        expect(last).toBe(key.mode === "major" ? "Eadd9" : "Dmadd9");
        const into = s.frame.chords[s.frame.bars - 2].at(-1)!.symbol;
        expect(into).toBe(key.mode === "major" ? "Aadd9" : "Bbadd9");
      }
    }
  });

  it("is its own thing: louder than ambient ever gets, and quieter at the start than a minimalist's pulse", () => {
    const pr = take(2);
    const amb = take(2, { style: "ambient" });
    const min = take(2, { style: "minimal" });
    // ambient never crests and never kicks; post-rock does both
    expect(amb.plan.some((b) => b.dynamic === "ff")).toBe(false);
    expect(amb.parts.owl.some((n) => n.pitch === DRUM.kick && n.vel > 0.3)).toBe(false);
    expect(pr.parts.owl.filter((n) => n.pitch === DRUM.kick).length).toBeGreaterThan(40);
    // a minimalist's bass pulses from the first bar it plays; a post-rock bass waits, then holds
    const firstBass = (s: Score) => inBar(s, "frog", Math.min(...s.parts.frog.map((n) => barOf(s, n))));
    expect(firstBass(min).length).toBeGreaterThanOrEqual(8);
    expect(firstBass(pr).length).toBeLessThanOrEqual(2);
  });

  it("names what each player is doing as the band climbs", () => {
    const s = take(3);
    const crest = crestOf(s);
    const quiet = s.plan.findIndex((b) => b.dynamic === "p" && b.roles.owl === "groove");
    expect(techniqueAt(s, "owl", quiet).name).toBe("cymbal swells");
    expect(techniqueAt(s, "owl", crest - 1).name).toBe("snare roll");
    expect(techniqueAt(s, "owl", crest).name).toBe("the crest");
    expect(techniqueAt(s, "frog", crest).name).toBe("driving pedal");
    expect(techniqueAt(s, "cat", 0).name).toBe("delay wash");
  });

  it("puts a dotted-8th delay on the guitars, only in post-rock", () => {
    expect(ECHO_BEATS).toBe(0.75);
    expect(echoSeconds(0.6)).toBeCloseTo(0.45);
    expect(echoSeconds(10)).toBeLessThanOrEqual(1.2);
    expect(echoSend("postrock", "guitar")).toBeGreaterThan(echoSend("postrock", "piano"));
    expect(echoSend("postrock", "piano")).toBeGreaterThan(0);
    expect(echoSend("postrock", "drums")).toBe(0);
    expect(echoSend("postrock", "bass")).toBe(0);
    for (const style of ["swing", "ambient", "minimal", "pop"] as StyleId[]) expect(echoSend(style, "guitar")).toBe(0);
  });

  it("is asked for by name, and by the band", () => {
    expect(parseBrief("something post-rock and huge").style).toBe("postrock");
    expect(parseBrief("a slow build with guitars").style).toBe("postrock");
    expect(parseBrief("play like Explosions in the Sky").preset).toBe("eits");
    // a plain rock song is still pop
    expect(parseBrief("a rock anthem").style).toBe("pop");
  });
});
