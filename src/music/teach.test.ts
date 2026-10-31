import { describe, expect, it } from "vitest";
import { ANIMALS, defaultMembers } from "./instruments";
import { defaultSettings, generateLocal } from "./local";
import { PRESETS } from "./presets";
import { STYLES, STYLE_LIST } from "./styles";
import { parseDrumGrid } from "./notation";
import { realize } from "./realize";
import { barsText, changesIn, drumMoveAt, jamGuide, takeIdea, techniqueAt } from "./teach";
import type { DrumMove, Member, Score, StyleId } from "./types";

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
          // and so does a fill's, from the beat it starts
          for (const at of changesIn(score, bar)) {
            const fill = techniqueAt(score, m.id, bar, at);
            expect(fill.what, where).toMatch(/^[A-Z“].+[.”]$/);
            expect((fill.tag ?? fill.name).length, `${where}: ${fill.name}`).toBeLessThanOrEqual(20);
          }
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

describe("the drummer's fills and rolls", () => {
  const FILL_STYLES: StyleId[] = ["swing", "bossa", "funk", "pop", "neworleans", "postrock"];
  const NAMES: Record<Exclude<DrumMove, "ring">, string> = {
    run: "tom run",
    setup: "set-up",
    drag: "drag",
    toms: "tom fill",
    press: "press roll",
    ghosts: "ghost-note fill",
    hats: "open hi-hat",
    rim: "cross-stick pickup",
    roll: "snare roll",
  };

  it("names each fill from the beat it starts, and says why it's there", () => {
    const heard = new Set<string>();
    for (const style of FILL_STYLES) {
      for (let seed = 1; seed <= 6; seed++) {
        const score = take(style, seed, 32, quartet);
        for (let bar = 0; bar < score.frame.bars; bar++) {
          const move = drumMoveAt(score, "owl", bar);
          if (!move || move.move === "ring") continue;
          const where = `${style} ${seed} bar ${bar + 1}`;
          const fill = techniqueAt(score, "owl", bar, move.from);
          expect(fill.name, where).toBe(NAMES[move.move!]);
          heard.add(move.move!);
          // the bar's time comes first: the tag says the groove until the fill starts
          if (move.from > 0) expect(techniqueAt(score, "owl", bar, 0).name, where).not.toBe(fill.name);
          const sec = score.frame.sections.find((s) => bar >= s.start && bar < s.start + s.length)!;
          const sectionEnd = bar === sec.start + sec.length - 1 && bar < score.frame.bars - 1;
          expect(fill.what, where).toMatch(sectionEnd ? / leads the band into .+\.$/ : /It ends the phrase, so the band hears the next one coming\.$/);
        }
      }
    }
    // every fill a style keeps in its vocabulary is played, and named, somewhere (post-rock's
    // big snare roll would come where a loud section ends, but its climb already rolls up there:
    // the "snare roll" stage)
    expect([...heard].sort()).toEqual(Object.keys(NAMES).filter((k) => k !== "roll").sort());
  });

  it("says when the whole band's tags change mid-bar: only where a fill starts", () => {
    const score = take("neworleans", 2, 32, quartet);
    for (let bar = 0; bar < score.frame.bars; bar++) {
      const move = drumMoveAt(score, "owl", bar);
      expect(changesIn(score, bar), `bar ${bar + 1}`).toEqual(move && move.from > 0 ? [move.from] : []);
    }
  });

  it("names the cymbal roll under a big last chord, and not a button ending", () => {
    const last = (style: StyleId) => {
      const score = take(style, 1, 32, quartet);
      return techniqueAt(score, "owl", score.frame.bars - 1).name;
    };
    for (const style of ["swing", "neworleans", "pop", "postrock"] as const) expect(last(style), style).toBe("cymbal roll");
    for (const style of ["funk", "bossa", "baroque"] as const) expect(last(style), style).toBe("last chord");
  });

  it("plays the fill a model's drummer asks for, every time, and names it", () => {
    for (const [style, ask, name] of [["neworleans", "press", "press roll"], ["swing", "drag", "drag"], ["funk", "hats", "open hi-hat"]] as const) {
      const score = take(style, 1, 32, quartet);
      for (const bar of [5, 6, 9, 10]) {
        const plan = score.plan.map((bp, i) => (i === bar ? { ...bp, directives: { ...bp.directives, owl: `@fill ${ask}` } } : bp));
        const asked: Score = { ...score, plan, parts: realize({ frame: score.frame, members: score.members, plan, motif: score.motif, seed: 1 }).parts };
        const move = drumMoveAt(asked, "owl", bar);
        expect(move?.move, `${style} bar ${bar + 1}`).toBe(ask);
        expect(techniqueAt(asked, "owl", bar).name).toBe(name);
        // and the guide folds it in with the section's other fills
        const sec = jamGuide(asked).find((g) => bar + 1 >= g.from && bar + 1 <= g.to)!;
        const fills = sec.players.find((p) => p.id === "owl")!.steps.find((x) => x.id === "fills")!;
        expect(fills.what).toContain(name === "open hi-hat" ? "an open hi-hat" : `a ${name}`);
      }
    }
  });

  it("finds a fill in a drum grid a model wrote, from where it starts", () => {
    const score = take("funk", 1, 32, quartet);
    const bar = 6;
    const grid = "hh:x.x.x.x.x.x.... sd:....X.......XXXX bd:x.....x.........";
    const beats = score.frame.meter.beats;
    const notes = parseDrumGrid(grid, beats).notes.map((n) => ({ ...n, start: n.start + bar * beats }));
    const written: Score = {
      ...score,
      plan: score.plan.map((bp, i) => (i === bar ? { ...bp, directives: { ...bp.directives, owl: grid } } : bp)),
      parts: { ...score.parts, owl: [...score.parts.owl.filter((n) => Math.floor(n.start / beats) !== bar), ...notes] },
    };
    expect(drumMoveAt(written, "owl", bar)).toEqual({ move: null, from: 3 });
    expect(techniqueAt(written, "owl", bar, 3).name).toBe("fill");
    expect(techniqueAt(written, "owl", bar, 0).name).toBe("the pocket");
    // a plain written groove has no fill in it
    const plain = { ...written, parts: { ...written.parts, owl: written.parts.owl.filter((n) => !(n.start >= bar * beats + 3.5 && n.start < (bar + 1) * beats)) } };
    expect(drumMoveAt(plain, "owl", bar)).toBeNull();
  });

  it("folds a section's fills into one step for the drummer, and calls out the one into the next section", () => {
    const guide = jamGuide(take("neworleans", 2, 32, quartet));
    const head = guide.find((g) => g.section.kind === "head")!;
    const hoot = head.players.find((p) => p.id === "owl")!;
    expect(hoot.steps.map((s) => s.name)).toEqual(["street beat", "tom run"]);
    expect(hoot.steps[1].what).toBe("Where a phrase ends: a run down the toms. A fill tells the band the next phrase is coming; the last one leads into Bruno's solo.");
    expect(head.moves).toContain("tom run into Bruno's solo");
    const solo = guide.find((g) => g.section.kind === "solo")!.players.find((p) => p.id === "owl")!;
    expect(solo.steps.filter((s) => s.id === "fills")).toHaveLength(1);
    expect(solo.steps.find((s) => s.id === "fills")!.name).toBe("fills");
  });
});

