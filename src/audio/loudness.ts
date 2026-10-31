// ITU-R BS.1770 loudness: K-weighted and gated, so a bright trumpet reads louder than a dark bass at
// the same RMS, the way it sounds. The audio lab reads the band's levels with it (levels.ts).

export interface Loudness {
  /** Integrated loudness, LUFS. */
  lufs: number;
  /** Plain RMS over the same gated blocks, dBFS. */
  rms: number;
  /** Sample peak, dBFS. */
  peak: number;
}

type Biquad = { b: [number, number, number]; a: [number, number] };

/** BS.1770's K-weighting at `fs`: a +4 dB shelf above ~1.7 kHz (the head), then a ~38 Hz high-pass. */
export function kWeighting(fs: number): [Biquad, Biquad] {
  // the shelf, from the standard's analogue prototype (its 48 kHz coefficients exactly)
  let K = Math.tan((Math.PI * 1681.974450955533) / fs);
  const Vh = Math.pow(10, 3.999843853973347 / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let Q = 0.7071752369554196;
  let a0 = 1 + K / Q + K * K;
  const shelf: Biquad = {
    b: [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0],
    a: [(2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0],
  };
  K = Math.tan((Math.PI * 38.13547087602444) / fs);
  Q = 0.5003270373238773;
  a0 = 1 + K / Q + K * K;
  const highpass: Biquad = { b: [1, -2, 1], a: [(2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0] };
  return [shelf, highpass];
}

function filter(x: Float32Array, { b, a }: Biquad): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

const dB = (power: number) => 10 * Math.log10(power);

/**
 * Integrated loudness of a recording (one array per channel, front left and right weighted 1):
 * 400 ms blocks every 100 ms, K-weighted, those under −70 LUFS dropped, then those more than
 * 10 LU under what's left.
 */
export function loudness(channels: Float32Array[], sampleRate: number): Loudness {
  const k = kWeighting(sampleRate);
  const weighted = channels.map((x) => filter(filter(x, k[0]), k[1]));
  const block = Math.round(0.4 * sampleRate);
  const step = Math.round(0.1 * sampleRate);
  const n = channels[0]?.length ?? 0;
  const blocks: { z: number; plain: number }[] = [];
  for (let s = 0; s + block <= n; s += step) {
    let z = 0;
    let plain = 0;
    for (let c = 0; c < channels.length; c++) {
      let wz = 0;
      let pz = 0;
      for (let i = s; i < s + block; i++) {
        wz += weighted[c][i] * weighted[c][i];
        pz += channels[c][i] * channels[c][i];
      }
      z += wz / block;
      plain += pz / block / channels.length;
    }
    blocks.push({ z, plain });
  }
  const lufsOf = (z: number) => -0.691 + dB(z);
  const loud = blocks.filter((b) => lufsOf(b.z) > -70);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
  const gate = loud.length ? lufsOf(mean(loud.map((b) => b.z))) - 10 : Infinity;
  const kept = loud.filter((b) => lufsOf(b.z) > gate);
  let peak = 0;
  for (const x of channels) for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  return {
    lufs: kept.length ? lufsOf(mean(kept.map((b) => b.z))) : -Infinity,
    rms: kept.length ? dB(mean(kept.map((b) => b.plain))) : -Infinity,
    peak: 20 * Math.log10(peak || 1e-9),
  };
}

export function bufferLoudness(buffer: AudioBuffer): Loudness {
  return loudness(Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c)), buffer.sampleRate);
}
