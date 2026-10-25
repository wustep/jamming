import type { InstrumentId } from "@/music/types";

// What each player has ringing. smplr starts a new voice for every note and never takes one
// back, so two things went wrong. A note struck again while the same pitch still rang (a pad's
// held chord restruck by the next, shimmer bells on a note the piano holds) played two copies of
// one sample on top of each other: on a looped pad or organ that's a steady hollow, phasey
// tone. And nothing limited how many voices piled up (a big band's chords, their release tails,
// a ride rung every beat), which is what a phone's audio thread drops out under. Here a
// restruck pitch lets the old one go as the new one starts, and past a player's cap the oldest
// voice lets go. Either way it goes through its instrument's own release, never a cut.

/** Voices one player may have ringing at once (release tails included), by instrument. */
export const VOICE_CAP: Record<InstrumentId, number> = {
  piano: 24,
  organ: 16,
  pad: 16,
  vibes: 16,
  guitar: 12,
  drums: 24,
  bass: 6,
  cello: 8,
  violin: 6,
  trumpet: 6,
  sax: 6,
  trombone: 6,
  clarinet: 6,
  flute: 6,
};

/** How long a drum's voice rings (s) when it's given no length: cymbals long, skins short. */
export function drumRing(pitch: number): number {
  if (pitch === 49 || pitch === 57 || pitch === 51 || pitch === 59 || pitch === 53) return 2.5;
  if (pitch === 46) return 1;
  return 0.6;
}

interface Ringing {
  pitch: number;
  start: number;
  end: number;
  stop: (time?: number) => void;
}

export class VoiceBook {
  private ringing: Ringing[] = [];
  constructor(
    private cap: number,
    /** Let a restruck pitch go (pitched instruments; a drum's hits ring over each other). */
    private restrike = true,
  ) {}

  /**
   * A note of `pitch` starts at `time`: let go of the same pitch still ringing, and of the oldest
   * voices past the cap (leaving room for this one). Returns how many were let go.
   */
  admit(pitch: number, time: number): number {
    this.ringing = this.ringing.filter((r) => r.end > time + 1e-3);
    let n = 0;
    const go = (r: Ringing) => {
      try {
        r.stop(time);
      } catch {
        /* already gone */
      }
      n++;
    };
    if (this.restrike) {
      // (struck together, it's a chord with the note doubled: not a restrike)
      const same = this.ringing.filter((r) => r.pitch === pitch && r.start < time - 0.01);
      for (const r of same) go(r);
      if (same.length) this.ringing = this.ringing.filter((r) => !same.includes(r));
    }
    this.ringing.sort((a, b) => a.start - b.start);
    while (this.ringing.length >= this.cap) go(this.ringing.shift()!);
    return n;
  }

  add(pitch: number, start: number, end: number, stop: (time?: number) => void): void {
    this.ringing.push({ pitch, start, end, stop });
  }

  /** Voices ringing at `time`. */
  count(time: number): number {
    return this.ringing.filter((r) => r.start <= time && r.end > time).length;
  }

  clear(): void {
    this.ringing = [];
  }
}
