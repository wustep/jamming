import { describe, expect, it } from "vitest";
import { MODELS } from "@/ai/models";
import { defaultMembers } from "@/music/instruments";
import { leaveSpace } from "@/music/live";
import { defaultSettings, generateLocal } from "@/music/local";
import { PRESETS } from "@/music/presets";
import { STANDARDS } from "@/music/standards";
import { STYLE_LIST } from "@/music/styles";
import type { Member, Score, TroopSettings } from "@/music/types";
import { decodeShare, encodeJam, jamOf, sharedFromHash, shareUrl, shareValueAt, type JamConfig } from "./share";

const band: Member[] = [...defaultMembers(), { id: "sheep", animal: "sheep", name: "Olive ☁", instrument: "cello" }];

/** A version 1 link, as the app made them before (the music only). */
function encodeV1(score: Score): string {
  const s = score.settings;
  const payload = {
    s: {
      style: s.style,
      bars: s.bars,
      tempo: s.tempo,
      key: s.key,
      meter: s.meter,
      standard: s.standard,
      leaderId: s.leaderId,
      soloists: s.soloists,
      seed: s.seed,
      phraseBars: s.phraseBars,
      ...(s.swingFeel && s.swingFeel !== "medium" ? { swingFeel: s.swingFeel } : {}),
      ...(s.feel ? { feel: s.feel } : {}),
      ...(s.harmony ? { harmony: s.harmony } : {}),
      ...(s.preset ? { preset: s.preset } : {}),
    },
    m: score.members.map((m) => [m.id, m.animal, m.name, m.instrument]),
  };
  return `1.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

function replay(value: string) {
  const shared = decodeShare(value)!;
  expect(shared).not.toBeNull();
  return generateLocal(shared.settings, shared.members).score;
}

/** What a take plays and shows: everything but when it was made. */
const music = (s: Score) => ({ title: s.title, frame: s.frame, plan: s.plan, motif: s.motif, swing: s.swing, parts: s.parts, chat: s.chat.map((c) => c.text), rit: s.rit });

/** A jam with every dial away from its default. */
function fullJam(settings: TroopSettings, members: Member[]): JamConfig {
  const take = generateLocal(settings, members).score;
  return jamOf(take, {
    sounds: { piano: "wurlitzer", drums: "lm2", room: "hall", pad: "choir", countIn: false },
    playAlong: { instrument: "vibes", quantize: "light", callResponse: { on: true, every: 4 } },
    heuristic: true,
    muted: [members[members.length - 1].id],
    asked: { text: "slow bossa in a hall, with vibes", source: "model", model: "anthropic/claude-haiku-4.5", note: "A hush of a bossa." },
  });
}

describe("jam links", () => {
  it("carry the whole configuration and bring it back as it was", () => {
    const settings: TroopSettings = {
      ...defaultSettings(band),
      style: "bossa",
      seed: 98765,
      tempo: 132,
      bars: 32,
      mode: "composer",
      bestOf: 1,
      phraseBars: 2,
      swingFeel: "light",
      directorModel: MODELS[MODELS.length - 1].id,
      playerModel: MODELS[MODELS.length - 2].id,
    };
    const config = fullJam(settings, band);
    const shared = decodeShare(encodeJam(config))!;
    const { version, ...back } = shared;
    expect(version).toBe(2);
    expect(back).toEqual(config);
  });

  it("stay short", () => {
    const config = fullJam({ ...defaultSettings(band), seed: 123456789 }, band);
    // a full configuration, every dial moved and a sentence along: still comfortably a link
    expect(encodeJam(config).length).toBeLessThan(900);
    expect(encodeJam(jamOf(generateLocal({ ...defaultSettings(defaultMembers()), seed: 7 }, defaultMembers()).score)).length).toBeLessThan(300);
  });

  it("say when the models played the take (their setup and seed ride along, not their notes)", () => {
    const take = generateLocal({ ...defaultSettings(band), seed: 4 }, band).score;
    expect(decodeShare(encodeJam(jamOf(take)))!.engine).toBe("local");
    expect(decodeShare(encodeJam(jamOf({ ...take, engine: "ai" })))!.engine).toBe("ai");
  });

  it("round-trip through a link's path, which a server can read", () => {
    const take = generateLocal({ ...defaultSettings(band), seed: 7 }, band).score;
    const url = new URL(shareUrl(jamOf(take), "https://example.com/somewhere?debug#t=old"));
    expect(url.pathname).toBe(`/s/${encodeJam(jamOf(take))}`);
    expect(url.search).toBe("?debug");
    expect(url.hash).toBe("");
    expect(decodeShare(shareValueAt(url.pathname, url.hash)!)?.settings.seed).toBe(7);
  });

  it("still open older links (the music only), from the path or the hash", () => {
    const settings = { ...defaultSettings(band), style: "bossa" as const, seed: 9, tempo: 140, swingFeel: "hard" as const };
    const take = generateLocal(settings, band).score;
    const v1 = encodeV1(take);
    const hash = `#t=${v1}`;
    expect(shareValueAt("/", hash)).toBe(v1);
    expect(sharedFromHash(hash)?.settings.seed).toBe(9);
    const old = decodeShare(shareValueAt(`/s/${v1}`, "")!)!;
    expect(old.version).toBe(1);
    expect(old.sounds).toBeNull();
    expect(old.playAlong).toBeNull();
    expect(music(replay(v1))).toEqual(music(take));
    expect(shareValueAt("/", "")).toBeNull();
    expect(shareValueAt("/s/", "")).toBeNull();
    expect(shareValueAt("/s/a/b", "")).toBeNull();
    expect(shareValueAt("/s/%E0%A4%A", "")).toBeNull();
  });

  it("reject tampered or unknown links", () => {
    const take = generateLocal({ ...defaultSettings(band), seed: 7 }, band).score;
    const good = encodeJam(jamOf(take));
    const edit = (f: (p: Record<string, unknown> & { b: unknown[][] }) => void) => {
      const p = JSON.parse(Buffer.from(good.slice(2), "base64url").toString());
      f(p);
      return `2.${Buffer.from(JSON.stringify(p)).toString("base64url")}`;
    };
    expect(decodeShare("3." + good.slice(2))).toBeNull();
    expect(decodeShare("2.!!!")).toBeNull();
    expect(decodeShare("2.e30")).toBeNull();
    expect(decodeShare(edit((p) => (p.st = "polka")))).toBeNull();
    expect(decodeShare(edit((p) => (p.b[0][1] = "dragon")))).toBeNull();
    expect(decodeShare(edit((p) => (p.b[0][3] = "theremin")))).toBeNull();
    expect(decodeShare(edit((p) => (p.b[0] = ["__proto__", "piano"])))).toBeNull();
    expect(decodeShare(edit((p) => (p.k = "<b>")))).toBeNull();
    expect(decodeShare(edit((p) => (p.bpm = 10_000)))?.settings.tempo).toBe(320);
    expect(decodeShare(edit((p) => (p.l = "nobody")))?.settings.leaderId).toBe("");
    // the rest of the jam falls back to the defaults rather than refusing the music
    expect(decodeShare(edit((p) => (p.dm = "evil/model")))?.settings.directorModel).toBe(defaultSettings(band).directorModel);
    expect(decodeShare(edit((p) => (p.snd = { room: "cathedral", piano: "cp80" })))?.sounds).toMatchObject({ room: "club", piano: "cp80" });
    expect(decodeShare(edit((p) => (p.pa = ["kazoo", "heavy", 3])))?.playAlong).toEqual({ instrument: "piano", quantize: "off", callResponse: { on: false, every: 2 } });
    expect(decodeShare(edit((p) => (p.mu = ["nobody", 3])))?.muted).toEqual([]);
  });
});

