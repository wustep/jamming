import type { Rng } from "./rng";
import type { StyleId } from "./types";

// The changes for a chart without a standard, built the way tunes are: out of four-bar phrases,
// each an opening, a sequence or a cadence from the style's book, laid out as a form (a question
// and its answer, a sentence, or a loop). The book holds what the style says, two bars at a time
// (after jev-playground's harmony books), plus whole four-bar phrases modelled on real tunes.
// Bars are roman numerals in the key ("ii7 V7" is two chords in a bar); romanToChord spells them.
// A free chart used to pick one of two fixed eight-bar progressions; now every take has its own.

export type BookId = StyleId | "romantic" | "impressionist" | "film" | "jazzpop" | "gospel";
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
