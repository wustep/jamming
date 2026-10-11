# Improvements, 2026-10-11 (round 2)

Starting from ad185da (round 1's branch, 436 tests), ending at 439. Real model calls this round: four 16-bar Improviser jams on Blue Bossa with Claude Haiku 4.5 for every role, through the server's Anthropic key only (the gateway keys were blanked; the key never reached the browser, a log or a screenshot). Each jam is roughly $0.03–0.05 at list price, so about $0.15 in all. Everything else used the dev-only `mock` key or no key.

## What I saw

Used the app with fresh eyes on the parts round 1 didn't touch: the Improviser path (mock, then real), the takes list, the audio lab, a six-player jam at 390 px, and the art lab.

- **A standard's improvised jam played nothing until the whole jam was written.** Blue Bossa on Haiku started playing 36 s after the click, when the jam ended; the round-1 notes said the first phrase is ready about 8 s in. A temporary log showed `readyBars` stuck at 0 through every phrase. A standard's head is the written melody, so nobody writes the opening phrase, and its featured phase finished before the band's opening phase started. That phase only went ahead from "none", so it returned at once. Phrase 1 never reached "done", so playback waited for everything, and the band never wrote under the head. This hit every standard and every chart that opens with an intro. With mock calls at 1.5 s each, Autumn Leaves (128 bars) was silent for 63 s.
- **Elijah Fox's bass pulse** (deferred last round): the cello's octave jump landed on the piano's held 7th almost every bar (84 rubs in four takes).
- **The rig audit only ever played the default band.** Given a preset's own band, it found the piano's paw darting sideways and back in Chopin, Debussy and Elijah Fox (Chopin's right-hand sixths letting go).
- Checked and fine: the phone layout during a six-player jam, the audio lab, the takes list. The mock band's "Got it, boss" and self-addressed lines are the mock's, not the app's.

## What I chose, and why

1. **The opening phase goes ahead alongside a featured phase that's already finished** (`improviser.ts`, pipeline test). This is the biggest thing a listener hits: a key holder picking a standard heard nothing for the whole thinking time. On real Haiku, Blue Bossa now starts at 12.2 s instead of at the end (23–36 s), with the band's head written, no autopilot bars and 0 late notes. On mock, Autumn Leaves starts at 5.1 s instead of 63 s.
2. **A bass note that rubs against a held note plays an octave away** (new ensemble pass 5). The line keeps its harmony. Semitone clashes per 1000 onsets: Elijah Fox 46.9 → 1.6, Minimalist 8.5 → 2.0, and nothing went up. A walking or running bass keeps its passing tones.
3. **The rig audit plays each preset's band** (`rigTake`/`auditTake` take a preset, and a rig test covers every preset's players). **The piano paw goes on to its next note when its last stroke lets go**, instead of being pulled toward what's still ringing. All rig tests pass, including the full default-band sweep (the organ shares this code).
4. **The art lab's "play like"** seats a preset's band at its tempo, so next glitch can step through it. It's how the before/after was checked: the old code stops on a flicker at Chopin bar 10; the new one runs to the end.

## Deferred

- **Real Haiku is slower than the mock pace estimate in places:** phrase 1's band call took 7.7 s on one run. It didn't fall behind (no autopilot), but on a fast tune the first phrase could.
- **Bach's continuo cello** still has 71 brief passing-tone rubs against held piano notes in four takes. Neither octave is free there, and they're idiomatic.
- **Jobim's two compers** (guitar against piano), from round 1.
- A preset's band in the art lab sits beside the default band's other instruments; seating only the preset's players would need a variable sprite count.
