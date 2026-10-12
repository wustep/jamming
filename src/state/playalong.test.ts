import { describe, expect, it } from "vitest";
import { listenToMidi, type MidiAccessLike, type MidiInputLike } from "@/audio/midi";
import { defaultMembers } from "@/music/instruments";
import { callBlocks, echoerFor } from "@/music/live";
import { defaultSettings, generateLocal } from "@/music/local";
import type { Score } from "@/music/types";
import { PlayAlongCore, type LiveAudio } from "./playalong";

// A simulated MIDI keyboard into the play-along brain, over a fake engine whose clock is a
// straight line: the band at 120 bpm (half a second a beat), started at performance time 0.

const SPB = 0.5;

function fakeAudio(playing = true) {
  const calls: { on: [number, number, number | undefined][]; off: number[]; scores: Score[] } = { on: [], off: [], scores: [] };
  const audio: LiveAudio = {
    liveOn: (p, v, at) => void calls.on.push([p, v, at]),
    liveOff: (p) => void calls.off.push(p),
    liveAllOff: () => {},
    heardBeatAt: (ms) => (playing ? ms / 1000 / SPB : -Infinity),
    timeOfBeat: (b) => (playing ? 10 + b * SPB : null),
    getSwing: () => 0.5,
    getBeat: () => 0,
    updateScore: (s) => void calls.scores.push(s),
  };
  return { audio, calls };
}

/** A keyboard that can be plugged in, played and unplugged. */
function fakeMidi() {
  const inputs = new Map<string, MidiInputLike>();
  const access: MidiAccessLike = { inputs, onstatechange: null };
  const plug = (id: string, name: string) => {
    inputs.set(id, { id, name, state: "connected", onmidimessage: null });
    access.onstatechange?.({});
  };
  const send = (id: string, bytes: number[], timeStamp: number) => inputs.get(id)?.onmidimessage?.({ data: new Uint8Array(bytes), timeStamp });
  return { access, plug, send, inputs };
}

const ms = (beat: number) => beat * SPB * 1000;

function band(): Score {
  const members = defaultMembers();
  return generateLocal({ ...defaultSettings(members), seed: 7 }, members).score;
}

describe("a MIDI keyboard into the play-along", () => {
  it("hears every keyboard plugged in, including one plugged in later", () => {
    const midi = fakeMidi();
    midi.plug("a", "KeyStep");
    const seen: string[][] = [];
    const notes: number[] = [];
    const stop = listenToMidi(
      midi.access,
      (msg) => msg.type === "on" && notes.push(msg.pitch),
      (inputs) => seen.push(inputs.map((i) => i.name)),
    );
    midi.plug("b", "Pad");
    midi.send("a", [0x90, 60, 100], 5);
    midi.send("b", [0x99, 36, 100], 6);
    midi.send("b", [0xf8], 7); // clock: ignored
    expect(seen).toEqual([["KeyStep"], ["KeyStep", "Pad"]]);
    expect(notes).toEqual([60, 36]);
    stop();
    expect(midi.inputs.get("a")?.onmidimessage).toBeNull();
  });

  it("sounds a note the moment it's played, and stops it when let go", () => {
    const { audio, calls } = fakeAudio();
    const core = new PlayAlongCore(audio);
    const midi = fakeMidi();
    midi.plug("a", "KeyStep");
    listenToMidi(midi.access, (msg, t) => core.midi(msg, t), () => {});
    midi.send("a", [0x90, 62, 127], ms(1.1));
    expect(calls.on).toEqual([[62, 1, undefined]]);
    expect(core.held()).toEqual([62]);
    midi.send("a", [0x90, 62, 0], ms(1.5));
    expect(calls.off).toEqual([62]);
    expect(core.held()).toEqual([]);
  });

  it("with a light snap, holds an early note for the band's beat; a late one plays at once", () => {
    const { audio, calls } = fakeAudio();
    const core = new PlayAlongCore(audio);
    core.quantize = "light";
    core.noteOn(60, 0.8, ms(0.9)); // a little early for beat 1: pulled halfway, to 0.95
    core.noteOn(64, 0.8, ms(2.1)); // a little late for beat 2: can't be taken back
    expect(calls.on[0][2]).toBeCloseTo(10 + 0.95 * SPB, 6);
    expect(calls.on[1][2]).toBeUndefined();
  });

  it("rings on with the sustain pedal down, and lets go when it comes up", () => {
    const { audio, calls } = fakeAudio();
    const core = new PlayAlongCore(audio);
    core.midi({ type: "sustain", down: true, channel: 0 }, 0);
    core.noteOn(60, 0.8, 10);
    core.noteOff(60, 20);
    expect(calls.off).toEqual([]);
    expect(core.held()).toEqual([60]);
    core.midi({ type: "sustain", down: false, channel: 0 }, 30);
    expect(calls.off).toEqual([60]);
  });

  it("plays along even with the band stopped", () => {
    const { audio, calls } = fakeAudio(false);
    const core = new PlayAlongCore(audio);
    core.noteOn(60, 0.5, 0);
    expect(calls.on).toHaveLength(1);
  });
});

