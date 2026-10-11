# Improvements, 2026-10-11 (round 1)

Starting from 53690e2 (432 tests), ending at 436. No model calls: the dev server ran with all three keys blanked, so everything here is the local band.

## What I saw

Used the app at 1300 px and 390 px: a first load (the key dialog, then skip), Swing, Bossa Nova and Minimalist sketches, the Jobim, Laufey and Elijah Fox presets, Autumn Leaves and the jazz waltz (3/4), the debug panel, and the art lab's next-glitch on a Minimalist take. I can't hear audio, so I played takes and read the engine's counters (255 notes scheduled, 0 late, 0 dropped) and the master level (peaks −13 to −31 dBFS).

Then I measured, in a throwaway script, every style (6 seeds), every preset (4–6 seeds) and six standards: chord tones on strong beats, register against each instrument's range, same-pitch overlaps, bars of silence, and **true semitone clashes on the beat** (two parts a minor 2nd or minor 9th apart, both sounding).

- Most takes have 0–15 clashes per 1000 onsets. **Elijah Fox had 78**, Glass and Debussy 31 each, and Minimalist 18.
- Elijah Fox: the cello's minimalist pedal held the tonic E under F#maj7, a half step from the chord's own E# (and from the pad's D#), in every other bar. `pedal()` in `patterns/bass.ts` said "tonic pedal unless the chord moves far away" but always held the tonic.
- Debussy and Glass: the ensemble pass that moves held supporting voices off a half step only looked at notes of at least a beat. A quarter played legato is 0.98, so the pad and the piano held G against Ab for whole bars and the pass never saw them.
- **Preset then tune:** Laufey, then Autumn Leaves, switched the chart to swing but kept the preset. The panel read "Jazz-pop with a bossa lilt" over a swing chart, and the Laufey feel played on it. Picking a style already drops the preset; picking a tune in another style didn't.
- Checked and fine: the art lab found no glitches in a whole Minimalist take. The phone layout, the chart at 390 px and a 3/4 tune all looked right. The dev overlay's "1 Issue" was a hydration warning caused by Playwright's screenshot hiding the caret before hydration; a clean reload logs no errors. Laufey's violin resting through the solos is the arrangement (pad, rest, harmony on the out head).

## What I chose, and why

1. **The pedal and the held-beat threshold** (one commit). It's what you'd hear, it's measured, and it's a small change. Over every minimalist preset, pedal notes a half step from a chord tone went from 256 to 0 of 996. Held supporting voices rubbing a half step, all presets: 60 → 18 of about 17k pairs. Clashes per 1000 onsets: Elijah Fox 78 → 47, Glass 31 → 17, Debussy 31 → 20, Minimalist 18 → 9. No style or preset went up. Two tests in `presets.test.ts`, both failing on the old code.
2. **A tune in another style drops the preset** (`setStandard`, store test). A small state bug, but the panel was describing music that wasn't playing.
3. **The rejected "ties across the barline" entry** now says it was about model-written lines, and that a standard's written melody keeps its ties (`melodyBar` already holds them).

## Deferred

- **Elijah Fox's remaining clashes (47 per 1000).** These come from the lead piano's left hand holding the chord's 7th (D#3 under Emaj7) while the bass's octave pulse jumps to E3. The lead is outside the ensemble pass's supporting voices, and a short bass note isn't "held". Fixing it means either a lead-against-bass check in the ensemble, or a left-hand voicing for that feel that doesn't put the 7th in the bass register. That's worth a round of its own, with an ear on it.
- **Jobim's guitar against piano** (32 of 42 clashes in that preset): two compers. "Second chord players complement the first" covered register, not half steps between them.
- **Swing, bossa and baroque bass against piano** (about 10–15 per 1000): mostly passing tones in a walking line against a held comp. That's normal at this density.
- Sound and animation: nothing stood out this round. The animation audit from the last commits is clean on what I looked at, and the mix was measured and left alone two sessions ago.
