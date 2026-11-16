// Procedural sound: every effect is synthesised with WebAudio, no assets.
// The context is created on the first user gesture (the Start button).

var NG_Audio = (function () {
  let ctx = null;
  let master = null;
  let muted = false;
  let rainNode = null;
  let rainGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, filterFreq, delay) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + (delay || 0);
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function startRain() {
    if (!ctx || rainNode) return;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    rainNode = ctx.createBufferSource();
    rainNode.buffer = buf;
    rainNode.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 1400;
    filt.Q.value = 0.4;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainNode.connect(filt);
    filt.connect(rainGain);
    rainGain.connect(master);
    rainNode.start();
  }

  function setRain(level) {
    if (!ctx) return;
    startRain();
    if (rainGain) rainGain.gain.setTargetAtTime(muted ? 0 : level * 0.10, ctx.currentTime, 0.6);
  }

  function siren(on) {
    if (!ctx) return;
    if (on && !sirenOsc) {
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 780;
      sirenLfo = ctx.createOscillator();
      sirenLfo.frequency.value = 1.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = muted ? 0 : 0.045;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
    } else if (!on && sirenOsc) {
      try { sirenOsc.stop(); sirenLfo.stop(); } catch (e) { /* already stopped */ }
      sirenOsc = null;
      sirenLfo = null;
      sirenGain = null;
    }
  }

  return {
    unlock: ensure,
    setMuted: function (m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
      if (sirenGain) sirenGain.gain.value = m ? 0 : 0.045;
      if (rainGain && ctx) rainGain.gain.setTargetAtTime(m ? 0 : 0.08, ctx.currentTime, 0.1);
    },
    isMuted: function () { return muted; },
    setRain: setRain,
    siren: siren,
    click: function () { tone(660, 0.07, 'square', 0.08); },
    toggle: function () { tone(520, 0.06, 'square', 0.10); tone(780, 0.08, 'square', 0.10, null, 0.05); },
    horn: function () { tone(392, 0.16, 'sawtooth', 0.07); tone(330, 0.16, 'sawtooth', 0.07); },
    crash: function () { noise(0.5, 0.5, 900); tone(90, 0.45, 'sine', 0.4, 40); },
    nearMiss: function () { tone(1180, 0.09, 'sine', 0.14, 1600); },
    combo: function (level) { tone(520 + level * 90, 0.10, 'sine', 0.14); tone(780 + level * 90, 0.14, 'sine', 0.14, null, 0.07); },
    score: function () { tone(880, 0.06, 'sine', 0.06); },
    wave: function () { tone(523, 0.12, 'triangle', 0.16); tone(659, 0.12, 'triangle', 0.16, null, 0.11); tone(784, 0.2, 'triangle', 0.16, null, 0.22); },
    upgrade: function () { tone(392, 0.1, 'triangle', 0.15); tone(523, 0.1, 'triangle', 0.15, null, 0.09); tone(659, 0.18, 'triangle', 0.15, null, 0.18); },
    lifeLost: function () { tone(320, 0.25, 'sawtooth', 0.16, 140); noise(0.2, 0.2, 600); },
    gameOver: function () { tone(392, 0.3, 'triangle', 0.2); tone(330, 0.3, 'triangle', 0.2, null, 0.28); tone(262, 0.5, 'triangle', 0.2, null, 0.56); },
    victory: function () {
      const notes = [523, 659, 784, 1047, 784, 1047, 1319];
      for (let i = 0; i < notes.length; i++) tone(notes[i], 0.22, 'triangle', 0.18, null, i * 0.14);
    },
    warning: function () { tone(220, 0.12, 'square', 0.08); tone(220, 0.12, 'square', 0.08, null, 0.18); }
  };
})();
