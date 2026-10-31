import { applyFeel, pocketOf } from "@/audio/feel";
import { bowsLines, strokesOf, swellsOf } from "@/music/bowing";
import { DYNAMIC_ENERGY } from "@/music/context";
import { INSTRUMENTS, isCymbal } from "@/music/instruments";
import { isFeaturedRole } from "@/music/realize";
import { STYLES } from "@/music/styles";
import type { ActiveNote, MemberFrameState, NoteEvent, OnsetInfo, Score, UpcomingOnset } from "@/music/types";

// Turns the score + playhead into per-member animation state every frame.
// Notes are pre-sorted with their *felt* (swung) times so motion lines up with what you hear,
// and shaped the way the audio engine plays them (staccato cut short, pizz capped, pitches
// folded into the instrument's range), so a key stays down exactly as long as it sounds.

/** How far ahead rigs can see (seconds): enough for a stick or hand to wind up. */
const LOOKAHEAD_SEC = 0.6;
/** A cymbal roll's mallet strokes, in beats apart. */
const ROLL_STEP = 1 / 6;

interface Track {
  start: Float64Array; // felt start, beats
  end: Float64Array; // felt end, beats
  pitch: Int16Array;
  vel: Float32Array;
  art: (NoteEvent["art"] | undefined)[];
  maxDur: number;
  /** A bowed line's strokes and phrases (felt beats), and which each note is in. */
  bow?: {
    strokeOf: number[];
    strokes: { start: number; end: number; dir: 1 | -1 }[];
    phraseOf: number[];
    phrases: { start: number; end: number; peak: number }[];
  };
}

export class FrameComputer {
  private tracks = new Map<string, Track>();
  constructor(public score: Score) {
    for (const m of score.members) {
      const spb = 60 / (score.frame.tempo || 120);
      const range = m.instrument === "drums" ? null : INSTRUMENTS[m.instrument]?.range;
      const pocket = pocketOf(score, m.id);
      const felt = (score.parts[m.id] ?? []).map((x) => {
        // the same swing and pocket the audio engine plays
        const shift = pocket(x) / spb;
        const s = applyFeel(x.start, score.swing) + shift;
        let e = Math.max(s + 0.05, applyFeel(x.start + x.dur, score.swing) + shift);
        // mirror the audio engine's articulation lengths
        if (x.art === "staccato") e = s + Math.max(0.05, (e - s) * 0.5);
        if (x.art === "pizz") e = Math.min(e, s + 0.9 / spb);
        let p = Math.round(x.pitch);
        if (range) {
          while (p < range[0] - 12) p += 12;
          while (p > range[1] + 12) p -= 12;
        }
        return { s, e, p, x };
      });
      // a cymbal roll is mallet strokes getting louder up to the beat it lands on, where the
      // swell peaks and the part strikes its next note (the audio engine plays it as one swell)
      for (const r of felt.filter((f) => m.instrument === "drums" && f.x.art === "roll" && isCymbal(f.p))) {
        felt.splice(felt.indexOf(r), 1);
        const n = Math.max(1, Math.round((r.e - r.s) / ROLL_STEP));
        for (let k = 0; k < n; k++) {
          const s = r.s + ((r.e - r.s) * k) / n;
          felt.push({ s, e: s + ROLL_STEP, p: r.p, x: { ...r.x, start: s, dur: ROLL_STEP, vel: r.x.vel * (0.25 + (0.75 * (k + 1)) / n) } });
        }
      }
      // sorted by when they're heard (a late backbeat can land after a hat struck on the same beat)
      felt.sort((a, b) => a.s - b.s);
      const n = felt.length;
      const t: Track = {
        start: new Float64Array(n),
        end: new Float64Array(n),
        pitch: new Int16Array(n),
        vel: new Float32Array(n),
        art: new Array(n),
        maxDur: 0,
      };
      felt.forEach(({ s, e, p, x }, i) => {
        t.start[i] = s;
        t.end[i] = e;
        t.pitch[i] = p;
        t.vel[i] = x.vel;
        t.art[i] = x.art;
        t.maxDur = Math.max(t.maxDur, e - s);
      });
      if (bowsLines(m.instrument)) {
        // the bow strokes and phrases the line is played in, on the felt timeline
        const notes = felt.map((f) => f.x);
        const { strokes, strokeOf } = strokesOf(notes, score.frame.meter.beats);
        const phraseOf: number[] = new Array(n).fill(-1);
        const phrases = swellsOf(notes, score.frame.meter.beats).map(([a, b], k) => {
          let top = a;
          for (let i = a; i <= b; i++) {
            phraseOf[i] = k;
            if (t.pitch[i] > t.pitch[top]) top = i;
          }
          return { start: t.start[a], end: t.end[b], peak: t.start[top] };
        });
        t.bow = {
          strokeOf,
          strokes: strokes.map((s) => ({ start: t.start[s.first], end: Math.max(t.end[s.last], t.start[s.first] + 0.05), dir: s.dir })),
          phraseOf,
          phrases,
        };
      }
      this.tracks.set(m.id, t);
    }
  }

