// The band explains itself. What each player is doing in a bar, named the way a musician would
// name it (walking bass, comping, stop-time, call and response), and how the whole take is put
// together, section by section. Read straight off the frame and the plan, like narrate.ts, so
// the words always match the music.

import { sectionAt } from "./form";
import { DYNAMIC_ENERGY } from "./context";
import { DRUM, INSTRUMENTS } from "./instruments";
import { PEDAL_DRIVE } from "./patterns/bass";
import { postrockStage, type PostrockStage } from "./patterns/drums";
import { feelOf } from "./playing";
import { hashString } from "./rng";
import type { DrumMove, NoteEvent, Role, Score, Section, StyleId } from "./types";

export interface Technique {
  /** Stable key, e.g. "walk", "comp", "stoptime". Consecutive bars with the same id are one passage. */
  id: string;
  /** The name a musician would use, short enough for a name tag: "walking bass". */
  name: string;
  /** One plain sentence: what it is, so you know what to listen for. */
  what: string;
  /**
   * The word for a name tag on stage, when it should stay put for longer than the technique
   * does: a soloist's inversion, then sequence, then run, is all "solo".
   */
  tag?: string;
  /** The techniques a folded step stands for (a section's fills, told as one). */
  covers?: string[];
}

const t = (id: string, name: string, what: string, tag?: string): Technique => ({ id, name, what, ...(tag ? { tag } : {}) });

