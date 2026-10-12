import { describe, expect, it } from "vitest";
import { castBand, emptyBrief, normalizeTonic, paceTempo, parseBrief, repairBrief, resolveBrief, tempoRange, type Brief } from "./brief";
import { defaultMembers } from "./instruments";
import { defaultSettings } from "./local";
import { getPreset } from "./presets";
import { getStandard } from "./standards";
import { STYLES } from "./styles";

const cur = () => {
  const members = defaultMembers();
  return { settings: defaultSettings(members), members, sounds: { room: "club" as const } };
};
const brief = (patch: Partial<Brief>): Brief => ({ ...emptyBrief(), ...patch });

describe("parseBrief: the keyword reading", () => {
  it("reads the example: an artist, a mood, a pace and brushes", () => {
    const b = parseBrief("rainy-night Monk ballad, slow, brushes");
    expect(b.preset).toBe("monk");
    expect(b.mode).toBe("minor");
    expect(b.pace).toBe("slow");
    expect(b.add).toContain("drums");
    expect(b.standard).toBeNull();
  });

  it("reads a style, a key, a room and a band built round a named instrument", () => {
    const b = parseBrief("sunny bossa with flute in F, club");
    expect(b).toMatchObject({ style: "bossa", tonic: "F", mode: "major", room: "club" });
    expect(b.band?.[0]).toBe("flute");
    expect(b.band).toEqual(expect.arrayContaining(["bass", "drums"]));
  });

  it("reads a tune, choruses and a horn trio (horn, bass, drums)", () => {
    const b = parseBrief("Blue Bossa twice, sax trio");
    expect(b).toMatchObject({ standard: "blue-bossa", choruses: 2, band: ["sax", "bass", "drums"] });
  });

  it("solo piano is one player; a sax solo is a solo inside a band", () => {
    expect(parseBrief("a slow waltz for solo piano in a hall")).toMatchObject({ band: ["piano"], meter: 3, room: "hall", pace: "slow" });
    const solo = parseBrief("sax solo over a funk groove");
    expect(solo.band?.length).toBeGreaterThan(1);
    expect(solo.band?.[0]).toBe("sax");
  });

  it("reads tempo numbers and words, and very slow beats slow", () => {
    expect(parseBrief("swing at 220 bpm").tempo).toBe(220);
    expect(parseBrief("in e flat major, 72")).toMatchObject({ tonic: "Eb", mode: "major", tempo: 72 });
    expect(parseBrief("a very slow ballad").pace).toBe("very slow");
    expect(parseBrief("up-tempo bebop").pace).toBe("fast");
  });

  it("keeps the article 'a' from reading as a key", () => {
    expect(parseBrief("something in a dark mood").tonic).toBeNull();
    expect(parseBrief("a minor blues")).toMatchObject({ standard: "minor-blues", tonic: null });
    expect(parseBrief("in a minor key").tonic).toBeNull();
    expect(parseBrief("in a minor key").mode).toBe("minor");
    expect(parseBrief("A happy tune").tonic).toBeNull();
    expect(parseBrief("swing in A minor").tonic).toBe("A");
    expect(parseBrief("Autumn Leaves in G minor at 140 bpm")).toMatchObject({ standard: "autumn", tonic: "G", tempo: 140 });
  });

  it("reads accidentals however they're written", () => {
    expect(parseBrief("in F# minor").tonic).toBe("F#");
    expect(parseBrief("in bb").tonic).toBe("Bb");
    expect(parseBrief("Bb blues, fast").tonic).toBe("Bb");
    expect(parseBrief("key of d flat").tonic).toBe("Db");
    expect(parseBrief("in Cm").tonic).toBe("C");
    expect(parseBrief("in Cm").mode).toBe("minor");
  });

  it("doesn't take a length or a decade for a tempo, or a bar for a room", () => {
    const b = parseBrief("a 32 bar swing in the 1920s style");
    expect(b.bars).toBe(32);
    expect(b.tempo).toBeNull();
    expect(b.room).toBeNull();
    expect(parseBrief("80s pop").tempo).toBeNull();
    expect(parseBrief("12 bar blues").standard).toBe("f-blues");
  });

  it("needs the full name for artists whose names are ordinary words", () => {
    expect(parseBrief("a glass of wine and some chill music").preset).toBeNull();
    expect(parseBrief("the fox plays trumpet").preset).toBeNull();
    expect(parseBrief("Philip Glass arpeggios").preset).toBe("glass");
    expect(parseBrief("like Elijah Fox").preset).toBe("fox");
  });

  it("a tune's name wins over the words in it (Blue Monk is a tune, not a mood)", () => {
    const b = parseBrief("Blue Monk, medium");
    expect(b.standard).toBe("blue-monk");
    expect(b.mode).toBeNull();
  });

  it("names the earliest artist when there are two, and finds them by nickname", () => {
    expect(parseBrief("Monk, not Bill Evans").preset).toBe("monk");
    expect(parseBrief("Charlie Brown Christmas").preset).toBe("guaraldi");
    expect(parseBrief("a Ghibli waltz")).toMatchObject({ preset: "hisaishi", meter: 3 });
  });

  it("sends instruments home and brings horns in as three", () => {
    const b = parseBrief("funky jam with horns, no drums");
    expect(b.drop).toEqual(["drums"]);
    expect(b.band).toEqual(expect.arrayContaining(["trumpet", "sax", "trombone"]));
    expect(b.band).not.toContain("drums");
  });

  it("returns an empty brief for nothing, junk or only punctuation", () => {
    for (const s of ["", "   ", "!!!", "asdf qwerty", "🎷🎷"]) {
      const b = parseBrief(s);
      expect(b.preset ?? b.style ?? b.standard ?? b.tempo ?? b.band).toBeNull();
    }
  });

  it("caps a band at six", () => {
    const b = parseBrief("piano, bass, drums, trumpet, sax, trombone, flute, violin");
    expect(b.band!.length).toBeLessThanOrEqual(6);
  });
});

