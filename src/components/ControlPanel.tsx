"use client";

import { useRef, useState } from "react";
import { AnimalPortrait } from "@/art/AnimalPortrait";
import { InstrumentIcon } from "@/art/InstrumentIcon";
import { lengthOptions } from "@/music/form";
import { ANIMAL_LIST, ANIMALS, INSTRUMENT_LIST, INSTRUMENTS } from "@/music/instruments";
import { STANDARDS, getStandard, searchStandards } from "@/music/standards";
import { STYLE_LIST, STYLES } from "@/music/styles";
import { PRESET_GROUPS, PRESETS, getPreset, searchPresets, type PresetId } from "@/music/presets";
import type { AnimalId, InstrumentId, Member } from "@/music/types";
import { useTroop } from "@/state/store";
import { Arranger } from "./Arranger";
import { RoughBox, RoughButton } from "./ui/rough";

/** The tune list, grouped by what you get: a standard and its head, a song, a jazz form, pop chords, a groove. */
const TUNE_GROUPS: { label: string; has: (t: (typeof STANDARDS)[number]) => boolean }[] = [
  { label: "Jazz standards (the band plays the head)", has: (t) => !!t.melody && !t.publicDomain },
  { label: "Songs (the band plays the melody)", has: (t) => !!t.melody && !!t.publicDomain },
  { label: "Jazz forms (the changes)", has: (t) => !t.melody && ["swing", "bossa"].includes(t.style) },
  { label: "Pop progressions", has: (t) => !t.melody && t.style === "pop" },
  { label: "Grooves and grounds", has: (t) => !t.melody && !["swing", "bossa", "pop"].includes(t.style) },
];

const TONICS = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-xxs flex items-baseline justify-between gap-xs">
      <span className="type-label">{children}</span>
      {hint && <span className="text-s text-ink-soft">{hint}</span>}
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="mb-m">{children}</div>;
}

function Chip({ seed, active, onClick, children, title, disabled }: { seed: string; active?: boolean; onClick?: () => void; children: React.ReactNode; title?: string; disabled?: boolean }) {
  return (
    <RoughButton seed={seed} active={active} onClick={onClick} title={title} disabled={disabled} className="px-xs py-xxs text-m">
      {children}
    </RoughButton>
  );
}

