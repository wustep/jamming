import { describe, expect, it } from "vitest";
import { kWeighting, loudness } from "./loudness";

const SR = 48000;
const sine = (hz: number, amp: number, seconds: number) => Float32Array.from({ length: Math.round(seconds * SR) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / SR));
const silence = (seconds: number) => new Float32Array(Math.round(seconds * SR));

describe("loudness (BS.1770)", () => {
  it("uses the standard's K-weighting at 48 kHz", () => {
    const [shelf, highpass] = kWeighting(48000);
    expect(shelf.b[0]).toBeCloseTo(1.53512485958697, 8);
    expect(shelf.b[1]).toBeCloseTo(-2.69169618940638, 8);
    expect(shelf.b[2]).toBeCloseTo(1.19839281085285, 8);
    expect(shelf.a[0]).toBeCloseTo(-1.69065929318241, 8);
    expect(shelf.a[1]).toBeCloseTo(0.73248077421585, 8);
    expect(highpass.a[0]).toBeCloseTo(-1.99004745483398, 8);
    expect(highpass.a[1]).toBeCloseTo(0.99007225036621, 8);
  });

  it("reads a full-scale 997 Hz tone at −3.01 LUFS in one channel and 0 in both", () => {
    const tone = sine(997, 1, 3);
    expect(loudness([tone, silence(3)], SR).lufs).toBeCloseTo(-3.01, 1);
    expect(loudness([tone, tone], SR).lufs).toBeCloseTo(0, 1);
    expect(loudness([tone, tone], SR).peak).toBeCloseTo(0, 1);
  });

  it("hears a bright tone as louder than a dark one at the same level", () => {
    const at = (hz: number) => loudness([sine(hz, 0.25, 2), sine(hz, 0.25, 2)], SR);
    expect(at(3000).rms).toBeCloseTo(at(100).rms, 1);
    expect(at(3000).lufs - at(100).lufs).toBeGreaterThan(3);
  });

  it("leaves the rests out (only the blocks a note's edge crosses pull it down)", () => {
    const note = sine(440, 0.3, 1);
    const withRests = Float32Array.from([...note, ...silence(2), ...note, ...silence(2)]);
    // a third of the time sounding: an average over all of it would sit 4.8 dB under the notes
    const gap = loudness([note, note], SR).lufs - loudness([withRests, withRests], SR).lufs;
    expect(gap).toBeGreaterThan(0);
    expect(gap).toBeLessThan(1.5);
    expect(loudness([silence(2), silence(2)], SR).lufs).toBe(-Infinity);
  });
});