describe("repairBrief: checking a model's reply", () => {
  it("accepts a clean brief as it is", () => {
    const out = repairBrief({ preset: "monk", style: "swing", standard: null, key: { tonic: "Bb", mode: "minor" }, tempo: 72, meter: 4, band: ["piano", "sax", "bass", "drums"], room: "club", feel: "monk", bars: 32, note: "late" });
    expect(out?.repairs).toEqual([]);
    expect(out?.brief).toMatchObject({ preset: "monk", tonic: "Bb", tempo: 72, band: ["piano", "sax", "bass", "drums"], note: "late" });
  });

  it("mends names for ids, odd spellings, out-of-range numbers and a big band", () => {
    const out = repairBrief({
      preset: "Thelonious Monk",
      style: "Bossa Nova",
      standard: "Autumn Leaves",
      key: { tonic: "A#", mode: "minor" },
      tempo: 900,
      meter: 6,
      band: ["drums", "piano", "Tenor Sax", "kazoo", "bass", "trumpet", "trombone", "flute", "violin"],
      room: "cathedral",
      feel: "nope",
      bars: "32",
    })!;
    expect(out.brief).toMatchObject({ preset: "monk", style: "bossa", standard: "autumn", tonic: "Bb", tempo: 300, meter: 3, room: null, feel: null, bars: 32 });
    expect(out.brief.band).toHaveLength(6);
    expect(out.brief.band![0]).not.toBe("drums");
    expect(out.brief.band).not.toContain("kazoo");
    expect(out.repairs.join("\n")).toMatch(/kazoo/);
    expect(out.repairs.join("\n")).toMatch(/tempo: 900 clamped to 300/);
  });

  it("treats 'none' and unknown tunes as an original chart", () => {
    expect(repairBrief({ style: "swing", standard: "none" })!.brief.standard).toBeNull();
    const out = repairBrief({ style: "swing", standard: "Stairway to Heaven" })!;
    expect(out.brief.standard).toBeNull();
    expect(out.repairs[0]).toMatch(/standard/);
  });

  it("accepts a flat tonic/mode as well as a key object", () => {
    expect(repairBrief({ tonic: "e flat", mode: "major" })!.brief).toMatchObject({ tonic: "Eb", mode: "major" });
  });

  it("rejects what isn't a brief at all", () => {
    for (const v of [null, undefined, 42, "swing", [], { hello: "there" }]) expect(repairBrief(v)).toBeNull();
  });

  it("an empty band keeps whoever's on stage", () => {
    expect(repairBrief({ style: "swing", band: [] })!.brief.band).toBeNull();
    expect(repairBrief({ style: "swing", band: ["kazoo"] })!.brief.band).toBeNull();
  });
});

