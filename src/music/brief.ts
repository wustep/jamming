// A jam from one sentence: "rainy-night Monk ballad, slow, brushes". A brief is what someone
// asked for, field by field (null = they didn't say). It comes from one cheap model call
// (src/ai/arranger.ts) or, with no key, from the keyword reading here. Either way it's then
// resolved against the presets, the tunes and the styles into settings the engine plays as it
// always does: no model writes a note.

import { ROOMS, type Room, type Sounds } from "@/audio/packs";
import { defaultStandardLength, FREE_LENGTHS, snapLength } from "./form";
import { ANIMAL_LIST, ANIMALS, INSTRUMENT_LIST, INSTRUMENTS } from "./instruments";
import { FEELS, type FeelId } from "./playing";
import { getPreset, PRESETS, type PresetId } from "./presets";
import { getStandard, STANDARDS } from "./standards";
import { STYLES, STYLE_LIST } from "./styles";
import type { AnimalId, InstrumentId, KeySig, Member, StyleId, TroopSettings } from "./types";

export type Pace = "very slow" | "slow" | "medium" | "fast" | "very fast";

export interface Brief {
  preset: PresetId | null;
  style: StyleId | null;
  /** A tune from standards.ts; null is an original chart (the band writes the changes). */
  standard: string | null;
  tonic: string | null;
  mode: KeySig["mode"] | null;
  tempo: number | null;
  /** A tempo in words, placed in the style's range ("slow" in swing is not "slow" in funk). */
  pace: Pace | null;
  meter: 3 | 4 | null;
  /** The whole band, leader first (replaces whoever's on stage). */
  band: InstrumentId[] | null;
  /** Instruments to bring in on top of the band (the keyword reading: "…with vibes"). */
  add: InstrumentId[];
  /** Instruments to send home ("no drums"). */
  drop: InstrumentId[];
  room: Room | null;
  feel: FeelId | null;
  bars: number | null;
  /** Times through the tune ("twice"), for a standard. */
  choruses: number | null;
  /** The model's one line on what it went for. */
  note: string | null;
}

export const emptyBrief = (): Brief => ({
  preset: null,
  style: null,
  standard: null,
  tonic: null,
  mode: null,
  tempo: null,
  pace: null,
  meter: null,
  band: null,
  add: [],
  drop: [],
  room: null,
  feel: null,
  bars: null,
  choruses: null,
  note: null,
});

export const TONICS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
export const MAX_BAND = 6;
export const TEMPO_LIMITS = [40, 300] as const;

