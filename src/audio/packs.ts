import {
  DrumMachine,
  ElectricPiano,
  Instrument,
  LAYERS,
  Mallet,
  Sampler,
  Soundfont,
  type Scheduler,
  type Smplr,
  type SmplrPreset,
  type Storage,
} from "smplr";
import type { InstrumentId } from "@/music/types";
import { DRUM, INSTRUMENTS } from "@/music/instruments";
import { BowedVoice, loadBowedSamples, setBowed } from "./bowed";
import { CountingStorage } from "./storage";

// One open sampled instrument per animal. Each instrument has a fallback chain; the first
// pack that actually delivers samples wins. Packs are swappable without touching the engine.

export type PianoPack = "salamander" | "splendid" | "soundfont" | "wurlitzer" | "cp80" | "harpsichord";
export type DrumKit = "acoustic" | "lm2";
export type Room = "dry" | "club" | "hall";
/** What the string machine plays: the string ensemble or the choir. */
export type PadVoice = "strings" | "choir";

/** How the band sounds in this browser: the piano and drum samples, the room, the count-in. */
export interface Sounds {
  piano: PianoPack;
  drums: DrumKit;
  room: Room;
  /** The string pad's voice. */
  pad: PadVoice;
  /** A bar of clicks before a take from the top. */
  countIn: boolean;
}

export const DEFAULT_SOUNDS: Sounds = { piano: "salamander", drums: "acoustic", room: "club", pad: "strings", countIn: true };

export const PIANO_PACKS: PianoPack[] = ["salamander", "splendid", "soundfont", "wurlitzer", "cp80", "harpsichord"];
export const DRUM_KITS: DrumKit[] = ["acoustic", "lm2"];
export const ROOMS: Room[] = ["dry", "club", "hall"];
export const PAD_VOICES: PadVoice[] = ["strings", "choir"];

/** Each instrument's reverb send (REVERB_SEND) is scaled by the room. */
export const ROOM_SEND: Record<Room, number> = { dry: 0.3, club: 1, hall: 2.2 };

/** A saved or shared value read back as a sound we have (anything else is the default). */
export function readSounds(raw: unknown, legacyPiano?: unknown): Sounds {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Sounds, unknown>>;
  const piano = o.piano ?? legacyPiano;
  return {
    piano: PIANO_PACKS.includes(piano as PianoPack) ? (piano as PianoPack) : DEFAULT_SOUNDS.piano,
    drums: DRUM_KITS.includes(o.drums as DrumKit) ? (o.drums as DrumKit) : DEFAULT_SOUNDS.drums,
    room: ROOMS.includes(o.room as Room) ? (o.room as Room) : DEFAULT_SOUNDS.room,
    pad: PAD_VOICES.includes(o.pad as PadVoice) ? (o.pad as PadVoice) : DEFAULT_SOUNDS.pad,
    countIn: typeof o.countIn === "boolean" ? o.countIn : DEFAULT_SOUNDS.countIn,
  };
}

export interface PackContext {
  ctx: AudioContext;
  destination: AudioNode;
  scheduler: Scheduler;
  storage: CountingStorage;
  volume: number;
  pan: number;
  onProgress: (loaded: number, total: number) => void;
  /** Notes we expect to play (only some packs use it). */
  notes?: number[];
}

export interface PackSpec {
  pack: string;
  /** Its own level, when it isn't level with the instrument's (the volume it's created with). */
  volume?: number;
  create(p: PackContext): Smplr;
  /** Rebuild/extend sample set for new notes without a new instance (Salamander). */
  extend?: (inst: Smplr, notes: number[], failedUrls: Set<string>) => Promise<void>;
}

// ─── Grand pianos sampled at roots: only the roots a chart needs ────────────

interface RootSample {
  name: string;
  midi: number;
}

function nearestRoot(all: RootSample[], note: number): RootSample {
  let best = all[0];
  for (const s of all) {
    if (Math.abs(s.midi - note) < Math.abs(best.midi - note)) best = s;
  }
  return best;
}

