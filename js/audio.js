// All sounds are synthesised with WebAudio -- no audio files to load.
let ctx = null;
let master = null;
let muted = false;
let pending = [];

function ensure() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.8;
    master.connect(ctx.destination);
  }
  return ctx;
}

// iPhones mute Web Audio when the ringer switch is on silent. Asking for a "playback" audio
// session (iOS 17+), or playing a silent looping <audio> element (older iOS), makes the card
// behave like media instead, so it plays in silent mode too.
let mediaUnlocked = false;
function silentWavUrl() {
  const rate = 8000, n = 800;   // 0.1 s of silence, 8-bit mono
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
function unlockMedia() {
  if (mediaUnlocked) return;
  mediaUnlocked = true;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
  const el = new Audio(silentWavUrl());
  el.loop = true;
  el.setAttribute('playsinline', '');
  el.play().catch(() => { mediaUnlocked = false; });
}

// Browsers keep audio locked until the first user gesture. Anything requested before that
// is queued and played on the first tap/click.
export function unlock() {
  ensure();
  unlockMedia();
  if (ctx.state === 'running') return;
  // a one-sample buffer started inside the gesture fully wakes iOS audio
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, 22050);
  src.connect(ctx.destination);
  src.start(0);
  ctx.resume().then(() => {
    const queued = pending;
    pending = [];
    // stale requests (e.g. an arrival chime from long ago) are dropped
    queued.filter((p) => performance.now() - p.at < 6000).forEach((p) => p.once());
  });
}
// iOS only treats touchend/click as a real gesture for audio, so listen for those too
['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));

function play(fn) {
  ensure();
  if (muted) return;
  if (ctx.state !== 'running') {
    // played once, either as soon as resume() succeeds or on the first gesture
    let done = false;
    const once = () => { if (!done && ctx.state === 'running') { done = true; fn(); } };
    pending.push({ once, at: performance.now() });
    ctx.resume().then(once);
    return;
  }
  fn();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ctx.currentTime, 0.05);
}
export const isMuted = () => muted;

function noiseBuffer(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// paper/felt rustle: filtered noise with a swept band
function rustle({ t = 0, dur = 0.5, from = 900, to = 3200, q = 0.9, gain = 0.5, flutter = 0 }) {
  const start = ctx.currentTime + t;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.1);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = q;
  bp.frequency.setValueAtTime(from, start);
  bp.frequency.exponentialRampToValueAtTime(to, start + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + dur * 0.25);
  if (flutter) {
    for (let i = 1; i < 10; i++) g.gain.setValueAtTime(gain * (0.4 + Math.random() * 0.6), start + dur * 0.25 + (dur * 0.6 * i) / 10);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(start);
  src.stop(start + dur + 0.1);
}

function bell(freq, t = 0, dur = 1.2, gain = 0.25, type = 'sine') {
  const start = ctx.currentTime + t;
  [[1, 1], [2.01, 0.35], [3.02, 0.12]].forEach(([mult, amp]) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq * mult;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain * amp, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur / mult);
    o.connect(g).connect(master);
    o.start(start);
    o.stop(start + dur);
  });
}

export const sfx = {
  // envelope slides in + "you've got mail" chime
  arrive: () => play(() => {
    rustle({ dur: 0.9, from: 500, to: 2600, gain: 0.35 });
    bell(1318.5, 0.85, 1.4, 0.2);   // E6
    bell(1046.5, 1.1, 1.8, 0.2);    // C6
  }),
  // flap peeled open
  openFlap: () => play(() => rustle({ dur: 0.45, from: 2400, to: 1200, q: 1.4, gain: 0.45, flutter: 1 })),
  // card sliding out of the pocket
  slide: () => play(() => rustle({ dur: 0.85, from: 700, to: 1900, q: 0.7, gain: 0.3 })),
  // the pop-up springing open
  pop: () => play(() => {
    const start = ctx.currentTime;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(420, start);
    o.frequency.exponentialRampToValueAtTime(90, start + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    o.connect(g).connect(master);
    o.start(start); o.stop(start + 0.25);
    rustle({ dur: 0.5, from: 600, to: 3000, gain: 0.3 });
    [1568, 2093, 2637, 3136].forEach((f, i) => bell(f, 0.12 + i * 0.07, 0.7, 0.07));
  }),
  // blowing out the candle
  blow: () => play(() => rustle({ dur: 0.7, from: 1400, to: 500, q: 0.6, gain: 0.5 })),
  // relighting it
  light: () => play(() => { rustle({ dur: 0.35, from: 2500, to: 4000, q: 1.5, gain: 0.25 }); bell(1568, 0.12, 0.6, 0.06); }),
  // music-box "Happy Birthday"
  song: () => play(() => {
    const N = { G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784 };
    const tune = [
      ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
      ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
      ['G4', .75], ['G4', .25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
      ['F5', .75], ['F5', .25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 2.5],
    ];
    const beat = 0.36;
    let t = 0.1;
    for (let round = 0; round < 2; round++) {   // play it through twice
      for (const [n, len] of tune) {
        bell(N[n] * 2, t, 1.4, 0.11);
        t += len * beat;
      }
      t += beat * 1.5;   // short breath before the repeat
    }
  }),
};