/** A trading turn's length in words: "four bars". */
const turnLength = (n = 2) => `${["one", "two", "three", "four", "five", "six", "seven", "eight"][n - 1] ?? n} bar${n === 1 ? "" : "s"}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ─── Vocabulary ──────────────────────────────────────────────────────────────

const LAYING_OUT = t("rest", "laying out", "Not playing for now. Leaving space is part of the arrangement.");
const LAST_CHORD = t("end", "last chord", "Everyone lands on the final chord together.");

/** The drummer's time, by style: what you'd hear them called on a gig. */
const GROOVES: Record<StyleId, Technique> = {
  swing: t("ride", "ride pattern", "“Ding, ding-a, ding-a” on the ride cymbal, the hi-hat clicking on 2 and 4: the swing pulse everyone locks to."),
  bossa: t("bossa-groove", "bossa groove", "A cross-stick click plays the clave rhythm over whispered hi-hat 8ths."),
  funk: t("pocket", "the pocket", "Hi-hat 16ths, a hard snare on 2 and 4 and quiet ghost notes between: the funk pocket."),
  pop: t("backbeat", "backbeat", "Kick on 1, snare on 2 and 4: the beat you clap along to."),
  neworleans: t("street-beat", "street beat", "A marching snare full of rolls, from New Orleans street parades."),
  minimal: t("pulse", "steady pulse", "Shaker 16ths that never change: the grid the patterns turn over."),
  baroque: t("timpani", "low drum on 1 and 3", "A low drum marking the strong beats, the way timpani do in an orchestra."),
  ambient: t("swells", "cymbal swells", "Soft mallets roll on a cymbal so it swells up into the next chord: colour and air, not time."),
  postrock: t("swells", "cymbal swells", "Mallets rolled on a cymbal, swelling into the next phrase: no beat yet."),
};
/** A post-rock drummer climbs with the band: what they're playing at each stage of the build. */
const POSTROCK_DRUMS: Record<PostrockStage, Technique> = {
  swells: GROOVES.postrock,
  toms: t("tom-build", "tom build", "Floor tom and kick, a pulse rather than a beat: the band is starting to climb."),
  halftime: t("half-time", "half-time", "Ride 8ths and the snare on 3: the beat arrives, held back."),
  drive: t("drive", "driving beat", "Ride 8ths and a backbeat, the kick pushing: the band in full flight."),
  crest: t("crest", "the crest", "Crashes on every 8th and the kick on every beat: the top of the climb."),
  roll: t("snare-roll", "snare roll", "A snare roll swelling from a whisper into the crest."),
};
/**
 * A drummer's fills and rolls, by name: what each sounds like (when and why it comes is added
 * where it's played, see `drumMove`). The patterns mark the notes they write with these names.
 */
const DRUM_MOVES: Record<DrumMove, Technique> = {
  run: t("tom-run", "tom run", "A run from the snare down the toms, high to low, getting louder."),
  setup: t("set-up", "set-up", "A crack on the snare and a kick just before the one."),
  drag: t("drag", "drag", "Soft grace strokes into one hard crack on the snare: a drummer's rudiment."),
  toms: t("tom-fill", "tom fill", "Floor tom and kick on the beat, the snare answering in between."),
  press: t("press-roll", "press roll", "The sticks pressed into the snare so they buzz, swelling up to one accent."),
  ghosts: t("ghost-fill", "ghost-note fill", "Whispered 16ths on the snare, then one hard crack."),
  hats: t("open-hat", "open hi-hat", "The hi-hat opens on the last “and” while the snare snaps."),
  rim: t("rim-pickup", "cross-stick pickup", "Two quiet clicks on the rim: a bossa drummer's fill is a whisper."),
  roll: t("snare-roll", "snare roll", "A snare roll swelling from a whisper to a crack."),
  ring: t("cymbal-roll", "cymbal roll", "A crash on the last chord, then a roll on the cymbal swelling under it until the band cuts off."),
};
/** How a fill reads after "Fills where the phrases end:". */
const MOVE_GLOSS: Record<DrumMove, string> = {
  run: "a run down the toms",
  setup: "a set-up (a snare crack and a kick just before the one)",
  drag: "a drag (soft grace strokes into a snare crack)",
  toms: "a tom fill",
  press: "a press roll (the snare buzzing up to an accent)",
  ghosts: "a ghost-note fill (whispered 16ths, then a crack)",
  hats: "an open hi-hat on the last “and”",
  rim: "a cross-stick pickup",
  roll: "a snare roll",
  ring: "a cymbal roll under the last chord",
};
/** A drum fill written into a model's own grid: it has no name of its own. */
const WRITTEN_FILL = t("drum-fill", "fill", "A burst on the snare and toms at the end of the bar.");

const SNARE_BUILD = t("snare-build", "snare build", "The snare in 8ths, then 16ths, louder and louder: the drummer lifting the band into the last chorus.");
/** A swing drummer keeps the head on the closed hi-hat and moves to the ride for the solos. */
const HAT_TIME = t("hat-time", "hi-hat time", "Swung time on the closed hi-hat, tighter and quieter than the ride the drummer saves for the solos.");

const ARTIST_DRUMS: Record<string, Technique> = {
  brushes: t("brushes", "brushes", "A wire brush swirled on the snare, the hi-hat on 2 and 4: soft, whispering time."),
  son: t("clave", "clave", "The 2–3 son clave on the rim, with cowbell and conga: the rhythm every other part fits around."),
  afrobeat: t("afrobeat", "afrobeat groove", "Busy hi-hats, and a snare that dances around the backbeat instead of sitting on it."),
};

const BASS: Record<string, Technique> = {
  walk: t("walk", "walking bass", "A note on every beat, walking from one chord to the next."),
  two: t("two", "two-feel", "Two notes a bar, mostly root and fifth: a relaxed, bouncing bottom."),
  bossa: t("bossa-bass", "bossa bass", "Root on 1, fifth on the “and” of 2, often landing on the next chord early."),
  funk: t("funk-bass", "funk bass", "A syncopated riff that lands hard on the one, with octave pops and ghosted notes."),
  baroque: t("continuo-bass", "basso continuo", "A steady line of 8ths moving by step: the foundation the harmony stands on."),
  pedal: t("pedal", "pedal point", "One low note held under the changing chords."),
  pump: t("pump", "pumping 8ths", "Steady 8th notes on the root, driving the song forward."),
};

const PEDAL_8THS = t("pedal-8ths", "driving pedal", "The tonic struck again and again in 8ths under the moving chords: the engine of the crest.");

const ARTIST_BASS: Record<string, Technique> = {
  sowhat: t("sowhat-bass", "the riff", "The bass states the riff; the piano answers it with two chords."),
  tumbao: t("tumbao", "tumbao", "The Cuban bass pattern: it pushes ahead on the “and” of 2 and on 4, and skips the one."),
  afro: t("afro-bass", "bass riff", "A short riff on repeat, locked with the kick drum."),
  chameleon: t("riff-bass", "bass riff", "A two-bar riff on repeat: the hook the whole band sits on."),
  two: BASS.two,
};

/** The comping, by style: how a chordal player accompanies. */
const COMP: Record<StyleId, Technique> = {
  swing: t("comp", "comping", "Short chords off the beat that answer the tune rather than cover it."),
  bossa: t("bossa-comp", "bossa comping", "Soft chords on a two-bar syncopated rhythm, pushed just ahead of the beat."),
  funk: t("stabs", "stabs", "Short, choppy chords on the off-beats, with lots of space between."),
  pop: t("block", "block chords", "Full chords right on the beat, holding the song steady."),
  neworleans: t("stride", "stride", "The left hand jumps: a bass note on 1 and 3, a chord on 2 and 4."),
  minimal: t("arp", "arpeggio pattern", "One broken-chord pattern on repeat while the harmony shifts slowly under it."),
  baroque: t("prelude", "broken chords", "A broken-chord figure repeated bar after bar, like a Bach prelude."),
  ambient: t("pad", "pad", "Long, soft chords that hold the harmony like a cloud."),
  postrock: t("wash", "delay wash", "Open chords picked a string at a time through a delay, so the notes blur into a shimmering wash."),
};

const CHORDAL: Record<string, Technique> = {
  pulse: COMP.pop,
  stride: COMP.neworleans,
  arp: COMP.minimal,
  prelude: COMP.baroque,
  continuo: t("continuo", "continuo", "Chords filled in over the bass line, the way a harpsichord accompanies."),
  pad: COMP.ambient,
  wash: COMP.postrock,
  shimmer: t("shimmer", "shimmer", "High, soft repeated notes that make the chord glow."),
  hits: t("hits", "hits", "Short accented chords together with the drums."),
  pizz: t("pizz", "pizzicato", "Plucked strings: short, dry chords under the music."),
  arco: t("arco", "bowed pad", "Long bowed notes holding the harmony."),
};

const ARTIST_COMP: Record<string, Technique> = {
  amen: t("sowhat-chords", "“So What” chords", "Two chords answering the bass riff, the second a step lower: “so what”."),
  montuno: t("montuno", "montuno", "A looping, syncopated figure in octaves that leans into the next chord."),
  clav: t("clav", "clavinet funk", "Percussive 16th-note chord chops, Stevie Wonder style."),
  afro: t("interlock", "interlocking riffs", "Short guitar and keys patterns that fit together like gears."),
  guaraldi: t("ostinato", "rolling ostinato", "A bouncy left-hand figure repeated under the tune."),
  satie: t("sway", "bass and chord", "A low note, then a soft chord: a slow, gentle sway."),
  einaudi: t("broken", "broken chords", "Chords rippling up and down one note at a time."),
  frahm: t("repeated", "repeated-note pulse", "One note repeated in a steady pulse while the harmony moves beneath it."),
  sakamoto: t("bells", "pentatonic bells", "High, bell-like patterns from a five-note scale."),
  waltz: t("waltz", "waltz", "Bass note on 1, chord on 2 and 3: oom-pah-pah."),
};

const SUPPORT: Record<string, Technique> = {
  guide: t("guide", "guide tones", "Long notes on each chord's 3rd and 7th, the notes that tell you which chord it is."),
  harmony: t("harmony", "harmony line", "The tune's own line, a third underneath it."),
  canon: t("canon", "canon", "The tune again a little behind, like a round."),
  riff: t("riff", "riff", "A short figure repeated behind the tune."),
  counter: t("counter", "countermelody", "A second melody that moves when the tune holds still."),
  fill: t("fills", "fills", "Short answers in the gaps between the tune's phrases."),
  pad: t("pad", "pad", "Long held notes under the tune."),
  arp: COMP.minimal,
};
const POLYPHONY = t("polyphony", "counterline", "Its own line weaving around the tune at the same time: New Orleans polyphony.");
const SHOUT = t("shout", "shout riff", "The horns riff together behind the soloist to lift the last bars.");
const BACKING_RIFF = t("backing-riff", "backing riff", "A riff behind the soloist, so the band keeps talking while they play.");

/** How a phrase reworks the motif, by its transform (the tag is set by who plays it). */
const MOTIF: Record<string, Technique> = {
  state: t("motif", "the motif", "The short idea the whole jam grows from. Listen for it again in the solos."),
  invert: t("invert", "inversion", "The motif upside down: where it went up, it goes down."),
  retro: t("retro", "retrograde", "The motif played backwards."),
  up: t("sequence", "sequence", "The motif's shape again, starting higher."),
  down: t("sequence", "sequence", "The motif's shape again, starting lower."),
  seq: t("sequence", "sequence", "The motif repeated a step lower each time."),
  frag: t("fragment", "fragment", "Just the first few notes of the motif, worked over."),
  add: t("additive", "additive process", "The motif built up a note at a time: its first notes on repeat, one more each time round."),
  aug: t("augment", "augmentation", "The motif stretched out to twice as slow."),
  dim: t("diminish", "diminution", "The motif at double speed."),
  displace: t("displace", "displacement", "The same notes, shifted off the beat."),
  ornament: t("ornament", "ornaments", "The motif with turns and grace notes added."),
  rhythm: t("rhythm", "new rhythm", "The motif's notes in a new rhythm."),
};

const LINE: Record<string, Technique> = {
  sparse: t("space", "space", "A few notes, then silence: room to breathe."),
  dense: t("build", "building", "More notes, climbing toward the peak."),
  run: t("runs", "runs", "Fast runs up and down the scale."),
  plain: t("improv", "improvising", "Making up a line over the chord changes, landing on chord tones."),
};
const ANSWER = t("answer", "call and response", "Picks up the last soloist's phrase and answers it.", "answering");

const TUNE = t("tune", "the tune", "The melody: this is the song.");
const HEAD_AGAIN = t("tune-again", "the tune", "The melody again, just as it went the first time: that's how a tune comes back.");
const PICKUP = t("pickup", "pickup", "A few notes before the downbeat that lead into the tune.", "the tune");
const TAG_LINE = t("tag", "tag", "Short phrases over the turnaround, again and again before the last chord.");

const STOPTIME = t("stoptime", "stop-time", "Everyone hits the one together, then stops: the soloist fills the gap alone.");
const BREAKDOWN = t("breakdown", "breakdown", "Just bass and drums: the groove stripped bare under the soloist.");
const DRUM_SOLO = t("drum-solo", "drum solo", "The drummer's turn to play the melody, on the kit.");

/** A section as it reads in a sentence: "the head", "Bruno's solo". */
function sectionNoun(s: Section, name: (id: string) => string): string {
  const who = s.featured?.[0];
  switch (s.kind) {
    case "solo":
      return who ? `${name(who)}'s solo` : "the solo";
    case "trade":
      return "the trading";
    case "out":
      return "the tune's return";
    case "head":
      return "the tune";
    default:
      return `the ${s.kind}`;
  }
}

