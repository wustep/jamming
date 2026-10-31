# Sounds: sources and licenses

Every sound the band plays is a free sample set, streamed through [smplr](https://github.com/danigb/smplr) (MIT) from the hosts listed below. Nothing is bundled in this repository. The count-in click is the LinnDrum's side-stick. When a pack fails to load, the instrument falls back to the next one in its chain (`packChain` in `src/audio/packs.ts`).

| Sound | Used for | Source | License |
| --- | --- | --- | --- |
| Salamander Grand Piano | piano (default) | Alexander Holm, hosted by [Tone.js](https://tonejs.github.io/audio/salamander/) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| Splendid Grand Piano | piano option, Salamander fallback (its mezzo layer, at every velocity) | Akai, via [sfzinstruments/SplendidGrandPiano](https://github.com/sfzinstruments/SplendidGrandPiano) | Public domain (released by Akai in 2000) |
| Wurlitzer EP200, Yamaha CP80 | piano options (electric) | Greg Sullivan, via [sfzinstruments/GregSullivan.E-Pianos](https://github.com/sfzinstruments/GregSullivan.E-Pianos) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| Acoustic drum kit | drums (default) | Kick, snare, cross-stick, toms, hi-hat, two suspended cymbals (ride and crash), claps, tambourine, cowbell, shaker and congas from the [Versilian Community Sample Library](https://github.com/sgossner/VCSL) (Sam Gossner), hosted at smpldsnds.github.io/sgossner-vcsl; for an ambient drummer, the same cymbals and toms struck with soft mallets, and mallet rolls on the cymbals that swell up and ring away | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| LinnDrum (LM-2) | drum kit option, acoustic kit fallback, count-in click | [smpldsnds/drum-machines](https://github.com/smpldsnds/drum-machines) | Public domain, per that repository |
| Double bass, pizzicato | bass | D. Smolken's 1958 Rubner bass, via [sfzinstruments/dsmolken.double-bass](https://github.com/sfzinstruments/dsmolken.double-bass) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Vibraphone, soft mallets | vibes | [VCSL](https://github.com/sgossner/VCSL) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| MusyngKite soundfont | horns, strings, guitar, pizzicato, fallbacks; the harpsichord (piano option), the drawbar organ, and the string pad's string ensemble and choir | [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| FluidR3 GM soundfont | last-resort fallbacks | [gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/us/) |
| Soundfont loop points | sustained voices (violin, cello, horns, flute, organ, string pad, choir) | Our own for every MusyngKite voice the band holds, found by `scripts/soundfont-loops.py` and served from `public/soundfont-loops/`; [goldst.dev/midi-js-soundfonts](https://goldst.dev/midi-js-soundfonts/), smplr's default source, for the FluidR3 fallbacks (ours for their string ensemble and choir) | Loop offsets only (no audio) |

The credit line at the bottom of the app names each set, which covers the attribution the CC BY sets ask for.

## Levels

The packs differ by up to 16 dB out of the box, so each one is level-matched. "Measure the packs" in the audio lab (`/audio-lab`) bounces each pack playing the same line at the same touch, offline through the engine, and reads its loudness the way a listener hears it (ITU-R BS.1770, `src/audio/loudness.ts`). It measures at a quiet master, under the bus compressor's knee, so packs compare like for like.

- Per-instrument volumes (`DEFAULT_VOLUME`) bring every pack to the grand's loudness on that line, within 1 LU. The drums are matched on a groove.
- The string pad's two voices sit 9 dB apart (`PAD_VOLUME`), and the harpsichord runs 2 dB over Salamander (`HARPSICHORD_VOLUME`).
- Packs that aren't level with their instrument's others carry their own volume (`PackSpec.volume`): the electric pianos (`EPIANO_VOLUME`; at the piano's volume the Wurlitzer runs 9 dB over Salamander, the CP80 7.5 dB) and the Splendid grand (`SPLENDID_VOLUME`, 11 dB over).
- Musical balance is a separate step: `ROLE_MIX` in `src/music/realize.ts` sets each part's touch by its role (the tune on top, the rhythm section under it, counter-lines and pads further under). `measureTake` in `src/audio/levels.ts` (the dev handle `__jamming.levels()` on the main page) bounces a take and each player alone, section by section, to check it.
- VCSL records its drum layers at their natural level: a snare's softest tap peaks 27 dB under its hardest. smplr also scales by velocity, so each layer is trimmed onto one curve, from −13 dBFS for the softest layer up to −1 dBFS for the hardest. The peaks were measured from the decoded samples and are written next to each piece in `ACOUSTIC_KIT` (and `MALLET_KIT`).
- The vibraphone was matched while its sample set still let every note ring for 15 seconds. Once notes let go over half a second (`RELEASE_SEC`), it measured 3 LU under the grand, so it was matched again.

## Soft mallets and cymbal swells

A style can hand its drummer soft mallets (`mallets` in `styles.ts`; ambient does). The cymbals and toms then play VCSL's mallet samples, which sit on kit keys above General MIDI's (`MALLET_KEY`), so no part writes them: the engine swaps them in.

A note marked `roll` on a cymbal is a roll that swells up to the note's end. VCSL recorded mallet crescendos on both cymbals; four of them (`SWELLS`) peak 1.24, 2.26, 3.73 and 6.52 seconds in (measured, smoothed over 100 ms) and then ring away, each trimmed to the same level at its peak. The engine plays the longest one that fits the roll and starts it late enough that its peak lands on the beat the roll leads to, rubato and ritardando included. The LinnDrum, or a kit whose swells didn't load, strikes the cymbal there instead. The chart writes a roll as three slashes through the note, and the drummer on stage plays it as strokes getting louder.

The mallet and swell samples load only for a chart that plays them (`kitKeys`), and only the swells its rolls fit at its tempo (one or two, about 150 KB each), into the kit already playing if the band switches style. The engine picks among the swells that are loaded.

## Held notes

The MIDI.js samples run about three seconds, so a whole note at a slow tempo would cut out. The bowed, blown and held voices load loop points (`SUSTAINED` and `loopSource` in `src/audio/packs.ts`): MusyngKite first, FluidR3 as the fallback, each with its own loops.

The MusyngKite loops are our own. goldst.dev's loop the trumpet over 1.5 to 9 ms (under ten cycles, never a whole number of them) shared across several notes, so every trumpet note held past about half a second turned into a buzz at another pitch (up to three octaves off). Some of its sax and flute loops do the same, and its violin loops step 8 dB every sixth of a second. `scripts/soundfont-loops.py` decodes each note, finds the sustain from the envelope, and picks the loop (0.5 to 1.6 s, late in the sustain, between rising zero crossings) whose ends meet in level and whose waveform carries on across the join. Rerun it (macOS, needs `afconvert`) if a sample set changes; `packs.test.ts` checks every note in each instrument's range has a loop.

## Notation fonts

The chart is engraved by VexFlow in Petaluma and Petaluma Script (Steinberg's handwritten SMuFL fonts, SIL Open Font License 1.1). `public/fonts/petaluma.woff2` and `petaluma-script.woff2` are the files VexFlow 5 bundles, extracted so the page loads `vexflow/core` and these two instead of the full entry's six inlined fonts. If they don't load, the full entry is fetched and the chart falls back to Bravura and Academico.

## Gaps in the hosted sets

The hosted CP80 is missing three oggs (`057-A3-F`, `065-F4-PP`, `080-G#5-MP`), and the Wurlitzer's `ab6mp.ogg` won't decode. smplr plays silence for a region with no sample. The m4a twins aren't a reliable stand-in, because many of them don't decode in Chromium. So `EPIANO_GAPS` fetches the same note one velocity layer over instead.

## Adding a sound

Only add samples with a license that allows free use and redistribution: CC0, public domain, CC BY or CC BY-SA. Add the set to this table and to the credit line in `src/app/page.tsx`. Level-match it against the pack it sits beside before you make it a default.
