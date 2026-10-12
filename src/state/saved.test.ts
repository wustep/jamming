import { describe, expect, it } from "vitest";
import { defaultMembers } from "@/music/instruments";
import { defaultSettings, generateLocal } from "@/music/local";
import { addSaved, makeSaved, MAX_SAVED, savedConfig } from "./saved";
import { jamOf } from "./share";

const band = defaultMembers();
const take = (seed: number) => generateLocal({ ...defaultSettings(band), seed }, band).score;

describe("saved jams", () => {
  it("keep the configuration, and the models' notes only for a take they played", () => {
    const local = take(3);
    const a = makeSaved(jamOf(local, { sounds: { piano: "cp80", drums: "lm2", room: "dry", pad: "strings", countIn: true } }), local.title, local, 1);
    expect(a.score).toBeUndefined();
    expect(savedConfig(a)?.sounds.piano).toBe("cp80");
    expect(savedConfig(a)?.settings.seed).toBe(3);
    const ai = { ...take(4), engine: "ai" as const };
    const b = makeSaved(jamOf(ai), ai.title, ai, 2);
    expect(b.score?.parts).toEqual(ai.parts);
    expect(savedConfig(b)?.engine).toBe("ai");
  });

  it("put a new save on top, moving the same jam up rather than keeping two", () => {
    const one = makeSaved(jamOf(take(1)), "one", null, 1);
    const two = makeSaved(jamOf(take(2)), "two", null, 2);
    const again = makeSaved(jamOf(take(1)), "one again", null, 3);
    expect(addSaved(addSaved(addSaved([], one), two), again).map((s) => s.name)).toEqual(["one again", "two"]);
    let list = [one];
    for (let i = 0; i < MAX_SAVED + 5; i++) list = addSaved(list, makeSaved(jamOf(take(100 + i)), `#${i}`, null, 10 + i));
    expect(list).toHaveLength(MAX_SAVED);
  });

  it("can't be read when the link inside is broken", () => {
    expect(savedConfig({ id: "x", name: "x", savedAt: 0, jam: "2.!!!" })).toBeNull();
  });
});
