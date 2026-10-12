import { parseMidi, type MidiMessage } from "@/music/live";

// Web MIDI, kept to what playing along needs: ask for access, listen to every keyboard or pad
// that's plugged in (and ones plugged in later), and hand on parsed note messages with the
// time they were played. Typed loosely so a simulated device can stand in (tests, Playwright).

export interface MidiInputLike {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  state?: string;
  onmidimessage: ((e: { data: Uint8Array | null; timeStamp?: number }) => void) | null;
}

export interface MidiAccessLike {
  inputs: { forEach(cb: (input: MidiInputLike, key: string) => void): void };
  onstatechange: ((e: unknown) => void) | null;
}

export type MidiAvailability = "unsupported" | "denied" | MidiAccessLike;

/** Does this browser have Web MIDI at all (Safari and iOS don't)? */
export function hasWebMidi(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.requestMIDIAccess === "function";
}

/** Ask for MIDI (the browser may show a permission prompt). Never throws. */
export async function requestMidi(): Promise<MidiAvailability> {
  if (!hasWebMidi()) return "unsupported";
  try {
    // the real MIDIAccess is a wider type than the slice used here
    return (await navigator.requestMIDIAccess({ sysex: false })) as unknown as MidiAccessLike;
  } catch {
    return "denied";
  }
}

export interface MidiInputInfo {
  id: string;
  name: string;
}

/**
 * Listen to every MIDI input, now and as devices come and go. `onMessage` gets each note
 * message with the performance-clock time it was played; `onInputs` the connected devices
 * whenever that changes. Returns a function that stops listening.
 */
export function listenToMidi(
  access: MidiAccessLike,
  onMessage: (msg: MidiMessage, timeStamp: number, input: MidiInputInfo) => void,
  onInputs: (inputs: MidiInputInfo[]) => void,
): () => void {
  let attached: MidiInputLike[] = [];
  const attach = () => {
    for (const input of attached) input.onmidimessage = null;
    attached = [];
    const infos: MidiInputInfo[] = [];
    access.inputs.forEach((input) => {
      if (input.state === "disconnected") return;
      const info = { id: input.id, name: input.name || input.manufacturer || "MIDI keyboard" };
      infos.push(info);
      // setting the handler opens the port
      input.onmidimessage = (e) => {
        const msg = parseMidi(e.data);
        if (!msg) return;
        const t = e.timeStamp && e.timeStamp > 0 ? e.timeStamp : typeof performance !== "undefined" ? performance.now() : 0;
        onMessage(msg, t, info);
      };
      attached.push(input);
    });
    onInputs(infos);
  };
  attach();
  access.onstatechange = () => attach();
  return () => {
    access.onstatechange = null;
    for (const input of attached) input.onmidimessage = null;
    attached = [];
  };
}
