"use client";

import { useEffect, useRef } from "react";
import { INSTRUMENT_LIST, INSTRUMENTS } from "@/music/instruments";
import { typingLabel, typingPitch } from "@/music/live";
import { pitchName } from "@/music/theory";
import { liveCore, usePlayAlong } from "@/state/playalong";
import { RoughBox, RoughButton } from "./ui/rough";

// The play-along panel: say what's plugged in (or why nothing can be), pick what you play,
// and play it: a MIDI keyboard or pad, the on-screen keys, or the computer keyboard.

const BLACK = new Set([1, 3, 6, 8, 10]);
/** Keys drawn: two octaves and a C on a wide screen, one octave and a fourth (the typing keys) on a phone. */
const KEYS_WIDE = 25;
const KEYS_NARROW = 18;

/** The typing keyboard: while the panel is open, A–K play, Z and X change octave. */
function useTypingKeys(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const down = new Map<string, number>();
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return e.metaKey || e.ctrlKey || e.altKey || !!t?.closest("input, textarea, select, [contenteditable]");
    };
    const onDown = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (e.code === "KeyZ" || e.code === "KeyX") {
        if (!e.repeat) usePlayAlong.getState().shiftOctave(e.code === "KeyZ" ? -1 : 1);
        e.preventDefault();
        return;
      }
      const pitch = typingPitch(e.code, usePlayAlong.getState().typingBase);
      if (pitch === null) return;
      e.preventDefault();
      if (e.repeat || down.has(e.code)) return;
      down.set(e.code, pitch);
      liveCore().noteOn(pitch, 0.75, e.timeStamp || performance.now());
    };
    const onUp = (e: KeyboardEvent) => {
      const pitch = down.get(e.code);
      if (pitch === undefined) return;
      down.delete(e.code);
      liveCore().noteOff(pitch, e.timeStamp || performance.now());
    };
    // a key held while the window loses focus never sends its keyup
    const onBlur = () => {
      for (const p of down.values()) liveCore().noteOff(p, performance.now());
      down.clear();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      onBlur();
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [open]);
}

/** Keys to press with a finger or the mouse; they also light up under a MIDI keyboard and the typing keys. */
function LiveKeys() {
  const base = usePlayAlong((s) => s.typingBase);
  const held = usePlayAlong((s) => s.held);
  const shiftOctave = usePlayAlong((s) => s.shiftOctave);
  const pressed = useRef(new Map<number, number>()); // pointer → pitch
  const heldSet = new Set(held);
  const keys = Array.from({ length: KEYS_WIDE }, (_, i) => base + i);
  const whites = keys.filter((p) => !BLACK.has(p % 12));

  const press = (pointer: number, pitch: number, t: number) => {
    const was = pressed.current.get(pointer);
    if (was === pitch) return;
    if (was !== undefined) liveCore().noteOff(was, t);
    pressed.current.set(pointer, pitch);
    liveCore().noteOn(pitch, 0.75, t);
  };
  const lift = (pointer: number, t: number) => {
    const was = pressed.current.get(pointer);
    if (was === undefined) return;
    pressed.current.delete(pointer);
    liveCore().noteOff(was, t);
  };
  const pitchAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const p = el?.closest<HTMLElement>("[data-pitch]")?.dataset.pitch;
    return p === undefined ? null : Number(p);
  };

  return (
    <div className="flex items-stretch gap-xxs">
      <button type="button" className="pick shrink-0 px-xxs text-l text-ink-soft" onClick={() => shiftOctave(-1)} aria-label="Octave down" title="Octave down (Z)">
        ‹
      </button>
      <div
        className="live-keys relative h-28 min-w-0 flex-1 touch-none select-none"
        role="group"
        aria-label={`Keys from ${pitchName(base)}`}
        onPointerDown={(e) => {
          const p = pitchAt(e.clientX, e.clientY);
          if (p === null) return;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          press(e.pointerId, p, e.timeStamp);
        }}
        // slide along the keys (a glissando), as on a real keyboard
        onPointerMove={(e) => {
          if (!pressed.current.has(e.pointerId)) return;
          const p = pitchAt(e.clientX, e.clientY);
          if (p !== null) press(e.pointerId, p, e.timeStamp);
        }}
        onPointerUp={(e) => lift(e.pointerId, e.timeStamp)}
        onPointerCancel={(e) => lift(e.pointerId, e.timeStamp)}
      >
        <div className="flex h-full">
          {whites.map((p) => (
            <div
              key={p}
              data-pitch={p}
              data-held={heldSet.has(p) || undefined}
              // past the typing keys, a phone gets no more keys than fit a thumb
              className={`live-key live-key-white relative flex flex-1 items-end justify-center pb-xxs text-xs text-ink-soft ${p - base >= KEYS_NARROW ? "max-sm:hidden" : ""}`}
            >
              <span aria-hidden>{typingLabel(p - base) ?? ""}</span>
            </div>
          ))}
        </div>
        {keys
          .filter((p) => BLACK.has(p % 12))
          .map((p) => {
            const left = whites.filter((w) => w < p).length;
            return (
              <div
                key={p}
                data-pitch={p}
                data-held={heldSet.has(p) || undefined}
                className={`live-key live-key-black absolute top-0 flex h-[60%] items-end justify-center pb-xxs text-xxs ${p - base >= KEYS_NARROW ? "max-sm:hidden" : ""}`}
                style={{ left: `calc(${left} * var(--white-w) - var(--black-w) / 2)` }}
              >
                <span aria-hidden>{typingLabel(p - base) ?? ""}</span>
              </div>
            );
          })}
      </div>
      <button type="button" className="pick shrink-0 px-xxs text-l text-ink-soft" onClick={() => shiftOctave(1)} aria-label="Octave up" title="Octave up (X)">
        ›
      </button>
    </div>
  );
}

