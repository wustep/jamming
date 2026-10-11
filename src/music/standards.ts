import { parseNotes } from "./notation";
import { mod, pcOf } from "./theory";
import type { KeySig, NoteEvent, StyleId } from "./types";

// The tunes the band knows: each one's changes, and for the songs and the standards its written
// melody (the head), which the leader plays going in and coming out. The generic forms (a jazz
// blues, rhythm changes, the pop progressions, the vamps) aren't any one tune, so they have no
// melody and the band makes up a motif for them.

export interface Standard {
  id: string;
  name: string;
  key: KeySig;
  meter: number;
  /** One entry per bar; several chords in a bar are space-separated and split the bar evenly (two in 3/4 split 2 + 1). */
  bars: string[];
  /** Section letters per bar group, e.g. [["A", 8], ["A", 8], ["B", 8], ["A", 8]]. */
  form: [string, number][];
  style: StyleId;
  tempo: number;
  /** The head's opening motif in compact notation (bars separated by |): what the soloists develop. */
  motif?: string;
  /**
   * The written melody, one entry per bar in compact notation, in the standard's key. The leader
   * plays it as written on the head and the head out. A note held over the barline ends its bar
   * tied ("E5/1~") and starts the next bar again ("E5/2 ..."): it sounds once, held through.
   */
  melody?: string[];
  /**
   * The pickup into the head ("Oh when the…"), as a full bar with rests before it. The melody's
   * last bar already ends with it (for chorus after chorus); when the head comes in after an
   * intro or a solo, the leader plays just this in the bar before.
   */
  pickup?: string;
  note: string;
  /** A public-domain song (a hymn, a carol, a folk tune) rather than a jazz standard. */
  publicDomain?: true;
}