describe("call and response, played on a simulated keyboard", () => {
  it("hands what you played in your turn to the soloist, who plays it back in theirs", () => {
    const { audio, calls } = fakeAudio();
    const core = new PlayAlongCore(audio);
    const midi = fakeMidi();
    midi.plug("a", "KeyStep");
    listenToMidi(midi.access, (msg, t) => core.midi(msg, t), () => {});
    const score = band();
    core.callResponse = { on: true, every: 2 };
    const start = core.arrangeForPlay(score);
    const blocks = callBlocks(score, 2);
    const at = blocks[0].start * 4; // after the intro
    const who = echoerFor(score, blocks[1].start)!;
    // the band starts with room left for you
    expect(start).not.toBe(score);
    // your two bars: a little phrase, the last note still held when your turn ends
    midi.send("a", [0x90, 60, 100], ms(at));
    midi.send("a", [0x80, 60, 0], ms(at + 0.9));
    midi.send("a", [0x90, 64, 90], ms(at + 1));
    midi.send("a", [0x80, 64, 0], ms(at + 1.9));
    midi.send("a", [0x90, 67, 110], ms(at + 6));
    core.tick(ms(at + 8.1)); // the answer has begun
    const last = calls.scores[calls.scores.length - 1];
    expect(last).toBeTruthy();
    const answer = last.parts[who].filter((n) => n.start >= at + 8 && n.start < at + 16);
    expect(answer.map((n) => n.start - at)).toEqual([8, 9, 14]);
    // the held note was cut at the end of your turn
    expect(answer[2].dur).toBeCloseTo(2, 6);
    // what you play in the answer isn't taken as a call
    midi.send("a", [0x80, 67, 0], ms(at + 9));
    midi.send("a", [0x90, 72, 100], ms(at + 10));
    midi.send("a", [0x80, 72, 0], ms(at + 11));
    core.tick(ms(at + 11));
    expect(core.turnAt(blocks[0].start + 1)).toEqual(blocks[0]);
    expect(core.turnAt(blocks[1].start)?.kind).toBe("answer");
    // so the next answer, with no call of yours before it, is the soloist's own
    const next = echoerFor(score, blocks[3].start)!;
    const own = (sc: Score) => sc.parts[next].filter((n) => n.start >= blocks[3].start * 4 && n.start < (blocks[3].start + 2) * 4);
    expect(own(core.getArranged()!)).toEqual(own(score));
  });

  it("counts a note pushed a hair ahead of your turn as its first note", () => {
    const { audio, calls } = fakeAudio();
    const core = new PlayAlongCore(audio);
    const score = band();
    core.callResponse = { on: true, every: 2 };
    core.arrangeForPlay(score);
    const [turn, reply] = callBlocks(score, 2);
    const at = turn.start * 4;
    core.noteOn(70, 0.8, ms(at - 0.2));
    core.noteOff(70, ms(at + 0.8));
    core.noteOn(72, 0.8, ms(at - 1.5)); // the band's bars: not yours
    core.noteOff(72, ms(at - 1.2));
    core.tick(ms(reply.start * 4 + 0.1));
    const who = echoerFor(score, reply.start)!;
    const answer = calls.scores[calls.scores.length - 1].parts[who].filter((n) => n.start >= reply.start * 4 && n.start < (reply.start + 2) * 4);
    expect(answer.map((n) => n.start)).toEqual([reply.start * 4]);
    expect(answer[0].dur).toBeCloseTo(0.8, 6);
  });

  it("plays the chart as written with call and response off", () => {
    const { audio } = fakeAudio();
    const core = new PlayAlongCore(audio);
    const score = band();
    expect(core.arrangeForPlay(score)).toBe(score);
    expect(core.turnAt(0)).toBeNull();
  });
});
