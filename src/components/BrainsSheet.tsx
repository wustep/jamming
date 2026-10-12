"use client";

import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { canRun, isClaude, keyMismatch, type KeyAccess } from "@/ai/keys";
import { modelInfo, modelsByProvider, PROVIDER_LABEL } from "@/ai/models";
import type { Sounds } from "@/audio/packs";
import { useDebug } from "@/state/debug";
import { keyAccess, useTroop } from "@/state/store";
import { RoughButton } from "./ui/rough";

// “Brains & sounds”: everything past the music itself, in a sheet off the side of the page (the
// bottom on a phone). The keys and the models, how the band thinks, the samples and the room,
// and the debug panel. The panel on the page keeps to the band and the tune.

const useSheet = create<{ open: boolean; focus: string | null; setOpen: (open: boolean, focus?: string) => void }>((set) => ({
  open: false,
  focus: null,
  setOpen: (open, focus) => set({ open, focus: focus ?? null }),
}));

export const openSheet = () => useSheet.getState().setOpen(true);

/** Open “Brains & sounds” with the cursor in the key field they're using. */
export function openBrains() {
  const { apiKey, anthropicKey } = useTroop.getState();
  useSheet.getState().setOpen(true, !apiKey && anthropicKey ? "anthropic-key" : "gateway-key");
}

