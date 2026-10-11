import { FrameComputer } from "@/components/stage/frames";
import { ANIMALS, defaultMembers } from "@/music/instruments";
import { defaultSettings, generateLocal } from "@/music/local";
import { getPreset, type PresetId } from "@/music/presets";
import { STYLES } from "@/music/styles";
import type { InstrumentId, Member, Score, StyleId } from "@/music/types";

export interface RigTake {
  score: Score;
  /** The member playing the instrument. */
  id: string;
  spb: number;
  /** Length of the take in beats. */
  beats: number;
  frames: FrameComputer;
}

/**
 * A real take for one instrument, the way the stage plays it: the default band (plus a guest on
 * this instrument when nobody in it plays one) and the local engine. Drives the rig tests and the
 * art lab's style mode. With a preset, its own band plays its own take (the instrument's player in
 * that band, who may hold a different part there: a cello on the bass line).
 */
export function rigTake(inst: InstrumentId, style: StyleId, opts: { seed?: number; solo?: boolean; tempo?: number; preset?: PresetId } = {}): RigTake {
  const preset = getPreset(opts.preset);
  if (preset) {
    const band: Member[] = preset.band.map((b) => ({ id: b.animal, animal: b.animal, name: ANIMALS[b.animal].name, instrument: b.instrument }));
    const id = band.find((m) => m.instrument === inst)?.id;
    if (!id) throw new Error(`${preset.name} has no ${inst}`);
    const settings = { ...defaultSettings(band), style: preset.style, feel: preset.feel, harmony: preset.harmony, preset: preset.id, tempo: opts.tempo ?? preset.tempo, key: { ...preset.key }, leaderId: band[0].id, soloists: opts.solo ? [id] : preset.soloists, seed: opts.seed ?? 3 };
    const { score } = generateLocal(settings, band);
    return { score, id, spb: 60 / score.frame.tempo, beats: score.frame.bars * score.frame.meter.beats, frames: new FrameComputer(score) };
  }
  const band: Member[] = defaultMembers();
  if (!band.some((m) => m.instrument === inst)) band.push({ id: "guest", animal: "cat", name: "Guest", instrument: inst });
  const id = band.find((m) => m.instrument === inst)!.id;
  const st = STYLES[style];
  const tempo = opts.tempo ?? st.tempo.default;
  const { score } = generateLocal({ ...defaultSettings(band), style, tempo, key: { ...st.key }, seed: opts.seed ?? 3, ...(opts.solo ? { soloists: [id] } : {}) }, band);
  return { score, id, spb: 60 / score.frame.tempo, beats: score.frame.bars * score.frame.meter.beats, frames: new FrameComputer(score) };
}
