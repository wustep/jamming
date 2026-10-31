"use client";

import { useEffect, useRef, useState } from "react";
import { isKeyProblem, runErrorText } from "@/ai/keys";
import { troopAudio, type LoadState } from "@/audio/engine";
import { INSTRUMENTS } from "@/music/instruments";
import { savedConfig } from "@/state/saved";
import { canShare, shareUrl, type JamConfig } from "@/state/share";
import { canThink, useTroop } from "@/state/store";
import { openBrains } from "./BrainsSheet";
import { PlayAlongToggle } from "./PlayAlong";
import { RoughButton, TransportGlyph } from "./ui/rough";

function useLoadStates() {
  const [states, setStates] = useState<LoadState[]>([]);
  useEffect(() => troopAudio.onLoad(setStates), []);
  return states;
}

export function Transport() {
  const playing = useTroop((s) => s.playing);
  const play = useTroop((s) => s.play);
  const stop = useTroop((s) => s.stop);
  const generate = useTroop((s) => s.generate);
  const cancel = useTroop((s) => s.cancel);
  const playSketchInstead = useTroop((s) => s.playSketchInstead);
  const gen = useTroop((s) => s.gen);
  const mode = useTroop((s) => s.settings.mode);
  const hasKey = useTroop(canThink);
  const heuristic = useTroop((s) => s.heuristic);
  const current = useTroop((s) => s.current);
  const isSketch = useTroop((s) => s.isSketch);
  const audioError = useTroop((s) => s.audioError);
  const loads = useLoadStates();
  const loading = loads.filter((l) => !l.ready && !l.error);
  const failed = loads.filter((l) => l.error);
  // over every instrument, counting finished and failed ones as done, so the bar only grows
  const loadPct = loads.length ? Math.round((loads.reduce((s, l) => s + (l.ready || l.error ? 1 : l.total ? l.loaded / l.total : 0), 0) / loads.length) * 100) : 100;
  const members = useTroop((s) => s.members);
  const retryLoads = () => {
    const { members, sounds } = useTroop.getState();
    void troopAudio.prepare(members, { sounds });
  };

  const goLabel = hasKey ? (mode === "composer" ? "Compose!" : "Let them jam!") : "New sketch";

  // Space toggles play/stop (unless typing, or pressing a button reached by keyboard).
  // A button focused by a mouse click would otherwise be clicked again by Space.
  useEffect(() => {
    let pointed: Element | null = null; // the button the pointer last pressed
    const onPointer = (e: PointerEvent) => {
      pointed = (e.target as HTMLElement | null)?.closest("button") ?? null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") {
        if (e.key === "Tab") pointed = null;
        return;
      }
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const button = t?.closest("button");
      if (t && (t.closest("input, textarea, select, [contenteditable]") || (button && button !== pointed))) return;
      e.preventDefault();
      button?.blur(); // so the key's release can't click it either
      if (useTroop.getState().playing) useTroop.getState().stop();
      else void useTroop.getState().play();
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // on a phone the stage fills the screen: once the transport scrolls away, a dock keeps it in reach
  const [rowRef, setRowRef] = useState<HTMLDivElement | null>(null);
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    if (!rowRef) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting), { threshold: 0 });
    io.observe(rowRef);
    return () => io.disconnect();
  }, [rowRef]);

  return (
    <div ref={setRowRef} className="flex flex-wrap items-center gap-s">
      {offscreen && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-s bg-(--neutral-1) px-m py-xs shadow-[var(--border-shadow-m),var(--shadow-m)] lg:hidden" role="region" aria-label="Transport">
          <RoughButton
            seed="dock-play"
            shape="ellipse"
            tone="go"
            className="grid h-11 w-11 shrink-0 place-items-center text-on-accent"
            onClick={() => (playing ? stop() : void play())}
            disabled={!current}
            aria-label={playing ? "Stop" : "Play"}
          >
            <TransportGlyph playing={playing} size={44} />
          </RoughButton>
          <span className="min-w-0 flex-1 truncate text-s text-ink-soft">
            {gen.running ? gen.status : current ? current.title : ""}
          </span>
          {/* as tall as the play button: a thumb's width */}
          {gen.running ? (
            <RoughButton seed="dock-cancel" tone="quiet" className="min-h-11 shrink-0 px-s py-xxs font-brand text-l font-heavy" onClick={cancel} aria-label="Stop thinking">
              Stop
            </RoughButton>
          ) : (
            <RoughButton seed="dock-go" tone="primary" className="min-h-11 shrink-0 px-s py-xxs font-brand text-l font-heavy text-on-accent" onClick={() => void generate()}>
              {goLabel}
            </RoughButton>
          )}
        </div>
      )}
      <RoughButton
        seed="play"
        shape="ellipse"
        tone="go"
        // a circle reads smaller than a box of the same height, so it is a touch taller than the button beside it
        className="grid h-12 w-12 shrink-0 place-items-center text-on-accent"
        onClick={() => (playing ? stop() : void play())}
        disabled={!current}
        aria-label={playing ? "Stop" : "Play"}
        title={playing ? "Stop (space)" : "Play (space)"}
      >
        <TransportGlyph playing={playing} size={48} />
      </RoughButton>

      {gen.running ? (
        <RoughButton seed="cancel" tone="quiet" className="px-m py-xs font-brand text-xl font-heavy" onClick={cancel} aria-label="Stop thinking">
          Stop
        </RoughButton>
      ) : (
        <RoughButton
          seed="go"
          tone="primary"
          className="px-l py-xs font-brand text-xl font-heavy text-on-accent"
          onClick={() => void generate()}
          data-after-key
          title={hasKey ? "Ask the band (calls the model)" : "A new take from the sketchbook. Add a key in Settings to let them think."}
        >
          {goLabel}
        </RoughButton>
      )}

      {!hasKey && !gen.running && (
        <button type="button" className="tap text-action text-s" onClick={() => useTroop.getState().openKeyDialog()} aria-haspopup="dialog" title="Let the band think with a model">
          {heuristic ? "Use a key" : "Add a key"}
        </button>
      )}

      <div className="min-w-0 flex-1 basis-60 text-m text-ink-soft" aria-live="polite">
        {gen.running ? (
          <span>{gen.status}</span>
        ) : gen.error ? (
          <span role="alert" className="flex flex-wrap items-baseline gap-x-s">
            <span className="text-ink">
              <span aria-hidden className="text-(--error)">✗ </span>
              {runErrorText(gen.error)}
            </span>
            {isKeyProblem(gen.error) ? (
              <button type="button" className="text-action" onClick={openBrains}>
                {/pick a Claude model/.test(gen.error) ? "Pick a model" : "Check key"}
              </button>
            ) : (
              <button type="button" className="text-action" onClick={() => void generate()}>
                Retry
              </button>
            )}
            <button type="button" className="text-action" onClick={playSketchInstead}>
              Play sketch
            </button>
          </span>
        ) : audioError ? (
          <span role="alert" className="flex flex-wrap items-baseline gap-x-s">
            <span className="text-ink">
              <span aria-hidden className="text-(--error)">✗ </span>No sound: {audioError}.
            </span>
            <button type="button" className="text-action" onClick={() => void play()}>
              Retry
            </button>
          </span>
        ) : loading.length ? (
          <span className="flex items-center gap-xs">
            <span>Loading</span>
            <span
              role="progressbar"
              aria-label="Unpacking instruments"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={loadPct}
              title={`${loads.length - loading.length - failed.length} of ${loads.length} ready: waiting on ${loading.map((l) => l.instrument).join(", ")}`}
              className="relative inline-block h-2.5 w-28 overflow-hidden rounded-full shadow-[inset_0_0_0_var(--border-m)_var(--border-default-color)]"
            >
              <span className="absolute inset-y-0 left-0 bg-(--color-2)" style={{ width: `${loadPct}%` }} />
            </span>

          </span>
        ) : current && !isSketch ? (
          // the stage already says what's loaded; here, only whose take it is and how it scored
          <span>
            {current.engine === "ai" ? "the band's take" : "a sketch take"}
            {current.critic && current.critic.scores.length > 0 && <> · judge: {current.critic.scores.find((x) => x.candidate === current.critic!.chosen)?.score ?? "?"}/10</>}
          </span>
        ) : null}
        {failed.length > 0 && !loading.length && !gen.running && (
          <span role="alert" className="flex flex-wrap items-baseline gap-x-s">
            <span className="text-ink">
              <span aria-hidden className="text-(--error)">
                ✗{" "}
              </span>
              {failed.map((l) => `${members.find((m) => m.id === l.memberId)?.name ?? l.memberId}'s ${INSTRUMENTS[l.instrument].name.toLowerCase()}`).join(", ")}{" "}
              {failed.length > 1 ? "are" : "is"} silent.
            </span>
            <button type="button" className="text-action" onClick={retryLoads}>
              Retry
            </button>
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-m gap-y-xs">
        <Volume />
        <PlayAlongToggle />
        <KeepMenu />
      </div>
    </div>
  );
}

