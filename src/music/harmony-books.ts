import type { Rng } from "./rng";
import type { StyleId } from "./types";

// The changes for a chart without a standard, built the way tunes are: out of four-bar phrases,
// each an opening, a sequence or a cadence from the style's book, laid out as a form (a question
// and its answer, a sentence, or a loop). The book holds what the style says, two bars at a time
// (after jev-playground's harmony books), plus whole four-bar phrases modelled on real tunes.
// Bars are roman numerals in the key ("ii7 V7" is two chords in a bar); romanToChord spells them.
// A free chart used to pick one of two fixed eight-bar progressions; now every take has its own.

export type BookId =
  | StyleId
  | "romantic"
  | "impressionist"
  | "film"
  | "jazzpop"
  | "gospel"
  | "evans"
  | "monk"
  | "modal"
  | "headhunters"
  | "guaraldi"
  | "soul"
  | "royal"
  | "waltz"
  | "frahm"
  | "einaudi"
  | "satie"
  | "afro"
  | "son";
export type PhraseEnd = "open" | "half" | "closed";

type Pair = readonly [string, string];
type Phrase = readonly [string, string, string, string];

export interface HarmonyBook {
  /** Two-bar openings, on or around the tonic. */
  heads: readonly Pair[];
  /** Two-bar travelling units: sequences, turnarounds, side-steps. */
  seqs: readonly Pair[];
  /** Two-bar phrase endings: one that lands home, one that stops on the dominant, one that runs on. */
  tails: Record<PhraseEnd, readonly Pair[]>;
  /** Whole four-bar phrases modelled on real tunes. */
  phrases: Record<PhraseEnd, readonly Phrase[]>;
  /** Chord cycles for a loop-built tune (a vamp, an ostinato piece). */
  loops: readonly (readonly string[])[];
  /** Four-bar closing phrases. */
  codas: readonly Phrase[];
}

/** How a book likes its eight bars laid out. */
export interface BookForms {
  period: number;
  sentence: number;
  loop: number;
}

export interface BookDef {
  name: string;
  forms: BookForms;
  /** The harmony moves slower than the bar: four chords, each held two bars. */
  holds?: true;
  major: HarmonyBook;
  minor: HarmonyBook;
}

