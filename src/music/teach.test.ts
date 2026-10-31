import { describe, expect, it } from "vitest";
import { ANIMALS, defaultMembers } from "./instruments";
import { defaultSettings, generateLocal } from "./local";
import { PRESETS } from "./presets";
import { STYLES, STYLE_LIST } from "./styles";
import { jamGuide, techniqueAt } from "./teach";
import type { Member, Score, StyleId } from "./types";

const quartet = defaultMembers(); // Bruno piano, Lily bass, Hoot drums, Rusty trumpet (leader)
const band: Member[] = [...quartet, { id: "cat", animal: "cat", name: "Mochi", instrument: "sax" }];

function take(style: StyleId, seed: number, bars = 32, members = band, standard: string | null = null): Score {
  const s = { ...defaultSettings(members), style, bars, seed, standard, tempo: STYLES[style].tempo.default, key: { ...STYLES[style].key } };
  return generateLocal(s, members).score;
}

const presetTake = (p: (typeof PRESETS)[number], seed: number): Score => {
  const members = p.band.map((b) => ({ id: b.animal, animal: b.animal, name: ANIMALS[b.animal].name, instrument: b.instrument }));
  return generateLocal({ ...defaultSettings(members), style: p.style, feel: p.feel, harmony: p.harmony, preset: p.id, tempo: p.tempo, key: p.key, meter: { beats: p.meter ?? 4 }, leaderId: members[0].id, soloists: p.soloists, seed, bars: 32 }, members).score;
};

const allTakes = (): Score[] => [
  ...STYLE_LIST.flatMap((style) => [1, 2, 3].map((seed) => take(style, seed))),
  ...PRESETS.map((p) => presetTake(p, 1)),
  take("swing", 1, 96, band, "autumn"),
  take("swing", 2, 64, [...band, { id: "owl2", animal: "penguin", name: "Pip", instrument: "vibes" }]),
  // the drummer solos too: the horns trade with them
  generateLocal({ ...defaultSettings(band), bars: 32, seed: 4, soloists: ["bear", "cat", "owl"] }, band).score,
  generateLocal({ ...defaultSettings(band), bars: 96, seed: 5, standard: "autumn", soloists: ["cat", "owl"] }, band).score,
];

