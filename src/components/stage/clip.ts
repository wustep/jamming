// A video of the stage, for sharing outside the app. The stage is SVG and HTML, which a browser
// can't record directly, so this paints a copy of it onto a canvas every frame: each player's
// live sprite (serialized as it's drawn right now), their spotlight and speech bubble, the
// section and chord, and the take's name. The canvas's stream plus the band's audio make the clip.

import { svgString } from "@/art/svgString";
import { ANIMALS, INSTRUMENTS } from "@/music/instruments";
import type { Score } from "@/music/types";
import { Bunting } from "./Bunting";
import { headerAt } from "./header";

export const CLIP_SIZE = { width: 1280, height: 720 };
/** How long a clip runs, unless the take ends first. */
export const CLIP_SECONDS = 15;

const SPRITE_ASPECT = 270 / 240;
/** Room drawn around a sprite's viewBox, for horns and bows that reach past it (viewBox units). */
const SPRITE_PAD = 40;

export interface ClipSlot {
  x: number;
  y: number;
  /** The sprite's drawn width (its viewBox, without the pad). */
  w: number;
}

/**
 * Where each player stands in the clip: one row, or two when the band is big, each row centred,
 * the sprites as large as fit. `top` and `bottom` bound the band's area; names go under it.
 */
export function clipLayout(n: number, width: number, top: number, bottom: number): ClipSlot[] {
  const rows = n > 5 ? 2 : 1;
  const perRow = Math.ceil(n / rows);
  const gap = 24;
  const label = 64;
  const rowH = (bottom - top) / rows;
  const w = Math.min((width - 2 * gap) / perRow - gap, (rowH - label) / SPRITE_ASPECT, 300);
  const slots: ClipSlot[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / perRow);
    const cols = Math.min(perRow, n - row * perRow);
    const rowW = cols * w + (cols - 1) * gap;
    const x = (width - rowW) / 2 + (i % perRow) * (w + gap);
    const y = top + row * rowH + (rowH - label - w * SPRITE_ASPECT);
    slots.push({ x, y, w });
  }
  return slots;
}

/** A take's file name: its title, without characters file systems refuse, and the right extension. */
export function takeFileName(title: string, mimeType: string) {
  const video = mimeType.startsWith("video/");
  const ext = mimeType.includes("mp4") ? (video ? "mp4" : "m4a") : mimeType.includes("ogg") ? "ogg" : "webm";
  const base = title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "take";
  return `${base} · Jamming.${ext}`;
}

/** Break text into lines no wider than `max`, by words. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function loadImage(svg: string): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const img = new Image();
  img.src = url;
  return img
    .decode()
    .then(() => img)
    .finally(() => URL.revokeObjectURL(url));
}

/** A sprite as it's drawn right now, as a standalone SVG with room around it. */
function spriteSvg(svg: SVGSVGElement, w: number): string {
  const [x, y, vw, vh] = (svg.getAttribute("viewBox") ?? "0 0 240 270").split(/\s+/).map(Number);
  const scale = w / vw;
  const body = new XMLSerializer().serializeToString(svg).replace(/^<svg[^>]*>/, "");
  const box = `${x - SPRITE_PAD} ${y - SPRITE_PAD} ${vw + 2 * SPRITE_PAD} ${vh + 2 * SPRITE_PAD}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" width="${(vw + 2 * SPRITE_PAD) * scale}" height="${(vh + 2 * SPRITE_PAD) * scale}">${body}`;
}

export interface ClipPainter {
  /** The painted stage as video: a frame for every frame painted. */
  stream: MediaStream;
  stop(): void;
}

/**
 * Start painting the stage onto a canvas, frame by frame, until `stop`. `stage` is the live
 * stage element (it keeps animating the sprites; this only copies them). `getBeat` is the
 * audio clock, in beats from the downbeat.
 */