/** How a jam's sections are built: a sentence each, with the players in it. */
function sectionWhat(score: Score, s: Section, name: (id: string) => string): string {
  const who = s.featured?.[0];
  switch (s.kind) {
    case "intro": {
      // a layered intro: who comes in when, in the order they do
      const entries = new Map<number, string[]>();
      for (const m of score.members) {
        if (INSTRUMENTS[m.instrument].fn === "melodic" && score.plan[s.start + s.length - 1]?.roles[m.id] === "rest") continue;
        const b = Array.from({ length: s.length }, (_, i) => s.start + i).find((b) => (score.plan[b]?.roles[m.id] ?? "rest") !== "rest");
        if (b !== undefined) entries.set(b, [...(entries.get(b) ?? []), m.name]);
      }
      if (entries.size > 1) {
        const order = [...entries.entries()].sort(([a], [b]) => a - b).map(([, who]) => list(who));
        return `The groove is built one layer at a time: ${order[0]} first, then ${order.slice(1).join(", then ")}.`;
      }
      return "The rhythm section sets up the groove and the key before the tune comes in.";
    }
    case "head":
      return `${name(who ?? score.frame.leaderId)} plays the tune; everyone else frames it.`;
    case "solo":
      return who ? `${name(who)} makes up a solo over the same chords, starting from the motif.` : "A solo over the same chords.";
    case "trade": {
      const f = s.featured ?? [];
      const drums = f[f.length - 1];
      const horns = f.slice(0, -1).map(name);
      return `${horns.join(" and ")} and ${drums ? name(drums) : "the drums"} take turns, ${turnLength(s.turn)} each: call and response.`;
    }
    case "out":
      return "The tune comes back, to take it home.";
    case "tag":
      return "The last few bars again, and again, before the final chord.";
    case "vamp":
      return "One groove on repeat.";
  }
}

