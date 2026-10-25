import { describe, expect, it } from "vitest";
import { BOWED_VOICES, BowedVoice, noteMidi, parseMidiJs, planBow, velGain, type BowPlan, type BowedNote } from "./bowed";

const note = (dur: number, extra: Partial<BowedNote> = {}): BowedNote => ({ time: 10, dur, pitch: 76, vel: 0.7, ...extra });
const plan = (n: BowedNote, o: Partial<Parameters<typeof planBow>[1]> = {}) => planBow(n, { join: "fresh", prevPitch: null, nextIn: null, nextSlur: false, style: "pop", ...o });
const levelAt = (p: BowPlan, t: number) => {
  const e = p.env;
  if (t <= e[0][0]) return e[0][1];
  for (let i = 1; i < e.length; i++) if (t <= e[i][0]) return e[i - 1][1] + ((e[i][1] - e[i - 1][1]) * (t - e[i - 1][0])) / (e[i][0] - e[i - 1][0]);
  return 0;
};

/** Never a click: times go forward, the level never jumps, and it's at 0 before the sample stops. */
function clickFree(p: BowPlan) {
  const e = p.env;
  for (let i = 1; i < e.length; i++) {
    const dt = e[i][0] - e[i - 1][0];
    expect(dt).toBeGreaterThan(0);
    // no faster than full level in 15 ms
    expect(Math.abs(e[i][1] - e[i - 1][1]) / p.gain / dt).toBeLessThan(1 / 0.015);
  }
  expect(e[e.length - 1][1]).toBe(0);
  expect(p.stop).toBeGreaterThanOrEqual(e[e.length - 1][0]);
  // the last fall to silence takes at least 40 ms
  expect(e[e.length - 1][0] - e[e.length - 2][0]).toBeGreaterThanOrEqual(0.04);
}