describe("one idea per take", () => {
  it("is something the band really plays in that take, in the bars it says", () => {
    for (const score of allTakes()) {
      const idea = takeIdea(score);
      expect(idea, score.title).not.toBeNull();
      const { technique, who, bars } = idea!;
      expect(technique.what, score.title).toMatch(/^[A-Z“].+[.”]$/);
      expect(who.length, score.title).toBeGreaterThan(0);
      for (const name of who) {
        const m = score.members.find((x) => x.name === name)!;
        const plays = bars.some((b) => techniqueAt(score, m.id, b - 1).id === technique.id || changesIn(score, b - 1).some((at) => techniqueAt(score, m.id, b - 1, at).id === technique.id));
        expect(plays, `${score.title}: ${name} ${technique.name}`).toBe(true);
      }
    }
  });

  it("changes from take to take, among what the style is known by", () => {
    for (const style of STYLE_LIST) {
      const ideas = new Set(Array.from({ length: 12 }, (_, i) => takeIdea(take(style, 100 + i * 37, 32, quartet))!.technique.name));
      expect(ideas.size, `${style}: ${[...ideas].join(", ")}`).toBeGreaterThanOrEqual(3);
    }
    // swing teaches the walking bass, the ride and comping before anything else
    const swing = new Set(Array.from({ length: 12 }, (_, i) => takeIdea(take("swing", 100 + i * 37, 32, quartet))!.technique.name));
    expect([...swing]).toEqual(expect.arrayContaining(["walking bass", "ride pattern", "comping"]));
  });

  it("an artist's own figure is one of the ideas their takes teach", () => {
    const son = PRESETS.find((p) => p.id === "son")!;
    const ideas = new Set(Array.from({ length: 12 }, (_, i) => takeIdea(presetTake(son, i + 1))!.technique.name));
    expect([...ideas]).toEqual(expect.arrayContaining(["tumbao", "clave"]));
  });

  it("says its bars the way a reader counts them", () => {
    expect(barsText([4])).toBe("bar 4");
    expect(barsText([9, 10, 11, 12])).toBe("bars 9–12");
    expect(barsText([4, 12, 16, 17, 18])).toBe("bars 4, 12 and 16–18");
  });
});
