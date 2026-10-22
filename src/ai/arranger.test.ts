import { describe, expect, it } from "vitest";
import { PRESETS } from "@/music/presets";
import { STANDARDS } from "@/music/standards";
import { resolveBrief } from "@/music/brief";
import { defaultMembers } from "@/music/instruments";
import { defaultSettings } from "@/music/local";
import { ARRANGER_SYSTEM, arrangerModel, BRIEF_SCHEMA, briefFromReply } from "./arranger";
import { fakeModel } from "./mock";
import { callCost, modelInfo } from "./models";

describe("arranger", () => {
  it("picks the cheapest model a key can reach", () => {
    expect(arrangerModel({ gateway: true, anthropic: true })).toBe("openai/gpt-6-luna");
    expect(arrangerModel({ gateway: false, anthropic: true })).toBe("anthropic/claude-haiku-4.5");
    expect(arrangerModel({ gateway: false, anthropic: false })).toBeNull();
    // both are priced, so the cost line can show
    expect(modelInfo("openai/gpt-6-luna")?.price).toBeTruthy();
  });

  it("costs well under a cent a brief at list price", () => {
    // ~2.5k tokens in (the catalogue), ~120 out
    expect(callCost("openai/gpt-6-luna", { inputTokens: 2500, outputTokens: 120 })!).toBeLessThan(0.001);
    expect(callCost("anthropic/claude-haiku-4.5", { inputTokens: 2500, outputTokens: 120 })!).toBeLessThan(0.01);
  });

  it("the schema requires every field and lists every artist and tune", () => {
    const props = BRIEF_SCHEMA.properties as Record<string, { anyOf?: { enum?: string[] }[] }>;
    expect(BRIEF_SCHEMA.required).toEqual(Object.keys(props));
    expect(props.preset.anyOf![0].enum).toHaveLength(PRESETS.length);
    // every tune, and "original" for something new (null keeps the tune that's up)
    expect(props.standard.anyOf![0].enum).toHaveLength(STANDARDS.length + 1);
    for (const p of PRESETS) expect(ARRANGER_SYSTEM).toContain(`${p.id}: ${p.name}`);
  });

  it("reads a fenced, slightly broken reply and mends it", () => {
    const out = briefFromReply('Sure!\n```json\n{"preset": "monk", "style": "swing", "tempo": 70, "band": ["piano","bass",],}\n```');
    expect(out?.brief).toMatchObject({ preset: "monk", tempo: 70, band: ["piano", "bass"] });
    expect(out?.repairs[0]).toMatch(/repaired/);
  });

  it("gives up on replies that aren't a brief, so the keyword reading takes over", () => {
    expect(briefFromReply("I'd suggest something slow and moody.")).toBeNull();
    expect(briefFromReply('{"answer": 42}')).toBeNull();
    expect(briefFromReply("[1,2,3]")).toBeNull();
  });

  it("the mock reply needs mending and gets it", () => {
    const out = briefFromReply(fakeModel({ system: ARRANGER_SYSTEM, prompt: 'The jam: "rain"' }))!;
    expect(out.brief).toMatchObject({ preset: "monk", tonic: "Bb", tempo: 40 });
    expect(out.brief.band).not.toContain("kazoo");
    expect(out.repairs.length).toBeGreaterThan(0);
  });

  it("tells the model a tune and an artist or a style combine, and a reply naming both plays both", () => {
    expect(ARRANGER_SYSTEM).toMatch(/Fly Me to the Moon like Einaudi/);
    const out = briefFromReply(JSON.stringify({ preset: "einaudi", style: "ambient", standard: "fly-me", key: { tonic: "C", mode: "major" }, tempo: 72, meter: 4, band: null, room: "hall", feel: null, bars: 64, note: "Einaudi's Fly Me" }))!;
    const members = defaultMembers();
    const { settings } = resolveBrief(out.brief, { settings: defaultSettings(members), members, sounds: { room: "club" } });
    expect(settings).toMatchObject({ standard: "fly-me", preset: "einaudi", style: "ambient", tempo: 72 });
    // the mock's reply names an artist and no tune: the tune that's up stays
    const on = { settings: { ...defaultSettings(members), standard: "autumn" }, members, sounds: { room: "club" as const } };
    const mock = briefFromReply(fakeModel({ system: ARRANGER_SYSTEM, prompt: 'The jam: "like Monk"' }))!;
    expect(resolveBrief(mock.brief, on).settings).toMatchObject({ standard: "autumn", preset: "monk" });
  });
});