// Encode → decode → generate, and the notes must match the take that was saved, note for note.
describe("a saved jam plays the same notes", () => {
  const cases: { name: string; settings: TroopSettings; members: Member[] }[] = [];
  const base = defaultSettings(band);
  for (const style of STYLE_LIST) cases.push({ name: `style ${style}`, members: band, settings: { ...base, style, seed: 1000 + cases.length * 7919 } });
  for (const std of STANDARDS.slice(0, 6))
    cases.push({ name: `standard ${std.id}`, members: band, settings: { ...base, style: std.style, standard: std.id, key: { ...std.key }, meter: { beats: std.meter }, bars: std.bars.length, tempo: std.tempo, seed: 31 + cases.length } });
  for (const p of PRESETS.slice(0, 8)) {
    const members: Member[] = p.band.map((b) => ({ id: b.animal, animal: b.animal, name: b.animal, instrument: b.instrument }));
    cases.push({
      name: `preset ${p.id}`,
      members,
      settings: { ...defaultSettings(members), style: p.style, feel: p.feel, harmony: p.harmony, preset: p.id, tempo: p.tempo, key: { ...p.key }, meter: { beats: p.meter ?? 4 }, leaderId: members[0].id, soloists: p.soloists, seed: 271828 + cases.length },
    });
  }

  it.each(cases)("$name", ({ settings, members }) => {
    const config = fullJam(settings, members);
    const take = generateLocal(config.settings, config.members).score;
    const shared = decodeShare(encodeJam(config))!;
    const again = generateLocal(shared.settings, shared.members).score;
    expect(music(again)).toEqual(music(take));
    // and as the band plays it with room left for you (call and response rides along)
    const every = shared.playAlong!.callResponse.every;
    expect(leaveSpace(again, every).parts).toEqual(leaveSpace(take, every).parts);
    // a second load is the same again
    expect(music(replay(encodeJam(config)))).toEqual(music(again));
  });

  it("covers every style, several standards and several presets", () => {
    expect(cases.length).toBeGreaterThanOrEqual(STYLE_LIST.length + 6 + 8);
    expect(new Set(cases.map((c) => c.settings.seed)).size).toBe(cases.length);
  });
});
