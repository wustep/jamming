import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DRUM, INSTRUMENTS } from "@/music/instruments";
import { LANES } from "@/music/notation";
import type { InstrumentId } from "@/music/types";
import { noteMidi } from "./bowed";
import type { Smplr, SmplrPreset } from "smplr";
import {
  acousticKitPreset,
  bridgeGaps,
  kitHas,
  kitKeyFailed,
  kitKeys,
  VCSL_BASE,
  MALLET_KEY,
  SWELLS,
  swellFor,
  DEFAULT_SOUNDS,
  EPIANO_VOLUME,
  lm2Sample,
  loopSource,
  packChain,
  readSounds,
  rootSubset,
  SPLENDID_SAMPLES,
  SPLENDID_VOLUME,
  splendidPreset,
} from "./packs";

describe("the acoustic kit", () => {
  const preset = acousticKitPreset();
  const regions = preset.groups.flatMap((g) => g.regions.map((r) => ({ ...r, group: g })));
  const covering = (note: number, vel: number) =>
    regions.filter((r) => r.keyRange![0] <= note && note <= r.keyRange![1] && (!r.velRange || (r.velRange[0] <= vel && vel <= r.velRange[1])));

  it("plays every drum the parts and the LinnDrum can", () => {
    const notes = new Set([...Object.values(DRUM), ...Object.values(LANES)].filter((n) => lm2Sample(n, 0.7) !== null));
    for (const note of notes) for (const vel of [1, 40, 64, 100, 127]) expect(covering(note, vel).length, `note ${note} vel ${vel}`).toBeGreaterThan(0);
  });

  it("alternates round-robins and keeps every layer's trim modest", () => {
    const snare = covering(DRUM.snare, 100);
    expect(snare.map((r) => r.seqPosition).sort()).toEqual([1, 2]);
    for (const r of regions) expect(Math.abs(r.volume ?? 0)).toBeLessThanOrEqual(24);
    // softer layers are trimmed to sit under louder ones
    const hat = [1, 127].map((v) => covering(DRUM.hatClosed, v)[0].volume);
    expect(hat[0]).not.toBe(hat[1]);
  });

  it("chokes the open hat with the closed and pedal hat", () => {
    // smplr: a region with offBy N, when it plays, stops the voices in group N
    const open = covering(DRUM.hatOpen, 100)[0].group;
    expect(open.group).toBeDefined();
    for (const n of [DRUM.hatClosed, DRUM.hatPedal]) expect(covering(n, 100)[0].group.offBy).toBe(open.group);
    // and opening the hat doesn't cut off a closed hit
    expect(open.offBy).toBeUndefined();
  });
});