describe("the violin's voice", () => {
  it("matches smplr's velocity curve, so a plateau is exactly as loud as the plain soundfont", () => {
    expect(velGain(1)).toBeCloseTo(1);
    expect(velGain(0.5)).toBeCloseTo(Math.round(1 + 0.5 * 126) ** 2 / 16129);
  });

  it("a slurred note fades in under the one before, which lets go only after it starts: no gap, no new attack", () => {
    const first = plan(note(0.4), { nextIn: 0.4, nextSlur: true });
    const second = plan(note(0.4, { slur: true }), { join: "slur", prevPitch: 74 });
    // the first is still sounding when the second starts, and gone soon after
    expect(levelAt(first, 0.4)).toBeGreaterThan(first.gain * 0.8);
    expect(first.env[first.env.length - 1][0]).toBeLessThan(0.4 + 0.12);
    // the second starts from silence (its sample's bow bite is under the fade) and is in by 50 ms
    expect(second.env[0][1]).toBe(0);
    expect(levelAt(second, 0.05)).toBeGreaterThan(second.gain * 0.95);
    // a fresh bow out of silence speaks more slowly than a slur
    const fresh = plan(note(1.2));
    expect(levelAt(fresh, 0.05)).toBeLessThan(fresh.gain * 0.6);
    for (const p of [first, second, fresh]) clickFree(p);
  });

  it("a change of bow mid-line is quick and soft, never a gap", () => {
    const a = plan(note(0.5), { nextIn: 0.5, nextSlur: false });
    const b = plan(note(0.5), { join: "change", prevPitch: 74 });
    expect(levelAt(a, 0.5)).toBeGreaterThan(0);
    expect(b.env[0][1]).toBeGreaterThan(0);
    expect(b.env[0][1]).toBeLessThan(b.gain * 0.5);
    clickFree(a);
    clickFree(b);
  });

  it("a long note swells into its middle and eases off at a phrase's end", () => {
    const p = plan(note(1.6));
    const mid = levelAt(p, 0.85);
    expect(mid).toBeGreaterThan(levelAt(p, 0.25));
    expect(mid).toBeGreaterThan(levelAt(p, 1.58));
    // and rings a moment after the bow comes off
    expect(p.stop).toBeGreaterThan(1.6 + 0.15);
    clickFree(p);
  });

  it("vibrato waits for a held note to speak, widens in, and stays off short notes", () => {
    expect(plan(note(0.25)).vib).toEqual([]);
    const v = plan(note(1.5)).vib;
    expect(v[0][0]).toBeGreaterThanOrEqual(0.15);
    expect(v[0][1]).toBe(0);
    const peak = Math.max(...v.map((x) => x[1]));
    expect(peak).toBeGreaterThan(8);
    expect(v[v.length - 1][1]).toBe(0);
    // narrow in a baroque line, wide in a ballad
    const width = (style: "baroque" | "ambient") => Math.max(...planBow(note(1.5), { join: "fresh", prevPitch: null, nextIn: null, nextSlur: false, style }).vib.map((x) => x[1]));
    expect(width("baroque")).toBeLessThan(width("ambient") * 0.6);
  });

  it("slides only into slurred shifts, now and then, and never in a baroque line", () => {
    const slides = (style: "pop" | "baroque", join: "slur" | "change") =>
      Array.from({ length: 200 }, (_, i) => planBow({ ...note(0.6, { slur: join === "slur" }), time: i * 0.37 }, { join, prevPitch: 69, nextIn: null, nextSlur: false, style })).filter((p) => p.slide).length;
    expect(slides("pop", "slur")).toBeGreaterThan(20);
    expect(slides("pop", "slur")).toBeLessThan(150);
    expect(slides("baroque", "slur")).toBe(0);
    expect(slides("pop", "change")).toBe(0);
    const s = planBow(note(0.6, { slur: true, time: 3 }), { join: "slur", prevPitch: 69, nextIn: null, nextSlur: false, style: "ambient" });
    // from below for a shift up, partway, and quick
    if (s.slide) {
      expect(s.slide.from).toBeLessThan(0);
      expect(s.slide.from).toBeGreaterThan(-700);
      expect(s.slide.tau).toBeLessThan(0.06);
    }
  });

  it("staccato is short and its release is still a ramp", () => {
    const p = plan(note(0.5, { art: "staccato" }));
    expect(p.stop).toBeLessThan(0.4);
    clickFree(p);
  });

  it("reads MIDI.js soundfonts the way smplr does", () => {
    expect(noteMidi("A4")).toBe(69);
    expect(noteMidi("Bb3")).toBe(58);
    expect(noteMidi("C#5")).toBe(73);
    expect(noteMidi("X")).toBeNull();
    expect(parseMidiJs('MIDI.Soundfont.violin = {\n"A4": "data:audio/ogg;base64,AA",\n"B4": "data:audio/ogg;base64,BB",\n}')).toEqual({ A4: "data:audio/ogg;base64,AA", B4: "data:audio/ogg;base64,BB" });
  });
});

// ─── The voice on a recording AudioContext ──────────────────────────────────

type Ev = [string, number, number];
class Param {
  value = 0;
  events: Ev[] = [];
  setValueAtTime(v: number, t: number) {
    this.events.push(["set", t, v]);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push(["ramp", t, v]);
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    this.events.push(["target", t, v]);
    return this;
  }
  cancelAndHoldAtTime(t: number) {
    this.events = this.events.filter((e) => e[1] < t);
    this.events.push(["hold", t, NaN]);
    return this;
  }
  cancelScheduledValues(t: number) {
    this.events = this.events.filter((e) => e[1] < t);
    return this;
  }
}
class Node {
  connect(x: unknown) {
    return x;
  }
  disconnect() {}
}
class FakeCtx {
  currentTime = 0;
  sources: { start: number; stop: number; env: Param }[] = [];
  private lastGain: Param | null = null;
  createOscillator() {
    return Object.assign(new Node(), { frequency: new Param(), start() {}, stop() {} });
  }
  createGain() {
    const gain = new Param();
    this.lastGain = gain;
    return Object.assign(new Node(), { gain });
  }
  createBufferSource() {
    const rec = { start: NaN, stop: NaN, env: new Param() };
    this.sources.push(rec);
    const envelope = () => this.lastGain;
    return Object.assign(new Node(), {
      buffer: null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      detune: new Param(),
      onended: null,
      start(t: number) {
        rec.start = t;
      },
      stop(t: number) {
        rec.stop = Math.min(Number.isFinite(rec.stop) ? rec.stop : Infinity, t);
      },
      connect(env: { gain: Param }) {
        // the source's gain node is created right after it: remember which one is its envelope
        rec.env = envelope() ?? rec.env;
        return env;
      },
    });
  }
}