// ─── Reading the plan ────────────────────────────────────────────────────────

const directiveOf = (score: Score, id: string, bar: number) => (score.plan[bar]?.directives?.[id] ?? "").trim();

function parse(d: string): { name: string; args: string[] } {
  if (!d.startsWith("@")) return { name: "", args: [] };
  const [head, ...args] = d.slice(1).split(/\s+/);
  return { name: (head ?? "").toLowerCase(), args };
}

/** Comping that falls through to the style's own: what a directive name means for a chordal player. */
const COMP_NAMES = new Set(["comp", "pulse", "pump", "stride", "arp", "prelude", "continuo", "pad", "shimmer", "wash", "bossa", "funk", "groove"]);
const BASS_NAMES = new Set(["walk", "two", "bossa", "funk", "baroque", "pedal", "pump"]);

/** What a role means when the plan holds written notes (a model's bar) rather than a directive. */
const BY_ROLE: Record<Role, Technique> = {
  lead: TUNE,
  solo: LINE.plain,
  comp: t("comp", "comping", "Chords under the tune, in rhythm."),
  bass: t("bass-line", "bass line", "The low notes the harmony stands on."),
  groove: t("time", "keeping time", "The beat everyone else locks to."),
  counter: SUPPORT.counter,
  pad: SUPPORT.pad,
  fill: SUPPORT.fill,
  trade: t("trade", "trading", "A short turn, answered by the next player: call and response."),
  rest: LAYING_OUT,
};

// ─── Fills and rolls ─────────────────────────────────────────────────────────

const TOMS = new Set<number>([DRUM.highTom, DRUM.midTom, DRUM.floorTom, DRUM.lowTom, 41, 48]);

/** A player's notes that start in a bar, in beats from its downbeat. */
function barNotes(score: Score, id: string, bar: number): NoteEvent[] {
  const beats = score.frame.meter.beats;
  const from = bar * beats;
  return (score.parts[id] ?? []).filter((n) => n.start >= from - 1e-6 && n.start < from + beats - 1e-6).map((n) => ({ ...n, start: n.start - from }));
}

/**
 * A fill in a drum grid a model wrote, which carries no name: two or more tom strokes, or a run of
 * four snare strokes a 16th apart, in the bar's last two beats. Where it starts, or null.
 */
function writtenFill(notes: NoteEvent[], beats: number): number | null {
  const late = notes.filter((n) => n.start >= beats - 2 - 1e-6).sort((a, b) => a.start - b.start);
  const toms = late.filter((n) => TOMS.has(n.pitch));
  if (toms.length >= 2) return toms[0].start;
  const snare = late.filter((n) => n.pitch === DRUM.snare);
  for (let i = 0; i + 3 < snare.length; i++) if (snare[i + 3].start - snare[i].start <= 0.75 + 1e-6) return snare[i].start;
  return null;
}