/** A pencil-drawn speaker: no waves when it's silent, one when it's quiet, two when it's up. */
function SpeakerGlyph({ level }: { level: number }) {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.8 7.6h3l4.2-3.4v11.6l-4.2-3.4h-3z" />
      {level === 0 ? <path d="M13.4 8.1l3.8 3.8m0-3.8l-3.8 3.8" /> : <path d="M13.2 7.4c1.3 1.5 1.3 3.7 0 5.2" />}
      {level > 0.5 && <path d="M15.6 5c2.5 2.8 2.5 7.2 0 10" />}
    </svg>
  );
}

/**
 * How loud the band plays here (saved in this browser): the speaker silences it and brings it back
 * where it was. It turns down only what you hear: a downloaded take is the same at any volume.
 */
function Volume() {
  const volume = useTroop((s) => s.volume);
  const setVolume = useTroop((s) => s.setVolume);
  // where the speaker brings it back to
  const last = useRef(1);
  const pct = Math.round(volume * 100);
  return (
    <div className="flex items-center gap-xxs" role="group" aria-label="Volume">
      <button
        type="button"
        className="tap min-h-xl min-w-xl text-ink-soft transition-colors duration-(--motion-duration) hover:text-ink"
        onClick={() => {
          if (volume > 0) last.current = volume;
          setVolume(volume > 0 ? 0 : last.current);
        }}
        aria-pressed={volume === 0}
        aria-label="Silence the band"
        title={volume > 0 ? "Silence" : "Sound on"}
      >
        <SpeakerGlyph level={volume} />
      </button>
      <input
        type="range"
        className="sketch-range w-24"
        min={0}
        max={100}
        step={1}
        value={pct}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10) / 100;
          if (v > 0) last.current = v;
          setVolume(v);
        }}
        aria-label="Volume"
        aria-valuetext={`${pct}%`}
        title={`Volume ${pct}%`}
      />
    </div>
  );
}

