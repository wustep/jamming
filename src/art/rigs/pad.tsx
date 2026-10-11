import { L, S, ellipsePath, hash, mix, rectPath } from "../sketch";
import { clamp } from "../affine";
import { isBlack, keyUnits } from "../fingering";
import { type Rig, type RigCtx, type Frame, damp } from "./types";
import { playKeys } from "./keys";

// A string machine on an X stand, played standing: a slim keyboard with a panel of sliders over
// the keys and two voice tabs (strings, choir). It holds chords rather than striking them, so the
// panel's glow swells with how many notes are ringing, and a slow wave drifts up off it while
// they ring.
//
// Keyboard spans C2 (36) … C6 (84), middle C in the middle where the pad's chords sit.
const LO = 36;
const HI = 84;
const X0 = 36;
const X1 = 204;
export const PAD_KEY_TOP = 198;
const KEY_TOP = PAD_KEY_TOP;
const KEY_BOT = 211;
const BLACK_H = 8;
const WHITE_COUNT = keyUnits(HI) - keyUnits(LO) + 1;
const KW = (X1 - X0) / WHITE_COUNT;
const SPLIT = 60;

export function padKeyX(p: number): number {
  // anything off the keyboard is played an octave in, where this keyboard has it
  let q = p;
  while (q < LO) q += 12;
  while (q > HI) q -= 12;
  return X0 + (keyUnits(q) - keyUnits(LO) + 0.5) * KW;
}

const POOL = 10;
const CASE = "#e7e1f2";
const CASE_HATCH = "#b9b0cf";
const CASE_INK = "#3f3a52";
const STAND = "#4a4558";
const IVORY = "#fffbef";
const SLIDERS = [28, 22, 30, 18, 26, 20];

