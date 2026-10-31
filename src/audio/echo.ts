import type { InstrumentId, StyleId } from "@/music/types";

// A tempo-synced delay, the post-rock guitar's other half: every note comes back a dotted 8th
// later, softer and darker each time, so a picked chord smears into a wash and a held melody
// note answers itself. It's a send like the reverb (the repeats go into the room too), and only
// the styles that want it send anything: in swing it would just be mud.

/** How much of each instrument goes to the delay, by style (nothing for anyone else). */
export const ECHO_SEND: Partial<Record<StyleId, Partial<Record<InstrumentId, number>>>> = {
  postrock: { guitar: 0.55, vibes: 0.35, piano: 0.3, organ: 0.2, violin: 0.22, cello: 0.18, trumpet: 0.2, flute: 0.22, clarinet: 0.18, sax: 0.15 },
};

/** The repeat: a dotted 8th (three quarters of a beat), the time The Edge and EITS live on. */
export const ECHO_BEATS = 0.75;
/** Each repeat's level relative to the last (about five audible repeats). */
export const ECHO_FEEDBACK = 0.42;
/** The repeats lose their top and bottom (a tape or analog delay), so they sit behind the note. */
export const ECHO_LOWPASS_HZ = 2800;
export const ECHO_HIGHPASS_HZ = 220;
/** The longest repeat the delay line can hold (a dotted 8th at 40 bpm). */
export const ECHO_MAX_SEC = 1.2;

/** An instrument's send to the delay in a style (0: none). */
export function echoSend(style: StyleId | undefined, instrument: InstrumentId): number {
  return (style && ECHO_SEND[style]?.[instrument]) ?? 0;
}

/** The delay time for a tempo, in seconds (a dotted 8th, held inside what the delay line can hold). */
export function echoSeconds(spb: number): number {
  return Math.min(ECHO_MAX_SEC, Math.max(0.05, spb * ECHO_BEATS));
}

export interface EchoBus {
  /** Where the instruments send to (smplr's addEffect takes `{ input }`). */
  input: GainNode;
  delay: DelayNode;
}

/**
 * The delay line: input → delay → (darker) → out, and back into the delay through the feedback.
 * The output goes to `dry` (the master) and `wet` (the reverb), so the repeats sit in the room.
 */
export function makeEchoBus(ctx: BaseAudioContext, dry: AudioNode, wet: AudioNode | null): EchoBus {
  const input = ctx.createGain();
  const delay = ctx.createDelay(ECHO_MAX_SEC + 0.1);
  delay.delayTime.value = echoSeconds(0.6);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = ECHO_HIGHPASS_HZ;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = ECHO_LOWPASS_HZ;
  const feedback = ctx.createGain();
  feedback.gain.value = ECHO_FEEDBACK;
  input.connect(delay);
  delay.connect(hp).connect(lp);
  lp.connect(feedback).connect(delay);
  lp.connect(dry);
  if (wet) {
    // the repeats go to the room at half level (all of them, and the wash turns to fog)
    const room = ctx.createGain();
    room.gain.value = 0.5;
    lp.connect(room).connect(wet);
  }
  return { input, delay };
}
