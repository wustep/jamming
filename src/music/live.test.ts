import { describe, expect, it } from "vitest";
import { holdable } from "./harmony";
import { defaultMembers, INSTRUMENTS } from "./instruments";
import { blockAt, callBlocks, echoerFor, echoPhrase, leaveSpace, parseMidi, PhraseCapture, placeNote, QUANTIZE, typingLabel, typingPitch } from "./live";
import { defaultSettings, generateLocal } from "./local";
import { harmonyOf } from "./realize";
import { mod } from "./theory";
import type { NoteEvent, Score } from "./types";

function band(): Score {
  const members = defaultMembers();
  return generateLocal({ ...defaultSettings(members), seed: 7 }, members).score;
}

const notesIn = (notes: NoteEvent[], fromBar: number, toBar: number, beats = 4) => notes.filter((n) => n.start >= fromBar * beats - 1e-6 && n.start < toBar * beats - 1e-6);

describe("parseMidi", () => {
  it("reads note-on, and note-on at velocity 0 as note-off", () => {
    expect(parseMidi([0x90, 60, 127])).toEqual({ type: "on", pitch: 60, vel: 1, channel: 0 });
    expect(parseMidi([0x93, 64, 0])).toEqual({ type: "off", pitch: 64, channel: 3 });
    expect(parseMidi([0x80, 60, 40])).toEqual({ type: "off", pitch: 60, channel: 0 });
  });

  it("keeps the sustain pedal and all-notes-off, drops everything else", () => {
    expect(parseMidi([0xb0, 64, 127])).toEqual({ type: "sustain", down: true, channel: 0 });
    expect(parseMidi([0xb0, 64, 0])).toEqual({ type: "sustain", down: false, channel: 0 });
    expect(parseMidi([0xb0, 123, 0])).toEqual({ type: "alloff", channel: 0 });
    expect(parseMidi([0xb0, 1, 64])).toBeNull(); // mod wheel
    expect(parseMidi([0xf8])).toBeNull(); // clock
    expect(parseMidi([0xfe])).toBeNull(); // active sensing
    expect(parseMidi([0xe0, 0, 64])).toBeNull(); // pitch bend
    expect(parseMidi([])).toBeNull();
    expect(parseMidi(null)).toBeNull();
  });
});

describe("typing keys", () => {
  it("plays a chromatic octave and a fourth from the home row", () => {
    expect(typingPitch("KeyA", 60)).toBe(60);
    expect(typingPitch("KeyW", 60)).toBe(61);
    expect(typingPitch("KeyK", 60)).toBe(72);
    expect(typingPitch("Quote", 48)).toBe(65);
    expect(typingPitch("Space", 60)).toBeNull();
    expect(typingLabel(0)).toBe("A");
    expect(typingLabel(16)).toBe(";");
    expect(typingLabel(20)).toBeNull();
  });
});

describe("placeNote", () => {
  it("takes the swing back out, so a swung offbeat lands on the written 8th", () => {
    expect(placeNote(2.66, 0.66, null)).toBeCloseTo(2.5, 5);
    expect(placeNote(3, 0.66, null)).toBe(3);
  });

  it("leaves the feel alone when quantize is off, and pulls halfway to the 8th when light", () => {
    expect(placeNote(1.4, 0.5, QUANTIZE.off)).toBeCloseTo(1.4, 6);
    expect(placeNote(1.4, 0.5, QUANTIZE.light)).toBeCloseTo(1.45, 6);
    expect(placeNote(0.9, 0.5, QUANTIZE.light)).toBeCloseTo(0.95, 6);
    expect(placeNote(2.1, 0.5, QUANTIZE.light)).toBeCloseTo(2.05, 6);
  });
});

describe("PhraseCapture", () => {
  it("turns key down and up into notes, and lets go of held ones at the end", () => {
    const c = new PhraseCapture();
    c.on(60, 0.8, 0);
    c.on(64, 0.6, 0.5);
    expect(c.off(60, 1)).toEqual({ pitch: 60, start: 0, dur: 1, vel: 0.8 });
    expect(c.heldPitches()).toEqual([64]);
    expect(c.release(4)).toEqual([{ pitch: 64, start: 0.5, dur: 3.5, vel: 0.6 }]);
    expect(c.off(99, 2)).toBeNull();
    expect(c.notes).toHaveLength(2);
  });
});

