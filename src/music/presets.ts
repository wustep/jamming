import type { PadVoice, PianoPack, Room } from "@/audio/packs";
import type { BookId } from "./harmony-books";
import type { FeelId } from "./playing";
import type { AnimalId, InstrumentId, KeySig, StyleId } from "./types";

// Play like someone: one pick sets the style, the hands it's played with, the book its changes
// come from, the band and what they hold, the tempo and the room, all together. A preset doesn't
// lock anything: change the band or the tempo afterwards and it stays your chart. Chosen to suit
// a band of animals, across jazz, pop and soul, film and modern piano, the concert hall and
// music from elsewhere. The later ones bring their own figures too (playing.ts `sig`): the
// voicings, the comping, the bass line and the groove someone would know them by.

export type PresetId =
  | "basie"
  | "jobim"
  | "ray"
  | "laufey"
  | "bach"
  | "chopin"
  | "debussy"
  | "glass"
  | "zimmer"
  | "eits"
  | "fox"
  | "evans"
  | "monk"
  | "miles"
  | "herbie"
  | "guaraldi"
  | "stevie"
  | "sakamoto"
  | "hisaishi"
  | "frahm"
  | "einaudi"
  | "satie"
  | "fela"
  | "son";

export type PresetGroup = "jazz" | "pop" | "film" | "classical" | "world";

/** The picker's shelves, in order. */
export const PRESET_GROUPS: { id: PresetGroup; label: string }[] = [
  { id: "jazz", label: "Jazz" },
  { id: "pop", label: "Pop and soul" },
  { id: "film", label: "Film and modern" },
  { id: "classical", label: "Classical" },
  { id: "world", label: "World" },
];

