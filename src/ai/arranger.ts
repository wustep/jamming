import type { JSONSchema7 } from "ai";
import { ROOMS } from "@/audio/packs";
import { INSTRUMENT_LIST, INSTRUMENTS } from "@/music/instruments";
import { FEELS } from "@/music/playing";
import { PRESETS } from "@/music/presets";
import { STANDARDS } from "@/music/standards";
import { STYLES, STYLE_LIST } from "@/music/styles";
import { describeBrief, MAX_BAND, parseBrief, repairBrief, TONICS, type Brief } from "@/music/brief";
import { extractJson } from "./json";
import { callLLM, noteRepair, setParsed } from "./llm";
import type { KeyAccess } from "./keys";

// The arranger: one cheap call turns a sentence into a brief (artist, tune, key, tempo, meter,
// band, room, feel, length), and the engine plays it like any other settings. No notes come
// from the model, so the reply is small, the schema is tight and nothing needs repairing bar by
// bar. Without a key, or when the reply won't do, the keyword reading in brief.ts stands in.

/**
 * The cheapest model some key can reach: GPT-6 Luna through the gateway ($0.10 / $0.50 per
 * million), else Claude Haiku 4.5 with only an Anthropic key. A brief is ~2k tokens in, ~100 out.
 */
export function arrangerModel(access: KeyAccess): string | null {
  if (access.gateway) return "openai/gpt-6-luna";
  if (access.anthropic) return "anthropic/claude-haiku-4.5";
  return null;
}

const nullable = (schema: JSONSchema7): JSONSchema7 => ({ anyOf: [schema, { type: "null" }] });

/** Every field is required and nullable (strict structured output wants both); enums keep ids honest. */
export const BRIEF_SCHEMA: JSONSchema7 = {
  type: "object",
  additionalProperties: false,
  required: ["preset", "style", "standard", "key", "tempo", "meter", "band", "room", "feel", "bars", "note"],
  properties: {
    preset: nullable({ type: "string", enum: PRESETS.map((p) => p.id) }),
    style: { type: "string", enum: [...STYLE_LIST] },
    standard: nullable({ type: "string", enum: [...STANDARDS.map((s) => s.id), "original"] }),
    key: {
      type: "object",
      additionalProperties: false,
      required: ["tonic", "mode"],
      properties: { tonic: { type: "string", enum: TONICS }, mode: { type: "string", enum: ["major", "minor"] } },
    },
    tempo: { type: "integer" },
    meter: { type: "integer", enum: [3, 4] },
    band: { type: "array", items: { type: "string", enum: [...INSTRUMENT_LIST] } },
    room: { type: "string", enum: [...ROOMS] },
    feel: nullable({ type: "string", enum: Object.keys(FEELS) }),
    bars: { type: "integer" },
    note: { type: "string" },
  },
};