export function paintStage(stage: HTMLElement, score: Score, getBeat: () => number, opts: { footer: string; link: string }): ClipPainter {
  const { width: W, height: H } = CLIP_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  // frames are handed over as they're painted, rather than sampled (a canvas that isn't on the
  // page may not be sampled at all)
  type Track = MediaStreamTrack & { requestFrame?: () => void };
  let stream = canvas.captureStream(0);
  let track: Track = stream.getVideoTracks()[0];
  if (typeof track.requestFrame !== "function") {
    // no way to hand frames over: let the browser sample the canvas instead
    track.stop();
    stream = canvas.captureStream(30);
    track = stream.getVideoTracks()[0];
  }
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const hand = v("--font-hand") || "cursive";
  const script = v("--font-script") || "cursive";
  const color = { paper: v("--paper"), ink: v("--ink"), soft: v("--ink-soft"), light: v("--neutral-1"), chord: v("--color-3"), glow: v("--color-2"), red: v("--pencil-red") };

  const band = score.members;
  const slots = clipLayout(band.length, W, 150, H - 70);
  const sprites = new Map<string, HTMLImageElement>();
  let bunting: HTMLImageElement | null = null;
  void loadImage(svgString(Bunting()).replace(/var\((--[a-z-]+)\)/g, (_, n: string) => v(n) || "#888").replace("<svg", `<svg width="${W}" height="64"`)).then((img) => (bunting = img));

  let running = true;
  // copy the sprites as fast as the browser can decode them; the canvas draws whatever's newest
  const copy = async () => {
    while (running) {
      await Promise.all(
        band.map(async (m, i) => {
          const svg = stage.querySelector<SVGSVGElement>(`[data-member="${CSS.escape(m.id)}"] svg[role="img"]`);
          if (!svg) return;
          try {
            sprites.set(m.id, await loadImage(spriteSvg(svg, slots[i].w)));
          } catch {
            /* keep the last frame */
          }
        }),
      );
      await new Promise((r) => requestAnimationFrame(r));
    }
  };
  void copy();

  const draw = () => {
    if (!running) return;
    ctx.fillStyle = color.paper;
    ctx.fillRect(0, 0, W, H);
    if (bunting) ctx.drawImage(bunting, 0, 0, W, 64);

    // the header: section and bar on the left, the chord on the right, as on the stage
    const h = headerAt(score, getBeat());
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = color.soft;
    ctx.font = `700 40px ${script}`;
    ctx.textAlign = "left";
    ctx.fillText(`${h.section} ${h.counter}`.trim(), 48, 120);
    ctx.textAlign = "right";
    ctx.font = `28px ${hand}`;
    const nextW = h.next ? ctx.measureText(h.next).width + 16 : 0;
    ctx.fillText(h.next, W - 48, 120);
    ctx.fillStyle = color.chord;
    ctx.font = `700 60px ${script}`;
    ctx.fillText(h.chord, W - 48 - nextW, 120);

    band.forEach((m, i) => {
      const s = slots[i];
      const slot = stage.querySelector<HTMLElement>(`[data-member="${CSS.escape(m.id)}"]`);
      const spot = Number(slot?.querySelector<HTMLElement>(".spotlight")?.style.opacity || 0);
      const muted = !!slot?.querySelector('[aria-pressed="true"]');
      const sh = s.w * SPRITE_ASPECT;
      if (spot > 0) {
        // a soft pool of light, wider than tall, fading to nothing (not to grey)
        const cx = s.x + s.w / 2;
        const cy = s.y + sh * 0.6;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1, 1.15);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s.w * 0.62);
        g.addColorStop(0, color.glow);
        g.addColorStop(1, /^#[0-9a-f]{6}$/i.test(color.glow) ? `${color.glow}00` : "rgba(255,255,255,0)");
        ctx.globalAlpha = spot * 0.55;
        ctx.fillStyle = g;
        ctx.fillRect(-s.w, -s.w, 2 * s.w, 2 * s.w);
        ctx.restore();
      }
      const img = sprites.get(m.id);
      ctx.globalAlpha = muted ? 0.4 : 1;
      const pad = (SPRITE_PAD * s.w) / 240;
      if (img) ctx.drawImage(img, s.x - pad, s.y - pad, s.w + 2 * pad, sh + 2 * pad);
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.fillStyle = ANIMALS[m.animal].ink;
      ctx.font = `700 30px ${script}`;
      ctx.fillText(m.name, s.x + s.w / 2, s.y + sh + 30);
      ctx.fillStyle = color.soft;
      ctx.font = `20px ${hand}`;
      ctx.fillText(muted ? "muted" : INSTRUMENTS[m.instrument].name, s.x + s.w / 2, s.y + sh + 54);
    });

    // what the band says, in bubbles over their heads (drawn last, so they're on top)
    band.forEach((m, i) => {
      const text = stage.querySelector(`[data-member="${CSS.escape(m.id)}"] .bubble`)?.textContent?.trim();
      if (!text) return;
      const s = slots[i];
      ctx.font = `22px ${hand}`;
      const lines = wrap(ctx, text, Math.max(160, s.w * 1.1)).slice(0, 4);
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28;
      const bh = lines.length * 26 + 18;
      const bx = Math.min(W - bw - 12, Math.max(12, s.x + s.w / 2 - bw / 2));
      const by = Math.max(130, s.y - bh + 4);
      ctx.fillStyle = color.light;
      ctx.strokeStyle = color.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color.ink;
      ctx.textAlign = "left";
      lines.forEach((l, k) => ctx.fillText(l, bx + 14, by + 32 + k * 26));
    });

    // whose take, and where to find more
    ctx.textAlign = "left";
    ctx.fillStyle = color.ink;
    ctx.font = `30px ${hand}`;
    ctx.fillText(score.title, 48, H - 28);
    const titleW = ctx.measureText(score.title).width;
    ctx.fillStyle = color.soft;
    ctx.font = `22px ${hand}`;
    if (opts.footer) ctx.fillText(opts.footer, 48 + titleW + 16, H - 28);
    ctx.textAlign = "right";
    ctx.fillStyle = color.red;
    ctx.font = `700 34px ${script}`;
    ctx.fillText(opts.link, W - 48, H - 26);

    track.requestFrame?.();
    requestAnimationFrame(draw);
  };
  draw();

  return {
    stream,
    stop: () => {
      running = false;
      track.stop();
    },
  };
}
