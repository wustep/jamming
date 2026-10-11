import { approach, clamp } from "../affine";
import { type Frame, type RigCtx, damp, glide, hit, nextWhere } from "./types";

/** One hand at a keyboard: the notes it takes, where it rests, and the top of the keys it plays. */
export interface KeyHand {
  key: "L" | "R";
  lo: number;
  hi: number;
  home: number;
  /** Top edge of the keys under this hand (an organ's two manuals sit at two heights). */
  top: number;
}

/**
 * Both hands at a keyboard (piano, organ, string machine). Each hand goes to the centre of its
 * sounding notes, or to its next note just before it arrives; it strokes down into the keys,
 * holds while the note sounds, and rebounds after. The body leans toward the busier hand, slides
 * along the bench for far-off notes, and sinks into big chords.
 */
export function playKeys(c: RigCtx, f: Frame, keyX: (pitch: number) => number, hands: KeyHand[]): { big: number; fresh: number } {
  const { s } = f;
  const m = c.mem;
  let leanSum = 0;
  let leanW = 0;
  // a note just over the split that was struck with a chord below it is the left hand's: a
  // left-hand voicing that reaches middle C doesn't hold the right hand down there
  const split = hands.find((h) => h.key === "R")?.lo ?? Infinity;
  const handPitch = (n: { pitch: number; age: number }) => {
    if (n.pitch < split || n.pitch > split + 2) return n.pitch;
    const low = s.active.reduce((lo, m) => (Math.abs(m.age - n.age) < 0.02 ? Math.min(lo, m.pitch) : lo), n.pitch);
    return low < split - 4 ? low : n.pitch;
  };
  for (const h of hands) {
    const inHand = (p: number) => p >= h.lo && p <= h.hi;
    const act = s.active.filter((n) => inHand(handPitch(n)));
    const last = s.recent.find((o) => inHand(o.pitch));
    // this hand's own next note (or chord), not just the part's next onset
    const nx = nextWhere(s, inHand);
    let target: number | null = null;
    let spread = 1;
    if (nx && nx.inSec < 0.22 && (act.length === 0 || nx.inSec < 0.08)) {
      let lo = keyX(nx.pitch);
      let hi = lo;
      for (const u of s.upcoming ?? []) {
        if (u.inSec - nx.inSec > 0.03) break;
        if (!inHand(u.pitch)) continue;
        lo = Math.min(lo, keyX(u.pitch));
        hi = Math.max(hi, keyX(u.pitch));
      }
      target = (lo + hi) / 2;
      spread = clamp((hi - lo) / 16, 1, 2.4);
    } else if (act.length) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const n of act) {
        const x = keyX(n.pitch);
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
      target = (lo + hi) / 2;
      spread = clamp((hi - lo) / 16, 1, 2.4);
    }
    const kx = "hx" + h.key;
    const ks = "hs" + h.key;
    if (m[kx] === undefined) m[kx] = h.home;
    if (m[ks] === undefined) m[ks] = 1;
    // to a note: quick but eased in and out; with nothing to play, a slow drift toward home
    if (target === null) damp(m, kx, m[kx] * 0.85 + h.home * 0.15, f.dt, 0.6);
    else glide(m, kx, target, f.dt, 26000, 1500);
    m[ks] += (spread - m[ks]) * approach(f.dt, 0.05);
    const lastAge = last ? last.age : Infinity;
    const nextIn = nx ? nx.inSec : Infinity;
    // A stroke from the wrist: the paw comes down into the keys and lands on the note, stays
    // down while it's held, and rebounds after. Legato (still holding when the next comes) is
    // a smaller lift: a change of fingers, not of hand.
    const holding = act.length > 0;
    const WIN = 0.12;
    let up = holding ? 0 : Math.min(1, lastAge / 0.08);
    if (nextIn < WIN) up = holding ? 0.5 * Math.sin(Math.PI * (1 - nextIn / WIN)) : Math.min(up, nextIn / WIN);
    const depth = 2 + 3 * (last?.vel ?? 0.5);
    const resting = act.length === 0 && lastAge > 0.6 && nextIn > 0.6;
    // traveling far, the hand lifts in an arc over the keys
    const arc = Math.min(8, Math.abs(m[kx + "V"] ?? 0) * 0.01);
    const y = damp(m, "hy" + h.key, h.top + 4 + depth * (1 - up) - 6 * up - arc - (resting ? 3 : 0), f.dt, 0.012);
    // the wrist rolls a little into each stroke
    const roll = (h.key === "L" ? 12 : -12) + (h.key === "L" ? 1 : -1) * 6 * (1 - up) * (holding ? 0.5 : 1);
    f.arms[h.key] = { hand: { x: m[kx], y }, spread: m[ks], bend: 10, pawRot: roll };
    const w = act.length + hit(lastAge, 0.2);
    leanSum += (m[kx] - 120) * w;
    leanW += w;
  }

  // Big chords: lean toward them and sink into the keys.
  const fresh = s.recent.filter((o) => o.age < 0.03).length;
  const big = s.recent.length ? hit(s.recent[0].age, 0.14) * clamp(fresh / 3, 0, 1.6) : 0;
  f.look.lean = leanW > 0 ? clamp((leanSum / leanW) * 0.06 * (1 + big * 0.6), -6.5, 6.5) : 0;
  // both hands far up or down the keyboard: slide along the bench toward them
  const mid = (m.hxL + m.hxR) / 2 - 120;
  f.look.shift = clamp((mid - Math.sign(mid) * 20) * 0.5, -12, 12) * (Math.abs(mid) > 20 ? 1 : 0);
  f.look.dip = clamp(big * 3.2, 0, 4.5);
  f.look.bliss = s.active.some((n) => n.durSec > 1.2 && n.progress > 0.15);
  return { big, fresh };
}