export const ARRANGER_SYSTEM = `You arrange jams for a band of cartoon animals. A person describes the jam they want in a sentence; you choose the settings, and a deterministic engine plays every note. Reply with one JSON object, nothing else.

Fields:
- preset: an artist to play like (sets their feel, changes, band and room), or null. Use one when the sentence names or clearly evokes them.
- style: the groove family.
- standard: a tune to play (the band plays its changes, and its written melody when it has one); "original" when the sentence asks for something new (the band writes the changes); null when it says nothing about the tune (the band keeps playing the one it's on). Only pick a tune the sentence names or clearly asks for.
- A tune and an artist or a style combine: "Fly Me to the Moon like Einaudi" is standard fly-me with preset einaudi; "Autumn Leaves as a bossa" is standard autumn with style bossa. The tune gives the changes, the melody, the key and the meter; the artist or style gives the groove, the feel, the band, the tempo and the room. Pick the tempo for the artist or style, not the tune.
- key: tonic and mode. A standard keeps its own mode. Mood guides the mode (rain, night, sad: minor).
- tempo: beats per minute, within 20 of the style's range below. "Slow" and "ballad" go below the bottom of the range; "fast" goes near the top.
- meter: 3 for a waltz, else 4 (a standard keeps its own).
- band: 1 to ${MAX_BAND} instruments, the leader first, never drums first. Leave out drums for a solo piece or when asked. With a preset, start from its band and adjust for what the sentence asks.
- room: dry (close and intimate), club, or hall (big and wet).
- feel: how it's played, usually the preset's own or null for the style's own. Use a different one only to blend ("Monk on a bossa": style bossa, feel monk).
- bars: length of an original chart, 8 to 64 (32 is usual). For a standard, bars is times through × the tune's length.
- note: a few words on what you went for (under 12).

Styles (tempo range): ${STYLE_LIST.map((id) => `${id} ${STYLES[id].tempo.min}-${STYLES[id].tempo.max}`).join(", ")}.
Instruments: ${INSTRUMENT_LIST.map((id) => `${id} (${INSTRUMENTS[id].name})`).join(", ")}.
Presets (id: name, style, tempo, band):
${PRESETS.map((p) => `${p.id}: ${p.name}, ${p.style}${p.meter ? " 3/4" : ""}, ${p.tempo}, ${p.band.map((b) => b.instrument).join("+")}. ${p.tags}`).join("\n")}
Tunes (id: name, style, key, bars):
${STANDARDS.map((s) => `${s.id}: ${s.name}, ${s.style}${s.meter === 3 ? " 3/4" : ""}, ${s.key.tonic} ${s.key.mode}, ${s.bars.length}`).join("\n")}
Feels: ${Object.keys(FEELS).join(", ")}.`;

export function arrangerPrompt(text: string): string {
  return `The jam: "${text.slice(0, 400).replace(/"/g, "'")}"`;
}

export type ArrangeSource = "model" | "keywords" | "fallback";

export interface ArrangeResult {
  brief: Brief;
  source: ArrangeSource;
  /** Why the model's answer wasn't used (fallback), or what was mended in it (model). */
  repairs: string[];
  model?: string;
  usage?: { inputTokens: number | null; outputTokens: number | null };
}

/**
 * Read a model reply into a brief. Null when it isn't one (no JSON, not an object, no field we
 * know): the caller falls back to the keyword reading. Otherwise every field is checked and mended.
 */
export function briefFromReply(text: string): { brief: Brief; repairs: string[] } | null {
  const { value, error } = extractJson(text);
  const out = repairBrief(value);
  if (!out) return null;
  return error ? { ...out, repairs: [error, ...out.repairs] } : out;
}

/**
 * Turn a sentence into a brief: one model call when a key can reach a model, the keyword reading
 * otherwise (and whenever the call fails or the reply can't be read). Never throws for a bad
 * reply; a cancel still throws AbortError.
 */
export async function arrange(
  text: string,
  o: { runId: string; access: KeyAccess; apiKey: string; anthropicKey: string; signal?: AbortSignal },
): Promise<ArrangeResult> {
  const model = arrangerModel(o.access);
  if (!model) return { brief: parseBrief(text), source: "keywords", repairs: [] };
  try {
    const { text: reply, call } = await callLLM({
      runId: o.runId,
      label: "arrange",
      agent: "arranger",
      model,
      system: ARRANGER_SYSTEM,
      prompt: arrangerPrompt(text),
      apiKey: o.apiKey,
      anthropicKey: o.anthropicKey,
      temperature: 0.4,
      maxOutputTokens: 400,
      reasoning: "none",
      schema: BRIEF_SCHEMA,
      schemaName: "brief",
      signal: o.signal,
    });
    const read = briefFromReply(reply);
    if (!read) {
      noteRepair(call.id, "reply wasn't a brief: used the keyword reading instead");
      return { brief: parseBrief(text), source: "fallback", repairs: ["the reply wasn't a brief"], model, usage: call.usage };
    }
    for (const r of read.repairs) noteRepair(call.id, r);
    setParsed(call.id, { brief: describeBrief(read.brief), note: read.brief.note });
    return { brief: read.brief, source: "model", repairs: read.repairs, model, usage: call.usage };
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return { brief: parseBrief(text), source: "fallback", repairs: [(e as Error).message], model };
  }
}