describe("soft mallets", () => {
  const extra = [...new Set(Object.values(MALLET_KEY)), ...SWELLS.map((s) => s.key)];
  const keysOf = (preset: SmplrPreset) => new Set(preset.groups.flatMap((g) => g.regions.map((r) => r.keyRange![0])));

  it("aren't loaded for a chart that doesn't play them", () => {
    expect([...keysOf(acousticKitPreset())].filter((k) => k >= 100)).toEqual([]);
    expect([...keysOf(acousticKitPreset([100]))].filter((k) => k >= 100)).toEqual([100]);
  });

  it("play every cymbal and tom softly at every touch, each tom tuned as the sticks tune it, and each swell", () => {
    const preset = acousticKitPreset(extra);
    const regions = preset.groups.flatMap((g) => g.regions);
    const sticks = acousticKitPreset().groups.flatMap((g) => g.regions);
    const gmOf = new Map(Object.entries(MALLET_KEY).map(([gm, key]) => [key, +gm]));
    for (const key of extra) {
      for (const vel of [1, 40, 64, 100, 127]) {
        const hit = regions.filter((r) => r.keyRange![0] === key && (!r.velRange || (r.velRange[0] <= vel && vel <= r.velRange[1])));
        expect(hit.length, `key ${key} vel ${vel}`).toBeGreaterThan(0);
        // a cymbal or swell plays as recorded; a tom is retuned exactly as the stick kit's
        const gm = [41, 43, 45, 47, 48, 50].find((t) => MALLET_KEY[t] === key);
        const stick = gm === undefined ? undefined : sticks.find((r) => r.keyRange![0] === gm)!;
        for (const r of hit) expect(key - r.pitch!, `key ${key}`).toBe(stick ? gm! - stick.pitch! : 0);
      }
    }
    // six toms, six keys: a solo on the toms keeps its tune
    expect(new Set([41, 43, 45, 47, 48, 50].map((t) => MALLET_KEY[t])).size).toBe(6);
    expect(gmOf.size).toBeGreaterThan(6);
    for (const r of regions) expect(Math.abs(r.volume ?? 0)).toBeLessThanOrEqual(24);
  });

  it("don't count a key as loaded when one of its samples failed (it would play silence, not sticks)", () => {
    const swell = SWELLS[0];
    const url = `${VCSL_BASE}/${encodeURI(swell.file)}.ogg`;
    expect(kitKeyFailed(swell.key, new Set())).toBe(false);
    expect(kitKeyFailed(swell.key, new Set([url]))).toBe(true);
    expect(kitKeyFailed(SWELLS[1].key, new Set([url]))).toBe(false);
    expect(kitKeyFailed(MALLET_KEY[DRUM.crash], new Set([`${VCSL_BASE}/${encodeURI("Idiophones/Struck Idiophones/Suspended Cymbal 1/susCymb1_hit_mp1")}.m4a`]))).toBe(true);
  });

  it("are asked for by a part played with mallets, or rolled on a cymbal (just the swells its rolls fit)", () => {
    const part = [DRUM.crash, DRUM.floorTom, DRUM.kick].map((pitch) => ({ pitch, dur: 1 }));
    expect(kitKeys(part, false)).toEqual([]);
    expect(kitKeys(part, true).sort()).toEqual([MALLET_KEY[DRUM.crash], MALLET_KEY[DRUM.floorTom]].sort());
    const roll = (dur: number) => [{ pitch: DRUM.ride, dur, art: "roll" as const }];
    expect(kitKeys(roll(2), false).sort()).toEqual(SWELLS.map((s) => s.key).sort());
    // a 5.4-beat ending roll at 160 bpm (2 s) swells on the shortest or the next, as the
    // ritardando stretches it; a bar's roll at 60 (4 s) on the next two up
    expect(kitKeys(roll(5.4), false, 60 / 160).sort()).toEqual([SWELLS[0].key, SWELLS[1].key]);
    expect(kitKeys(roll(4), false, 1).sort()).toEqual([SWELLS[1].key, SWELLS[2].key]);
    // a snare "roll" isn't a cymbal swell
    expect(kitKeys([{ pitch: DRUM.snare, dur: 2, art: "roll" as const }], false)).toEqual([]);
  });

  it("swell a roll up to where it lands: the longest loaded swell that peaks by then, started that late", () => {
    for (const span of [0.5, 1.3, 2, 2.4, 3, 5, 8]) {
      const s = swellFor(span)!;
      const fits = SWELLS.filter((x) => x.peak <= span + 0.02);
      expect(s.peak).toBe(fits.length ? Math.max(...fits.map((x) => x.peak)) : SWELLS[0].peak);
      if (fits.length) expect(s.lead + s.peak).toBeCloseTo(span, 6);
      else expect(s.lead).toBe(0);
    }
    // only what's loaded: a long roll with just the shortest swell still lands on time
    const short = swellFor(5, (k) => k === SWELLS[0].key)!;
    expect(short.key).toBe(SWELLS[0].key);
    expect(short.lead + short.peak).toBeCloseTo(5, 6);
    expect(swellFor(5, () => false)).toBeNull();
  });

  it("load into a kit that's already playing when a chart brings them out", async () => {
    const kit = packChain("drums")[0];
    const loaded: SmplrPreset[] = [];
    const inst = { reload: async (p: SmplrPreset) => void loaded.push(p) } as unknown as Smplr;
    expect(kitHas(inst, 110)).toBe(false);
    await kit.extend!(inst, [36, 38, 49, 100, 110], new Set());
    expect(loaded.length).toBe(1);
    expect(keysOf(loaded[0]).has(110)).toBe(true);
    expect(keysOf(loaded[0]).has(DRUM.kick)).toBe(true);
    expect(kitHas(inst, 110) && kitHas(inst, 100)).toBe(true);
    // nothing new: no reload
    await kit.extend!(inst, [36, 100, 110], new Set());
    expect(loaded.length).toBe(1);
  });
});

describe("sounds", () => {
  it("reads old saves and unknown values back as sounds we have", () => {
    expect(readSounds(undefined, "splendid")).toEqual({ ...DEFAULT_SOUNDS, piano: "splendid" });
    expect(readSounds({ piano: "theremin", drums: "808", room: "cave", countIn: "yes" })).toEqual(DEFAULT_SOUNDS);
    expect(readSounds({ piano: "wurlitzer", drums: "lm2", room: "hall", pad: "choir", countIn: false })).toEqual({ piano: "wurlitzer", drums: "lm2", room: "hall", pad: "choir", countIn: false });
    expect(readSounds({ piano: "harpsichord", pad: "theremin" })).toEqual({ ...DEFAULT_SOUNDS, piano: "harpsichord" });
  });
  it("falls back from every sampled pack", () => {
    expect(packChain("drums").map((p) => p.pack)).toEqual(["vcsl:acoustic-kit", "lm-2"]);
    expect(packChain("piano", { ...DEFAULT_SOUNDS, piano: "wurlitzer" }).length).toBeGreaterThan(1);
  });
});