/** Roots needed to cover `notes` (the nearest to each). All of them when notes is empty/undefined. */
export function rootSubset(all: RootSample[], notes?: number[]): RootSample[] {
  if (!notes || notes.length === 0) return all;
  const picked = new Map<string, RootSample>();
  for (const n of notes) {
    if (!Number.isFinite(n)) continue;
    const s = nearestRoot(all, Math.round(n));
    picked.set(s.name, s);
  }
  // Always keep a low, middle and high anchor so stray notes don't pitch-shift absurdly.
  for (const anchor of [36, 60, 84]) {
    const s = nearestRoot(all, anchor);
    picked.set(s.name, s);
  }
  return [...picked.values()].sort((a, b) => a.midi - b.midi);
}

/** Spread key ranges so every MIDI key maps to its nearest loaded root (at every velocity). */
function spreadRoots(samples: RootSample[]): SmplrPreset["groups"][number]["regions"] {
  const sorted = [...samples].sort((a, b) => a.midi - b.midi);
  return sorted.map((s, i) => {
    const lo = i === 0 ? 0 : Math.floor((sorted[i - 1].midi + s.midi) / 2) + 1;
    const hi = i === sorted.length - 1 ? 127 : Math.floor((s.midi + sorted[i + 1].midi) / 2);
    return { sample: s.name, keyRange: [lo, hi] as [number, number], pitch: s.midi };
  });
}

/**
 * A piano that loads the roots a chart needs, and more when a later one needs them (rebuilt without
 * any that failed). `volume` is its own level when it isn't level with the piano's.
 */
function rootedPiano(pack: string, all: RootSample[], presetOf: (samples: RootSample[]) => SmplrPreset, volume?: number): PackSpec {
  const loaded = new WeakMap<Smplr, Set<string>>();
  return {
    pack,
    volume,
    create(p) {
      const subset = rootSubset(all, p.notes);
      const inst = Sampler(p.ctx, {
        preset: presetOf(subset),
        destination: p.destination,
        scheduler: p.scheduler,
        storage: p.storage,
        volume: p.volume,
        pan: p.pan,
        onLoadProgress: ({ loaded, total }) => p.onProgress(loaded, total),
      });
      loaded.set(inst, new Set(subset.map((s) => s.name)));
      return inst;
    },
    async extend(inst, notes, failedUrls) {
      const have = loaded.get(inst) ?? new Set<string>();
      const want = rootSubset(all, notes);
      const missing = want.filter((s) => !have.has(s.name));
      const failed = (name: string) => [...failedUrls].some((u) => u.includes(`/${name}.`));
      const union = all.filter((s) => (have.has(s.name) || want.includes(s)) && !failed(s.name));
      const anyFailedLoaded = [...have].some(failed);
      if (missing.length === 0 && !anyFailedLoaded) return;
      const sampler = inst as Smplr & { reload?: (p: SmplrPreset) => Promise<void> };
      if (typeof sampler.reload !== "function" || union.length === 0) return;
      await sampler.reload(presetOf(union));
      loaded.set(inst, new Set(union.map((s) => s.name)));
    },
  };
}

// ─── Salamander Grand Piano (Tone.js hosted, CC-BY 3.0, Alexander Holm) ──────

export const SALAMANDER_BASE = "https://tonejs.github.io/audio/salamander";

export const SALAMANDER_SAMPLES: RootSample[] = (() => {
  const out: RootSample[] = [{ name: "A0", midi: 21 }];
  for (let oct = 1; oct <= 7; oct++) {
    const c = 12 * (oct + 1);
    out.push({ name: `C${oct}`, midi: c });
    out.push({ name: `Ds${oct}`, midi: c + 3 });
    out.push({ name: `Fs${oct}`, midi: c + 6 });
    out.push({ name: `A${oct}`, midi: c + 9 });
  }
  out.push({ name: "C8", midi: 108 });
  return out;
})();

export function salamanderPreset(samples: RootSample[]): SmplrPreset {
  return {
    meta: {
      name: "Salamander Grand Piano",
      license: "CC-BY 3.0",
      source: "https://tonejs.github.io/audio/salamander/",
    },
    samples: { baseUrl: SALAMANDER_BASE, formats: ["ogg", "mp3"] },
    defaults: { ampRelease: 0.7 },
    groups: [{ regions: spreadRoots(samples) }],
  };
}