/**
 * Save and share, in one menu: an audio file, this browser's saved jams, or a link. The items
 * stay mounted while it's shut, so a recording or a "link copied" carries on and still says so.
 */
function KeepMenu() {
  const current = useTroop((s) => s.current);
  const running = useTroop((s) => s.gen.running);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      document.getElementById("keep-toggle")?.focus();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!current || running) return null;
  return (
    <div ref={ref} className="relative">
      <RoughButton id="keep-toggle" seed="keep" tone="quiet" active={open} className="tap px-s py-xxs text-m" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="keep-menu" aria-pressed={undefined}>
        Share <span aria-hidden>{open ? "▴" : "▾"}</span>
      </RoughButton>
      <div id="keep-menu" hidden={!open} className="menu-paper absolute right-0 top-full z-30 mt-xs w-max min-w-full p-xs">
        <ul className="flex flex-col">
          <li>
            <ShareLink />
          </li>
          <li>
            <SaveJam />
          </li>
          <li>
            <SaveAudio />
          </li>
        </ul>
      </div>
    </div>
  );
}

/** A file name for a take: its title, without characters file systems refuse. */
export function audioFileName(title: string, mimeType: string) {
  const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
  const base = title.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim() || "take";
  return `${base} · Jamming.${ext}`;
}

/** After the last note, keep recording while the room rings out. */
const TAIL_MS = 1500;

/**
 * Save the take as an audio file: it plays from the top and the band is recorded as it plays
 * (the samplers are live, so there's no faster-than-real-time render). The count-in isn't on the
 * file. Stop throws the recording away.
 */
