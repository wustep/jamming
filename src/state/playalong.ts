"use client";

import { create } from "zustand";
import { troopAudio } from "@/audio/engine";
import { hasWebMidi, listenToMidi, requestMidi, type MidiInputInfo } from "@/audio/midi";
import { INSTRUMENTS } from "@/music/instruments";
import { blockAt, callBlocks, leaveSpace, PhraseCapture, placeNote, QUANTIZE, type Block, type MidiMessage, type QuantizeMode } from "@/music/live";
import type { InstrumentId, NoteEvent, OnsetInfo, Score } from "@/music/types";

// You, in the band: notes from a MIDI keyboard, the on-screen keys or the computer keyboard
// sound on an instrument of your choosing over whatever the band is playing, placed on the
// band's beat the way you heard it. With call and response on, the band leaves you a few bars
// and the soloist answers with your phrase.

/** The slice of the audio engine playing along needs (a fake stands in for it in tests). */
export interface LiveAudio {
  liveOn(pitch: number, vel: number, at?: number): void;
  liveOff(pitch: number, at?: number): void;
  liveAllOff(): void;
  heardBeatAt(perfMs: number): number;
  timeOfBeat(beat: number): number | null;
  getSwing(): number;
  getBeat(): number;
  updateScore(score: Score): void;
}

export interface CallResponse {
  on: boolean;
  /** Bars per turn: you get this many, then the answer gets as many. */
  every: number;
}

/** A note you played, for drawing you on stage (performance-clock times). */
interface Struck {
  pitch: number;
  vel: number;
  at: number;
  off: number | null;
}

/**
 * The play-along brain without React: note on/off from any source, the sustain pedal, placing
 * notes on the beat, and collecting what you play in your turns so the band can answer it.
 */
export class PlayAlongCore {
  quantize: QuantizeMode = "off";
  callResponse: CallResponse = { on: false, every: 2 };
  /** The chart as written (the band's take), and as played with room left for you. */
  private base: Score | null = null;
  private arranged: Score | null = null;
  private blocks: Block[] = [];
  private capture = new PhraseCapture();
  /** What you played in each turn, by round. */
  private calls: Record<number, NoteEvent[]> = {};
  private sustain = false;
  private sustained = new Set<number>();
  private dirty = false;
  private lastRound = -1;
  /** Notes sounding and recently struck, newest last. */
  readonly struck: Struck[] = [];

  constructor(
    private audio: LiveAudio,
    private onArranged: (score: Score | null) => void = () => {},
    private onHeld: (pitches: number[]) => void = () => {},
  ) {}

  /** The score to start the band on: the chart, with room left for you when it's your game. */
  arrangeForPlay(score: Score): Score {
    this.base = score;
    this.calls = {};
    this.capture.clear();
    this.lastRound = -1;
    return this.rearrange();
  }

  /** The band's chart changed under a running take (the band is still improvising it, a new tempo). */
  arrangeUpdate(score: Score): Score {
    this.base = score;
    return this.rearrange();
  }

  setCallResponse(cr: CallResponse) {
    this.callResponse = cr;
    if (this.base) this.audio.updateScore(this.rearrange());
  }

  /** Whose turn it is at a bar, while call and response is on. */
  turnAt(bar: number): Block | null {
    return this.callResponse.on && this.arranged ? blockAt(this.blocks, bar) : null;
  }

  getArranged(): Score | null {
    return this.arranged;
  }

  private rearrange(): Score {
    const base = this.base!;
    if (!this.callResponse.on) {
      this.arranged = null;
      this.blocks = [];
      this.onArranged(null);
      return base;
    }
    this.blocks = callBlocks(base, this.callResponse.every);
    this.arranged = leaveSpace(base, this.callResponse.every, this.calls);
    this.dirty = false;
    this.onArranged(this.arranged);
    return this.arranged;
  }

  /** The chart beat (straight grid) a note played at `perfMs` belongs on, or null when the band is stopped. */
  private beatOf(perfMs: number): number | null {
    const heard = this.audio.heardBeatAt(perfMs);
    if (!Number.isFinite(heard)) return null;
    return placeNote(heard, this.audio.getSwing(), QUANTIZE[this.quantize]);
  }

  noteOn(pitch: number, vel: number, perfMs: number) {
    const beat = this.beatOf(perfMs);
    let at: number | undefined;
    // a note pulled onto the grid that was played early waits for the band's beat (a late one can't be helped)
    if (beat !== null && this.quantize !== "off") {
      const heard = placeNote(this.audio.heardBeatAt(perfMs), this.audio.getSwing(), null);
      if (beat > heard) at = this.audio.timeOfBeat(beat) ?? undefined;
    }
    this.sustained.delete(pitch);
    this.audio.liveOn(pitch, vel, at);
    this.struck.push({ pitch, vel, at: perfMs, off: null });
    if (this.struck.length > 24) this.struck.splice(0, this.struck.length - 24);
    if (beat !== null && this.inCall(beat)) this.capture.on(pitch, vel, beat);
    this.emitHeld();
  }

