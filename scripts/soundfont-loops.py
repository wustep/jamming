"""Find sustain loop points for the MIDI.js soundfonts' held voices.

usage: python3 scripts/soundfont-loops.py KIT INSTRUMENT public/soundfont-loops/KIT/INSTRUMENT-loop.json  (macOS: uses afconvert)
Writes {"C4": [startSample, endSample], ...} at 44.1 kHz, the format smplr's loadLoopData reads.

A held note plays its sample to the loop's end, then goes round the loop for as long as it's held,
so the loop has to join up two ways: the level coming into its end has to be the level leaving its
start (most samples fade as they hold, and a loop across the fade steps up every time round), and
the waveform around the end has to be the waveform around the start. This takes the loop (0.5 to
1.6 s, late in the sustain, between rising zero crossings) that does both best.
"""
import array
import base64
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
import wave

kit, name, out = sys.argv[1:4]
url = f"https://gleitz.github.io/midi-js-soundfonts/{kit}/{name}-mp3.js"
src = urllib.request.urlopen(url).read().decode()
tmp = tempfile.mkdtemp()
loops = {}
sr = 44100
win = sr // 20


def decode(note, b64):
    mp3 = os.path.join(tmp, f"{note}.mp3")
    wav = os.path.join(tmp, f"{note}.wav")
    open(mp3, "wb").write(base64.b64decode(b64))
    subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@44100", "-c", "1", mp3, wav], check=True, capture_output=True)
    w = wave.open(wav)
    a = array.array("h", w.readframes(w.getnframes()))
    return a


def find_loop(a):
    n = len(a)
    # running sum of squares: the level of any stretch in constant time
    cs = [0.0]
    for x in a:
        cs.append(cs[-1] + x * x)

    def level(i):
        return 10 * math.log10(max(1.0, (cs[i + win] - cs[i]) / win))

    env = [level(i) for i in range(0, n - win, win)]
    if not env or max(env) < 20 * math.log10(50):  # silent
        return None
    # the sustain: past the attack, before any release; the last frame still above 45% of peak
    last = max(i for i, e in enumerate(env) if e > max(env) + 20 * math.log10(0.45))
    end_t = min(n - win, (last + 1) * win)
    lo_t = max(int(0.35 * n), int(end_t - 1.6 * sr))
    if end_t - lo_t < sr // 2:
        return None
    rising = [i for i in range(max(1, lo_t), min(n - win - 1, end_t)) if a[i - 1] < 0 <= a[i]]
    ends = [i for i in rising if i >= end_t - 0.3 * sr]
    starts = [i for i in rising if i <= end_t - 0.5 * sr]
    starts = starts[:: max(1, len(starts) // 60)]
    half = 300

    def mismatch(s, e):
        """The waveform either side of the end against either side of the start (a click if they differ)."""
        if s < half or e + half > n:
            return None
        ref = a[s - half : s + half : 3]
        seg = a[e - half : e + half : 3]
        return sum((x - y) ** 2 for x, y in zip(seg, ref)) / max(1.0, sum(y * y for y in ref))

    # a dB of level step costs about as much as a third of a cycle that doesn't match
    best, best_cost = None, None
    for s in starts:
        for e in ends:
            if not sr // 2 <= e - s <= 1.6 * sr:
                continue
            step = abs(level(e - win) - level(s))
            if best_cost is not None and 0.3 * step >= best_cost:
                continue
            err = mismatch(s, e)
            if err is None:
                continue
            cost = err + 0.3 * step
            if best_cost is None or cost < best_cost:
                best, best_cost = [s, e], cost
    return best


for note, b64 in re.findall(r'"([A-G]b?\d)": ?"data:audio/mp3;base64,([^"]+)"', src):
    loop = find_loop(decode(note, b64))
    if loop:
        loops[note] = loop

json.dump(loops, open(out, "w"), separators=(",", ":"))
print(name, kit, len(loops), "notes")
