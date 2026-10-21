import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("a tune in another style drops the preset, as picking that style would", () => {
    useTroop.getState().applyPreset("laufey"); // bossa
    useTroop.getState().setStandard("autumn");
    const s = useTroop.getState().settings;
    expect(s).toMatchObject({ style: "swing", standard: "autumn" });
    expect(s.preset).toBeUndefined();
    expect(s.feel).toBeUndefined();
    expect(s.harmony).toBeUndefined();
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