describe("what each player is doing", () => {
  it("names every player in every bar, in words short enough for a name tag", () => {
    for (const score of allTakes()) {
      for (let bar = 0; bar < score.frame.bars; bar++) {
        for (const m of score.members) {
          const tech = techniqueAt(score, m.id, bar);
          const where = `${score.title} bar ${bar + 1} ${m.name}`;
          expect(tech.name.length, where).toBeGreaterThan(0);
          expect(tech.what, where).toMatch(/^[A-Z“].+[.”]$/);
          // a phone's name tag holds about 20 characters
          expect((tech.tag ?? tech.name).length, `${where}: ${tech.tag ?? tech.name}`).toBeLessThanOrEqual(20);
        }
      }
    }
  });

  it("reads a swing quartet the way a musician would", () => {
    const score = take("swing", 1, 32, quartet);
    const head = score.frame.sections.find((s) => s.kind === "head")!;
    const solo = score.frame.sections.find((s) => s.kind === "solo")!;
    const at = (id: string, bar: number) => techniqueAt(score, id, bar).name;
    expect(at("frog", head.start)).toBe("two-feel");
    // the bass starts walking on the head's last bar, lifting into the solos
    expect(at("frog", head.start + head.length - 1)).toBe("walking bass");
    expect(at("owl", head.start)).toBe("hi-hat time");
    expect(at("bear", head.start)).toBe("comping");
    expect(techniqueAt(score, "fox", head.start).tag ?? at("fox", head.start)).toBe("the tune");
    // past any stop-time at the top of the solo: the ride, and the bass walking
    const deep = solo.start + solo.length - 2;
    expect(at("owl", deep)).toBe("ride pattern");
    expect(at("frog", deep)).toBe("walking bass");
    expect(techniqueAt(score, "bear", deep).tag).toBe("solo");
    expect(at("fox", deep)).toBe("laying out");
    expect(at("frog", score.frame.bars - 1)).toBe("last chord");
  });

  it("names stop-time and breakdowns for the band, never for the soloist", () => {
    let seen = 0;
    for (const style of ["swing", "funk", "neworleans", "pop"] as const) {
      for (let seed = 1; seed <= 8; seed++) {
        const score = take(style, seed);
        score.plan.forEach((bp, bar) => {
          if (bp.texture !== "stoptime" && bp.texture !== "breakdown") return;
          seen++;
          for (const m of score.members) {
            const role = bp.roles[m.id];
            const name = techniqueAt(score, m.id, bar).name;
            if (role === "solo") expect(["stop-time", "breakdown"]).not.toContain(name);
            else if (m.instrument === "drums") expect(name).toBe(bp.texture === "stoptime" ? "stop-time" : "breakdown");
          }
        });
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("names an artist's own figures where they play them", () => {
    const named = (id: string, want: string) => {
      const p = PRESETS.find((x) => x.id === id)!;
      const score = presetTake(p, 1);
      const names = new Set(score.members.flatMap((m) => score.plan.map((_, b) => techniqueAt(score, m.id, b).name)));
      expect([...names], id).toContain(want);
    };
    named("son", "montuno");
    named("son", "tumbao");
    named("son", "clave");
    named("miles", "“So What” chords");
    named("fela", "afrobeat groove");
  });

  it("falls back on the role for bars a model wrote out note by note", () => {
    const score = take("swing", 1, 32, quartet);
    const solo = score.frame.sections.find((s) => s.kind === "solo")!;
    const bar = solo.start + 3;
    const written: Score = { ...score, plan: score.plan.map((bp, i) => (i === bar ? { ...bp, directives: { ...bp.directives, frog: "C2/4 D2/4 E2/4 G2/4", bear: "[C4 E4 G4]/2 r/2" } } : bp)) };
    expect(techniqueAt(written, "frog", bar).name).toBe("bass line");
    expect(techniqueAt(written, "bear", bar).tag).toBe("solo");
  });
});

describe("how the take is built", () => {
  it("covers every bar once, in order, with a line for every player", () => {
    for (const score of allTakes()) {
      const guide = jamGuide(score);
      let next = 1;
      for (const g of guide) {
        expect(g.from).toBe(next);
        expect(g.to).toBeGreaterThanOrEqual(g.from);
        next = g.to + 1;
        expect(g.what.length).toBeGreaterThan(0);
        expect(g.players.map((p) => p.id)).toEqual(score.members.map((m) => m.id));
        for (const p of g.players) {
          expect(p.steps.length, `${score.title} ${g.section.name} ${p.name}`).toBeGreaterThan(0);
          for (const s of p.steps) expect(s.what, `${score.title} ${g.section.name} ${p.name} ${s.name}`).toMatch(/^[A-Z“].+[.”]$/);
        }
      }
      expect(next - 1).toBe(score.frame.bars);
    }
  });

  it("names trading for the horns and the drummer, once each however many turns they take", () => {
    const score = generateLocal({ ...defaultSettings(band), bars: 96, seed: 5, standard: "autumn", soloists: ["cat", "owl"] }, band).score;
    const trade = jamGuide(score).find((g) => g.section.kind === "trade")!;
    expect(trade.what).toMatch(/take turns, four bars each: call and response\.$/);
    const steps = (id: string) => trade.players.find((p) => p.id === id)!.steps.map((s) => s.name);
    expect(steps("cat")).toEqual(["trading 4s", "laying out"]);
    expect(steps("owl")).toContain("drum break");
    for (const p of trade.players) expect(new Set(p.steps.map((s) => s.id)).size).toBe(p.steps.length);
  });

  it("tells a solo and the tune as one story each", () => {
    const score = take("swing", 3, 32, quartet);
    const guide = jamGuide(score);
    const head = guide.find((g) => g.section.kind === "head")!;
    const solo = guide.find((g) => g.section.kind === "solo")!;
    const fox = head.players.find((p) => p.id === "fox")!;
    expect(fox.steps.map((s) => s.name)).toEqual(["the tune"]);
    expect(fox.steps[0].what).toMatch(/^Built from the motif/);
    const bear = solo.players.find((p) => p.id === "bear")!;
    expect(bear.steps[0].name).toBe("solo");
    expect(bear.steps[0].what).toMatch(/^(Opens with|Makes up)/);
    // the head of a long swing chart goes in two, then walks: worth listening for
    const longHead = jamGuide(take("swing", 1, 32, quartet)).find((g) => g.section.kind === "head")!;
    expect(longHead.moves).toEqual(expect.arrayContaining(["two-feel", "walking bass"]));
  });
});

describe("arrangements that differ from take to take", () => {
  const firstSolo = (score: Score) => score.frame.sections.find((s) => s.kind === "solo")!;

  it("a one-soloist swing take sometimes opens its solo in stop-time", () => {
    const opens = Array.from({ length: 12 }, (_, i) => take("swing", i + 1, 16, quartet)).map((s) => s.plan[firstSolo(s).start].texture === "stoptime");
    expect(opens.some(Boolean)).toBe(true);
    expect(opens.every(Boolean)).toBe(false);
  });

  it("a funk intro sometimes builds one layer at a time: drums, then bass, then the rest", () => {
    let layered = 0;
    let together = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const score = take("funk", seed, 32, quartet);
      const intro = score.frame.sections.find((s) => s.kind === "intro")!;
      const on = (id: string, bar: number) => score.plan[bar].roles[id] !== "rest";
      const guide = jamGuide(score)[0];
      if (!on("frog", intro.start)) {
        layered++;
        expect(on("owl", intro.start)).toBe(true);
        expect(on("frog", intro.start + 1)).toBe(true);
        expect(guide.moves[0]).toBe("layered intro");
        expect(guide.what).toBe("The groove is built one layer at a time: Hoot first, then Lily.");
        // the drummer counts it in and says how it goes
        expect(score.chat.find((c) => c.bar === intro.start)?.from).toBe("owl");
      } else {
        together++;
        expect(guide.moves).not.toContain("layered intro");
      }
    }
    expect(layered).toBeGreaterThan(0);
    expect(together).toBeGreaterThan(0);
  });

  it("a layered bossa intro brings the chords in on the third bar", () => {
    const score = Array.from({ length: 12 }, (_, i) => take("bossa", i + 1, 32, quartet)).find((s) => s.plan[0].roles.frog === "rest");
    expect(score).toBeTruthy();
    expect(jamGuide(score!)[0].what).toBe("The groove is built one layer at a time: Hoot first, then Lily, then Bruno.");
    const roles = (bar: number) => quartet.filter((m) => m.id !== "fox").map((m) => score!.plan[bar].roles[m.id] !== "rest");
    // bear, frog, owl
    expect(roles(0)).toEqual([false, false, true]);
    expect(roles(1)).toEqual([false, true, true]);
    expect(roles(2)).toEqual([true, true, true]);
  });
});