/** "a#", "Gb", "e flat", "C♯" → the spelling the key picker uses ("Bb", "F#", "Eb", "Db"); null if it isn't a note. */
export function normalizeTonic(raw: string): string | null {
  const m = /^\s*([a-g])\s*(#|♯|sharp|b|♭|flat)?\s*$/i.exec(raw);
  if (!m) return null;
  const acc = m[2]?.toLowerCase();
  const shift = !acc ? 0 : acc === "#" || acc === "♯" || acc === "sharp" ? 1 : -1;
  return TONICS[(PC[m[1].toLowerCase()] + shift + 12) % 12];
}

// ---------------------------------------------------------------------------------------------
// The keyword reading

/** Words that name each artist. Bare words that mean other things ("glass", "fox", "son", "ray") need the full name. */
const ARTIST_WORDS: Record<PresetId, string[]> = {
  basie: ["count basie", "basie", "kansas city"],
  jobim: ["jobim", "antonio carlos jobim", "tom jobim"],
  ray: ["ray charles", "gospel"],
  laufey: ["laufey"],
  bach: ["bach", "fugue", "well tempered"],
  chopin: ["chopin", "nocturne"],
  debussy: ["debussy", "clair de lune", "impressionist"],
  glass: ["philip glass", "glassworks"],
  zimmer: ["hans zimmer", "zimmer", "interstellar", "inception", "film score", "cinematic", "epic"],
  fox: ["elijah fox"],
  evans: ["bill evans", "evans", "waltz for debby"],
  monk: ["thelonious monk", "thelonious", "monk", "monkish"],
  miles: ["miles davis", "miles", "kind of blue"],
  herbie: ["herbie hancock", "herbie", "hancock", "head hunters", "chameleon", "fusion", "rhodes"],
  guaraldi: ["vince guaraldi", "guaraldi", "charlie brown", "peanuts", "linus and lucy"],
  stevie: ["stevie wonder", "stevie", "motown", "superstition", "clavinet", "clav"],
  sakamoto: ["ryuichi sakamoto", "sakamoto", "mr lawrence"],
  hisaishi: ["joe hisaishi", "hisaishi", "ghibli", "studio ghibli", "totoro", "spirited away", "anime"],
  frahm: ["nils frahm", "frahm", "felt piano"],
  einaudi: ["ludovico einaudi", "einaudi", "nuvole bianche", "una mattina"],
  satie: ["erik satie", "satie", "gymnopedie", "gymnopédie", "gnossienne"],
  fela: ["fela kuti", "fela", "afrobeat", "afro beat", "tony allen", "lagos"],
  son: ["buena vista", "son cubano", "cuban", "cuba", "havana", "salsa", "montuno", "clave", "chan chan"],
};

const STYLE_WORDS: Record<StyleId, string[]> = {
  swing: ["swing", "swinging", "swingin", "bebop", "bop", "hard bop", "big band", "jazz club", "walking bass"],
  bossa: ["bossa", "bossa nova", "samba", "brazil", "brazilian", "latin", "rio"],
  funk: ["funk", "funky", "groove", "groovy", "disco", "dance", "hip hop", "boom bap"],
  pop: ["pop", "rock", "lofi", "lo fi", "singer songwriter", "indie", "soft rock"],
  neworleans: ["new orleans", "dixieland", "dixie", "second line", "trad jazz", "mardi gras", "nola", "marching band", "street parade"],
  minimal: ["minimal", "minimalist", "minimalism", "phasing", "steve reich", "reich", "ostinato", "arpeggios"],
  baroque: ["baroque", "counterpoint", "harpsichord", "vivaldi", "handel"],
  ambient: ["ambient", "dreamy", "drone", "meditative", "meditation", "ethereal", "sleep", "sleepy", "calm", "spa", "floating", "romantic"],
};

/** A loose word that only counts when nothing more specific names a style. */
const WEAK_STYLE: [string, StyleId][] = [
  ["jazz", "swing"],
  ["jazzy", "swing"],
  ["blues", "swing"],
  ["classical", "baroque"],
  ["chill", "ambient"],
];

const INSTRUMENT_WORDS: Record<InstrumentId, string[]> = {
  piano: ["piano", "pianist", "keys", "keyboard", "grand piano", "upright piano"],
  bass: ["bass", "bassist", "double bass", "upright bass", "walking bass", "bass line"],
  drums: ["drums", "drum", "drummer", "brushes", "kit", "percussion", "sticks"],
  trumpet: ["trumpet", "trumpets", "muted trumpet", "flugelhorn", "cornet"],
  sax: ["sax", "saxophone", "tenor", "tenor sax", "alto", "alto sax", "saxes"],
  trombone: ["trombone", "trombones", "bone"],
  clarinet: ["clarinet", "clarinets"],
  flute: ["flute", "flutes"],
  violin: ["violin", "violins", "fiddle"],
  cello: ["cello", "cellos"],
  guitar: ["guitar", "guitars", "guitarist", "nylon guitar"],
  vibes: ["vibes", "vibraphone", "vibraphones", "bells", "mallets"],
  organ: ["organ", "hammond", "b3"],
  pad: ["string pad", "synth pad", "pad", "choir", "strings", "string section", "synth"],
};

/** Families: "horns" is three of them. */
const GROUP_WORDS: [string, InstrumentId[]][] = [
  ["horn section", ["trumpet", "sax", "trombone"]],
  ["horns", ["trumpet", "sax", "trombone"]],
  ["brass", ["trumpet", "trombone"]],
  ["woodwinds", ["flute", "clarinet"]],
  ["string quartet", ["violin", "violin", "cello", "cello"]],
  ["rhythm section", ["piano", "bass", "drums"]],
];

const ROOM_WORDS: Record<Room, string[]> = {
  hall: ["hall", "concert hall", "church", "cathedral", "chapel", "big room", "reverb", "reverby", "echoey", "cavern", "stadium", "arena", "wet"],
  club: ["club", "jazz club", "bar", "lounge", "smoky", "speakeasy", "basement", "dive", "cafe", "café", "nightclub"],
  dry: ["dry", "close up", "close mic", "intimate", "bedroom", "studio", "living room", "kitchen", "booth"],
};

const PACE_WORDS: [string, Pace][] = [
  ["very slow", "very slow"],
  ["super slow", "very slow"],
  ["glacial", "very slow"],
  ["very fast", "very fast"],
  ["super fast", "very fast"],
  ["breakneck", "very fast"],
  ["blazing", "very fast"],
  ["burning", "very fast"],
  ["slow", "slow"],
  ["slowly", "slow"],
  ["ballad", "slow"],
  ["lazy", "slow"],
  ["laid back", "slow"],
  ["unhurried", "slow"],
  ["gentle", "slow"],
  ["relaxed", "slow"],
  ["mellow", "slow"],
  ["lullaby", "slow"],
  ["medium", "medium"],
  ["mid tempo", "medium"],
  ["midtempo", "medium"],
  ["moderate", "medium"],
  ["fast", "fast"],
  ["up tempo", "fast"],
  ["uptempo", "fast"],
  ["quick", "fast"],
  ["driving", "fast"],
  ["energetic", "fast"],
  ["frantic", "fast"],
  ["bouncy", "fast"],
  ["lively", "fast"],
  ["party", "fast"],
];

/** Mood words set the mode when no key is named, and a pace when no tempo is. */
const MOOD: [string, KeySig["mode"], Pace | null][] = [
  ["sad", "minor", "slow"],
  ["melancholy", "minor", "slow"],
  ["melancholic", "minor", "slow"],
  ["lonely", "minor", "slow"],
  ["rainy", "minor", "slow"],
  ["rain", "minor", "slow"],
  ["gloomy", "minor", "slow"],
  ["mournful", "minor", "slow"],
  ["heartbroken", "minor", "slow"],
  ["dark", "minor", null],
  ["moody", "minor", null],
  ["noir", "minor", null],
  ["mysterious", "minor", null],
  ["haunting", "minor", null],
  ["spooky", "minor", null],
  ["tense", "minor", null],
  ["stormy", "minor", "fast"],
  ["happy", "major", null],
  ["sunny", "major", null],
  ["sunshine", "major", null],
  ["cheerful", "major", null],
  ["joyful", "major", null],
  ["joyous", "major", null],
  ["hopeful", "major", null],
  ["triumphant", "major", null],
  ["celebration", "major", "fast"],
  ["celebratory", "major", "fast"],
];

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/** Tune names as they'd be typed: no "The", no bracketed notes, plus a few nicknames. */
const TUNE_ALIASES: [string, string][] = [
  ["ipanema", "girl-from-ipanema"],
  ["a train", "a-train"],
  ["so what", "so-what"],
  ["saints", "saints"],
  ["canon", "canon"],
  ["pachelbel", "canon"],
  ["twinkle twinkle", "twinkle"],
  ["twinkle", "twinkle"],
  ["minor blues", "minor-blues"],
  ["jazz blues", "f-blues"],
  ["12 bar blues", "f-blues"],
  ["twelve bar blues", "f-blues"],
  ["rhythm changes", "rhythm-changes"],
  ["i got rhythm", "rhythm-changes"],
  ["jazz waltz", "jazz-waltz"],
  ["four chord", "four-chords"],
  ["doo wop", "doo-wop"],
  ["dorian vamp", "dorian-vamp"],
  ["frere jacques", "frere-jacques"],
  ["fly me to the moon", "fly-me"],
];

/** Lowercase, accents off, hyphens and punctuation to spaces, padded so `has(" x ")` matches whole words. */
export function fold(text: string): string {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’`]/g, "'")
    .replace(/'s\b/g, "s")
    .replace(/[^a-z0-9#/' ]+/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return ` ${t} `;
}

const tuneName = (name: string) =>
  fold(name.replace(/\(.*?\)/g, "").replace(/^the\s+/i, ""))
    .trim();

/** Every way to name a tune, longest first so "Blue Bossa" beats "bossa" and "Minor Blues" beats "blues". */
const TUNE_PHRASES: [string, string][] = [...STANDARDS.map((s) => [tuneName(s.name), s.id] as [string, string]), ...TUNE_ALIASES.map(([p, id]) => [fold(p).trim(), id] as [string, string])].sort(
  (a, b) => b[0].length - a[0].length,
);

/** Where a phrase sits in the folded text (whole words), or -1. */
function at(t: string, phrase: string): number {
  return t.indexOf(` ${phrase} `);
}

/** Blank out what's been read so a tune's or an artist's words don't count twice ("Blue Monk" isn't also a mood). */
function consume(t: string, phrase: string): string {
  const i = at(t, phrase);
  return i < 0 ? t : t.slice(0, i) + " " + "_".repeat(phrase.length) + " " + t.slice(i + phrase.length + 2);
}

function readKey(raw: string): { tonic: string | null; mode: KeySig["mode"] | null } {
  const text = raw.replace(/[-–—]/g, " ");
  // "in Bb", "in F# minor", "key of e flat", "in Cm". A bare lowercase "in a" is an article
  // ("in a dark mood", "in a minor key"), unless a sharp or flat comes with it.
  const inKey = /\b(?:in|key of)\s+([A-Ga-g])(?:\s*(#|♯|♭|sharp|flat)|(b)(?![a-z]))?(?:\s*(major|minor|maj|min|m)(?![a-z]))?(?![a-zA-Z#♯♭])/g;
  for (const m of text.matchAll(inKey)) {
    const [, letter, acc1, acc2, q] = m;
    const acc = acc1 ?? acc2;
    const after = text.slice((m.index ?? 0) + m[0].length);
    if (letter === "a" && !acc && (!q || /^\s+(key|mood|vibe|feel|way|style|groove|tempo)/i.test(after))) continue;
    const tonic = normalizeTonic(letter + (acc ?? ""));
    const mode = !q ? null : /^(minor|min|m)$/i.test(q) ? "minor" : "major";
    if (tonic) return { tonic, mode };
  }
  // "G minor", "Eb major", "Bb blues" written as a capital letter (not the sentence's opening "A").
  const named = /(^|[^A-Za-z])([A-G])(#|♯|b|♭)?\s*(major|minor|blues)\b/g;
  for (const m of text.matchAll(named)) {
    const [, , letter, acc, q] = m;
    if (letter === "A" && !acc && text.slice(0, m.index! + m[1].length).trim() === "") continue;
    const tonic = normalizeTonic(letter + (acc ?? ""));
    if (tonic) return { tonic, mode: q === "minor" ? "minor" : q === "major" ? "major" : null };
  }
  return { tonic: null, mode: null };
}

/**
 * Read a brief from plain words: artists, styles, tunes, tempo words and numbers, instruments,
 * rooms, meter, mood. It's the band with no key's way in, and the fallback when a model reply
 * won't parse, so it never throws and never invents what isn't there.
 */
export function parseBrief(text: string): Brief {
  const b = emptyBrief();
  let t = fold(text.slice(0, 400));
  if (!t.trim()) return b;

  // a tune first: its words ("Blue Monk", "So What") would otherwise read as an artist or a mood
  for (const [phrase, id] of TUNE_PHRASES) {
    if (at(t, phrase) >= 0) {
      b.standard = id;
      t = consume(t, phrase);
      break;
    }
  }
  // "a blues" with no tune named: the session blues
  if (!b.standard && at(t, "blues") >= 0 && at(t, "rhythm and blues") < 0) {
    b.standard = "f-blues";
    t = consume(t, "blues");
  }

  // an artist: the earliest named wins ("Monk, not Evans")
  let bestAt = Infinity;
  for (const p of PRESETS) {
    for (const w of ARTIST_WORDS[p.id]) {
      const i = at(t, fold(w).trim());
      if (i >= 0 && i < bestAt) {
        bestAt = i;
        b.preset = p.id;
      }
    }
  }
  if (b.preset) for (const w of ARTIST_WORDS[b.preset]) t = consume(t, fold(w).trim());

  // a style named outright, else a loose word for one
  let styleAt = Infinity;
  for (const id of STYLE_LIST) {
    for (const w of STYLE_WORDS[id]) {
      const i = at(t, w);
      if (i >= 0 && i < styleAt) {
        styleAt = i;
        b.style = id;
      }
    }
  }
  if (!b.style && !b.preset && !b.standard) b.style = WEAK_STYLE.find(([w]) => at(t, w) >= 0)?.[1] ?? null;
  // an artist's own style needn't be repeated ("Basie swing" is just Basie)
  if (b.preset && b.style === getPreset(b.preset)!.style) b.style = null;

  // key and mode
  const key = readKey(text);
  b.tonic = key.tonic;
  b.mode = key.mode;
  if (!b.mode) {
    if (at(t, "minor") >= 0) b.mode = "minor";
    else if (at(t, "major") >= 0) b.mode = "major";
  }

  // tempo: a number, then words
  const bpm = /\b(\d{2,3})\s*(?:bpm|beats per minute|beats a minute)\b/.exec(t) ?? /(?:^|[^/\d])(\d{2,3})(?![\d/])(?!\s*(?:bars?|measures?|choruses|times|s\b|th\b|minutes?|seconds?))/.exec(t);
  if (bpm) {
    const n = +bpm[1];
    if (n >= TEMPO_LIMITS[0] && n <= TEMPO_LIMITS[1]) b.tempo = n;
  }
  // the first match in list order: "very slow" before "slow"
  b.pace = PACE_WORDS.find(([w]) => at(t, w) >= 0)?.[1] ?? null;

  // mood: a mode when no key says otherwise, a pace when nothing else does
  for (const [w, mode, pace] of MOOD) {
    if (at(t, w) < 0) continue;
    if (!b.mode && !b.standard) b.mode = mode;
    if (!b.pace && b.tempo === null && pace) b.pace = pace;
  }

  // meter
  if (/\b(3\/4|waltz|in three|three four|6\/8)\b/.test(t)) b.meter = 3;
  else if (/\b(4\/4|in four|four four|common time)\b/.test(t)) b.meter = 4;

  // length: "32 bars", "twice through", "three choruses", "short", "long"
  const bars = /\b(\d{1,3})\s*(?:bars?|measures?)\b(?!\s*blues)/.exec(t);
  if (bars) {
    b.bars = Math.max(1, +bars[1]);
    t = t.replace(bars[0], " ");
  }
  const ch = /\b(\d|one|two|three|four|five|six)\s+(?:choruses|chorus|times through|times)\b/.exec(t);
  if (ch) b.choruses = NUMBER_WORDS[ch[1]] ?? +ch[1];
  else if (at(t, "twice") >= 0) b.choruses = 2;
  else if (at(t, "once through") >= 0 || at(t, "just the head") >= 0) b.choruses = 1;
  if (b.bars === null && b.choruses === null) {
    if (/\b(short|quick one|brief|little)\b/.test(t)) b.bars = 16;
    else if (/\b(long|epic|extended|stretch out)\b/.test(t)) b.bars = 64;
  }

  // room
  let roomAt = Infinity;
  for (const r of ROOMS) {
    for (const w of ROOM_WORDS[r]) {
      const i = at(t, w);
      if (i >= 0 && i < roomAt) {
        roomAt = i;
        b.room = r;
      }
    }
  }

  // feel: brushes on a swing with no artist named is Bill Evans' trio
  if (!b.preset && at(t, "brushes") >= 0 && (b.style ?? getStandard(b.standard)?.style ?? "swing") === "swing") b.feel = "evans";

  readBand(t, b);
  return b;
}

/** Which instruments the words name, in the order they're named. */
function namedInstruments(t: string): { list: InstrumentId[]; drop: InstrumentId[] } {
  const hits: { i: number; inst: InstrumentId[] }[] = [];
  const drop: InstrumentId[] = [];
  let rest = t;
  // "no drums", "without bass", "drop the piano"
  for (const inst of INSTRUMENT_LIST) {
    for (const w of [...INSTRUMENT_WORDS[inst]].sort((a, b) => b.length - a.length)) {
      const neg = new RegExp(`\\b(?:no|without|minus|drop the|lose the|skip the|but no)\\s+(?:the\\s+)?${w}\\b`);
      if (neg.test(rest)) {
        drop.push(inst);
        rest = rest.replace(neg, " ");
      }
    }
  }
  for (const [w, insts] of GROUP_WORDS) {
    const i = at(rest, w);
    if (i >= 0) {
      hits.push({ i, inst: insts });
      rest = consume(rest, w);
    }
  }
  for (const inst of INSTRUMENT_LIST) {
    let first = -1;
    for (const w of [...INSTRUMENT_WORDS[inst]].sort((a, b) => b.length - a.length)) {
      const i = at(rest, w);
      if (i >= 0) {
        if (first < 0 || i < first) first = i;
        rest = consume(rest, w);
      }
    }
    if (first >= 0) hits.push({ i: first, inst: [inst] });
  }
  hits.sort((a, b) => a.i - b.i);
  return { list: hits.flatMap((h) => h.inst).filter((x) => !drop.includes(x)), drop };
}

const SIZE_WORDS: [RegExp, number][] = [
  // "solo piano" is one player; "a sax solo" is a solo in a band
  [/\bsolo\s+(?:[a-z]+\s+)?(?:piano|guitar|cello|violin|flute|organ|vibes|vibraphone|sax|saxophone|trumpet|clarinet|trombone|harpsichord)\b|\b(?:unaccompanied|alone|by itself)\b/, 1],
  [/\b(duo|duet|two piece)\b/, 2],
  [/\btrio\b/, 3],
  [/\bquartet\b/, 4],
  [/\bquintet\b/, 5],
  [/\b(sextet|big band|full band|orchestra)\b/, 6],
];

function readBand(t: string, b: Brief) {
  const { list, drop } = namedInstruments(t);
  b.drop = drop;
  const size = SIZE_WORDS.find(([re]) => re.test(t))?.[1] ?? null;
  // "brushes" means drums are there, not that they lead
  const leadable = list.filter((i) => i !== "drums");
  if (size !== null) {
    const core = list.length ? list : ["piano" as InstrumentId];
    b.band = fillBand(dedupeKeepOrder(core), size, b.style ?? getPreset(b.preset)?.style ?? null, drop);
    return;
  }
  if (b.preset) {
    // the artist brings a band; named instruments join it
    b.add = dedupeKeepOrder(list);
    return;
  }
  if (leadable.length) {
    b.band = fillBand(dedupeKeepOrder([...leadable, ...list.filter((i) => i === "drums")]), null, b.style, drop);
  } else if (list.length) {
    b.add = list;
  }
}

function dedupeKeepOrder(list: InstrumentId[]): InstrumentId[] {
  // a string quartet's two violins stay two; anything else named twice is once
  const out: InstrumentId[] = [];
  for (const i of list) if (!out.includes(i) || i === "violin" || i === "cello") out.push(i);
  return out;
}

const QUIET_STYLES: StyleId[] = ["ambient", "baroque", "minimal"];

/**
 * Round out a band from the instruments named: melodic voices lead, then a chord instrument, a
 * bass and drums as the style wants, up to `size` when one was asked for ("sax trio").
 */
function fillBand(named: InstrumentId[], size: number | null, style: StyleId | null, drop: InstrumentId[]): InstrumentId[] {
  const melodic = named.filter((i) => INSTRUMENTS[i].fn === "melodic");
  const others = named.filter((i) => INSTRUMENTS[i].fn !== "melodic");
  const band = [...melodic, ...others].slice(0, size ?? MAX_BAND);
  const cap = size ?? Math.min(MAX_BAND, Math.max(named.length + 3, 4));
  const want: InstrumentId[] = [];
  const chord = !band.some((i) => INSTRUMENTS[i].fn === "chordal");
  const bass = !band.some((i) => i === "bass" || i === "cello");
  const drums = !band.includes("drums") && !(style && QUIET_STYLES.includes(style));
  // a horn trio is horn, bass and drums (Sonny Rollins); otherwise the chords come first
  const hornCombo = size !== null && melodic.length > 0;
  if (chord && !hornCombo) want.push("piano");
  if (bass) want.push(style === "baroque" ? "cello" : "bass");
  if (drums) want.push("drums");
  if (chord && hornCombo) want.push("piano");
  for (const w of want) {
    if (band.length >= cap) break;
    if (!drop.includes(w)) band.push(w);
  }
  return band.length ? band : ["piano"];
}

// ---------------------------------------------------------------------------------------------
// Validating a model's brief

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const FEEL_IDS = Object.keys(FEELS) as FeelId[];

function matchId<T extends string>(v: unknown, ids: readonly T[], names: (id: T) => string[]): T | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = fold(v).trim();
  return ids.find((id) => id === v || fold(id).trim() === s || names(id).some((n) => fold(n).trim() === s)) ?? null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\s*\d+(\.\d+)?\s*$/.test(v) ? +v : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * Check a model's reply against the brief schema and mend what can be mended: a name where an
 * id belongs, a tempo out of range, "A#", a band of seven, an instrument we don't have. Anything
 * past mending is dropped (null), and each fix is listed for the debug panel. Null when the reply
 * isn't a brief at all, which sends the caller back to the keyword reading.
 */
export function repairBrief(raw: unknown): { brief: Brief; repairs: string[] } | null {
  if (!isObj(raw)) return null;
  const known = ["preset", "style", "standard", "key", "tonic", "mode", "tempo", "meter", "band", "room", "feel", "bars", "note"];
  if (!known.some((k) => k in raw)) return null;
  const b = emptyBrief();
  const repairs: string[] = [];
  const fix = (field: string, v: unknown, why: string) => {
    if (v !== null && v !== undefined && v !== "") repairs.push(`${field}: ${why} (${JSON.stringify(v).slice(0, 60)})`);
  };

  b.preset = matchId(raw.preset, PRESETS.map((p) => p.id), (id) => [getPreset(id)!.name]);
  if (b.preset && b.preset !== raw.preset) repairs.push(`preset: read "${raw.preset}" as ${b.preset}`);
  if (!b.preset) fix("preset", raw.preset, "not an artist we know, dropped");

  b.style = matchId(raw.style, STYLE_LIST, (id) => [STYLES[id].name]);
  if (b.style && b.style !== raw.style) repairs.push(`style: read "${raw.style}" as ${b.style}`);
  if (!b.style) fix("style", raw.style, "not a style, dropped");

  if (typeof raw.standard === "string" && raw.standard.trim() && !/^(none|null|free|original)$/i.test(raw.standard.trim())) {
    const id = matchId(raw.standard, STANDARDS.map((s) => s.id), (sid) => [getStandard(sid)!.name, tuneName(getStandard(sid)!.name)]);
    if (id) {
      b.standard = id;
      if (id !== raw.standard) repairs.push(`standard: read "${raw.standard}" as ${id}`);
    } else fix("standard", raw.standard, "not a tune we have, playing an original");
  }

  const key = isObj(raw.key) ? raw.key : { tonic: raw.tonic, mode: raw.mode };
  if (typeof key.tonic === "string") {
    b.tonic = normalizeTonic(key.tonic);
    if (!b.tonic) fix("key", key.tonic, "not a note, dropped");
    else if (b.tonic !== key.tonic) repairs.push(`key: spelled ${key.tonic} as ${b.tonic}`);
  }
  if (key.mode === "major" || key.mode === "minor") b.mode = key.mode;
  else fix("mode", key.mode, "not major or minor, dropped");

  const tempo = num(raw.tempo);
  if (tempo !== null) {
    const t = Math.round(Math.min(TEMPO_LIMITS[1], Math.max(TEMPO_LIMITS[0], tempo)));
    if (t !== tempo) repairs.push(`tempo: ${tempo} clamped to ${t}`);
    b.tempo = t;
  } else fix("tempo", raw.tempo, "not a number, dropped");

  const meter = num(raw.meter);
  if (meter === 3 || meter === 4) b.meter = meter;
  else if (meter === 6) {
    b.meter = 3;
    repairs.push("meter: 6/8 played as 3/4");
  } else fix("meter", raw.meter, "only 3/4 and 4/4, dropped");

  if (Array.isArray(raw.band)) {
    const band: InstrumentId[] = [];
    for (const v of raw.band) {
      const id = matchId(v, INSTRUMENT_LIST, (i) => [INSTRUMENTS[i].name, ...INSTRUMENT_WORDS[i]]);
      if (id) band.push(id);
      else fix("band", v, "not an instrument we have, left out");
    }
    if (band.length > MAX_BAND) repairs.push(`band: ${band.length} players cut to ${MAX_BAND}`);
    let fixed = band.slice(0, MAX_BAND);
    // the drummer can't lead: move them back
    if (fixed[0] === "drums" && fixed.some((i) => i !== "drums")) {
      fixed = [...fixed.filter((i) => i !== "drums"), ...fixed.filter((i) => i === "drums")];
      repairs.push("band: the drummer can't lead, moved back");
    }
    b.band = fixed.length ? fixed : null;
    if (!fixed.length && raw.band.length) repairs.push("band: nobody we know, kept the band on stage");
  }

  if (typeof raw.room === "string" && (ROOMS as string[]).includes(raw.room)) b.room = raw.room as Room;
  else fix("room", raw.room, "not dry, club or hall, dropped");

  b.feel = matchId(raw.feel, FEEL_IDS, (id) => [FEELS[id].name]);
  if (!b.feel) fix("feel", raw.feel, "not a feel we have, dropped");

  const bars = num(raw.bars);
  if (bars !== null && bars >= 1) b.bars = Math.round(Math.min(256, bars));
  else fix("bars", raw.bars, "not a length, dropped");

  if (typeof raw.note === "string") b.note = raw.note.trim().slice(0, 140) || null;
  return { brief: b, repairs };
}

// ---------------------------------------------------------------------------------------------
// From a brief to settings

export interface Arrangement {
  settings: TroopSettings;
  members: Member[];
  /** The room, and the artist's piano and pad when one was named. */
  sounds: Partial<Pick<Sounds, "room" | "piano" | "pad">>;
}

/**
 * Hand out animals for a band. First whoever already plays that instrument on stage, or plays it
 * by default (the owl drums, the bear plays piano); then the rest go to animals who aren't wanted
 * for their own instrument, so nobody's usual seat is taken by someone else.
 */
export function castBand(band: InstrumentId[], prefer: Member[] = []): Member[] {
  const seats = band.slice(0, MAX_BAND);
  const cast: (AnimalId | null)[] = seats.map(() => null);
  const used = new Set<AnimalId>();
  seats.forEach((inst, n) => {
    const a = prefer.find((m) => m.instrument === inst && !used.has(m.animal))?.animal ?? ANIMAL_LIST.find((x) => ANIMALS[x].defaultInstrument === inst && !used.has(x));
    if (a) {
      cast[n] = a;
      used.add(a);
    }
  });
  const wanted = new Set(seats);
  seats.forEach((_, n) => {
    if (cast[n]) return;
    const free = ANIMAL_LIST.filter((x) => !used.has(x));
    const a = free.find((x) => prefer.some((m) => m.animal === x) && !wanted.has(ANIMALS[x].defaultInstrument)) ?? free.find((x) => !wanted.has(ANIMALS[x].defaultInstrument)) ?? free[0];
    if (a) {
      cast[n] = a;
      used.add(a);
    }
  });
  return seats.flatMap((inst, n) => (cast[n] ? [{ id: cast[n], animal: cast[n], name: ANIMALS[cast[n]].name, instrument: inst }] : []));
}

/** A tempo in words, in this style's own range. */
export function paceTempo(style: StyleId, pace: Pace, base: number): number {
  const r = STYLES[style].tempo;
  switch (pace) {
    case "very slow":
      return r.min - 20;
    case "slow":
      return Math.round(Math.max(r.min - 20, Math.min(r.min, base * 0.7)));
    case "medium":
      return r.default;
    case "fast":
      return Math.round(Math.min(r.max + 20, Math.max(r.max - 10, base * 1.25)));
    case "very fast":
      return r.max + 20;
  }
}

/** The tempo slider's reach for a style; a brief's tempo is held inside it. */
export const tempoRange = (style: StyleId): [number, number] => [STYLES[style].tempo.min - 20, STYLES[style].tempo.max + 20];

/**
 * Turn a brief into settings, a band and a room, starting from what's on stage now. What the
 * brief names wins; then the artist's choice, the tune's, the style's; whatever nobody named
 * stays as it was (the band, most often). Pure, so the same brief always plays the same jam.
 */
export function resolveBrief(brief: Brief, cur: { settings: TroopSettings; members: Member[]; sounds: Pick<Sounds, "room"> }): Arrangement {
  const preset = getPreset(brief.preset);
  // naming nothing about the music ("faster, in a hall") keeps the tune, the style and the artist
  const restyled = !!(brief.preset || brief.style || brief.feel || brief.standard);
  const newTune = getStandard(brief.standard);
  const std = newTune ?? (restyled ? null : getStandard(cur.settings.standard));
  const style: StyleId = brief.style ?? preset?.style ?? newTune?.style ?? (brief.feel && Object.hasOwn(STYLES, brief.feel) ? (brief.feel as StyleId) : cur.settings.style);
  // an artist in someone else's style lends their feel and changes, not their name
  const keepPreset = !restyled ? getPreset(cur.settings.preset) : preset && preset.style === style ? preset : null;
  const feel: FeelId | undefined = !restyled ? cur.settings.feel : (brief.feel ?? preset?.feel ?? undefined);
  const harmony = !restyled ? cur.settings.harmony : preset && (!std || keepPreset) ? preset.harmony : undefined;

  // the band: named outright, else the artist's, else whoever's on stage; then the additions
  let band: InstrumentId[] = brief.band ?? preset?.band.map((x) => x.instrument) ?? cur.members.map((m) => m.instrument);
  band = band.filter((i) => !brief.drop.includes(i));
  for (const add of brief.add) {
    if (band.includes(add) || brief.drop.includes(add)) continue;
    if (band.length < MAX_BAND) band.push(add);
    else {
      // full: the last player who isn't the leader, the bass or the drums makes room
      const at = band.map((i, n) => ({ i, n })).reverse().find(({ i, n }) => n > 0 && i !== "bass" && i !== "drums" && !brief.add.includes(i));
      if (at) band[at.n] = add;
    }
  }
  if (!band.length) band = ["piano"];
  if (band[0] === "drums" && band.some((i) => i !== "drums")) band = [...band.filter((i) => i !== "drums"), ...band.filter((i) => i === "drums")];
  const sameBand = !brief.band && !preset && !brief.add.length && !brief.drop.length;
  const members = sameBand
    ? cur.members
    : preset && !brief.band
      ? castPreset(preset.band, band)
      : castBand(band, cur.members);

  // key: the tune keeps its mode; a mood word changes the mode, not the home note
  const homeKey = newTune?.key ?? preset?.key ?? (brief.style && brief.style !== cur.settings.style ? STYLES[style].key : cur.settings.key);
  const tonic = brief.tonic ?? homeKey.tonic;
  const mode = std ? std.key.mode : (brief.mode ?? homeKey.mode);

  const meter = std ? std.meter : (brief.meter ?? preset?.meter ?? (brief.style || preset ? 4 : cur.settings.meter.beats));

  const [lo, hi] = tempoRange(style);
  const base = newTune?.tempo ?? preset?.tempo ?? (brief.style || brief.feel ? STYLES[style].tempo.default : cur.settings.tempo);
  let tempo = brief.tempo ?? (brief.pace ? paceTempo(style, brief.pace, base) : base);
  tempo = Math.min(hi, Math.max(lo, Math.round(tempo)));

  const nonDrum = members.filter((m) => m.instrument !== "drums" && m.instrument !== "bass");
  const soloists = preset && !brief.band ? preset.soloists.filter((a) => members.some((m) => m.id === a)) : sameBand ? cur.settings.soloists : nonDrum.slice(0, 2).map((m) => m.id);

  let bars: number;
  if (std) {
    const len = std.bars.length;
    bars = brief.choruses
      ? snapLength(std.id, brief.choruses * len)
      : brief.bars
        ? snapLength(std.id, brief.bars)
        : newTune
          ? defaultStandardLength(std.id, soloists.length)
          : snapLength(std.id, cur.settings.bars);
  } else {
    bars = snapLength(null, brief.bars ?? (cur.settings.standard ? 32 : cur.settings.bars));
    if (!FREE_LENGTHS.includes(bars)) bars = 32;
  }

  const settings: TroopSettings = {
    ...cur.settings,
    style,
    standard: std?.id ?? null,
    key: { tonic, mode },
    meter: { beats: meter },
    tempo,
    bars,
    feel,
    harmony,
    preset: keepPreset?.id,
    swingFeel: restyled ? undefined : cur.settings.swingFeel,
    leaderId: members.find((m) => m.instrument !== "drums")?.id ?? members[0]?.id ?? "",
    soloists,
  };
  const room = brief.room ?? preset?.sounds.room ?? (QUIET_STYLES.includes(style) && brief.style ? "hall" : cur.sounds.room);
  return { settings, members, sounds: { ...(preset ? preset.sounds : {}), room } };
}

/** The artist's own animals, then whatever the brief added, in the band's order. */
function castPreset(presetBand: { animal: AnimalId; instrument: InstrumentId }[], band: InstrumentId[]): Member[] {
  const used = new Set<AnimalId>();
  const out: Member[] = [];
  for (const inst of band) {
    const own = presetBand.find((x) => x.instrument === inst && !used.has(x.animal));
    const a = own?.animal ?? ANIMAL_LIST.find((x) => ANIMALS[x].defaultInstrument === inst && !used.has(x) && !presetBand.some((p) => p.animal === x && band.includes(p.instrument))) ?? ANIMAL_LIST.find((x) => !used.has(x));
    if (!a) break;
    used.add(a);
    out.push({ id: a, animal: a, name: ANIMALS[a].name, instrument: inst });
  }
  return out;
}

/** What the brief named, as words for the debug log ("preset monk · pace slow · add drums"). */
export function describeBrief(b: Brief): string {
  const parts: string[] = [];
  for (const k of ["preset", "style", "standard", "tonic", "mode", "tempo", "pace", "meter", "room", "feel", "bars", "choruses"] as const) {
    if (b[k] !== null) parts.push(`${k} ${b[k]}`);
  }
  if (b.band) parts.push(`band ${b.band.join("+")}`);
  if (b.add.length) parts.push(`add ${b.add.join("+")}`);
  if (b.drop.length) parts.push(`drop ${b.drop.join("+")}`);
  return parts.join(" · ") || "nothing it recognised";
}