  noteOff(pitch: number, perfMs: number) {
    if (this.sustain) {
      this.sustained.add(pitch);
      this.markOff(pitch, perfMs);
      this.emitHeld();
      return;
    }
    this.release(pitch, perfMs);
    this.emitHeld();
  }

  private release(pitch: number, perfMs: number) {
    this.audio.liveOff(pitch);
    this.markOff(pitch, perfMs);
    const beat = this.beatOf(perfMs);
    const note = this.capture.off(pitch, beat ?? 0);
    if (note) this.keep(note);
  }

  private markOff(pitch: number, perfMs: number) {
    for (let i = this.struck.length - 1; i >= 0; i--) {
      const s = this.struck[i];
      if (s.pitch === pitch && s.off === null) {
        s.off = perfMs;
        break;
      }
    }
  }

  setSustain(down: boolean, perfMs: number) {
    this.sustain = down;
    if (down) return;
    for (const p of [...this.sustained]) this.release(p, perfMs);
    this.sustained.clear();
    this.emitHeld();
  }

  allOff(perfMs: number) {
    this.sustain = false;
    for (const s of this.struck) if (s.off === null) this.release(s.pitch, perfMs);
    this.sustained.clear();
    this.audio.liveAllOff();
    this.emitHeld();
  }

  midi(msg: MidiMessage, perfMs: number) {
    if (msg.type === "on") this.noteOn(msg.pitch, msg.vel, perfMs);
    else if (msg.type === "off") this.noteOff(msg.pitch, perfMs);
    else if (msg.type === "sustain") this.setSustain(msg.down, perfMs);
    else this.allOff(perfMs);
  }

  /** Pitches sounding right now (held, or ringing on the pedal). */
  held(): number[] {
    return this.struck.filter((s) => s.off === null || this.sustained.has(s.pitch)).map((s) => s.pitch);
  }

  private emitHeld() {
    this.onHeld([...new Set(this.held())]);
  }

  /**
   * Your turn at this beat, if it is. A note pushed a hair ahead of your turn's downbeat (up to
   * an 8th) still belongs to it: that's someone coming in on the one, not playing over the band.
   */
  private callAt(beat: number): Block | null {
    if (!this.callResponse.on || !this.base) return null;
    const beats = this.base.frame.meter.beats;
    const b = blockAt(this.blocks, Math.floor(beat / beats + 1e-9));
    if (b?.kind === "call") return b;
    const next = blockAt(this.blocks, Math.floor((beat + EARLY_GRACE) / beats + 1e-9));
    return next?.kind === "call" && next.start * beats > beat ? next : null;
  }

  private inCall(beat: number): boolean {
    return !!this.callAt(beat);
  }

  private keep(note: NoteEvent) {
    const b = this.callAt(note.start);
    if (!b || !this.base) return;
    const beats = this.base.frame.meter.beats;
    // an early note starts the turn; one held past its end ends with it
    const start = Math.max(note.start, b.start * beats);
    const end = Math.min(note.start + note.dur, (b.start + b.bars) * beats);
    (this.calls[b.round] ??= []).push({ ...note, start, dur: Math.max(0.1, end - start) });
    this.dirty = true;
  }

  /**
   * Called a few times a second while playing: at the end of your turn, notes still held are
   * cut there, and anything new you played goes to the band so the answer can be played.
   */
  tick(perfMs: number) {
    if (!this.callResponse.on || !this.base) return;
    const beat = this.beatOf(perfMs);
    if (beat === null) return;
    const bar = Math.floor(beat / this.base.frame.meter.beats + 1e-9);
    const b = blockAt(this.blocks, bar);
    if (b?.kind === "answer" && b.round !== this.lastRound) {
      this.lastRound = b.round;
      const call = this.blocks.find((x) => x.kind === "call" && x.round === b.round);
      if (call) for (const n of this.capture.release((call.start + call.bars) * this.base.frame.meter.beats)) this.keep(n);
    }
    if (this.dirty) this.audio.updateScore(this.rearrange());
  }

  /** Your notes for the stage: what's sounding and what was just played, as a player's frame state wants them. */
  frame(perfMs: number): { active: { pitch: number; vel: number; age: number }[]; recent: OnsetInfo[] } {
    const active: { pitch: number; vel: number; age: number }[] = [];
    const recent: OnsetInfo[] = [];
    for (let i = this.struck.length - 1; i >= 0; i--) {
      const s = this.struck[i];
      const age = Math.max(0, (perfMs - s.at) / 1000);
      if (s.off === null || this.sustained.has(s.pitch)) active.push({ pitch: s.pitch, vel: s.vel, age });
      if (recent.length < 6) recent.push({ pitch: s.pitch, vel: s.vel, age });
    }
    return { active, recent };
  }
}

/** How early (beats) a note can come in and still count as the start of your turn. */
const EARLY_GRACE = 0.5;

// ─── The store ───────────────────────────────────────────────────────────────

export type MidiStatus = "unsupported" | "off" | "asking" | "denied" | "ready";