function MidiStatusLine() {
  const midi = usePlayAlong((s) => s.midi);
  const inputs = usePlayAlong((s) => s.inputs);
  const connect = usePlayAlong((s) => s.connectMidi);
  if (midi === "unsupported")
    return (
      <p className="text-s">
        <b>No MIDI in this browser</b> (Safari and iPhone don&rsquo;t have it). Play the keys below, or type: the A–K row is the white keys. To plug in a keyboard, open this page in Chrome, Edge or Firefox on a computer.
      </p>
    );
  if (midi === "asking") return <p className="text-s text-ink-soft">Asking the browser to let the page hear MIDI…</p>;
  if (midi === "denied")
    return (
      <p className="text-s">
        <span aria-hidden className="text-(--error)">✗ </span>
        The browser said no to MIDI. Allow it in the site settings (the icon left of the address), then{" "}
        <button type="button" className="text-action" onClick={() => void connect()}>
          try again
        </button>
        . The keys below work either way.
      </p>
    );
  if (midi === "ready" && inputs.length)
    return (
      <p className="text-s">
        <span aria-hidden className="text-(--success)">✓ </span>
        Listening to <b>{inputs.map((i) => i.name).join(", ")}</b>
      </p>
    );
  if (midi === "ready") return <p className="text-s text-ink-soft">Plug in a MIDI keyboard or pad and it&rsquo;ll show up here. Until then, the keys below (or A–K on your keyboard).</p>;
  return (
    <p className="text-s text-ink-soft">
      <button type="button" className="text-action" onClick={() => void connect()}>
        listen for a MIDI keyboard
      </button>
    </p>
  );
}

export function PlayAlong() {
  const open = usePlayAlong((s) => s.open);
  const setOpen = usePlayAlong((s) => s.setOpen);
  const instrument = usePlayAlong((s) => s.instrument);
  const setInstrument = usePlayAlong((s) => s.setInstrument);
  const quantize = usePlayAlong((s) => s.quantize);
  const setQuantize = usePlayAlong((s) => s.setQuantize);
  const cr = usePlayAlong((s) => s.callResponse);
  const setCr = usePlayAlong((s) => s.setCallResponse);
  const loading = usePlayAlong((s) => s.loading);
  const loadError = usePlayAlong((s) => s.loadError);
  useTypingKeys(open);

  if (!open)
    return (
      <button type="button" className="text-action text-m" onClick={() => setOpen(true)} aria-expanded={false}>
        play along with the band
      </button>
    );

  return (
    <RoughBox seed="play-along" rough={{ weight: "m" }} className="panel-paper p-s" as="section" aria-label="Play along">
      <div className="mb-xs flex items-baseline justify-between gap-s">
        <h2 className="type-label">Play along</h2>
        <button type="button" className="text-action text-s" onClick={() => setOpen(false)} aria-expanded>
          put it down
        </button>
      </div>
      <MidiStatusLine />
      <div className="mt-xs flex flex-wrap items-center gap-x-m gap-y-xs">
        <label className="flex items-baseline gap-xs text-s">
          <span className="text-ink-soft">You play</span>
          <select className="sketch-select" value={instrument} onChange={(e) => setInstrument(e.target.value as typeof instrument)} aria-label="Your instrument">
            {INSTRUMENT_LIST.map((id) => (
              <option key={id} value={id}>
                {INSTRUMENTS[id].name}
              </option>
            ))}
          </select>
          {loading && <span className="text-xs text-ink-soft">tuning up…</span>}
          {loadError && (
            <span className="text-xs">
              <span aria-hidden className="text-(--error)">✗ </span>
              wouldn&rsquo;t load
            </span>
          )}
        </label>
        <div className="flex items-center gap-xxs text-s">
          <span className="text-ink-soft" id="pa-grid">
            Snap to the beat
          </span>
          <div role="group" aria-labelledby="pa-grid" className="flex gap-xxs">
            <RoughButton seed="pa-q-off" active={quantize === "off"} onClick={() => setQuantize("off")} className="px-xs py-xxs text-s" title="Your notes land exactly where you play them">
              off
            </RoughButton>
            <RoughButton seed="pa-q-light" active={quantize === "light"} onClick={() => setQuantize("light")} className="px-xs py-xxs text-s" title="Nudges each note halfway to the nearest 8th">
              a little
            </RoughButton>
          </div>
        </div>
        <div className="flex items-center gap-xxs text-s">
          <RoughButton
            seed="pa-cr"
            active={cr.on}
            onClick={() => setCr({ on: !cr.on })}
            className="px-xs py-xxs text-s"
            title="The band leaves you a few bars, then the soloist answers with what you played"
          >
            call and response
          </RoughButton>
          {cr.on && (
            <div role="group" aria-label="Bars per turn" className="flex gap-xxs">
              {[2, 4].map((n) => (
                <RoughButton key={n} seed={`pa-every-${n}`} active={cr.every === n} onClick={() => setCr({ every: n })} className="px-xs py-xxs text-s">
                  {n} bars
                </RoughButton>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-s">
        <LiveKeys />
      </div>
      <p className="mt-xxs text-xs text-ink-soft max-sm:hidden">
        Typing: A S D F G H J K are the white keys, W E T Y U O P the black ones; Z and X move an octave.
        {cr.on && " With call and response, play in the bars marked “your turn”; the band answers in the next ones."}
      </p>
      {cr.on && <p className="mt-xxs text-xs text-ink-soft sm:hidden">Play in the bars marked “your turn”; the band answers in the next ones.</p>}
    </RoughBox>
  );
}