export const pad: Rig = {
  follow: "world",
  render(c: RigCtx) {
    const seps: string[] = [];
    const blacks: string[] = [];
    for (let p = LO; p <= HI; p++) {
      const x = padKeyX(p);
      if (isBlack(p)) blacks.push(rectPath(x - KW * 0.32, KEY_TOP, KW * 0.64, BLACK_H));
      else if (p > LO) seps.push(`M${(x - KW / 2).toFixed(1)} ${KEY_TOP} V${KEY_BOT}`);
    }
    const s = hash(c.animal + "pad");
    return {
      back: (
        <g>
          {/* the slow wave drifting up off the panel while chords ring */}
          <g ref={c.bag.r("wave")} style={{ opacity: 0 }}>
            <path d="M56 160 q8 -6 16 0 t16 0 t16 0" fill="none" stroke={c.fill} strokeWidth={2.4} strokeLinecap="round" />
            <path d="M150 150 q8 -6 16 0 t16 0" fill="none" stroke={c.fill} strokeWidth={2.4} strokeLinecap="round" />
          </g>
        </g>
      ),
      front: (
        <g>
          {/* the X stand, its feet on the floor */}
          <L d="M74 214 L156 246 M166 214 L84 246 M70 246 H90 M150 246 H170" ink={STAND} seed={s + 20} w={3.4} />
          <S d={ellipsePath(120, 230, 4, 4)} ink={STAND} base={STAND} seed={s + 21} w={1.2} />
          {/* the case: a slim body with the panel above the keys */}
          <S d={rectPath(22, 176, 196, 40, 5)} ink={CASE_INK} base={mix(CASE, "#fff", 0.2)} hatch={CASE_HATCH} seed={s + 1} gap={3.4} />
          {/* sliders */}
          {SLIDERS.map((y, i) => (
            <g key={i}>
              <path d={`M${44 + i * 10} 181 V193`} stroke="#8a83a0" strokeWidth={1.6} strokeLinecap="round" />
              <rect x={41 + i * 10} y={178 + (y % 12)} width={6} height={3.4} rx={1} fill="#e0786d" stroke={CASE_INK} strokeWidth={0.7} />
            </g>
          ))}
          {/* the two voice tabs, and the glow that swells with the chord */}
          <S d={rectPath(118, 181, 22, 9, 2)} ink={CASE_INK} base="#f6e7b5" seed={s + 2} w={1} />
          <S d={rectPath(144, 181, 22, 9, 2)} ink={CASE_INK} base="#cfe3f2" seed={s + 3} w={1} />
          <path d="M122 185.5 h14 M148 185.5 h14" stroke={CASE_INK} strokeWidth={0.8} strokeDasharray="2 1.6" />
          <circle ref={c.bag.r("glow")} cx={186} cy={185.5} r={5} fill="#f5c84c" stroke="#c98a1c" strokeWidth={0.9} style={{ opacity: 0.25 }} />
          <circle cx={200} cy={185.5} r={3} fill="#cfc8de" stroke={CASE_INK} strokeWidth={0.8} />

          {/* keys */}
          <path d={rectPath(X0, KEY_TOP, X1 - X0, KEY_BOT - KEY_TOP)} fill={IVORY} stroke="#2c2a35" strokeWidth={1.3} />
          {Array.from({ length: POOL }, (_, i) => (
            <rect key={i} ref={c.bag.r("kh" + i)} y={KEY_TOP} width={KW} height={KEY_BOT - KEY_TOP} fill={c.fill} style={{ opacity: 0 }} />
          ))}
          <path d={seps.join(" ")} stroke="#2c2a35" strokeWidth={0.75} strokeOpacity={0.7} />
          <path d={blacks.join(" ")} fill="#2c2a35" />
          {Array.from({ length: POOL }, (_, i) => (
            <rect key={i} ref={c.bag.r("kb" + i)} y={KEY_TOP} width={KW * 0.64} height={BLACK_H} fill={mix(c.fill, "#000000", 0.2)} style={{ opacity: 0 }} />
          ))}
          <S d={rectPath(X0 - 1, KEY_TOP - 1, X1 - X0 + 2, KEY_BOT - KEY_TOP + 2)} ink="#2c2a35" seed={s + 4} w={1.5} />
        </g>
      ),
    };
  },
  update(c: RigCtx, f: Frame) {
    const { s } = f;
    const m = c.mem;
    let wi = 0;
    let bi = 0;
    for (const n of s.active) {
      const x = padKeyX(n.pitch);
      const a = 0.35 + 0.5 * (1 - n.progress * 0.5);
      if (isBlack(n.pitch)) {
        if (bi < POOL) {
          c.bag.set("kb" + bi, "x", x - KW * 0.32);
          c.bag.op("kb" + bi, a);
          bi++;
        }
      } else if (wi < POOL) {
        c.bag.set("kh" + wi, "x", x - KW / 2);
        c.bag.op("kh" + wi, a);
        wi++;
      }
    }
    for (; wi < POOL; wi++) c.bag.op("kh" + wi, 0);
    for (; bi < POOL; bi++) c.bag.op("kb" + bi, 0);

    playKeys(c, f, padKeyX, [
      { key: "L", lo: -Infinity, hi: SPLIT - 1, home: padKeyX(52), top: KEY_TOP },
      { key: "R", lo: SPLIT, hi: Infinity, home: padKeyX(72), top: KEY_TOP },
    ]);
    // a standing player doesn't slide along a bench
    f.look.shift = 0;

    // the glow follows how full the chord is; the wave rises while it rings
    const ringing = clamp(s.active.length / 4, 0, 1);
    damp(m, "glow", 0.25 + 0.75 * ringing, f.dt, 0.15);
    c.bag.op("glow", m.glow);
    damp(m, "wave", ringing * 0.55, f.dt, 0.5);
    m.waveY = ((m.waveY ?? 0) + f.dt * 6) % 14;
    c.bag.op("wave", m.wave * (1 - m.waveY / 14));
    c.bag.tf("wave", `translate(0 ${(-m.waveY).toFixed(2)})`);
  },
};