export const HARMONY_BOOKS: Record<BookId, BookDef> = {
  swing: {
    name: "Swing",
    forms: { period: 3, sentence: 2, loop: 0 },
    major: {
      heads: [["Imaj7", "vi7"], ["Imaj7", "I7"], ["Imaj7", "IV7"], ["iii7", "VI7"], ["Imaj7", "#idim7"], ["I6", "II7"]],
      seqs: [["ii7", "V7"], ["iii7 VI7", "ii7 V7"], ["IVmaj7", "#ivdim7"], ["iv7", "bVII7"], ["ii7", "bII7"], ["iii7", "biii7"], ["vi7", "II7"]],
      tails: {
        closed: [["ii7 V7", "Imaj7"], ["iv7 bVII7", "Imaj7"], ["ii7 bII7", "Imaj7"], ["iii7 VI7", "I6"]],
        half: [["ii7", "V7"], ["iii7 VI7", "ii7 V7"], ["IVmaj7", "V7"], ["vi7 II7", "ii7 V7"]],
        open: [["IVmaj7", "iv7"], ["iii7", "VI7"], ["I7", "IVmaj7"], ["II7", "II7"]],
      },
      phrases: {
        closed: [["iii7", "VI7", "ii7 V7", "Imaj7"], ["IVmaj7", "iv7", "ii7 V7", "I6"], ["ii7", "V7", "ii7 V7", "Imaj7"]],
        half: [["Imaj7", "vi7", "ii7", "V7"], ["Imaj7", "IV7", "iii7 VI7", "ii7 V7"], ["Imaj7", "II7", "ii7", "V7"]],
        open: [["Imaj7", "I7", "IVmaj7", "iv7"], ["I6", "#idim7", "ii7", "#iidim7"]],
      },
      loops: [],
      codas: [["ii7 V7", "iii7 VI7", "ii7 V7", "Imaj7"], ["IVmaj7", "#ivdim7", "ii7 V7", "I6"]],
    },
    minor: {
      heads: [["i7", "iv7"], ["i7", "i6"], ["i7", "VI7"], ["i7", "ii7b5 V7"], ["i6", "i7"]],
      seqs: [["ii7b5", "V7"], ["iv7", "bVII7"], ["bVImaj7", "ii7b5"], ["iv7", "bVI7"], ["bIIImaj7", "bVImaj7"]],
      tails: {
        closed: [["ii7b5 V7", "i7"], ["bVI7 V7", "i6"], ["iv7 V7", "i7"]],
        half: [["ii7b5", "V7"], ["bVI7", "V7"], ["iv7", "V7"]],
        open: [["iv7", "bVII7"], ["bVImaj7", "bVI7"], ["i7", "VI7"]],
      },
      phrases: {
        closed: [["iv7", "bVII7", "bIIImaj7", "bVImaj7"], ["i7", "iv7", "ii7b5 V7", "i6"]],
        half: [["i7", "iv7", "ii7b5", "V7"], ["i7", "i7", "bVI7", "V7"]],
        open: [["i7", "i7", "iv7", "iv7"], ["i7", "VI7", "iv7", "bVII7"]],
      },
      loops: [],
      codas: [["ii7b5 V7", "i7 VI7", "ii7b5 V7", "i6"]],
    },
  },
  bossa: {
    name: "Bossa",
    forms: { period: 3, sentence: 2, loop: 0 },
    major: {
      heads: [["Imaj7", "Imaj7"], ["Imaj7", "II7"], ["Imaj7", "vi7"], ["Imaj7", "bIImaj7"], ["Imaj7", "IVmaj7"]],
      seqs: [["ii7", "bII7"], ["iii7", "VI7"], ["IVmaj7", "iv6"], ["ii7", "V7"], ["II7", "II7"], ["iii7", "biii7"]],
      tails: {
        closed: [["ii7 V7", "Imaj7"], ["ii7 bII7", "Imaj7"], ["iv6 bVII7", "Imaj7"]],
        half: [["ii7", "V7"], ["II7", "ii7 V7"], ["IVmaj7", "bII7"]],
        open: [["IVmaj7", "iv6"], ["iii7", "VI7"], ["bVIImaj7", "bVIImaj7"]],
      },
      phrases: {
        closed: [["IVmaj7", "iv6", "iii7 VI7", "Imaj7"], ["ii7", "bII7", "Imaj7", "Imaj7"]],
        half: [["Imaj7", "Imaj7", "II7", "II7"], ["Imaj7", "vi7", "ii7", "V7"]],
        open: [["Imaj7", "bIImaj7", "Imaj7", "bIImaj7"], ["Imaj7", "IVmaj7", "iii7", "VI7"]],
      },
      loops: [],
      codas: [["ii7", "bII7", "Imaj7", "Imaj7"]],
    },
    minor: {
      heads: [["i7", "i7"], ["i7", "iv7"], ["i7", "bVII7"], ["i6", "i7"]],
      seqs: [["iv7", "bVII7"], ["bIIImaj7", "bVImaj7"], ["ii7b5", "V7"], ["bVI7", "bII7"]],
      tails: {
        closed: [["ii7b5 V7", "i7"], ["bVI7 V7", "i7"], ["bII7", "i7"]],
        half: [["ii7b5", "V7"], ["bVImaj7", "V7"]],
        open: [["iv7", "bVII7"], ["bIIImaj7", "bVImaj7"]],
      },
      phrases: {
        closed: [["i7", "i7", "iv7", "iv7"], ["bVImaj7", "ii7b5", "V7", "i7"]],
        half: [["i7", "iv7", "ii7b5", "V7"], ["i7", "bVII7", "bVImaj7", "V7"]],
        open: [["i7", "iv7", "bVII7", "bIIImaj7"]],
      },
      loops: [],
      codas: [["ii7b5", "V7", "i7", "i7"]],
    },
  },
  funk: {
    name: "Funk",
    forms: { period: 1, sentence: 1, loop: 3 },
    major: {
      heads: [["I7", "I7"], ["I7", "IV7"], ["I9", "I9"], ["I7", "bVII7"]],
      seqs: [["IV7", "IV7"], ["bVII7", "IV7"], ["bIII7", "IV7"], ["IV9", "bVII9"]],
      tails: {
        closed: [["IV7", "I7"], ["bVII7", "I7"], ["V7", "I7"]],
        half: [["IV7", "V7"], ["bVI7", "V7"]],
        open: [["IV7", "IV7"], ["bVII7", "bVII7"]],
      },
      phrases: {
        closed: [["I7", "I7", "IV7", "I7"], ["IV7", "IV7", "bVII7", "I7"]],
        half: [["I7", "bVII7", "IV7", "V7"]],
        open: [["I7", "I7", "I7", "IV7"]],
      },
      loops: [["I7", "IV7"], ["I9", "I9", "bVII9", "IV9"], ["I7", "I7", "bIII7", "IV7"], ["I7"]],
      codas: [["IV7", "bVII7", "I7", "I7"]],
    },
    minor: {
      heads: [["i7", "i7"], ["i7", "IV7"], ["i9", "bVII7"], ["i7", "iv7"]],
      seqs: [["IV7", "IV7"], ["bVI7", "bVII7"], ["iv7", "bVII7"], ["bIIImaj7", "IV7"]],
      tails: {
        closed: [["IV7", "i7"], ["bVII7", "i7"], ["bVI7 V7", "i7"]],
        half: [["bVI7", "V7"], ["iv7", "V7"]],
        open: [["IV7", "IV7"], ["bVII7", "IV7"]],
      },
      phrases: {
        closed: [["i7", "i7", "IV7", "i7"], ["i7", "bVII7", "IV7", "i7"]],
        half: [["i7", "i7", "bVI7", "V7"]],
        open: [["i7", "IV7", "i7", "IV7"]],
      },
      loops: [["i7", "IV7"], ["i9", "i9", "bVII7", "IV7"], ["i7", "i7", "bVI7", "bVII7"], ["i7"]],
      codas: [["bVI7", "bVII7", "i7", "i7"]],
    },
  },
  pop: {
    name: "Pop",
    forms: { period: 2, sentence: 2, loop: 1 },
    major: {
      heads: [["I", "IV"], ["I", "iii"], ["I", "Iadd9"], ["vi", "IV"], ["I", "IVadd9"]],
      seqs: [["IV", "V"], ["ii", "IV"], ["vi", "V"], ["IV", "iii"], ["bVII", "IV"], ["ii7", "Vsus"]],
      tails: {
        closed: [["IV", "I"], ["Vsus", "I"], ["iv", "I"], ["bVII", "I"]],
        half: [["IV", "V"], ["ii", "Vsus"], ["vi", "V"]],
        open: [["IV", "IV"], ["vi", "IV"], ["ii", "IV"]],
      },
      phrases: {
        closed: [["IV", "V", "iii", "vi"], ["ii", "IV", "Vsus", "I"], ["vi", "IV", "Vsus", "I"]],
        half: [["I", "iii", "IV", "V"], ["I", "IV", "ii", "V"]],
        open: [["I", "Iadd9", "IV", "IV"], ["IV", "I", "ii", "IV"]],
      },
      loops: [["I", "IV", "vi", "V"], ["I", "iii", "IV", "IV"], ["vi", "IV", "I", "iii"], ["I", "bVII", "IV", "I"]],
      codas: [["IV", "iv", "I", "I"], ["ii", "IV", "Vsus", "I"]],
    },
    minor: {
      heads: [["i", "VI"], ["i", "iv"], ["i", "VII"], ["i", "v"]],
      seqs: [["VI", "VII"], ["iv", "VI"], ["VI", "III"], ["iv", "v"]],
      tails: {
        closed: [["VII", "i"], ["iv", "i"], ["V", "i"]],
        half: [["VI", "V"], ["iv", "V"]],
        open: [["VI", "VII"], ["iv", "VI"]],
      },
      phrases: {
        closed: [["VI", "VII", "V", "i"], ["iv", "VI", "VII", "i"]],
        half: [["i", "VI", "iv", "V"], ["i", "VII", "VI", "V"]],
        open: [["i", "i", "VI", "VI"], ["i", "iv", "VI", "VII"]],
      },
      loops: [["i", "VI", "iv", "V"], ["i", "VII", "VI", "VII"], ["i", "iv", "i", "VI"]],
      codas: [["iv", "VI", "V", "i"]],
    },
  },
  neworleans: {
    name: "New Orleans",
    forms: { period: 3, sentence: 1, loop: 0 },
    major: {
      heads: [["I", "I"], ["I", "I7"], ["I", "VI7"], ["I", "#idim7"]],
      seqs: [["II7", "V7"], ["IV", "iv"], ["VI7", "II7"], ["IV", "#ivdim7"], ["III7", "VI7"]],
      tails: {
        closed: [["V7", "I"], ["II7 V7", "I"], ["IV #ivdim7", "I"]],
        half: [["II7", "V7"], ["VI7", "V7"], ["IV", "V7"]],
        open: [["IV", "iv"], ["I7", "IV"], ["III7", "VI7"]],
      },
      phrases: {
        closed: [["I", "V7", "V7", "I"], ["IV", "iv", "I V7", "I"]],
        half: [["I", "I", "I", "V7"], ["I", "VI7", "II7", "V7"]],
        open: [["I", "I7", "IV", "iv"]],
      },
      loops: [],
      codas: [["II7", "V7", "I", "I"]],
    },
    minor: {
      heads: [["i", "i"], ["i", "iv"], ["i", "V7"]],
      seqs: [["iv", "V7"], ["VI7", "V7"], ["iv", "i"]],
      tails: {
        closed: [["V7", "i"], ["iv V7", "i"]],
        half: [["iv", "V7"], ["VI7", "V7"]],
        open: [["iv", "iv"], ["i", "iv"]],
      },
      phrases: {
        closed: [["i", "iv", "V7", "i"]],
        half: [["i", "i", "iv", "V7"]],
        open: [["i", "iv", "i", "iv"]],
      },
      loops: [],
      codas: [["iv", "V7", "i", "i"]],
    },
  },
  minimal: {
    name: "Minimalist",
    forms: { period: 1, sentence: 1, loop: 3 },
    holds: true,
    major: {
      heads: [["I", "I"], ["I", "IV"], ["Imaj7", "IVmaj7"], ["vi", "vi"]],
      seqs: [["IV", "IV"], ["vi", "IV"], ["IVmaj7", "V"], ["iii", "vi"]],
      tails: {
        closed: [["IV", "I"], ["V", "I"]],
        half: [["IV", "V"], ["vi", "V"]],
        open: [["IV", "IV"], ["vi", "vi"]],
      },
      phrases: {
        closed: [["I", "I", "IV", "I"], ["vi", "vi", "IV", "I"]],
        half: [["I", "I", "IV", "V"]],
        open: [["I", "I", "vi", "vi"], ["Imaj7", "Imaj7", "IVmaj7", "IVmaj7"]],
      },
      loops: [["I", "I", "vi", "vi"], ["Imaj7", "IVmaj7"], ["vi", "IV", "I", "I"], ["I", "IV", "I", "V"]],
      codas: [["IV", "IV", "I", "I"]],
    },
    minor: {
      heads: [["i", "i"], ["i", "VI"], ["i", "iv"]],
      seqs: [["VI", "VI"], ["III", "VII"], ["iv", "VI"], ["VI", "VII"]],
      tails: {
        closed: [["VI", "i"], ["VII", "i"]],
        half: [["VI", "V"], ["iv", "V"]],
        open: [["VI", "VI"], ["III", "III"]],
      },
      phrases: {
        closed: [["i", "i", "VI", "i"]],
        half: [["i", "i", "iv", "V"]],
        open: [["i", "i", "VI", "VI"], ["i", "VI", "III", "VII"]],
      },
      loops: [["i", "i", "VI", "VI"], ["i", "VI", "III", "VII"], ["i", "iv"], ["i", "VI", "iv", "V"]],
      codas: [["VI", "VI", "i", "i"]],
    },
  },
  baroque: {
    name: "Baroque",
    forms: { period: 3, sentence: 2, loop: 0 },
    major: {
      heads: [["I", "V"], ["I", "IV"], ["I", "vi"], ["I", "V7"]],
      seqs: [["vi", "iii"], ["IV", "I"], ["ii", "V"], ["vi", "ii"], ["iii", "vi"], ["V7", "I"]],
      tails: {
        closed: [["ii V7", "I"], ["IV V7", "I"], ["vi ii", "V7 I"]],
        half: [["ii", "V"], ["IV", "V"], ["vi", "V"]],
        open: [["IV", "ii"], ["vi", "iii"]],
      },
      phrases: {
        closed: [["I", "IV", "V7", "I"], ["vi", "ii", "V7", "I"], ["IV", "ii", "V7", "I"]],
        half: [["I", "vi", "ii", "V"], ["I", "IV", "I", "V"]],
        open: [["I", "V", "vi", "iii"], ["IV", "I", "IV", "V"]],
      },
      loops: [],
      codas: [["IV", "V7", "I", "I"], ["ii", "V7", "vi", "IV V7"]],
    },
    minor: {
      heads: [["i", "V"], ["i", "iv"], ["i", "V7"], ["i", "VI"]],
      seqs: [["iv", "VII"], ["III", "VI"], ["ii7b5", "V7"], ["VI", "iv"], ["VII7", "III"]],
      tails: {
        closed: [["iv V7", "i"], ["ii7b5 V7", "i"], ["VI V7", "i"]],
        half: [["iv", "V"], ["VI", "V"], ["ii7b5", "V7"]],
        open: [["iv", "VII"], ["VI", "iv"]],
      },
      phrases: {
        closed: [["i", "iv", "V7", "i"], ["VI", "ii7b5", "V7", "i"]],
        half: [["i", "VI", "iv", "V"], ["i", "V7", "i", "V"]],
        open: [["i", "iv", "VII", "III"]],
      },
      loops: [],
      codas: [["iv", "V7", "i", "i"]],
    },
  },
  ambient: {
    name: "Ambient",
    forms: { period: 1, sentence: 1, loop: 2 },
    holds: true,
    major: {
      heads: [["Imaj7", "Imaj7"], ["Isus", "Isus"], ["Imaj7", "IVmaj7"], ["vi9", "vi9"]],
      seqs: [["IVmaj7", "IVmaj7"], ["bVIImaj7", "bVIImaj7"], ["vi9", "IVmaj7"], ["iii7", "IVmaj7"]],
      tails: {
        closed: [["IVmaj7", "Imaj7"], ["Vsus", "Imaj7"], ["bVIImaj7", "Isus"]],
        half: [["IVmaj7", "Vsus"], ["vi9", "Vsus"]],
        open: [["IVmaj7", "IVmaj7"], ["vi9", "vi9"]],
      },
      phrases: {
        closed: [["Imaj7", "Imaj7", "IVmaj7", "Imaj7"], ["vi9", "IVmaj7", "Vsus", "Imaj7"]],
        half: [["Imaj7", "IVmaj7", "vi9", "Vsus"]],
        open: [["Isus", "Isus", "bVIImaj7", "bVIImaj7"]],
      },
      loops: [["Imaj7", "IVmaj7"], ["Isus", "bVIImaj7"], ["vi9", "IVmaj7", "Imaj7", "Imaj7"]],
      codas: [["IVmaj7", "IVmaj7", "Imaj7", "Imaj7"]],
    },
    minor: {
      heads: [["i9", "i9"], ["i9", "bVImaj7"], ["i9", "iv9"]],
      seqs: [["bVImaj7", "bVImaj7"], ["bIIImaj7", "bVIImaj7"], ["iv9", "bVImaj7"]],
      tails: {
        closed: [["bVImaj7", "i9"], ["bVIImaj7", "i9"]],
        half: [["bVImaj7", "Vsus"], ["iv9", "Vsus"]],
        open: [["bVImaj7", "bVIImaj7"], ["bIIImaj7", "bIIImaj7"]],
      },
      phrases: {
        closed: [["i9", "bVImaj7", "bVIImaj7", "i9"]],
        half: [["i9", "i9", "iv9", "Vsus"]],
        open: [["i9", "i9", "bIIImaj7", "bIIImaj7"]],
      },
      loops: [["i9", "bVImaj7"], ["i9", "i9", "bIIImaj7", "bVIImaj7"]],
      codas: [["bVImaj7", "bVImaj7", "i9", "i9"]],
    },
  },
  // Post-rock: add9 triads a guitarist rings open, a chord a bar, mostly loops; the iii and vi
  // that colour a tonic pedal, IV to I instead of V to I, and the borrowed iv for the ache.
  postrock: {
    name: "Post-rock",
    forms: { period: 1, sentence: 2, loop: 4 },
    major: {
      heads: [["Iadd9", "Iadd9"], ["Iadd9", "iii7"], ["Iadd9", "IVadd9"], ["vi7", "IVadd9"]],
      seqs: [["IVadd9", "IVadd9"], ["vi7", "IVadd9"], ["iii7", "IVadd9"], ["IVadd9", "vi7"], ["ii7", "IVadd9"]],
      tails: {
        closed: [["IVadd9", "Iadd9"], ["Vsus", "Iadd9"], ["IVmaj7", "Iadd9"]],
        half: [["IVadd9", "Vsus"], ["vi7", "Vsus"]],
        open: [["IVadd9", "IVadd9"], ["vi7", "vi7"], ["IVadd9", "iv"]],
      },
      phrases: {
        closed: [["Iadd9", "iii7", "IVadd9", "Iadd9"], ["vi7", "IVadd9", "Vsus", "Iadd9"]],
        half: [["Iadd9", "iii7", "IVadd9", "Vsus"]],
        open: [["Iadd9", "Iadd9", "IVadd9", "IVadd9"], ["Iadd9", "vi7", "IVadd9", "IVadd9"]],
      },
      loops: [["Iadd9", "iii7", "IVadd9", "IVadd9"], ["vi7", "IVadd9", "Iadd9", "Iadd9"], ["Iadd9", "IVadd9"], ["Iadd9", "Iadd9", "vi7", "IVadd9"]],
      codas: [["IVadd9", "IVadd9", "Iadd9", "Iadd9"], ["vi7", "IVadd9", "Iadd9", "Iadd9"]],
    },
    minor: {
      heads: [["iadd9", "iadd9"], ["iadd9", "VIadd9"], ["iadd9", "IIIadd9"], ["iadd9", "iv7"]],
      seqs: [["VIadd9", "VIadd9"], ["VIadd9", "IIIadd9"], ["IIIadd9", "VII"], ["iv7", "VIadd9"]],
      tails: {
        closed: [["VIadd9", "iadd9"], ["VII", "iadd9"], ["iv7", "iadd9"]],
        half: [["VIadd9", "VII"], ["iv7", "Vsus"]],
        open: [["VIadd9", "VIadd9"], ["IIIadd9", "VII"]],
      },
      phrases: {
        closed: [["iadd9", "VIadd9", "VII", "iadd9"]],
        half: [["iadd9", "VIadd9", "iv7", "Vsus"]],
        open: [["iadd9", "VIadd9", "IIIadd9", "VII"], ["iadd9", "iadd9", "VIadd9", "VIadd9"]],
      },
      loops: [["iadd9", "VIadd9", "IIIadd9", "VII"], ["iadd9", "VIadd9"], ["VIadd9", "IIIadd9", "VII", "iadd9"]],
      codas: [["VIadd9", "VII", "iadd9", "iadd9"]],
    },
  },
  // ── the artists' books ──
  romantic: {
    name: "Romantic",
    forms: { period: 3, sentence: 2, loop: 0 },
    major: {
      heads: [["I", "vi"], ["I", "I7"], ["I", "iii"], ["I", "#ivdim7"]],
      seqs: [["IV", "iv"], ["ii", "V7"], ["VI7", "ii"], ["vi", "III7"], ["bVI", "bII"]],
      tails: {
        closed: [["iv V7", "I"], ["ii V7", "I"], ["bII V7", "I"]],
        half: [["iv", "V7"], ["ii", "V7"], ["bVI", "V7"]],
        open: [["IV", "iv"], ["vi", "III7"]],
      },
      phrases: {
        closed: [["I", "IV", "iv", "I"], ["vi", "ii", "V7", "I"]],
        half: [["I", "vi", "IV", "V7"], ["I", "I7", "IV", "V7"]],
        open: [["I", "iii", "vi", "III7"]],
      },
      loops: [],
      codas: [["IV", "iv", "I", "I"]],
    },
    minor: {
      heads: [["i", "iv"], ["i", "V7"], ["i", "VI"], ["i", "bII"]],
      seqs: [["iv", "VII7"], ["III", "VI"], ["bII", "V7"], ["VI", "ii7b5"], ["iv", "V7"]],
      tails: {
        closed: [["bII V7", "i"], ["ii7b5 V7", "i"], ["iv V7", "i"]],
        half: [["VI", "V7"], ["bII", "V7"], ["iv", "V7"]],
        open: [["iv", "VII7"], ["VI", "III"]],
      },
      phrases: {
        closed: [["i", "iv", "V7", "i"], ["VI", "bII", "V7", "i"], ["iv", "VII7", "III", "VI ii7b5 V7"]],
        half: [["i", "VI", "iv", "V7"], ["i", "bII", "i", "V7"]],
        open: [["i", "iv", "VII7", "III"]],
      },
      loops: [],
      codas: [["iv", "V7", "i", "i"], ["bII", "V7", "i", "i"]],
    },
  },
  impressionist: {
    name: "Impressionist",
    forms: { period: 2, sentence: 2, loop: 1 },
    major: {
      heads: [["Imaj7", "IImaj7"], ["Imaj9", "bVIImaj7"], ["Imaj7", "bIIImaj7"], ["Iadd9", "IVadd9"]],
      seqs: [["bVImaj7", "bVIImaj7"], ["IImaj7", "IIImaj7"], ["IVmaj7", "#ivm7b5"], ["bIIImaj7", "bVImaj7"], ["iii9", "vi9"]],
      tails: {
        closed: [["bVIImaj7", "Imaj7"], ["IVmaj7", "Imaj9"], ["bVImaj7", "Imaj7"]],
        half: [["IVmaj7", "Vsus"], ["bVImaj7", "Vsus"]],
        open: [["IImaj7", "IImaj7"], ["bIIImaj7", "bIIImaj7"]],
      },
      phrases: {
        closed: [["Imaj7", "IImaj7", "bVIImaj7", "Imaj7"], ["IVmaj7", "bVImaj7", "bVIImaj7", "Imaj9"]],
        half: [["Imaj7", "bIIImaj7", "IVmaj7", "Vsus"]],
        open: [["Imaj7", "IImaj7", "IIImaj7", "IImaj7"]],
      },
      loops: [["Imaj7", "IImaj7"], ["Imaj9", "bVIImaj7", "IVmaj7", "IVmaj7"]],
      codas: [["IVmaj7", "IVmaj7", "Imaj9", "Imaj9"]],
    },
    minor: {
      heads: [["i9", "IV9"], ["i9", "bVImaj7"], ["i7", "bIImaj7"]],
      seqs: [["bVImaj7", "bVIImaj7"], ["IV9", "IV9"], ["bIIImaj7", "bIImaj7"], ["iv9", "bVII9"]],
      tails: {
        closed: [["bVIImaj7", "i9"], ["bIImaj7", "i9"], ["iv9", "i9"]],
        half: [["bVImaj7", "Vsus"], ["iv9", "Vsus"]],
        open: [["IV9", "IV9"], ["bVImaj7", "bVImaj7"]],
      },
      phrases: {
        closed: [["i9", "IV9", "bVIImaj7", "i9"]],
        half: [["i9", "bVImaj7", "iv9", "Vsus"]],
        open: [["i9", "i9", "IV9", "IV9"]],
      },
      loops: [["i9", "IV9"], ["i9", "bVImaj7", "bIIImaj7", "bVIImaj7"]],
      codas: [["bVImaj7", "bIImaj7", "i9", "i9"]],
    },
  },
  film: {
    name: "Film",
    forms: { period: 1, sentence: 2, loop: 3 },
    major: {
      heads: [["I", "I"], ["I", "IV"], ["I", "V"], ["I", "Iadd9"]],
      seqs: [["IV", "V"], ["vi", "V"], ["IV", "bVII"], ["bVI", "bVII"]],
      tails: {
        closed: [["IV", "I"], ["bVII", "I"], ["bVI bVII", "I"]],
        half: [["IV", "V"], ["bVI", "Vsus"]],
        open: [["IV", "IV"], ["bVI", "bVII"]],
      },
      phrases: {
        closed: [["I", "IV", "bVII", "I"], ["vi", "IV", "Vsus", "I"]],
        half: [["I", "I", "IV", "V"]],
        open: [["I", "I", "IV", "IV"], ["I", "bVI", "bVII", "bVII"]],
      },
      loops: [["I", "V", "I", "IV"], ["I", "bVI", "bVII", "I"], ["I", "IV"]],
      codas: [["bVI", "bVII", "I", "I"]],
    },
    minor: {
      heads: [["i", "i"], ["i", "VI"], ["i", "iv"], ["i", "VII"]],
      seqs: [["VI", "VII"], ["iv", "V"], ["VI", "iv"], ["VII", "V"]],
      tails: {
        closed: [["V", "i"], ["VII", "i"], ["iv", "i"]],
        half: [["VI", "V"], ["iv", "V"], ["VII", "V"]],
        open: [["VI", "VII"], ["iv", "VI"]],
      },
      phrases: {
        closed: [["i", "VI", "VII", "i"], ["i", "iv", "V", "i"]],
        half: [["i", "VI", "VII", "V"], ["i", "iv", "VI", "V"]],
        open: [["i", "i", "VI", "VI"]],
      },
      loops: [["i", "VI", "VII", "V"], ["i", "iv", "VI", "V"], ["i", "VI"], ["i", "i", "VI", "VI"]],
      codas: [["VI", "V", "i", "i"]],
    },
  },
  jazzpop: {
    name: "Jazz-pop",
    forms: { period: 3, sentence: 2, loop: 0 },
    major: {
      heads: [["Imaj7", "iii7"], ["Imaj7", "I7"], ["Imaj7", "vi7"], ["IVmaj7", "iii7"]],
      seqs: [["IVmaj7", "iv6"], ["ii7", "V7"], ["iii7", "VI7"], ["vi7", "II7"], ["IVmaj7", "#ivdim7"]],
      tails: {
        closed: [["ii7 V7", "Imaj7"], ["iv6", "Imaj7"], ["IVmaj7 iv6", "Imaj7"]],
        half: [["ii7", "V7"], ["vi7 II7", "ii7 V7"]],
        open: [["IVmaj7", "iv6"], ["iii7", "VI7"]],
      },
      phrases: {
        closed: [["IVmaj7", "iv6", "iii7 VI7", "Imaj7"], ["vi7", "II7", "ii7 V7", "Imaj7"]],
        half: [["Imaj7", "iii7", "IVmaj7", "V7"], ["Imaj7", "I7", "IVmaj7", "V7"]],
        open: [["Imaj7", "iii7", "vi7", "II7"]],
      },
      loops: [],
      codas: [["IVmaj7", "iv6", "Imaj7", "Imaj7"]],
    },
    minor: {
      heads: [["i7", "i6"], ["i7", "iv7"], ["i7", "bVImaj7"]],
      seqs: [["iv7", "bVII7"], ["bVImaj7", "ii7b5"], ["bIIImaj7", "bVImaj7"]],
      tails: {
        closed: [["ii7b5 V7", "i7"], ["iv7", "i6"]],
        half: [["ii7b5", "V7"], ["bVImaj7", "V7"]],
        open: [["iv7", "bVII7"], ["bIIImaj7", "bVImaj7"]],
      },
      phrases: {
        closed: [["iv7", "bVII7", "bIIImaj7", "i6"]],
        half: [["i7", "iv7", "ii7b5", "V7"]],
        open: [["i7", "i6", "bVImaj7", "bVImaj7"]],
      },
      loops: [],
      codas: [["ii7b5", "V7", "i6", "i6"]],
    },
  },
  gospel: {
    name: "Gospel",
    forms: { period: 3, sentence: 2, loop: 0 },
    major: {
      heads: [["I", "I7"], ["I", "iii7"], ["I", "VI7"], ["I", "#idim7"]],
      seqs: [["IV", "#ivdim7"], ["iii7", "VI7"], ["ii7", "V7"], ["IV", "iv"], ["vi7", "II7"]],
      tails: {
        closed: [["IV #ivdim7", "I"], ["iv", "I"], ["ii7 V7", "I"]],
        half: [["ii7", "V7"], ["IV", "Vsus"], ["II7", "V7"]],
        open: [["IV", "iv"], ["iii7", "VI7"]],
      },
      phrases: {
        closed: [["I", "I7", "IV", "#ivdim7"], ["IV", "iv", "iii7 VI7", "I"]],
        half: [["I", "VI7", "ii7", "V7"], ["I", "iii7", "IV", "Vsus"]],
        open: [["I", "I7", "IV", "iv"]],
      },
      loops: [],
      codas: [["IV", "iv", "I", "I"], ["ii7", "V7", "I", "I"]],
    },
    minor: {
      heads: [["i", "iv7"], ["i", "VI7"], ["i7", "i7"]],
      seqs: [["iv7", "V7"], ["VI7", "V7"], ["iv7", "bVII7"]],
      tails: {
        closed: [["iv7 V7", "i"], ["VI7 V7", "i"]],
        half: [["iv7", "V7"], ["VI7", "V7"]],
        open: [["iv7", "bVII7"], ["VI7", "VI7"]],
      },
      phrases: {
        closed: [["i", "iv7", "V7", "i"]],
        half: [["i", "VI7", "iv7", "V7"]],
        open: [["i", "iv7", "i", "iv7"]],
      },
      loops: [],
      codas: [["iv7", "V7", "i", "i"]],
    },
  },

  // ── the second shelf of artists ──
  // Bill Evans: ii–Vs that sidestep, the iii–VI turn, a major chord a whole step down, minor
  // ii–Vs into the relative minor (Waltz for Debby, Very Early, Blue in Green)
  evans: {
    name: "Bill Evans",
    forms: { period: 3, sentence: 2, loop: 0 },
    major: {
      heads: [["Imaj7", "vi7"], ["Imaj7", "IVmaj7"], ["iii7", "VI7"], ["Imaj7", "bVIImaj7"], ["Imaj7", "ii7"], ["Imaj7", "bIIImaj7"]],
      seqs: [["ii7", "V7"], ["iii7", "VI7"], ["vi7", "II7"], ["IVmaj7", "bVII7"], ["#iv7b5", "VII7"], ["iii7", "biii7"], ["bVImaj7", "bII7"]],
      tails: {
        closed: [["ii7 V7", "Imaj7"], ["iv6 bVII7", "Imaj7"], ["ii7 bII7", "Imaj7"]],
        half: [["ii7", "V7sus4"], ["vi7 II7", "ii7 V7"], ["#iv7b5", "VII7"]],
        open: [["IVmaj7", "iv6"], ["iii7", "VI7"], ["bVImaj7", "bVImaj7"]],
      },
      phrases: {
        closed: [["Imaj7", "vi7", "ii7 V7", "Imaj7"], ["#iv7b5", "VII7", "iii7 VI7", "Imaj7"]],
        half: [["Imaj7", "bVIImaj7", "bVImaj7", "V7sus4"], ["Imaj7", "vi7", "ii7", "V7"]],
        open: [["Imaj7", "IVmaj7", "iii7", "VI7"]],
      },
      loops: [],
      codas: [["ii7 V7", "iii7 VI7", "ii7 V7", "Imaj7"], ["IVmaj7", "iv6", "iii7 VI7", "Imaj7"]],
    },
    minor: {
      heads: [["i7", "i6"], ["i7", "bVImaj7"], ["i7", "iv7"], ["bIIImaj7", "ii7b5 V7"], ["i7", "bIImaj7"]],
      seqs: [["bVImaj7", "V7"], ["iv7", "bVII7"], ["bIIImaj7", "ii7b5"], ["bVImaj7", "bII7"], ["iv7", "bIIImaj7"]],
      tails: {
        closed: [["ii7b5 V7", "i7"], ["bVImaj7 V7", "i6"], ["bII7", "i7"]],
        half: [["ii7b5", "V7"], ["bVImaj7", "V7sus4"]],
        open: [["iv7", "bVII7"], ["bIIImaj7", "bVImaj7"]],
      },
      phrases: {
        closed: [["bIIImaj7", "V7", "i7", "i7"], ["iv7", "bVII7", "ii7b5 V7", "i6"]],
        half: [["i7", "bVImaj7", "ii7b5", "V7"]],
        open: [["i7", "bIImaj7", "i7", "bIImaj7"]],
      },
      loops: [],
      codas: [["bVImaj7", "ii7b5 V7", "i7", "i6"]],
    },
  },
  // Monk: dominants that slide down by half steps, a tonic leaned on from a half step above
  // (Well You Needn't, Ruby, My Dear, Straight No Chaser's turnarounds)
  monk: {
    name: "Monk",
    forms: { period: 3, sentence: 2, loop: 0 },
    major: {
      heads: [["I6", "bII7"], ["I6", "VI7"], ["I6", "#idim7"], ["Imaj7", "bVII7"], ["I6", "III7"]],
      seqs: [["II7", "bII7"], ["VI7", "bVI7"], ["III7", "bIII7"], ["V7", "bV7"], ["ii7 bII7", "ii7 bII7"], ["iii7 biii7", "ii7 bII7"]],
      tails: {
        closed: [["II7 bII7", "I6"], ["bVI7 V7", "I6"], ["ii7 bII7", "I6"]],
        half: [["II7", "bII7"], ["VI7", "II7"], ["bVI7", "V7"]],
        open: [["III7", "VI7"], ["bVII7", "bVII7"], ["bIII7", "bVI7"]],
      },
      phrases: {
        closed: [["I6", "bII7", "I6", "I6"], ["III7", "VI7", "II7 bII7", "I6"]],
        half: [["I6", "VI7", "II7", "V7"], ["I6", "bII7", "II7", "bII7"]],
        open: [["I6", "bII7", "I6", "bII7"]],
      },
      loops: [],
      codas: [["II7", "bII7", "I6", "I6"], ["VI7 bVI7", "V7 bV7", "II7 bII7", "I6"]],
    },
    minor: {
      heads: [["i6", "bII7"], ["i7", "bVI7"], ["i6", "ii7b5 V7"], ["i6", "VI7"]],
      seqs: [["bVI7", "V7"], ["II7", "bII7"], ["iv7", "bVII7"], ["bIII7", "bVI7"], ["iv7 bVII7", "bIII7 bVI7"]],
      tails: {
        closed: [["bII7", "i6"], ["bVI7 V7", "i6"], ["II7 bII7", "i6"]],
        half: [["bVI7", "V7"], ["ii7b5", "V7"], ["II7", "bII7"]],
        open: [["iv7", "bVII7"], ["bVI7", "bVI7"]],
      },
      phrases: {
        closed: [["i6", "bVI7", "bII7", "i6"]],
        half: [["i6", "i6", "bVI7", "V7"]],
        open: [["i6", "bII7", "i6", "bII7"]],
      },
      loops: [],
      codas: [["bVI7", "bII7", "i6", "i6"]],
    },
  },
  // Miles, modal: a mode held for bars at a time and then moved a half step (So What,
  // Impressions); in major, suspended chords drifting (Maiden Voyage)
  modal: {
    name: "Modal",
    forms: { period: 1, sentence: 2, loop: 3 },
    major: {
      heads: [["I7sus4", "I7sus4"], ["Imaj7", "Imaj7"], ["I7sus4", "bIII7sus4"], ["Imaj7", "II7"]],
      seqs: [["bIII7sus4", "bIII7sus4"], ["bII7sus4", "bII7sus4"], ["vii7", "vii7"], ["IVmaj7", "IVmaj7"], ["II7", "II7"]],
      tails: {
        closed: [["bII7sus4", "I7sus4"], ["IVmaj7", "Imaj7"], ["vii7", "I7sus4"]],
        half: [["bII7sus4", "bII7sus4"], ["vii7", "bVII7sus4"]],
        open: [["bIII7sus4", "bIII7sus4"], ["IVmaj7", "IVmaj7"]],
      },
      phrases: {
        closed: [["I7sus4", "I7sus4", "bIII7sus4", "I7sus4"]],
        half: [["I7sus4", "bIII7sus4", "bII7sus4", "vii7"]],
        open: [["I7sus4", "I7sus4", "I7sus4", "I7sus4"]],
      },
      loops: [["I7sus4", "I7sus4", "bIII7sus4", "bIII7sus4"]],
      codas: [["bII7sus4", "bII7sus4", "I7sus4", "I7sus4"]],
    },
    minor: {
      heads: [["i7", "i7"], ["i7", "iv7"], ["i7", "bVII7sus4"]],
      seqs: [["bii7", "bii7"], ["i7", "i7"], ["iv7", "iv7"], ["bVIImaj7", "bVIImaj7"], ["bii7", "i7"]],
      tails: {
        closed: [["bii7", "i7"], ["i7", "i7"], ["bVII7sus4", "i7"]],
        half: [["bii7", "bii7"], ["iv7", "bVII7sus4"]],
        open: [["bii7", "bii7"], ["iv7", "iv7"]],
      },
      phrases: {
        closed: [["i7", "i7", "bii7", "i7"], ["bii7", "bii7", "i7", "i7"]],
        half: [["i7", "i7", "i7", "bii7"]],
        open: [["i7", "i7", "i7", "i7"]],
      },
      // never a whole take on one chord: the loop always moves up the half step
      loops: [["i7", "i7", "i7", "i7", "bii7", "bii7", "bii7", "bii7"]],
      codas: [["bii7", "bii7", "i7", "i7"]],
    },
  },
  // Herbie Hancock's Head Hunters: a two-chord dorian vamp that never leaves (Chameleon), a
  // blues-shaped major vamp (Watermelon Man)
  headhunters: {
    name: "Head Hunters",
    forms: { period: 1, sentence: 2, loop: 3 },
    major: {
      heads: [["I7", "IV7"], ["I7", "I7"], ["I7", "bVII7"]],
      seqs: [["IV7", "IV7"], ["bVII7", "IV7"], ["ii7", "V7"], ["bIII7", "IV7"], ["I7", "bVII7"]],
      tails: {
        closed: [["V7 IV7", "I7"], ["bVII7 IV7", "I7"], ["ii7 V7", "I7"]],
        half: [["ii7", "V7"], ["IV7", "V7sus4"]],
        open: [["IV7", "bVII7"], ["I7", "IV7"]],
      },
      phrases: {
        closed: [["I7", "IV7", "bVII7 IV7", "I7"]],
        half: [["I7", "I7", "IV7", "V7sus4"]],
        open: [["I7", "bVII7", "IV7", "IV7"]],
      },
      loops: [["I7", "IV7"], ["I7", "bVII7"]],
      codas: [["bVII7", "IV7", "I7", "I7"]],
    },
    minor: {
      heads: [["i7", "IV7"], ["i7", "i7"], ["i7", "bVII7"]],
      seqs: [["i7", "IV7"], ["bVImaj7", "bVII7"], ["iv7", "bVII7"], ["bIIImaj7", "IV7"], ["bVI7", "bVII7"]],
      tails: {
        closed: [["bVII7", "i7"], ["IV7", "i7"], ["bVI7 bVII7", "i7"]],
        half: [["bVImaj7", "V7sus4"], ["iv7", "bVII7"]],
        open: [["i7", "IV7"], ["bVImaj7", "bVII7"]],
      },
      phrases: {
        closed: [["i7", "IV7", "bVImaj7 bVII7", "i7"]],
        half: [["i7", "IV7", "i7", "bVII7"]],
        open: [["i7", "IV7", "i7", "IV7"]],
      },
      loops: [["i7", "IV7"], ["i7", "i7", "IV7", "IV7"], ["i7", "bVII7"]],
      codas: [["bVImaj7", "bVII7", "i7", "i7"]],
    },
  },
  // Vince Guaraldi: major sevenths planing down a whole step (Christmas Time Is Here), the
  // mixolydian I–bVII–IV, a ii–V to get home
  guaraldi: {
    name: "Guaraldi",
    forms: { period: 3, sentence: 2, loop: 1 },
    major: {
      heads: [["Imaj7", "bVIImaj7"], ["Imaj7", "IVmaj7"], ["I6", "bVII"], ["Imaj7", "ii7"], ["I6", "IV"]],
      seqs: [["IVmaj7", "bVIImaj7"], ["iii7", "bIIImaj7"], ["ii7", "bII7"], ["IVmaj7", "iv6"], ["bVImaj7", "bVIImaj7"], ["bVII", "IV"]],
      tails: {
        closed: [["ii7 V7", "Imaj7"], ["iv6 bVII7", "I6"], ["bVImaj7 bVIImaj7", "Imaj7"]],
        half: [["ii7", "V7sus4"], ["bVImaj7", "V7"]],
        open: [["IVmaj7", "bVIImaj7"], ["bIIImaj7", "bVImaj7"]],
      },
      phrases: {
        closed: [["Imaj7", "bVIImaj7", "ii7 V7", "Imaj7"], ["I6", "bVII", "IV", "I6"]],
        half: [["Imaj7", "bVIImaj7", "Imaj7", "V7sus4"]],
        open: [["Imaj7", "IVmaj7", "bVIImaj7", "bIIImaj7"]],
      },
      loops: [["I6", "bVII", "IV", "I6"]],
      codas: [["IVmaj7", "iv6", "Imaj7", "Imaj7"]],
    },
    minor: {
      heads: [["i7", "bVII"], ["i7", "iv7"], ["i7", "bVImaj7"]],
      seqs: [["bVImaj7", "bVII"], ["iv7", "bVII7"], ["bIIImaj7", "bVImaj7"], ["ii7b5", "V7"]],
      tails: {
        closed: [["ii7b5 V7", "i7"], ["bVI bVII", "i7"]],
        half: [["bVImaj7", "V7"], ["iv7", "V7"]],
        open: [["bVImaj7", "bVII"], ["iv7", "bVII7"]],
      },
      phrases: {
        closed: [["i7", "bVII", "bVImaj7 V7", "i7"]],
        half: [["i7", "bVII", "bVImaj7", "V7"]],
        open: [["i7", "iv7", "i7", "iv7"]],
      },
      loops: [["i7", "bVII", "bVImaj7", "bVII"]],
      codas: [["iv7", "V7", "i7", "i7"]],
    },
  },
  // Stevie Wonder: the vi–II–V–I of Isn't She Lovely, flat-side major sevenths, a minor vamp
  // that turns on bVI–V (Superstition)
  soul: {
    name: "Soul",
    forms: { period: 2, sentence: 2, loop: 2 },
    major: {
      heads: [["Imaj7", "vi7"], ["Imaj7", "iii7"], ["I6", "II7"], ["Imaj7", "bVII7"]],
      seqs: [["vi7", "II7"], ["iii7", "VI7"], ["ii7", "bII7"], ["IVmaj7", "#ivdim7"], ["bIIImaj7", "bVImaj7"], ["ii7", "V7sus4"]],
      tails: {
        closed: [["ii7 V7", "Imaj7"], ["IVmaj7 V7sus4", "I6"], ["bVImaj7 bVII7", "Imaj7"]],
        half: [["ii7", "V7sus4"], ["vi7 II7", "ii7 V7"]],
        open: [["bVImaj7", "bVII7"], ["iii7", "VI7"]],
      },
      phrases: {
        closed: [["vi7", "II7", "V7sus4", "Imaj7"]],
        half: [["Imaj7", "vi7", "ii7", "V7sus4"]],
        open: [["vi7", "II7", "vi7", "II7"]],
      },
      loops: [["vi7", "II7", "V7sus4", "Imaj7"], ["Imaj7", "bVII7"]],
      codas: [["bVImaj7", "bVII7", "Imaj7", "Imaj7"]],
    },
    minor: {
      heads: [["i7", "i7"], ["i7", "iv7"], ["i7", "bVII7"]],
      seqs: [["bVI7", "V7"], ["iv7", "bVII7"], ["bIIImaj7", "bVImaj7"], ["bVI7", "bVII7"]],
      tails: {
        closed: [["bVI7 V7", "i7"], ["iv7 bVII7", "i7"]],
        half: [["bVI7", "V7"], ["iv7", "V7"]],
        open: [["i7", "iv7"], ["bIIImaj7", "bVImaj7"]],
      },
      phrases: {
        closed: [["i7", "i7", "bVI7 V7", "i7"]],
        half: [["i7", "iv7", "bVI7", "V7"]],
        open: [["i7", "i7", "i7", "i7"]],
      },
      loops: [["i7"], ["i7", "iv7"]],
      codas: [["bVI7", "V7", "i7", "i7"]],
    },
  },
  // Sakamoto: the "royal road" IVmaj7–V–iii–vi that Japanese film and pop lean on (Merry
  // Christmas Mr. Lawrence), and its minor shadow
  royal: {
    name: "Royal road",
    forms: { period: 1, sentence: 2, loop: 3 },
    major: {
      heads: [["IVmaj7", "V"], ["vi7", "IVmaj7"], ["Iadd9", "iii7"], ["IVmaj7", "iii7"]],
      seqs: [["IVmaj7", "V"], ["iii7", "vi7"], ["ii7", "iii7"], ["bVIImaj7", "IVmaj7"], ["ii7", "Vsus4"]],
      tails: {
        closed: [["IVmaj7 V", "Iadd9"], ["ii7 Vsus4", "Iadd9"]],
        half: [["IVmaj7", "V"], ["ii7", "Vsus4"]],
        open: [["iii7", "vi7"], ["IVmaj7", "iii7"]],
      },
      phrases: {
        closed: [["IVmaj7", "V", "iii7 vi7", "Iadd9"]],
        half: [["IVmaj7", "V", "iii7", "vi7"]],
        open: [["vi7", "IVmaj7", "V", "iii7"]],
      },
      loops: [["IVmaj7", "V", "iii7", "vi7"], ["IVmaj7", "V", "vi7", "vi7"]],
      codas: [["IVmaj7", "V", "Iadd9", "Iadd9"]],
    },
    minor: {
      heads: [["i7", "bVImaj7"], ["iv7", "v7"], ["i7", "bIIImaj7"]],
      seqs: [["bVImaj7", "bVII"], ["v7", "i7"], ["iv7", "bVII"], ["bIIImaj7", "bVImaj7"]],
      tails: {
        closed: [["bVImaj7 bVII", "i7"], ["iv7 v7", "i7"]],
        half: [["bVImaj7", "V"], ["iv7", "V"]],
        open: [["bVImaj7", "bVII"], ["iv7", "v7"]],
      },
      phrases: {
        closed: [["bVImaj7", "bVII", "v7", "i7"]],
        half: [["i7", "bVImaj7", "iv7", "V"]],
        open: [["bVImaj7", "bVII", "v7", "i7"]],
      },
      loops: [["bVImaj7", "bVII", "v7", "i7"]],
      codas: [["iv7", "bVII", "i7", "i7"]],
    },
  },
  // Hisaishi's waltzes: the minor circle of fifths (Merry-Go-Round of Life), and the major
  // IV–V–iii–vi of One Summer's Day
  waltz: {
    name: "Film waltz",
    forms: { period: 3, sentence: 2, loop: 1 },
    major: {
      heads: [["I", "iii"], ["IVmaj7", "V"], ["I", "vi"], ["I", "IV"]],
      seqs: [["IV", "V"], ["iii", "vi"], ["ii7", "V7"], ["IV", "iv"], ["IVmaj7", "iii7"]],
      tails: {
        closed: [["IV V", "I"], ["ii7 V7", "I"], ["IV iv", "I"]],
        half: [["ii7", "V7"], ["IV", "V"]],
        open: [["iii", "vi"], ["IV", "iv"]],
      },
      phrases: {
        closed: [["IVmaj7", "V", "I", "I"]],
        half: [["I", "iii", "IV", "V"]],
        open: [["IVmaj7", "V", "iii", "vi"]],
      },
      loops: [["IVmaj7", "V", "iii", "vi"]],
      codas: [["IV", "iv", "I", "I"]],
    },
    minor: {
      heads: [["i", "iv"], ["i", "VI"], ["i", "i"], ["i", "III"]],
      seqs: [["iv", "VII"], ["III", "VI"], ["iiø", "V7"], ["VI", "VII"]],
      tails: {
        closed: [["iiø V7", "i"], ["iv V7", "i"], ["VI V7", "i"]],
        half: [["iiø", "V7"], ["VI", "V7"]],
        open: [["VII", "III"], ["iv", "VII"]],
      },
      phrases: {
        closed: [["VI", "iiø", "V7", "i"], ["iv", "V7", "i", "i"]],
        half: [["i", "iv", "VI", "V7"]],
        open: [["i", "iv", "VII", "III"]],
      },
      loops: [["i", "iv", "VII", "III", "VI", "iiø", "V7", "i"]],
      codas: [["VI", "iiø", "V7", "i"]],
    },
  },
  // Nils Frahm: a few chords, each held long while the piano repeats over it
  frahm: {
    name: "Frahm",
    forms: { period: 1, sentence: 1, loop: 3 },
    holds: true,
    major: {
      heads: [["Iadd9", "IVmaj7"], ["Iadd9", "vi7"], ["Iadd9", "iii7"]],
      seqs: [["IVmaj7", "vi7"], ["vi7", "IVmaj7"], ["ii7", "IVmaj7"], ["iii7", "IVmaj7"]],
      tails: {
        closed: [["IVmaj7", "Iadd9"], ["ii7", "Iadd9"]],
        half: [["IVmaj7", "Vsus4"], ["vi7", "Vsus4"]],
        open: [["vi7", "IVmaj7"], ["iii7", "vi7"]],
      },
      phrases: {
        closed: [["Iadd9", "vi7", "IVmaj7", "Iadd9"]],
        half: [["Iadd9", "iii7", "IVmaj7", "Vsus4"]],
        open: [["vi7", "IVmaj7", "ii7", "Iadd9"]],
      },
      loops: [["Iadd9", "vi7", "IVmaj7", "ii7"], ["Iadd9", "IVmaj7"]],
      codas: [["IVmaj7", "ii7", "Iadd9", "Iadd9"]],
    },
    minor: {
      heads: [["i", "bVImaj7"], ["i", "bVII"], ["i", "iv"]],
      seqs: [["bVImaj7", "bIIImaj7"], ["iv", "bVImaj7"], ["bVII", "bVImaj7"], ["bIIImaj7", "iv"]],
      tails: {
        closed: [["bVImaj7", "i"], ["iv", "i"]],
        half: [["bVImaj7", "Vsus4"], ["iv", "Vsus4"]],
        open: [["bIIImaj7", "iv"], ["bVImaj7", "bIIImaj7"]],
      },
      phrases: {
        closed: [["i", "bVImaj7", "iv", "i"]],
        half: [["i", "bVII", "bVImaj7", "Vsus4"]],
        open: [["i", "iv", "bVImaj7", "bVII"]],
      },
      loops: [["i", "bVImaj7", "iv", "bVII"], ["i", "bVII"]],
      codas: [["iv", "bVImaj7", "i", "i"]],
    },
  },
  // Einaudi: plain triads in slow loops, minor first (never the four-chord loop itself)
  einaudi: {
    name: "Einaudi",
    forms: { period: 2, sentence: 2, loop: 2 },
    major: {
      heads: [["I", "iii"], ["I", "IV"], ["I", "vi"], ["Iadd9", "V"]],
      seqs: [["IV", "I"], ["vi", "iii"], ["ii", "IV"], ["IV", "V"], ["vi", "ii"]],
      tails: {
        closed: [["IV V", "I"], ["ii V", "I"], ["IV", "I"]],
        half: [["IV", "V"], ["ii", "V"]],
        open: [["vi", "iii"], ["IV", "ii"]],
      },
      phrases: {
        closed: [["vi", "IV", "V", "I"]],
        half: [["I", "iii", "vi", "V"]],
        open: [["I", "IV", "vi", "IV"]],
      },
      loops: [["I", "iii", "vi", "IV"], ["I", "IV", "ii", "IV"]],
      codas: [["IV", "V", "I", "I"]],
    },
    minor: {
      heads: [["i", "bVI"], ["i", "v"], ["i", "iv"], ["i", "bVII"]],
      seqs: [["bVI", "iv"], ["bIII", "v"], ["iv", "bVI"], ["bVII", "bIII"], ["bVI", "bVII"]],
      tails: {
        closed: [["iv V", "i"], ["bVI bVII", "i"], ["iv", "i"]],
        half: [["bVI", "V"], ["iv", "V"]],
        open: [["bVI", "bIII"], ["iv", "bVI"]],
      },
      phrases: {
        closed: [["bVI", "iv", "V", "i"]],
        half: [["i", "v", "bVI", "V"]],
        open: [["i", "bVI", "iv", "bVI"]],
      },
      loops: [["i", "bVI", "iv", "v"], ["i", "v", "bVI", "iv"]],
      codas: [["bVI", "iv", "i", "i"]],
    },
  },
  // Satie: two major sevenths rocking a 4th apart (the Gymnopédies), and the Gnossiennes'
  // minor drone with v instead of V; no dominant pulls anywhere
  satie: {
    name: "Satie",
    forms: { period: 1, sentence: 1, loop: 3 },
    major: {
      heads: [["IVmaj7", "Imaj7"], ["Imaj7", "IVmaj7"], ["ii7", "Imaj7"]],
      seqs: [["IVmaj7", "Imaj7"], ["vi7", "iii7"], ["ii7", "vi7"], ["IVmaj7", "iii7"], ["vi7", "IVmaj7"]],
      tails: {
        closed: [["ii7", "Imaj7"], ["IVmaj7", "Imaj7"], ["vi7 ii7", "Imaj7"]],
        half: [["vi7", "iii7"], ["ii7", "vi7"]],
        open: [["IVmaj7", "IVmaj7"], ["iii7", "vi7"]],
      },
      phrases: {
        closed: [["IVmaj7", "Imaj7", "IVmaj7", "Imaj7"]],
        half: [["IVmaj7", "Imaj7", "vi7", "iii7"]],
        open: [["ii7", "vi7", "ii7", "vi7"]],
      },
      loops: [["IVmaj7", "Imaj7"], ["IVmaj7", "Imaj7", "IVmaj7", "Imaj7", "vi7", "iii7", "ii7", "Imaj7"]],
      codas: [["vi7", "IVmaj7", "Imaj7", "Imaj7"]],
    },
    minor: {
      heads: [["i", "i"], ["i", "iv"], ["i", "v"]],
      seqs: [["iv", "i"], ["v", "i"], ["bVII", "i"], ["bIII", "iv"]],
      tails: {
        closed: [["iv", "i"], ["v", "i"], ["bVII", "i"]],
        half: [["iv", "v"], ["bVI", "v"]],
        open: [["iv", "iv"], ["bIII", "bVII"]],
      },
      phrases: {
        closed: [["i", "iv", "v", "i"]],
        half: [["i", "i", "iv", "v"]],
        open: [["i", "bVII", "i", "bVII"]],
      },
      loops: [["i", "iv"], ["i", "i", "v", "i"]],
      codas: [["iv", "v", "i", "i"]],
    },
  },
  // Afrobeat: one dorian chord for a long time, a second one to answer it
  afro: {
    name: "Afrobeat",
    forms: { period: 1, sentence: 2, loop: 4 },
    major: {
      heads: [["I7", "I7"], ["I7", "IV7"], ["I7", "bVII7"]],
      seqs: [["IV7", "I7"], ["bVII7", "IV7"], ["I7", "bVII7"], ["ii7", "I7"], ["IV7", "IV7"]],
      tails: {
        closed: [["IV7", "I7"], ["bVII7", "I7"]],
        half: [["IV7", "bVII7"], ["ii7", "IV7"]],
        open: [["I7", "IV7"], ["bVII7", "bVII7"]],
      },
      phrases: {
        closed: [["I7", "IV7", "bVII7", "I7"]],
        half: [["I7", "I7", "IV7", "IV7"]],
        open: [["I7", "I7", "I7", "I7"]],
      },
      loops: [["I7"], ["I7", "IV7"], ["I7", "I7", "I7", "bVII7"]],
      codas: [["IV7", "bVII7", "I7", "I7"]],
    },
    minor: {
      heads: [["i7", "i7"], ["i7", "iv7"], ["i7", "bVII7"], ["i7", "bIIImaj7"]],
      seqs: [["i7", "iv7"], ["iv7", "i7"], ["bVII7", "i7"], ["iv7", "iv7"], ["bIIImaj7", "iv7"]],
      tails: {
        closed: [["iv7", "i7"], ["bVII7", "i7"]],
        half: [["iv7", "bVII7"], ["iv7", "iv7"]],
        open: [["i7", "iv7"], ["i7", "i7"]],
      },
      phrases: {
        closed: [["i7", "i7", "iv7", "i7"]],
        half: [["i7", "iv7", "i7", "bVII7"]],
        open: [["i7", "i7", "i7", "i7"]],
      },
      loops: [["i7"], ["i7", "iv7"], ["i7", "i7", "i7", "bVII7"]],
      codas: [["iv7", "bVII7", "i7", "i7"]],
    },
  },
  // Son cubano: I–IV–V7–IV round and round (Guantanamera), and Chan Chan's i–III–iv–V7
  son: {
    name: "Son",
    forms: { period: 2, sentence: 1, loop: 3 },
    major: {
      heads: [["I", "IV"], ["I", "V7"], ["I", "ii7 V7"]],
      seqs: [["IV", "V7"], ["ii7", "V7"], ["I", "IV"], ["IV", "I"], ["V7", "IV"]],
      tails: {
        closed: [["IV V7", "I"], ["ii7 V7", "I"]],
        half: [["IV", "V7"], ["ii7", "V7"]],
        open: [["I", "IV"], ["IV", "IV"]],
      },
      phrases: {
        closed: [["I", "IV", "V7", "I"]],
        half: [["I", "IV", "I", "V7"]],
        open: [["I", "IV", "V7", "IV"]],
      },
      loops: [["I", "IV", "V7", "IV"], ["ii7", "V7"]],
      codas: [["IV", "V7", "I", "I"]],
    },
    minor: {
      heads: [["i", "bIII"], ["i", "iv"], ["i", "V7"]],
      seqs: [["iv", "V7"], ["bIII", "iv"], ["iv7", "bVII7"], ["bVI", "V7"]],
      tails: {
        closed: [["iv V7", "i"], ["bVI V7", "i"]],
        half: [["iv", "V7"], ["bVI", "V7"]],
        open: [["bIII", "iv"], ["i", "bIII"]],
      },
      phrases: {
        closed: [["i", "bIII", "iv V7", "i"]],
        half: [["i", "bIII", "iv", "V7"]],
        open: [["i", "iv", "i", "iv"]],
      },
      loops: [["i", "bIII", "iv", "V7"], ["i", "iv", "V7", "i"]],
      codas: [["iv", "V7", "i", "i"]],
    },
  },
};

