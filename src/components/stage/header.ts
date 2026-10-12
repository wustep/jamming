import type { Score } from "@/music/types";

export interface StageHeader {
  /** The bar being played (-1 in the count-in). */
  bar: number;
  /** The section's name, or "count-in…". */
  section: string;
  /** "· bar 3/32", empty in the count-in. */
  counter: string;
  /** The chord sounding now (empty in the count-in). */
  chord: string;
  /** The next change, read ahead like the band does (this bar or the next two): "→ G7". */
  next: string;
}

/** What the stage's header says at a beat of the take (the stage, and clips of it). */
export function headerAt(score: Score, beat: number): StageHeader {
  const beats = score.frame.meter.beats;
  const bar = beat < 0 ? -1 : Math.min(score.frame.bars - 1, Math.floor(beat / beats));
  if (bar < 0) return { bar, section: "count-in…", counter: "", chord: "", next: "" };
  const inBar = beat - bar * beats;
  const chords = score.frame.chords[bar] ?? [];
  let chord = chords[0]?.symbol ?? "";
  for (const c of chords) if (c.beat <= inBar + 1e-6) chord = c.symbol;
  let next = "";
  for (let k = bar; k < Math.min(score.frame.bars, bar + 3) && !next; k++) {
    for (const c of score.frame.chords[k] ?? []) {
      if ((k > bar || c.beat > inBar + 1e-6) && c.symbol !== chord) {
        next = `→ ${c.symbol}`;
        break;
      }
    }
  }
  return { bar, section: score.plan[bar]?.section ?? "", counter: `· bar ${bar + 1}/${score.frame.bars}`, chord, next };
}