/** The drummer's fill or roll in a bar, if there is one: which, and the beat of the bar it starts on. */
export function drumMoveAt(score: Score, id: string, bar: number): { move: DrumMove | null; from: number } | null {
  const member = score.members.find((m) => m.id === id);
  if (member?.instrument !== "drums") return null;
  const notes = barNotes(score, id, bar);
  const marked = notes.filter((n) => n.move);
  if (marked.length) return { move: marked[0].move!, from: Math.min(...marked.map((n) => n.start)) };
  // a grid the model wrote (anything that isn't an @directive)
  const d = directiveOf(score, id, bar);
  if (!d || d.startsWith("@")) return null;
  const from = writtenFill(notes, score.frame.meter.beats);
  return from === null ? null : { move: null, from };
}

/** The beats inside a bar where some player's technique changes mid-bar (a fill starting), in order. */
export function changesIn(score: Score, bar: number): number[] {
  const at = score.members.map((m) => drumMoveAt(score, m.id, bar)?.from).filter((x): x is number => x !== undefined && x > 1e-6);
  return [...new Set(at)].sort((a, b) => a - b);
}

/**
 * A fill or roll by name, with when and why it comes: at the end of a phrase it kicks the band
 * into the next one; at the end of a section it leads the band into what comes next.
 */
function drumMove(score: Score, move: DrumMove | null, bar: number): Technique {
  const base = move ? DRUM_MOVES[move] : WRITTEN_FILL;
  if (move === "ring") return base;
  const frame = score.frame;
  const sec = sectionAt(frame, bar);
  const next = sec.start + sec.length === bar + 1 ? frame.sections.find((s) => s.start === bar + 1) : undefined;
  const name = (id: string) => score.members.find((m) => m.id === id)?.name ?? id;
  const why = next ? `It closes ${sectionNoun(sec, name)} and leads the band into ${sectionNoun(next, name)}.` : "It ends the phrase, so the band hears the next one coming.";
  return { ...base, what: `${base.what} ${why}` };
}

/**
 * What a player is doing in a bar, by name. Arrangement textures come first (in stop-time the
 * pianist's chord is a hit on the one, not comping), then the directive the plan gave them, read
 * in the style's and the artist's own vocabulary. Given a beat of the bar, a drummer's fill or
 * roll is named from where it starts (the rest of the bar is their time); without one, the bar
 * is read as a whole and a fill is left to `drumMoveAt`.
 */
