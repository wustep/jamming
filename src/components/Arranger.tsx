"use client";

import { useState } from "react";
import { InstrumentIcon } from "@/art/InstrumentIcon";
import { callCost, fmtCost, modelInfo } from "@/ai/models";
import type { Room } from "@/audio/packs";
import { castBand, MAX_BAND, tempoRange, TONICS } from "@/music/brief";
import { lengthOptions } from "@/music/form";
import { INSTRUMENT_LIST, INSTRUMENTS } from "@/music/instruments";
import { FEELS, type FeelId } from "@/music/playing";
import { getPreset, PRESET_GROUPS, PRESETS, type PresetId } from "@/music/presets";
import { getStandard, STANDARDS } from "@/music/standards";
import { STYLE_LIST, STYLES } from "@/music/styles";
import type { InstrumentId, StyleId } from "@/music/types";
import { useTroop, type Arranged } from "@/state/store";
import { RoughButton } from "./ui/rough";

// One sentence to a jam. The arranger reads it once (a cheap model call, or keywords with no
// key), sets the band up and the engine plays it. What it chose shows as chips; each opens an
// editor for that one setting. The chips read the live settings, so they stay true after edits
// here or in the panel below.

const EXAMPLES = ["rainy-night Monk ballad, slow, brushes", "sunny bossa with flute in F, club", "Blue Bossa twice, sax trio", "a slow waltz for solo piano in a hall"];

type Field = "preset" | "style" | "tune" | "key" | "tempo" | "meter" | "band" | "room" | "feel" | "bars";

const ROOM_LABEL: Record<Room, string> = { dry: "dry", club: "club", hall: "hall" };
const fmtTokens = (n: number | null | undefined) => (n == null ? "?" : n.toLocaleString("en-US"));
/** A brief costs fractions of a cent, so show them ("$0.0003") rather than "<$0.01". */
const fmtSmallCost = (usd: number) => (usd >= 0.01 ? fmtCost(usd) : `$${usd.toPrecision(1)}`);

/** How the last sentence was read: which model and what it cost, or that keywords did it. */
function howRead(a: Arranged): string {
  if (a.source === "keywords") return "Read from keywords, no model call";
  const name = a.model ? (modelInfo(a.model)?.label ?? a.model) : "the model";
  if (a.source === "fallback") return `${name} didn’t answer usefully, so keywords stood in`;
  const cost = a.model ? callCost(a.model, a.usage) : null;
  return `${name} · ${fmtTokens(a.usage?.inputTokens)} in / ${fmtTokens(a.usage?.outputTokens)} out${cost !== null ? ` · ≈ ${fmtSmallCost(cost)}` : ""}`;
}

function Chip({ field, open, onOpen, label, children }: { field: Field; open: Field | null; onOpen: (f: Field | null) => void; label: string; children: React.ReactNode }) {
  const active = open === field;
  return (
    <RoughButton
      seed={`arr-${field}`}
      active={active}
      onClick={() => onOpen(active ? null : field)}
      aria-expanded={active}
      aria-controls="arranger-editor"
      title={`Change the ${label.toLowerCase()}`}
      className="px-xs py-xxs text-s"
    >
      <span className="inline-flex items-center gap-xxs whitespace-nowrap">
        <span className="text-ink-soft">{label}</span> {children}
      </span>
    </RoughButton>
  );
}