function SaveAudio() {
  const current = useTroop((s) => s.current);
  const running = useTroop((s) => s.gen.running);
  const [phase, setPhase] = useState<"idle" | "recording" | "saving">("idle");
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3000);
    return () => clearTimeout(t);
  }, [note]);
  if (!current || (running && phase === "idle")) return null;

  const record = async () => {
    const score = current;
    const st = useTroop.getState();
    if (st.playing) st.stop();
    await st.play(0);
    if (!useTroop.getState().playing) return;
    setPhase("recording");
    let rec: ReturnType<typeof troopAudio.startRecording> = null;
    let ended = false;
    let timer = 0;
    const offEnded = troopAudio.onEnded(() => {
      ended = true;
      window.clearInterval(timer);
      offEnded();
      setPhase("saving");
      window.setTimeout(async () => {
        const blob = await rec?.stop();
        setPhase("idle");
        if (!blob) return setNote("Nothing recorded");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = audioFileName(score.title, blob.type);
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
        setNote("Saved");
      }, TAIL_MS);
    });
    // start on the downbeat, after the count-in; a stop before the end throws it away
    timer = window.setInterval(() => {
      if (ended) return;
      if (!useTroop.getState().playing) {
        window.clearInterval(timer);
        offEnded();
        rec?.cancel();
        setPhase("idle");
        setNote("Stopped, not saved");
        return;
      }
      if (!rec && troopAudio.getBeat() >= 0) {
        rec = troopAudio.startRecording();
        if (!rec) {
          window.clearInterval(timer);
          offEnded();
          setPhase("idle");
          setNote("Can't record here");
        }
      }
    }, 20);
  };

  const label = phase === "recording" ? "Recording…" : phase === "saving" ? "Saving…" : (note ?? "Download audio");
  return (
    <button
      type="button"
      className="pick block w-full px-xs py-xs text-left text-m"
      disabled={phase !== "idle"}
      onClick={() => void record()}
      title={phase === "recording" ? "Stop to cancel" : "Plays the take from the top and saves it as an audio file"}
    >
      <span aria-live="polite">{label}</span>
    </button>
  );
}

/** A note that clears itself, about the take it was said of (switching takes clears it). */
function useNote(ms: number) {
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), ms);
    return () => clearTimeout(t);
  }, [note, ms]);
  return [note, setNote] as const;
}

/** What a link says about a take the models played: it carries their setup, not their notes. */
const AI_LINK_NOTE = "the setup and seed: the models' parts will differ";

/** Copy a link, or hand it to the share sheet on a phone. Resolves to what to say about it. */
async function sendLink(url: string, title: string): Promise<string | null> {
  try {
    if (navigator.share && matchMedia("(hover: none)").matches) {
      await navigator.share({ title: `Jamming · ${title}`, url });
      return null;
    }
    await navigator.clipboard.writeText(url);
    return "Link copied";
  } catch (e) {
    return (e as Error).name === "AbortError" ? null : "Couldn't copy";
  }
}

/** Keep the jam on stage in this browser: its whole configuration (and the models' notes, when they played it). */
function SaveJam() {
  const current = useTroop((s) => s.current);
  const running = useTroop((s) => s.gen.running);
  const saveJam = useTroop((s) => s.saveJam);
  const [note, setNote] = useNote(2500);
  if (running || !canShare(current)) return null;
  return (
    <button
      type="button"
      className="pick block w-full px-xs py-xs text-left text-m"
      onClick={() => setNote({ id: current.id, text: saveJam() ? "Saved" : "Couldn't save" })}
      title="Keep this jam's whole setup (band, settings, sounds, brains and seed) in this browser"
    >
      <span aria-live="polite">{note?.id === current.id ? note.text : "Save here"}</span>
    </button>
  );
}

/** Copy a link that opens this jam, set up as it is (a model-written take as its setup and seed). */
function ShareLink() {
  const current = useTroop((s) => s.current);
  const running = useTroop((s) => s.gen.running);
  const [note, setNote] = useNote(4000);
  if (running || !canShare(current)) return null;
  const ai = current.engine === "ai";

  const share = async () => {
    const config = useTroop.getState().jamConfig();
    if (!config) return;
    const said = await sendLink(shareUrl(config, location.href), current.title);
    if (said) setNote({ id: current.id, text: said });
  };

  return (
    <button
      type="button"
      className="pick block w-full px-xs py-xs text-left text-m"
      onClick={() => void share()}
      title={ai ? `Copy a link to this jam. It carries ${AI_LINK_NOTE}.` : "Copy a link that plays this jam again, note for note"}
    >
      <span aria-live="polite">{note?.id === current.id ? note.text : "Copy link"}</span>
    </button>
  );
}

