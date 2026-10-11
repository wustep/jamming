"""Find sustain loop points for MIDI.js soundfonts that goldst.dev has no loop data for.

usage: python3 scripts/soundfont-loops.py KIT INSTRUMENT public/soundfont-loops/KIT/INSTRUMENT-loop.json  (macOS: uses afconvert)
Writes {"C4": [startSample, endSample], ...} at 44.1 kHz, the format smplr's loadLoopData reads.
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


def decode(note, b64):
    mp3 = os.path.join(tmp, f"{note}.mp3")
    wav = os.path.join(tmp, f"{note}.wav")
    open(mp3, "wb").write(base64.b64decode(b64))
    subprocess.run(["afconvert", "-f", "WAVE", "-d", "LEI16@44100", "-c", "1", mp3, wav], check=True, capture_output=True)
    w = wave.open(wav)
    a = array.array("h", w.readframes(w.getnframes()))
    return a


def rms(a, i, n):
    seg = a[i : i + n]
    return math.sqrt(sum(x * x for x in seg) / max(1, len(seg)))


for note, b64 in re.findall(r'"([A-G]b?\d)": ?"data:audio/mp3;base64,([^"]+)"', src):
    a = decode(note, b64)
    sr = 44100
    n = len(a)
    win = sr // 20
    env = [rms(a, i, win) for i in range(0, n - win, win)]
    if not env:
        continue
    peak = max(env)
    if peak < 50:
        continue
    # the sustain: past the attack, before any release; the last frame still above 45% of peak
    last = max(i for i, e in enumerate(env) if e > 0.45 * peak)
    end_t = min(n - sr // 20, (last + 1) * win)  # sample index
    start_t = max(int(0.35 * n), int(end_t - 1.6 * sr))
    if end_t - start_t < sr // 4:
        continue

    def rising(i):
        return a[i - 1] < 0 <= a[i]

    def nearest_rising(t, span):
        best = None
        for d in range(span):
            for i in (t + d, t - d):
                if 1 <= i < n - 1 and rising(i):
                    return i
        return best

    s = nearest_rising(start_t, sr // 50)
    if s is None:
        continue
    # end: the rising crossing near end_t whose following cycle best matches the loop start's
    cyc = 600
    ref = a[s : s + cyc]
    best, best_err = None, None
    for i in range(max(s + sr // 4, end_t - sr // 10), min(n - cyc - 1, end_t)):
        if not rising(i):
            continue
        seg = a[i : i + cyc]
        err = sum((x - y) ** 2 for x, y in zip(seg[:cyc:4], ref[:cyc:4]))
        if best_err is None or err < best_err:
            best, best_err = i, err
    if best:
        loops[note] = [s, best]

json.dump(loops, open(out, "w"), separators=(",", ":"))
print(name, kit, len(loops), "notes")