export function Arranger() {
  const [text, setText] = useState("");
  const [open, setOpen] = useState<Field | null>(null);
  const arranging = useTroop((x) => x.arranging);
  const arranged = useTroop((x) => x.arranged);
  const busy = useTroop((x) => x.gen.running);
  const s = useTroop((x) => x.settings);
  const members = useTroop((x) => x.members);
  const room = useTroop((x) => x.sounds.room);
  const arrangeFrom = useTroop((x) => x.arrangeFrom);
  const clearArranged = useTroop((x) => x.clearArranged);
  const set = useTroop((x) => x.setSettings);
  const setStyle = useTroop((x) => x.setStyle);
  const setStandard = useTroop((x) => x.setStandard);
  const applyPreset = useTroop((x) => x.applyPreset);
  const setMembers = useTroop((x) => x.setMembers);
  const setSounds = useTroop((x) => x.setSounds);

  const preset = getPreset(s.preset);
  const std = getStandard(s.standard);
  const [lo, hi] = tempoRange(s.style);

  const submit = (sentence = text) => {
    if (!sentence.trim() || arranging) return;
    setText(sentence);
    setOpen(null);
    void arrangeFrom(sentence);
  };

  const editor = (() => {
    switch (open) {
      case "preset":
        return (
          <select
            className="sketch-select w-full"
            value={preset?.id ?? ""}
            onChange={(e) => (e.target.value ? applyPreset(e.target.value as PresetId) : setStyle(s.style))}
            aria-label="Play like an artist"
          >
            <option value="">Nobody in particular</option>
            {PRESET_GROUPS.map((g) => (
              <optgroup key={g.id} label={g.label}>
                {PRESETS.filter((p) => p.group === g.id).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        );
      case "style":
        return (
          <select className="sketch-select w-full" value={s.style} onChange={(e) => setStyle(e.target.value as StyleId)} aria-label="Style">
            {STYLE_LIST.map((id) => (
              <option key={id} value={id}>
                {STYLES[id].name}
              </option>
            ))}
          </select>
        );
      case "tune":
        return (
          <select className="sketch-select w-full" value={s.standard ?? ""} onChange={(e) => setStandard(e.target.value || null)} aria-label="Tune">
            <option value="">An original (the band writes the changes)</option>
            {STANDARDS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        );
      case "key":
        return (
          <div className="flex gap-xxs">
            <select className="sketch-select min-w-0 flex-1" value={s.key.tonic} onChange={(e) => set({ key: { ...s.key, tonic: e.target.value } })} aria-label="Key">
              {TONICS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <select
              className="sketch-select min-w-0 flex-1"
              value={s.key.mode}
              onChange={(e) => set({ key: { ...s.key, mode: e.target.value as "major" | "minor" } })}
              aria-label="Mode"
              disabled={!!std}
              title={std ? "A standard keeps its own mode" : undefined}
            >
              <option value="major">major</option>
              <option value="minor">minor</option>
            </select>
          </div>
        );
      case "tempo":
        return (
          <div className="flex items-center gap-xs">
            <input type="range" className="sketch-range min-w-0 flex-1" min={lo} max={hi} value={s.tempo} onChange={(e) => set({ tempo: parseInt(e.target.value, 10) })} aria-label="Tempo" />
            <span className="w-xxl shrink-0 text-right text-s tabular-nums">{s.tempo} bpm</span>
          </div>
        );
      case "meter":
        return (
          <div className="flex gap-xs">
            {[4, 3].map((b) => (
              <RoughButton key={b} seed={`arr-meter-${b}`} active={s.meter.beats === b} disabled={!!std} onClick={() => set({ meter: { beats: b } })} className="px-xs py-xxs text-s">
                {b}/4
              </RoughButton>
            ))}
            {std && <span className="self-center text-xs text-ink-soft">set by the tune</span>}
          </div>
        );
      case "room":
        return (
          <div className="flex gap-xs">
            {(["dry", "club", "hall"] as Room[]).map((r) => (
              <RoughButton key={r} seed={`arr-room-${r}`} active={room === r} onClick={() => setSounds({ room: r })} className="px-xs py-xxs text-s">
                {ROOM_LABEL[r]}
              </RoughButton>
            ))}
          </div>
        );
      case "feel":
        return (
          <select className="sketch-select w-full" value={s.feel ?? ""} onChange={(e) => set({ feel: (e.target.value || undefined) as FeelId | undefined })} aria-label="Feel">
            <option value="">The style’s own</option>
            {(Object.keys(FEELS) as FeelId[]).map((id) => (
              <option key={id} value={id}>
                {FEELS[id].name}
              </option>
            ))}
          </select>
        );
      case "bars":
        return (
          <div className="flex flex-wrap gap-xs">
            {lengthOptions(s.standard).map((b) => (
              <RoughButton key={b} seed={`arr-len-${b}`} active={s.bars === b} onClick={() => set({ bars: b })} className="px-xs py-xxs text-s">
                {std ? (b === std.bars.length ? "once" : `${b / std.bars.length}×`) : `${b} bars`}
              </RoughButton>
            ))}
          </div>
        );
      case "band":
        return (
          <div className="flex flex-wrap items-center gap-xxs">
            {members.map((m) => (
              <span key={m.id} className="flex items-center gap-xxs pr-xxs text-s">
                <InstrumentIcon instrument={m.instrument} size={22} />
                {m.name}
                <button
                  type="button"
                  className="flex min-h-l min-w-l items-center justify-center text-m text-ink-soft hover:text-(--color-1) disabled:opacity-30"
                  onClick={() => setMembers(members.filter((x) => x.id !== m.id))}
                  disabled={members.length <= 1}
                  aria-label={`Send ${m.name} home`}
                >
                  ×
                </button>
              </span>
            ))}
            {members.length < MAX_BAND && (
              <select
                className="sketch-select min-w-0 text-s"
                value=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  const band = [...members.map((m) => m.instrument), e.target.value as InstrumentId];
                  setMembers([...members, ...castBand(band, members).filter((m) => !members.some((x) => x.id === m.id))].slice(0, MAX_BAND));
                }}
                aria-label="Add a player"
              >
                <option value="">+ add a player</option>
                {INSTRUMENT_LIST.map((id) => (
                  <option key={id} value={id}>
                    {INSTRUMENTS[id].name}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      default:
        return null;
    }
  })();

  return (
    <section className="mb-m" aria-label="Ask for a jam">
      <label htmlFor="arranger-input" className="type-label mb-xxs block">
        Ask for a jam
      </label>
      <form
        className="flex items-end gap-xs"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          id="arranger-input"
          type="text"
          className="sketch-input min-w-0 flex-1"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLES[0]}
          maxLength={400}
          autoComplete="off"
          enterKeyHint="go"
          disabled={busy}
        />
        <RoughButton seed="arrange" tone="primary" type="submit" disabled={arranging || busy || !text.trim()} className="shrink-0 px-s py-xxs font-brand text-l font-heavy text-on-accent">
          {arranging ? "arranging…" : "Arrange"}
        </RoughButton>
      </form>

      {!arranged && !arranging && (
        <p className="mt-xxs text-s text-ink-soft">
          try:{" "}
          {EXAMPLES.slice(1).map((ex, i) => (
            <span key={ex}>
              {i > 0 && " · "}
              <button type="button" className="text-action" onClick={() => submit(ex)} disabled={busy}>
                {ex}
              </button>
            </span>
          ))}
        </p>
      )}

      {arranged && (
        <div className="mt-xs">
          <div className="flex flex-wrap gap-xxs" role="group" aria-label="What the arranger chose">
            <Chip field="preset" open={open} onOpen={setOpen} label="Like">
              {preset?.name ?? "nobody"}
            </Chip>
            <Chip field="style" open={open} onOpen={setOpen} label="Style">
              {STYLES[s.style].name}
            </Chip>
            <Chip field="tune" open={open} onOpen={setOpen} label="Tune">
              {std?.name ?? "original"}
            </Chip>
            <Chip field="key" open={open} onOpen={setOpen} label="Key">
              {s.key.tonic} {s.key.mode}
            </Chip>
            <Chip field="tempo" open={open} onOpen={setOpen} label="Tempo">
              {s.tempo}
            </Chip>
            <Chip field="meter" open={open} onOpen={setOpen} label="Meter">
              {s.meter.beats}/4
            </Chip>
            <Chip field="band" open={open} onOpen={setOpen} label="Band">
              <span className="flex">
                {members.map((m) => (
                  <InstrumentIcon key={m.id} instrument={m.instrument} size={20} />
                ))}
              </span>
            </Chip>
            <Chip field="room" open={open} onOpen={setOpen} label="Room">
              {ROOM_LABEL[room]}
            </Chip>
            <Chip field="feel" open={open} onOpen={setOpen} label="Feel">
              {s.feel ? FEELS[s.feel].name : "style’s own"}
            </Chip>
            <Chip field="bars" open={open} onOpen={setOpen} label="Length">
              {std ? (s.bars === std.bars.length ? "once" : `${s.bars / std.bars.length}×`) : `${s.bars} bars`}
            </Chip>
          </div>
          {editor && (
            <div id="arranger-editor" className="rule-top mt-xs pt-xs">
              {editor}
            </div>
          )}
          <p className="mt-xxs text-xs text-ink-soft">
            {arranged.note && <span className="italic text-ink">“{arranged.note}” · </span>}
            {howRead(arranged)}
            {arranged.repairs.length > 0 && arranged.source === "model" && <span title={arranged.repairs.join("\n")}> · mended {arranged.repairs.length}</span>} ·{" "}
            <button type="button" className="text-action" onClick={() => (clearArranged(), setOpen(null))}>
              hide
            </button>
          </p>
        </div>
      )}
    </section>
  );
}