/** "Bossa Nova · C minor · 132 bpm · in the hall" */
function jamFacts(c: JamConfig): string {
  const s = c.settings;
  const room = c.sounds.room === "club" ? "" : c.sounds.room === "dry" ? " · dry" : " · in the hall";
  return `${s.key.tonic} ${s.key.mode} · ${s.tempo} bpm${room}`;
}

/** Jams saved in this browser: open one to set it all up again, or copy its link. */
export function SavedJams() {
  const saved = useTroop((s) => s.saved);
  const open = useTroop((s) => s.openSaved);
  const remove = useTroop((s) => s.deleteSaved);
  const [note, setNote] = useNote(2500);
  if (!saved.length) return null;
  return (
    <div>
      <h2 className="type-section mb-xs">Saved</h2>
      <ol className="space-y-xxs">
        {saved.map((entry) => {
          const c = savedConfig(entry);
          if (!c) return null;
          const ai = c.engine === "ai";
          return (
            <li key={entry.id} className="group flex items-start gap-xxs">
              <button type="button" onClick={() => open(entry.id)} className="pick min-w-0 flex-1 px-xs py-xxs text-left text-m" title="Set this jam up again">
                <span className="block truncate">{entry.name}</span>
                <span className="block text-xs text-ink-soft">
                  {jamFacts(c)}
                  {ai ? (entry.score ? " · as played" : " · setup only") : ""}
                </span>
              </button>
              <button
                type="button"
                className="tap text-action shrink-0 px-xxs pt-xxs text-s"
                onClick={async () => {
                  const said = await sendLink(`${location.origin}/s/${entry.jam}${location.search}`, entry.name);
                  if (said) setNote({ id: entry.id, text: said === "Link copied" ? "Copied" : said });
                }}
                title={ai ? `Copy a link to this jam. It carries ${AI_LINK_NOTE}.` : "Copy a link to this jam"}
              >
                <span aria-live="polite">{note?.id === entry.id ? note.text : "Link"}</span>
              </button>
              <button
                type="button"
                onClick={() => remove(entry.id)}
                className="px-xxs pt-xxs text-ink-soft opacity-0 transition-colors duration-(--motion-duration) hover:text-(--color-1) focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-70"
                aria-label={`Delete the saved jam ${entry.name}`}
                title="Delete this saved jam"
              >
                ×
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function Takes() {
  const takes = useTroop((s) => s.takes);
  const current = useTroop((s) => s.current);
  const select = useTroop((s) => s.selectTake);
  const remove = useTroop((s) => s.deleteTake);
  if (!takes.length) return null;
  return (
    <div>
      <h2 className="type-section mb-xs">Takes</h2>
      <ol className="space-y-xxs">
        {takes.map((t, i) => (
          <li key={t.id} className="group flex items-start gap-xxs">
            <button
              type="button"
              onClick={() => select(t.id)}
              aria-current={current?.id === t.id}
              data-selected={current?.id === t.id}
              className="pick min-w-0 flex-1 px-xs py-xxs text-left text-m"
            >
              <span className="mr-xxs text-ink-soft">#{takes.length - i}</span>
              {t.label}
              {/* the time and the judge's score wrap as one, never "judge" on one line and "8.6" on the next */}
              <span className="ml-xxs inline-block whitespace-nowrap text-xs text-ink-soft">
                {new Date(t.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                {t.score.critic?.scores.length ? ` · judge ${t.score.critic.scores.find((x) => x.candidate === t.score.critic!.chosen)?.score ?? ""}` : ""}
              </span>
            </button>
            <button
              type="button"
              onClick={() => remove(t.id)}
              // shown on hover, or always on a touch screen (which has no hover to reveal it)
              className="px-xxs pt-xxs text-ink-soft opacity-0 transition-colors duration-(--motion-duration) hover:text-(--color-1) focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-70"
              aria-label={`Delete take ${takes.length - i}`}
              title="Delete this take"
            >
              ×
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
