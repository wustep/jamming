"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DoodleDefs } from "@/art/DoodleDefs";
import { troopAudio } from "@/audio/engine";
import { BandTalk } from "@/components/BandTalk";
import { BrainsButton, BrainsSheet } from "@/components/BrainsSheet";
import { ControlPanel } from "@/components/ControlPanel";
import { DebugPanel } from "@/components/DebugPanel";
import { KeyDialog } from "@/components/KeyDialog";
import { Listening } from "@/components/Listening";
import { PlayAlong } from "@/components/PlayAlong";
import { Stage } from "@/components/Stage";
import { SavedJams, Takes, Transport } from "@/components/Transport";
import { RoughBox, Squiggle } from "@/components/ui/rough";
import { useScrollMore } from "@/components/ui/scrollMore";
import { useWakeLock } from "@/components/ui/wakeLock";
import { SheetMusic, type SheetStats } from "@/sheet/SheetMusic";
import { useDebug } from "@/state/debug";
import { usePlayAlong } from "@/state/playalong";
import { useTroop } from "@/state/store";

export function Home() {
  const hydrate = useTroop((s) => s.hydrate);
  const score = useTroop((s) => s.current);
  const playing = useTroop((s) => s.playing);
  const playToken = useTroop((s) => s.playToken);
  const play = useTroop((s) => s.play);
  const debugOpen = useDebug((s) => s.open);
  const setDebugOpen = useDebug((s) => s.setOpen);
  const [sheetStats, setSheetStats] = useState<SheetStats | null>(null);
  const [showSheet, setShowSheet] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  useScrollMore(panelRef);
  useWakeLock(playing);

  useEffect(() => {
    hydrate();
    // dev-only handle for automated play-throughs (transport + store)
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __jamming?: unknown }).__jamming = { audio: troopAudio, store: useTroop, debug: useDebug, playAlong: usePlayAlong };
    }
    try {
      if (new URLSearchParams(location.search).has("debug")) setDebugOpen(true);
    } catch {
      /* ignore */
    }
  }, [hydrate, setDebugOpen]);

  const getBeat = useCallback(() => troopAudio.getBeat(), []);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-m pb-xxl pt-m sm:px-l">
      <DoodleDefs />
      <BrainsSheet />
      <KeyDialog />
      <header className="mb-s">
        <div className="flex items-start justify-between gap-s">
          <div className="min-w-0">
            <h1 className="font-brand text-xxl font-heavy">Jamming</h1>
            <Squiggle width={200} seed="title" color="var(--pencil-red)" />
          </div>
          <BrainsButton />
        </div>
      </header>

      {/* Below lg the page is one column, and main's pieces join the grid so the band settings sit
          right under the stage instead of below the whole chart. */}
      <div className="grid gap-l lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="contents min-w-0 lg:block">
          <div className="order-1 min-w-0 lg:order-none">
            <Stage />
            <div className="mt-s">
              <Transport />
            </div>
            <div className="mt-s empty:hidden">
              <PlayAlong />
            </div>
            {debugOpen && <DebugPanel sheetStats={sheetStats} />}
          </div>
          {/* how the take is built, by the stage on a wide screen; on a phone after the band settings */}
          <div className="order-3 min-w-0 lg:order-none lg:mt-l">
            <Listening />
          </div>
          <div className="order-3 grid min-w-0 gap-m md:grid-cols-[minmax(0,1fr)_260px] lg:order-none lg:mt-l">
            <BandTalk />
            <div className="min-w-0 space-y-m">
              <Takes />
              <SavedJams />
            </div>
          </div>
          <section className="order-4 min-w-0 lg:order-none lg:mt-l" aria-label="Sheet music">
            <div className="mb-xs flex items-center gap-xs">
              <h2 className="type-section">Chart</h2>
              {score && (
                <button
                  type="button"
                  className="tap min-h-xl min-w-xl rounded-full text-m text-ink-soft transition-colors duration-(--motion-duration) hover:text-ink"
                  onClick={() => setShowSheet((v) => !v)}
                  aria-expanded={showSheet}
                  aria-label={showSheet ? "Hide the chart" : "Show the chart"}
                  title={showSheet ? "Hide" : "Show"}
                >
                  <span aria-hidden className={`inline-block transition-transform duration-(--motion-duration) ease-small ${showSheet ? "rotate-90" : ""}`}>
                    ▸
                  </span>
                </button>
              )}
            </div>
            {showSheet && score && (
              <RoughBox seed="sheet" rough={{ weight: "m" }} className="sheet-paper p-xs" title="Click a bar to play from there">
                <SheetMusic
                  score={score}
                  getBeat={getBeat}
                  playing={playing}
                  playToken={playToken}
                  onSeekBar={(bar) => void play(bar)}
                  onStats={setSheetStats}
                  className="h-[min(70vh,640px)]"
                />
              </RoughBox>
            )}
          </section>
        </main>
        <div ref={panelRef} className="scroll-more order-2 min-w-0 lg:sticky lg:top-m lg:order-none lg:max-h-[calc(100vh-2*var(--space-m))] lg:self-start lg:overflow-y-auto">
          <ControlPanel />
        </div>
      </div>
      <footer className="mt-xl text-center text-s text-ink-soft max-lg:pb-xl">
        <details
          // clear the phone's fixed transport bar, which the padding below makes room for
          className="group scroll-mb-[calc(var(--space-xxl)+var(--space-xl))]"
          onToggle={(e) => {
            // the credits unfold at the very bottom: bring them up into view
            const el = e.currentTarget;
            if (!el.open) return;
            requestAnimationFrame(() => {
              const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
              el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
            });
          }}
        >
          <summary className="tap text-action inline-flex cursor-pointer list-none items-center">Credits</summary>
          <p className="mx-auto mt-xs max-w-[48rem]">
            Samples: Salamander Grand Piano (Alexander Holm), Splendid Grand, Greg Sullivan’s Wurlitzer and CP80, Smolken double bass, VCSL drums and vibraphone, LinnDrum (LM-2), MusyngKite (harpsichord, organ, string pad and choir included) and FluidR3 soundfonts — via smplr. Notation by VexFlow.
          </p>
        </details>
      </footer>
    </div>
  );
}
