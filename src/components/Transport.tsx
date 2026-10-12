"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { isKeyProblem, runErrorText } from "@/ai/keys";
import { canRecordVideo, troopAudio, type LoadState, type Recording } from "@/audio/engine";
import { INSTRUMENTS } from "@/music/instruments";
import { getPreset } from "@/music/presets";
import { canShare, shareUrl } from "@/state/share";
import { canThink, useTroop } from "@/state/store";
import { openBrains } from "./ControlPanel";
import { CLIP_SECONDS, paintStage, takeFileName, type ClipPainter } from "./stage/clip";
import { RoughButton } from "./ui/rough";

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
  const bestOf = useTroop((s) => s.settings.bestOf);
  const set = useTroop((s) => s.setSettings);
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

  const goLabel = hasKey ? (mode === "composer" ? "Compose!" : "Let them jam!") : "Sketch a new take";

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
            className="h-11 w-11 shrink-0 text-l text-on-accent"
            onClick={() => (playing ? stop() : void play())}
            disabled={!current}
            aria-label={playing ? "Stop" : "Play"}
          >
            {playing ? "■" : "▶"}
          </RoughButton>
          <span className="min-w-0 flex-1 truncate text-s text-ink-soft">
            {gen.running ? gen.status : current ? current.title : ""}
          </span>
          {gen.running ? (
            <RoughButton seed="dock-cancel" tone="quiet" className="shrink-0 px-s py-xxs font-brand text-l font-heavy" onClick={cancel}>
              stop thinking
            </RoughButton>
          ) : (
            <RoughButton seed="dock-go" tone="primary" className="shrink-0 px-s py-xxs font-brand text-l font-heavy text-on-accent" onClick={() => void generate()}>
              {goLabel}
            </RoughButton>
          )}
        </div>
      )}
      <RoughButton
        seed="play"
        shape="ellipse"
        tone="go"
        className="h-14 w-14 text-xl text-on-accent"
        onClick={() => (playing ? stop() : void play())}
        disabled={!current}
        aria-label={playing ? "Stop" : "Play"}
        title={playing ? "Stop (space)" : "Play (space)"}
      >
        {playing ? "■" : "▶"}
      </RoughButton>

      {gen.running ? (
        <RoughButton seed="cancel" tone="quiet" className="px-m py-xs font-brand text-xl font-heavy" onClick={cancel}>
          stop thinking
        </RoughButton>
      ) : (
        <RoughButton
          seed="go"
          tone="primary"
          className="px-l py-xs font-brand text-xl font-heavy text-on-accent"
          onClick={() => void generate()}
          data-after-key
          title={hasKey ? "Ask the band (calls the model)" : "Add an AI Gateway or Anthropic key in “Brains & sounds” to let the animals think — until then they play from their sketchbook."}
        >
          {goLabel}
        </RoughButton>
      )}

      {!hasKey && !gen.running && (
        <button type="button" className="text-action text-s" onClick={() => useTroop.getState().openKeyDialog()} aria-haspopup="dialog">
          {heuristic ? "use an AI key" : "add an AI key"}
        </button>
      )}

      {mode === "composer" && hasKey && (
        <label className="flex cursor-pointer items-center gap-xs text-m" title="Write 4 candidate charts and let a judge pick the most distinctive">
          <input type="checkbox" className="sketch-check" checked={bestOf > 1} onChange={(e) => set({ bestOf: e.target.checked ? 4 : 1 })} />
          best of 4
        </label>
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
                {/pick a Claude model/.test(gen.error) ? "pick a model" : "check the key"}
              </button>
            ) : (
              <button type="button" className="text-action" onClick={() => void generate()}>
                try again
              </button>
            )}
            <button type="button" className="text-action" onClick={playSketchInstead}>
              play the sketch instead
            </button>
          </span>
        ) : audioError ? (
          <span role="alert" className="flex flex-wrap items-baseline gap-x-s">
            <span className="text-ink">
              <span aria-hidden className="text-(--error)">✗ </span>No sound: {audioError}.
            </span>
            <button type="button" className="text-action" onClick={() => void play()}>
              press play again
            </button>
          </span>
        ) : loading.length ? (
          <span className="flex items-center gap-xs">
            <span>unpacking instruments…</span>
            <span
              role="progressbar"
              aria-label="Unpacking instruments"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={loadPct}
              className="relative inline-block h-2.5 w-28 overflow-hidden rounded-full shadow-[inset_0_0_0_var(--border-m)_var(--border-default-color)]"
            >
              <span className="absolute inset-y-0 left-0 bg-(--color-2)" style={{ width: `${loadPct}%` }} />
            </span>
            <span className="text-xs" title={loading.map((l) => l.instrument).join(", ")}>
              {loads.length - loading.length - failed.length} of {loads.length} ready
            </span>
          </span>
        ) : current ? (
          <span>
            {isSketch ? "sketch" : current.engine === "ai" ? "take" : "sketch take"}: <b className="text-ink">{current.title}</b> — {current.frame.bars} bars, {current.frame.key.tonic} {current.frame.key.mode}, {current.frame.tempo} bpm
            {current.critic && current.critic.scores.length > 0 && (
              <>
                {" "}
                · judge: {current.critic.scores.find((x) => x.candidate === current.critic!.chosen)?.score ?? "?"}/10
              </>
            )}
          </span>
        ) : null}
        {failed.length > 0 && !loading.length && !gen.running && (
          <span role="alert" className="flex flex-wrap items-baseline gap-x-s">
            <span className="text-ink">
              <span aria-hidden className="text-(--error)">
                ✗{" "}
              </span>
              {failed.map((l) => `${members.find((m) => m.id === l.memberId)?.name ?? l.memberId}'s ${INSTRUMENTS[l.instrument].name.toLowerCase()}`).join(", ")}{" "}
              didn&apos;t load, so {failed.length > 1 ? "they play" : "it plays"} silent.
            </span>
            <button type="button" className="text-action" onClick={retryLoads}>
              try again
            </button>
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-m">
        <SaveTake />
        <ShareLink />
      </div>
    </div>
  );
}

