import { describe, expect, it } from "vitest";
import { defaultMembers } from "@/music/instruments";
import { defaultSettings, generateLocal } from "@/music/local";
import { getPreset } from "@/music/presets";
import { getStandard } from "@/music/standards";
import type { Member } from "@/music/types";
import { listOf, shareCardFor } from "./card";
import { encodeJam, jamOf, shareUrl } from "./share";

const band: Member[] = defaultMembers();

function linkFor(patch: Partial<ReturnType<typeof defaultSettings>>, members = band) {
  const take = generateLocal({ ...defaultSettings(members), ...patch }, members).score;
  return { take, value: encodeJam(jamOf(take)) };
}

describe("a shared take's card", () => {
  it("says what the app calls the take, and who plays what", () => {
    const { take, value } = linkFor({ style: "bossa", seed: 11, tempo: 132, bars: 32 });
    const card = shareCardFor(value)!;
    expect(card.title).toBe(take.title);
    expect(card.headline).toBe(take.title);
    expect(card.style).toBe("Bossa Nova");
    expect(card.tune).toBeNull();
    expect(card.homage).toBeNull();
    expect(card.facts).toBe(`${take.frame.key.tonic} ${take.frame.key.mode} · 132 bpm · 32 bars`);
    expect(card.band.map((p) => p.name)).toEqual(band.map((m) => m.name));
    expect(card.band.filter((p) => p.leader).map((p) => p.name)).toEqual(band.filter((m) => m.id === take.settings.leaderId).map((m) => m.name));
    expect(card.band.find((p) => p.instrument === "bass")?.plays).toBe("Upright Bass");
    expect(card.description).toMatch(/^Some bossa nova, played by .+ \(upright bass\).+\. Press play to hear it\.$/);
  });

  it("names the standard it plays", () => {
    const std = getStandard("f-blues")!;
    const { take, value } = linkFor({ style: std.style, standard: std.id, key: { ...std.key }, bars: std.bars.length, seed: 3 });
    const card = shareCardFor(value)!;
    expect(card.title).toBe(take.title);
    expect(card.tune).toBe("Jazz Blues in F");
    expect(card.description.startsWith("Jazz Blues in F, as ")).toBe(true);
  });

  it("credits a play-like preset as an homage", () => {
    const p = getPreset("jobim")!;
    const { value } = linkFor({ style: p.style, preset: p.id, seed: 5 });
    const card = shareCardFor(value)!;
    expect(card.homage).toBe("an homage to Jobim");
    expect(card.headline).toBe("Bossa Nova, like Jobim");
    expect(card.description).toContain(": an homage to Jobim.");
  });

  it("notes a meter other than four", () => {
    const { value } = linkFor({ meter: { beats: 3 }, tempo: 90, bars: 16 });
    expect(shareCardFor(value)!.facts).toMatch(/· 90 bpm · 3\/4 · 16 bars$/);
  });

  it("reads the value as it arrives in a path segment, escaped or not", () => {
    const { take, value } = linkFor({ seed: 8 });
    const segment = new URL(shareUrl(jamOf(take), "https://example.com/")).pathname.split("/")[2];
    expect(shareCardFor(segment)?.title).toBe(take.title);
    expect(shareCardFor(encodeURIComponent(value))?.title).toBe(take.title);
  });

  it("has no card for a link that doesn't decode", () => {
    expect(shareCardFor("")).toBeNull();
    expect(shareCardFor("1.!!!")).toBeNull();
    expect(shareCardFor("%E0%A4%A")).toBeNull();
    expect(shareCardFor("2.e30")).toBeNull();
  });
});

describe("listOf", () => {
  it("joins names the way they're said", () => {
    expect(listOf([])).toBe("");
    expect(listOf(["a"])).toBe("a");
    expect(listOf(["a", "b"])).toBe("a and b");
    expect(listOf(["a", "b", "c"])).toBe("a, b and c");
  });
});
