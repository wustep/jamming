// What a shared take's link says about itself when it's pasted somewhere: the page's title and
// description, and what its card image shows. Everything comes from the link alone (see share.ts),
// so the server can say it without playing the take.

import { ANIMALS, INSTRUMENTS } from "@/music/instruments";
import { takeTitle } from "@/music/local";
import { getPreset } from "@/music/presets";
import { getStandard } from "@/music/standards";
import { STYLES } from "@/music/styles";
import type { AnimalId, InstrumentId } from "@/music/types";
import { decodeShare, type SharedTake } from "./share";

export interface CardPlayer {
  name: string;
  animal: AnimalId;
  instrument: InstrumentId;
  /** "Upright Bass" */
  plays: string;
  /** The animal's ink, for their name. */
  ink: string;
  leader: boolean;
}

export interface ShareCard {
  /** The take's title, as the app shows it: "Bossa Nova · Blue in Green". */
  title: string;
  style: string;
  /** The tune, when it's a standard. */
  tune: string | null;
  /** The title for a link preview: "Bossa Nova, like Jobim". */
  headline: string;
  /** "an homage to Jobim", when the take was set up from a "play like" preset. */
  homage: string | null;
  /** "C minor · 132 bpm · 32 bars" */
  facts: string;
  band: CardPlayer[];
  /** One or two sentences for the link preview. */
  description: string;
}

/** "a", "a and b", "a, b and c" */
export function listOf(words: string[]): string {
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : (words[0] ?? "");
}

export function shareCard(shared: SharedTake): ShareCard {
  const s = shared.settings;
  const preset = getPreset(s.preset);
  const tune = getStandard(s.standard)?.name ?? null;
  const band = shared.members.map<CardPlayer>((m) => ({
    name: m.name,
    animal: m.animal,
    instrument: m.instrument,
    plays: INSTRUMENTS[m.instrument].name,
    ink: ANIMALS[m.animal].ink,
    leader: m.id === s.leaderId,
  }));
  const meter = s.meter.beats === 4 ? "" : ` · ${s.meter.beats}/4`;
  const facts = `${s.key.tonic} ${s.key.mode} · ${s.tempo} bpm${meter} · ${s.bars} bars`;
  const homage = preset ? `an homage to ${preset.name}` : null;
  const players = listOf(band.map((p) => `${p.name} (${p.plays.toLowerCase()})`));
  const what = tune ? `${tune}, as ${STYLES[s.style].name.toLowerCase()}` : `Some ${STYLES[s.style].name.toLowerCase()}`;
  const title = takeTitle(s.style, s.standard);
  return {
    title,
    headline: preset ? `${title}, like ${preset.name}` : title,
    style: STYLES[s.style].name,
    tune,
    homage,
    facts,
    band,
    description: `${what}, played by ${players}${homage ? `: ${homage}` : ""}. ${facts}. Press play to hear it.`,
  };
}

/** The card for a link's payload (`1.eyJ…`), or null when the link doesn't decode. */
export function shareCardFor(value: string): ShareCard | null {
  let v = value;
  try {
    v = decodeURIComponent(value);
  } catch {
    /* use it as it came */
  }
  const shared = decodeShare(v);
  return shared ? shareCard(shared) : null;
}