export interface Preset {
  id: PresetId;
  name: string;
  /** What you'll hear, in a line. */
  blurb: string;
  group: PresetGroup;
  /** More words to find it by (a tune, a genre, an instrument). */
  tags: string;
  /** Beats in the bar, when it isn't four (a jazz waltz, a Gymnopédie). */
  meter?: 3;
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
    group: "jazz",
    tags: "big band swing kansas city horns shout",
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
    group: "world",
    tags: "bossa nova brazil girl from ipanema samba",
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
    group: "pop",
    tags: "soul gospel rhythm and blues organ choir",
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
    group: "pop",
    tags: "jazz pop bossa cello singer",
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
    group: "classical",
    tags: "baroque harpsichord counterpoint fugue prelude",
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
    group: "classical",
    tags: "romantic nocturne piano rubato",
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
    group: "classical",
    tags: "impressionist clair de lune planing whole tone",
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
    group: "film",
    tags: "minimalism arpeggio ostinato organ",
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
    group: "film",
    tags: "film score soundtrack ostinato strings epic",
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
    id: "eits",
    name: "Explosions in the Sky",
    blurb: "Post-rock: two guitars through a delay, a glockenspiel, and a slow climb to the crest",
    group: "film",
    tags: "post rock crescendo guitars delay friday night lights instrumental",
    style: "postrock",
    feel: "postrock",
    harmony: "postrock",
    tempo: 100,
    key: { tonic: "E", mode: "major" },
    band: [
      { animal: "fox", instrument: "guitar" },
      { animal: "cat", instrument: "guitar" },
      { animal: "penguin", instrument: "vibes" },
      { animal: "frog", instrument: "bass" },
      { animal: "owl", instrument: "drums" },
    ],
    soloists: ["cat"],
    sounds: { room: "hall" },
  },
  {
    id: "fox",
    name: "Elijah Fox",
    blurb: "Running piano in groups of five and seven over a quiet string pad",
    group: "film",
    tags: "modern piano quintuplets ambient",
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
  {
    id: "evans",
    name: "Bill Evans",
    blurb: "A jazz waltz trio: spread rootless chords, brushes, the bass talking back",
    group: "jazz",
    tags: "trio waltz for debby rootless voicings brushes piano",
    meter: 3,
    style: "swing",
    feel: "evans",
    harmony: "evans",
    tempo: 150,
    key: { tonic: "F", mode: "major" },
    band: [
      { animal: "bear", instrument: "piano" },
      { animal: "frog", instrument: "bass" },
      { animal: "owl", instrument: "drums" },
    ],
    soloists: ["bear", "frog"],
    sounds: { room: "club", piano: "salamander" },
  },
  {
    id: "monk",
    name: "Thelonious Monk",
    blurb: "Crunched half-step chords, whole-tone runs, dominants sliding down a half step",
    group: "jazz",
    tags: "bebop well you needn't straight no chaser dissonance whole tone",
    style: "swing",
    feel: "monk",
    harmony: "monk",
    tempo: 168,
    key: { tonic: "F", mode: "major" },
    band: [
      { animal: "bear", instrument: "piano" },
      { animal: "cat", instrument: "sax" },
      { animal: "frog", instrument: "bass" },
      { animal: "owl", instrument: "drums" },
    ],
    soloists: ["bear", "cat"],
    sounds: { room: "club", piano: "salamander" },
  },
  {
    id: "miles",
    name: "Miles Davis",
    blurb: "Modal: a bass riff, the piano's two-chord answer, one mode for bars at a time",
    group: "jazz",
    tags: "modal kind of blue so what dorian quartal trumpet",
    style: "swing",
    feel: "miles",
    harmony: "modal",
    tempo: 136,
    key: { tonic: "D", mode: "minor" },
    band: [
      { animal: "fox", instrument: "trumpet" },
      { animal: "cat", instrument: "sax" },
      { animal: "bear", instrument: "piano" },
      { animal: "frog", instrument: "bass" },
      { animal: "owl", instrument: "drums" },
    ],
    soloists: ["fox", "cat", "bear"],
    sounds: { room: "club", piano: "salamander" },
  },
  {
    id: "herbie",
    name: "Herbie Hancock",
    blurb: "Jazz-funk: a synth-bass riff that never stops, fourths on the electric piano",
    group: "jazz",
    tags: "head hunters chameleon funk fusion rhodes electric piano",
    style: "funk",
    feel: "herbie",
    harmony: "headhunters",
    tempo: 100,
    key: { tonic: "Bb", mode: "minor" },
    band: [
      { animal: "bear", instrument: "piano" },
      { animal: "frog", instrument: "bass" },
      { animal: "owl", instrument: "drums" },
      { animal: "cat", instrument: "sax" },
      { animal: "raccoon", instrument: "organ" },
    ],
    soloists: ["bear", "cat"],
    sounds: { room: "club", piano: "wurlitzer" },
  },
  {
    id: "guaraldi",
    name: "Vince Guaraldi",
    blurb: "A left hand that bounces root, fifth, octave, and major sevenths stepping down",
    group: "jazz",
    tags: "peanuts charlie brown linus and lucy christmas trio piano",
    style: "pop",
    feel: "guaraldi",
    harmony: "guaraldi",
    tempo: 124,
    key: { tonic: "Ab", mode: "major" },
    band: [
      { animal: "bear", instrument: "piano" },
      { animal: "frog", instrument: "bass" },
      { animal: "owl", instrument: "drums" },
    ],
    soloists: ["bear"],
    sounds: { room: "club", piano: "salamander" },
  },
  {
    id: "stevie",
    name: "Stevie Wonder",
    blurb: "A clavinet riff in sixteenths, horns on top, soul changes that turn on bVI–V",
    group: "pop",
    tags: "superstition sir duke motown soul funk clavinet horns",
    style: "funk",
    feel: "stevie",
    harmony: "soul",
    tempo: 100,
    key: { tonic: "Eb", mode: "minor" },
    band: [
      { animal: "fox", instrument: "trumpet" },
      { animal: "bear", instrument: "piano" },
      { animal: "frog", instrument: "bass" },
      { animal: "owl", instrument: "drums" },
      { animal: "cat", instrument: "sax" },
      { animal: "elephant", instrument: "trombone" },
    ],
    soloists: ["fox", "bear"],
    sounds: { room: "club", piano: "cp80" },
  },
  {
    id: "sakamoto",
    name: "Ryuichi Sakamoto",
    blurb: "Pentatonic bells in octaves over the royal road, IVmaj7–V–iii–vi",
    group: "film",
    tags: "merry christmas mr lawrence japan film score piano bells pentatonic",
    style: "minimal",
    feel: "sakamoto",
    harmony: "royal",
    tempo: 104,
    key: { tonic: "Db", mode: "major" },
    band: [
      { animal: "bear", instrument: "piano" },
      { animal: "penguin", instrument: "vibes" },
      { animal: "deer", instrument: "pad" },
      { animal: "sheep", instrument: "cello" },
    ],
    soloists: ["bear"],
    sounds: { room: "hall", piano: "salamander", pad: "strings" },
  },
  {
    id: "hisaishi",
    name: "Joe Hisaishi",
    blurb: "A film waltz in minor: oom-pah-pah piano, the violin singing over it",
    group: "film",
    tags: "studio ghibli howl's moving castle merry go round of life waltz anime",
    meter: 3,
    style: "pop",
    feel: "hisaishi",
    harmony: "waltz",
    tempo: 150,
    key: { tonic: "G", mode: "minor" },
    band: [
      { animal: "bunny", instrument: "violin" },
      { animal: "bear", instrument: "piano" },
      { animal: "sheep", instrument: "cello" },
      { animal: "fox", instrument: "flute" },
    ],
    soloists: ["bunny", "bear"],
    sounds: { room: "hall", piano: "salamander" },
  },
  {
    id: "frahm",
    name: "Nils Frahm",
    blurb: "One soft note repeated and swelling, a bell over the piano, chords that take their time",
    group: "film",
    tags: "says felt piano modern classical neo-classical repetition",
    style: "minimal",
    feel: "frahm",
    harmony: "frahm",
    tempo: 104,
    key: { tonic: "F#", mode: "minor" },
    band: [
      { animal: "bear", instrument: "piano" },
      { animal: "penguin", instrument: "vibes" },
      { animal: "deer", instrument: "pad" },
      { animal: "sheep", instrument: "cello" },
    ],
    soloists: ["bear"],
    sounds: { room: "dry", piano: "salamander", pad: "strings" },
  },
  {
    id: "einaudi",
    name: "Ludovico Einaudi",
    blurb: "Broken chords in even eighths, root–fifth–tenth, under a few plain notes",
    group: "film",
    tags: "nuvole bianche una mattina neo-classical piano strings",
    style: "ambient",
    feel: "einaudi",
    harmony: "einaudi",
    tempo: 76,
    key: { tonic: "F", mode: "minor" },
    band: [
      { animal: "bear", instrument: "piano" },
      { animal: "sheep", instrument: "cello" },
      { animal: "bunny", instrument: "violin" },
    ],
    soloists: ["bear"],
    sounds: { room: "hall", piano: "salamander" },
  },
  {
    id: "satie",
    name: "Erik Satie",
    blurb: "A Gymnopédie's sway: a bass note, then the chord, two major sevenths rocking",
    group: "classical",
    tags: "gymnopedie gnossienne french piano slow three",
    meter: 3,
    style: "ambient",
    feel: "satie",
    harmony: "satie",
    tempo: 72,
    key: { tonic: "D", mode: "major" },
    band: [
      { animal: "bunny", instrument: "flute" },
      { animal: "bear", instrument: "piano" },
      { animal: "sheep", instrument: "cello" },
    ],
    soloists: ["bunny"],
    sounds: { room: "hall", piano: "salamander" },
  },
  {
    id: "fela",
    name: "Fela Kuti",
    blurb: "Afrobeat: a chopping guitar, organ stabs and a bass riff, locked over Tony Allen's drums",
    group: "world",
    tags: "afrobeat nigeria lagos tony allen horns groove africa",
    style: "funk",
    feel: "fela",
    harmony: "afro",
    tempo: 112,
    key: { tonic: "D", mode: "minor" },
    band: [
      { animal: "cat", instrument: "sax" },
      { animal: "fox", instrument: "trumpet" },
      { animal: "raccoon", instrument: "organ" },
      { animal: "bear", instrument: "guitar" },
      { animal: "frog", instrument: "bass" },
      { animal: "owl", instrument: "drums" },
    ],
    soloists: ["cat", "raccoon"],
    sounds: { room: "club" },
  },
  {
    id: "son",
    name: "Buena Vista",
    blurb: "Son cubano: 2–3 clave, a piano montuno and a bass that arrives a beat early",
    group: "world",
    tags: "son cubano cuba havana chan chan salsa montuno tumbao clave latin",
    style: "bossa",
    feel: "son",
    harmony: "son",
    tempo: 96,
    key: { tonic: "D", mode: "minor" },
    band: [
      { animal: "fox", instrument: "trumpet" },
      { animal: "bear", instrument: "piano" },
      { animal: "cat", instrument: "guitar" },
      { animal: "frog", instrument: "bass" },
      { animal: "owl", instrument: "drums" },
    ],
    soloists: ["fox", "bear"],
    sounds: { room: "club", piano: "salamander" },
  },
];

export function getPreset(id: string | null | undefined): Preset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}

/** Presets matching every word of a search (name, blurb, tags, style), in shelf order. */
export function searchPresets(query: string): Preset[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return PRESETS;
  return PRESETS.filter((p) => {
    const hay = `${p.name} ${p.blurb} ${p.tags} ${p.style} ${PRESET_GROUPS.find((g) => g.id === p.group)?.label ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
