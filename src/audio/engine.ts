import { DrumMachine, Reverb, Scheduler, type Smplr, type StopFn } from "smplr";
import type { InstrumentId, Member, NoteEvent, Score } from "@/music/types";
import { INSTRUMENTS, isCymbal } from "@/music/instruments";
import { STYLES } from "@/music/styles";
import { applyFeel, beatAt, beatToSeconds, ghostVel, jitter, pocketOf, secAt, spbAt, type TempoMap } from "./feel";
import {
  DECAYING,
  instrumentVolume,
  kitHas,
  kitKeys,
  MALLET_KEY,
  REVERB_SEND,
  lm2Sample,
  packChain,
  pizzChain,
  PIZZ_VOLUME,
  RELEASE_SEC,
  ROOM_SEND,
  DEFAULT_SOUNDS,
  SWELL_RING,
  swellFor,
  type DrumKit,
  type PackSpec,
  type PianoPack,
  type Sounds,
} from "./packs";
import { tuneRoom } from "./room";
import { bowedOf, planBow, type BowJoin, type BowPlan } from "./bowed";
import { VOICE_CAP, VoiceBook, drumRing } from "./voices";
import { articulate, feelOf, metricLift, type PlayingFeel } from "@/music/playing";
import { CountingStorage } from "./storage";

// Playback engine: smplr sampled instruments driven by our own lookahead scheduler on the
// AudioContext clock. Charts are straight-grid; swing + humanisation happen here.

export type LoadState = {
  memberId: string;
  instrument: InstrumentId;
  loaded: number;
  total: number;
  ready: boolean;
  error?: string;
  pack: string;
};

export type TransportState = "stopped" | "loading" | "playing";

export interface PlaybackStats {
  scheduled: number;
  late: number;
  dropped: number;
  perMember: Record<string, number>;
  failedInstruments: string[];
  startedAt: number | null;
}

interface InstEntry {
  key: string;
  instrument: InstrumentId;
  chain: PackSpec[];
  spec: PackSpec | null;
  inst: Smplr | null;
  storage: CountingStorage | null;
  loaded: number;
  total: number;
  ready: boolean;
  failed: boolean;
  error?: string;
  pack: string;
  /** Resolves when ready or definitively failed. Never rejects. */
  done: Promise<void>;
  notes: Set<number>;
  /** When every pack failed (ms), so a later prepare can try again. */
  failedAt?: number;
  /** Last time a member was assigned this entry (a counter), for keeping a few spares. */
  used: number;
}

/** Unused instruments kept loaded so switching back is instant; older ones are disposed. */
const SPARE_ENTRIES = 3;
/** A failed instrument is retried on a later prepare, but not more often than this. */
const RETRY_FAILED_MS = 5000;

interface Track {
  memberId: string;
  instrument: InstrumentId;
  entryKey: string;
  notes: NoteEvent[];
  cursor: number;
  /** Start beat of the last scheduled note (for updateScore re-sync). */
  lastStart: number;
  lastOpenHat: number;
  /** Where this player sits against the beat, per note (seconds; see pocketOf). */
  pocket: (n: NoteEvent) => number;
  /** How the chart is played: touch, note lengths, how loose the time is (see playing.ts). */
  feel: PlayingFeel;
  beats: number;
  /** What this player has ringing: a restruck pitch and voices past the cap let go (voices.ts). */
  voices: VoiceBook;
  /** Numbers each started voice, so it can be let go on its own. */
  serial: number;
  /** A drummer playing soft mallets (the style's): cymbals and toms use the kit's mallet keys. */
  mallets: boolean;
}

type SmplrNote = Exclude<Parameters<Smplr["start"]>[0], string | number>;

const LOOKAHEAD_SEC = 0.15;
const LOOKAHEAD_HIDDEN_SEC = 1.5;
const TICK_MS = 25;
const START_DELAY_SEC = 0.12;
const READY_WAIT_MS = 8000;
/** How long to wait for a suspended AudioContext to resume (browsers leave the promise pending without a gesture). */
const RESUME_WAIT_MS = 1500;
/**
 * iOS plays Web Audio as "ambient" sound, which the ring/silent switch mutes, so on a phone set
 * to silent the band made no sound at all. A music app plays as "playback" (Safari 16.4+); other
 * browsers have no audio session and carry on as they were.
 */
function playThroughSilentSwitch() {
  try {
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== "playback") session.type = "playback";
  } catch {
    /* not settable here */
  }
}

/** +4 dB after the bus compressor (the limiter adds ~2.3 dB of its own make-up): see ensureContext. */
const MAKEUP_GAIN = 1.6;
const END_TAIL_SEC = 0.8;
/** How long a pitched note's voice goes on after its written end (the packs' releases run 0.3–0.7 s). */
const RING_SEC = 0.4;
const PAN_WIDTH = 0.65;

/** The volume slider's gain: squared, so its travel follows the ear (halfway is −12 dB). */
export const volumeGain = (level: number) => level * level;

const sortedCache = new WeakMap<NoteEvent[], NoteEvent[]>();
function sortedNotes(notes: NoteEvent[] | undefined): NoteEvent[] {
  if (!notes) return [];
  const hit = sortedCache.get(notes);
  if (hit) return hit;
  const out = notes
    .filter((n) => n && Number.isFinite(n.start) && Number.isFinite(n.pitch))
    .slice()
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch);
  sortedCache.set(notes, out);
  return out;
}

/** First index whose start >= beat. */
function lowerBound(notes: NoteEvent[], beat: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].start < beat - 1e-9) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index whose start > beat. */
function upperBound(notes: NoteEvent[], beat: number): number {
  let lo = 0;
  let hi = notes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid].start <= beat + 1e-9) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

function beatsPerBar(score: Score): number {
  return score.frame?.meter?.beats ?? score.settings?.meter?.beats ?? 4;
}

function tempoOf(score: Score): number {
  const t = score.frame?.tempo ?? score.settings?.tempo ?? 120;
  return clamp(Number.isFinite(t) ? t : 120, 30, 320);
}

/** Last beat that holds sound (or the chart's length, whichever is later). */
function endBeatOf(score: Score): number {
  const bars = score.frame?.bars ?? score.plan?.length ?? 0;
  let end = bars * beatsPerBar(score);
  for (const notes of Object.values(score.parts ?? {})) {
    for (const n of notes) end = Math.max(end, n.start + Math.max(0, n.dur));
  }
  return end;
}

/** Whether this score's drummer plays soft mallets (its style says so). */
const malletsIn = (score: Score) => !!STYLES[score.frame?.style]?.mallets;