describe("the violin's voice, played", () => {
  const voice = () => {
    const ctx = new FakeCtx();
    const buffer = { duration: 4 } as AudioBuffer;
    const v = new BowedVoice(ctx as unknown as BaseAudioContext, new Node() as unknown as AudioNode, new Map([[76, { buffer }]]));
    return { ctx, v };
  };

  it("schedules each envelope forward in time, ending at silence before the sample stops", () => {
    const { ctx, v } = voice();
    let t = 1;
    for (let i = 0; i < 12; i++) {
      v.play(planBow({ time: t, dur: 0.3, pitch: 76, vel: 0.7, slur: i % 3 > 0 }, { join: i % 3 ? "slur" : "change", prevPitch: 74, nextIn: 0.3, nextSlur: (i + 1) % 3 > 0, style: "pop" }));
      t += 0.3;
    }
    for (const s of ctx.sources) {
      const ev = s.env.events;
      for (let i = 1; i < ev.length; i++) expect(ev[i][1]).toBeGreaterThan(ev[i - 1][1]);
      expect(ev[ev.length - 1][2]).toBe(0);
      expect(s.stop).toBeGreaterThanOrEqual(ev[ev.length - 1][1]);
    }
  });

  it(`never rings more than ${BOWED_VOICES} notes at once: the oldest fades out (it isn't cut off)`, () => {
    const { ctx, v } = voice();
    // long notes struck close together, each still ringing when the next comes
    for (let i = 0; i < 10; i++) v.play(planBow({ time: 1 + i * 0.05, dur: 2, pitch: 76, vel: 0.7 }, { join: "fresh", prevPitch: null, nextIn: null, nextSlur: false, style: "pop" }));
    for (let k = 0; k < 10; k++) {
      const at = 1 + k * 0.05 + 0.04;
      const ringing = ctx.sources.filter((s) => s.start <= at && s.stop > at);
      expect(ringing.length).toBeLessThanOrEqual(BOWED_VOICES);
    }
    // a voice let go early ramps down from where it was
    const cut = ctx.sources[0].env.events;
    expect(cut.some((e) => e[0] === "hold")).toBe(true);
    expect(cut[cut.length - 1]).toEqual(["ramp", expect.any(Number), 0]);
  });

  it("lets every note go with a fade when the take stops", () => {
    const { ctx, v } = voice();
    v.play(planBow({ time: 0, dur: 3, pitch: 76, vel: 0.7 }, { join: "fresh", prevPitch: null, nextIn: null, nextSlur: false, style: "pop" }));
    ctx.currentTime = 1;
    v.stopAll();
    const ev = ctx.sources[0].env.events;
    expect(ev[ev.length - 1][0]).toBe("ramp");
    expect(ev[ev.length - 1][2]).toBe(0);
    expect(ev[ev.length - 1][1]).toBeGreaterThanOrEqual(1.02);
    expect(ctx.sources[0].stop).toBeGreaterThan(1.02);
  });
});

describe("the violin's voice, played along", () => {
  it("holds a note until it's let go, then releases it with a fade", () => {
    const ctx = new FakeCtx();
    const v = new BowedVoice(ctx as unknown as BaseAudioContext, new Node() as unknown as AudioNode, new Map([[76, { buffer: { duration: 4 } as AudioBuffer }]]));
    const stop = v.hold(76, 0.8, 0);
    const ev = () => ctx.sources[0].env.events;
    // the bow sets in from silence, and nothing lets it go on its own for a long while
    expect(ev()[0]).toEqual(["set", 0, 0]);
    expect(ctx.sources[0].stop).toBeGreaterThan(20);
    ctx.currentTime = 2;
    stop(2);
    expect(ev()[ev().length - 1]).toEqual(["ramp", expect.closeTo(2.18, 5), 0]);
    expect(ctx.sources[0].stop).toBeCloseTo(2.185, 5);
    // letting go twice is harmless
    stop(3);
    expect(ctx.sources[0].stop).toBeCloseTo(2.185, 5);
  });
});