const salamander = rootedPiano("salamander", SALAMANDER_SAMPLES, salamanderPreset);

// ─── Splendid Grand Piano (Akai, public domain) ──────────────────────────────
// Its mezzo layer only (one download, like Salamander's), playing every velocity: smplr's own
// loader keeps that layer's 68–84 velocity range, so every softer or harder note was silent.

export const SPLENDID_BASE = "https://smpldsnds.github.io/sfzinstruments-splendid-grand-piano/samples";

export const SPLENDID_SAMPLES: RootSample[] = (LAYERS.find((l) => l.name === "MP")?.samples ?? []).map(([midi, name]) => ({
  midi: Number(midi),
  name: encodeURI(String(name)),
}));

export function splendidPreset(samples: RootSample[]): SmplrPreset {
  return {
    meta: { name: "Splendid Grand Piano (mezzo)", license: "public domain", source: "https://github.com/sfzinstruments/SplendidGrandPiano" },
    samples: { baseUrl: SPLENDID_BASE, formats: ["ogg", "m4a"] },
    defaults: { ampRelease: 0.6 },
    groups: [{ regions: spreadRoots(samples) }],
  };
}

/** Its mezzo layer runs 11 dB over Salamander on the same line (it's Salamander's fallback too). */
export const SPLENDID_VOLUME = 55;

const splendid = rootedPiano("splendid", SPLENDID_SAMPLES, splendidPreset, SPLENDID_VOLUME);

type SoundfontKit = "MusyngKite" | "FluidR3_GM";

/**
 * Bowed, blown and held voices loop their samples (the MIDI.js samples run about three
 * seconds), so a whole note at a slow tempo holds instead of cutting out.
 */
const SUSTAINED = new Set(["violin", "cello", "trumpet", "tenor_sax", "trombone", "clarinet", "flute", "string_ensemble_1", "choir_aahs", "church_organ", "drawbar_organ"]);

/**
 * Loop points worked out from the samples themselves (scripts/soundfont-loops.py: late in the
 * sustain, where the level and the waveform both join up) and served from public/. goldst.dev,
 * smplr's default, has none for some voices, and for others loops a few milliseconds that aren't
 * a whole number of the note's cycles, shared across notes: every MusyngKite trumpet note held
 * past about half a second turned into a buzz at another pitch, and so did some of the sax's and
 * the flute's; the violin's stepped up 8 dB six times a second.
 */
const OWN_LOOPS: Record<SoundfontKit, string[]> = {
  MusyngKite: ["trumpet", "tenor_sax", "trombone", "clarinet", "flute", "violin", "cello", "drawbar_organ", "string_ensemble_1", "choir_aahs"],
  FluidR3_GM: ["string_ensemble_1", "choir_aahs"],
};

/** Where a soundfont's loop points come from: smplr's default (goldst.dev), ours, or none. */
export function loopSource(name: string, kit: SoundfontKit): { loadLoopData: boolean; loopDataUrl?: string } {
  if (!SUSTAINED.has(name)) return { loadLoopData: false };
  return OWN_LOOPS[kit].includes(name) ? { loadLoopData: true, loopDataUrl: `/soundfont-loops/${kit}/${name}-loop.json` } : { loadLoopData: true };
}

function soundfont(name: string, kit: SoundfontKit): PackSpec {
  return {
    pack: `${kit === "MusyngKite" ? "musyngkite" : "fluidr3"}:${name}`,
    create(p) {
      return Soundfont(p.ctx, {
        instrument: name,
        kit,
        ...loopSource(name, kit),
        destination: p.destination,
        scheduler: p.scheduler,
        storage: p.storage,
        volume: p.volume,
        pan: p.pan,
        onLoadProgress: ({ loaded, total }) => p.onProgress(loaded, total),
      });
    },
  };
}

/** smplr's soundfont make-up gain (its `extraGain`): the bowed voice matches it, so levels don't move. */
export const SOUNDFONT_GAIN = 5;

/**
 * A bowed line's own voice (bowed.ts): the same soundfont, decoded once, with an envelope per
 * note (slurs, swells, vibrato, slides) instead of smplr's flat one. A smplr instrument with no
 * samples of its own carries it, so its pan, level and reverb send work like any other's.
 */
