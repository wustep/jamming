import { describe, expect, it } from "vitest";
import { CLIP_SIZE, clipLayout } from "./clip";

const { width: W, height: H } = CLIP_SIZE;

describe("a clip's layout", () => {
  for (const n of [1, 2, 4, 5, 6, 9, 12]) {
    it(`fits a band of ${n} on the frame without overlaps`, () => {
      const slots = clipLayout(n, W, 150, H - 70);
      expect(slots).toHaveLength(n);
      for (const s of slots) {
        expect(s.w).toBeGreaterThan(60);
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x + s.w).toBeLessThanOrEqual(W);
        expect(s.y).toBeGreaterThanOrEqual(150);
        expect(s.y + s.w * (270 / 240)).toBeLessThanOrEqual(H - 70);
      }
      for (let i = 1; i < n; i++) {
        const [a, b] = [slots[i - 1], slots[i]];
        if (a.y === b.y) expect(b.x).toBeGreaterThanOrEqual(a.x + a.w);
      }
    });
  }

  it("puts a big band on two rows", () => {
    expect(new Set(clipLayout(4, W, 150, H - 70).map((s) => s.y)).size).toBe(1);
    expect(new Set(clipLayout(8, W, 150, H - 70).map((s) => s.y)).size).toBe(2);
  });
});
