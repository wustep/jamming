import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPreset } from "@/music/presets";
import { getStandard } from "@/music/standards";

const ls = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => ls.get(k) ?? null,
  setItem: (k: string, v: string) => void ls.set(k, v),
  removeItem: (k: string) => void ls.delete(k),
  clear: () => ls.clear(),
});

const { useTroop } = await import("./store");
const initial = useTroop.getState();

beforeEach(() => {
  ls.clear();
  useTroop.setState(initial, true);
});

describe("a preset, then a tune", () => {
  it("a tune in the preset's own style keeps how the artist plays it", () => {
    useTroop.getState().applyPreset("basie");
    useTroop.getState().setStandard("autumn"); // a swing tune
    expect(useTroop.getState().settings).toMatchObject({ style: "swing", standard: "autumn", preset: "basie", feel: "basie" });
  });

  it("a tune in another style keeps the artist: Laufey plays Autumn Leaves, as a bossa", () => {
    useTroop.getState().applyPreset("laufey"); // bossa
    useTroop.getState().setStandard("autumn"); // a swing tune
    const s = useTroop.getState().settings;
    expect(s).toMatchObject({ style: "bossa", standard: "autumn", preset: "laufey", feel: "laufey", tempo: getPreset("laufey")!.tempo });
    // the tune's own key and meter
    expect(s.key).toEqual(getStandard("autumn")!.key);
  });
});

describe("a tune and a style are separate choices", () => {
  it("an artist picked after a tune plays that tune: Fly Me to the Moon like Einaudi", () => {
    useTroop.getState().setStandard("fly-me");
    const bars = useTroop.getState().settings.bars;
    useTroop.getState().applyPreset("einaudi");
    const { settings: s, members } = useTroop.getState();
    const p = getPreset("einaudi")!;
    expect(s).toMatchObject({ standard: "fly-me", preset: "einaudi", style: p.style, feel: p.feel, tempo: p.tempo, bars });
    expect(s.key).toEqual(getStandard("fly-me")!.key);
    expect(s.meter.beats).toBe(getStandard("fly-me")!.meter);
    expect(members.map((m) => m.instrument)).toEqual(p.band.map((b) => b.instrument));
  });

  it("a tune picked after an artist keeps the artist, at the artist's pace", () => {
    useTroop.getState().applyPreset("einaudi");
    useTroop.getState().setStandard("fly-me");
    expect(useTroop.getState().settings).toMatchObject({ standard: "fly-me", preset: "einaudi", style: getPreset("einaudi")!.style, tempo: getPreset("einaudi")!.tempo });
  });

  it("a style picked before a tune plays it in that style; untouched, a tune brings its own", () => {
    useTroop.getState().setStandard("girl-from-ipanema");
    expect(useTroop.getState().settings.style).toBe("bossa");
    useTroop.getState().setStyle("baroque");
    useTroop.getState().setStandard("autumn");
    expect(useTroop.getState().settings).toMatchObject({ style: "baroque", standard: "autumn" });
    useTroop.getState().setStandard("girl-from-ipanema");
    expect(useTroop.getState().settings).toMatchObject({ style: "baroque", standard: "girl-from-ipanema" });
  });

  it("letting the artist go keeps the tune", () => {
    useTroop.getState().setStandard("fly-me");
    useTroop.getState().applyPreset("einaudi");
    useTroop.getState().setStyle(useTroop.getState().settings.style); // "Play like…" cleared
    expect(useTroop.getState().settings).toMatchObject({ standard: "fly-me", preset: undefined });
  });

  it("a key you picked stays when the style or the artist changes", () => {
    useTroop.getState().setStandard(null);
    useTroop.getState().setSettings({ key: { tonic: "Eb", mode: "minor" }, keyChosen: true });
    useTroop.getState().setStyle("bossa");
    expect(useTroop.getState().settings.key).toEqual({ tonic: "Eb", mode: "minor" });
    useTroop.getState().applyPreset("chopin");
    expect(useTroop.getState().settings.key).toEqual({ tonic: "Eb", mode: "minor" });
  });

  it("plays it: a take of the tune's changes in the artist's style, named for both", async () => {
    useTroop.getState().setStandard("fly-me");
    useTroop.getState().applyPreset("einaudi");
    await useTroop.getState().generate(); // no key: a local sketch
    const score = useTroop.getState().current!;
    const std = getStandard("fly-me")!;
    expect(score.frame).toMatchObject({ standard: "fly-me", style: getPreset("einaudi")!.style });
    expect(score.title).toContain("Einaudi");
    expect(score.title).toContain(std.name);
    expect(useTroop.getState().takes[0].label).toBe(`${std.name} sketch`);
  });
});

describe("the takes list", () => {
  it("names a standard's take after the tune, not just its style", async () => {
    useTroop.getState().setStandard("blue-bossa");
    await useTroop.getState().generate(); // no key: a local sketch
    expect(useTroop.getState().takes[0].label).toBe("Blue Bossa sketch");
    useTroop.getState().setStandard(null);
    await useTroop.getState().generate();
    expect(useTroop.getState().takes[0].label).toBe("Bossa Nova sketch");
  });

  it("names an original played like an artist after the artist", async () => {
    useTroop.getState().applyPreset("basie");
    await useTroop.getState().generate();
    expect(useTroop.getState().takes[0].label).toBe("Count Basie sketch");
    useTroop.getState().setStandard("autumn"); // a swing tune keeps the preset; the tune names it
    await useTroop.getState().generate();
    expect(useTroop.getState().takes[0].label).toBe("Autumn Leaves sketch");
    useTroop.getState().setStyle("swing"); // picking a style drops the preset
    useTroop.getState().setStandard(null);
    await useTroop.getState().generate();
    expect(useTroop.getState().takes[0].label).toBe("Swing sketch");
  });
});

describe("asking for a jam with no key", () => {
  it("an ask it can't read leaves the band alone and says what it listens for", async () => {
    useTroop.getState().applyPreset("basie");
    const before = useTroop.getState().current;
    await useTroop.getState().arrangeFrom("surprise me");
    expect(useTroop.getState().current).toBe(before);
    expect(useTroop.getState().settings.preset).toBe("basie");
    expect(useTroop.getState().arranged).toMatchObject({ text: "surprise me", missed: true });
    await useTroop.getState().arrangeFrom("christmas music");
    expect(useTroop.getState().settings.standard).toBe("jingle-bells");
    expect(useTroop.getState().arranged?.missed).toBeUndefined();
  });
});
