import type { Room } from "./packs";

// Each room tunes the one Dattorro reverb its own way, not just how much is sent to it. smplr's
// default tank is bright and splashy (almost no damping, full input bandwidth); a club is a small
// dark room that gives the notes back quickly, a hall a big open one that hangs on.

export interface RoomTuning {
  /** Tank feedback, 0–1 (≈ RT60: 0.4 ≈ 1 s, 0.8 ≈ 3 s with smplr's delays). */
  decay: number;
  /** High-frequency absorption in the tank, 0–1: higher is darker. */
  damping: number;
  /** Input low-pass, 0–1: lower is a darker wet signal. */
  bandwidth: number;
  /** Gap before the reflections, in seconds. */
  preDelay: number;
}

export const ROOM_TUNING: Record<Room, RoomTuning> = {
  dry: { decay: 0.3, damping: 0.6, bandwidth: 0.5, preDelay: 0 },
  club: { decay: 0.45, damping: 0.45, bandwidth: 0.6, preDelay: 0.008 },
  hall: { decay: 0.8, damping: 0.2, bandwidth: 0.82, preDelay: 0.024 },
};

type Param = "preDelay" | "bandwidth" | "decay" | "damping" | "wet" | "dry";

export interface TunableReverb {
  getParam(name: Param): { value: number } | undefined;
}

/** Set the reverb up as `room` (a send effect: the node itself is all wet). */
export function tuneRoom(reverb: TunableReverb, room: Room, sampleRate: number): void {
  const t = ROOM_TUNING[room];
  const set = (name: Param, value: number) => {
    const p = reverb.getParam(name);
    if (p) p.value = value;
  };
  set("decay", t.decay);
  set("damping", t.damping);
  set("bandwidth", t.bandwidth);
  set("preDelay", Math.round(t.preDelay * sampleRate));
  set("wet", 1);
  set("dry", 0);
}