export function techniqueAt(score: Score, id: string, bar: number, beat?: number): Technique {
  const frame = score.frame;
  const bp = score.plan[bar];
  const member = score.members.find((m) => m.id === id);
  if (!bp || !member) return LAYING_OUT;
  const inst = INSTRUMENTS[member.instrument];
  const role = bp.roles[id] ?? "rest";
  const sec = sectionAt(frame, bar);
  const d = directiveOf(score, id, bar);
  const { name, args } = parse(d);
  const style = frame.style;
  const sig = feelOf({ style, feel: frame.feel }).sig;
  const featured = role === "lead" || role === "solo" || role === "trade";
  // as realize.ts reads it: a cellist covering the bass chair plays the bass's part
  const fn = member.instrument === "drums" ? "rhythm" : role === "bass" ? "bass" : inst.fn;

  // the song's pickup into the head, played from a bar the leader otherwise sits out
  if (name === "tune" && args[0] === "pickup") return PICKUP;
  if (role === "rest" || name === "rest") {
    if (sec.kind === "trade") return t("rest", "laying out", "Sitting out while the others trade.");
    if (sec.kind === "intro") return t("rest", "waiting", "Comes in a little later, once the intro has set up the groove.");
    return LAYING_OUT;
  }
  // the cymbal roll under a big last chord, and a fill once it has started
  const move = fn === "rhythm" && !featured ? drumMoveAt(score, id, bar) : null;
  if (move?.move === "ring") return drumMove(score, "ring", bar);
  if (name === "end") return LAST_CHORD;
  if (move && beat !== undefined && beat >= move.from - 1e-6) return drumMove(score, move.move, bar);

  // arrangement textures change who plays, not how (realize.ts `arrange`)
  if (!featured && bar < frame.bars - 1) {
    if (bp.texture === "stoptime") return fn === "melodic" ? LAYING_OUT : STOPTIME;
    if (bp.texture === "breakdown") return fn === "chordal" || fn === "melodic" ? t("rest", "laying out", "Sitting out the breakdown: only bass and drums play.") : BREAKDOWN;
  }

  if (role === "lead") {
    if (sec.kind === "tag" && name === "line") return TAG_LINE;
    if (name === "tune") return TUNE;
    if (name === "head") return HEAD_AGAIN;
    if (name === "motif") return { ...motifTechnique(args, true), tag: "the tune" };
    if (name === "line") return t("phrase", "rounding off", "A longer phrase that answers the motif and closes the four bars.", "the tune");
    return TUNE;
  }
  if (role === "solo") {
    if (sec.kind === "trade") return t("trading", `trading ${sec.turn ?? 2}s`, `${cap(turnLength(sec.turn))}, then the drums answer: call and response.`);
    if (name === "answer") return ANSWER;
    const solo = (x: Technique) => ({ ...x, tag: "solo" });
    if (name === "motif") return solo(motifTechnique(args, false));
    if (name === "line") return solo(LINE[args.find((a) => a in LINE) ?? "plain"] ?? LINE.plain);
    return fn === "rhythm" ? DRUM_SOLO : solo(LINE.plain);
  }
  if (role === "trade") return t("drum-break", "drum break", `The band lays out and the drummer answers with ${turnLength(sec.turn)} alone.`);

  if (fn === "rhythm") {
    if (name === "fill") return move ? drumMove(score, move.move, bar) : t("drum-fill", "fill", "A short burst that kicks the band into the next phrase.");
    if (name === "solo") return DRUM_SOLO;
    if (name === "hits") return CHORDAL.hits;
    if (args.includes("build")) return SNARE_BUILD;
    if (sig?.drums && ARTIST_DRUMS[sig.drums]) return ARTIST_DRUMS[sig.drums];
    if (style === "swing" && (sec.kind === "intro" || sec.kind === "head") && !args.includes("peak")) return HAT_TIME;
    if (style === "postrock" && (name === "groove" || !name)) return POSTROCK_DRUMS[postrockStage(DYNAMIC_ENERGY[bp.dynamic], bp.texture, args)];
    return name === "groove" || !name ? GROOVES[style] : BY_ROLE.groove;
  }

  if (fn === "bass") {
    if (sig?.bass && BASS_NAMES.has(name)) {
      const own = ARTIST_BASS[sig.bass];
      const arranged = ["intro", "head", "out", "vamp", "tag"].includes(sec.kind);
      if (own && (sig.bass !== "sowhat" || (arranged && frame.meter.beats === 4))) return own;
    }
    if (name === "pizz") return CHORDAL.pizz;
    if (name === "pedal" && style === "postrock" && DYNAMIC_ENERGY[bp.dynamic] >= PEDAL_DRIVE) return PEDAL_8THS;
    return BASS[name] ?? BY_ROLE.bass;
  }

  if (fn === "chordal") {
    // the string machine holds the harmony whatever the comping figure would have been
    if (member.instrument === "pad" && name !== "hits") return COMP.ambient;
    if (sig?.comp && COMP_NAMES.has(name)) {
      const own = ARTIST_COMP[sig.comp];
      const twoHanded = member.instrument === "piano" || member.instrument === "organ";
      const firstComper = score.members.find((m) => INSTRUMENTS[m.instrument].fn === "chordal" && m.instrument !== "pad" && !["lead", "solo"].includes(bp.roles[m.id] ?? ""))?.id === id;
      const arranged = ["intro", "head", "out", "vamp", "tag"].includes(sec.kind);
      const plays =
        sig.comp === "amen" ? arranged && frame.meter.beats === 4 && firstComper : sig.comp === "einaudi" ? twoHanded : true;
      if (own && plays) return own;
    }
    if (name === "comp" || name === "bossa" || name === "funk") return COMP[style];
    return CHORDAL[name] ?? BY_ROLE.comp;
  }

  // melodic players in support
  if (name === "riff" && sec.kind === "solo") return style === "neworleans" ? BACKING_RIFF : SHOUT;
  if (name === "counter" && style === "neworleans") return POLYPHONY;
  if (name === "pizz" || name === "arco") return CHORDAL[name];
  return SUPPORT[name] ?? BY_ROLE[role] ?? LAYING_OUT;
}

function motifTechnique(args: string[], lead: boolean): Technique {
  const op = args.find((a) => a in MOTIF && a !== "state");
  if (!op) return lead ? MOTIF.state : t("motif", "the motif", "The motif from the head, quoted in the solo.");
  return MOTIF[op];
}

// ─── The whole take ──────────────────────────────────────────────────────────

/** One player across a section: each passage of the same technique, in order. */
export interface PlayerPart {
  id: string;
  name: string;
  /** Passages in order; a soloist's are folded into one, opening with how the solo starts. */
  steps: Technique[];
}

export interface SectionGuide {
  section: Section;
  /** 1-based bars, inclusive. */
  from: number;
  to: number;
  what: string;
  players: PlayerPart[];
  /** Arrangement moves worth listening for in this section, by name. */
  moves: string[];
}

/** Techniques that make a section what it is, worth calling out on the outline. */
const MOVES = new Set(["two", "walk", "stoptime", "breakdown", "shout", "backing-riff", "answer", "trading", "drum-break", "canon", "polyphony", "pickup", "tag", "sowhat-chords", "montuno", "tumbao", "clave"]);