export const BOOK_IDS = Object.keys(HARMONY_BOOKS) as BookId[];

/** The book a chart's changes come from: its own pick, or its style's. */
export function bookOf(settings: { style: StyleId; harmony?: BookId | null }): BookDef {
  return HARMONY_BOOKS[settings.harmony ?? settings.style] ?? HARMONY_BOOKS[settings.style];
}

const numeral = (bar: string) => bar.split(/\s+/)[0].match(/^(b|#)?(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)/)?.[0] ?? bar;

/** I–V–vi–IV (in any rotation, any colour): the progression under half the pop songs you know. */
export function isAxis(bars: readonly string[]): boolean {
  const axis = ["I", "V", "vi", "IV"];
  for (let i = 0; i + 4 <= bars.length; i++) {
    const four = bars.slice(i, i + 4).map(numeral);
    for (let r = 0; r < 4; r++) if (four.every((n, k) => n === axis[(k + r) % 4])) return true;
  }
  return false;
}

/**
 * Eight bars of changes from a book: two four-bar phrases, laid out as a question and its answer
 * (it stops on the dominant, then comes back and lands home), a sentence (an idea and its
 * sequence, then the cadence), or a loop. Never I–V–vi–IV. A book whose harmony holds builds
 * four chords and lets each ring for two bars.
 */
export function buildTune(def: BookDef, mode: "major" | "minor", rng: Rng): string[] {
  const book = def[mode];
  const pickPair = (list: readonly Pair[]) => [...rng.pick(list)];
  const phrase = (end: PhraseEnd, build: "head_tail" | "head_seq" | "seq_tail" | "coda", head?: string[]): string[] => {
    // a documented four-bar phrase about a third of the time, else built from two-bar units
    if (build !== "coda" && !head && book.phrases[end].length && rng.chance(0.35)) return [...rng.pick(book.phrases[end])];
    const tails = book.tails[end].length ? book.tails[end] : book.tails.open;
    switch (build) {
      case "head_tail":
        return [...(head ?? pickPair(book.heads)), ...pickPair(tails)];
      case "head_seq":
        return [...pickPair(book.heads), ...pickPair(book.seqs)];
      case "seq_tail":
        return [...pickPair(book.seqs), ...pickPair(tails)];
      case "coda":
        return book.codas.length ? [...rng.pick(book.codas)] : [...pickPair(book.seqs), ...pickPair(book.tails.closed)];
    }
  };
  for (let attempt = 0; attempt < 24; attempt++) {
    const f = def.forms;
    const loopOk = book.loops.length > 0;
    const r = rng.next() * (f.period + f.sentence + (loopOk ? f.loop : 0));
    let bars: string[];
    if (r < f.period) {
      // the question stops on the dominant; the answer starts the same way and lands home
      const q = phrase("half", "head_tail");
      bars = [...q, ...phrase("closed", "head_tail", q.slice(0, 2))];
    } else if (r < f.period + f.sentence) {
      bars = [...phrase("open", "head_seq"), ...(rng.chance(0.5) ? phrase("closed", "seq_tail") : phrase("closed", "coda"))];
    } else {
      const loop = rng.pick(book.loops);
      bars = Array.from({ length: 8 }, (_, i) => loop[i % loop.length]);
      // a loop still breathes at its end: the last two bars turn it around
      if (book.tails.half.length && loop.length > 2) bars.splice(6, 2, ...pickPair(book.tails.half));
    }
    if (def.holds) {
      // four different chords in a row (a repeat would ring four bars), each held for two
      const runs = bars.filter((b, i) => i === 0 || b !== bars[i - 1]);
      const four = Array.from({ length: 4 }, (_, i) => runs[i % runs.length]);
      bars = four.flatMap((b) => [b, b]);
    }
    if (!isAxis(bars)) return bars;
  }
  return [...book.phrases.half[0], ...book.phrases.closed[0]];
}