function bowed(instrument: InstrumentId, kit: SoundfontKit): PackSpec {
  const name = SOUNDFONT_NAME[instrument];
  return {
    pack: `bowed:${kit === "MusyngKite" ? "musyngkite" : "fluidr3"}:${name}`,
    create(p) {
      const Bowed = Instrument<object>((ctx, _opts, smplr) => {
        const bus = ctx.createGain();
        bus.gain.value = SOUNDFONT_GAIN;
        smplr.output.addInsert(bus);
        return loadBowedSamples(ctx, p.storage, name, kit, INSTRUMENTS[instrument].range, p.onProgress, loopSource(name, kit).loopDataUrl).then((samples) => {
          setBowed(smplr, new BowedVoice(ctx, bus, samples));
        });
      });
      return Bowed(p.ctx, { destination: p.destination, scheduler: p.scheduler, storage: p.storage, volume: p.volume, pan: p.pan });
    },
  };
}

// D. Smolken's 1958 Rubner double bass (royalty-free). The full pizz set is ~180 files; we
// build our own preset from the mezzo layer with two round-robins (~20 files, ~1.6 MB).
export const SMOLKEN_BASE = "https://smpldsnds.github.io/sfzinstruments-dsmolken-double-bass";
const SMOLKEN_ROOTS: Array<[string, number]> = [
  ["c1", 24],
  ["eb1", 27],
  ["g1", 31],
  ["d2", 38],
  ["f2", 41],
  ["a2", 45],
  ["c3", 48],
  ["e3", 52],
  ["g3", 55],
  ["a3", 57],
];

export function smolkenPreset(): SmplrPreset {
  const regions: SmplrPreset["groups"][number]["regions"] = [];
  SMOLKEN_ROOTS.forEach(([name, midi], i) => {
    const lo = i === 0 ? 0 : Math.floor((SMOLKEN_ROOTS[i - 1][1] + midi) / 2) + 1;
    const hi = i === SMOLKEN_ROOTS.length - 1 ? 127 : Math.floor((midi + SMOLKEN_ROOTS[i + 1][1]) / 2);
    ["a", "b"].forEach((rr, k) => {
      regions.push({ sample: `pizz/pizz_${name}_m${rr}`, keyRange: [lo, hi], pitch: midi, seqPosition: k + 1 });
    });
  });
  return {
    meta: { name: "Smolken double bass (pizz, mezzo)", license: "royalty-free", source: SMOLKEN_BASE },
    samples: { baseUrl: SMOLKEN_BASE, formats: ["ogg", "m4a"] },
    defaults: { ampRelease: 0.3 },
    groups: [{ seqLength: 2, regions }],
  };
}

const smolkenPizz: PackSpec = {
  pack: "smolken:pizzicato",
  create(p) {
    return Sampler(p.ctx, {
      preset: smolkenPreset(),
      destination: p.destination,
      scheduler: p.scheduler,
      storage: p.storage,
      volume: p.volume,
      pan: p.pan,
      onLoadProgress: ({ loaded, total }) => p.onProgress(loaded, total),
    });
  },
};

const lm2: PackSpec = {
  pack: "lm-2",
  create(p) {
    return DrumMachine(p.ctx, {
      instrument: "LM-2",
      destination: p.destination,
      scheduler: p.scheduler,
      storage: p.storage,
      volume: p.volume,
      pan: p.pan,
      onLoadProgress: ({ loaded, total }) => p.onProgress(loaded, total),
    } as Parameters<typeof DrumMachine>[1]);
  },
};

const vibes: PackSpec = {
  pack: "vcsl:vibraphone-soft",
  create(p) {
    return Mallet(p.ctx, {
      instrument: "Vibraphone - Soft Mallets",
      destination: p.destination,
      scheduler: p.scheduler,
      storage: p.storage,
      volume: p.volume,
      pan: p.pan,
      onLoadProgress: ({ loaded, total }) => p.onProgress(loaded, total),
    } as Parameters<typeof Mallet>[1]);
  },
};

// ─── Electric pianos (Greg Sullivan, CC-BY 3.0) ──────────────────────────────

