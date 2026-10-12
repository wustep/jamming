import type { Score } from "@/music/types";
import { decodeShare, encodeJam, type JamConfig } from "./share";

// Jams you saved in this browser: each one's whole configuration (share.ts), kept until you
// delete it (takes come and go; these don't). A take the engine played is rebuilt from its
// configuration and seed when it's opened. A take the models played can't be, so its notes and
// the band's talk are kept with it, and it opens exactly as it was.

export interface SavedJam {
  id: string;
  name: string;
  savedAt: number;
  /** The configuration, as a link carries it (`2.…`): one format to check, for links and saves alike. */
  jam: string;
  /** A model-written take, as played (absent for the engine's takes, or when there wasn't room to keep it). */
  score?: Score;
}

export const MAX_SAVED = 30;
const LS_SAVED = "jamming:saved:v1";

/** A saved jam's configuration, or null when this build can't read it any more. */
export function savedConfig(s: SavedJam): JamConfig | null {
  const shared = decodeShare(s.jam);
  if (!shared || shared.version !== 2) return null;
  return { ...shared, sounds: shared.sounds!, playAlong: shared.playAlong!, heuristic: !!shared.heuristic };
}

export function makeSaved(config: JamConfig, name: string, score: Score | null, now: number): SavedJam {
  const jam = encodeJam(config);
  return { id: `${now.toString(36)}-${jam.length.toString(36)}`, name, savedAt: now, jam, ...(config.engine === "ai" && score ? { score } : {}) };
}

/** A new save on top. Saving the same jam again moves it up rather than keeping two. */
export function addSaved(list: SavedJam[], entry: SavedJam): SavedJam[] {
  const same = (s: SavedJam) => s.jam === entry.jam && s.score?.id === entry.score?.id;
  return [entry, ...list.filter((s) => !same(s))].slice(0, MAX_SAVED);
}

function isSaved(v: unknown): v is SavedJam {
  const s = v as SavedJam | null;
  return typeof s?.id === "string" && typeof s.name === "string" && typeof s.savedAt === "number" && typeof s.jam === "string" && (!s.score || (!!s.score.frame && !!s.score.parts));
}

export function loadSaved(): SavedJam[] {
  try {
    const raw = localStorage.getItem(LS_SAVED);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(isSaved).filter((s) => savedConfig(s)).slice(0, MAX_SAVED) : [];
  } catch {
    return [];
  }
}

/**
 * Keep the list. Over quota, the models' notes go first, oldest first (the configuration stays,
 * so the jam can still be opened, played by the engine); then the oldest saves.
 */
export function storeSaved(list: SavedJam[]): SavedJam[] {
  let out = list;
  for (;;) {
    try {
      localStorage.setItem(LS_SAVED, JSON.stringify(out));
      return out;
    } catch {
      const i = out.findLastIndex((s) => s.score);
      if (i >= 0) out = out.map((s, n) => (n === i ? { ...s, score: undefined } : s));
      else if (out.length > 1) out = out.slice(0, -1);
      else return out;
    }
  }
}