function MemberRow({ m, members, onChange, onRemove }: { m: Member; members: Member[]; onChange: (m: Member) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-xs">
      <div className="flex items-center gap-xs">
        <AnimalPortrait animal={m.animal} size={32} />
        <div className="type-label min-w-0 flex-1 truncate" title={`${m.name} the ${ANIMALS[m.animal].species}`}>
          {m.name}
        </div>
        <RoughButton seed={`inst-${m.id}`} className="px-xs py-xxs text-s" onClick={() => setOpen((o) => !o)} aria-expanded={open} title={`Choose ${m.name}'s instrument`}>
          <span className="inline-flex items-center gap-xxs whitespace-nowrap">
            <InstrumentIcon instrument={m.instrument} size={20} />
            {INSTRUMENTS[m.instrument].name}
          </span>
        </RoughButton>
        <button
          type="button"
          // a finger-sized target (the × alone was 18 px wide)
          className="flex min-h-xl min-w-xl items-center justify-center text-l text-ink-soft transition-colors duration-(--motion-duration) hover:text-(--color-1) disabled:opacity-30"
          onClick={onRemove}
          disabled={members.length <= 1}
          aria-label={`Remove ${m.name}`}
          title={`Send ${m.name} home`}
        >
          ×
        </button>
      </div>
      {open && (
        <div className="mt-xs grid grid-cols-4 gap-xxs pl-xl">
          {INSTRUMENT_LIST.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onChange({ ...m, instrument: id as InstrumentId });
                setOpen(false);
              }}
              aria-pressed={id === m.instrument}
              data-selected={id === m.instrument}
              className="pick flex flex-col items-center px-xxs py-xxs text-xxs"
              title={INSTRUMENTS[id].name}
            >
              <InstrumentIcon instrument={id} size={30} />
              {INSTRUMENTS[id].name.replace("Upright ", "").replace("Tenor ", "")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Item = { id: string; name: string };

/**
 * A dropdown with a search tucked behind it: "search" opens a box over the list, typing narrows
 * the list (the pick already made always stays in it), Enter picks the first match, the down
 * arrow drops into the list, and Escape clears the box, then closes it.
 */
function SearchPicker({
  id,
  label,
  noun,
  value,
  none,
  groups,
  search,
  onPick,
}: {
  id: string;
  label: string;
  noun: string;
  value: string | null;
  none: string;
  groups: { key: string; label: string; items: Item[] }[];
  search: (query: string) => Item[];
  onPick: (id: string | null) => void;
}) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLSelectElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const typed = query.trim().length > 0;
  const matches = typed ? search(query) : [];
  const shown = (item: Item) => !typed || item.id === value || matches.some((m) => m.id === item.id);

  const close = () => {
    setQuery("");
    setSearching(false);
    toggleRef.current?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && typed && matches.length) {
      e.preventDefault();
      onPick(matches[0].id);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      listRef.current?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) setQuery("");
      else close();
    }
  };

  return (
    <div>
      {searching && (
        <input
          type="search"
          className="sketch-input mb-xxs w-full"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`Search ${total} ${noun}…`}
          aria-label={`Search ${noun}`}
          aria-controls={id}
          aria-describedby={typed ? `${id}-status` : undefined}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          autoFocus
        />
      )}
      <div className="flex items-baseline gap-xs">
        <select id={id} ref={listRef} className="sketch-select min-w-0 flex-1" value={value ?? ""} onChange={(e) => onPick(e.target.value || null)} aria-label={label}>
          <option value="">{none}</option>
          {groups.map((g) => {
            const here = g.items.filter(shown);
            return here.length ? (
              <optgroup key={g.key} label={g.label}>
                {here.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
        <button
          ref={toggleRef}
          type="button"
          className="text-action shrink-0 py-xs text-s"
          onClick={() => (searching ? close() : setSearching(true))}
          aria-expanded={searching}
          aria-label={searching ? `Close the ${noun} search` : `Search ${noun}`}
        >
          {searching ? "done" : "search"}
        </button>
      </div>
      {typed && (
        <div id={`${id}-status`} role="status" aria-live="polite" className="mt-xxs text-s text-ink-soft">
          {matches.length ? (
            `${matches.length} of ${total} match · Enter picks ${matches[0].name}`
          ) : (
            <>
              Nothing matches “{query.trim()}”.{" "}
              <button type="button" className="text-action" onClick={() => setQuery("")}>
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const TUNE_PICKER_GROUPS = TUNE_GROUPS.map((g) => ({ key: g.label, label: g.label, items: STANDARDS.filter(g.has) }));
const PRESET_PICKER_GROUPS = PRESET_GROUPS.map((g) => ({ key: g.id, label: g.label, items: PRESETS.filter((p) => p.group === g.id) }));

export function ControlPanel() {
  const s = useTroop((x) => x.settings);
  const members = useTroop((x) => x.members);
  const set = useTroop((x) => x.setSettings);
  const setStyle = useTroop((x) => x.setStyle);
  const applyPreset = useTroop((x) => x.applyPreset);
  const preset = getPreset(s.preset);
  const setStandard = useTroop((x) => x.setStandard);
  const setMembers = useTroop((x) => x.setMembers);
  const std = getStandard(s.standard);
  const lengths = lengthOptions(s.standard);
  const free = ANIMAL_LIST.filter((a) => !members.some((m) => m.animal === a));
  const leaders = members.filter((m) => m.instrument !== "drums");
  const swings = STYLES[s.style].swing > 0.5;

  const toggleSoloist = (id: string) => {
    const has = s.soloists.includes(id);
    set({ soloists: has ? s.soloists.filter((x) => x !== id) : [...s.soloists, id] });
  };

  return (
    <RoughBox seed="panel" rough={{ weight: "l" }} className="panel-paper w-full p-m" as="aside" aria-label="Band settings">
      <Arranger />

      <Field>
        <Label>Style</Label>
        <div className="mb-xs flex flex-wrap gap-xs">
          {STYLE_LIST.map((id) => (
            <Chip key={id} seed={`style-${id}`} active={s.style === id} onClick={() => setStyle(id)} title={STYLES[id].blurb}>
              {STYLES[id].name}
            </Chip>
          ))}
        </div>
        {/* an artist sets the style, the feel, the changes, the band, the tempo and the room at once */}
        <SearchPicker
          id="preset-list"
          label="Play like an artist"
          noun="artists"
          value={preset?.id ?? null}
          none="Play like… nobody in particular"
          groups={PRESET_PICKER_GROUPS}
          search={searchPresets}
          onPick={(id) => (id ? applyPreset(id as PresetId) : setStyle(s.style))}
        />
        {preset && <p className="mt-xxs text-s text-ink-soft">{preset.blurb}</p>}
      </Field>

      <Field>
        <Label>Tune</Label>
        <SearchPicker
          id="tune-list"
          label="Tune"
          noun="tunes"
          value={s.standard}
          none="An original (the band writes the changes)"
          groups={TUNE_PICKER_GROUPS}
          search={searchStandards}
          onPick={setStandard}
        />
        {std?.note && <p className="mt-xxs text-s text-ink-soft">{std.note}</p>}
      </Field>

      <Field>
        <Label hint={`${members.length}/6`}>The band</Label>
        {members.map((m) => (
          <MemberRow
            key={m.id}
            m={m}
            members={members}
            onChange={(next) => setMembers(members.map((x) => (x.id === m.id ? next : x)))}
            onRemove={() => setMembers(members.filter((x) => x.id !== m.id))}
          />
        ))}
        {members.length < 6 && free.length > 0 && (
          <div className="mt-xs flex flex-wrap items-center gap-xxs" role="group" aria-label="Invite to the band">
            {free.map((a: AnimalId) => (
              <button
                key={a}
                type="button"
                onClick={() => setMembers([...members, { id: a, animal: a, name: ANIMALS[a].name, instrument: ANIMALS[a].defaultInstrument }])}
                className="pick rounded-full p-xxs"
                title={`Invite ${ANIMALS[a].name} the ${ANIMALS[a].species}`}
                aria-label={`Invite ${ANIMALS[a].name}`}
              >
                <AnimalPortrait animal={a} size={30} />
              </button>
            ))}
          </div>
        )}
      </Field>

      <div className="mb-m grid grid-cols-2 gap-s">
        <div>
          <Label hint={`${s.tempo} bpm`}>Tempo</Label>
          <input
            type="range"
            className="sketch-range w-full"
            min={STYLES[s.style].tempo.min - 20}
            max={STYLES[s.style].tempo.max + 20}
            value={s.tempo}
            onChange={(e) => set({ tempo: parseInt(e.target.value, 10) })}
            aria-label="Tempo"
          />
        </div>
        <div>
          <Label>Key</Label>
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
              disabled={!!s.standard}
              title={s.standard ? "A standard keeps its own mode; pick any key for it" : undefined}
            >
              <option value="major">major</option>
              <option value="minor">minor</option>
            </select>
          </div>
        </div>
      </div>

      <Field>
        <Label hint={std ? `times through` : undefined}>Length</Label>
        <div className="flex flex-wrap gap-xs">
          {lengths.map((b) => (
            // a standard is played in choruses: once through, twice, three times...
            <Chip key={b} seed={`len-${b}`} active={s.bars === b} onClick={() => set({ bars: b })} title={std ? `${b} bars` : undefined}>
              {std ? (b === std.bars.length ? "once" : `${b / std.bars.length}×`) : `${b} bars`}
            </Chip>
          ))}
        </div>
      </Field>

      <details id="arrangement" className="group">
        <summary className="type-label flex cursor-pointer list-none items-baseline gap-xxs py-xxs">
          <span aria-hidden className="inline-block transition-transform duration-(--motion-duration) ease-small group-open:rotate-90">
            ▸
          </span>
          Leader, solos, meter{swings ? ", swing" : ""}
        </summary>
        <div className="mt-s">
          <Field>
            <Label>Leader</Label>
            <div className="flex flex-wrap gap-xs">
              {leaders.map((m) => (
                <Chip key={m.id} seed={`lead-${m.id}`} active={s.leaderId === m.id} onClick={() => set({ leaderId: m.id })}>
                  {m.name}
                </Chip>
              ))}
            </div>
          </Field>

          <Field>
            <Label hint="tap in solo order">Solos</Label>
            <div className="flex flex-wrap gap-xs">
              {members.map((m) => {
                const idx = s.soloists.indexOf(m.id);
                return (
                  <Chip key={m.id} seed={`solo-${m.id}`} active={idx >= 0} onClick={() => toggleSoloist(m.id)}>
                    {idx >= 0 && <span className="mr-xxs font-heavy">{idx + 1}.</span>}
                    {m.name}
                    {m.instrument === "drums" && <span className="text-xs text-ink-soft"> (trades)</span>}
                  </Chip>
                );
              })}
            </div>
          </Field>

          <div className="flex flex-wrap gap-x-l">
            <Field>
              <Label hint={std ? "set by the tune" : undefined}>Meter</Label>
              <div className="flex gap-xs">
                {[4, 3].map((b) => (
                  <Chip key={b} seed={`meter-${b}`} active={(std?.meter ?? s.meter.beats) === b} disabled={!!std} onClick={() => set({ meter: { beats: b } })}>
                    {b}/4
                  </Chip>
                ))}
              </div>
            </Field>

            {swings && (
              <Field>
                <Label>Swing</Label>
                <div className="flex gap-xs">
                  {(["light", "medium", "hard"] as const).map((f) => (
                    <Chip key={f} seed={`swing-${f}`} active={(s.swingFeel ?? "medium") === f} onClick={() => set({ swingFeel: f })} title="How far the 8ths lean">
                      {f}
                    </Chip>
                  ))}
                </div>
              </Field>
            )}
          </div>
        </div>
      </details>
    </RoughBox>
  );
}