// Their samples are normalized hot: at the piano's volume the Wurlitzer runs 9 dB over Salamander on
// the same line, the CP80 7.5 dB. (Matched once at a single note, both had taken 15 dB off, which
// left them 6 to 7 dB under the band.)
export const EPIANO_VOLUME: Record<"WurlitzerEP200" | "CP80", number> = { WurlitzerEP200: 64, CP80: 69 };

// Files the hosted sets are missing (404) or that won't decode, each replaced by the same note
// one velocity layer over: a region with no sample would play silence.
export const EPIANO_GAPS: Record<string, string> = {
  "cp80/samples/057-A3-F.ogg": "cp80/samples/057-A3-FF.ogg",
  "cp80/samples/065-F4-PP.ogg": "cp80/samples/065-F4-MP.ogg",
  "cp80/samples/080-G#5-MP.ogg": "cp80/samples/080-G#5-F.ogg",
  "wurlitzer-ep200/samples/ab6mp.ogg": "wurlitzer-ep200/samples/ab6f.ogg",
};

/** Storage that fetches a known gap's stand-in instead. */
export function bridgeGaps(storage: Storage, gaps: Record<string, string>): Storage {
  return {
    fetch(url) {
      const plain = decodeURIComponent(url);
      for (const [from, to] of Object.entries(gaps)) {
        if (plain.endsWith(`/${from}`)) return storage.fetch(encodeURI(plain.slice(0, -from.length) + to).replace(/#/g, "%23"));
      }
      return storage.fetch(url);
    },
  };
}

function epiano(name: "WurlitzerEP200" | "CP80", pack: string): PackSpec {
  return {
    pack,
    volume: EPIANO_VOLUME[name],
    create(p) {
      return ElectricPiano(p.ctx, {
        instrument: name,
        destination: p.destination,
        scheduler: p.scheduler,
        volume: p.volume,
        storage: bridgeGaps(p.storage, EPIANO_GAPS),
        pan: p.pan,
        onLoadProgress: ({ loaded, total }) => p.onProgress(loaded, total),
      });
    },
  };
}

// ─── Acoustic kit (Versilian Community Sample Library, CC0) ─────────────────
// Built from VCSL's kick, snare, toms, hi-hat and two suspended cymbals played with a stick
// (one rides, one crashes): velocity layers, two round-robins where VCSL has them, and the
// open hat choked by the closed and pedal hat. Keyed by General MIDI drum note, like the parts.

export const VCSL_BASE = "https://smpldsnds.github.io/sgossner-vcsl";
const IDIO = "Idiophones/Struck Idiophones";
const MEMB = "Membranophones/Struck Membranophones";

type KitLayer = { file: string; vel?: [number, number]; rr?: number; trim: number };
interface KitPiece {
  keys: number[];
  /** The note the samples sound at (toms are retuned from it); defaults to each key. */
  pitch?: number;
  layers: KitLayer[];
  group?: number;
  offBy?: number;
  release?: number;
}

/**
 * Velocity layers splitting 1..127, from soft to hard, each with `rr` round-robins. `peaks` is
 * each layer's measured peak (dBFS): VCSL records its layers at their natural level (a snare's
 * softest tap peaks 27 dB under its hardest), and smplr scales by velocity on top of that, so
 * each layer is trimmed onto a gentle curve, -13 dB for the softest up to -1 dB for the hardest
 * (a single-layer piece sits at -3, like the LinnDrum the drum parts were balanced on).
 */
function layers(peaks: number[], file: (layer: number, rr: number) => string, rr = 2): KitLayer[] {
  const n = peaks.length;
  const out: KitLayer[] = [];
  peaks.forEach((peak, i) => {
    const vel: [number, number] = [i === 0 ? 1 : Math.round((127 * i) / n) + 1, Math.round((127 * (i + 1)) / n)];
    const target = n === 1 ? -3 : -13 + (12 * i) / (n - 1);
    const trim = Math.round(Math.min(24, target - peak) * 10) / 10;
    for (let k = 1; k <= rr; k++) out.push({ file: file(i, k), vel: n > 1 ? vel : undefined, rr: rr > 1 ? k : undefined, trim });
  });
  return out;
}

const HAT = `${IDIO}/Hi-Hat Cymbal`;
const RIDE = `${IDIO}/Suspended Cymbal 2/susCymb2_hit`;
const CRASH = `${IDIO}/Suspended Cymbal 1/susCymb1_hit`;
const HIGH_TOM = (i: number, k: number) => `${MEMB}/Tom 1/Stick/TomH_HitS_v${i + 2}_rr${k}_Mid`;
const LOW_TOM = (i: number, k: number) => `${MEMB}/Tom 2/Stick/TomL_HitS_v${i + 2}_rr${k}_Mid`;

// peaks measured in the browser from the decoded samples (round-robins sit within 2 dB)
export const ACOUSTIC_KIT: KitPiece[] = [
  { keys: [35, 36], pitch: 36, layers: layers([-22.3, -16.9, -9.8, -4.6], (i, k) => `${MEMB}/Bass Drum 1/BDrumNew_hit_v${[2, 3, 5, 7][i]}_rr${k}_Sum`) },
  { keys: [38, 40], pitch: 38, layers: layers([-29.6, -21.8, -7, -2.8], (i, k) => `${MEMB}/Snare Drum, Modern 1/Snare2_HitSN_v${[3, 5, 7, 9][i]}_rr${k}_Mid`) },
  { keys: [37], layers: layers([-21.2], (_, k) => `${MEMB}/Snare Drum, Modern 2/Snare3M_Xstick_v2_rr${k}_Mid`) },
  { keys: [39], layers: layers([-0.5], (_, k) => `${IDIO}/Claps/Clap_rr${k}`) },
  { keys: [42], group: 1, layers: layers([-36.3, -24.1, -13.7, -8.3], (i, k) => `${HAT}/HiHat_HitC_v${i + 1}_rr${k}_Mid`) },
  { keys: [44], group: 1, layers: layers([-21.7], (_, k) => `${HAT}/HiHat_Close_rr${k}_Mid`) },
  { keys: [46], offBy: 1, release: 0.08, layers: layers([-10.4], (_, k) => `${HAT}/HiHat_HitO_rr${k}_Mid`) },
  { keys: [51, 59], pitch: 51, release: 1.2, layers: layers([-32.5, -18.8, -18.1], (i) => `${RIDE}_stick_${["pp1", "mp1", "mf1"][i]}`, 1) },
  { keys: [53], release: 1.2, layers: layers([-16.9, -12.5], (i) => `${RIDE}_bell_${["p1", "f1"][i]}`, 1) },
  { keys: [49, 57], pitch: 49, release: 1.5, layers: layers([-34.1, -25.3, -15.5], (i) => `${CRASH}_stick_${["pp1", "mp1", "f1"][i]}`, 1) },
  // the rack toms are VCSL's high tom, the floor toms its low one, each retuned a little
  { keys: [48, 50], pitch: 50, layers: layers([-26.3, -16, -9.6], HIGH_TOM) },
  { keys: [47], pitch: 49, layers: layers([-26.3, -16, -9.6], HIGH_TOM) },
  { keys: [41, 43, 45], pitch: 45, layers: layers([-24.6, -13.8, -8.6], LOW_TOM) },
  { keys: [54], layers: layers([-28.2, -17.3], (i) => `${IDIO}/Tambourine 1/Tamb1_Hit_v${i + 1}_rr1_Mid`, 1) },
  { keys: [56], layers: layers([-24.6, -18.3], (i) => `${IDIO}/Cowbells/Cowbell1_Hit_v${i + 2}_rr1_Mid`, 1) },
  { keys: [69, 70], pitch: 70, layers: layers([-29], (_, k) => `${IDIO}/Shaker, Small/Mid_Shaker_Slap_rr${k}`) },
  { keys: [62], layers: layers([-26.8], (_, k) => `${MEMB}/Conga/Conga_HitFM_v1_rr${k}_Sum`) },
  { keys: [63], layers: layers([-34.3, -20.8, -16.3], (i) => `${MEMB}/Conga/Conga_HitN_v${i + 1}_rr1_Sum`, 1) },
  { keys: [64], layers: layers([-58, -30.2, -24.8], (i) => `${MEMB}/Conga/Tumba_HitN_v${i + 1}_rr1_Sum`, 1) },
];

export function acousticKitPreset(): SmplrPreset {
  const groups: SmplrPreset["groups"] = [];
  for (const piece of ACOUSTIC_KIT) {
    const seq = piece.layers.some((l) => l.rr !== undefined);
    for (const key of piece.keys) {
      groups.push({
        seqLength: seq ? 2 : undefined,
        group: piece.group,
        offBy: piece.offBy,
        ampRelease: piece.release,
        regions: piece.layers.map((l) => ({
          sample: encodeURI(l.file),
          keyRange: [key, key] as [number, number],
          pitch: piece.pitch ?? key,
          velRange: l.vel,
          seqPosition: seq ? l.rr : undefined,
          volume: l.trim,
        })),
      });
    }
  }
  return {
    meta: { name: "VCSL acoustic kit", license: "CC0 1.0", source: "https://github.com/sgossner/VCSL" },
    samples: { baseUrl: VCSL_BASE, formats: ["ogg", "m4a"] },
    defaults: { ampRelease: 0.4 },
    groups,
  };
}

const acousticKit: PackSpec = {
  pack: "vcsl:acoustic-kit",
  create(p) {
    return Sampler(p.ctx, {
      preset: acousticKitPreset(),
      destination: p.destination,
      scheduler: p.scheduler,
      storage: p.storage,
      volume: p.volume,
      pan: p.pan,
      onLoadProgress: ({ loaded, total }) => p.onProgress(loaded, total),
    });
  },
};

/** Level-matched volume for the pizzicato voice (that pack runs ~3 dB quieter than arco). */
export const PIZZ_VOLUME = 121;

/** Plucked voice for bowed strings (cello/violin pizzicato). */
export function pizzChain(): PackSpec[] {
  return [soundfont("pizzicato_strings", "MusyngKite"), soundfont("pizzicato_strings", "FluidR3_GM")];
}

/** Fallback chain per instrument, best first. */
export function packChain(instrument: InstrumentId, sounds: Sounds = DEFAULT_SOUNDS): PackSpec[] {
  switch (instrument) {
    case "piano": {
      const sf = soundfont("acoustic_grand_piano", "MusyngKite");
      if (sounds.piano === "soundfont") return [sf, soundfont("acoustic_grand_piano", "FluidR3_GM")];
      if (sounds.piano === "splendid") return [splendid, sf];
      if (sounds.piano === "wurlitzer") return [epiano("WurlitzerEP200", "gs:wurlitzer"), soundfont("electric_piano_1", "MusyngKite"), sf];
      if (sounds.piano === "cp80") return [epiano("CP80", "gs:cp80"), soundfont("electric_grand_piano", "MusyngKite"), sf];
      if (sounds.piano === "harpsichord") return [soundfont("harpsichord", "MusyngKite"), soundfont("harpsichord", "FluidR3_GM"), sf];
      return [salamander, splendid, sf];
    }
    case "bass":
      return [smolkenPizz, soundfont("acoustic_bass", "MusyngKite"), soundfont("acoustic_bass", "FluidR3_GM")];
    case "drums":
      return sounds.drums === "lm2" ? [lm2] : [acousticKit, lm2];
    case "vibes":
      return [vibes, soundfont("vibraphone", "MusyngKite"), soundfont("vibraphone", "FluidR3_GM")];
    case "pad": {
      const voice = sounds.pad === "choir" ? "choir_aahs" : "string_ensemble_1";
      return [soundfont(voice, "MusyngKite"), soundfont(voice, "FluidR3_GM")];
    }
    case "violin":
      // its own bowed voice, or (if that can't load) the plain soundfont
      return [bowed("violin", "MusyngKite"), soundfont("violin", "MusyngKite"), soundfont("violin", "FluidR3_GM")];
    default: {
      const name = SOUNDFONT_NAME[instrument];
      return [soundfont(name, "MusyngKite"), soundfont(name, "FluidR3_GM")];
    }
  }
}

const SOUNDFONT_NAME: Record<InstrumentId, string> = {
  piano: "acoustic_grand_piano",
  bass: "acoustic_bass",
  drums: "synth_drum",
  trumpet: "trumpet",
  sax: "tenor_sax",
  trombone: "trombone",
  clarinet: "clarinet",
  flute: "flute",
  violin: "violin",
  cello: "cello",
  guitar: "acoustic_guitar_nylon",
  vibes: "vibraphone",
  organ: "drawbar_organ",
  pad: "string_ensemble_1",
};

/**
 * Default instrument volume (smplr 0..127), level-matched: each pack plays the same line at the
 * same touch, bounced offline, and is brought to the grand's loudness (−21.7 LUFS, within 1 LU;
 * "Measure the packs" in the audio lab). The packs differ by up to 9 dB out of the box: the VCSL
 * vibraphone, the cello and the clarinet/sax soundfonts are hot, the organ and the bass quiet. The
 * drums are matched on a groove. Musical balance (melody on top) is done by role, not here.
 */
export const DEFAULT_VOLUME: Record<InstrumentId, number> = {
  piano: 106,
  bass: 125,
  drums: 80,
  trumpet: 93,
  sax: 83,
  trombone: 112,
  clarinet: 78,
  flute: 87,
  violin: 114,
  cello: 85,
  guitar: 104,
  vibes: 59,
  organ: 100,
  pad: 96,
};

/**
 * The string pad's two voices sit 9 dB apart out of the box (the string ensemble is hot, the
 * choir quiet); each is matched like the rest.
 */
export const PAD_VOLUME: Record<PadVoice, number> = { strings: 66, choir: 93 };

/** The harpsichord soundfont runs 2 dB over Salamander on the same line. */
export const HARPSICHORD_VOLUME = 95;

/** An instrument's volume with these sounds (the pad's depends on its voice, the keys on their pack). */
export function instrumentVolume(instrument: InstrumentId, sounds: Sounds): number {
  if (instrument === "pad") return PAD_VOLUME[sounds.pad];
  if (instrument === "piano" && sounds.piano === "harpsichord") return HARPSICHORD_VOLUME;
  return DEFAULT_VOLUME[instrument];
}

/** Reverb send per instrument. */
export const REVERB_SEND: Record<InstrumentId, number> = {
  piano: 0.16,
  bass: 0.05,
  drums: 0.08,
  trumpet: 0.18,
  sax: 0.18,
  trombone: 0.16,
  clarinet: 0.18,
  flute: 0.2,
  violin: 0.2,
  cello: 0.16,
  guitar: 0.14,
  vibes: 0.2,
  organ: 0.14,
  pad: 0.24,
};

/** Instruments whose notes decay on their own; they get a little extra ring. */
export const DECAYING: Partial<Record<InstrumentId, true>> = {
  piano: true,
  vibes: true,
  guitar: true,
  bass: true,
};

// ─── Drums: General MIDI → LM-2 sample names ────────────────────────────────

const LM2_MAP: Record<number, string> = {
  [DRUM.kick]: "kick",
  35: "kick-alt",
  [DRUM.stick]: "stick-m",
  [DRUM.snare]: "snare-m",
  40: "snare-h",
  [DRUM.clap]: "clap",
  [DRUM.hatClosed]: "hhclosed",
  [DRUM.hatPedal]: "hhclosed-short",
  [DRUM.hatOpen]: "hhopen",
  [DRUM.crash]: "crash",
  57: "crash",
  [DRUM.ride]: "ride",
  [DRUM.rideBell]: "ride",
  59: "ride",
  [DRUM.highTom]: "tom-hh",
  48: "tom-h",
  [DRUM.midTom]: "tom-m",
  [DRUM.lowTom]: "tom-l",
  [DRUM.floorTom]: "tom-ll",
  41: "tom-ll",
  [DRUM.tambourine]: "tambourine",
  [DRUM.cowbell]: "cowbell",
  69: "cabasa",
  [DRUM.shaker]: "cabasa",
  62: "conga-h",
  [DRUM.congaHi]: "conga-h",
  [DRUM.congaLo]: "conga-l",
};

export function lm2Sample(pitch: number, vel: number, art?: string): string | null {
  const name = LM2_MAP[pitch];
  if (!name) return null;
  if (name === "snare-m") {
    if (art === "accent" || vel >= 0.85) return "snare-h";
    if (art === "ghost" || vel < 0.35) return "snare-l";
  }
  if (name === "stick-m" && (art === "accent" || vel >= 0.85)) return "stick-h";
  return name;
}