/** After the last note, keep recording while the room rings out. */
const TAIL_MS = 1500;
/** A clip that's cut short fades out over this long, rather than stopping mid-note. */
const CLIP_FADE_SEC = 1;

const noChange = () => () => {};

type SaveKind = "audio" | "clip";
type SavePhase = { kind: SaveKind; step: "recording" | "saving" } | { kind: SaveKind; step: "ready"; file: File; link: string | null } | null;

/** Hand a recording over: the share sheet where the browser can share files, else a download. */
function canShareFile(file: File) {
  try {
    return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function download(file: File) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/**
 * Save the take as an audio file, or a short video clip of the stage: it plays from the top and
 * the band is recorded as it plays (the samplers are live, so there's no faster-than-real-time
 * render). The count-in isn't on the file. Stop throws the recording away. Where the browser can
 * share files (phones, mostly) the file goes to the share sheet; elsewhere it downloads.
 */
function SaveTake() {
  const current = useTroop((s) => s.current);
  const running = useTroop((s) => s.gen.running);
  const [phase, setPhase] = useState<SavePhase>(null);
  const [note, setNote] = useState<string | null>(null);
  // known only in the browser, so it's decided after the first render (no hydration mismatch)
  const video = useSyncExternalStore(noChange, canRecordVideo, () => false);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3000);
    return () => clearTimeout(t);
  }, [note]);
  if (!current || (running && !phase)) return null;

  const record = async (kind: SaveKind) => {
    const score = current;
    const st = useTroop.getState();
    if (st.playing) st.stop();
    await st.play(0);
    if (!useTroop.getState().playing) return;
    setPhase({ kind, step: "recording" });
    const link = canShare(score) ? shareUrl(score, location.href) : null;
    let rec: Recording | null = null;
    let painter: ClipPainter | null = null;
    let startedAt = 0;
    let done = false;
    let timer = 0;
    const end = (wait: number) => {
      done = true;
      window.clearInterval(timer);
      offEnded();
      setPhase({ kind, step: "saving" });
      window.setTimeout(async () => {
        const blob = await rec?.stop();
        painter?.stop();
        if (!blob) {
          setPhase(null);
          return setNote("nothing was recorded");
        }
        const file = new File([blob], takeFileName(score.title, blob.type), { type: blob.type });
        if (canShareFile(file)) return setPhase({ kind, step: "ready", file, link });
        setPhase(null);
        download(file);
        setNote("saved");
      }, wait);
    };
    const fail = (text: string) => {
      done = true;
      window.clearInterval(timer);
      offEnded();
      rec?.cancel();
      painter?.stop();
      setPhase(null);
      setNote(text);
    };
    const offEnded = troopAudio.onEnded(() => end(TAIL_MS));
    // start on the downbeat, after the count-in; a stop before the end throws it away
    timer = window.setInterval(() => {
      if (done) return;
      if (!useTroop.getState().playing) return fail("stopped, nothing saved");
      // a hidden tab stops drawing frames, so the video would freeze while the sound went on
      if (kind === "clip" && document.hidden) return fail("the tab was hidden, so the clip stopped");
      if (!rec && troopAudio.getBeat() >= 0) {
        if (kind === "clip") {
          const stage = document.querySelector<HTMLElement>("[data-stage]");
          if (stage) {
            const preset = getPreset(score.settings.preset);
            painter = paintStage(stage, score, () => troopAudio.getBeat(), { footer: preset ? `an homage to ${preset.name}` : "", link: location.host });
            rec = troopAudio.startRecording({ video: painter.stream });
          }
        } else rec = troopAudio.startRecording();
        if (!rec) return fail(kind === "clip" ? "this browser can't record video" : "this browser can't record audio");
        startedAt = performance.now();
      }
      // a clip is the first few seconds: fade, then stop recording (the band plays on)
      if (rec && kind === "clip" && performance.now() - startedAt >= (CLIP_SECONDS - CLIP_FADE_SEC) * 1000) {
        rec.fadeOut(CLIP_FADE_SEC);
        end(CLIP_FADE_SEC * 1000);
      }
    }, 20);
  };

  if (phase?.step === "ready") {
    const { file, link, kind } = phase;
    const share = async () => {
      try {
        await navigator.share({ files: [file], title: `Jamming · ${current.title}`, ...(link ? { text: link } : {}) });
        setPhase(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setNote("couldn't share it");
      }
    };
    return (
      <span className="flex flex-wrap items-baseline gap-x-s text-m">
        <span className="text-ink-soft">{kind === "clip" ? "clip" : "audio"} ready:</span>
        <button type="button" className="text-action" onClick={() => void share()}>
          {note ?? "share it"}
        </button>
        <button
          type="button"
          className="text-action"
          onClick={() => {
            download(file);
            setPhase(null);
          }}
        >
          download
        </button>
        <button type="button" className="text-action" onClick={() => setPhase(null)} aria-label="Discard the recording">
          ×
        </button>
      </span>
    );
  }

  const busy = phase !== null;
  const label = (kind: SaveKind, idle: string) => (phase?.kind !== kind ? idle : phase.step === "recording" ? "recording… (stop to cancel)" : "saving…");
  return (
    <>
      {(!busy || phase.kind === "audio") && (
        <button type="button" className="text-action text-m" disabled={busy} onClick={() => void record("audio")} title="Play the take from the top and save it as an audio file">
          <span aria-live="polite">{label("audio", note ?? "save as audio")}</span>
        </button>
      )}
      {video && (!busy || phase.kind === "clip") && (
        <button
          type="button"
          className="text-action text-m"
          disabled={busy}
          onClick={() => void record("clip")}
          title={`Play the take from the top and save the first ${CLIP_SECONDS} seconds of the stage as a video`}
        >
          <span aria-live="polite">{label("clip", `save a ${CLIP_SECONDS}s clip`)}</span>
        </button>
      )}
    </>
  );
}

/** Copy a link that replays this take (local takes only: they're rebuilt from settings and seed). */
function ShareLink() {
  const current = useTroop((s) => s.current);
  const running = useTroop((s) => s.gen.running);
  // the note belongs to the take it was about, so switching takes clears it
  const [note, setNote] = useState<{ id: string; text: string } | null>(null);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 2500);
    return () => clearTimeout(t);
  }, [note]);
  if (running || !canShare(current)) return null;
  const say = (text: string) => setNote({ id: current.id, text });

  const share = async () => {
    const url = shareUrl(current, location.href);
    try {
      if (navigator.share && matchMedia("(hover: none)").matches) {
        await navigator.share({ title: `Jamming · ${current.title}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      say("link copied");
    } catch (e) {
      if ((e as Error).name !== "AbortError") say("couldn't copy the link");
    }
  };

  return (
    <button type="button" className="text-action text-m" onClick={() => void share()} title="Copy a link that plays this take again">
      <span aria-live="polite">{note?.id === current.id ? note.text : "share this take"}</span>
    </button>
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
              <span className="ml-xxs text-xs text-ink-soft">
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