export function jamGuide(score: Score): SectionGuide[] {
  const name = (id: string) => score.members.find((m) => m.id === id)?.name ?? id;
  return score.frame.sections.map((section) => {
    const end = Math.min(score.frame.bars, section.start + section.length);
    const moves: string[] = [];
    const move = (x: string) => !moves.includes(x) && moves.push(x);
    const next = score.frame.sections.find((s) => s.start === end);
    const players: PlayerPart[] = score.members.map((m) => {
      const steps: Technique[] = [];
      // the tune and a solo are each one story, told over the section: folded into one step
      const told: Technique[] = [];
      const folds = (role: Role | undefined) => (role === "solo" && section.kind === "solo") || (role === "lead" && (section.kind === "head" || section.kind === "out"));
      // a drummer's fills, folded into one step where the first one comes
      const fills: (DrumMove | null)[] = [];
      let into: Technique | null = null;
      for (let b = section.start; b < end; b++) {
        const role = score.plan[b]?.roles[m.id];
        const tech = techniqueAt(score, m.id, b);
        if (folds(role)) {
          if (!told.length) steps.push(t(role === "solo" ? "solo" : "tune", role === "solo" ? "solo" : "the tune", ""));
          told.push(tech);
          continue;
        }
        const fill = role === "trade" || role === "solo" ? null : drumMoveAt(score, m.id, b);
        if (fill && fill.move !== "ring") {
          if (!fills.length) steps.push(t("fills", "", ""));
          if (!fills.includes(fill.move)) fills.push(fill.move);
          if (b === end - 1 && next) into = fill.move ? DRUM_MOVES[fill.move] : WRITTEN_FILL;
          // a bar the plan asked to be a fill is all fill
          if (tech.id === WRITTEN_FILL.id || Object.values(DRUM_MOVES).some((x) => x.id === tech.id)) continue;
        }
        // each technique once, in the order it first comes (trading goes back and forth)
        if (!steps.some((x) => x.id === tech.id)) steps.push(tech);
        if (MOVES.has(tech.id)) move(tech.name);
      }
      const story = steps.find((s) => !s.what && s.id !== "fills");
      if (story) {
        story.what = story.id === "solo" ? soloStory(told) : tuneStory(told);
        if (story.id === "solo" && OPENERS[told[0]?.id]) move(told[0].name);
      }
      const fillStep = steps.find((s) => s.id === "fills");
      if (fillStep) {
        const glosses = fills.map((f) => (f ? MOVE_GLOSS[f] : "a fill"));
        const kinds = fills.map((f) => (f ? DRUM_MOVES[f] : WRITTEN_FILL));
        // one or two kinds by name ("press roll and tom run"); more are just "fills"
        fillStep.name = kinds.length <= 2 ? list(kinds.map((x) => x.name)) : "fills";
        fillStep.covers = kinds.map((x) => x.id);
        const last = into && next ? `; the last one leads into ${sectionNoun(next, name)}` : "";
        fillStep.what = `Where a phrase ends: ${list(glosses)}. A fill tells the band the next phrase is coming${last}.`;
        if (into && next) move(`${into.name} into ${sectionNoun(next, name)}`);
      }
      return { id: m.id, name: m.name, steps };
    });
    // a layered intro: a rhythm player who waits, then comes in
    const rhythm = (id: string) => INSTRUMENTS[score.members.find((m) => m.id === id)?.instrument ?? "piano"].fn !== "melodic";
    if (section.kind === "intro" && players.some((p) => rhythm(p.id) && p.steps.length > 1 && p.steps[0].id === "rest")) moves.unshift("layered intro");
    // walking bass is the default in swing: it's worth naming only where the two-feel gives way to it
    const walkOnly = moves.includes("walking bass") && !moves.includes("two-feel");
    return {
      section,
      from: section.start + 1,
      to: end,
      what: sectionWhat(score, section, name),
      players,
      moves: walkOnly ? moves.filter((x) => x !== "walking bass") : moves,
    };
  });
}

/** How a solo can open, in words that name the technique. */
const OPENERS: Record<string, string> = {
  answer: "answering the last soloist (call and response)",
  motif: "the motif from the head",
  invert: "the motif upside down (inversion)",
  retro: "the motif backwards (retrograde)",
  sequence: "the motif's shape moved to a new step (sequence)",
  fragment: "a fragment of the motif",
  augment: "the motif stretched out (augmentation)",
  diminish: "the motif at double speed (diminution)",
  displace: "the motif shifted off the beat (displacement)",
  ornament: "the motif dressed up with ornaments",
  rhythm: "the motif's notes in a new rhythm",
};

function soloStory(bars: Technique[]): string {
  if (bars[0]?.id === DRUM_SOLO.id) return DRUM_SOLO.what;
  const open = OPENERS[bars[0]?.id ?? ""];
  const builds = bars.some((x) => x.id === "build");
  const close = builds ? "then makes up lines over the changes, building to the end." : "then makes up lines over the changes.";
  return open ? `Opens with ${open}, ${close}` : `Makes up lines over the changes${builds ? ", building to the end" : ""}.`;
}

function tuneStory(bars: Technique[]): string {
  if (bars.some((x) => x.id === "tune")) return TUNE.what;
  if (!bars.some((x) => x.id === "motif")) return HEAD_AGAIN.what;
  const reworked = [...new Set(bars.filter((x) => MOTIF_IDS.has(x.id) && x.id !== "motif").map((x) => ARTICLE[x.id] ?? x.name))];
  const rounded = bars.some((x) => x.id === "phrase");
  return `Built from the motif: stated${reworked.length ? `, answered with ${list(reworked)}` : ""}${rounded ? ", then rounded off with a longer phrase" : ""}.`;
}

