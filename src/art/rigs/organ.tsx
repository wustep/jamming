import { L, S, ellipsePath, hash, mix, rectPath } from "../sketch";
import { clamp } from "../affine";
import { isBlack, keyUnits } from "../fingering";
import { type Rig, type RigCtx, type Frame, damp } from "./types";
import { playKeys } from "./keys";

// A drawbar organ, cartoon-style: a wooden console with two manuals facing the audience (the left
// hand on the lower one, the right hand reaching up to the upper), the drawbars along the top, a
// wooden pedalboard under the player's feet, and a rotating-speaker cabinet beside it whose horn
// spins up when the band does. The player sits on a long organ bench behind.
//
// Both manuals span C2 (36) … C7 (96).
const LO = 36;
const HI = 96;
const X0 = 26;
const X1 = 214;
const UPPER_TOP = 188;
const LOWER_TOP = 202;
const KEY_H = 10;
const BLACK_H = 6;
const WHITE_COUNT = keyUnits(HI) - keyUnits(LO) + 1;
const KW = (X1 - X0) / WHITE_COUNT;
const SPLIT = 60;

export function organKeyX(p: number): number {
  const q = clamp(p, LO - 6, HI + 6);
  return X0 + (keyUnits(q) - keyUnits(LO) + 0.5) * KW;
}
/** The manual a note is played on: the upper for the right hand, the lower for the left. */
const manualTop = (p: number) => (p >= SPLIT ? UPPER_TOP : LOWER_TOP);

const POOL = 8;
const WOOD = "#b8763f";
const WOOD_HATCH = "#8f5629";
const WOOD_INK = "#4a2a14";
const DARK = "#3a2a20";
const IVORY = "#fffbef";
const CLOTH = "#d9c79f";
// drawbar caps, as on the real thing: two brown sub-octaves, white, black for the odd harmonics
const DRAWBARS = ["#7a4a26", "#7a4a26", "#fffbef", "#fffbef", "#2c2a35", "#fffbef", "#2c2a35", "#2c2a35", "#fffbef"];

function manual(c: RigCtx, top: number, tag: string, s: number) {
  const seps: string[] = [];
  const blacks: string[] = [];
  for (let p = LO; p <= HI; p++) {
    const x = organKeyX(p);
    if (isBlack(p)) blacks.push(rectPath(x - KW * 0.32, top, KW * 0.64, BLACK_H));
    else if (p > LO) seps.push(`M${(x - KW / 2).toFixed(1)} ${top} V${top + KEY_H}`);
  }
  return (
    <g>
      <path d={rectPath(X0, top, X1 - X0, KEY_H)} fill={IVORY} stroke="#2c2a35" strokeWidth={1.2} />
      {Array.from({ length: POOL }, (_, i) => (
        <rect key={i} ref={c.bag.r(tag + "w" + i)} y={top} width={KW} height={KEY_H} fill={c.fill} style={{ opacity: 0 }} />
      ))}
      <path d={seps.join(" ")} stroke="#2c2a35" strokeWidth={0.7} strokeOpacity={0.7} />
      <path d={blacks.join(" ")} fill="#2c2a35" />
      {Array.from({ length: POOL }, (_, i) => (
        <rect key={i} ref={c.bag.r(tag + "b" + i)} y={top} width={KW * 0.64} height={BLACK_H} fill={mix(c.fill, "#000000", 0.2)} style={{ opacity: 0 }} />
      ))}
      <S d={rectPath(X0 - 1, top - 1, X1 - X0 + 2, KEY_H + 2)} ink="#2c2a35" seed={s} w={1.4} />
    </g>
  );
}