/**
 * Pitches each member will need (handy as `prepare(..., { notesHint })`). Plucked notes on bowed
 * strings go under "<id>|pizz"; a drummer's include the kit's mallet and swell keys it plays.
 */
export function notesHintFromScore(score: Score): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [id, notes] of Object.entries(score.parts ?? {})) {
    out[id] = [...new Set(notes.filter((n) => n.art !== "pizz").map((n) => n.pitch))];
    if (score.members?.find((m) => m.id === id)?.instrument === "drums") out[id].push(...kitKeys(notes, malletsIn(score), 60 / (tempoOf(score) || 120)));
    const pizz = notes.filter((n) => n.art === "pizz");
    if (pizz.length) out[`${id}|pizz`] = [...new Set(pizz.map((n) => n.pitch))];
  }
  return out;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof AudioContext !== "undefined";
}


/** Recording formats, best first: Opus in WebM (Chrome, Firefox), AAC in MP4 (Safari). */
const RECORD_TYPES = ["audio/webm;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];

export class TroopAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** The end of the mix: the level meter and recordings listen here. */
  private output: DynamicsCompressorNode | null = null;
  /** The volume slider, between the end of the mix and the speakers (see setVolume). */
  private monitor: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private levelBuf: Float32Array<ArrayBuffer> | null = null;
  private reverb: ReturnType<typeof Reverb> | null = null;
  private scheduler: ReturnType<typeof Scheduler> | null = null;
  private entries = new Map<string, InstEntry>();
  private memberEntry = new Map<string, string>();
  private memberPan = new Map<string, number>();
  private useCounter = 0;
  private currentMembers: Member[] = [];
  private loadListeners = new Set<(s: LoadState[]) => void>();
  private endListeners = new Set<() => void>();
  private failListeners = new Set<(message: string) => void>();
  private muted = new Set<string>();
  private masterVolume = 0.85;
  private volume = 1;
  private sounds: Sounds = DEFAULT_SOUNDS;

  private click: Smplr | null = null;
  private clickReady: Promise<void> | null = null;

  private state: TransportState = "stopped";
  private playToken = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private score: Score | null = null;
  private tracks: Track[] = [];
  private spb = 0.5;
  /** Ritardando into the ending, from the score (beats). */
  private rit: Score["rit"] = undefined;
  private t0 = 0; // ctx time of beat 0 (current loop iteration)
  private prevT0 = 0; // previous iteration (for getBeat right at a loop seam)
  private startBeat = 0;
  private endBeat = 0;
  private loop = false;
  private clicks: { time: number; accent: boolean }[] = [];
  private stats: PlaybackStats = this.freshStats();
  /** The instrument you play along on (see prepareLive), and the notes you're holding down. */
  private live: { key: string; instrument: InstrumentId; held: Map<number, StopFn> } | null = null;

  /**
   * An engine that plays into an offline context (see bounce) instead of the speakers. It's only
   * ever prepared and handed notes: never resumed, recorded, played along on or asked the time.
   */
  constructor(private offline: OfflineAudioContext | null = null) {}

  // ─── Context ───────────────────────────────────────────────────────────────

  private ensureContext(): AudioContext | null {
    if (!isBrowser()) return null;
    if (this.ctx && this.ctx.state !== "closed") return this.ctx;
    let ctx: AudioContext;
    if (this.offline) {
      ctx = this.offline as BaseAudioContext as AudioContext;
    } else {
      playThroughSilentSwitch();
      ctx = new AudioContext({ latencyHint: "interactive" });
      // A phone suspends audio (iOS "interrupts" it) when the app goes to the background or a call
      // comes in. The clock stops with it, so the take stops too rather than sitting frozen and
      // silent behind a Stop button; Play starts it again (and resumes the audio).
      ctx.addEventListener("statechange", () => {
        if (this.ctx === ctx && ctx.state !== "running" && this.state === "playing") this.halt(true);
      });
    }
    this.ctx = ctx;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 12;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.2;
    // The packs are level-matched low (~−31 dB RMS each), so a whole band came out at −21 to
    // −28 LUFS with peaks 6–14 dB under full scale: quieter than anything else on a phone.
    // Make-up gain brings it to about −15 to −22 LUFS, and a fast limiter (the compressor's own
    // 6 ms look-ahead, 20:1 from −4 dB; Web Audio adds make-up of its own) holds a full band's
    // loudest hits near −1.5 dBFS.
    const loudness = ctx.createGain();
    loudness.gain.value = MAKEUP_GAIN;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    const monitor = ctx.createGain();
    monitor.gain.value = volumeGain(this.volume);
    compressor.connect(loudness).connect(limiter).connect(monitor).connect(ctx.destination);
    this.monitor = monitor;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    limiter.connect(analyser);
    this.analyser = analyser;
    this.levelBuf = new Float32Array(analyser.fftSize);
    const master = ctx.createGain();
    master.gain.value = this.masterVolume;
    master.connect(compressor);
    this.master = master;
    this.output = limiter;
    try {
      const reverb = Reverb(ctx);
      reverb.connect(master);
      this.reverb = reverb;
      // the room is tuned once the worklet is up (and again whenever the room changes)
      void reverb.ready().then(() => {
        if (this.reverb === reverb) tuneRoom(reverb, this.sounds.room, ctx.sampleRate);
      });
    } catch (err) {
      console.warn("[audio] reverb unavailable", err);
      this.reverb = null;
    }
    // Large lookahead so every note we hand smplr is dispatched synchronously; we own timing.
    // (Offline, the whole render is the lookahead: its clock only moves once every note is in.)
    const lookaheadMs = this.offline ? (this.offline.length / this.offline.sampleRate) * 1000 + 1000 : 4000;
    this.scheduler = Scheduler(ctx, { lookaheadMs, intervalMs: 50 });
    this.entries.clear();
    this.click = null;
    this.clickReady = null;
    return ctx;
  }

  async unlock(): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      if (ctx.state !== "running") await this.resume(ctx);
      // iOS: play a silent buffer inside the gesture.
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
    } catch (err) {
      console.warn("[audio] unlock failed", err);
    }
    this.ensureClick();
  }

  /** Resume the context, giving up after a moment rather than waiting on a gesture forever. */
  private async resume(ctx: AudioContext): Promise<boolean> {
    try {
      await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, RESUME_WAIT_MS))]);
    } catch {
      /* needs a gesture */
    }
    return ctx.state === "running";
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  // ─── Loading ───────────────────────────────────────────────────────────────

  async prepare(
    members: Member[],
    opts?: { sounds?: Sounds; notesHint?: Record<string, number[]> },
  ): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (opts?.sounds) this.setSounds(opts.sounds);
    this.currentMembers = members.slice();
    this.assignEntries(members);
    this.ensureClick();

    const waits: Promise<void>[] = [];
    for (const m of members) {
      const key = this.memberEntry.get(m.id);
      if (!key) continue;
      const hint = opts?.notesHint?.[m.id];
      const entry = this.getEntry(key, m.instrument, hint);
      // bowed strings that pluck in this chart also need a pizzicato voice
      const pizzHint = opts?.notesHint?.[`${m.id}|pizz`];
      if (INSTRUMENTS[m.instrument]?.bowed && pizzHint?.length) {
        const pz = this.getEntry(`${key}|pizz`, m.instrument, pizzHint, pizzChain());
        waits.push(pz.done);
      }
      const pan = this.memberPan.get(m.id) ?? 0;
      if (entry.inst) {
        try {
          entry.inst.output.pan = pan;
        } catch {
          /* disposed */
        }
      }
      if (hint && hint.length && entry.spec?.extend && entry.inst && entry.ready) {
        const fresh = hint.filter((n) => !entry.notes.has(n));
        if (fresh.length) {
          for (const n of fresh) entry.notes.add(n);
          const inst = entry.inst;
          const storage = entry.storage;
          waits.push(
            entry.spec
              .extend(inst, [...entry.notes], storage?.failedUrls ?? new Set())
              .catch((err) => console.warn("[audio] extend failed", err)),
          );
        }
      }
      waits.push(entry.done);
    }
    this.sweepEntries();
    this.emitLoad();
    await Promise.all(waits);
    this.emitLoad();
  }

  /**
   * Dispose instruments nobody on stage uses any more (keeping a few recent spares), so swapping
   * instruments, piano packs or bands doesn't pile up decoded samples. Only while nothing is
   * sounding: smplr's dispose() also clears the shared scheduler's queue.
   */
  private sweepEntries() {
    if (this.state === "playing") return;
    const inUse = new Set<string>();
    for (const key of this.memberEntry.values()) inUse.add(key).add(`${key}|pizz`);
    if (this.live) inUse.add(this.live.key);
    const idle = [...this.entries.values()]
      .filter((e) => !inUse.has(e.key) && (e.ready || e.failed))
      .sort((a, b) => b.used - a.used);
    for (const e of idle.slice(SPARE_ENTRIES)) {
      try {
        bowedOf(e.inst)?.dispose();
        e.inst?.dispose();
      } catch {
        /* already gone */
      }
      this.entries.delete(e.key);
    }
  }

  /** Map members → instrument-instance keys. Duplicate instruments get their own instance (own pan). */
  private assignEntries(members: Member[]) {
    const seen = new Map<InstrumentId, number>();
    const n = members.length;
    // only the members being prepared keep an entry (a score already playing holds its own keys)
    this.memberEntry.clear();
    this.memberPan.clear();
    const used = ++this.useCounter;
    members.forEach((m, i) => {
      const k = seen.get(m.instrument) ?? 0;
      seen.set(m.instrument, k + 1);
      const pack = m.instrument === "piano" ? this.sounds.piano : m.instrument === "drums" ? this.sounds.drums : m.instrument === "pad" ? this.sounds.pad : "default";
      const key = `${m.instrument}:${pack}#${k}`;
      this.memberEntry.set(m.id, key);
      for (const e of [this.entries.get(key), this.entries.get(`${key}|pizz`)]) if (e) e.used = used;
      const fn = INSTRUMENTS[m.instrument]?.fn;
      const spread = n > 1 ? -1 + (2 * i) / (n - 1) : 0;
      const width = fn === "bass" || fn === "rhythm" ? PAN_WIDTH * 0.35 : PAN_WIDTH;
      this.memberPan.set(m.id, spread * width);
    });
  }

  private getEntry(key: string, instrument: InstrumentId, hint?: number[], chain?: PackSpec[]): InstEntry {
    const existing = this.entries.get(key);
    // one network blip shouldn't silence a player until reload: try a failed instrument again
    const retry = existing?.failed && Date.now() - (existing.failedAt ?? 0) > RETRY_FAILED_MS;
    if (existing && !retry) {
      existing.used = this.useCounter;
      return existing;
    }
    const entry: InstEntry = {
      key,
      instrument,
      chain: chain ?? packChain(instrument, this.sounds),
      spec: null,
      inst: null,
      storage: null,
      loaded: 0,
      total: 0,
      ready: false,
      failed: false,
      pack: "",
      done: Promise.resolve(),
      notes: new Set(hint ?? []),
      used: this.useCounter,
    };
    this.entries.set(key, entry);
    entry.done = this.loadEntry(entry, hint);
    return entry;
  }

  private async loadEntry(entry: InstEntry, hint?: number[]): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.scheduler) return;
    const errors: string[] = [];
    for (const spec of entry.chain) {
      const storage = new CountingStorage();
      entry.spec = spec;
      entry.pack = spec.pack;
      entry.storage = storage;
      entry.loaded = 0;
      entry.total = 0;
      this.emitLoad();
      let inst: Smplr | null = null;
      try {
        inst = spec.create({
          ctx,
          destination: this.master,
          scheduler: this.scheduler,
          storage,
          volume: entry.key.endsWith("|pizz") ? PIZZ_VOLUME : (spec.volume ?? instrumentVolume(entry.instrument, this.sounds)),
          pan: 0,
          notes: hint,
          onProgress: (loaded, total) => {
            entry.loaded = loaded;
            entry.total = total;
            this.emitLoad();
          },
        });
        await inst.ready;
        if (storage.ok === 0 && storage.failed > 0) {
          throw new Error(`no samples loaded (${storage.failed} failed)`);
        }
        if (spec.extend && storage.failed > 0) {
          // Rebuild without the samples that failed so their keys fall back to neighbours.
          await spec.extend(inst, [...entry.notes], storage.failedUrls).catch(() => undefined);
        }
        if (this.reverb) {
          try {
            inst.output.addEffect("reverb", this.reverb, REVERB_SEND[entry.instrument] * ROOM_SEND[this.sounds.room]);
          } catch {
            /* ignore */
          }
        }
        entry.inst = inst;
        entry.ready = true;
        entry.failed = false;
        entry.error = errors.length ? errors.join("; ") : undefined;
        if (entry.total === 0) {
          entry.total = Math.max(1, storage.ok);
          entry.loaded = entry.total;
        }
        // Apply the pan of whichever member currently owns this entry.
        for (const [memberId, key] of this.memberEntry) {
          if (key === entry.key || `${key}|pizz` === entry.key) inst.output.pan = this.memberPan.get(memberId) ?? 0;
        }
        this.emitLoad();
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${spec.pack}: ${msg}`);
        console.warn(`[audio] ${entry.instrument} pack ${spec.pack} failed, trying next`, err);
        try {
          inst?.dispose();
        } catch {
          /* ignore */
        }
      }
    }
    entry.failed = true;
    entry.failedAt = Date.now();
    entry.ready = false;
    entry.error = errors.join("; ") || "no pack available";
    this.emitLoad();
  }

  private ensureClick() {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.clickReady || this.offline) return;
    try {
      const click = DrumMachine(ctx, {
        instrument: "LM-2",
        destination: this.master,
        scheduler: this.scheduler ?? undefined,
        storage: new CountingStorage(),
        volume: 90,
        notesToLoad: { notes: ["stick-h", "stick-m"] },
      } as Parameters<typeof DrumMachine>[1]);
      this.click = click;
      this.clickReady = click.ready.catch((err) => {
        console.warn("[audio] count-in sticks unavailable", err);
        this.click = null;
      });
    } catch (err) {
      console.warn("[audio] count-in sticks unavailable", err);
      this.clickReady = Promise.resolve();
    }
  }

  onLoad(cb: (states: LoadState[]) => void): () => void {
    this.loadListeners.add(cb);
    cb(this.getLoadStates());
    return () => {
      this.loadListeners.delete(cb);
    };
  }

  getLoadStates(): LoadState[] {
    return this.currentMembers.map((m) => {
      const key = this.memberEntry.get(m.id);
      const e = key ? this.entries.get(key) : undefined;
      return {
        memberId: m.id,
        instrument: m.instrument,
        loaded: e?.loaded ?? 0,
        total: e?.total ?? 0,
        ready: e?.ready ?? false,
        error: e?.failed ? e.error : undefined,
        pack: e?.pack ?? "",
      };
    });
  }

  private emitLoad() {
    if (this.loadListeners.size === 0) return;
    const states = this.getLoadStates();
    for (const cb of this.loadListeners) {
      try {
        cb(states);
      } catch (err) {
        console.warn("[audio] onLoad listener failed", err);
      }
    }
  }

  // ─── Transport ─────────────────────────────────────────────────────────────

  /**
   * Start a chart. Returns false when there's no audio at all; a start that fails later
   * (the browser won't let sound play, an instrument blew up) is reported to onFailed.
   */
  play(score: Score, opts?: { fromBar?: number; countIn?: boolean; loop?: boolean }): boolean {
    let ctx: AudioContext | null;
    try {
      ctx = this.ensureContext();
    } catch (err) {
      console.error("[audio] no AudioContext", err);
      ctx = null;
    }
    if (!ctx) return false;
    this.halt(false);
    const token = ++this.playToken;
    this.state = "loading";
    this.score = score;
    void this.startWhenReady(score, opts ?? {}, token).catch((err) => {
      console.error("[audio] play failed", err);
      if (token !== this.playToken) return;
      this.halt(false);
      const message = err instanceof Error && err.message ? err.message : "the sound wouldn't start";
      for (const cb of this.failListeners) {
        try {
          cb(message);
        } catch (e) {
          console.warn("[audio] onFailed listener failed", e);
        }
      }
    });
    return true;
  }

  private async startWhenReady(
    score: Score,
    opts: { fromBar?: number; countIn?: boolean; loop?: boolean },
    token: number,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    // a context that won't run never moves the playhead: fail rather than "play" in silence forever
    if (ctx.state !== "running" && !(await this.resume(ctx))) {
      if (token !== this.playToken) return;
      throw new Error("the browser is holding the sound back");
    }
    // Make sure the members' instruments exist (reuses cache), then wait a bounded time.
    const members = score.members ?? [];
    const ready = this.prepare(members, { notesHint: notesHintFromScore(score) });
    const timeout = new Promise<"timeout">((r) => setTimeout(() => r("timeout"), READY_WAIT_MS));
    const result = await Promise.race([ready.then(() => "ok" as const), timeout]);
    if (token !== this.playToken) return;
    if (result === "timeout") {
      const slow = this.getLoadStates().filter((s) => !s.ready).map((s) => `${s.memberId}:${s.instrument}`);
      console.warn("[audio] starting before all instruments loaded:", slow.join(", "));
    }
    if (this.clickReady) {
      await Promise.race([this.clickReady, new Promise((r) => setTimeout(r, 1500))]);
      if (token !== this.playToken) return;
    }

    const bpb = beatsPerBar(score);
    const fromBar = clamp(Math.floor(opts.fromBar ?? 0), 0, Math.max(0, (score.frame?.bars ?? 1) - 1));
    const countIn = opts.countIn ?? fromBar === 0;
    this.spb = beatToSeconds(1, tempoOf(score));
    this.rit = score.rit;
    this.startBeat = fromBar * bpb;
    this.endBeat = endBeatOf(score);
    this.loop = !!opts.loop;
    const leadIn = START_DELAY_SEC + (countIn ? bpb * this.spb : 0);
    this.t0 = ctx.currentTime + leadIn - this.sec(this.startBeat);
    this.prevT0 = this.t0;
    this.clicks = [];
    if (countIn) {
      for (let i = 0; i < bpb; i++) {
        this.clicks.push({ time: this.t0 + this.sec(this.startBeat) - (bpb - i) * this.spb, accent: i === 0 });
      }
    }
    this.buildTracks(score, this.startBeat);
    this.stats = this.freshStats();
    this.stats.startedAt = ctx.currentTime;
    this.stats.failedInstruments = this.getLoadStates()
      .filter((s) => s.error)
      .map((s) => `${s.memberId}:${s.instrument} (${s.error})`);
    if (this.stats.failedInstruments.length) {
      console.warn("[audio] instruments unavailable:", this.stats.failedInstruments.join(", "));
    }
    this.state = "playing";
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private buildTracks(score: Score, fromBeat: number) {
    this.tracks = (score.members ?? []).map((m) => {
      const notes = sortedNotes(score.parts?.[m.id]);
      return {
        memberId: m.id,
        instrument: m.instrument,
        entryKey: this.memberEntry.get(m.id) ?? "",
        notes,
        cursor: lowerBound(notes, fromBeat),
        lastStart: -Infinity,
        lastOpenHat: -Infinity,
        pocket: pocketOf(score, m.id),
        feel: feelOf({ style: score.frame?.style ?? "swing", feel: score.frame?.feel }),
        beats: beatsPerBar(score),
        voices: new VoiceBook(VOICE_CAP[m.instrument] ?? 8, m.instrument !== "drums"),
        serial: 0,
        mallets: m.instrument === "drums" && malletsIn(score),
      };
    });
  }

  updateScore(score: Score): void {
    const prev = this.score;
    this.score = score;
    if (this.state !== "playing" || !prev) return;
    this.endBeat = endBeatOf(score);
    this.rit = score.rit;
    const byId = new Map(this.tracks.map((t) => [t.memberId, t]));
    this.tracks = (score.members ?? []).map((m) => {
      const old = byId.get(m.id);
      const notes = sortedNotes(score.parts?.[m.id]);
      const lastStart = old?.lastStart ?? -Infinity;
      // Resume after whatever was already handed to the instruments.
      const cursor =
        lastStart === -Infinity
          ? lowerBound(notes, Math.max(this.startBeat, this.currentRawBeat()))
          : upperBound(notes, lastStart);
      return {
        memberId: m.id,
        instrument: m.instrument,
        entryKey: this.memberEntry.get(m.id) ?? old?.entryKey ?? "",
        notes,
        cursor,
        lastStart,
        lastOpenHat: old?.lastOpenHat ?? -Infinity,
        pocket: pocketOf(score, m.id),
        feel: feelOf({ style: score.frame?.style ?? "swing", feel: score.frame?.feel }),
        beats: beatsPerBar(score),
        voices: old?.voices ?? new VoiceBook(VOICE_CAP[m.instrument] ?? 8, m.instrument !== "drums"),
        serial: old?.serial ?? 0,
        mallets: m.instrument === "drums" && malletsIn(score),
      };
    });
  }

  /**
   * Change the tempo of the chart that's playing without stopping it: the beat under the
   * playhead stays where it is and everything after it is scheduled at the new tempo. Notes
   * already handed to the instruments (the lookahead) keep their old timing. Returns false
   * when it can't (not playing yet, or still counting in); the caller restarts instead.
   */
  setTempo(score: Score): boolean {
    const ctx = this.ctx;
    if (!ctx || this.state !== "playing" || !this.score) return false;
    const beat = this.currentRawBeat();
    if (!Number.isFinite(beat) || beat < this.startBeat || this.clicks.length) return false;
    this.score = score;
    this.spb = beatToSeconds(1, tempoOf(score));
    this.rit = score.rit;
    this.t0 = ctx.currentTime - this.sec(beat);
    this.prevT0 = this.t0;
    return true;
  }

  stop(): void {
    this.halt(false);
  }

  /** New sounds: a new room is heard at once (the samples change on the next prepare). */
  setSounds(sounds: Sounds): void {
    const roomChanged = sounds.room !== this.sounds.room;
    this.sounds = sounds;
    if (!roomChanged || !this.reverb) return;
    if (this.ctx) tuneRoom(this.reverb, sounds.room, this.ctx.sampleRate);
    for (const e of this.entries.values()) {
      try {
        e.inst?.output.sendEffect("reverb", REVERB_SEND[e.instrument] * ROOM_SEND[sounds.room]);
      } catch {
        /* not loaded yet: it picks up the room when it is */
      }
    }
  }

  private halt(fireEnded: boolean) {
    this.playToken++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const wasPlaying = this.state === "playing";
    this.state = "stopped";
    this.tracks = [];
    this.clicks = [];
    for (const e of this.entries.values()) {
      try {
        e.inst?.stop();
        bowedOf(e.inst)?.stopAll();
      } catch {
        /* ignore */
      }
    }
    try {
      this.click?.stop();
    } catch {
      /* ignore */
    }
    if (fireEnded && wasPlaying) {
      for (const cb of this.endListeners) {
        try {
          cb();
        } catch (err) {
          console.warn("[audio] onEnded listener failed", err);
        }
      }
    }
  }

  isPlaying(): boolean {
    return this.state === "playing" || this.state === "loading";
  }

  getState(): TransportState {
    return this.state;
  }

  private currentRawBeat(): number {
    const ctx = this.ctx;
    if (!ctx) return -Infinity;
    const now = ctx.currentTime;
    const base = now >= this.t0 || this.t0 === this.prevT0 ? this.t0 : this.prevT0;
    return beatAt(this.tempoMap(), now - base);
  }

  private tempoMap(): TempoMap {
    return { spb: this.spb, rit: this.rit };
  }

  /** Seconds from beat 0 to a beat, through the ritardando. */
  private sec(beat: number): number {
    return secAt(this.tempoMap(), beat);
  }

  getBeat(): number {
    const ctx = this.ctx;
    if (!ctx || this.state !== "playing") return -Infinity;
    const latency = (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0;
    const now = ctx.currentTime - latency;
    const base = now >= this.t0 || this.t0 === this.prevT0 ? this.t0 : this.prevT0;
    return beatAt(this.tempoMap(), now - base);
  }

  /** Seconds per beat right now (longer through the ritardando). */
  getSecondsPerBeat(): number {
    const b = this.getBeat();
    return Number.isFinite(b) ? spbAt(this.tempoMap(), b) : this.spb;
  }

  /** A start that failed: the transport is stopped again. */
  onFailed(cb: (message: string) => void): () => void {
    this.failListeners.add(cb);
    return () => {
      this.failListeners.delete(cb);
    };
  }

  onEnded(cb: () => void): () => void {
    this.endListeners.add(cb);
    return () => {
      this.endListeners.delete(cb);
    };
  }

  setMute(memberId: string, muted: boolean): void {
    if (muted) this.muted.add(memberId);
    else this.muted.delete(memberId);
    if (muted) {
      // the chart that's playing may not be the band last prepared
      const key = this.tracks.find((t) => t.memberId === memberId)?.entryKey || this.memberEntry.get(memberId);
      const e = key ? this.entries.get(key) : undefined;
      try {
        e?.inst?.stop();
        bowedOf(e?.inst)?.stopAll();
      } catch {
        /* ignore */
      }
    }
  }

  isMuted(memberId: string): boolean {
    return this.muted.has(memberId);
  }

  /**
   * How loud the band plays here, 0..1 (the volume slider; 1 is the full mix). It turns down only
   * what this device plays: it comes after the limiter, so a recording and the level meter are the
   * same at any volume, and the mix isn't compressed any differently.
   */
  setVolume(level: number): void {
    this.volume = clamp(Number.isFinite(level) ? level : 1, 0, 1);
    if (this.monitor && this.ctx) this.monitor.gain.setTargetAtTime(volumeGain(this.volume), this.ctx.currentTime, 0.02);
  }

  /** The mix into the bus (before the compressor and limiter): 0.85 leaves them their headroom. */
  setMasterVolume(v: number): void {
    this.masterVolume = clamp(Number.isFinite(v) ? v : 0.85, 0, 1);
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02);
    }
  }

  /**
   * Record what the band plays, from the end of the mix (after the limiter, so the file
   * sounds like the speakers). Null where the browser can't record audio. `stop` resolves with
   * the file; `cancel` throws it away.
   */
  startRecording(): { mimeType: string; stop(): Promise<Blob | null>; cancel(): void } | null {
    const ctx = this.ctx;
    const out = this.output;
    if (!ctx || !out || typeof MediaRecorder === "undefined") return null;
    const mimeType = RECORD_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    if (!mimeType) return null;
    const tap = ctx.createMediaStreamDestination();
    out.connect(tap);
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(tap.stream, { mimeType, audioBitsPerSecond: 192_000 });
    } catch {
      out.disconnect(tap);
      return null;
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
    rec.start(1000);
    const finish = async (keep: boolean) => {
      if (rec.state !== "inactive") rec.stop();
      await done;
      try {
        out.disconnect(tap);
      } catch {
        /* already gone */
      }
      return keep && chunks.length ? new Blob(chunks, { type: mimeType }) : null;
    };
    return { mimeType, stop: () => finish(true), cancel: () => void finish(false) };
  }

  /**
   * A chart played into an offline context, faster than real time: the same instruments, touch,
   * room and bus the speakers get, with no count-in. The audio lab measures the band's levels
   * with it (levels.ts). `at(beat)` is where a beat of the chart lands in the buffer (seconds).
   */
  static async bounce(
    score: Score,
    opts: { sounds?: Sounds; master?: number; sampleRate?: number } = {},
  ): Promise<{ buffer: AudioBuffer; stats: PlaybackStats; at: (beat: number) => number }> {
    const sampleRate = opts.sampleRate ?? 48000;
    const spb = beatToSeconds(1, tempoOf(score));
    const end = endBeatOf(score);
    const seconds = START_DELAY_SEC + secAt({ spb, rit: score.rit }, end) + END_TAIL_SEC + 2;
    const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
    const engine = new TroopAudio(ctx);
    if (opts.master !== undefined) engine.setMasterVolume(opts.master);
    await engine.prepare(score.members, { sounds: opts.sounds ?? DEFAULT_SOUNDS, notesHint: notesHintFromScore(score) });
    await engine.reverb?.ready();
    engine.score = score;
    engine.spb = spb;
    engine.rit = score.rit;
    engine.t0 = engine.prevT0 = START_DELAY_SEC;
    engine.endBeat = end;
    engine.buildTracks(score, 0);
    engine.state = "playing";
    const swing = Number.isFinite(score.swing) ? score.swing : 0.5;
    for (const track of engine.tracks) {
      for (let i = 0; i < track.notes.length; i++) {
        track.lastStart = track.notes[i].start;
        engine.scheduleNote(track, i, swing, 0);
      }
    }
    const buffer = await ctx.startRendering();
    engine.state = "stopped";
    return { buffer, stats: engine.getStats(), at: (beat) => START_DELAY_SEC + secAt({ spb, rit: score.rit }, beat) };
  }

  /** RMS of the master output right now (0..~1). Cheap enough to call every frame. */
  getOutputLevel(): number {
    const a = this.analyser;
    const buf = this.levelBuf;
    if (!a || !buf) return 0;
    a.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  getStats(): PlaybackStats {
    return { ...this.stats, perMember: { ...this.stats.perMember } };
  }

  private freshStats(): PlaybackStats {
    return { scheduled: 0, late: 0, dropped: 0, perMember: {}, failedInstruments: [], startedAt: null };
  }

  private lookahead() {
    return typeof document !== "undefined" && document.hidden ? LOOKAHEAD_HIDDEN_SEC : LOOKAHEAD_SEC;
  }

  // ─── Playing along ─────────────────────────────────────────────────────────

  /**
   * Load the instrument you play along on. It's one of the band's sampled instruments, kept
   * apart from theirs (its own instance, in the middle of the stage) so the band can use the
   * same one. Resolves once it's ready or has definitively failed.
   */
  async prepareLive(instrument: InstrumentId): Promise<{ ready: boolean; error?: string }> {
    const ctx = this.ensureContext();
    if (!ctx) return { ready: false, error: "no audio here" };
    const pack = instrument === "piano" ? this.sounds.piano : instrument === "drums" ? this.sounds.drums : instrument === "pad" ? this.sounds.pad : "default";
    const key = `live:${instrument}:${pack}`;
    if (this.live?.key !== key) {
      this.liveAllOff();
      this.live = { key, instrument, held: new Map() };
    }
    // every sample (no hint): you can play anywhere on the keyboard
    const entry = this.getEntry(key, instrument);
    await entry.done;
    return { ready: entry.ready, error: entry.failed ? entry.error : undefined };
  }

  /** Is the play-along instrument loaded? */
  liveReady(): boolean {
    const e = this.live ? this.entries.get(this.live.key) : undefined;
    return !!e?.ready;
  }

  /**
   * Sound one of your notes: right away, or at `at` (context seconds) when it was played a hair
   * early and is being pulled onto the grid. Held until liveOff.
   */
  liveOn(pitch: number, vel: number, at?: number): void {
    const live = this.live;
    const ctx = this.ctx;
    const entry = live ? this.entries.get(live.key) : undefined;
    if (!live || !ctx || !entry?.inst || !entry.ready) return;
    if (ctx.state !== "running") void ctx.resume().catch(() => {});
    live.held.get(pitch)?.(ctx.currentTime);
    const time = at !== undefined && at > ctx.currentTime ? at : undefined;
    const velocity = Math.round(1 + clamp(vel, 0, 1) * 126);
    try {
      let stop: StopFn;
      if (live.instrument === "drums") {
        // pads send General MIDI drum notes, which is what the kits are keyed by
        const sample = entry.pack === "lm-2" ? lm2Sample(pitch, vel) : pitch;
        if (sample === null || sample === undefined) return;
        stop = entry.inst.start({ note: sample, velocity, time });
      } else {
        let p = Math.round(pitch);
        const range = INSTRUMENTS[live.instrument]?.range;
        if (range) {
          while (p < range[0] - 12) p += 12;
          while (p > range[1] + 12) p -= 12;
        }
        const event: SmplrNote = { note: p, velocity, time };
        if (live.instrument === "piano" && entry.pack === "salamander") event.lpfCutoffHz = 1800 + Math.pow(vel, 1.4) * 14000;
        if (RELEASE_SEC[live.instrument] !== undefined) event.ampRelease = RELEASE_SEC[live.instrument];
        // a bowed voice holds the note itself (its smplr instrument only carries the channel)
        const bowed = bowedOf(entry.inst);
        stop = bowed ? bowed.hold(p, clamp(vel, 0, 1), time ?? ctx.currentTime) : entry.inst.start(event);
      }
      live.held.set(pitch, stop);
    } catch (err) {
      console.warn("[audio] live note failed", err);
    }
  }

  /** Let go of one of your notes (a drum hit rings out on its own). */
  liveOff(pitch: number, at?: number): void {
    const live = this.live;
    const stop = live?.held.get(pitch);
    if (!live || !stop || !this.ctx) return;
    live.held.delete(pitch);
    if (live.instrument === "drums") return;
    try {
      stop(Math.max(this.ctx.currentTime, at ?? 0));
    } catch {
      /* already stopped */
    }
  }

  liveAllOff(): void {
    if (!this.live) return;
    for (const p of [...this.live.held.keys()]) this.liveOff(p);
  }

  /**
   * The beat (felt, on the swung timeline) that was coming out of the speakers at a moment
   * given on the performance clock (a MIDI event's timestamp, a key press): what the player was
   * hearing when they played, so their note is placed where they meant it rather than where
   * the output latency made it land. -Infinity when the band isn't playing.
   */
  heardBeatAt(perfMs: number): number {
    const ctx = this.ctx;
    if (!ctx || this.state !== "playing") return -Infinity;
    const heard = this.heardTimeAt(ctx, perfMs);
    const base = heard >= this.t0 || this.t0 === this.prevT0 ? this.t0 : this.prevT0;
    return beatAt(this.tempoMap(), heard - base);
  }

  /** Context time whose sound reached the speakers at `perfMs`. */
  private heardTimeAt(ctx: AudioContext, perfMs: number): number {
    try {
      const stamp = ctx.getOutputTimestamp?.();
      if (stamp && Number.isFinite(stamp.contextTime) && Number.isFinite(stamp.performanceTime) && stamp.performanceTime! > 0) {
        return stamp.contextTime! + (perfMs - stamp.performanceTime!) / 1000;
      }
    } catch {
      /* not supported */
    }
    const latency = (ctx as AudioContext & { outputLatency?: number }).outputLatency || ctx.baseLatency || 0;
    return ctx.currentTime - latency - (performance.now() - perfMs) / 1000;
  }

  /**
   * When a beat of the chart (straight grid) is played, in context seconds: where to put a
   * note pulled onto the band's grid. Null when the band isn't playing.
   */
  timeOfBeat(beat: number): number | null {
    if (!this.ctx || this.state !== "playing" || !this.score) return null;
    const swing = Number.isFinite(this.score.swing) ? this.score.swing : 0.5;
    return this.t0 + this.sec(applyFeel(beat, swing));
  }

  /** The swing of the chart that's playing (0.5 = straight). */
  getSwing(): number {
    const s = this.score?.swing;
    return s !== undefined && Number.isFinite(s) ? s : 0.5;
  }

  // ─── Scheduler ─────────────────────────────────────────────────────────────

  private tick() {
    try {
      this.tickInner();
    } catch (err) {
      console.warn("[audio] scheduler tick failed", err);
    }
  }

  private tickInner() {
    const ctx = this.ctx;
    const score = this.score;
    if (!ctx || !score || this.state !== "playing") return;
    const now = ctx.currentTime;
    const horizon = now + this.lookahead();

    // Count-in sticks.
    while (this.clicks.length && this.clicks[0].time < horizon) {
      const c = this.clicks.shift()!;
      if (c.time < now - 0.05) continue;
      try {
        this.click?.start({
          note: c.accent ? "stick-h" : "stick-m",
          velocity: c.accent ? 110 : 80,
          time: Math.max(c.time, now),
        });
      } catch {
        /* ignore */
      }
    }

    const swing = Number.isFinite(score.swing) ? score.swing : 0.5;
    for (const track of this.tracks) {
      const notes = track.notes;
      while (track.cursor < notes.length) {
        const note = notes[track.cursor];
        if (this.loop && note.start >= this.loopEndBeat()) {
          track.cursor = notes.length;
          break;
        }
        // Decide on the un-humanised time so chords are never split across ticks.
        const when = this.t0 + this.sec(applyFeel(note.start, swing));
        if (when >= horizon) break;
        track.cursor++;
        track.lastStart = note.start;
        this.scheduleNote(track, track.cursor - 1, swing, now);
      }
    }

    // Loop: once every track has handed over the last iteration, queue the next one.
    if (this.loop) {
      const loopEnd = this.t0 + this.sec(this.loopEndBeat());
      if (horizon >= loopEnd && this.tracks.every((t) => t.cursor >= t.notes.length || t.notes[t.cursor].start >= this.loopEndBeat())) {
        const span = this.sec(this.loopEndBeat()) - this.sec(this.startBeat);
        this.prevT0 = this.t0;
        this.t0 += span;
        for (const t of this.tracks) {
          t.cursor = lowerBound(t.notes, this.startBeat);
          t.lastStart = -Infinity;
        }
      }
      return;
    }

    const endTime = this.t0 + this.sec(this.endBeat) + END_TAIL_SEC;
    if (now >= endTime) this.halt(true);
  }

  private loopEndBeat() {
    const score = this.score;
    if (!score) return this.endBeat;
    const bars = score.frame?.bars ?? 0;
    return bars > 0 ? bars * beatsPerBar(score) : this.endBeat;
  }

  /** When a note of a track sounds (context seconds), before any late-note clamp: its felt time, pocket and looseness. */
  private noteTime(track: Track, note: NoteEvent, swing: number): number {
    const isDrum = track.instrument === "drums";
    const tight = isDrum && (note.pitch === 36 || note.pitch === 38 || note.pitch === 37);
    const timingAmt = isDrum ? (tight ? 0.002 : 0.005) : track.feel.looseness;
    return this.t0 + this.sec(applyFeel(note.start, swing)) + track.pocket(note) + jitter(timingAmt, track.memberId, note.start, note.pitch, "t");
  }

  /** A bowed line's note: joined to its neighbours the way it's bowed (bowed.ts). */
  private bowedPlan(track: Track, i: number, time: number, vel: number, pitch: number, dur: number, swing: number): BowPlan {
    const notes = track.notes;
    const note = notes[i];
    const prev = i > 0 ? notes[i - 1] : null;
    const next = notes[i + 1];
    const joins = (a: NoteEvent, b: NoteEvent) => a.art !== "pizz" && b.art !== "pizz" && Math.abs(b.start - (a.start + a.dur)) < 1e-4;
    const join: BowJoin = prev && joins(prev, note) ? (note.slur ? "slur" : "change") : "fresh";
    // the next note it runs into (not past the loop's end, where it would start over)
    const nx = next && joins(note, next) && !(this.loop && next.start >= this.loopEndBeat() - 1e-9) ? next : null;
    const nextIn = nx ? Math.max(0.02, this.noteTime(track, nx, swing) - time) : null;
    return planBow(
      { time, dur, pitch, vel, art: note.art, slur: note.slur },
      { join, prevPitch: prev?.pitch ?? null, nextIn, nextSlur: !!nx?.slur, style: this.score?.frame?.style ?? "swing", seed: this.score?.settings?.seed },
    );
  }

  private scheduleNote(track: Track, index: number, swing: number, now: number) {
    const note = track.notes[index];
    if (this.muted.has(track.memberId)) return;
    // plucked notes on a bowed string use the pizzicato voice when it's loaded
    const pizz = note.art === "pizz" ? this.entries.get(`${track.entryKey}|pizz`) : undefined;
    const entry = pizz?.ready ? pizz : this.entries.get(track.entryKey);
    const inst = entry?.inst;
    if (!inst || !entry.ready) {
      this.stats.dropped++;
      return;
    }
    const isDrum = track.instrument === "drums";
    const id = track.memberId;

    // Humanise (deterministic per note).
    let time = this.noteTime(track, note, swing);
    if (time < now) {
      if (now - time > 0.08) {
        this.stats.late++;
        this.stats.dropped++;
        return;
      }
      this.stats.late++;
      time = now + 0.005;
    }

    let vel = clamp(Number.isFinite(note.vel) ? note.vel : 0.7, 0, 1);
    // the one place an accent is lifted (parts mark accents without pre-boosting them)
    if (note.art === "accent") vel = Math.min(1, vel * 1.12 + 0.08);
    if (note.art === "ghost") vel = ghostVel(vel);
    // the metre leans on the downbeat as hard as the feel does (the drummer has their own accents)
    if (!isDrum) vel *= metricLift(track.feel, note.start - Math.floor(note.start / track.beats + 1e-9) * track.beats, track.beats);
    vel *= 1 + jitter(isDrum ? 0.06 : track.feel.humanize, id, note.start, note.pitch, "v");
    vel = clamp(vel, 0.02, 1);

    // a roll on a cymbal leads to its end: the swell peaks there (and a kit with no swell, or
    // the LinnDrum, strikes the cymbal there instead)
    const roll = isDrum && note.art === "roll" && isCymbal(note.pitch);
    const arrival = roll ? Math.max(time, this.noteTime(track, { ...note, start: note.start + note.dur }, swing)) : time;

    try {
      if (isDrum && entry.pack !== "lm-2") {
        // the acoustic kit is keyed by General MIDI drum note, plus its mallet and swell keys; the
        // hats choke in its own preset
        const mallet = MALLET_KEY[note.pitch];
        let key = track.mallets && mallet !== undefined && kitHas(inst, mallet) ? mallet : note.pitch;
        let at = time;
        let ring = drumRing(note.pitch);
        if (roll) {
          const swell = swellFor(arrival - time, (k) => kitHas(inst, k));
          if (swell) {
            key = swell.key;
            at = time + swell.lead;
            ring = swell.peak + SWELL_RING;
          } else at = arrival;
        }
        track.voices.admit(key, at);
        const stopId = `${id}#${++track.serial}`;
        const stop = inst.start({ note: key, velocity: Math.round(1 + vel * 126), time: at, stopId });
        track.voices.add(key, at, at + ring, stop);
      } else if (isDrum) {
        const sample = lm2Sample(note.pitch, vel, note.art);
        if (!sample) {
          this.stats.dropped++;
          return;
        }
        if (roll) time = arrival;
        // Closed/pedal hat chokes a ringing open hat.
        if ((note.pitch === 42 || note.pitch === 44) && track.lastOpenHat < time) {
          inst.stop({ stopId: "hhopen", time });
        }
        if (note.pitch === 46) track.lastOpenHat = time;
        inst.start({ note: sample, velocity: Math.round(1 + vel * 126), time });
      } else {
        const span = this.sec(applyFeel(note.start + Math.max(0.01, note.dur), swing)) - this.sec(applyFeel(note.start, swing));
        const range = INSTRUMENTS[track.instrument]?.range;
        let pitch = Math.round(note.pitch);
        if (range) {
          while (pitch < range[0] - 12) pitch += 12;
          while (pitch > range[1] + 12) pitch -= 12;
        }
        // a bowed line plays through its own voice: slurs, swells, vibrato (bowed.ts)
        const bowed = note.art === "pizz" ? undefined : bowedOf(inst);
        if (bowed) {
          bowed.play(this.bowedPlan(track, index, time, vel, pitch, Math.max(0.03, span), swing));
          this.stats.scheduled++;
          this.stats.perMember[id] = (this.stats.perMember[id] ?? 0) + 1;
          return;
        }
        let dur = articulate(track.feel, note.dur, Math.max(0.03, span), note.art);
        if (note.art === "staccato") dur *= 0.5;
        if (note.art === "pizz") dur = Math.min(dur, 0.9);
        if (note.art === "legato") dur *= 1.06;
        if (DECAYING[track.instrument]) dur += 0.05;
        const midiVel = Math.round(1 + vel * 126);
        const event: SmplrNote = { note: pitch, velocity: midiVel, time, duration: dur };
        if (RELEASE_SEC[track.instrument] !== undefined) event.ampRelease = RELEASE_SEC[track.instrument];
        if (track.instrument === "piano" && entry.pack === "salamander") {
          // Soft piano notes are darker, not just quieter.
          event.lpfCutoffHz = 1800 + Math.pow(vel, 1.4) * 14000;
        }
        // a pitch struck again lets the old one go; past the player's cap the oldest voice does
        const voices = note.art === "pizz" ? null : track.voices;
        voices?.admit(pitch, time);
        event.stopId = `${id}#${++track.serial}`;
        const stop = inst.start(event);
        voices?.add(pitch, time, time + dur + RING_SEC, stop);
      }
      this.stats.scheduled++;
      this.stats.perMember[id] = (this.stats.perMember[id] ?? 0) + 1;
    } catch (err) {
      this.stats.dropped++;
      console.warn("[audio] note failed", err);
    }
  }
}

/** Shared engine. The constructor touches no browser APIs, so importing this during SSR is safe;
 * the AudioContext is created lazily on the first unlock/prepare/play. */
export const troopAudio: TroopAudio = new TroopAudio();

export type { DrumKit, PianoPack, Sounds };
