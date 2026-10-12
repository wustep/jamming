// Save or share a jam: its whole configuration, as a link or an entry in this browser. A take
// the engine plays is fully determined by its settings, its band and its seed (see
// generateLocal), so the configuration is all a link needs to play the same notes again. The
// rest of it (the sounds and room, the brains and their knobs, playing along, who's muted, the
// sentence the arranger read) comes back with it, so the jam opens as it was set up.
//
// Model-written takes can't be rebuilt from a seed. A link carries their configuration and
// seed only (`engine: "ai"`), and says so where it opens: the engine plays that setup, and the
// models' parts differ. A jam saved in this browser keeps the models' notes as well (saved.ts).
//
// Format: `/s/2.<base64url JSON>`. The leading number versions the payload; the music engine
// itself isn't versioned, so an old link replays with whatever the band plays today. The jam
// rides in the path so the server sees it and can unfurl the link with a card (app/s/[t]).
// Version 1 carried only the music (style, key, tempo, band, seed…), first in the hash
// (`#t=1.…`) and then in the path (`/s/1.…`): both still play, with the visitor's own sounds
// and brains.

import { modelInfo } from "@/ai/models";
import { DEFAULT_SOUNDS, readSounds, type Sounds } from "@/audio/packs";
import { FEELS, type FeelId } from "@/music/playing";
import { HARMONY_BOOKS, type BookId } from "@/music/harmony-books";
import { ANIMALS, INSTRUMENTS } from "@/music/instruments";
import type { QuantizeMode } from "@/music/live";
import { defaultSettings } from "@/music/local";
import { getPreset, type PresetId } from "@/music/presets";
import { getStandard } from "@/music/standards";
import { STYLES } from "@/music/styles";
import type { AnimalId, InstrumentId, Member, Score, StyleId, TroopSettings } from "@/music/types";

const VERSION = 2;
export const SHARE_PARAM = "t";
const MAX_MEMBERS = 12;
/** The arranger's sentence rides along up to this long (it reads up to 400, but links should stay short). */
const MAX_ASKED = 200;

/** How you play along with the band (playalong.ts). */
export interface PlayAlongPrefs {
  instrument: InstrumentId;
  quantize: QuantizeMode;
  callResponse: { on: boolean; every: number };
}

export const DEFAULT_PLAY_ALONG: PlayAlongPrefs = { instrument: "piano", quantize: "off", callResponse: { on: false, every: 2 } };

/** The sentence a jam was asked for, and how the arranger read it. */
export interface Asked {
  text: string;
  source: "model" | "keywords" | "fallback";
  model?: string;
  note: string | null;
}

/** Everything that makes a jam what it is. */
export interface JamConfig {
  settings: TroopSettings;
  members: Member[];
  sounds: Sounds;
  playAlong: PlayAlongPrefs;
  /** The heuristic band (no model calls). */
  heuristic: boolean;
  /** Members silenced in the mix. */
  muted: string[];
  /** Which brain played the take: the engine (rebuilt exactly from the seed) or the models. */
  engine: "local" | "ai";
  asked: Asked | null;
}

/**
 * A jam read from a link. A version 1 link has no sounds, play-along, brains or mix (null: keep
 * the visitor's), and its mode and models are the defaults.
 */
export interface SharedJam extends Omit<JamConfig, "sounds" | "playAlong" | "heuristic"> {
  version: 1 | 2;
  sounds: Sounds | null;
  playAlong: PlayAlongPrefs | null;
  heuristic: boolean | null;
}

/** @deprecated the old name: a shared jam. */
export type SharedTake = SharedJam;

// ─── The payload ──────────────────────────────────────────────────────────────
// Short keys, defaults left out: a typical link is ~250 characters.

type MemberRow = [id: string, animal: string, name: string, instrument: string] | [animal: string, instrument: string];

