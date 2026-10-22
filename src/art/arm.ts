import type { Pt } from "./affine";

// An arm is an upper arm and a forearm of fixed, equal length, hinged at the elbow. A paw that
// reaches farther straightens the elbow; it never stretches the arm. A paw asked to go past the
// arm's reach stops at the end of it (the rigs keep their paws within reach, and the audit holds
// them to it, so that's only a backstop).

/** How far a player's paw reaches from the shoulder (arm straight) unless the rig says otherwise. */
export const ARM_REACH = 58;

/** Shoulder width, then wrist width, of the arm's half-thickness. */
export const ARM_W = { upper: 7, fore: 5.4 };

/** A player's arms at an instrument (the rig sets them; ARM unless it says otherwise). */
export interface ArmSpec {
  /** How far a paw can get from its shoulder on the page, arm straight. */
  reach: number;
  /** How far in front of the shoulders the paws work (toward the audience): a keyboard, a horn. */
  depth: number;
  /**
   * Where the elbows point: outward (x, mirrored for the other arm), down (y) and back behind
   * the body (z). The elbow bends toward this, as far as the arm allows.
   */
  pole: { x: number; y: number; z: number };
}

export const ARM: ArmSpec = { reach: ARM_REACH, depth: 18, pole: { x: 0.8, y: 0.6, z: 0.4 } };

export interface ArmPose {
  /** Where the paw ends up (within reach of the shoulder). */
  hand: Pt;
  elbow: Pt;
  /** How far past its reach the paw was asked to go (0 when within reach). */
  over: number;
  /** Carry into the next frame's poseArm. */
  state: ArmState;
}

export interface ArmState {
  /** The elbow, relative to the shoulder. */
  elbow: Pt;
  hand: Pt;
}

/**
 * How fast an elbow may move beyond its paw's own speed (px a 60 fps frame): a backstop for a paw
 * passing right in front of its shoulder, where a small move turns the elbow a long way.
 */
const ELBOW_SLACK = 4;

/**
 * The arm for a paw at `target` (`side` −1 for the viewer-left arm). The arm is a fixed length in
 * three dimensions, the paws working `depth` in front of the shoulders, and is drawn as seen from
 * the front: a paw close to its shoulder has the arm folded forward toward the audience (shorter
 * on the page), a far one has it straight, at its full length and no more. The elbow bends toward
 * the pole, so it moves smoothly as the paw does, never flipping from one side to the other.
 * `prev` is last frame's state (none on the first frame).
 */
export function poseArm(shoulder: Pt, target: Pt, spec: ArmSpec, side: -1 | 1, prev?: ArmState, dt = 1 / 60): ArmPose {
  const { reach, depth, pole } = spec;
  const dx = target.x - shoulder.x;
  const dy = target.y - shoulder.y;
  const d = Math.hypot(dx, dy);
  // the paw stops at the end of the arm (a hair short: a dead-straight arm has no elbow to bend)
  const max = reach * 0.995;
  const over = Math.max(0, d - max);
  const k = over > 0 ? max / d : 1;
  const hand = over > 0 ? { x: shoulder.x + dx * k, y: shoulder.y + dy * k } : target;
  const hx = dx * k;
  const hy = dy * k;
  const seg = Math.hypot(reach, depth) / 2;
  const D = Math.hypot(hx, hy, depth) || 1;
  const u = { x: hx / D, y: hy / D, z: depth / D };
  // the pole, less its part along the arm
  const P = { x: side * pole.x, y: pole.y, z: -pole.z };
  const pu = P.x * u.x + P.y * u.y + P.z * u.z;
  let n = { x: P.x - pu * u.x, y: P.y - pu * u.y, z: P.z - pu * u.z };
  let nl = Math.hypot(n.x, n.y, n.z);
  if (nl < 1e-4) {
    // the paw straight along the pole: bend outward instead
    n = { x: side - u.x * side * u.x, y: -u.y * side * u.x, z: -u.z * side * u.x };
    nl = Math.hypot(n.x, n.y, n.z) || 1;
  }
  const out = Math.sqrt(Math.max(0, seg * seg - (D / 2) * (D / 2)));
  let elbow = { x: shoulder.x + hx / 2 + (n.x / nl) * out, y: shoulder.y + hy / 2 + (n.y / nl) * out };
  if (prev) {
    // from where it was, no faster than the paw plus a little
    const from = { x: shoulder.x + prev.elbow.x, y: shoulder.y + prev.elbow.y };
    const cap = (Math.hypot(hand.x - prev.hand.x, hand.y - prev.hand.y) + ELBOW_SLACK * dt * 60) * 1.0001;
    const ex = elbow.x - from.x;
    const ey = elbow.y - from.y;
    const de = Math.hypot(ex, ey);
    if (de > cap) elbow = { x: from.x + (ex / de) * cap, y: from.y + (ey / de) * cap };
    // and never farther than an upper arm from the shoulder or a forearm from the paw
    for (let i = 0; i < 4; i++) {
      for (const c of [shoulder, hand]) {
        const r = Math.hypot(elbow.x - c.x, elbow.y - c.y);
        if (r > seg) elbow = { x: c.x + ((elbow.x - c.x) * seg) / r, y: c.y + ((elbow.y - c.y) * seg) / r };
      }
    }
  }
  return { hand, elbow, over, state: { elbow: { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y }, hand } };
}