/** Every model; with only an Anthropic key, the other providers' models are greyed out (they need the gateway). */
function ModelSelect({ id, value, onChange, access }: { id: string; value: string; onChange: (id: string) => void; access: KeyAccess }) {
  const claudeOnly = !access.gateway && access.anthropic;
  return (
    <>
      <select id={id} className="sketch-select w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        {modelsByProvider().map((g) => (
          <optgroup key={g.provider} label={`${PROVIDER_LABEL[g.provider] ?? g.provider}${claudeOnly && g.provider !== "anthropic" ? " (needs an AI Gateway key)" : ""}`}>
            {g.models.map((m) => (
              <option key={m.id} value={m.id} disabled={claudeOnly && !isClaude(m.id)}>
                {m.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {claudeOnly && !canRun(value, access) && <Problem>{modelInfo(value)?.label ?? value} needs an AI Gateway key. Pick a Claude model to use your Anthropic key.</Problem>}
    </>
  );
}

function Problem({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-xxs text-xs text-ink">
      <span aria-hidden className="text-(--error)">✗ </span>
      {children}
    </p>
  );
}

/** A key that stays in this browser: hidden by default, with show/hide and clear. */
function KeyField({ id, label, hint, value, placeholder, onChange, mismatch, note }: { id: string; label: string; hint: string; value: string; placeholder: string; onChange: (key: string) => void; mismatch: string | null; note: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <FieldLabel htmlFor={id} hint={hint}>
        {label}
      </FieldLabel>
      <div className="flex gap-xxs">
        <input
          type={show ? "text" : "password"}
          className="sketch-input min-w-0 flex-1"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          id={id}
        />
        <button type="button" className="text-action px-xxs text-s" onClick={() => setShow((v) => !v)}>
          {show ? "hide" : "show"}
        </button>
        {value && (
          <button type="button" className="text-action px-xxs text-s" onClick={() => onChange("")} aria-label={`Clear the ${label}`}>
            clear
          </button>
        )}
      </div>
      {mismatch ? <Problem>{mismatch}</Problem> : note && <p className="mt-xxs text-xs text-ink-soft">{note}</p>}
    </div>
  );
}

function FieldLabel({ children, hint, htmlFor }: { children: React.ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <div className="mb-xxs flex items-baseline justify-between gap-xs">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-m font-heavy">
          {children}
        </label>
      ) : (
        <span className="text-m font-heavy">{children}</span>
      )}
      {hint && <span className="text-s text-ink-soft">{hint}</span>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rule-top space-y-s px-l py-m" aria-label={title}>
      <h3 className="type-label">{title}</h3>
      {children}
    </section>
  );
}

function SoundSelect<K extends keyof Sounds>({ k, label, children }: { k: K; label: string; children: React.ReactNode }) {
  const value = useTroop((x) => x.sounds[k]);
  const setSounds = useTroop((x) => x.setSounds);
  return (
    <label className="block">
      <span className="mb-xxs block text-m font-heavy">{label}</span>
      <select className="sketch-select w-full" value={String(value)} onChange={(e) => setSounds({ [k]: e.target.value } as Partial<Sounds>)}>
        {children}
      </select>
    </label>
  );
}

function Brain() {
  const s = useTroop((x) => x.settings);
  const set = useTroop((x) => x.setSettings);
  const apiKey = useTroop((x) => x.apiKey);
  const anthropicKey = useTroop((x) => x.anthropicKey);
  const serverKey = useTroop((x) => x.serverKey);
  const serverAnthropicKey = useTroop((x) => x.serverAnthropicKey);
  const heuristic = useTroop((x) => x.heuristic);
  const setApiKey = useTroop((x) => x.setApiKey);
  const setAnthropicKey = useTroop((x) => x.setAnthropicKey);
  const setHeuristic = useTroop((x) => x.setHeuristic);
  const openKeyDialog = useTroop((x) => x.openKeyDialog);
  const access = keyAccess({ apiKey, anthropicKey, serverKey, serverAnthropicKey, heuristic });
  const thinks = access.gateway || access.anthropic;
  const composer = s.mode === "composer";

  return (
    <Section title="Brain">
      <div className="flex flex-wrap items-baseline justify-between gap-x-s gap-y-xxs">
        <p className="text-m">
          {heuristic
            ? "The heuristic band: no model calls."
            : apiKey
              ? "Your Vercel AI Gateway key."
              : anthropicKey
                ? "Your Anthropic key (Claude models)."
                : serverKey || serverAnthropicKey
                  ? "A key this server lends."
                  : "The heuristic band, until you add a key."}
        </p>
        <button type="button" className="text-action text-s" onClick={openKeyDialog} aria-haspopup="dialog">
          {apiKey || anthropicKey ? "change key" : "add a key"}
        </button>
      </div>
      {heuristic && (apiKey || anthropicKey || serverKey || serverAnthropicKey) && (
        <p className="text-s text-ink-soft">
          {apiKey || anthropicKey ? "Your key is still saved here." : "This server lends a key."}{" "}
          <button type="button" className="text-action" onClick={() => setHeuristic(false)}>
            Let them think with it
          </button>
        </p>
      )}

      <div>
        <FieldLabel hint={thinks ? undefined : "once they have a key"}>How they think</FieldLabel>
        <div className="grid grid-cols-2 gap-xs">
          <RoughButton seed="mode-imp" active={!composer} onClick={() => set({ mode: "improviser" })} className="px-xs py-xs text-left">
            <div className="type-label">Improviser</div>
            <div className="text-xs text-ink-soft">the animals talk it out</div>
          </RoughButton>
          <RoughButton seed="mode-comp" active={composer} onClick={() => set({ mode: "composer" })} className="px-xs py-xs text-left">
            <div className="type-label">Composer</div>
            <div className="text-xs text-ink-soft">a director writes the chart</div>
          </RoughButton>
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="director-model">{composer ? "Director" : "Leader"} model</FieldLabel>
        <ModelSelect id="director-model" value={s.directorModel} onChange={(id) => set({ directorModel: id })} access={access} />
      </div>
      {!composer && (
        <div>
          <FieldLabel htmlFor="player-model">Bandmates model</FieldLabel>
          <ModelSelect id="player-model" value={s.playerModel} onChange={(id) => set({ playerModel: id })} access={access} />
        </div>
      )}
      {composer ? (
        <label className="flex cursor-pointer items-center gap-xs text-m">
          <input type="checkbox" className="sketch-check" checked={s.bestOf > 1} onChange={(e) => set({ bestOf: e.target.checked ? 4 : 1 })} />
          Best of 4: write four charts and let a judge pick
        </label>
      ) : (
        <div>
          <FieldLabel hint="before the band answers">Phrase</FieldLabel>
          <div className="flex gap-xs">
            {[2, 4, 8].map((p) => (
              <RoughButton key={p} seed={`phrase-${p}`} active={s.phraseBars === p} onClick={() => set({ phraseBars: p })} className="px-xs py-xxs text-m">
                {p} bars
              </RoughButton>
            ))}
          </div>
        </div>
      )}

      <KeyField
        id="gateway-key"
        label="AI Gateway key"
        hint="every model"
        placeholder="vck_…"
        value={apiKey}
        onChange={setApiKey}
        mismatch={keyMismatch("gateway", apiKey)}
        note={
          apiKey ? null : serverKey && !heuristic ? (
            "This server lends one. Yours spends your own credits."
          ) : (
            <a className="text-action" href="https://vercel.com/ai-gateway" target="_blank" rel="noreferrer">
              Get one from Vercel
            </a>
          )
        }
      />
      <KeyField
        id="anthropic-key"
        label="Anthropic key"
        hint="Claude models"
        placeholder="sk-ant-…"
        value={anthropicKey}
        onChange={setAnthropicKey}
        mismatch={keyMismatch("anthropic", anthropicKey)}
        note={
          anthropicKey ? (
            apiKey ? "Used if you remove the gateway key." : null
          ) : (
            <a className="text-action" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              Get one from Anthropic
            </a>
          )
        }
      />
      <p className="text-xs text-ink-soft">Keys stay in this browser and go only with each model call, straight on to the provider.</p>
    </Section>
  );
}

function SoundsSection() {
  const countIn = useTroop((x) => x.sounds.countIn);
  const setSounds = useTroop((x) => x.setSounds);
  return (
    <Section title="Sounds">
      <div className="grid grid-cols-2 gap-s">
        <SoundSelect k="piano" label="Piano">
          <optgroup label="Grand piano">
            <option value="salamander">Salamander (richest)</option>
            <option value="splendid">Splendid</option>
            <option value="soundfont">General MIDI (lightest)</option>
          </optgroup>
          <optgroup label="Electric">
            <option value="wurlitzer">Wurlitzer</option>
            <option value="cp80">Yamaha CP80</option>
          </optgroup>
          <optgroup label="Early keyboard">
            <option value="harpsichord">Harpsichord</option>
          </optgroup>
        </SoundSelect>
        <SoundSelect k="drums" label="Drum kit">
          <option value="acoustic">Acoustic kit</option>
          <option value="lm2">LinnDrum machine</option>
        </SoundSelect>
        <SoundSelect k="room" label="Room">
          <option value="dry">Dry (close up)</option>
          <option value="club">Club</option>
          <option value="hall">Hall (big and wet)</option>
        </SoundSelect>
        <SoundSelect k="pad" label="String pad">
          <option value="strings">String ensemble</option>
          <option value="choir">Choir</option>
        </SoundSelect>
      </div>
      <label className="flex cursor-pointer items-center gap-xs text-m">
        <input type="checkbox" className="sketch-check" checked={countIn} onChange={(e) => setSounds({ countIn: e.target.checked })} />
        Count me in: a bar of clicks before a take from the top
      </label>
    </Section>
  );
}

/** The header's way in. */
export function BrainsButton() {
  const open = useSheet((x) => x.open);
  return (
    <RoughButton seed="brains" tone="quiet" className="px-s py-xs text-m" onClick={openSheet} aria-haspopup="dialog" aria-expanded={open} aria-controls="brains">
      Brains &amp; sounds
    </RoughButton>
  );
}

export function BrainsSheet() {
  const open = useSheet((x) => x.open);
  const focus = useSheet((x) => x.focus);
  const setOpen = useSheet((x) => x.setOpen);
  const debugOpen = useDebug((x) => x.open);
  const setDebugOpen = useDebug((x) => x.setOpen);
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      opener.current = document.activeElement as HTMLElement | null;
      d.showModal();
      const target = focus ? document.getElementById(focus) : null;
      // showModal focuses the first control (the ×); a key problem goes straight to the key
      target?.focus();
      target?.scrollIntoView({ block: "center" });
    } else if (!open && d.open) {
      d.close();
      const back = opener.current;
      if (back?.isConnected && back !== document.body) back.focus();
    }
  }, [open, focus]);

  const close = () => setOpen(false);

  return (
    <dialog
      ref={ref}
      id="brains"
      className="sheet-dialog"
      aria-labelledby="brains-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      // a click on the dimmed page beside the sheet closes it
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      {open && (
        <div className="min-h-full">
          <div className="sheet-head sticky top-0 z-10 flex items-center justify-between gap-s px-l py-s">
            <h2 id="brains-title" className="type-section">
              Brains &amp; sounds
            </h2>
            <button
              type="button"
              onClick={close}
              className="flex min-h-xl min-w-xl items-center justify-center text-l text-ink-soft transition-colors duration-(--motion-duration) hover:text-ink"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <Brain />
          <SoundsSection />
          <Section title="Under the hood">
            <p className="text-s text-ink-soft">Every model call, the plan, the chart, the audio clock and what got repaired, in a panel under the stage.</p>
            <button
              type="button"
              className="text-action text-m"
              aria-pressed={debugOpen}
              onClick={() => {
                setDebugOpen(!debugOpen);
                if (debugOpen) return;
                close();
                requestAnimationFrame(() => {
                  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
                  document.querySelector('[aria-label="Debug"]')?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
                });
              }}
            >
              {debugOpen ? "hide the debug panel" : "peek under the hood"}
            </button>
          </Section>
        </div>
      )}
    </dialog>
  );
}
