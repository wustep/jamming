"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimalPortrait } from "@/art/AnimalPortrait";
import { troopAudio } from "@/audio/engine";
import { sectionAt } from "@/music/form";
import { barsText, changesIn, jamGuide, list, takeIdea, techniqueAt, type Technique } from "@/music/teach";
import type { Score } from "@/music/types";
import { usePlayAlong } from "@/state/playalong";
import { useTroop } from "@/state/store";

/**
 * The bar the band is playing (-1 when stopped or counting in), and the beat in it where what
 * someone's doing last changed (a drummer's fill starting; 0 otherwise). Updated only when either
 * moves on.
 */
function usePlayingMoment(score: Score | null, playing: boolean): { bar: number; beat: number } {
  const [moment, setMoment] = useState({ bar: -1, beat: 0 });
  useEffect(() => {
    if (!score || !playing) return;
    let raf = 0;
    let last = "";
    const beats = score.frame.meter.beats;
    const changes = Array.from({ length: score.frame.bars }, (_, b) => changesIn(score, b));
    const loop = () => {
      const beat = troopAudio.isPlaying() ? troopAudio.getBeat() : -Infinity;
      const b = Number.isFinite(beat) && beat >= 0 ? Math.min(score.frame.bars - 1, Math.floor(beat / beats)) : -1;
      const at = b < 0 ? 0 : (changes[b] ?? []).reduce((x, c) => (beat - b * beats >= c - 1e-6 ? c : x), 0);
      if (`${b}:${at}` !== last) {
        last = `${b}:${at}`;
        setMoment({ bar: b, beat: at });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setMoment({ bar: -1, beat: 0 });
    };
  }, [score, playing]);
  return score && playing ? moment : { bar: -1, beat: 0 };
}

const span = (from: number, to: number) => (from === to ? `bar ${from}` : `bars ${from}–${to}`);

/** One player's line: who, the technique by name, and what it is (the take's idea in highlighter). */
function PlayerLine({ animal, name, techniques, muted, idea }: { animal: Parameters<typeof AnimalPortrait>[0]["animal"]; name: string; techniques: Technique[]; muted: boolean; idea?: string }) {
  return (
    <li className="flex gap-xs">
      {/* a fixed slot, so names line up whatever the animal's shape */}
      <span className="flex w-6 shrink-0 justify-center">
        <AnimalPortrait animal={animal} size={24} />
      </span>
      <div className="min-w-0 text-m">
        <span className="font-heavy">{name}</span>
        <span className="text-ink-soft"> · </span>
        {muted ? (
          <span className="text-ink-soft">muted</span>
        ) : (
          <>
            <span className="font-heavy text-(--color-3)">
              {techniques.map((x, i) => (
                <span key={`${x.id}:${i}`}>
                  {i > 0 && " → "}
                  <span className={idea && (x.id === idea || x.covers?.includes(idea)) ? "rounded-xs bg-(--color-2-transparent) px-xxs text-ink" : undefined}>{x.name}</span>
                </span>
              ))}
            </span>
            <div className="text-s text-ink-soft">{techniques.map((x) => x.what).join(" ")}</div>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * How the take is put together, section by section, and what each player is doing in it: one
 * named technique a player, read off the plan (teach.ts). While the band plays, the section being
 * played opens and follows the bar; stopped, any section can be opened to read it, or played.
 */
export function Listening() {
  const current = useTroop((s) => s.current);
  const playing = useTroop((s) => s.playing);
  const muted = useTroop((s) => s.muted);
  const play = useTroop((s) => s.play);
  const arranged = usePlayAlong((s) => s.arranged);
  // playing along in call and response, the band plays the chart with room left for you
  const score = playing && arranged && current && arranged.id === current.id ? arranged : current;
  const { bar, beat } = usePlayingMoment(score, playing);
  const guide = useMemo(() => (score ? jamGuide(score) : []), [score]);
  const idea = useMemo(() => (current ? takeIdea(current) : null), [current]);
  // the section opened to read, for this take (a new take opens on its head)
  const [picked, setPicked] = useState<{ take: string; i: number } | null>(null);

  if (!score || !guide.length) return null;
  const live = bar >= 0 ? guide.findIndex((g) => g.section === sectionAt(score.frame, bar)) : -1;
  const firstTune = Math.max(0, guide.findIndex((g) => g.section.kind === "head"));
  const open = live >= 0 ? live : picked?.take === score.id ? picked.i : firstTune;

  return (
    <section aria-labelledby="listening-heading">
      <h2 id="listening-heading" className="type-section mb-xs">
        How it’s built
      </h2>
      {idea && (
        // one idea to learn from this take: what it's called, who plays it, where, and a way to hear it
        <div className="mb-s flex items-start gap-xxs">
          <p className="min-w-0 flex-1 px-xs text-m">
            <span className="type-label mr-xs">Listen for</span>
            <span className="rounded-xs bg-(--color-2-transparent) px-xxs font-heavy">{idea.technique.name}</span>
            <span className="text-ink-soft">
              {" "}
              · {list(idea.who)}, {barsText(idea.bars)}
            </span>
            <span className="block text-s text-ink-soft">
              {idea.technique.what} {idea.who.length === 1 ? `${idea.who[0]}’s name tag lights up when it comes.` : "Their name tags light up when it comes."}
            </span>
          </p>
          <button
            type="button"
            className="tap min-h-xl min-w-xl shrink-0 text-m text-ink-soft transition-colors duration-(--motion-duration) hover:text-(--color-4)"
            // from the bar before, so you hear what it grows out of
            onClick={() => void play(Math.max(0, idea.bars[0] - 2))}
            aria-label={`Play from just before bar ${idea.bars[0]}: ${idea.technique.name}`}
            title={`Play from bar ${Math.max(1, idea.bars[0] - 1)}`}
          >
            ▶
          </button>
        </div>
      )}
      <ol className="space-y-xxs">
        {guide.map((g, i) => {
          const isOpen = i === open;
          const isLive = i === live;
          return (
            <li key={g.section.start}>
              <div className="flex items-start gap-xxs">
                <button
                  type="button"
                  className="pick grid min-w-0 flex-1 items-baseline gap-x-xs px-xs py-xxs text-left text-m sm:grid-cols-[4.75rem_minmax(0,1fr)]"
                  data-selected={isOpen}
                  aria-expanded={isOpen}
                  aria-current={isLive ? "step" : undefined}
                  // listening already: go there; stopped: open it to read
                  onClick={() => (playing ? void play(g.section.start) : setPicked({ take: score.id, i }))}
                  title={playing ? `Jump to ${span(g.from, g.to)}` : undefined}
                >
                  {/* the bars: a column of their own on a wide screen, after the name on a phone */}
                  <span className="hidden text-s tabular-nums text-ink-soft sm:inline">{span(g.from, g.to)}</span>
                  <span className="min-w-0">
                    <span className="type-label mr-xs">{g.section.name}</span>
                    <span className="mr-xs text-s tabular-nums text-ink-soft sm:hidden">{span(g.from, g.to)}</span>
                    <span className="block sm:inline">{g.what}</span>
                    {g.moves.length > 0 && <span className="block text-s text-ink-soft">Listen for: {g.moves.join(", ")}</span>}
                  </span>
                </button>
                <button
                  type="button"
                  className="tap min-h-xl min-w-xl shrink-0 text-m text-ink-soft transition-colors duration-(--motion-duration) hover:text-(--color-4)"
                  onClick={() => void play(g.section.start)}
                  aria-label={`Play from bar ${g.from}: ${g.section.name}`}
                  title={`Play from bar ${g.from}`}
                >
                  ▶
                </button>
              </div>
              {isOpen && (
                <ul className="mb-xs ml-xs mt-xxs space-y-xxs pl-xs shadow-[inset_var(--border-m)_0_0_0_var(--neutral-5)]" aria-label={isLive ? `What each player is doing in bar ${bar + 1}` : `What each player does in ${g.section.name}`}>
                  {score.members.map((m) => {
                    const steps = isLive ? [techniqueAt(score, m.id, bar, beat)] : (g.players.find((p) => p.id === m.id)?.steps ?? []);
                    // the final chord is part of every ending: not worth a line of its own
                    const shown = steps.length > 1 ? steps.filter((x) => x.id !== "end") : steps;
                    return <PlayerLine key={m.id} animal={m.animal} name={m.name} techniques={shown} muted={muted.includes(m.id)} idea={idea?.technique.id} />;
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