const f1 = (n: number) => n.toFixed(1);

/**
 * The arm's centre line, shoulder to paw through the elbow with the corner softened, as SVG
 * paths: the whole arm, and the upper arm alone (drawn thicker over it, so it tapers to the wrist).
 * The outline starts a little way down the arm so it melts into the body at the shoulder.
 */
export function armPaths(shoulder: Pt, elbow: Pt, hand: Pt): { whole: string; upper: string; inkWhole: string; inkUpper: string; hatch: string } {
  const a = { x: elbow.x - shoulder.x, y: elbow.y - shoulder.y };
  const b = { x: hand.x - elbow.x, y: hand.y - elbow.y };
  const la = Math.hypot(a.x, a.y) || 1;
  const lb = Math.hypot(b.x, b.y) || 1;
  const ua = { x: a.x / la, y: a.y / la };
  const ub = { x: b.x / lb, y: b.y / lb };
  // round the elbow over a few px either side of it
  const r = Math.min(7, la * 0.35, lb * 0.35);
  const e0 = { x: elbow.x - ua.x * r, y: elbow.y - ua.y * r };
  const e1 = { x: elbow.x + ub.x * r, y: elbow.y + ub.y * r };
  const corner = `L${f1(e0.x)} ${f1(e0.y)} Q${f1(elbow.x)} ${f1(elbow.y)} ${f1(e1.x)} ${f1(e1.y)} L${f1(hand.x)} ${f1(hand.y)}`;
  const inset = (w: number) => ({ x: shoulder.x + ua.x * Math.min(w, la * 0.6), y: shoulder.y + ua.y * Math.min(w, la * 0.6) });
  const iw = inset(ARM_W.fore + 1.2);
  const iu = inset(ARM_W.upper + 1.2);
  const hatch: string[] = [];
  // three light strokes across the arm, like the crayon fill elsewhere
  for (const [p, u, w] of [
    [{ x: shoulder.x + a.x * 0.55, y: shoulder.y + a.y * 0.55 }, ua, ARM_W.upper],
    [{ x: elbow.x + b.x * 0.3, y: elbow.y + b.y * 0.3 }, ub, ARM_W.fore],
    [{ x: elbow.x + b.x * 0.68, y: elbow.y + b.y * 0.68 }, ub, ARM_W.fore],
  ] as const) {
    const k = w * 0.6;
    hatch.push(`M${f1(p.x - u.y * k - u.x * 2)} ${f1(p.y + u.x * k - u.y * 2)} L${f1(p.x + u.y * k + u.x * 2)} ${f1(p.y - u.x * k + u.y * 2)}`);
  }
  return {
    whole: `M${f1(shoulder.x)} ${f1(shoulder.y)} ${corner}`,
    upper: `M${f1(shoulder.x)} ${f1(shoulder.y)} L${f1(elbow.x)} ${f1(elbow.y)}`,
    inkWhole: `M${f1(iw.x)} ${f1(iw.y)} ${corner}`,
    inkUpper: `M${f1(iu.x)} ${f1(iu.y)} L${f1(elbow.x)} ${f1(elbow.y)}`,
    hatch: hatch.join(" "),
  };
}
