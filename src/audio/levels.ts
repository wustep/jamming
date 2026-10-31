import { DRUM, INSTRUMENT_LIST, INSTRUMENTS } from "@/music/instruments";
import type { InstrumentId, NoteEvent, Score } from "@/music/types";
import { TroopAudio } from "./engine";
import { AUDIO_FIXTURE } from "./fixture";
import { bufferLoudness, loudness, type Loudness } from "./loudness";
import { DEFAULT_SOUNDS, instrumentVolume, packChain, type Sounds } from "./packs";

// How loud each pack and each player is, the way a listener hears it (loudness.ts), read off
// charts bounced offline through the engine itself (TroopAudio.bounce). The audio lab runs it.

// ─── The packs: one line each ────────────────────────────────────────────────

const TEST_TEMPO = 120;
const TEST_BARS = 4;

/**
 * The line every pack is matched on: in the middle of the instrument's sweet range, at one touch
 * (0.7 unless asked), short notes and held ones, two bars of each. The drums play a plain groove.
 */
export function testLine(instrument: InstrumentId, vel = 0.7): NoteEvent[] {
  const n = (pitch: number, start: number, dur: number): NoteEvent => ({ pitch, start, dur, vel });
  if (instrument === "drums") {
    const out: NoteEvent[] = [];
    for (let beat = 0; beat < TEST_BARS * 4; beat++) {
      out.push(n(DRUM.ride, beat, 0.5));
      if (beat % 2 === 1) out.push(n(DRUM.hatPedal, beat, 0.25), n(DRUM.snare, beat, 0.25));
      else out.push(n(DRUM.kick, beat, 0.25));
    }
    return out;
  }
  const [lo, hi] = INSTRUMENTS[instrument].sweet;
  const mid = Math.round((lo + hi) / 2);
  const steps = [0, 2, 4, 5, 7, 5, 4, 2];
  const out: NoteEvent[] = [];
  // two bars of eighths and quarters, then a half note, a whole note and a dotted half
  steps.forEach((s, i) => out.push(n(mid + s - 3, i * 0.5, 0.5)));
  steps.slice(0, 4).forEach((s, i) => out.push(n(mid + s, 4 + i, 1)));
  out.push(n(mid + 4, 8, 2), n(mid, 10, 2), n(mid - 3, 12, 4));
  return out;
}

function soloScore(instrument: InstrumentId, notes: NoteEvent[]): Score {
  const member = { id: "solo", animal: "fox" as const, name: "Solo", instrument };
  return {
    ...AUDIO_FIXTURE,
    id: `levels-${instrument}`,
    members: [member],
    parts: { solo: notes },
    swing: 0.5,
    frame: { ...AUDIO_FIXTURE.frame, tempo: TEST_TEMPO, bars: TEST_BARS, leaderId: "solo" },
    settings: { ...AUDIO_FIXTURE.settings, tempo: TEST_TEMPO, bars: TEST_BARS, leaderId: "solo" },
  };
}

/**
 * The packs are compared at a quiet master, under the bus compressor's knee, so a peaky one (the
 * e-pianos' tines) isn't squashed into reading quieter than it plays against the rest.
 */
export const PACK_MASTER = 0.25;

export interface PackLevel extends Loudness {
  instrument: InstrumentId;
  pack: string;
  volume: number;
  failed: boolean;
}

/** Each instrument's pack playing the test line, rendered offline at its own volume (at PACK_MASTER). */
export async function measurePacks(sounds: Sounds = DEFAULT_SOUNDS, only: InstrumentId[] = INSTRUMENT_LIST, vel = 0.7): Promise<PackLevel[]> {
  const out: PackLevel[] = [];
  for (const instrument of only) {
    const { buffer, stats } = await TroopAudio.bounce(soloScore(instrument, testLine(instrument, vel)), { sounds, master: PACK_MASTER });
    const spec = packChain(instrument, sounds)[0];
    out.push({ instrument, pack: spec.pack, volume: spec.volume ?? instrumentVolume(instrument, sounds), failed: stats.failedInstruments.length > 0, ...bufferLoudness(buffer) });
  }
  return out;
}

// ─── A take: the band, and each player alone ─────────────────────────────────

type Player = { id: string; instrument: InstrumentId };

export interface SectionLevels {
  name: string;
  kind: string;
  /** Who's featured: the leader in a head, the soloist in a solo. */
  featured: string[];
  mix: Loudness;
  players: (Loudness & Player)[];
}

export interface TakeLevels {
  mix: Loudness;
  /** Each player over the whole take (over what they play: rests aren't counted). */
  players: (Loudness & Player)[];
  /** The same, section by section: who's on top changes with the roles. */
  sections: SectionLevels[];
}

function slice(buffer: AudioBuffer, from: number, to: number): Float32Array[] {
  const a = Math.max(0, Math.round(from * buffer.sampleRate));
  const b = Math.min(buffer.length, Math.round(to * buffer.sampleRate));
  return Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c).slice(a, b));
}

/** A whole take bounced, then each player on their own (their part as the band plays it). */
export async function measureTake(score: Score, sounds: Sounds = DEFAULT_SOUNDS): Promise<TakeLevels> {
  const whole = await TroopAudio.bounce(score, { sounds });
  const alone: (Player & { buffer: AudioBuffer })[] = [];
  for (const m of score.members) {
    const part: Score = { ...score, members: [m], parts: { [m.id]: score.parts[m.id] ?? [] } };
    alone.push({ id: m.id, instrument: m.instrument, buffer: (await TroopAudio.bounce(part, { sounds })).buffer });
  }
  const beats = score.frame.meter.beats;
  const sections = score.frame.sections.map((sec) => {
    const from = whole.at(sec.start * beats);
    const to = whole.at((sec.start + sec.length) * beats);
    const sr = whole.buffer.sampleRate;
    return {
      name: sec.name,
      kind: sec.kind,
      featured: sec.featured ?? (sec.kind === "head" || sec.kind === "out" ? [score.frame.leaderId] : []),
      mix: loudness(slice(whole.buffer, from, to), sr),
      players: alone.map((p) => ({ id: p.id, instrument: p.instrument, ...loudness(slice(p.buffer, from, to), sr) })),
    };
  });
  return {
    mix: bufferLoudness(whole.buffer),
    players: alone.map((p) => ({ id: p.id, instrument: p.instrument, ...bufferLoudness(p.buffer) })),
    sections,
  };
}