describe("resolveBrief: from a brief to settings", () => {
  it("plays the example: Monk's band in his key, in minor, at a ballad tempo", () => {
    const a = resolveBrief(parseBrief("rainy-night Monk ballad, slow, brushes"), cur());
    const monk = getPreset("monk")!;
    expect(a.settings).toMatchObject({ preset: "monk", style: "swing", feel: "monk", standard: null });
    expect(a.settings.key).toEqual({ tonic: monk.key.tonic, mode: "minor" });
    expect(a.settings.tempo).toBeLessThanOrEqual(STYLES.swing.tempo.min);
    expect(a.members.map((m) => m.animal)).toEqual(monk.band.map((b) => b.animal));
    expect(a.members.some((m) => m.instrument === "drums")).toBe(true);
    expect(a.sounds.room).toBe(monk.sounds.room);
  });

  it("a standard keeps its own mode and meter, and plays a full performance", () => {
    const a = resolveBrief(brief({ standard: "autumn", mode: "major", meter: 3, tonic: "A" }), cur());
    const std = getStandard("autumn")!;
    expect(a.settings.key).toEqual({ tonic: "A", mode: std.key.mode });
    expect(a.settings.meter.beats).toBe(std.meter);
    expect(a.settings.bars % std.bars.length).toBe(0);
    expect(a.settings.tempo).toBe(std.tempo);
  });

  it("choruses become bars for a standard", () => {
    const a = resolveBrief(parseBrief("Blue Bossa twice, sax trio"), cur());
    expect(a.settings.bars).toBe(getStandard("blue-bossa")!.bars.length * 2);
    expect(a.members.map((m) => m.instrument)).toEqual(["sax", "bass", "drums"]);
    expect(a.settings.leaderId).toBe(a.members[0].id);
  });

  it("holds every tempo inside the style's slider", () => {
    for (const tempo of [10, 400]) {
      const a = resolveBrief(brief({ style: "ambient", tempo }), cur());
      const [lo, hi] = tempoRange("ambient");
      expect(a.settings.tempo).toBeGreaterThanOrEqual(lo);
      expect(a.settings.tempo).toBeLessThanOrEqual(hi);
    }
  });

  it("an artist named with someone else's style lends the feel, not the name", () => {
    const a = resolveBrief(brief({ preset: "monk", style: "bossa" }), cur());
    expect(a.settings).toMatchObject({ style: "bossa", feel: "monk", preset: undefined });
  });

  it("naming only a tempo and a room keeps the tune, style, key and band", () => {
    const c = cur();
    c.settings = { ...c.settings, standard: "autumn", style: "swing", key: { tonic: "A", mode: "minor" }, bars: 64, feel: "evans" };
    const a = resolveBrief(brief({ pace: "fast", room: "hall" }), c);
    expect(a.settings).toMatchObject({ standard: "autumn", style: "swing", key: { tonic: "A", mode: "minor" }, bars: 64, feel: "evans" });
    expect(a.settings.tempo).toBeGreaterThan(c.settings.tempo);
    expect(a.members).toBe(c.members);
    expect(a.sounds.room).toBe("hall");
  });

  it("adds a named instrument to an artist's band, making room when it's full", () => {
    const a = resolveBrief(brief({ preset: "basie", add: ["vibes"] }), cur());
    expect(a.members).toHaveLength(6);
    expect(a.members.some((m) => m.instrument === "vibes")).toBe(true);
    expect(a.members.some((m) => m.instrument === "bass")).toBe(true);
    expect(a.members.some((m) => m.instrument === "drums")).toBe(true);
  });

  it("drops what was sent home, and never leaves the stage empty or the drummer leading", () => {
    const a = resolveBrief(brief({ preset: "basie", drop: ["drums"] }), cur());
    expect(a.members.some((m) => m.instrument === "drums")).toBe(false);
    const b = resolveBrief(brief({ band: ["drums"], drop: ["drums"] }), cur());
    expect(b.members.length).toBeGreaterThan(0);
    const c = resolveBrief(brief({ band: ["drums", "sax"] }), cur());
    expect(c.members[0].instrument).toBe("sax");
  });

  it("an original's length snaps to one the panel offers", () => {
    expect(resolveBrief(brief({ style: "funk", bars: 30 }), cur()).settings.bars).toBe(32);
    expect(resolveBrief(brief({ style: "funk", bars: 1000 }), cur()).settings.bars).toBe(64);
  });

  it("is deterministic", () => {
    const b = parseBrief("sunny bossa with flute in F, club");
    expect(resolveBrief(b, cur())).toEqual(resolveBrief(b, cur()));
  });
});

describe("helpers", () => {
  it("normalizeTonic spells keys the picker's way", () => {
    expect(["c#", "D♭", "a sharp", "Gb", "e", "H"].map(normalizeTonic)).toEqual(["Db", "Db", "Bb", "F#", "E", null]);
  });

  it("paceTempo stays within the slider and orders slow < medium < fast", () => {
    const [lo, hi] = tempoRange("swing");
    const t = (["very slow", "slow", "medium", "fast", "very fast"] as const).map((p) => paceTempo("swing", p, 160));
    expect([...t].sort((a, b) => a - b)).toEqual(t);
    expect(Math.min(...t)).toBeGreaterThanOrEqual(lo);
    expect(Math.max(...t)).toBeLessThanOrEqual(hi);
  });

  it("castBand gives each player a different animal, the usual one first", () => {
    const band = castBand(["piano", "piano", "drums", "trumpet"]);
    expect(new Set(band.map((m) => m.animal)).size).toBe(4);
    expect(band[0].animal).toBe("bear");
    expect(band.find((m) => m.instrument === "drums")?.animal).toBe("owl");
  });
});

describe("castBand seats", () => {
  it("an instrument nobody plays by default doesn't take someone's usual seat", () => {
    const band = castBand(["flute", "guitar", "piano", "bass", "drums"]);
    const by = Object.fromEntries(band.map((m) => [m.instrument, m.animal]));
    expect(by).toMatchObject({ piano: "bear", bass: "frog", drums: "owl" });
    expect(["bear", "frog", "owl"]).not.toContain(by.flute);
  });
});