export const STANDARDS: Standard[] = [
  {
    id: "f-blues",
    name: "Jazz Blues in F",
    key: { tonic: "F", mode: "major" },
    meter: 4,
    bars: ["F7", "Bb7", "F7", "Cm7 F7", "Bb7", "Bdim7", "F7", "D7", "Gm7", "C7", "F7 D7", "Gm7 C7"],
    form: [["Blues", 12]],
    style: "swing",
    tempo: 150,
    note: "12-bar jazz blues — the session tune.",
  },
  {
    id: "minor-blues",
    name: "Minor Blues in C",
    key: { tonic: "C", mode: "minor" },
    meter: 4,
    bars: ["Cm7", "Cm7", "Cm7", "Cm7", "Fm7", "Fm7", "Cm7", "Cm7", "Ab7", "G7", "Cm7", "G7"],
    form: [["Blues", 12]],
    style: "swing",
    tempo: 140,
    note: "Dark 12-bar minor blues.",
  },
  {
    id: "rhythm-changes",
    name: "Rhythm Changes",
    key: { tonic: "Bb", mode: "major" },
    meter: 4,
    bars: [
      "Bbmaj7 G7", "Cm7 F7", "Dm7 G7", "Cm7 F7", "Fm7 Bb7", "Ebmaj7 Ebm7", "Dm7 G7", "Cm7 F7",
      "Bbmaj7 G7", "Cm7 F7", "Dm7 G7", "Cm7 F7", "Fm7 Bb7", "Ebmaj7 Ebm7", "Cm7 F7", "Bb6",
      "D7", "D7", "G7", "G7", "C7", "C7", "F7", "F7",
      "Bbmaj7 G7", "Cm7 F7", "Dm7 G7", "Cm7 F7", "Fm7 Bb7", "Ebmaj7 Ebm7", "Cm7 F7", "Bb6",
    ],
    form: [["A", 8], ["A", 8], ["B", 8], ["A", 8]],
    style: "swing",
    tempo: 200,
    note: "AABA, I Got Rhythm changes.",
  },
  {
    id: "autumn",
    name: "Autumn Leaves",
    key: { tonic: "G", mode: "minor" },
    meter: 4,
    bars: [
      "Cm7", "F7", "Bbmaj7", "Ebmaj7", "Am7b5", "D7", "Gm6", "Gm6",
      "Cm7", "F7", "Bbmaj7", "Ebmaj7", "Am7b5", "D7", "Gm6", "Gm6",
      "Am7b5", "D7b9", "Gm6", "Gm6", "Cm7", "F7", "Bbmaj7", "Ebmaj7",
      "Am7b5", "D7b9", "Gm7 C7", "Fm7 Bb7", "Ebmaj7", "Am7b5 D7b9", "Gm6", "Gm6",
    ],
    form: [["A", 8], ["A", 8], ["B", 8], ["C", 8]],
    style: "swing",
    tempo: 132,
    motif: "Eb6/1~ | Eb6/4 F5/4 G5/4 A5/4",
    pickup: "r/4 G5/4 A5/4 Bb5/4",
    melody: [
      "Eb6/1~", "Eb6/4 F5/4 G5/4 A5/4", "D6/2 D6/2~", "D6/4 Eb5/4 F5/4 G5/4",
      "C6/1~", "C6/4 D5/4 E5/4 F#5/4", "Bb5/1", "r/4 G5/4 A5/4 Bb5/4",
      "Eb6/1~", "Eb6/4 F5/4 G5/4 A5/4", "D6/2 D6/2~", "D6/4 Eb5/4 F5/4 G5/4",
      "C6/1~", "C6/4 A5/4 C6/4 Bb5/4", "G5/1~", "G5/4 r/4 F#5/4 G5/4",
      "A5/4 D5/4 A5/2~", "A5/4 A5/4 G5/4 A5/4", "Bb5/1~", "Bb5/4 Bb5/4 A5/4 Bb5/4",
      "C6/1~", "C6/4 F5/4 F6/4 Eb6/4", "D6/1~", "D6/4 r/4 Db6/4 D6/4",
      "Eb6/4 Eb6/4 C6/4 C6/4", "A5/2. Eb6/4", "D6/2 D6/2~", "D6/2. G5/4",
      "C6/2. Bb5/4", "A5/2 Bb5/4 D5/4", "G5/1", "r/4 G5/4 A5/4 Bb5/4",
    ],
    note: "Circle-of-fourths ii–V–I in major and minor.",
  },
  {
    id: "blue-bossa",
    name: "Blue Bossa",
    key: { tonic: "C", mode: "minor" },
    meter: 4,
    bars: ["Cm7", "Cm7", "Fm7", "Fm7", "Dm7b5", "G7", "Cm7", "Cm7", "Ebm7", "Ab7", "Dbmaj7", "Dbmaj7", "Dm7b5", "G7", "Cm7", "Dm7b5 G7"],
    form: [["A", 8], ["B", 8]],
    style: "bossa",
    tempo: 130,
    motif: "G6/4. F6/8 Eb6/8 D6/4 C6/8~ | C6/2. Bb5/4",
    pickup: "r/2. G5/4",
    melody: [
      "G6/4. F6/8 Eb6/8 D6/4 C6/8~", "C6/2. Bb5/4", "Ab5/2 G6/4. F6/8~", "F6/1",
      "F6/4. Eb6/8 D6/8 C6/4 Bb5/8~", "Bb5/2. Ab5/4", "G5/2 F6/4. Eb6/8~", "Eb6/1",
      "Eb6/4. Db6/8 C6/8 Bb5/4 Ab5/8~", "Ab5/2. Gb5/4", "Gb5/4 F5/8 Bb5/8~ Bb5/8 F5/8 Ab5/4~", "Ab5/1",
      "Ab5/4 G5/8 Bb5/8~ Bb5/2", "Ab5/4 G5/8 Bb5/8~ Bb5/4. Ab5/8", "G5/1~", "G5/2. G5/4",
    ],
    note: "16 bars, minor with a lift to Db.",
  },
  {
    id: "so-what",
    name: "Modal (So What changes)",
    key: { tonic: "D", mode: "minor" },
    meter: 4,
    bars: [
      ...Array(16).fill("Dm7"),
      ...Array(8).fill("Ebm7"),
      ...Array(8).fill("Dm7"),
    ],
    form: [["A", 8], ["A", 8], ["B", 8], ["A", 8]],
    style: "swing",
    tempo: 136,
    note: "AABA, D dorian then up a half step.",
  },
  {
    id: "giant-steps",
    name: "Giant Steps",
    key: { tonic: "B", mode: "major" },
    meter: 4,
    bars: [
      "Bmaj7 D7", "Gmaj7 Bb7", "Ebmaj7", "Am7 D7", "Gmaj7 Bb7", "Ebmaj7 F#7", "Bmaj7", "Fm7 Bb7",
      "Ebmaj7", "Am7 D7", "Gmaj7", "C#m7 F#7", "Bmaj7", "Fm7 Bb7", "Ebmaj7", "C#m7 F#7",
    ],
    form: [["A", 16]],
    style: "swing",
    tempo: 180,
    motif: "F#6/2 D6/2 | B5/2 G5/4. Bb5/8~",
    melody: [
      "F#6/2 D6/2", "B5/2 G5/4. Bb5/8~", "Bb5/1", "B5/4. A5/8~ A5/2",
      "D6/2 Bb5/2", "G5/2 D#5/4. F#5/8~", "F#5/1", "G5/2 F5/4. Bb5/8~",
      "Bb5/1", "B5/2 A5/4. D6/8~", "D6/1", "D#6/2 C#6/4. F#6/8~",
      "F#6/2 F#6/2", "G6/2 F6/4. Bb6/8~", "Bb6/1", "F#6/4. F#6/8~ F#6/2",
    ],
    note: "Coltrane changes: three tonal centers a major 3rd apart.",
  },
  {
    id: "jazz-waltz",
    name: "Jazz Waltz in Bb (changes)",
    key: { tonic: "Bb", mode: "major" },
    meter: 3,
    // a 3/4 swing tune: the A section walks down through ii–Vs, the B section climbs back home
    bars: [
      "Bbmaj7", "Bbmaj7", "Gm7", "Gm7", "Cm7", "F7", "Dm7", "G7",
      "Cm7", "F7", "Bbmaj7", "Eb7", "Dm7 G7", "Cm7 F7", "Bb6", "Bb6",
    ],
    form: [["A", 8], ["B", 8]],
    style: "swing",
    tempo: 150,
    note: "A jazz waltz: the comping and the bass speak in three.",
  },
  {
    id: "all-the-things",
    name: "All the Things You Are",
    key: { tonic: "Ab", mode: "major" },
    meter: 4,
    // AABA with a 12-bar last A: the A sections move down a fourth, the bridge sits in G then E
    bars: [
      "Fm7", "Bbm7", "Eb7", "Abmaj7", "Dbmaj7", "G7", "Cmaj7", "Cmaj7",
      "Cm7", "Fm7", "Bb7", "Ebmaj7", "Abmaj7", "D7", "Gmaj7", "Gmaj7",
      "Am7", "D7", "Gmaj7", "Gmaj7", "F#m7", "B7", "Emaj7", "C7#5",
      "Fm7", "Bbm7", "Eb7", "Abmaj7", "Dbmaj7", "Dbm7", "Cm7", "Bdim7", "Bbm7", "Eb7", "Abmaj7", "Gm7b5 C7",
    ],
    form: [["A", 8], ["A", 8], ["B", 8], ["A", 12]],
    style: "swing",
    tempo: 160,
    motif: "Ab5/1 | Db6/2. Ab5/4",
    melody: [
      "Ab5/1", "Db6/2. Ab5/4", "G5/4 G5/4 G5/4 G5/4", "G5/4 C6/2 G5/4",
      "F5/4 F5/4 F5/4 F5/4", "F5/4 B5/2 F5/4", "E5/1~", "E5/1",
      "Eb5/1", "Ab5/2. Eb5/4", "D5/4 D5/4 D5/4 D5/4", "D5/4 G5/2 D5/4",
      "C5/4 C5/4 C5/4 C5/4", "C5/4 D5/8 Eb5/8 D5/4 C5/4", "B4/1~", "B4/4 D5/4 G5/4 D6/4",
      "D6/4. C6/8 C6/2~", "C6/4 Eb5/4 E5/4 C6/4", "B5/1~", "B5/4 D5/4 G5/4 B5/4",
      "B5/4. A5/8 A5/2~", "A5/4 A#4/4 B4/4 A5/4", "G#5/1", "r/1",
      "Ab5/1", "Db6/2. Ab5/4", "G5/4 G5/4 G5/4 G5/4", "G5/4 C6/2 G5/4",
      "F5/1", "Eb6/2. Db6/4", "Eb5/4 Eb5/4 Eb5/4t Eb5/4t Eb5/4t", "G5/2. F5/4",
      "Db5/4 Db5/4 F5/4 Ab5/4", "F6/2 G5/2", "Ab5/1~", "Ab5/2. r/4",
    ],
    note: "Kern's 36-bar tour of keys, the jam session test.",
  },
  {
    id: "a-train",
    name: "Take the A Train",
    key: { tonic: "C", mode: "major" },
    meter: 4,
    bars: [
      "Cmaj7", "Cmaj7", "D7", "D7", "Dm7", "G7", "Cmaj7", "Dm7 G7",
      "Cmaj7", "Cmaj7", "D7", "D7", "Dm7", "G7", "Cmaj7", "Cmaj7",
      "Fmaj7", "Fmaj7", "Fmaj7", "Fmaj7", "D7", "D7", "Dm7", "G7",
      "Cmaj7", "Cmaj7", "D7", "D7", "Dm7", "G7", "Cmaj7", "Dm7 G7",
    ],
    form: [["A", 8], ["A", 8], ["B", 8], ["A", 8]],
    style: "swing",
    tempo: 168,
    motif: "G5/1~ | G5/8 E6/4. G5/4 C6/4",
    melody: [
      "G5/1~", "G5/8 E6/4. G5/4 C6/4", "E6/8 G#5/8~ G#5/2.~", "G#5/1",
      "A5/1", "A5/8 Bb5/8 B5/8 E6/8 G5/8 F#5/8 F5/8 C#6/8", "C6/8 E5/8~ E5/2.~", "E5/1",
      "G5/1~", "G5/8 E6/4. G5/4 C6/4", "E6/8 G#5/8~ G#5/2.~", "G#5/1",
      "A5/1", "A5/8 Bb5/8 B5/8 E6/8 G5/8 F#5/8 F5/8 C#6/8", "C6/8 E5/8~ E5/2.~", "E5/2 r/2",
      "A5/8 C6/8~ C6/2.", "E6/8 F5/4. A5/4 C6/4", "E6/8 A5/4.~ A5/2~", "A5/1",
      "A5/8 C6/8~ C6/2.", "E6/4 F#5/4 A5/4 C6/4", "E6/8 A5/8~ A5/2.~", "A5/2 Ab5/2",
      "G5/1~", "G5/8 E6/4. G5/4 C6/4", "E6/8 G#5/8~ G#5/2.~", "G#5/1",
      "A5/1", "A5/8 Bb5/8 B5/8 E6/8 G5/8 F#5/8 F5/8 C#6/8", "C6/8 E5/8~ E5/2.~", "E5/2 r/2",
    ],
    note: "Strayhorn's AABA, with the II7 lift in bar three.",
  },
  {
    id: "satin-doll",
    name: "Satin Doll",
    key: { tonic: "C", mode: "major" },
    meter: 4,
    bars: [
      "Dm7 G7", "Dm7 G7", "Em7 A7", "Em7 A7", "Am7 D7", "Abm7 Db7", "Cmaj7", "Cmaj7",
      "Dm7 G7", "Dm7 G7", "Em7 A7", "Em7 A7", "Am7 D7", "Abm7 Db7", "Cmaj7", "Cmaj7",
      "Gm7 C7", "Gm7 C7", "Fmaj7", "Fmaj7", "Am7 D7", "Am7 D7", "Dm7", "G7",
      "Dm7 G7", "Dm7 G7", "Em7 A7", "Em7 A7", "Am7 D7", "Abm7 Db7", "Cmaj7", "Cmaj7",
    ],
    form: [["A", 8], ["A", 8], ["B", 8], ["A", 8]],
    style: "swing",
    tempo: 120,
    motif: "A5/8. G5/16 A5/8 G5/8~ G5/8 A5/4. | r/8 A5/4. G5/8 A5/4.",
    melody: [
      "A5/8. G5/16 A5/8 G5/8~ G5/8 A5/4.", "r/8 A5/4. G5/8 A5/4.", "B5/8. A5/16 B5/8 A5/8~ A5/8 B5/4.", "r/8 B5/4. A5/8 B5/4.",
      "r/8 D6/4. C6/8 D6/4.", "r/8 Bb5/4. Ab5/4 Bb5/8 G5/8~", "G5/1~", "G5/1",
      "A5/8. G5/16 A5/8 G5/8~ G5/8 A5/4.", "r/8 A5/4. G5/8 A5/4.", "B5/8. A5/16 B5/8 A5/8~ A5/8 B5/4.", "r/8 B5/4. A5/8 B5/4.",
      "r/8 D6/4. C6/8 D6/4.", "r/8 Bb5/4. Ab5/4 Bb5/8 G5/8~", "G5/1", "r/2.. G5/8",
      "C6/4 Bb5/8. A5/16 G5/8. A5/16 Bb5/4", "C6/4 Bb5/8. A5/16 G5/8. A5/16 Bb5/8 C6/8~", "C6/1~", "C6/2. r/8 C6/8",
      "D6/8. C6/16 B5/8. A5/16~ A5/8. B5/16 C6/4", "D6/8. C6/16 B5/8 A5/8~ A5/8. B5/16 C6/8 D6/8~", "D6/1~", "D6/8 D6/4 D6/8 D6/8 D6/4.",
      "A5/8. G5/16 A5/8 G5/8~ G5/8 A5/4.", "r/8 A5/4. G5/8 A5/4.", "B5/8. A5/16 B5/8 A5/8~ A5/8 B5/4.", "r/8 B5/4. A5/8 B5/4.",
      "r/8 D6/4. C6/8 D6/4.", "r/8 Bb5/4. Ab5/4 Bb5/8 G5/8~", "G5/1~", "G5/2. r/4",
    ],
    note: "Ellington's ii–Vs climbing by step, then sliding down by half steps.",
  },
  {
    id: "fly-me",
    name: "Fly Me to the Moon",
    key: { tonic: "C", mode: "major" },
    meter: 4,
    // the circle of fifths from vi down to the tonic, twice per half
    bars: [
      "Am7", "Dm7", "G7", "Cmaj7", "Fmaj7", "Bm7b5", "E7", "Am7 A7",
      "Dm7", "G7", "Cmaj7", "Am7", "Dm7", "G7", "Cmaj7", "Bm7b5 E7",
      "Am7", "Dm7", "G7", "Cmaj7", "Fmaj7", "Bm7b5", "E7", "Am7 A7",
      "Dm7", "G7", "Em7", "A7", "Dm7", "G7", "Cmaj7", "Bm7b5 E7",
    ],
    form: [["A", 8], ["B", 8], ["A", 8], ["C", 8]],
    style: "swing",
    tempo: 128,
    motif: "C6/4 B5/4 A5/8 G5/4. | F5/4. G5/8 A5/4 C6/4",
    melody: [
      "C6/4 B5/4 A5/8 G5/4.", "F5/4. G5/8 A5/4 C6/4", "B5/4 A5/4 G5/8 F5/4.", "E5/1",
      "A5/4 G5/4 F5/8 E5/4.", "D5/4. E5/8 F5/4 A5/4", "G#5/4 F5/4 E5/8 D5/4.", "C5/2. C#5/4",
      "D5/8 A5/4 A5/8~ A5/2~", "A5/4 C6/2 B5/4", "G5/1~", "G5/2. B4/4",
      "C5/8 F5/4 F5/8~ F5/2~", "F5/4 A5/2 G5/4", "F5/2 E5/2~", "E5/1",
      "C6/4 B5/4 A5/8 G5/4.", "F5/4. G5/8 A5/4 C6/4", "B5/4 A5/4 G5/8 F5/4.", "E5/1",
      "A5/4 G5/4 F5/8 E5/4.", "D5/4 E5/4 F5/4 A5/4", "G#5/4 F5/4 E5/8 D5/4.", "C5/2. C#5/4",
      "D5/8 A5/4 A5/8~ A5/2~", "A5/4 C6/2 B5/4", "E6/1~", "E6/2. C6/4",
      "D6/8 A5/4 A5/8~ A5/2~", "A5/4 B5/2 D6/4", "C6/1~", "C6/2. r/4",
    ],
    note: "Down the circle of fifths, Basie-style.",
  },
  {
    id: "honeysuckle",
    name: "Honeysuckle Rose",
    key: { tonic: "F", mode: "major" },
    meter: 4,
    bars: [
      "Gm7 C7", "Gm7 C7", "Gm7 C7", "Gm7 C7", "Fmaj7", "Dm7", "Gm7 C7", "Fmaj7",
      "Gm7 C7", "Gm7 C7", "Gm7 C7", "Gm7 C7", "Fmaj7", "Dm7", "Gm7 C7", "Fmaj7",
      "Cm7 F7", "Cm7 F7", "Bbmaj7", "Bbmaj7", "Dm7 G7", "Dm7 G7", "Gm7", "C7",
      "Gm7 C7", "Gm7 C7", "Gm7 C7", "Gm7 C7", "Fmaj7", "Dm7", "Gm7 C7", "Fmaj7",
    ],
    form: [["A", 8], ["A", 8], ["B", 8], ["A", 8]],
    style: "swing",
    tempo: 150,
    motif: "C6/8 Bb5/8 D5/8 F5/8 A5/2 | C6/8 Bb5/8 D5/8 F5/8 A5/2",
    melody: [
      "C6/8 Bb5/8 D5/8 F5/8 A5/2", "C6/8 Bb5/8 D5/8 F5/8 A5/2", "C6/8 Bb5/8 D5/8 F5/8 A5/4 A5/4", "A5/2 A5/8 G5/8 F5/8 D5/8",
      "F5/4 F5/4 F5/2~", "F5/2 A5/8 G5/8 F5/8 D5/8", "F5/1~", "F5/4 r/2.",
      "C6/8 Bb5/8 D5/8 F5/8 A5/2", "C6/8 Bb5/8 D5/8 F5/8 A5/2", "C6/8 Bb5/8 D5/8 F5/8 A5/4 A5/4", "A5/2 A5/8 G5/8 F5/8 D5/8",
      "F5/4 F5/4 F5/2~", "F5/2 A5/8 G5/8 F5/8 D5/8", "F5/1~", "F5/4 r/2.",
      "F5/2 G5/2", "Ab5/2 A5/2", "r/4 Bb5/8 C6/8~ C6/8 Bb5/8 C6/4", "Db6/4 C6/8 Bb5/8~ Bb5/2",
      "G5/2 A5/2", "Bb5/2 B5/2", "r/4 C6/8 D6/8~ D6/8 C6/8 D6/4", "Eb6/4 D6/8 C6/8~ C6/2",
      "C6/8 Bb5/8 D5/8 F5/8 A5/2", "C6/8 Bb5/8 D5/8 F5/8 A5/2", "C6/8 Bb5/8 D5/8 F5/8 A5/4 A5/4", "A5/2 A5/8 G5/8 F5/8 D5/8",
      "F5/4 F5/4 F5/2~", "F5/2 A5/8 G5/8 F5/8 D5/8", "F5/1~", "F5/4 r/2.",
    ],
    note: "Fats Waller's ii–V that won't sit still.",
  },
  {
    id: "sweet-georgia",
    name: "Sweet Georgia Brown",
    key: { tonic: "F", mode: "major" },
    meter: 4,
    // dominants a fourth apart, four bars each, before the tonic finally shows up
    bars: [
      "D7", "D7", "D7", "D7", "G7", "G7", "G7", "G7",
      "C7", "C7", "C7", "C7", "F6", "Gm7 C7", "F6", "Em7b5 A7",
      "D7", "D7", "D7", "D7", "G7", "G7", "G7", "G7",
      "Dm7", "A7", "Dm7", "A7", "F6", "D7", "Gm7 C7", "F6",
    ],
    form: [["A", 8], ["B", 8], ["A", 8], ["C", 8]],
    style: "swing",
    tempo: 220,
    motif: "D5/4 E5/4 F#5/4 D5/4 | A5/4 F#5/4 B5/4 A5/4",
    melody: [
      "D5/4 E5/4 F#5/4 D5/4", "A5/4 F#5/4 B5/4 A5/4", "D6/2 A5/8 F#5/4 D5/8~", "D5/1",
      "D5/4 E5/4 F5/4 D5/4", "A5/4 F5/4 B5/4 A5/4", "D6/2 B5/8 A5/4 G5/8~", "G5/1",
      "C5/4 D5/4 E5/4 C5/4", "G5/4 E5/4 A5/4 G5/4", "C6/2 G5/8 E5/4 C5/8~", "C5/4 C5/8 D5/8~ D5/8 C5/8 D5/4",
      "A5/1~", "A5/4 C5/8 D5/8~ D5/8 C5/8 D5/4", "A5/2~ A5/8 A5/4.", "G5/4. A5/8~ A5/2",
      "D5/4 E5/4 F#5/4 D5/4", "A5/4 F#5/4 B5/4 A5/4", "D6/2 A5/8 F#5/4 D5/8~", "D5/1",
      "D5/4 E5/4 F5/4 D5/4", "A5/4 F5/4 B5/4 A5/4", "D6/2 B5/8 A5/4 G5/8~", "G5/2 A5/2",
      "A5/4. A5/8~ A5/2", "G5/8 E5/4 A5/8~ A5/2", "A5/4. A5/8~ A5/2", "G5/8 E5/4 A5/8~ A5/2",
      "C5/8 D5/4 F5/8~ F5/8 A5/4 C6/8~", "C6/8 A5/8 C#6/8 D6/8~ D6/4 A5/4", "G5/2 C6/8 A5/4 F5/8~", "F5/4 r/2.",
    ],
    note: "Four bars on each dominant around the circle; a burner.",
  },
  {
    id: "never-another",
    name: "There Will Never Be Another You",
    key: { tonic: "Eb", mode: "major" },
    meter: 4,
    bars: [
      "Ebmaj7", "Ebmaj7", "Dm7b5", "G7", "Cm7", "Cm7", "Bbm7", "Eb7",
      "Abmaj7", "Db7", "Ebmaj7", "Cm7", "F7", "F7", "Fm7", "Bb7",
      "Ebmaj7", "Ebmaj7", "Dm7b5", "G7", "Cm7", "Cm7", "Bbm7", "Eb7",
      "Abmaj7", "Db7", "Ebmaj7", "Gm7 C7", "Ebmaj7 D7", "G7 C7", "Fm7 Bb7", "Ebmaj7",
    ],
    form: [["A", 8], ["B", 8], ["A", 8], ["C", 8]],
    style: "swing",
    tempo: 180,
    motif: "C5/4 D5/4 Eb5/4 F5/4 | G5/4 Bb5/4 F5/4 Eb5/4",
    pickup: "r/2. Bb4/4",
    melody: [
      "C5/4 D5/4 Eb5/4 F5/4", "G5/4 Bb5/4 F5/4 Eb5/4", "F5/1~", "F5/2 r/8 G5/4.",
      "Eb5/4 F5/4 G5/4 Bb5/4", "C6/4 Eb6/4 C6/4. Bb5/8", "C6/1~", "C6/2. Bb5/4",
      "Eb6/4 C6/4 Bb5/4 Ab5/4", "G5/4 F5/4 G5/4 Ab5/4", "Bb5/4 G5/4 F5/4 Eb5/4", "F5/4 Eb5/8 F5/8~ F5/4 Eb5/4",
      "D6/4 C6/4 Bb5/4 A5/4", "G5/4 F5/4 G5/4 F5/4", "Ab5/1~", "Ab5/2. Bb4/4",
      "C5/4 D5/4 Eb5/4 F5/4", "G5/4 Bb5/4 F5/4 Eb5/4", "F5/1~", "F5/2 r/8 G5/4.",
      "Eb5/4 F5/4 G5/4 Bb5/4", "C6/4 Eb6/4 C6/4. Bb5/8", "C6/1~", "C6/2. Bb5/4",
      "Eb6/4 C6/4 Bb5/4 Ab5/4", "G5/4 F5/4 G5/4 Ab5/4", "Bb5/4 G5/4 F5/4 Eb5/8 D6/8~", "D6/2 r/8 C6/4.",
      "Bb5/4 Eb6/4 D6/4 C6/4", "Bb5/4 Eb5/4 Bb5/4 Ab5/4", "F5/2 G5/2", "Eb5/2. Bb4/4",
    ],
    note: "ABAC with a backdoor Db7 into the tonic.",
  },
  {
    id: "stella",
    name: "Stella by Starlight",
    key: { tonic: "Bb", mode: "major" },
    meter: 4,
    // starts away from home on a half-diminished ii–V and takes its time getting to Bb
    bars: [
      "Em7b5", "A7", "Cm7", "F7", "Fm7", "Bb7", "Ebmaj7", "Ab7",
      "Bbmaj7", "Em7b5 A7", "Dm7", "Bbm7 Eb7", "Fmaj7", "Em7b5 A7", "Am7b5", "D7",
      "G7#5", "G7", "Cm7", "Cm7", "Ab7", "Ab7", "Bbmaj7", "Bbmaj7",
      "Em7b5", "A7", "Dm7b5", "G7", "Cm7b5", "F7", "Bbmaj7", "Bbmaj7",
    ],
    form: [["A", 8], ["B", 8], ["C", 8], ["D", 8]],
    style: "swing",
    tempo: 150,
    motif: "A5/1~ | A5/4 G5/4 A5/4 Bb5/4",
    pickup: "r/2. Bb5/4",
    melody: [
      "A5/1~", "A5/4 G5/4 A5/4 Bb5/4", "F5/1~", "F5/2. F5/4",
      "G5/1~", "G5/4 F5/4 F5/4 G5/4", "Bb4/1~", "Bb4/2. C5/4",
      "Eb5/4 D5/4 C5/4 Bb4/4", "D5/2. E5/4", "G5/4. F5/8 F5/2~", "F5/2. G5/4",
      "Bb5/4 A5/4 G5/4 F5/4", "G5/2 A5/4 Bb5/4", "D6/4. C6/8 C6/2~", "C6/2 D6/2",
      "D#6/1~", "Eb6/4 Eb6/4 Eb6/4 D6/4", "F6/1~", "F6/4 Eb6/4 D6/4t C6/4t Bb5/4t",
      "D6/2 D6/2~", "D6/4 C6/4 Bb5/4 A5/4", "C6/1~", "C6/2. Bb5/4",
      "A5/1~", "A5/4 G5/4 A5/4 Bb5/4", "F5/1~", "F5/4 F5/4 F5/4 Eb5/4",
      "Gb5/1~", "Gb5/4 Gb5/4 Gb5/4 F5/4", "F5/1~", "F5/2. Bb5/4",
    ],
    note: "Through-composed 32 bars of ii–Vs, starting far from home.",
  },
  {
    id: "just-friends",
    name: "Just Friends",
    key: { tonic: "G", mode: "major" },
    meter: 4,
    // opens on the IV chord and backs into the tonic through iv–bVII
    bars: [
      "Cmaj7", "Cmaj7", "Cm7", "F7", "Gmaj7", "Gmaj7", "Bbm7", "Eb7",
      "Am7", "D7", "Bm7", "E7", "A7", "A7", "Am7", "D7",
      "Cmaj7", "Cmaj7", "Cm7", "F7", "Gmaj7", "Gmaj7", "Bbm7", "Eb7",
      "Am7", "D7", "Bm7", "E7", "Am7", "D7", "Gmaj7", "Am7 D7",
    ],
    form: [["A", 8], ["B", 8], ["A", 8], ["C", 8]],
    style: "swing",
    tempo: 170,
    motif: "B5/1~ | B5/2 A5/4t B5/4t A5/4t",
    pickup: "r/2. B5/4",
    melody: [
      "B5/1~", "B5/2 A5/4t B5/4t A5/4t", "Eb5/1~", "Eb5/2 A5/2",
      "A5/1~", "A5/4 A5/4 G5/4t A5/4t G5/4t", "Db5/1~", "Db5/2. G5/4",
      "G5/4. E5/8 G5/4. E5/8", "F#5/2. F#5/4", "F#5/4. D5/8 F#5/4. D5/8", "E5/4 F#5/4 G5/4 B5/4",
      "E6/2 B5/2~", "B5/4 E5/4 E5/4t F#5/4t G5/4t", "B5/2 A5/2~", "A5/2 B5/2",
      "B5/1~", "B5/2 A5/4t B5/4t A5/4t", "Eb5/1~", "Eb5/2 A5/2",
      "A5/1~", "A5/4 A5/4 G5/4t A5/4t G5/4t", "Db5/1~", "Db5/2. G5/4",
      "G5/4. E5/8 G5/4. E5/8", "F#5/2. A5/4", "A5/4. F#5/8 A5/4. F#5/8", "G5/4 A5/4 B5/4 D6/4",
      "E6/2 E5/2", "D6/2 B5/2", "G5/1", "r/2. B5/4",
    ],
    note: "Starts on IV and backs into the tonic.",
  },
  {
    id: "lady-bird",
    name: "Lady Bird",
    key: { tonic: "C", mode: "major" },
    meter: 4,
    bars: [
      "Cmaj7", "Cmaj7", "Fm7", "Bb7", "Cmaj7", "Cmaj7", "Bbm7", "Eb7",
      "Abmaj7", "Abmaj7", "Am7", "D7", "Dm7", "G7", "Cmaj7 Ebmaj7", "Abmaj7 Dbmaj7",
    ],
    form: [["A", 8], ["B", 8]],
    style: "swing",
    tempo: 170,
    motif: "r/8 G4/4. G4/4 G4/4 | G4/4. G4/8~ G4/4 G4/4",
    melody: [
      "r/8 G4/4. G4/4 G4/4", "G4/4. G4/8~ G4/4 G4/4", "Bb4/2 Ab4/4t C4/4t Eb4/4t", "G4/4. E4/8~ E4/4 r/4",
      "r/8 G4/4. G4/4 G4/4", "G4/4. G4/8~ G4/4 G4/4", "C5/2 Bb4/4t Db4/4t F4/4t", "C5/4. A4/8~ A4/4 r/4",
      "r/8 Bb4/4. A4/4 Ab4/4", "Bb4/4 A4/8 Ab4/8 r/2", "r/8 B4/4. Bb4/4 A4/4", "B4/4 Bb4/8 A4/8 r/2",
      "C5/2~ C5/8 A4/8 F4/8 E4/8~", "E4/2 C#4/4 D4/8 G4/8~", "G4/1~", "G4/2. r/4",
    ],
    note: "Tadd Dameron's 16 bars and the famous major-7 turnaround.",
  },
  {
    id: "yardbird",
    name: "Yardbird Suite",
    key: { tonic: "C", mode: "major" },
    meter: 4,
    // the A drifts to the flat side (iv–bVII) and comes home round the dominants; the bridge sits in E minor
    bars: [
      "C6", "Fm7 Bb7", "Cmaj7 Bb7", "A7", "D7", "G7", "Em7 A7", "Dm7 G7",
      "C6", "Fm7 Bb7", "Cmaj7 Bb7", "A7", "D7", "G7", "C6", "C6 B7b9",
      "Em7", "F#m7b5 B7b9", "Em7", "A7", "Dm7", "Em7 A7", "D7", "Dm7 G7",
      "C6", "Fm7 Bb7", "Cmaj7 Bb7", "A7", "D7", "Dm7 G7", "C6", "Dm7 G7",
    ],
    form: [["A", 8], ["A", 8], ["B", 8], ["A", 8]],
    style: "swing",
    tempo: 180,
    motif: "r/8 C6/4. G5/4 A5/4 | Bb5/4. Ab5/4 Eb5/8 F5/8 G5/8~",
    melody: [
      "r/8 C6/4. G5/4 A5/4", "Bb5/4. Ab5/4 Eb5/8 F5/8 G5/8~", "G5/2 G5/4. E5/8~", "E5/4. E5/8 F5/8 E5/8 F5/8 G5/8",
      "E5/8 C5/8 r/8 C5/8~ C5/2", "r/4. D5/8 r/8 E5/8 F5/8 G5/8~", "G5/4. A5/4 E5/8 F5/8 G5/8~", "G5/2. r/4",
      "r/8 C6/4. G5/4 A5/4", "Bb5/4. Ab5/4 Eb5/8 F5/8 G5/8~", "G5/2 G5/4. E5/8~", "E5/4. E5/8 F5/8 E5/8 F5/8 G5/8",
      "E5/8 C5/8 r/8 C5/8~ C5/2", "r/4. C5/8 E5/8 C5/8 E5/8 C5/8~", "C5/1", "r/2. G5/16 A5/16 G5/16 F#5/16",
      "E5/4. F#5/8 G5/8 E5/8 r/8 A5/8", "r/8 A5/8 A5/2.", "G5/8 A5/8 G5/8 F#5/8 E5/8 B4/8 C5/8 C#5/8~", "C#5/2 r/4. Bb4/8",
      "A4/4. A5/8 r/8 E5/8 F5/8 G5/8", "r/8 G5/4. F5/8 E5/8 D5/8 C#5/8", "E5/4 A4/8 E5/2 A4/8", "D5/8 E5/8 F5/8 G5/8 r/2",
      "r/8 C6/4. G5/4 A5/4", "Bb5/4. Ab5/4 Eb5/8 F5/8 G5/8~", "G5/2 G5/4. E5/8~", "E5/4 E5/8 F5/8 r/8 D#5/8 E5/8 A5/8",
      "r/8 A5/4.~ A5/2", "r/8 A4/8 B4/8t C5/8t D5/8t E5/4 G4/8 C5/8~", "C5/2. r/4", "r/1",
    ],
    note: "Bird's AABA, with a bridge that drops into E minor.",
  },
  {
    id: "solar",
    name: "Solar",
    key: { tonic: "C", mode: "minor" },
    meter: 4,
    bars: ["CmMaj7", "CmMaj7", "Gm7", "C7", "Fmaj7", "Fmaj7", "Fm7", "Bb7", "Ebmaj7", "Ebm7 Ab7", "Dbmaj7", "Dm7b5 G7"],
    form: [["A", 12]],
    style: "swing",
    tempo: 160,
    motif: "r/8 C6/4. B5/4 D6/8 C6/8 | r/8 G5/4.~ G5/4. A5/8",
    melody: [
      "r/8 C6/4. B5/4 D6/8 C6/8", "r/8 G5/4.~ G5/4. A5/8", "Bb5/4 Bb5/8 Bb5/8 A5/4 C6/8 Bb5/8~", "Bb5/1",
      "r/8 A5/4. Ab5/4 Bb5/8 A5/8", "r/8 C5/4.~ C5/4 F5/8 G5/8", "Ab5/4 Ab5/8 Ab5/8 G5/4 Bb5/8 Ab5/8~", "Ab5/2. r/8 G5/8~",
      "G5/4 F5/8 Eb5/8 D5/8 C5/4 Gb5/8~", "Gb5/4 F5/8 Eb5/8 Db5/8 C5/4 F5/8~", "F5/1", "r/8 D5/8 Eb5/8 F5/8 G5/8 Ab5/8 B5/4",
    ],
    note: "Twelve bars that never quite land; ii–Vs a whole step apart.",
  },
  {
    id: "night-in-tunisia",
    name: "A Night in Tunisia",
    key: { tonic: "D", mode: "minor" },
    meter: 4,
    bars: [
      "Eb7", "Dm6", "Eb7", "Dm6", "Eb7", "Dm6", "Em7b5 A7", "Dm6",
      "Eb7", "Dm6", "Eb7", "Dm6", "Eb7", "Dm6", "Em7b5 A7", "Dm6",
      "Am7b5", "D7", "Gm6", "Gm6", "Gm7b5", "C7", "Fmaj7", "Em7b5 A7",
      "Eb7", "Dm6", "Eb7", "Dm6", "Eb7", "Dm6", "Em7b5 A7", "Dm6",
    ],
    form: [["A", 8], ["A", 8], ["B", 8], ["A", 8]],
    style: "swing",
    tempo: 180,
    motif: "Bb4/8t Db5/8t F5/8t C6/2 Bb5/8 F5/8 | G#5/8 A5/4. r/4. A4/8",
    pickup: "r/2.. A4/8",
    melody: [
      "Bb4/8t Db5/8t F5/8t C6/2 Bb5/8 F5/8", "G#5/8 A5/4. r/4. A4/8", "Bb4/8t Db5/8t F5/8t C6/8 C6/8~ C6/4 Bb5/8 F5/8", "A5/2. r/8 A4/8",
      "Bb4/8t Db5/8t F5/8t C6/2 Bb5/8 F5/8", "G#5/8 A5/4. r/2", "A5/8 Bb5/8 A5/16t Bb5/16t A5/16t G5/8 D#5/4 C#5/8 D5/8~", "D5/4 r/2 r/8 A4/8",
      "Bb4/8t Db5/8t F5/8t C6/2 Bb5/8 F5/8", "G#5/8 A5/4. r/4. A4/8", "Bb4/8t Db5/8t F5/8t C6/8 C6/8~ C6/4 Bb5/8 F5/8", "A5/2. r/8 A4/8",
      "Bb4/8t Db5/8t F5/8t C6/2 Bb5/8 F5/8", "G#5/8 A5/4. r/2", "A5/8 Bb5/8 A5/16t Bb5/16t A5/16t G5/8 D#5/4 C#5/8 D5/8~", "D5/4 r/2 r/8 A5/8",
      "C6/4. A5/8~ A5/4. G5/8", "F#5/4 Eb6/8 C#6/8 D6/8 C6/4 A5/8", "Bb5/8 G5/4 F#5/8~ F#5/4 A5/8 F#5/8", "G5/8 A5/8 E5/4 r/4. Bb5/8~",
      "Bb5/8 Bb5/4 r/4. G5/16t Ab5/16t G5/16t F5/8", "E5/4 Db6/16t Eb6/16t Db6/16t B5/8 C6/8 Bb5/4 Ab5/8", "A5/4. F5/8 G5/16t Ab5/16t G5/16t F5/8 G5/16t Ab5/16t G5/16t F5/8", "E5/2. r/8 A4/8",
      "Bb4/8t Db5/8t F5/8t C6/2 Bb5/8 F5/8", "G#5/8 A5/4. r/4. A4/8", "Bb4/8t Db5/8t F5/8t C6/8 C6/8~ C6/4 Bb5/8 F5/8", "A5/2. r/8 A4/8",
      "Bb4/8t Db5/8t F5/8t C6/2 Bb5/8 F5/8", "G#5/8 A5/4. r/2", "A5/8 Bb5/8 A5/16t Bb5/16t A5/16t G5/8 D#5/4 C#5/8 D5/8~", "D5/4 r/2 r/8 A4/8",
    ],
    note: "Dizzy's tritone sub rocking over a D minor pedal.",
  },
  {
    id: "caravan",
    name: "Caravan",
    key: { tonic: "F", mode: "minor" },
    meter: 4,
    // twelve bars on the dominant before minor arrives; the bridge walks the circle
    bars: [
      ...Array(12).fill("C7"), "Fm6", "Fm6", "Fm6", "Fm6",
      ...Array(12).fill("C7"), "Fm6", "Fm6", "Fm6", "Fm6",
      "F7", "F7", "F7", "F7", "Bb7", "Bb7", "Bb7", "Bb7", "Eb7", "Eb7", "Eb7", "Eb7", "Ab6", "Ab6", "G7", "G7",
      ...Array(12).fill("C7"), "Fm6", "Fm6", "Fm6", "Fm6",
    ],
    form: [["A", 16], ["A", 16], ["B", 16], ["A", 16]],
    style: "swing",
    tempo: 200,
    motif: "C6/1~ | C6/1~",
    melody: [
      "C6/1~", "C6/1~", "C6/4 Db6/4 C6/4 G5/4", "Bb5/4 C6/4 E6/4 G5/4",
      "Bb5/1~", "Bb5/1~", "Bb5/4 C6/4 Db6/4 C6/4", "Db6/4 C6/4 B5/4 G5/4",
      "Bb5/1~", "Bb5/1~", "Bb5/4 C6/4 B5/4 Bb5/4", "A5/4 Ab5/4 G5/4 Gb5/4",
      "F5/1~", "F5/1~", "F5/1", "r/1",
      "C6/1~", "C6/1~", "C6/4 Db6/4 C6/4 G5/4", "Bb5/4 C6/4 E6/4 G5/4",
      "Bb5/1~", "Bb5/1~", "Bb5/4 C6/4 Db6/4 C6/4", "Db6/4 C6/4 B5/4 G5/4",
      "Bb5/1~", "Bb5/1~", "Bb5/4 C6/4 B5/4 Bb5/4", "A5/4 Ab5/4 G5/4 Gb5/4",
      "F5/1~", "F5/1~", "F5/1", "r/1",
      "F6/1", "D6/2 C6/4. G5/8~", "G5/1~", "G5/4. F5/8 E5/4 F5/4",
      "C6/1", "G5/2 F5/4. C5/8~", "C5/1", "r/2 Bb5/8 C6/8 Db6/8 D6/8",
      "Eb6/1", "C6/2 Bb5/4. F5/8~", "F5/1~", "F5/2 G5/4 Eb5/4",
      "C6/4. Ab5/8~ Ab5/2~", "Ab5/2 Bb5/4 Ab5/4", "G5/2 G5/4. G5/8~", "G5/2 r/2",
      "C6/1~", "C6/1~", "C6/4 Db6/4 C6/4 G5/4", "Bb5/4 C6/4 E6/4 G5/4",
      "Bb5/1~", "Bb5/1~", "Bb5/4 C6/4 Db6/4 C6/4", "Db6/4 C6/4 B5/4 G5/4",
      "Bb5/1~", "Bb5/1~", "Bb5/4 C6/4 B5/4 Bb5/4", "A5/4 Ab5/4 G5/4 Gb5/4",
      "F5/1~", "F5/1~", "F5/1", "r/1",
    ],
    note: "Juan Tizol's 64 bars: a long hang on C7, then F minor.",
  },
  {
    id: "summertime",
    name: "Summertime",
    key: { tonic: "A", mode: "minor" },
    meter: 4,
    bars: [
      "Am6 E7", "Am6 E7", "Am6 E7", "Am6", "Dm7", "Dm7", "Bm7b5", "E7",
      "Am6 E7", "Am6 E7", "Am6 E7", "Am6", "Cmaj7", "Bm7b5 E7", "Am6", "Bm7b5 E7",
    ],
    form: [["A", 8], ["A", 8]],
    style: "swing",
    tempo: 96,
    motif: "E6/1~ | E6/8 r/8 D6/8. C6/16 D6/8. E6/16 C6/4",
    pickup: "r/2 E6/4 C6/4",
    melody: [
      "E6/1~", "E6/8 r/8 D6/8. C6/16 D6/8. E6/16 C6/4", "A5/2 E5/2~", "E5/4 r/4 E6/4 C6/4",
      "D6/8 D6/4.~ D6/2", "r/4 C6/8. A5/16 C6/8. A5/16 C6/4", "B5/1~", "B5/2 r/8 E6/4 C6/8",
      "E6/8 E6/4 E6/8~ E6/2", "r/4 D6/8. C6/16 D6/8. E6/16 C6/4", "A5/2 E5/2~", "E5/2 r/4 E5/4",
      "G5/4 E5/8 G5/8 A5/4 C6/4", "E6/8 D6/4. C6/2", "A5/1~", "A5/2 E6/4 C6/4",
    ],
    note: "Gershwin's lullaby: a slow minor 16, swung soft.",
  },
  {
    id: "blue-monk",
    name: "Blue Monk",
    key: { tonic: "Bb", mode: "major" },
    meter: 4,
    bars: ["Bb7 Eb7", "Bb7", "Bb7 Eb7", "Bb7", "Eb7", "Edim7", "Bb7", "G7", "Cm7", "F7", "Bb7 Eb7", "Bb7 F7"],
    form: [["Blues", 12]],
    style: "swing",
    tempo: 120,
    motif: "D5/8 Eb5/8 E5/8 F5/8~ F5/2 | G5/8 Ab5/8 A5/8 Bb5/8~ Bb5/2",
    melody: [
      "D5/8 Eb5/8 E5/8 F5/8~ F5/2", "G5/8 Ab5/8 A5/8 Bb5/8~ Bb5/2", "F5/8 G5/8 F5/8 E5/8 Eb5/8 F4/8 Db5/8 D5/8~", "D5/8 Db5/4 C5/8~ C5/2",
      "G5/8 Ab5/8 A5/8 Bb5/8~ Bb5/2", "Bb5/8 B5/8 C6/8 C#6/8~ C#6/2", "F5/8 G5/8 F5/8 E5/8 Eb5/8 F4/8 Db5/8 D5/8~", "D5/2. F5/8t F5/8t F5/8t",
      "F5/8 F4/4.~ F4/2", "F5/8 G5/8 F5/8 E5/8 Eb5/8 F4/8 Db5/8 D5/8~", "D5/4 F5/8 G5/8 F5/8 E5/8 Eb5/8 F4/8", "Db5/8 D5/4.~ D5/2",
    ],
    note: "Monk's blues in Bb, with the diminished climb in bar six.",
  },
  {
    id: "tenor-madness",
    name: "Tenor Madness",
    key: { tonic: "Bb", mode: "major" },
    meter: 4,
    bars: ["Bb7", "Eb7", "Bb7", "Fm7 Bb7", "Eb7", "Edim7", "Bb7", "Dm7 G7", "Cm7", "F7", "Bb7 G7", "Cm7 F7"],
    form: [["Blues", 12]],
    style: "swing",
    tempo: 170,
    motif: "D5/8 Bb4/4 G4/8 Bb4/4 r/8 Db5/8~ | Db5/8 Bb4/4 G4/8 Bb4/4 r/8 D5/8",
    pickup: "r/2.. D5/8",
    melody: [
      "D5/8 Bb4/4 G4/8 Bb4/4 r/8 Db5/8~", "Db5/8 Bb4/4 G4/8 Bb4/4 r/8 D5/8", "D5/8 Bb4/4 G4/8 Bb4/8 C5/8 Bb4/8 G4/8", "Bb4/8 C5/8 Bb4/8 Bb4/8 r/4. Db5/8~",
      "Db5/8 Bb4/4 G4/8 Bb4/4 r/8 Db5/8~", "C#5/8 Bb4/4 G4/8 Bb4/4 r/8 D5/8~", "D5/8 Bb4/4 G4/8 Bb4/8 C5/8 Bb4/8 G4/8", "Bb4/8 C5/8 Bb4/8 Bb4/8 r/4. C5/8~",
      "C5/8 G4/4 C5/8 B4/8 G4/8 Eb4/8 C4/8", "Bb4/8 G4/8 Ab4/8 A4/8 r/4. D5/8~", "D5/8 Bb4/4 G4/8 Bb4/8 C5/8 Bb4/8 G4/8", "Bb4/8 C5/8 Bb4/8 Bb4/8 r/4. D5/8",
    ],
    note: "Rollins' jazz blues in Bb, the horn players' key.",
  },
  {
    id: "c-jam",
    name: "C Jam Blues",
    key: { tonic: "C", mode: "major" },
    meter: 4,
    bars: ["C7", "F7", "C7", "C7", "F7", "F7", "C7", "C7", "G7", "F7", "C7", "G7"],
    form: [["Blues", 12]],
    style: "swing",
    tempo: 160,
    motif: "G4/8 G4/8 r/2. | G4/8 G4/8 r/4 G4/8 G4/8 r/4",
    melody: [
      "G4/8 G4/8 r/2.", "G4/8 G4/8 r/4 G4/8 G4/8 r/4", "G4/4. C5/8 r/2", "r/1",
      "G4/8 G4/8 r/2.", "G4/8 G4/8 r/4 G4/8 G4/8 r/4", "G4/4. C5/8 r/2", "r/1",
      "G4/8 G4/8 r/2.", "G4/8 G4/8 r/4 G4/8 G4/8 r/4", "G4/4. C5/8 r/2", "r/1",
    ],
    note: "Ellington's two-note riff over a plain 12-bar in C.",
  },
  {
    id: "blues-for-alice",
    name: "Blues for Alice",
    key: { tonic: "F", mode: "major" },
    meter: 4,
    // the Bird blues: a ii–V every bar, chromatically down to the IV
    bars: ["Fmaj7", "Em7b5 A7", "Dm7 G7", "Cm7 F7", "Bb7", "Bbm7 Eb7", "Am7 D7", "Abm7 Db7", "Gm7", "C7", "F7 D7", "Gm7 C7"],
    form: [["Blues", 12]],
    style: "swing",
    tempo: 180,
    motif: "F6/4 C6/8 A5/8 E6/4 C6/8 A5/8 | D6/8 E6/8 B5/8 C6/8 C#6/8 Bb5/8 G5/8 G#5/8",
    melody: [
      "F6/4 C6/8 A5/8 E6/4 C6/8 A5/8", "D6/8 E6/8 B5/8 C6/8 C#6/8 Bb5/8 G5/8 G#5/8", "A5/4 F5/8 D5/8 G5/8 A5/8 F5/8 E5/8", "Eb5/8t G5/8t Bb5/8t D6/8 Db6/8 r/8 F5/8 F5/8t G5/8t F5/8t",
      "C6/4 Bb5/8 F5/8 Ab5/8 Bb4/8 r/8 G5/8", "Eb6/8 Db6/8 Ab5/8 F5/8 C6/8 F5/8 G5/8 A5/8~", "A5/4 E5/8 C5/8 D5/4 r/8 C#6/8~", "Db6/4 B5/8 Gb5/8 Bb5/4 r/8 Ab5/8",
      "G5/4t F6/4t F6/4t F6/8 D6/8 Bb5/8 G5/8", "A5/8 G5/8 C6/8 Bb5/8 Eb6/4 r/8 C6/8~", "C6/4 A5/8 F5/8 G5/4 r/8 D6/8~", "D6/4 Bb5/8 F5/8 A5/4 r/4",
    ],
    note: "Bird blues: ii–Vs falling by half steps into the IV.",
  },
  {
    id: "freddie",
    name: "Freddie Freeloader",
    key: { tonic: "Bb", mode: "major" },
    meter: 4,
    bars: ["Bb7", "Bb7", "Bb7", "Bb7", "Eb7", "Eb7", "Bb7", "Bb7", "F7", "Eb7", "Ab7", "Bb7"],
    form: [["Blues", 12]],
    style: "swing",
    tempo: 130,
    motif: "G4/4. F4/8~ F4/2~ | F4/1",
    melody: [
      "G4/4. F4/8~ F4/2~", "F4/1", "G4/4. F4/8~ F4/2~", "F4/1",
      "C5/4. Bb4/8~ Bb4/2~", "Bb4/1", "G4/4. F4/8~ F4/2~", "F4/2. Ab4/4",
      "A4/2. Ab4/8 G4/8~", "G4/2. F4/8 Gb4/8~", "Gb4/1~", "Gb4/1",
    ],
    note: "Kind of Blue's easy blues, with the Ab7 in bar eleven.",
  },
  {
    id: "all-blues",
    name: "All Blues",
    key: { tonic: "G", mode: "major" },
    meter: 3,
    bars: ["G7", "G7", "G7", "G7", "Gm7", "Gm7", "G7", "G7", "D7#9", "Eb7#9 D7#9", "G7", "G7"],
    form: [["Blues", 12]],
    style: "swing",
    tempo: 150,
    motif: "B4/4.~ B4/4~ B4/16 D4/16 | B4/16 C5/16 B4/4~ B4/4~ B4/16 D4/16",
    melody: [
      "B4/4.~ B4/4~ B4/16 D4/16", "B4/16 C5/16 B4/4~ B4/4~ B4/16 D4/16", "B4/16 C5/16 B4/4~ B4/4~ B4/16 D4/16", "B4/4.~ B4/4 r/8",
      "A4/4 Bb4/8 C5/4 D5/8", "C5/4 Bb4/8 A4/4~ A4/16 D4/16", "B4/2.", "G4/4.~ G4/4~ G4/16 Ab4/16",
      "A4/2.", "Bb4/2.", "A4/4. B4/4.", "A4/4. G4/4.",
    ],
    note: "A modal blues in three, with the half-step slide in bar ten.",
  },
  {
    id: "footprints",
    name: "Footprints",
    key: { tonic: "C", mode: "minor" },
    meter: 3,
    // Shorter's 6/4 minor blues counted in 3: each written bar is two here
    bars: [
      "Cm7", "Cm7", "Cm7", "Cm7", "Cm7", "Cm7", "Cm7", "Cm7",
      "Fm7", "Fm7", "Fm7", "Fm7", "Cm7", "Cm7", "Cm7", "Cm7",
      "F#m7b5", "B7", "E7#9", "A7#9", "Cm7", "Cm7", "Cm7", "Cm7",
    ],
    form: [["Blues", 24]],
    style: "swing",
    tempo: 150,
    motif: "Bb4/4 Bb4/4 Bb4/4 | Bb4/8 C5/8~ C5/4. A4/8",
    melody: [
      "Bb4/4 Bb4/4 Bb4/4", "Bb4/8 C5/8~ C5/4. A4/8", "Bb4/8 A4/8 G4/8 F4/8 D4/4~", "D4/2 C4/4",
      "r/2 r/8 D4/8~", "D4/2 C4/4", "r/2 r/8 D4/8~", "D4/2 C4/4",
      "Bb4/4 Bb4/4 Bb4/4", "Bb4/8 C5/8~ C5/4. D5/8", "Eb5/8 D5/8 C5/8 Bb4/8 G4/4~", "G4/2 F4/4",
      "Bb4/8 A4/8 G4/8 F4/8 D4/4~", "D4/2 C4/4", "r/2 r/8 D4/8~", "D4/2 C4/4",
      "B4/4 B4/4 B4/4", "B4/8 D5/8~ D5/4 G4/8 A#4/8~", "A#4/2~ A#4/8t A4/8t G#4/8t", "G4/2~ G4/16 C5/16 G4/16 F#4/16",
      "F4/2.~", "F4/2.~", "F4/2.~", "F4/2.",
    ],
    note: "Wayne Shorter's minor blues, its strange turnaround and all.",
  },
  {
    id: "someday",
    name: "Someday My Prince Will Come",
    key: { tonic: "Bb", mode: "major" },
    meter: 3,
    bars: [
      "Bbmaj7", "D7#5", "Ebmaj7", "G7", "Cm7", "G7", "Cm7", "F7",
      "Dm7", "Dbdim7", "Cm7", "F7", "Dm7", "Dbdim7", "Cm7", "F7",
      "Bbmaj7", "D7#5", "Ebmaj7", "G7", "Cm7", "G7", "Cm7", "F7",
      "Fm7", "Bb7", "Ebmaj7", "Edim7", "Bbmaj7 G7", "Cm7 F7", "Bbmaj7", "Cm7 F7",
    ],
    form: [["A", 8], ["B", 8], ["A", 8], ["C", 8]],
    style: "swing",
    tempo: 160,
    motif: "F5/2. | A#5/2 F#5/4",
    melody: [
      "F5/2.", "A#5/2 F#5/4", "A5/2 G5/4", "G5/2.",
      "G5/2.", "Eb6/2 B5/4", "D6/2 C6/4", "C6/4 D6/4 Eb6/4",
      "F6/2 F6/4", "A6/2 A6/4", "F6/2.", "C6/4 D6/4 Eb6/4",
      "F6/2 F6/4", "A6/2 A6/4", "F6/2.~", "F6/2.",
      "F5/2.", "A#5/2 F#5/4", "A5/2 G5/4", "G5/2.",
      "G5/2.", "Eb6/2 B5/4", "D6/2 C6/4", "C6/4 D6/4 Eb6/4",
      "F6/4. E6/8 F6/4", "C7/2 Bb6/4", "C6/4 Bb5/4 C6/4", "A6/2 G6/4",
      "F6/2 Eb6/4", "D6/2 C6/4", "Bb5/2.~", "Bb5/2.",
    ],
    note: "The jazz waltz Miles made a standard.",
  },
  {
    id: "doxy",
    name: "Doxy",
    key: { tonic: "Bb", mode: "major" },
    meter: 4,
    // dominants walking down the circle from the flat VII, then the IV and its diminished
    bars: ["Bb7 Ab7", "G7", "C7 F7", "Bb7 F7", "Bb7 Ab7", "G7", "C7 F7", "Bb7", "Eb7", "Edim7", "Bb7 G7", "C7 F7", "Bb7 Ab7", "G7", "C7 F7", "Bb7 F7"],
    form: [["A", 4], ["A", 4], ["B", 4], ["A", 4]],
    style: "swing",
    tempo: 140,
    motif: "Bb5/8 D6/8 Bb5/8 F5/8 Bb5/4 r/8 F5/8 | Bb5/8 F5/8 Bb5/8 C#6/8 r/8 G5/4 F5/8",
    pickup: "r/2.. F5/8",
    melody: [
      "Bb5/8 D6/8 Bb5/8 F5/8 Bb5/4 r/8 F5/8", "Bb5/8 F5/8 Bb5/8 C#6/8 r/8 G5/4 F5/8", "E5/8 G5/8 Bb5/8 Db6/8 C6/8t Db6/8t C6/8t G5/8 Bb5/8", "r/2.. F5/8",
      "Bb5/8 D6/8 Bb5/8 F5/8 Bb5/4 r/8 F5/8", "Bb5/8 F5/8 Bb5/8 C#6/8 r/8 G5/4 F5/8", "E5/8 G5/8 Bb5/8 Db6/8 C6/8t Db6/8t C6/8t G5/8 A5/8", "r/1",
      "G6/4 r/8 F6/8~ F6/8 r/8 Db6/4~", "C#6/4. G5/8 r/8 C6/4 G5/8", "Db6/4 Db6/8 Db6/8 G5/4 C6/4", "r/2.. F5/8",
      "Bb5/8 D6/8 Bb5/8 F5/8 Bb5/4 r/8 F5/8", "Bb5/8 F5/8 Bb5/8 C#6/8 r/8 G5/4 F5/8", "E5/8 G5/8 Bb5/8 Db6/8 C6/8t Db6/8t C6/8t G5/8 Bb5/8", "r/2.. F5/8",
    ],
    note: "Rollins' 16-bar strut down the circle of dominants.",
  },
  {
    id: "mack-the-knife",
    name: "Mack the Knife",
    key: { tonic: "Bb", mode: "major" },
    meter: 4,
    bars: ["Bb6", "Bb6", "Cm7", "Cm7", "F7", "F7", "Bb6", "Bb6", "Gm7", "Gm7", "Cm7", "Cm7", "F7", "F7", "Bb6", "Bb6"],
    form: [["A", 8], ["A", 8]],
    style: "swing",
    tempo: 132,
    motif: "G5/2 G5/2~ | G5/2 D5/4. F5/8",
    pickup: "r/2 D5/4. F5/8",
    melody: [
      "G5/2 G5/2~", "G5/2 D5/4. F5/8", "G5/2 G5/2~", "G5/2 C5/4. Eb5/8",
      "G5/2 G5/2~", "G5/2 C5/4. Eb5/8", "G5/1~", "G5/2 F5/4. A5/8",
      "C6/2 Bb5/2~", "Bb5/2 A5/4. G5/8", "Bb5/2 C5/2~", "C5/2 D5/4. Eb5/8",
      "Bb5/2 C5/2~", "C5/2 Bb5/4 A5/4", "G5/1~", "G5/2 D5/4. F5/8",
    ],
    note: "Sixteen easy bars that modulate up every chorus, if you like.",
  },
  {
    id: "girl-from-ipanema",
    name: "The Girl from Ipanema",
    key: { tonic: "F", mode: "major" },
    meter: 4,
    // the long bridge drifts up a half step and back down through the circle
    bars: [
      "Fmaj7", "Fmaj7", "G7", "G7", "Gm7", "Gb7", "Fmaj7", "Gb7",
      "Fmaj7", "Fmaj7", "G7", "G7", "Gm7", "Gb7", "Fmaj7", "Fmaj7",
      "Gbmaj7", "Gbmaj7", "B7", "B7", "F#m7", "F#m7", "D7", "D7",
      "Gm7", "Gm7", "Eb7", "Eb7", "Am7", "D7", "Gm7", "C7",
      "Fmaj7", "Fmaj7", "G7", "G7", "Gm7", "Gb7", "Fmaj7", "Fmaj7",
    ],
    form: [["A", 8], ["A", 8], ["B", 16], ["A", 8]],
    style: "bossa",
    tempo: 130,
    motif: "G5/4. E5/8 E5/4 D5/8 G5/8~ | G5/4 E5/8 E5/8~ E5/8 E5/8 D5/8 G5/8~",
    melody: [
      "G5/4. E5/8 E5/4 D5/8 G5/8~", "G5/4 E5/8 E5/8~ E5/8 E5/8 D5/8 G5/8~", "G5/4 E5/4 E5/4 D5/8 G5/8~", "G5/8 G5/8 E5/8 E5/8~ E5/8 E5/8 D5/8 F5/8~",
      "F5/8 D5/4 D5/8~ D5/8 D5/8 C5/8 E5/8~", "E5/8 C5/4 C5/8~ C5/8 C5/8 Bb4/4", "r/4 C5/2.~", "C5/2 r/2",
      "G5/4. E5/8 E5/4 D5/8 G5/8~", "G5/4 E5/8 E5/8~ E5/8 E5/8 D5/8 G5/8~", "G5/4 E5/4 E5/4 D5/8 G5/8~", "G5/8 G5/8 E5/8 E5/8~ E5/8 E5/8 D5/8 F5/8~",
      "F5/8 D5/4 D5/8~ D5/8 D5/8 C5/8 E5/8~", "E5/8 C5/4 C5/8~ C5/8 C5/8 Bb4/4", "r/4 C5/2.~", "C5/2 r/2",
      "F5/1~", "F5/4t Gb5/4t F5/4t Eb5/4t F5/4t Eb5/4t", "C#5/4. D#5/8~ D#5/2~", "D#5/2. r/8 G#5/8~",
      "G#5/1~", "G#5/4t A5/4t G#5/4t F#5/4t G#5/4t F#5/4t", "E5/4. F#5/8~ F#5/2~", "F#5/2. r/8 A5/8~",
      "A5/1~", "A5/4t Bb5/4t A5/4t G5/4t A5/4t G5/4t", "F5/4. G5/8~ G5/2~", "G5/2 r/4t A5/4t Bb5/4t",
      "C6/4t C5/4t D5/4t E5/4t F5/4t G5/4t", "G#5/2. A5/4", "Bb5/4t Bb4/4t C5/4t D5/4t E5/4t F5/4t", "F#5/2. r/4",
      "G5/4. E5/8 E5/4 D5/8 G5/8~", "G5/4 E5/8 E5/8~ E5/8 E5/8 D5/8 G5/8~", "G5/4 E5/4 E5/4 D5/8 G5/8~", "G5/8 G5/8 E5/8 E5/8~ E5/8 E5/8 D5/8 A5/8~",
      "A5/4. F5/8 F5/8 F5/8 D5/8 C6/8~", "C6/4. E5/8 E5/4t E5/4t D5/4t", "E5/1", "r/1",
    ],
    note: "Jobim's AABA with the 16-bar bridge.",
  },
  {
    id: "one-note-samba",
    name: "One Note Samba",
    key: { tonic: "Bb", mode: "major" },
    meter: 4,
    // the tune holds one note while the chords slide down by half steps under it
    bars: [
      "Dm7", "Db7", "Cm7", "B7", "Dm7", "Db7", "Cm7", "B7",
      "Fm7", "Bb7", "Ebmaj7", "Ab7", "Dm7", "Db7", "Cm7 B7", "Bb6",
      "Ebm7", "Ab7", "Dbmaj7", "Dbmaj7", "Dbm7", "Gb7", "Bmaj7", "Cm7 B7",
      "Dm7", "Db7", "Cm7", "B7", "Dm7", "Db7", "Cm7 B7", "Bb6",
    ],
    form: [["A", 8], ["A", 8], ["B", 8], ["A", 8]],
    style: "bossa",
    tempo: 140,
    motif: "F5/4 F5/8 F5/8~ F5/8 F5/4 F5/8~ | F5/8 F5/4. r/8 F5/4 F5/8",
    pickup: "r/2 r/8 F5/4 F5/8",
    melody: [
      "F5/4 F5/8 F5/8~ F5/8 F5/4 F5/8~", "F5/8 F5/4. r/8 F5/4 F5/8", "F5/4 F5/8 F5/8~ F5/8 F5/4 F5/8~", "F5/2 r/8 F5/4 F5/8",
      "F5/4 F5/8 F5/8~ F5/8 F5/4 F5/8~", "F5/8 F5/4. r/8 F5/4 F5/8", "F5/4 F5/8 F5/8~ F5/8 F5/4 F5/8~", "F5/2 r/8 A#5/4 A#5/8",
      "Bb5/4 Bb5/8 Bb5/8~ Bb5/8 Bb5/4 Bb5/8~", "Bb5/8 Bb5/4. r/8 Bb5/4 Bb5/8", "Bb5/4 Bb5/8 Bb5/8~ Bb5/8 Bb5/4 Bb5/8~", "Bb5/4. r/4 F5/4 F5/8",
      "F5/4 F5/8 F5/8~ F5/8 F5/4 F5/8~", "F5/8 F5/4 F5/8~ F5/8 F5/8 F5/4", "F5/4 F5/8 F5/8~ F5/8 F5/4 A#5/8", "r/1",
      "Bb5/8 C6/8 Db6/8 Eb6/8 Db6/8 C6/8 Bb5/8 Ab5/8", "Gb5/8 F5/8 Eb5/8 Db5/8 C5/8 Db5/8 Eb5/8 F5/8", "C5/4. Bb4/8 r/8 C5/8 Db5/8 F5/8", "C5/4. Bb4/8 r/2",
      "Ab5/8 Bb5/8 B5/8 Db6/8 B5/8 Bb5/8 Ab5/8 Gb5/8", "E5/8 Eb5/8 Db5/8 B4/8 Bb4/8 B4/8 Db5/8 Eb5/8", "A#4/4. G#4/8 r/8 A#4/8 B4/8 D#5/8", "F#5/4. F5/8 r/8 F5/4 F5/8",
      "F5/4 F5/8 F5/8 F5/8~ F5/4 F5/8~", "F5/8 F5/4. r/8 F5/4 F5/8", "F5/4 F5/8 F5/8~ F5/8 F5/4 F5/8~", "F5/2 r/8 F5/4 F5/8",
      "F5/4 F5/8 F5/8~ F5/8 F5/4 F5/8~", "F5/8 F5/4 F5/8~ F5/8 F5/8 F5/4", "F5/4 F5/8 F5/8~ F5/8 F5/4 A#5/8", "r/2 r/8 F5/4 F5/8",
    ],
    note: "Chords sliding down in half steps under one held note.",
  },
  {
    id: "song-for-my-father",
    name: "Song for My Father",
    key: { tonic: "F", mode: "minor" },
    meter: 4,
    bars: [
      "Fm7", "Fm7", "Eb7", "Eb7", "Db7", "C7", "Fm7", "Fm7",
      "Fm7", "Fm7", "Eb7", "Eb7", "Db7", "C7", "Fm7", "Fm7",
      "Eb7", "Eb7", "Fm7", "Fm7", "Eb7 Db7", "C7", "Fm7", "Fm7",
    ],
    form: [["A", 8], ["A", 8], ["B", 8]],
    style: "bossa",
    tempo: 120,
    motif: "C5/8 Db5/16t C5/16t Bb4/16t Ab4/8 Bb4/8~ Bb4/8 C5/16t Bb4/16t Ab4/16t F4/8 Ab4/8~ | Ab4/8 Bb4/16t Ab4/16t F4/16t Eb4/8 F4/8~ F4/8 G4/16t F4/16t Eb4/16t C4/8 Eb4/8~",
    pickup: "r/2 r/8 C4/8 F4/8 Ab4/8",
    melody: [
      "C5/8 Db5/16t C5/16t Bb4/16t Ab4/8 Bb4/8~ Bb4/8 C5/16t Bb4/16t Ab4/16t F4/8 Ab4/8~", "Ab4/8 Bb4/16t Ab4/16t F4/16t Eb4/8 F4/8~ F4/8 G4/16t F4/16t Eb4/16t C4/8 Eb4/8~", "Eb4/1~", "Eb4/2. G3/8 Gb3/8",
      "F3/8 Db4/8~ Db4/2.", "r/2 F4/4. G4/8~", "G4/1~", "G4/2 r/8 C4/8 F4/8 Ab4/8",
      "C5/8 Db5/16t C5/16t Bb4/16t Ab4/8 Bb4/8~ Bb4/8 C5/16t Bb4/16t Ab4/16t F4/8 Ab4/8~", "Ab4/8 Bb4/16t Ab4/16t F4/16t Eb4/8 F4/8~ F4/8 G4/16t F4/16t Eb4/16t C4/8 Eb4/8~", "Eb4/1~", "Eb4/2. G3/8 Gb3/8",
      "F3/8 Db4/8~ Db4/2.", "r/2 F4/4. G4/8~", "G4/1~", "G4/2 r/8 Eb4/8 Eb4/8 Eb4/8",
      "Eb4/8 Db4/8 r/8 F4/8~ F4/2", "F4/2 r/8 F4/8 F4/8 F4/8", "F4/8 Eb4/8 r/8 G4/8~ G4/2~", "G4/2 r/8 Eb4/8 Eb4/8 Eb4/8",
      "Eb4/8 Db4/8 r/8 F4/8~ F4/2", "r/2 Ab4/4. Bb4/8~", "Bb4/1~", "Bb4/2 r/8 C4/8 F4/8 Ab4/8",
    ],
    note: "Horace Silver's 24-bar minor bossa, stepping down to the V.",
  },
  {
    id: "maiden-voyage",
    name: "Maiden Voyage",
    key: { tonic: "D", mode: "major" },
    meter: 4,
    bars: [
      "D7sus4", "D7sus4", "D7sus4", "D7sus4", "F7sus4", "F7sus4", "F7sus4", "F7sus4",
      "D7sus4", "D7sus4", "D7sus4", "D7sus4", "F7sus4", "F7sus4", "F7sus4", "F7sus4",
      "Eb7sus4", "Eb7sus4", "Eb7sus4", "Eb7sus4", "C#m7", "C#m7", "C#m7", "C#m7",
      "D7sus4", "D7sus4", "D7sus4", "D7sus4", "F7sus4", "F7sus4", "F7sus4", "F7sus4",
    ],
    form: [["A", 8], ["A", 8], ["B", 8], ["A", 8]],
    style: "bossa",
    tempo: 120,
    motif: "D5/1~ | D5/1~",
    pickup: "r/2. A4/8 D5/8",
    melody: [
      "D5/1~", "D5/1~", "D5/2 r/2", "r/2. C5/8 D5/8",
      "Eb5/8 F5/8 C5/2.~", "C5/1~", "C5/2 r/2", "r/2. A4/8 D5/8",
      "D5/1~", "D5/1~", "D5/2 r/2", "r/2. C5/8 D5/8",
      "Eb5/8 F5/8 C5/2.~", "C5/1~", "C5/2 r/2", "r/2. C5/8 F5/8",
      "F5/1~", "F5/1~", "F5/2 r/2", "r/2. Eb5/8 E5/8",
      "E5/8 F#5/8 C#5/2.~", "C#5/1", "C#5/2 r/2", "r/2. A4/8 D5/8",
      "D5/1~", "D5/1~", "D5/2 r/2", "r/2. C5/8 D5/8",
      "Eb5/8 F5/8 C5/2.~", "C5/1", "C5/2 r/2", "r/2. A4/8 D5/8",
    ],
    note: "Hancock's floating sus chords, four bars each, straight eighths.",
  },
  {
    id: "saints",
    name: "When the Saints Go Marching In",
    key: { tonic: "F", mode: "major" },
    meter: 4,
    bars: ["F", "F", "F", "F", "F", "F", "C7", "C7", "F", "F7", "Bb", "Bbm", "F", "F C7", "F", "F"],
    form: [["A", 16]],
    style: "neworleans",
    tempo: 150,
    motif: "r/4 F4/4 A4/4 Bb4/4 | C5/1",
    // "Oh when the saints | go marching in | ..." (the pickups end the bar before)
    pickup: "r/4 F4/4 A4/4 Bb4/4",
    melody: [
      "C5/1",
      "r/4 F4/4 A4/4 Bb4/4",
      "C5/1",
      "r/4 F4/4 A4/4 Bb4/4",
      "C5/2 A4/2",
      "F4/2 A4/2",
      "G4/1",
      "r/4 A4/4 A4/4 G4/4",
      "F4/2. F4/4",
      "A4/4 C5/4 C5/4 Bb4/4",
      "Bb4/1",
      "r/4 F4/4 A4/4 Bb4/4",
      "C5/2 A4/2",
      "F4/2 G4/2",
      "F4/1",
      "r/4 F4/4 A4/4 Bb4/4",
    ],
    publicDomain: true,
    note: "Public-domain parade tune.",
  },
  {
    id: "canon",
    name: "Canon in D (progression)",
    key: { tonic: "D", mode: "major" },
    meter: 4,
    bars: ["D A", "Bm F#m", "G D", "G A", "D A", "Bm F#m", "G D", "G A"],
    form: [["Ground", 8]],
    style: "baroque",
    tempo: 84,
    // the violin's line: one half note per chord, each a tone of the chord under it
    motif: "F#5/2 E5/2 | D5/2 C#5/2",
    melody: ["F#5/2 E5/2", "D5/2 C#5/2", "B4/2 A4/2", "B4/2 C#5/2", "F#5/2 E5/2", "D5/2 C#5/2", "B4/2 A4/2", "B4/2 C#5/2"],
    publicDomain: true,
    note: "Pachelbel's ground bass and the violin's line, public domain.",
  },
  {
    id: "greensleeves",
    name: "Greensleeves",
    key: { tonic: "A", mode: "minor" },
    meter: 3,
    // harmonized to the melody: the verse, then the "Greensleeves was all my joy" chorus
    bars: ["Am", "C", "G", "Em", "Am", "Am", "E", "Am", "C", "G", "G", "Em", "Am", "E", "Am", "Am"],
    form: [["A", 8], ["B", 8]],
    style: "baroque",
    tempo: 104,
    motif: "C5/2 D5/4 | E5/4. F5/8 E5/4",
    pickup: "r/2 A4/4",
    melody: [
      "C5/2 D5/4",
      "E5/4. F5/8 E5/4",
      "D5/2 B4/4",
      "G4/4. A4/8 B4/4",
      "C5/2 A4/4",
      "A4/4. G#4/8 A4/4",
      "B4/2 G#4/4",
      "E4/2.",
      "G5/2.",
      "G5/4. F#5/8 E5/4",
      "D5/2 B4/4",
      "G4/4. A4/8 B4/4",
      "C5/4. B4/8 A4/4",
      "G#4/4. F#4/8 G#4/4",
      "A4/2.",
      "r/2 A4/4",
    ],
    publicDomain: true,
    note: "Traditional English tune in 3/4, public domain.",
  },
  {
    id: "ode-to-joy",
    name: "Ode to Joy",
    key: { tonic: "C", mode: "major" },
    meter: 4,
    bars: ["C", "G", "C", "C G", "C", "G", "C", "G C", "G", "G C", "G", "C G", "C", "G", "C", "G C"],
    form: [["A", 4], ["A", 4], ["B", 4], ["A", 4]],
    style: "baroque",
    tempo: 108,
    motif: "E5/4 E5/4 F5/4 G5/4 | G5/4 F5/4 E5/4 D5/4",
    melody: [
      "E5/4 E5/4 F5/4 G5/4",
      "G5/4 F5/4 E5/4 D5/4",
      "C5/4 C5/4 D5/4 E5/4",
      "E5/4. D5/8 D5/2",
      "E5/4 E5/4 F5/4 G5/4",
      "G5/4 F5/4 E5/4 D5/4",
      "C5/4 C5/4 D5/4 E5/4",
      "D5/4. C5/8 C5/2",
      "D5/4 D5/4 E5/4 C5/4",
      "D5/4 E5/8 F5/8 E5/4 C5/4",
      "D5/4 E5/8 F5/8 E5/4 D5/4",
      "C5/4 D5/4 G4/2",
      "E5/4 E5/4 F5/4 G5/4",
      "G5/4 F5/4 E5/4 D5/4",
      "C5/4 C5/4 D5/4 E5/4",
      "D5/4. C5/8 C5/2",
    ],
    publicDomain: true,
    note: "Beethoven's tune from the Ninth, public domain.",
  },
  {
    id: "jingle-bells",
    name: "Jingle Bells",
    key: { tonic: "C", mode: "major" },
    meter: 4,
    bars: ["C", "C", "C", "C", "F", "F C", "D9", "G7", "C", "C", "C", "C", "F", "F C", "G7", "C"],
    form: [["A", 8], ["A", 8]],
    style: "swing",
    tempo: 168,
    motif: "E5/4 E5/4 E5/2 | E5/4 E5/4 E5/2",
    melody: [
      "E5/4 E5/4 E5/2",
      "E5/4 E5/4 E5/2",
      "E5/4 G5/4 C5/4. D5/8",
      "E5/1",
      "F5/4 F5/4 F5/4. F5/8",
      "F5/4 E5/4 E5/4 E5/8 E5/8",
      "E5/4 D5/4 D5/4 E5/4",
      "D5/2 G5/2",
      "E5/4 E5/4 E5/2",
      "E5/4 E5/4 E5/2",
      "E5/4 G5/4 C5/4. D5/8",
      "E5/1",
      "F5/4 F5/4 F5/4. F5/8",
      "F5/4 E5/4 E5/4 E5/8 E5/8",
      "G5/4 G5/4 F5/4 D5/4",
      "C5/1",
    ],
    publicDomain: true,
    note: "James Lord Pierpont's sleigh song (1857), the chorus, public domain.",
  },
  {
    id: "twinkle",
    name: "Twinkle, Twinkle (Ah vous dirai-je)",
    key: { tonic: "C", mode: "major" },
    meter: 4,
    bars: ["C", "F C", "F C", "G C", "C G7", "C G", "C G7", "C G", "C", "F C", "F C", "G C"],
    form: [["A", 4], ["B", 4], ["A", 4]],
    style: "baroque",
    tempo: 100,
    motif: "C5/4 C5/4 G5/4 G5/4 | A5/4 A5/4 G5/2",
    melody: [
      "C5/4 C5/4 G5/4 G5/4",
      "A5/4 A5/4 G5/2",
      "F5/4 F5/4 E5/4 E5/4",
      "D5/4 D5/4 C5/2",
      "G5/4 G5/4 F5/4 F5/4",
      "E5/4 E5/4 D5/2",
      "G5/4 G5/4 F5/4 F5/4",
      "E5/4 E5/4 D5/2",
      "C5/4 C5/4 G5/4 G5/4",
      "A5/4 A5/4 G5/2",
      "F5/4 F5/4 E5/4 E5/4",
      "D5/4 D5/4 C5/2",
    ],
    publicDomain: true,
    note: "The French tune Mozart wrote his variations on, public domain.",
  },
  {
    id: "frere-jacques",
    name: "Frère Jacques",
    key: { tonic: "F", mode: "major" },
    meter: 4,
    // "ding, dang, dong": F C F under F C F
    bars: ["F", "F", "F", "F", "F", "F", "F C7 F F", "F C7 F F"],
    form: [["A", 8]],
    style: "baroque",
    tempo: 104,
    motif: "F4/4 G4/4 A4/4 F4/4 | F4/4 G4/4 A4/4 F4/4",
    melody: [
      "F4/4 G4/4 A4/4 F4/4",
      "F4/4 G4/4 A4/4 F4/4",
      "A4/4 Bb4/4 C5/2",
      "A4/4 Bb4/4 C5/2",
      "C5/8 D5/8 C5/8 Bb4/8 A4/4 F4/4",
      "C5/8 D5/8 C5/8 Bb4/8 A4/4 F4/4",
      "F4/4 C4/4 F4/2",
      "F4/4 C4/4 F4/2",
    ],
    publicDomain: true,
    note: "The round, public domain: the band's imitation turns it into a canon.",
  },
  {
    id: "amazing-grace",
    name: "Amazing Grace",
    key: { tonic: "G", mode: "major" },
    meter: 3,
    bars: ["G", "G7", "C", "G", "G", "Em D", "D", "D7", "G", "G7", "C", "G", "G", "Em D7", "G", "G"],
    form: [["A", 8], ["A", 8]],
    style: "neworleans",
    tempo: 76,
    motif: "G4/2 B4/8 G4/8 | B4/2 A4/4",
    pickup: "r/2 D4/4",
    melody: [
      "G4/2 B4/8 G4/8",
      "B4/2 A4/4",
      "G4/2 E4/4",
      "D4/2 D4/4",
      "G4/2 B4/8 G4/8",
      "B4/2 A4/4",
      "D5/2.",
      "D5/2 B4/4",
      "D5/2 B4/8 G4/8",
      "B4/2 A4/4",
      "G4/2 E4/4",
      "D4/2 D4/4",
      "G4/2 B4/8 G4/8",
      "B4/2 A4/4",
      "G4/2.",
      "G4/2 D4/4",
    ],
    publicDomain: true,
    note: "The hymn, played slow the New Orleans way, public domain.",
  },
  {
    id: "four-chords",
    name: "Four-Chord Song (I–V–vi–IV)",
    key: { tonic: "C", mode: "major" },
    meter: 4,
    bars: ["C", "G", "Am", "F", "C", "G", "Am", "F"],
    form: [["A", 8]],
    style: "pop",
    tempo: 104,
    note: "The progression under half the pop songs you know.",
  },
  {
    id: "doo-wop",
    name: "Doo-Wop Changes (I–vi–IV–V)",
    key: { tonic: "Bb", mode: "major" },
    meter: 4,
    bars: ["Bb", "Gm", "Eb", "F", "Bb", "Gm", "Eb", "F"],
    form: [["A", 8]],
    style: "pop",
    tempo: 92,
    note: "The 1950s ballad turnaround.",
  },
  {
    id: "dorian-vamp",
    name: "Two-Chord Dorian Vamp",
    key: { tonic: "Bb", mode: "minor" },
    meter: 4,
    bars: ["Bbm7", "Eb7", "Bbm7", "Eb7", "Bbm7", "Eb7", "Bbm7", "Eb7"],
    form: [["Vamp", 8]],
    style: "funk",
    tempo: 100,
    note: "i7–IV7 vamp for grooving.",
  },
  {
    id: "cantaloupe",
    name: "Cantaloupe Island",
    key: { tonic: "F", mode: "minor" },
    meter: 4,
    bars: ["Fm7", "Fm7", "Fm7", "Fm7", "Db7", "Db7", "Db7", "Db7", "Dm7", "Dm7", "Dm7", "Dm7", "Fm7", "Fm7", "Fm7", "Fm7"],
    form: [["A", 4], ["B", 4], ["C", 4], ["A", 4]],
    style: "funk",
    tempo: 110,
    motif: "r/2 Ab4/8 Bb4/8 Bb4/4~ | Bb4/4. Ab4/8 Bb4/8 C5/8 Eb4/8 F4/8",
    pickup: "r/2. F4/8 F4/8",
    melody: [
      "r/2 Ab4/8 Bb4/8 Bb4/4~", "Bb4/4. Ab4/8 Bb4/8 C5/8 Eb4/8 F4/8", "r/1", "r/2. F4/8 F4/8",
      "r/2 Ab4/8 Bb4/8 Bb4/4~", "Bb4/4. Ab4/8 Bb4/8 C5/8 Eb4/8 F4/8", "r/1", "r/2 C5/8 Eb5/8 C5/8 Eb5/8",
      "F5/4. F5/8~ F5/2", "r/2 C5/8 Eb5/8 C5/8 Eb5/8", "F5/4. F5/8~ F5/2", "r/1",
      "r/1", "r/1", "r/1", "r/2. F4/8 F4/8",
    ],
    note: "Hancock's 16-bar vamp: F minor, Db7, D minor, home.",
  },
  {
    id: "watermelon-man",
    name: "Watermelon Man",
    key: { tonic: "F", mode: "major" },
    meter: 4,
    bars: ["F7", "F7", "F7", "F7", "Bb7", "Bb7", "F7", "F7", "C7", "Bb7", "C7", "Bb7", "C7", "Bb7", "F7", "C7"],
    form: [["Blues", 16]],
    style: "funk",
    tempo: 116,
    motif: "Eb6/1~ | Eb6/4 F5/8 F5/8 C6/8 D6/4 F5/8~",
    melody: [
      "Eb6/1~", "Eb6/4 F5/8 F5/8 C6/8 D6/4 F5/8~", "F5/1~", "F5/2 r/2",
      "F6/1~", "F6/4 F5/8 F5/8 C6/8 D6/4 F5/8~", "F5/1~", "F5/2 r/2",
      "r/4 C6/8 C6/8 G6/4 A6/4", "Ab6/8 G6/8 F6/8 D6/8 F6/4 G6/4", "r/4 C6/8 C6/8 G6/4 A6/4", "Ab6/8 G6/8 F6/8 D6/8 C6/4 D6/4",
      "r/4 C6/8 C6/8 G6/4 Ab6/4", "F6/4 F5/8 F5/8 C6/8 D6/4 F5/8~", "F5/1", "r/1",
    ],
    note: "Hancock's 16-bar blues, with the V–IV rocking at the end.",
  },
];

