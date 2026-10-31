// Every sound is synthesized with WebAudio, so the game ships no audio files.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}

let adPaused = false;

/** Silences the game while an ad plays. */
export function pauseAudio(p: boolean) {
  adPaused = p;
  if (!ctx) return;
  (p ? ctx.suspend() : ctx.resume()).catch(() => {});
}

function ac(): AudioContext | null {
  if (muted || adPaused) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.32;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.3, slideTo?: number, delay = 0) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'lowpass', delay = 0, slideTo?: number) {
  const c = ac();
  if (!c || !master || !noiseBuf) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

const semis = (n: number) => Math.pow(2, n / 12);
const PENTA = [0, 2, 4, 7, 9];
const pentaStep = (n: number) => PENTA[n % 5] + 12 * Math.floor(n / 5);

export const sfx = {
  hit() {
    noise(0.06, 0.5, 1800, 'bandpass');
    tone(140, 0.06, 'square', 0.08, 90);
  },
  /** Pitch climbs a pentatonic scale as the combo grows. */
  break(combo: number) {
    const f = 330 * semis(Math.min(36, pentaStep(Math.max(0, combo - 1))));
    tone(f, 0.12, 'triangle', 0.22);
    tone(f * 2, 0.08, 'sine', 0.06);
    noise(0.05, 0.25, 2500, 'highpass');
  },
  explode(size = 1) {
    noise(0.5 + size * 0.15, 0.9, 900, 'lowpass', 0, 80);
    tone(90, 0.35, 'sine', 0.5, 35);
  },
  gas() {
    noise(0.3, 0.4, 600, 'bandpass', 0, 2400);
  },
  shard() {
    tone(1800, 0.25, 'sine', 0.12, 3200);
    tone(2400, 0.2, 'triangle', 0.06, 1200, 0.03);
  },
  burn() {
    noise(0.4, 0.35, 4000, 'highpass');
  },
  energy() {
    tone(400, 0.25, 'square', 0.08, 1200);
  },
  coin(n = 1) {
    for (let k = 0; k < Math.min(n, 4); k++) {
      tone(988, 0.08, 'square', 0.08, undefined, k * 0.07);
      tone(1319, 0.2, 'square', 0.08, undefined, k * 0.07 + 0.06);
    }
  },
  chest() {
    [0, 4, 7, 12].forEach((s, k) => tone(523 * semis(s), 0.18, 'triangle', 0.15, undefined, k * 0.06));
  },
  relic() {
    [0, 7, 12, 16, 19, 24].forEach((s, k) => tone(392 * semis(s), 0.35, 'sine', 0.14, undefined, k * 0.07));
  },
  mult() {
    tone(300, 0.3, 'sawtooth', 0.08, 900);
    tone(600, 0.3, 'square', 0.05, 1800, 0.05);
  },
  combo(n: number) {
    const base = 440 * semis(Math.min(12, Math.floor(n / 5)));
    [0, 4, 7, 12].forEach((s, k) => tone(base * semis(s), 0.22, 'square', 0.07, undefined, k * 0.05));
  },
  stairs() {
    [0, -3, -5, -8, -12].forEach((s, k) => tone(660 * semis(s), 0.2, 'triangle', 0.15, undefined, k * 0.08));
  },
  click() {
    tone(700, 0.04, 'square', 0.05);
  },
  buy() {
    tone(660, 0.06, 'square', 0.08);
    tone(990, 0.12, 'square', 0.08, undefined, 0.05);
  },
  error() {
    tone(160, 0.15, 'sawtooth', 0.08, 110);
  },
  tick() {
    tone(1200 + Math.random() * 300, 0.025, 'square', 0.04);
  },
  win(big = false) {
    const notes = big ? [0, 4, 7, 12, 16, 19, 24] : [0, 4, 7, 12];
    notes.forEach((s, k) => tone(523 * semis(s), 0.25, 'square', 0.09, undefined, k * 0.07));
  },
  lose() {
    tone(330, 0.2, 'triangle', 0.12, 220);
    tone(220, 0.3, 'triangle', 0.12, 110, 0.15);
  },
  pay() {
    tone(220, 0.12, 'square', 0.1);
    tone(330, 0.3, 'square', 0.1, undefined, 0.1);
    noise(0.15, 0.3, 3000, 'highpass', 0.1);
  },
  foreclose() {
    [0, -1, -2, -3, -12].forEach((s, k) => tone(220 * semis(s), 0.5, 'sawtooth', 0.1, undefined, k * 0.28));
  },
  rebirth() {
    [0, 7, 12, 19, 24, 31, 36].forEach((s, k) => tone(196 * semis(s), 0.6, 'sine', 0.12, undefined, k * 0.09));
  },
};