  /** Screen-relative direction from this member to whoever is featured in `bar`. */
  private lookX(memberId: string, bar: number): number {
    const ms = this.score.members;
    const bp = this.score.plan[bar];
    if (!bp || ms.length < 2) return 0;
    const i = ms.findIndex((m) => m.id === memberId);
    const j = ms.findIndex((m) => isFeaturedRole(bp.roles[m.id]) && m.instrument !== "drums");
    const jj = j >= 0 ? j : ms.findIndex((m) => isFeaturedRole(bp.roles[m.id]));
    if (i < 0 || jj < 0 || jj === i) return 0;
    return Math.max(-1, Math.min(1, (jj - i) / (ms.length - 1)));
  }

  /** Index of the last note starting at or before `beat` (or -1). */
  private lastStarted(t: Track, beat: number): number {
    let lo = 0;
    let hi = t.start.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (t.start[mid] <= beat) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans;
  }

  compute(memberId: string, beat: number, playing: boolean, spb: number): MemberFrameState {
    const score = this.score;
    const beats = score.frame.meter.beats;
    const bpm = score.frame.tempo;
    const bar = Math.max(0, Math.min(score.frame.bars - 1, Math.floor(beat / beats)));
    const bp = score.plan[bar];
    const role = bp?.roles[memberId] ?? "rest";
    const base: MemberFrameState = {
      playing,
      beat,
      beatPhase: ((beat % 1) + 1) % 1,
      bpm,
      beatsPerBar: beats,
      active: [],
      recent: [],
      nextOnsetIn: Infinity,
      nextPitch: null,
      role,
      energy: DYNAMIC_ENERGY[bp?.dynamic ?? "mf"],
      featured: isFeaturedRole(role),
      lookX: this.lookX(memberId, bar),
      mallets: !!STYLES[score.frame.style]?.mallets,
    };
    const t = this.tracks.get(memberId);
    if (!t || !playing || !Number.isFinite(beat)) return base;

    const i = this.lastStarted(t, beat);
    const active: ActiveNote[] = [];
    const recent: OnsetInfo[] = [];
    for (let j = i; j >= 0; j--) {
      const s = t.start[j];
      if (beat - s > t.maxDur + 0.01 && recent.length >= 6) break;
      if (t.end[j] > beat) {
        const durSec = (t.end[j] - s) * spb;
        active.push({ pitch: t.pitch[j], vel: t.vel[j], age: (beat - s) * spb, progress: Math.min(1, (beat - s) / (t.end[j] - s)), durSec, art: t.art[j] });
      }
      if (recent.length < 6) recent.push({ pitch: t.pitch[j], vel: t.vel[j], age: (beat - s) * spb, art: t.art[j] });
      if (active.length > 12) break;
    }
    const nx = i + 1 < t.start.length ? i + 1 : -1;
    base.active = active;
    base.recent = recent;
    if (nx >= 0) {
      base.nextOnsetIn = (t.start[nx] - beat) * spb;
      base.nextPitch = t.pitch[nx];
    }
    const upcoming: UpcomingOnset[] = [];
    for (let j = nx; j >= 0 && j < t.start.length && upcoming.length < 16; j++) {
      const inSec = (t.start[j] - beat) * spb;
      if (inSec > LOOKAHEAD_SEC) break;
      upcoming.push({ pitch: t.pitch[j], vel: t.vel[j], inSec, art: t.art[j] });
    }
    base.upcoming = upcoming;
    if (t.bow) this.bowing(base, t.bow, i, beat, spb);
    return base;
  }

  /** The stroke the bow is in (or the next one, while it's off the string), and the phrase. */
  private bowing(base: MemberFrameState, bow: NonNullable<Track["bow"]>, i: number, beat: number, spb: number) {
    const k = i >= 0 ? bow.strokeOf[i] : -1;
    const cur = k >= 0 && bow.strokes[k].end > beat ? k : -1;
    let id = cur;
    if (id < 0) {
      // between strokes: the next one, once it's near
      for (let j = Math.max(0, i + 1); j < bow.strokeOf.length; j++) {
        if (bow.strokeOf[j] < 0) continue;
        if ((bow.strokes[bow.strokeOf[j]].start - beat) * spb < 2) id = bow.strokeOf[j];
        break;
      }
    }
    if (id >= 0) {
      const s = bow.strokes[id];
      base.stroke = {
        id,
        dir: s.dir,
        progress: Math.max(0, Math.min(1, (beat - s.start) / Math.max(1e-6, s.end - s.start))),
        durSec: (s.end - s.start) * spb,
        inSec: Math.max(0, (s.start - beat) * spb),
      };
    }
    const p = i >= 0 ? bow.phraseOf[i] : -1;
    if (p >= 0 && bow.phrases[p].end > beat) {
      const ph = bow.phrases[p];
      const len = Math.max(1e-6, ph.end - ph.start);
      base.phrase = { progress: Math.min(1, (beat - ph.start) / len), peak: (ph.peak - ph.start) / len, durSec: len * spb };
    }
  }
}