interface PayloadV2 {
  /** The band: [animal, instrument] when the member's id and name are the animal's own. */
  b: MemberRow[];
  st: string;
  /** bars */
  n: number;
  bpm: number;
  /** key: "Bb" major, "Bbm" minor */
  k: string;
  /** beats per bar (absent = 4) */
  m?: number;
  std?: string;
  /** leader id */
  l: string;
  /** soloist ids */
  so: string[];
  sd: number;
  /** improviser: bars per round (absent = 4) */
  ph?: number;
  sw?: string;
  f?: string;
  h?: string;
  p?: string;
  /** "c" composer (absent = improviser) */
  mo?: "c";
  /** composer critic candidates (absent = 4) */
  bo?: number;
  /** director and player models (absent = the defaults) */
  dm?: string;
  pm?: string;
  /** sounds: only what differs from the defaults */
  snd?: Partial<Sounds>;
  /** playing along: [instrument, quantize, call-and-response every N bars or 0 for off] */
  pa?: [string, string, number];
  /** the heuristic band */
  hx?: 1;
  /** muted ids */
  mu?: string[];
  /** the models played this take */
  ai?: 1;
  /** asked: [sentence, source, model, the arranger's note] */
  a?: [string, string, string | null, string | null];
}

interface PayloadV1 {
  s: Partial<Record<keyof TroopSettings, unknown>> & { key?: { tonic?: unknown; mode?: unknown }; meter?: { beats?: unknown } };
  m: unknown[];
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64: string): string {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Anything on stage can be saved and shared (a model-written take as its setup and seed). */
export function canShare(score: Score | null): score is Score {
  return !!score && score.members.length > 0;
}

/** A take's configuration, with the rest of the jam as given (else the defaults). */
export function jamOf(score: Score, rest: Partial<Omit<JamConfig, "settings" | "members" | "engine">> = {}): JamConfig {
  return {
    settings: score.settings,
    members: score.members,
    sounds: DEFAULT_SOUNDS,
    playAlong: DEFAULT_PLAY_ALONG,
    heuristic: false,
    muted: [],
    asked: null,
    ...rest,
    engine: score.engine,
  };
}

/** The value after `/s/` for a jam. */
export function encodeJam(c: JamConfig): string {
  const s = c.settings;
  const d = defaultSettings(c.members);
  const sounds = Object.fromEntries(Object.entries(c.sounds).filter(([k, v]) => DEFAULT_SOUNDS[k as keyof Sounds] !== v)) as Partial<Sounds>;
  const pa = c.playAlong;
  const p: PayloadV2 = {
    b: c.members.map((m) => (m.id === m.animal && m.name === ANIMALS[m.animal].name ? [m.animal, m.instrument] : [m.id, m.animal, m.name, m.instrument])),
    st: s.style,
    n: s.bars,
    bpm: s.tempo,
    k: `${s.key.tonic}${s.key.mode === "minor" ? "m" : ""}`,
    ...(s.meter.beats !== 4 ? { m: s.meter.beats } : {}),
    ...(s.standard ? { std: s.standard } : {}),
    l: s.leaderId,
    so: s.soloists,
    sd: s.seed,
    ...(s.phraseBars !== d.phraseBars ? { ph: s.phraseBars } : {}),
    ...(s.swingFeel && s.swingFeel !== "medium" ? { sw: s.swingFeel } : {}),
    ...(s.feel ? { f: s.feel } : {}),
    ...(s.harmony ? { h: s.harmony } : {}),
    ...(s.preset ? { p: s.preset } : {}),
    ...(s.mode === "composer" ? { mo: "c" as const } : {}),
    ...(s.bestOf !== d.bestOf ? { bo: s.bestOf } : {}),
    ...(s.directorModel !== d.directorModel ? { dm: s.directorModel } : {}),
    ...(s.playerModel !== d.playerModel ? { pm: s.playerModel } : {}),
    ...(Object.keys(sounds).length ? { snd: sounds } : {}),
    ...(pa.instrument !== DEFAULT_PLAY_ALONG.instrument || pa.quantize !== DEFAULT_PLAY_ALONG.quantize || pa.callResponse.on
      ? { pa: [pa.instrument, pa.quantize, pa.callResponse.on ? pa.callResponse.every : 0] as [string, string, number] }
      : {}),
    ...(c.heuristic ? { hx: 1 as const } : {}),
    ...(c.muted.length ? { mu: c.muted } : {}),
    ...(c.engine === "ai" ? { ai: 1 as const } : {}),
    ...(c.asked ? { a: [c.asked.text.slice(0, MAX_ASKED), c.asked.source, c.asked.model ?? null, c.asked.note?.slice(0, MAX_ASKED) ?? null] as PayloadV2["a"] } : {}),
  };
  return `${VERSION}.${toBase64Url(JSON.stringify(p))}`;
}

const int = (v: unknown, lo: number, hi: number): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null);
const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
const TONIC = /^[A-G][b#]?$/;

function readMembers(rows: unknown[]): Member[] | null {
  const members: Member[] = [];
  for (const row of rows.slice(0, MAX_MEMBERS)) {
    if (!Array.isArray(row)) return null;
    const [id, animal, name, instrument] = row.length === 2 ? [row[0], row[0], typeof row[0] === "string" ? ANIMALS[row[0] as AnimalId]?.name : null, row[1]] : row;
    if (!str(id, 40) || !str(name, 24)) return null;
    if (typeof animal !== "string" || typeof instrument !== "string") return null;
    if (!Object.hasOwn(ANIMALS, animal) || !Object.hasOwn(INSTRUMENTS, instrument)) return null;
    if (members.some((x) => x.id === id)) return null;
    members.push({ id, name, animal: animal as AnimalId, instrument: instrument as InstrumentId });
  }
  return members.length ? members : null;
}

/** The music every version carries: checked, clamped, or the link is refused. */
function readMusic(
  raw: { style: unknown; standard: unknown; tonic: unknown; mode: unknown; bars: unknown; tempo: unknown; beats: unknown; seed: unknown; leaderId: unknown; soloists: unknown; phraseBars: unknown; swingFeel: unknown; feel: unknown; harmony: unknown; preset: unknown },
  members: Member[],
): TroopSettings | null {
  if (typeof raw.style !== "string" || !Object.hasOwn(STYLES, raw.style)) return null;
  const style = STYLES[raw.style as StyleId];
  const standard = raw.standard === null || raw.standard === undefined ? null : typeof raw.standard === "string" && getStandard(raw.standard) ? raw.standard : undefined;
  if (standard === undefined) return null;
  const tonic = typeof raw.tonic === "string" && TONIC.test(raw.tonic) ? raw.tonic : null;
  const mode = raw.mode === "major" || raw.mode === "minor" ? raw.mode : null;
  const bars = int(raw.bars, 4, 256);
  const tempo = int(raw.tempo, 30, 320);
  const beats = int(raw.beats, 2, 7);
  const seed = int(raw.seed, 0, 2 ** 32 - 1);
  if (!tonic || !mode || bars === null || tempo === null || beats === null || seed === null) return null;
  const ids = new Set(members.map((x) => x.id));
  return {
    ...defaultSettings(members),
    style: style.id,
    standard,
    bars,
    tempo,
    key: { tonic, mode },
    meter: { beats },
    seed,
    leaderId: typeof raw.leaderId === "string" && ids.has(raw.leaderId) ? raw.leaderId : "",
    soloists: Array.isArray(raw.soloists) ? raw.soloists.filter((id): id is string => typeof id === "string" && ids.has(id)) : [],
    phraseBars: int(raw.phraseBars, 1, 16) ?? 4,
    ...(raw.swingFeel === "light" || raw.swingFeel === "hard" ? { swingFeel: raw.swingFeel } : {}),
    // how it's played and where its changes come from (unknown ones fall back to the style's)
    ...(typeof raw.feel === "string" && Object.hasOwn(FEELS, raw.feel) ? { feel: raw.feel as FeelId } : {}),
    ...(typeof raw.harmony === "string" && Object.hasOwn(HARMONY_BOOKS, raw.harmony) ? { harmony: raw.harmony as BookId } : {}),
    ...(typeof raw.preset === "string" && getPreset(raw.preset) ? { preset: raw.preset as PresetId } : {}),
  };
}

function decodeV1(p: PayloadV1): SharedJam | null {
  if (!p || typeof p !== "object" || !p.s || typeof p.s !== "object" || !Array.isArray(p.m)) return null;
  const members = readMembers(p.m);
  if (!members) return null;
  const s = p.s;
  const settings = readMusic(
    {
      style: s.style,
      standard: s.standard,
      tonic: s.key?.tonic,
      mode: s.key?.mode,
      bars: s.bars,
      tempo: s.tempo,
      beats: s.meter?.beats,
      seed: s.seed,
      leaderId: s.leaderId,
      soloists: s.soloists,
      phraseBars: s.phraseBars,
      swingFeel: s.swingFeel,
      feel: s.feel,
      harmony: s.harmony,
      preset: s.preset,
    },
    members,
  );
  if (!settings) return null;
  return { version: 1, settings, members, sounds: null, playAlong: null, heuristic: null, muted: [], engine: "local", asked: null };
}

function decodeV2(p: PayloadV2): SharedJam | null {
  if (!p || typeof p !== "object" || !Array.isArray(p.b)) return null;
  const members = readMembers(p.b);
  if (!members) return null;
  const key = typeof p.k === "string" ? /^([A-G][b#]?)(m?)$/.exec(p.k) : null;
  if (!key) return null;
  const music = readMusic(
    {
      style: p.st,
      standard: p.std,
      tonic: key[1],
      mode: key[2] ? "minor" : "major",
      bars: p.n,
      tempo: p.bpm,
      beats: p.m ?? 4,
      seed: p.sd,
      leaderId: p.l,
      soloists: p.so,
      phraseBars: p.ph,
      swingFeel: p.sw,
      feel: p.f,
      harmony: p.h,
      preset: p.p,
    },
    members,
  );
  if (!music) return null;
  const model = (v: unknown, fallback: string) => (typeof v === "string" && modelInfo(v) ? v : fallback);
  const settings: TroopSettings = {
    ...music,
    mode: p.mo === "c" ? "composer" : "improviser",
    bestOf: int(p.bo, 1, 8) ?? music.bestOf,
    directorModel: model(p.dm, music.directorModel),
    playerModel: model(p.pm, music.playerModel),
  };
  const ids = new Set(members.map((m) => m.id));
  let playAlong = DEFAULT_PLAY_ALONG;
  if (Array.isArray(p.pa)) {
    const [inst, q, every] = p.pa;
    playAlong = {
      instrument: typeof inst === "string" && Object.hasOwn(INSTRUMENTS, inst) ? (inst as InstrumentId) : DEFAULT_PLAY_ALONG.instrument,
      quantize: q === "light" ? "light" : "off",
      callResponse: { on: every === 2 || every === 4, every: every === 4 ? 4 : 2 },
    };
  }
  let asked: Asked | null = null;
  if (Array.isArray(p.a) && str(p.a[0], MAX_ASKED)) {
    const [text, source, m, note] = p.a;
    asked = {
      text: text as string,
      source: source === "model" || source === "fallback" ? source : "keywords",
      ...(typeof m === "string" && modelInfo(m) ? { model: m } : {}),
      note: str(note, MAX_ASKED),
    };
  }
  return {
    version: 2,
    settings,
    members,
    sounds: readSounds(p.snd ?? {}),
    playAlong,
    heuristic: p.hx === 1,
    muted: Array.isArray(p.mu) ? p.mu.filter((id): id is string => typeof id === "string" && ids.has(id)) : [],
    engine: p.ai === 1 ? "ai" : "local",
    asked,
  };
}

/**
 * Read a shared jam. Everything in a link is untrusted, so every field is checked or clamped
 * and anything unknown (a style, animal or instrument this build doesn't have) rejects the link.
 */
export function decodeShare(value: string): SharedJam | null {
  const m = /^(\d+)\.([A-Za-z0-9_-]+)$/.exec(value.trim());
  if (!m || (m[1] !== "1" && m[1] !== "2")) return null;
  let p: unknown;
  try {
    p = JSON.parse(fromBase64Url(m[2]));
  } catch {
    return null;
  }
  return m[1] === "1" ? decodeV1(p as PayloadV1) : decodeV2(p as PayloadV2);
}

/** The path a jam's link opens: `/s/2.eyJ…`. */
export const SHARE_PATH = /^\/s\/([^/?#]+)\/?$/;

/** The payload a page address carries, from its path (`/s/2.…`) or an older link's hash (`#t=1.…`). */
export function shareValueAt(pathname: string, hash: string): string | null {
  const m = SHARE_PATH.exec(pathname);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  }
  return new URLSearchParams(hash.replace(/^#/, "")).get(SHARE_PARAM);
}

/** Pull a shared jam out of a location hash like `#t=1.eyJ…`. */
export function sharedFromHash(hash: string): SharedJam | null {
  const v = new URLSearchParams(hash.replace(/^#/, "")).get(SHARE_PARAM);
  return v ? decodeShare(v) : null;
}

/** A link that opens the jam, on the same site as `base` (its query, like `?debug`, is kept). */
export function shareUrl(config: JamConfig, base: string): string {
  const url = new URL(base);
  url.pathname = `/s/${encodeJam(config)}`;
  url.hash = "";
  return url.toString();
}
