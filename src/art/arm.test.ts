import { describe, expect, it } from "vitest";
import { ARM, type ArmSpec, type ArmState, poseArm } from "./arm";

const SH = { x: 91, y: 170 };
const len = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const SPEC: ArmSpec = { ...ARM, reach: 58 };
const SEG = Math.hypot(SPEC.reach, SPEC.depth) / 2;

describe("an arm never stretches", () => {
  it("draws the upper arm and the forearm no longer than they are, wherever the paw goes", () => {
    for (const target of [
      { x: 44, y: 195 },
      { x: 91, y: 200 },
      { x: 130, y: 205 },
      { x: 95, y: 172 },
      { x: 66, y: 126 },
      { x: 91 + 57, y: 170 },
    ]) {
      const a = poseArm(SH, target, SPEC, -1);
      expect(len(SH, a.elbow), JSON.stringify(target)).toBeLessThanOrEqual(SEG + 1e-9);
      expect(len(a.elbow, a.hand), JSON.stringify(target)).toBeLessThanOrEqual(SEG + 1e-9);
      expect(a.hand).toEqual(target);
      expect(a.over).toBe(0);
    }
    // reaching all the way, the arm is straight and as long as it is
    const far = poseArm(SH, { x: SH.x - 57.7, y: SH.y }, SPEC, -1);
    expect(len(SH, far.elbow) + len(far.elbow, far.hand)).toBeGreaterThan(57.5);
  });

  it("stops a paw at the end of its reach and says how far short it fell", () => {
    const a = poseArm(SH, { x: 10, y: 170 }, SPEC, -1);
    expect(len(SH, a.hand)).toBeLessThanOrEqual(58);
    expect(a.over).toBeGreaterThan(20);
  });

  it("bends the elbow out to the side and down", () => {
    // the viewer-left arm reaching to the middle of a keyboard
    const a = poseArm(SH, { x: 115, y: 205 }, SPEC, -1);
    expect(a.elbow.x).toBeLessThan((SH.x + 115) / 2);
    expect(a.elbow.y).toBeGreaterThan(SH.y);
    // and the other arm mirrors it
    const b = poseArm({ x: 149, y: 170 }, { x: 125, y: 205 }, SPEC, 1);
    expect(b.elbow.x).toBeGreaterThan((149 + 125) / 2);
  });

  it("moves the elbow smoothly as the paw sweeps anywhere around the shoulder", () => {
    // a full circle at three distances, a degree a frame
    for (const r of [12, 30, 50]) {
      let prev: ArmState | undefined;
      let last = SH;
      for (let deg = 0; deg <= 360; deg++) {
        const a = (deg * Math.PI) / 180;
        const p = poseArm(SH, { x: SH.x + Math.cos(a) * r, y: SH.y + Math.sin(a) * r }, SPEC, -1, prev);
        if (prev) expect(len(p.elbow, last), `r ${r} at ${deg}°`).toBeLessThan(6);
        prev = p.state;
        last = p.elbow;
      }
    }
  });
});
