// The image a link unfurls with (Open Graph / Twitter): the band's portraits under the stage's
// bunting, the take's title and what it is. Drawn on the server by next/og, which can't read the
// page's CSS, so the theme's light values are spelled out here (from globals.css).

import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { AnimalPortrait } from "@/art/AnimalPortrait";
import { InstrumentIcon } from "@/art/InstrumentIcon";
import { svgString } from "@/art/svgString";
import { Bunting } from "@/components/stage/Bunting";
import type { ShareCard } from "@/state/card";

export const CARD_SIZE = { width: 1200, height: 630 };

const THEME: Record<string, string> = {
  "--paper": "#f6f0e1",
  "--ink": "#2c2a35",
  "--ink-soft": "#5b5666",
  "--pencil-red": "#c8463c",
  "--pencil-yellow": "#e2a93b",
  "--pencil-blue": "#3b5bab",
  "--pencil-green": "#4f8a3a",
  "--pencil-purple": "#5a4a9e",
};

/** A drawing as an <img> source, with the theme's variables filled in. */
function svgSrc(node: ReactElement, size?: { width: number; height: number }): string {
  let svg = svgString(node).replace(/var\((--[a-z-]+)\)/g, (m, name: string) => THEME[name] ?? m);
  if (size) svg = svg.replace(/<svg([^>]*?)>/, (m, attrs: string) => `<svg${attrs.replace(/\s(width|height|class)="[^"]*"/g, "")} width="${size.width}" height="${size.height}">`);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// The app's hand-drawn faces, fetched once per server instance from Google Fonts (as TTF, which
// next/og can read). If they can't be had, the card draws in the default face rather than failing.
const fonts = new Map<string, Promise<ArrayBuffer | null>>();
function googleFont(family: string, weight: number): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}`;
  if (!fonts.has(key)) {
    const p = (async () => {
      try {
        const css = await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`, { signal: AbortSignal.timeout(3000) }).then((r) => r.text());
        const url = /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/.exec(css)?.[1];
        if (!url) return null;
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        return res.ok ? await res.arrayBuffer() : null;
      } catch {
        return null;
      }
    })();
    // a failure is retried by the next card instead of sticking for the server's lifetime
    void p.then((data) => data || fonts.delete(key));
    fonts.set(key, p);
  }
  return fonts.get(key)!;
}

async function cardFonts() {
  const [hand, script] = await Promise.all([googleFont("Patrick Hand", 400), googleFont("Caveat", 700)]);
  return [
    ...(hand ? [{ name: "Hand", data: hand, weight: 400 as const, style: "normal" as const }] : []),
    ...(script ? [{ name: "Script", data: script, weight: 700 as const, style: "normal" as const }] : []),
  ];
}

const STAR = "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z";

/** At most this many portraits fit across; the rest are counted. */
const MAX_SHOWN = 6;

/** The card for a shared take, or Jamming's own card when there's no take (or the link is bad). */
export async function shareCardImage(card: ShareCard | null): Promise<ImageResponse> {
  const fonts = await cardFonts();
  const ink = THEME["--ink"];
  const soft = THEME["--ink-soft"];
  const shown = card?.band.slice(0, MAX_SHOWN) ?? [];
  const more = (card?.band.length ?? 0) - shown.length;
  const face = Math.min(190, Math.floor(1000 / Math.max(3, shown.length)) - 24);
  const title = card?.title ?? "A band of doodled animals that improvise";
  const titleSize = title.length > 34 ? 60 : title.length > 22 ? 72 : 84;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: THEME["--paper"], color: ink, fontFamily: "Hand", padding: "0 64px 40px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img> */}
        <img src={svgSrc(<Bunting />, { width: 1200, height: 64 })} width={1200} height={64} style={{ position: "absolute", top: 0, left: 0 }} alt="" />
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 84 }}>
          <div style={{ display: "flex", fontFamily: "Script", fontSize: 48, color: THEME["--pencil-red"] }}>Jamming</div>
          <div style={{ display: "flex", fontSize: 28, color: soft }}>{card ? "someone sent you a jam" : ""}</div>
        </div>
        <div style={{ display: "flex", fontSize: titleSize, lineHeight: 1.05, marginTop: 8 }}>{title}</div>
        <div style={{ display: "flex", fontSize: 32, color: soft, marginTop: 10 }}>{card ? [card.homage, card.facts].filter(Boolean).join(" · ") : "Pick the band, hand them instruments, and let them make something up."}</div>
        <div style={{ display: "flex", flex: 1, alignItems: "flex-end", justifyContent: "center", gap: 24 }}>
          {card ? (
            <>
              {shown.map((p, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: face + 16 }}>
                  <div style={{ display: "flex", position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img> */}
                    <img src={svgSrc(<AnimalPortrait animal={p.animal} size={face} />)} width={face} height={(face * 170) / 180} alt="" />
                    {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img> */}
                    <img src={svgSrc(<InstrumentIcon instrument={p.instrument} size={Math.round(face * 0.42)} />)} width={Math.round(face * 0.42)} height={Math.round(face * 0.42)} style={{ position: "absolute", right: -10, bottom: -6 }} alt="" />
                  </div>
                  <div style={{ display: "flex", fontFamily: "Script", fontSize: 34, color: p.ink, marginTop: 6 }}>
                    {p.name}
                    {p.leader ? (
                      // the hand fonts have no star
                      // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img>
                      <img src={svgSrc(<svg viewBox="0 0 24 24"><path d={STAR} fill={THEME["--pencil-red"]} /></svg>)} width={22} height={22} style={{ marginLeft: 6 }} alt="leader" />
                    ) : null}
                  </div>
                  <div style={{ display: "flex", fontSize: 22, color: soft }}>{p.plays.toLowerCase()}</div>
                </div>
              ))}
              {more > 0 && <div style={{ display: "flex", fontSize: 32, color: soft, alignSelf: "center" }}>+{more} more</div>}
            </>
          ) : (
            (["cat", "bear", "fox", "owl"] as const).map((a) => (
              // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img>
              <img key={a} src={svgSrc(<AnimalPortrait animal={a} size={170} />)} width={170} height={(170 * 170) / 180} alt="" />
            ))
          )}
        </div>
      </div>
    ),
    {
      ...CARD_SIZE,
      fonts,
      // the card is a function of the link alone, so caches may keep it
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" },
    },
  );
}

/**
 * The app's icon: Rusty the fox (the default band's leader) on the paper, for the browser tab,
 * a phone's home screen and an installed app. `inset` is the face's share of the square: an
 * Android maskable icon is cropped to a circle and keeps its middle 80%.
 */
export function appIcon(px: number, inset = 0.82): ImageResponse {
  const face = Math.round(px * inset);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: THEME["--paper"] }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img> */}
        <img src={svgSrc(<AnimalPortrait animal="fox" size={face} />)} width={face} height={Math.round((face * 170) / 180)} alt="" />
      </div>
    ),
    { width: px, height: px },
  );
}