export function getStandard(id: string | null): Standard | null {
  if (!id) return null;
  return STANDARDS.find((s) => s.id === id) ?? null;
}

/** Semitones from a standard's own key to the key it's played in (the nearer way round). */
export function standardShift(std: Standard, tonic: string): number {
  const semis = mod(pcOf(tonic) - pcOf(std.key.tonic), 12);
  return semis > 6 ? semis - 12 : semis;
}

const tuneOctave = new Map<string, number>();

/**
 * One bar of a standard's written melody (form bar `index`), in `tonic` and moved by whole
 * octaves so the tune as a whole sits around `center` and inside [lo, hi]. The octave is
 * decided once for the whole tune, so the melody never jumps register mid-phrase.
 */
export function tuneBar(std: Standard, index: number | "pickup", tonic: string, beats: number, center: number, [lo, hi]: [number, number], ties: { alone?: boolean; stop?: boolean } = {}): NoteEvent[] | null {
  const bar = index === "pickup" ? (std.pickup ? parseNotes(std.pickup, beats).notes : null) : melodyBar(std, index, beats, ties);
  if (!bar) return null;
  const semis = standardShift(std, tonic);
  const key = `${std.id}:${semis}:${center}:${lo}:${hi}`;
  let oct = tuneOctave.get(key);
  if (oct === undefined) {
    const all = (std.melody ?? []).flatMap((b) => parseNotes(b, beats).notes.map((n) => n.pitch + semis));
    const mean = all.reduce((sum, p) => sum + p, 0) / Math.max(1, all.length);
    oct = Math.round((center - mean) / 12) * 12;
    const min = Math.min(...all) + oct;
    const max = Math.max(...all) + oct;
    if (max > hi && min - 12 >= lo) oct -= 12;
    else if (min < lo && max + 12 <= hi) oct += 12;
    tuneOctave.set(key, oct);
  }
  return bar.map((n) => ({ ...n, pitch: n.pitch + semis + oct }));
}

