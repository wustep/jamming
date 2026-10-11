import type { PadVoice, PianoPack, Room } from "@/audio/packs";
import type { BookId } from "./harmony-books";
import type { FeelId } from "./playing";
import type { AnimalId, InstrumentId, KeySig, StyleId } from "./types";

// Play like someone: one pick sets the style, the hands it's played with, the book its changes
// come from, the band and what they hold, the tempo and the room, all together. A preset doesn't
// lock anything: change the band or the tempo afterwards and it stays your chart. Chosen to suit
// a band of animals: jazz leaders, two pianists' worlds, two minimalists' and a songwriter's.

export type PresetId = "basie" | "jobim" | "ray" | "laufey" | "bach" | "chopin" | "debussy" | "glass" | "zimmer" | "fox";

export interface Preset {
  id: PresetId;
  name: string;
  /** What you'll hear, in a line. */
  blurb: string;
  style: StyleId;
  feel: FeelId;
  harmony: BookId;
  tempo: number;
  key: KeySig;
  /** The band, leader first; the soloists are named by animal. */
  band: { animal: AnimalId; instrument: InstrumentId }[];
  soloists: AnimalId[];
  sounds: { room: Room; piano?: PianoPack; pad?: PadVoice };
}

export const PRESETS: Preset[] = [
  {
    id: "basie",
    name: "Count Basie",
    blurb: "Swing in the pocket: a light piano, a walking bass, horns that punch",
    style: "swing",
    feel: "basie",
    harmony: "swing",
    tempo: 152,
    key: { tonic: "Bb", mode: "major" },
    band: [
      { animal: "fox", instrument: "trumpet" },
      { animal: "bear", instrument: "piano" },
      { animal: "frog", instrument: "bass" },
      { animal: "owl", instrument: "drums" },
      { animal: "elephant", instrument: "trombone" },
      { animal: "cat", instrument: "sax" },
    ],
    soloists: ["cat", "bear"],
    sounds: { room: "club", piano: "salamander" },
  },
  {
    id: "jobim",
    name: "Jobim",
    blurb: "Bossa nova: a soft guitar and flute over brushes",
    style: "bossa",
    feel: "bossa",
    harmony: "bossa",
    tempo: 128,
    key: { tonic: "F", mode: "major" },
    band: [
      { animal: "bunny", instrument: "flute" },
      { animal: "cat", instrument: "guitar" },
      { animal: "bear", instrument: "piano" },
      { animal: "frog", instrument: "bass" },
      { animal: "owl", instrument: "drums" },
    ],
    soloists: ["bunny", "bear"],
    sounds: { room: "club", piano: "salamander" },
  },
  {
    id: "ray",
    name: "Ray Charles",
    blurb: "Gospel on a Saturday night: the organ, a choir behind it, horns answering",
    style: "neworleans",
    feel: "neworleans",
    harmony: "gospel",
    tempo: 116,
    key: { tonic: "Eb", mode: "major" },
    band: [
      { animal: "raccoon", instrument: "organ" },
      { animal: "deer", instrument: "pad" },
      { animal: "frog", instrument: "bass" },
      { animal: "owl", instrument: "drums" },
      { animal: "fox", instrument: "trumpet" },
      { animal: "cat", instrument: "sax" },
    ],
    soloists: ["raccoon", "cat"],
    sounds: { room: "club", pad: "choir" },
  },
  {
    id: "laufey",
    name: "Laufey",
    blurb: "Jazz-pop with a bossa lilt, cello and a voice that leans ahead",
    style: "bossa",
    feel: "laufey",
    harmony: "jazzpop",
    tempo: 100,
    key: { tonic: "D", mode: "major" },
    band: [
      { animal: "sheep", instrument: "cello" },
      { animal: "bear", instrument: "piano" },
      { animal: "frog", instrument: "bass" },
      { animal: "owl", instrument: "drums" },
      { animal: "bunny", instrument: "violin" },
    ],
    soloists: ["sheep", "bear"],
    sounds: { room: "club", piano: "salamander", pad: "strings" },
  },
  {
    id: "bach",
    name: "Bach",
    blurb: "A harpsichord prelude, strings in counterpoint, everything even",
    style: "baroque",
    feel: "bach",
    harmony: "baroque",
    tempo: 92,
    key: { tonic: "D", mode: "minor" },
    band: [
      { animal: "bunny", instrument: "violin" },
      { animal: "bear", instrument: "piano" },
      { animal: "sheep", instrument: "cello" },
      { animal: "fox", instrument: "flute" },
    ],
    soloists: ["bunny"],
    sounds: { room: "hall", piano: "harpsichord" },
  },
  {
    id: "chopin",
    name: "Chopin",
    blurb: "A nocturne: the piano sings over a cello, and the time breathes",
    style: "ambient",
    feel: "chopin",
    harmony: "romantic",
    tempo: 66,
    key: { tonic: "Db", mode: "major" },
    band: [
      { animal: "bear", instrument: "piano" },
      { animal: "sheep", instrument: "cello" },
      { animal: "deer", instrument: "pad" },
    ],
    soloists: ["bear"],
    sounds: { room: "hall", piano: "salamander", pad: "strings" },
  },
  {
    id: "debussy",
    name: "Debussy",
    blurb: "Planing chords and a flute line drifting over a string haze",
    style: "ambient",
    feel: "debussy",
    harmony: "impressionist",
    tempo: 60,
    key: { tonic: "Gb", mode: "major" },
    band: [
      { animal: "bunny", instrument: "flute" },
      { animal: "bear", instrument: "piano" },
      { animal: "deer", instrument: "pad" },
      { animal: "penguin", instrument: "vibes" },
    ],
    soloists: ["bunny"],
    sounds: { room: "hall", piano: "salamander", pad: "strings" },
  },
  {
    id: "glass",
    name: "Philip Glass",
    blurb: "Arpeggios that never change speed, organ and piano locked together",
    style: "minimal",
    feel: "glass",
    harmony: "minimal",
    tempo: 132,
    key: { tonic: "A", mode: "minor" },
    band: [
      { animal: "bear", instrument: "piano" },
      { animal: "raccoon", instrument: "organ" },
      { animal: "penguin", instrument: "vibes" },
      { animal: "bunny", instrument: "violin" },
    ],
    soloists: ["bunny"],
    sounds: { room: "dry", piano: "salamander" },
  },
  {
    id: "zimmer",
    name: "Hans Zimmer",
    blurb: "A film cue: a held ostinato, low strings and a slow build",
    style: "minimal",
    feel: "zimmer",
    harmony: "film",
    tempo: 90,
    key: { tonic: "D", mode: "minor" },
    band: [
      { animal: "sheep", instrument: "cello" },
      { animal: "deer", instrument: "pad" },
      { animal: "bear", instrument: "piano" },
      { animal: "owl", instrument: "drums" },
      { animal: "elephant", instrument: "trombone" },
    ],
    soloists: ["sheep"],
    sounds: { room: "hall", piano: "salamander", pad: "strings" },
  },
  {
    id: "fox",
    name: "Elijah Fox",
    blurb: "Running piano in groups of five and seven over a quiet string pad",
    style: "minimal",
    feel: "fox",
    harmony: "impressionist",
    tempo: 84,
    key: { tonic: "E", mode: "major" },
    band: [
      { animal: "bear", instrument: "piano" },
      { animal: "deer", instrument: "pad" },
      { animal: "sheep", instrument: "cello" },
    ],
    soloists: ["bear"],
    sounds: { room: "dry", piano: "salamander", pad: "strings" },
  },
];

export function getPreset(id: string | null | undefined): Preset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}