describe("call and response", () => {
  it("cuts the chart into your turns and the band's answers, after any intro", () => {
    const score = band();
    const plain = { ...score, frame: { ...score.frame, intro: undefined } };
    const blocks = callBlocks(plain, 2);
    expect(blocks[0]).toEqual({ kind: "call", start: 0, bars: 2, round: 0 });
    expect(blocks[1]).toEqual({ kind: "answer", start: 2, bars: 2, round: 0 });
    expect(blocks[2].round).toBe(1);
    expect(blocks.reduce((s, b) => s + b.bars, 0)).toBe(score.frame.bars);
    expect(blockAt(blocks, 3)?.kind).toBe("answer");
    const intro = callBlocks({ ...score, frame: { ...score.frame, intro: 4 } }, 4);
    expect(intro[0].start).toBe(4);
    expect(blockAt(intro, 2)).toBeNull();
  });

  it("leaves your turns to you: the players out front step back, the rhythm section keeps going", () => {
    const score = band();
    const spaced = leaveSpace(score, 2);
    const beats = score.frame.meter.beats;
    for (const b of callBlocks(score, 2).filter((x) => x.kind === "call")) {
      for (let bar = b.start; bar < b.start + b.bars; bar++) {
        for (const m of score.members) {
          const role = score.plan[bar].roles[m.id];
          const kept = notesIn(spaced.parts[m.id], bar, bar + 1, beats);
          if (m.instrument === "drums" || m.instrument === "bass") expect(kept.length).toBe(notesIn(score.parts[m.id], bar, bar + 1, beats).length);
          else if (["lead", "solo", "counter", "fill", "trade"].includes(role)) expect(kept).toEqual([]);
        }
      }
    }
    // the drummer and the bass never stop
    expect(spaced.parts.owl.length).toBe(score.parts.owl.length);
    expect(spaced.parts.frog.length).toBe(score.parts.frog.length);
  });

  it("answers your phrase on the soloist's horn, on the changes it lands on", () => {
    const score = band();
    const [turn, reply] = callBlocks(score, 2);
    const at = turn.start * 4;
    const call: NoteEvent[] = [
      { pitch: 60, start: at, dur: 1, vel: 0.8 },
      { pitch: 63, start: at + 1.5, dur: 0.5, vel: 0.7 },
      { pitch: 67, start: at + 2, dur: 2, vel: 0.9 },
      { pitch: 70, start: at + 5, dur: 0.5, vel: 0.6 },
    ];
    const spaced = leaveSpace(score, 2, { 0: call });
    const who = echoerFor(score, reply.start)!;
    expect(who).toBeTruthy();
    const answer = notesIn(spaced.parts[who], reply.start, reply.start + 2);
    // the same rhythm, two bars on
    expect(answer.map((n) => n.start)).toEqual(call.map((n) => n.start + 8));
    const inst = INSTRUMENTS[score.members.find((m) => m.id === who)!.instrument];
    const [lo, hi] = inst.solo ?? inst.sweet;
    const h = harmonyOf(score.frame, score.plan);
    for (const n of answer) {
      expect(n.pitch).toBeGreaterThanOrEqual(lo - 12);
      expect(n.pitch).toBeLessThanOrEqual(hi + 12);
      // every note is in the scale of the chord it lands on; the long and on-the-beat ones sit on it
      const here = h.at(n.start);
      expect(here.scale).toContain(mod(n.pitch, 12));
      if (Number.isInteger(n.start) || n.dur >= 1) expect(holdable(here, mod(n.pitch, 12), score.frame.style)).toBe(true);
    }
    // the answer replaces what they had there; without a call they keep it
    expect(notesIn(leaveSpace(score, 2).parts[who], reply.start, reply.start + 2)).toEqual(notesIn(score.parts[who], reply.start, reply.start + 2));
  });

  it("thins a chord to its top note for a horn, and keeps it inside the answer", () => {
    const score = band();
    const blocks = callBlocks(score, 2);
    const horn = score.members.find((m) => m.instrument === "trumpet")!;
    const at = blocks[0].start * 4;
    const chord: NoteEvent[] = [
      { pitch: 60, start: at, dur: 1, vel: 0.7 },
      { pitch: 64, start: at + 0.02, dur: 1, vel: 0.7 },
      { pitch: 67, start: at, dur: 1, vel: 0.7 },
      { pitch: 72, start: at + 7, dur: 4, vel: 0.7 },
    ];
    const out = echoPhrase(score, chord, blocks[0], blocks[1], horn.id);
    expect(out).toHaveLength(2);
    // a note held over the end of the answer is cut there
    expect(out[1].start + out[1].dur).toBeLessThanOrEqual((blocks[1].start + 2) * 4 + 1e-9);
  });
});