describe("sample gaps", () => {
  it("fetch the same note's neighbouring layer for a file the host is missing", async () => {
    const asked: string[] = [];
    const storage = bridgeGaps({ fetch: async (url) => (asked.push(url), { status: 200, arrayBuffer: async () => new ArrayBuffer(0), json: async () => null, text: async () => "" }) }, { "cp80/samples/080-G#5-MP.ogg": "cp80/samples/080-G#5-F.ogg" });
    const base = "https://example.org/e-pianos/cp80/samples";
    await storage.fetch(`${base}/080-G%235-MP.ogg`);
    await storage.fetch(`${base}/060-C4-MP.ogg`);
    expect(asked).toEqual([`${base}/080-G%235-F.ogg`, `${base}/060-C4-MP.ogg`]);
  });
});

describe("held notes", () => {
  // every voice the band holds, by the MusyngKite soundfont it plays
  const HELD: [InstrumentId, string][] = [
    ["trumpet", "trumpet"],
    ["sax", "tenor_sax"],
    ["trombone", "trombone"],
    ["clarinet", "clarinet"],
    ["flute", "flute"],
    ["violin", "violin"],
    ["cello", "cello"],
    ["organ", "drawbar_organ"],
    ["pad", "string_ensemble_1"],
    ["pad", "choir_aahs"],
  ];

  it("loop on our own points, every note in the range, long and late in the sample", () => {
    for (const [instrument, name] of HELD) {
      const { loopDataUrl } = loopSource(name, "MusyngKite");
      expect(loopDataUrl, name).toBe(`/soundfont-loops/MusyngKite/${name}-loop.json`);
      const loops = JSON.parse(readFileSync(`public${loopDataUrl}`, "utf8")) as Record<string, [number, number]>;
      const byMidi = new Map(Object.entries(loops).map(([note, loop]) => [noteMidi(note), loop]));
      const [lo, hi] = INSTRUMENTS[instrument].range;
      for (let midi = lo; midi <= hi; midi++) {
        const loop = byMidi.get(midi);
        expect(loop, `${name} ${midi}`).toBeDefined();
        // goldst.dev's trumpet looped 1.5 to 9 ms from half a second in: a buzz at another pitch
        const [start, end] = loop!.map((x) => x / 44100);
        expect(end - start, `${name} ${midi} loop length`).toBeGreaterThanOrEqual(0.5);
        expect(end - start, `${name} ${midi} loop length`).toBeLessThanOrEqual(1.6);
        expect(start, `${name} ${midi} loop start`).toBeGreaterThan(1);
      }
    }
  });
});

describe("the grand pianos", () => {
  it("the Splendid's one loaded layer plays every velocity on every key", () => {
    const preset = splendidPreset(rootSubset(SPLENDID_SAMPLES, [48, 60, 67, 72]));
    expect(preset.groups).toHaveLength(1);
    const [group] = preset.groups;
    expect(group.velRange).toBeUndefined();
    for (const r of group.regions) {
      expect(r.velRange).toBeUndefined();
      expect(r.sample).not.toMatch(/ /);
    }
    for (let key = 0; key <= 127; key++) expect(group.regions.some((r) => r.keyRange![0] <= key && key <= r.keyRange![1]), `key ${key}`).toBe(true);
  });

  it("packs that aren't level with the piano carry their own volume, picked or as a fallback", () => {
    const splendid = (sounds = DEFAULT_SOUNDS) => packChain("piano", sounds).find((p) => p.pack === "splendid");
    expect(splendid()?.volume).toBe(SPLENDID_VOLUME); // Salamander's fallback
    expect(splendid({ ...DEFAULT_SOUNDS, piano: "splendid" })?.volume).toBe(SPLENDID_VOLUME);
    expect(packChain("piano", { ...DEFAULT_SOUNDS, piano: "wurlitzer" })[0].volume).toBe(EPIANO_VOLUME.WurlitzerEP200);
    expect(packChain("piano", { ...DEFAULT_SOUNDS, piano: "cp80" })[0].volume).toBe(EPIANO_VOLUME.CP80);
    // the e-pianos' soundfont fallbacks play at the piano's own level
    expect(packChain("piano", { ...DEFAULT_SOUNDS, piano: "wurlitzer" })[1].volume).toBeUndefined();
  });
});
