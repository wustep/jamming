# Improvements, 2026-10-11 (round 3)

Starting from 04cc346 (round 2's branch, 439 tests), ending at 442. Real model calls: one Composer take of Summertime (32 bars, best of 1) with Claude Haiku 4.5 for both roles, through the server's Anthropic key only: three calls, 7.5k input and 1.6k output tokens, about $0.02. Everything else used the dev-only `mock` key or no key.

## What I saw

Used the parts of the app the first two rounds didn't: Composer mode (mock, best of 2, then real), the takes list and replaying a saved take, a share-link check, the mix readouts during a real take, and the takes list at 390 px. Then measured every standard's head against the band.

- **The takes list labels a take by its style, not its tune.** Three Blue Bossa jams and a Summertime take read "Bossa Nova · jammed" ×3 and "Swing · composed", so you couldn't tell which was which. Sketches ("Swing sketch") and shared takes had the same problem.
- **Comping under held melody notes.** Over all 50 standards with a written melody, 71 of 2,444 melody notes had a bandmate (always the piano) a half step or a minor 9th against them. Caravan had the most (14): the tune holds a Bb for nine beats over C7, and the piano kept striking the chord's A3 under it. The ensemble pass that keeps comping off the tune only heard melody notes struck in the same bar or the next, and standards tie long notes across barlines.
- **The director's concept was cut mid-word in band talk:** "…the piano soloist transforms the motif through inversions and displa". It was sliced at 200 characters before the speech trimming saw it, and the judge's summary had the same cap.
- Checked and fine: Composer mode (mock first sound at 1.5 s; real Haiku about 28 s, since plan and parts run one after the other by design); a real take scheduled 150 notes with 0 late and 0 dropped, master peaks −14 to −21 dBFS; replaying a saved take; no horizontal overflow at 390 px. Model takes have no share link, which is a rejected item, so I left it alone.

## What I chose, and why

1. **Takes named by the tune** (`tuneOf` in store.ts): small, but it's the list people pick takes from. Covers sketches, jams, compositions and shared takes. Store test.
2. **Comping hears melody notes held over from up to four bars back** (ensemble pass 2): this is what you'd hear on every standard's head. Clashes against written melodies: 71 → 26 of 2,444 (Caravan 14 → 0, Blue Bossa 7 → 1, Solar 5 → 0, Freddie 5 → 0). What's left is mostly the tune's own passing tones against the chord, which a real accompanist plays through. Comping under a held-over melody note: 45 rubs → 0 (new test). Styles and presets are unchanged, except one extra rub in six Ray Charles takes. Generation time is unchanged.
3. **The director's concept and the judge's summary end on a whole word or sentence.** One line each, with a pipeline test that fails on the old cut.

## Deferred

- The rest of the head clashes: Ode to Joy (10) and Watermelon Man (6) are the melody's passing tones against the prelude arpeggio or the comp. Thinning the accompaniment under a written passing tone could work, but it's a taste call best made by ear.
- Composer first sound (about 28 s on Haiku): the plan has to come first. Streaming the plan, or starting the rhythm section on the intro while the parts are written, would be its own round.
- When you replay an old take, the settings panel doesn't match it. That's a rejected item, so left as is.
- The art lab preset mode from round 2 still shares the stage with the default band's other instruments.
