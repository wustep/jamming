# Improvements, 2026-10-11 (round 4)

Starting from 1b434b1 (main with rounds 1–3 merged, 442 tests), ending at 444. Real model calls went through the server's Anthropic key only, and the key never reached the browser, a log or a screenshot. The planned call was one Composer take of a Jobim original (16 bars, best of 1, Haiku 4.5 for both roles): three calls, 7.6k input and 1.5k output tokens, about $0.015. By mistake I also ran four 16-bar Improviser jams on the keyed server while making takes-list screenshots. I meant those to be local sketches. They used Sonnet 5.5 and Haiku 4.5: about 256k input and 18k output tokens, roughly $0.40 at list price. Everything else used the dev-only `mock` key or no key.

## What I saw

Fresh look at desktop and 390 px. Playwright's browser runs at 90% zoom here, so a 390 px window lays out 433 CSS px wide. A "390 px" check needs a 351 px window; at a true 390 px there's no overflow. I tried Swing, Funk (Improviser and Composer on mock), the Count Basie, Ray Charles, Hans Zimmer and Jobim presets, the debug panel, and one real Composer take. Then I re-ran the clash sweep (8 styles and 10 presets, 6 seeds × 32 bars each, plus all 50 standards) with a wider measure: every onset struck a half step or a minor 9th from a note still sounding, not only notes on the beat.

- **Jobim's two compers** were deferred in rounds 1 and 2, and they're still the preset's main rub: 44 of 46. The piano anticipates the next chord on an off-beat (G13 with its 7th, F4) and holds it; the guitar then strikes its own voicing with the 13th (E4) under it. Or the guitar comps against the soloing piano's left-hand chord. Neither note is held a full beat against the other, so pass 4 (sustained voices) never heard it.
- **Stale band talk while a take is being thought up.** The stage bubbles and band talk fell back to the loaded take's lines whenever the new run had none yet. Composing after a jam, the last jam's "Got it, boss." sat over every player, and its whole conversation filled band talk, until the director's first line (about 22 s on a real Haiku take).
- **Preset takes were listed by style.** A Count Basie take and a plain swing take both read "Swing sketch", and Ray Charles read "New Orleans sketch". This follows on from round 3's tune names.
- Checked and fine: 0 late and 0 dropped notes on every take played (Swing 137 notes, Basie, Ray, Zimmer, Jobim 115, the real Composer take 110), master peaks −14 to −38 dBFS. The real Composer take's concept and director's notes ended on whole words (round 3). The mix was measured in 2026-10-09-3 and left for someone with ears, so I left it alone again.

## What I chose, and why

1. **Ensemble pass 6: a comping chord isn't struck a half step against a note another player is still holding** (struck before it, or struck with it by that bar's soloist). The later chord leaves the note out when it has three or more notes, which is what a second comper does, or moves it to the nearest free chord tone. It only touches chordal comp and pad roles, never a line or a written note. Rubbing onsets: Jobim 46 → 3, Basie 104 → 67, Glass 58 → 34, Funk 61 → 50, Ray 138 → 122, Debussy 42 → 37, Laufey 42 → 38, Elijah Fox 4 → 0, the 50 standards 139 → 107. Nothing went up. Jobim keeps 3- and 4-note guitar chords and loses 34 of about 4,300 notes. A presets test fails on the old code (84 of 9,945 chords) and allows the 4 left, Debussy's vibes where no free note is near. Generation time is unchanged, and the rig audit passes (the guitar strums what's there).
2. **A run in progress shows only its own talk** (Stage, BandTalk). Bubbles stay empty and band talk says "the band is huddling…" until the run's first line. A take played meanwhile still shows its own lines at their bars.
3. **An original played like an artist is named for the artist** ("Count Basie sketch", "Jobim · composed"). A standard is still named by its tune. Store test. This also puts `reconcile()`'s doc comment back on `reconcile` (round 3's `tuneOf` had landed between them).

## Deferred

- **Bach (307) and baroque (151) rubbing onsets**: the continuo cello's and the line's passing tones against held keyboard notes, mostly. They're idiomatic, and round 2 left them for the same reason.
- **Ray Charles's horns against the pad** (sax/pad 40, trumpet/pad 37): short horn notes over a held pad. The horns are lines, and moving their notes would change the riff. It might be better to thin the pad under a horn riff, but that's a taste call.
- Composer first sound (22 s on Haiku for 16 bars) is still the plan call. Round 3 left it, and so do I.