interface PlayAlongState {
  /** The play-along panel is open (MIDI and the typing keys only listen while it is). */
  open: boolean;
  instrument: InstrumentId;
  quantize: QuantizeMode;
  callResponse: CallResponse;
  midi: MidiStatus;
  inputs: MidiInputInfo[];
  /** The instrument is loading, or failed to. */
  loading: boolean;
  loadError: string | null;
  held: number[];
  /** The typing keyboard's C (A key). */
  typingBase: number;
  /** The chart as the band plays it with room left for you (null when call and response is off). */
  arranged: Score | null;
  setOpen(open: boolean): void;
  setInstrument(id: InstrumentId): void;
  setQuantize(q: QuantizeMode): void;
  setCallResponse(patch: Partial<CallResponse>): void;
  shiftOctave(by: number): void;
  connectMidi(): Promise<void>;
}

const LS = "jamming:play-along";

type Saved = Pick<PlayAlongState, "instrument" | "quantize" | "callResponse">;

function load(): Partial<Saved> {
  try {
    const raw = localStorage.getItem(LS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(LS, JSON.stringify({ instrument: s.instrument, quantize: s.quantize, callResponse: s.callResponse }));
  } catch {
    /* private mode */
  }
}

let unlisten: (() => void) | null = null;
/** The play-along brain, shared by the store's transport, the stage and the keys. */
let playAlong: PlayAlongCore;
let ticker: ReturnType<typeof setInterval> | null = null;

export const usePlayAlong = create<PlayAlongState>((set, get) => {
  const core = new PlayAlongCore(
    troopAudio,
    (arranged) => set({ arranged }),
    (held) => set({ held }),
  );
  playAlong = core;

  const loadInstrument = async (id: InstrumentId) => {
    set({ loading: true, loadError: null });
    await troopAudio.unlock().catch(() => {});
    const r = await troopAudio.prepareLive(id);
    if (get().instrument !== id) return;
    set({ loading: false, loadError: r.ready ? null : (r.error ?? "it wouldn't load") });
  };

  const persist = () => save(get());

  return {
    open: false,
    instrument: "piano",
    quantize: "off",
    callResponse: { on: false, every: 2 },
    midi: "off",
    inputs: [],
    loading: false,
    loadError: null,
    held: [],
    typingBase: 60,
    arranged: null,

    setOpen(open) {
      if (open === get().open) return;
      if (open) {
        const saved = load();
        const instrument = saved.instrument && INSTRUMENTS[saved.instrument] ? saved.instrument : get().instrument;
        const quantize: QuantizeMode = saved.quantize === "light" ? "light" : "off";
        const cr = saved.callResponse ? { on: !!saved.callResponse.on, every: saved.callResponse.every === 4 ? 4 : 2 } : get().callResponse;
        core.quantize = quantize;
        set({ open, instrument, quantize, callResponse: cr, midi: hasWebMidi() ? get().midi : "unsupported" });
        core.setCallResponse(cr);
        void loadInstrument(instrument);
        if (hasWebMidi()) void get().connectMidi();
        // a few times a second: close your turn, hand the band what you played
        ticker ??= setInterval(() => core.tick(performance.now()), 60);
      } else {
        core.allOff(performance.now());
        core.setCallResponse({ ...get().callResponse, on: false });
        unlisten?.();
        unlisten = null;
        if (ticker) clearInterval(ticker);
        ticker = null;
        set({ open, held: [], midi: get().midi === "ready" ? "off" : get().midi, inputs: [] });
      }
    },

    setInstrument(instrument) {
      core.allOff(performance.now());
      set({ instrument });
      persist();
      void loadInstrument(instrument);
    },

    setQuantize(quantize) {
      core.quantize = quantize;
      set({ quantize });
      persist();
    },

    setCallResponse(patch) {
      const callResponse = { ...get().callResponse, ...patch };
      set({ callResponse });
      persist();
      if (get().open) core.setCallResponse(callResponse);
    },

    shiftOctave(by) {
      core.allOff(performance.now());
      set((s) => ({ typingBase: Math.max(24, Math.min(96, s.typingBase + by * 12)) }));
    },

    async connectMidi() {
      if (!hasWebMidi()) {
        set({ midi: "unsupported" });
        return;
      }
      set({ midi: "asking" });
      const access = await requestMidi();
      if (!get().open) return;
      if (access === "unsupported" || access === "denied") {
        set({ midi: access });
        return;
      }
      unlisten?.();
      unlisten = listenToMidi(
        access,
        (msg, t) => core.midi(msg, t),
        (inputs) => set({ inputs }),
      );
      set({ midi: "ready" });
    },
  };
});

/** The chart to start the band on (room left for you when call and response is on). */
export function arrangeForPlay(score: Score): Score {
  return playAlong.arrangeForPlay(score);
}

/** The chart that's playing changed (the band is still improvising it, or a new tempo). */
export function arrangeUpdate(score: Score): Score {
  return playAlong.arrangeUpdate(score);
}

/** The play-along brain (the keys and the stage talk to it directly, outside React). */
export function liveCore(): PlayAlongCore {
  usePlayAlong.getState();
  return playAlong;
}