const tiedOver = (bar: string | undefined) => !!bar && /~\s*$/.test(bar);

/**
 * Bar `index` of a standard's written melody, with the ties across its barlines played: a note
 * tied into the next bar holds on through it, and the bar it's tied into doesn't strike it again.
 * `stop`: the tune stops after this bar, so nothing holds over. `alone` plays the bar on its own,
 * as written (a tag going round on one bar). The last bar never ties into the first, so the head
 * can always start clean.
 */
export function melodyBar(std: Standard, index: number, beats: number, { alone = false, stop = false } = {}): NoteEvent[] | null {
  const melody = std.melody;
  if (!melody?.length) return null;
  const i = mod(index, melody.length);
  const notes = parseNotes(melody[i], beats).notes;
  if (alone) return notes;
  if (i > 0 && tiedOver(melody[i - 1])) {
    const prev = parseNotes(melody[i - 1], beats).notes.at(-1);
    if (prev && notes[0] && notes[0].start < 1e-6 && notes[0].pitch === prev.pitch) notes.shift();
  }
  const last = notes.at(-1);
  if (last && !stop && tiedOver(melody[i]) && Math.abs(last.start + last.dur - beats) < 1e-6) {
    for (let j = i + 1; j < melody.length; j++) {
      const next = parseNotes(melody[j], beats).notes[0];
      if (!next || next.start > 1e-6 || next.pitch !== last.pitch) break;
      last.dur += next.dur;
      if (next.dur < beats - 1e-6 || !tiedOver(melody[j])) break;
    }
  }
  return notes;
}

/** Where a standard's pickup starts in its bar (beats), or null when it has none. */
export function pickupStart(std: Standard, beats: number): number | null {
  if (!std.pickup) return null;
  const first = parseNotes(std.pickup, beats).notes[0];
  return first ? first.start : null;
}

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Everything a tune can be found by: its name, its note, its key, its feel and its meter. */
function haystack(std: Standard): string {
  const meter = std.meter === 3 ? "3/4 waltz" : "4/4";
  const feel = std.style === "neworleans" ? "new orleans" : std.style;
  return fold(`${std.name} ${std.note} ${std.key.tonic} ${std.key.mode} ${feel} ${meter} ${std.form.length === 1 && std.form[0][0] === "Blues" ? "blues" : ""}`);
}

/**
 * The tunes matching a typed query, in list order: every word has to turn up somewhere
 * (accents and case ignored), so "bossa minor" or "blues bb" narrow it down.
 */
export function searchStandards(query: string, list: Standard[] = STANDARDS): Standard[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return list;
  return list.filter((std) => {
    const hay = haystack(std);
    return words.every((w) => hay.includes(w));
  });
}