/** A motif technique as it reads after "answered with". */
const ARTICLE: Record<string, string> = {
  invert: "an inversion",
  retro: "the motif backwards",
  sequence: "a sequence",
  fragment: "a fragment",
  augment: "augmentation",
  diminish: "diminution",
  displace: "displacement",
  ornament: "ornaments",
  rhythm: "a new rhythm",
};

const MOTIF_IDS = new Set(Object.values(MOTIF).map((x) => x.id));
/** Words in a list the way they're said: "a, b and c". */
export const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);


// ─── One idea per take ───────────────────────────────────────────────────────

/**
 * What a newcomer could learn from each style, most telling first: the techniques that make it
 * sound like itself (technique ids, as above).
 */
const STYLE_IDEAS: Record<StyleId, string[]> = {
  swing: ["walk", "ride", "comp", "two", "stoptime", "hat-time", "guide", "trading", "set-up", "drag", "shout"],
  bossa: ["bossa-bass", "bossa-groove", "bossa-comp", "rim-pickup", "counter"],
  funk: ["pocket", "funk-bass", "stabs", "breakdown", "ghost-fill", "open-hat"],
  pop: ["backbeat", "block", "snare-build", "pump", "set-up", "breakdown"],
  neworleans: ["polyphony", "street-beat", "press-roll", "stride", "two", "stoptime", "backing-riff"],
  minimal: ["additive", "arp", "pulse", "displace", "canon"],
  baroque: ["continuo-bass", "prelude", "continuo", "canon", "timpani"],
  ambient: ["swells", "pad", "pedal", "shimmer", "augment"],
  postrock: ["wash", "tom-build", "crest", "snare-roll", "pedal", "half-time", "pedal-8ths"],
};
/** An artist's own figures say the most about how they play: they come first. */
const SIGNATURE_IDEAS = ["sowhat-chords", "sowhat-bass", "montuno", "tumbao", "clave", "brushes", "afrobeat", "afro-bass", "interlock", "clav", "riff-bass", "ostinato", "sway", "broken", "repeated", "bells", "waltz"];
/** Ideas any take can teach once the style's own are heard: how the motif is worked, how the band talks. */
const SHARED_IDEAS = ["answer", "invert", "sequence", "retro", "augment", "fragment", "displace", "trading", "counter", "harmony", "canon", "guide"];
/** How many of the most telling ideas a take chooses from, so the next take teaches another. */
const IDEA_CHOICE = 4;

export interface TakeIdea {
  technique: Technique;
  /** Who plays it, in the band's order. */
  who: string[];
  /** The bars it's heard in, 1-based. */
  bars: number[];
}

/**
 * The one idea a take is good for learning: a technique its style is known by that the band
 * really plays in it, with who plays it and in which bars. Takes of a style take turns (by seed)
 * among its few most telling ideas, so a newcomer hears something new in the next take.
 */
export function takeIdea(score: Score): TakeIdea | null {
  const heard = new Map<string, { technique: Technique; who: Set<string>; bars: Set<number> }>();
  const hear = (x: Technique, who: string, bar: number) => {
    const h = heard.get(x.id) ?? heard.set(x.id, { technique: x, who: new Set(), bars: new Set() }).get(x.id)!;
    h.who.add(who);
    h.bars.add(bar);
  };
  for (const m of score.members) {
    for (let bar = 0; bar < score.frame.bars; bar++) {
      hear(techniqueAt(score, m.id, bar), m.name, bar);
      const role = score.plan[bar]?.roles[m.id];
      const fill = role === "solo" || role === "trade" ? null : drumMoveAt(score, m.id, bar);
      if (fill?.move && fill.move !== "ring") hear(DRUM_MOVES[fill.move], m.name, bar);
    }
  }
  const order = [...new Set([...SIGNATURE_IDEAS, ...STYLE_IDEAS[score.frame.style], ...SHARED_IDEAS])].filter((id) => heard.has(id));
  if (!order.length) return null;
  const { technique, who, bars } = heard.get(order[hashString(`${score.settings.seed}:idea`) % Math.min(IDEA_CHOICE, order.length)])!;
  // a fill is heard where phrases end: say so, since its own words only say how it sounds
  const fill = Object.values(DRUM_MOVES).some((x) => x.id === technique.id);
  return {
    technique: fill ? { ...technique, what: `${technique.what} A drummer plays it where a phrase ends, to tell the band the next one is coming.` } : technique,
    who: score.members.filter((m) => who.has(m.name)).map((m) => m.name),
    bars: [...bars].sort((a, b) => a - b).map((b) => b + 1),
  };
}

/** Bars as a reader counts them: "bar 4", "bars 9–24", "bars 4, 12 and 16–18". */
export function barsText(bars: number[]): string {
  const runs: [number, number][] = [];
  for (const b of bars) {
    const last = runs[runs.length - 1];
    if (last && b === last[1] + 1) last[1] = b;
    else runs.push([b, b]);
  }
  const words = runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`));
  return `${bars.length === 1 ? "bar" : "bars"} ${list(words)}`;
}