export const organ: Rig = {
  follow: "world",
  seated: true,
  hideFeet: true,
  render(c: RigCtx) {
    const s = hash(c.animal + "organ");
    return {
      back: (
        <g>
          {/* the rotating-speaker cabinet behind the player's right: louvres up top, cloth below */}
          <S d={rectPath(176, 104, 54, 142, 4)} ink={WOOD_INK} base={mix(WOOD, "#fff", 0.12)} hatch={WOOD_HATCH} seed={s + 30} gap={3.4} />
          <S d={rectPath(182, 112, 42, 38, 2)} ink={WOOD_INK} base={DARK} seed={s + 31} w={1.2} />
          {/* the horn going round behind the louvres */}
          <g ref={c.bag.r("horn")} transform="translate(203 131)">
            <path d="M-16 -3 L16 -6 L16 6 L-16 3 Z" fill="#c9c2b3" stroke="#e9e2d0" strokeWidth={1} />
          </g>
          <path d="M184 118 H222 M184 124 H222 M184 130 H222 M184 136 H222 M184 142 H222" stroke={mix(WOOD, "#fff", 0.2)} strokeWidth={2.2} strokeLinecap="round" />
          <S d={rectPath(182, 160, 42, 72, 2)} ink={WOOD_INK} base={CLOTH} hatch="#bfa979" seed={s + 32} gap={3} w={1.2} />
          {/* the long organ bench */}
          <S d={rectPath(70, 222, 100, 8, 2)} ink={WOOD_INK} base={mix(WOOD, "#fff", 0.2)} hatch={WOOD} seed={s + 33} gap={3} />
          <L d="M78 230 L76 248 M162 230 L164 248" ink={WOOD_INK} seed={s + 34} w={3} />
        </g>
      ),
      front: (
        <g>
          {/* the console's top and its drawbars */}
          <S d={rectPath(16, 176, 208, 12, 3)} ink={WOOD_INK} base={mix(WOOD, "#fff", 0.15)} hatch={WOOD_HATCH} seed={s + 1} gap={3.2} />
          {DRAWBARS.map((col, i) => {
            const x = 84 + i * 8;
            return (
              <g key={i} ref={c.bag.r("db" + i)}>
                <path d={`M${x} 178 V${170 - (i % 3) * 2}`} stroke="#8d8676" strokeWidth={2} strokeLinecap="round" />
                <rect x={x - 2.6} y={166 - (i % 3) * 2} width={5.2} height={5} rx={1.2} fill={col} stroke="#2c2a35" strokeWidth={0.9} />
              </g>
            );
          })}
          {/* a little red lamp: lit while it plays */}
          <circle ref={c.bag.r("lamp")} cx={40} cy={182} r={2.6} fill="#e0786d" stroke="#7a2e26" strokeWidth={0.8} style={{ opacity: 0.35 }} />
          {/* side cheeks and the panel between the manuals */}
          <S d="M12 182 H26 V236 Q19 238 12 236 Z" ink={WOOD_INK} base={WOOD} hatch={WOOD_HATCH} seed={s + 2} gap={3} />
          <S d="M214 182 H228 V236 Q221 238 214 236 Z" ink={WOOD_INK} base={WOOD} hatch={WOOD_HATCH} seed={s + 3} gap={3} />
          <path d={rectPath(X0, UPPER_TOP + KEY_H, X1 - X0, LOWER_TOP - UPPER_TOP - KEY_H)} fill={DARK} />
          {manual(c, UPPER_TOP, "u", s + 4)}
          {manual(c, LOWER_TOP, "l", s + 5)}
          {/* the cabinet below the keys */}
          <S d={rectPath(14, 213, 212, 23, 3)} ink={WOOD_INK} base={WOOD} hatch={WOOD_HATCH} seed={s + 6} gap={3.6} />
          <S d={rectPath(54, 217, 132, 14, 4)} ink={mix(WOOD_INK, WOOD, 0.4)} seed={s + 7} w={1.1} />
          <L d="M66 224 q8 -5 16 0 t16 0 M142 224 q8 -5 16 0 t16 0" ink="#e7c27a" seed={s + 8} w={1.1} op={0.85} />
          {/* the pedalboard: a fan of wooden pedals under both feet */}
          <S d={rectPath(70, 236, 100, 9, 2)} ink={WOOD_INK} base={mix(WOOD, "#fff", 0.25)} hatch={WOOD} seed={s + 9} gap={3} />
          <path d="M80 236 V245 M90 236 V245 M100 236 V245 M110 236 V245 M130 236 V245 M140 236 V245 M150 236 V245 M160 236 V245" stroke={WOOD_INK} strokeWidth={0.9} />
          <path d="M84 236 h3 v5 h-3 Z M94 236 h3 v5 h-3 Z M113 236 h3 v5 h-3 Z M124 236 h3 v5 h-3 Z M143 236 h3 v5 h-3 Z M153 236 h3 v5 h-3 Z" fill={DARK} />
          {/* left foot on the pedals; the right on the swell pedal, which rocks with the dynamics */}
          <S d={ellipsePath(98, 241, 11, 5.4)} ink={c.ink} base={mix(c.feet, "#f6f0e1", 0.25)} hatch={c.feet} seed={s + 10} gap={2.6} w={1.5} />
          <g ref={c.bag.r("swell")}>
            <S d={rectPath(128, 231, 20, 9, 2)} ink={WOOD_INK} base={DARK} seed={s + 11} w={1.1} />
            <S d={ellipsePath(138, 236, 11, 5.4)} ink={c.ink} base={mix(c.feet, "#f6f0e1", 0.25)} hatch={c.feet} seed={s + 12} gap={2.6} w={1.5} />
          </g>
        </g>
      ),
    };
  },
  update(c: RigCtx, f: Frame) {
    const { s } = f;
    const m = c.mem;
    // Held keys stay down on their manual.
    const used = { uw: 0, ub: 0, lw: 0, lb: 0 };
    for (const n of s.active) {
      const tag = n.pitch >= SPLIT ? "u" : "l";
      const x = organKeyX(n.pitch);
      const a = 0.4 + 0.45 * (1 - n.progress * 0.5);
      const k = (tag + (isBlack(n.pitch) ? "b" : "w")) as keyof typeof used;
      if (used[k] >= POOL) continue;
      c.bag.set(k + used[k], "x", isBlack(n.pitch) ? x - KW * 0.32 : x - KW / 2);
      c.bag.op(k + used[k], a);
      used[k]++;
    }
    for (const k of Object.keys(used) as (keyof typeof used)[]) for (let i = used[k]; i < POOL; i++) c.bag.op(k + i, 0);

    playKeys(c, f, organKeyX, [
      { key: "L", lo: -Infinity, hi: SPLIT - 1, home: organKeyX(50), top: manualTop(48) },
      { key: "R", lo: SPLIT, hi: Infinity, home: organKeyX(70), top: manualTop(72) },
    ]);

    // The rotating speaker: a slow chorale at rest, the fast tremolo when the band's loud and busy.
    const loud = s.energy;
    const fast = s.playing && s.active.length >= 3 && loud > 0.62 ? 1 : 0;
    damp(m, "rotor", s.playing ? 0.35 + 0.65 * fast : 0.12, f.dt, fast ? 0.9 : 1.6);
    m.horn = ((m.horn ?? 0) + f.dt * m.rotor * 7) % (Math.PI * 2);
    // seen side-on, the horn's spin reads as it stretching and flipping
    c.bag.tf("horn", `translate(203 131) scale(${Math.cos(m.horn).toFixed(3)} 1)`);

    // The swell pedal follows the dynamics; the lamp is lit while the organ sounds.
    damp(m, "swell", s.active.length ? clamp(loud, 0.2, 1) : 0.2, f.dt, 0.12);
    c.bag.tf("swell", `rotate(${(-6 + m.swell * 8).toFixed(2)} 138 240)`);
    damp(m, "lamp", s.active.length ? 1 : 0.35, f.dt, 0.08);
    c.bag.op("lamp", m.lamp);
  },
};
