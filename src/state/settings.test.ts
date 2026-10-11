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
