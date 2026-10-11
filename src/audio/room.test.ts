import { describe, expect, it } from "vitest";
import { ROOM_TUNING, tuneRoom } from "./room";
import { ROOMS } from "./packs";

describe("rooms", () => {
  it("a hall rings longer and brighter than a club, and a club than dry", () => {
    expect(ROOM_TUNING.hall.decay).toBeGreaterThan(ROOM_TUNING.club.decay);
    expect(ROOM_TUNING.club.decay).toBeGreaterThan(ROOM_TUNING.dry.decay);
    expect(ROOM_TUNING.hall.damping).toBeLessThan(ROOM_TUNING.club.damping);
    expect(ROOM_TUNING.hall.preDelay).toBeGreaterThan(ROOM_TUNING.club.preDelay);
  });
  it("tunes every room's tank, and keeps it a send", () => {
    for (const room of ROOMS) {
      const params: Record<string, { value: number }> = {};
      tuneRoom({ getParam: (n) => (params[n] ??= { value: -1 }) }, room, 48000);
      expect(params.decay.value).toBe(ROOM_TUNING[room].decay);
      expect(params.damping.value).toBe(ROOM_TUNING[room].damping);
      expect(params.preDelay.value).toBe(Math.round(ROOM_TUNING[room].preDelay * 48000));
      expect([params.wet.value, params.dry.value]).toEqual([1, 0]);
    }
  });
  it("leaves a reverb that isn't ready yet alone", () => {
    expect(() => tuneRoom({ getParam: () => undefined }, "hall", 44100)).not.toThrow();
  });
});
