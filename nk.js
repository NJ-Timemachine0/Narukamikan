/* Narukami Hall: Ring Once, Then Listen / prototype / Timemachine0
   Plain JS + Canvas 2D + Web Audio. No libraries, no audio files.
   Blocks between TEST markers exist only in the test build; tools/build_public.py removes them. */
(function () {
'use strict';

/* ===================== 1. CONFIG (all gameplay numbers live here) ===================== */
var CONFIG = {
  sim: { hz: 60, maxStepsPerFrame: 8 },          // fixed-step simulation; everything below is "per second"
  view: { metersAcrossShortSide: 8, maxDpr: 2 },
  player: { radius: 0.2, speed: 1.2 /* m/s, suri-ashi */, stepInterval: 0.62 },
  input: { strongHold: 0.4 /* hold >= 0.4 s = strong; released earlier = weak (plan: weak < 0.25 s) */, dragDeadzonePx: 10 },
  bell: {
    weak:   { radius: 2.0,  afterglow: 3.5, rays: 36, cooldown: 0.4, bpm: 2,  vibrateMs: 20 },
    strong: { radius: 15.0, afterglow: 5.0, rays: 72, cooldown: 2.0, bpm: 14, vibrateMs: 20 },
    // radius / rays = how far the SOUND reaches (echoes are the same on every difficulty). What is SHOWN is in CONFIG.difficulty.
    // Bell life "B: cracks" (ぷらん docs/opening_difficulty_v0.md ch. 3). Every number for DR3 tuning lives here.
    life: { max: 100, weakCost: 3, strongCost: 20, strongMin: 20 /* strong needs >= this, else dull sound, no cost */,
            regenDelaySec: 1.0 /* after the last ring */, regenPerSec: { easy: 3, normal: 2, hard: 1.5 },
            breakSec: 10 /* at 0: about to break, no strong */, afterBreak: 20 /* durability after the break time */,
            crack1Below: 67 /* 66..34 = 1 crack */, crack2Below: 34 /* 33..1 = 2 cracks */, muddyAtOrBelow: 33,
            muddyLowpassHz: 3200 /* <= 33: a little muddy */, brokenLowpassHz: 1500, brokenGain: 0.8, brokenCutSec: 0.45 /* short + muddy, materials still heard */,
            dullLowpassHz: 900, dullGain: 0.9 /* strong refused: dull 'kasu' (touch sound, filtered) */,
            iconShakePx: 0.7 /* about to break: icon dark + trembles, never blinks */, iconDim: 0.45 }
  },
  // ぷらん docs/opening_difficulty_v0.md ch. 2. Sound is identical on all three; only what is shown changes.
  // easy = P0.3 visuals exactly. hard = no walls / floor / door light at all, only the own dot + faint ripples that pass through walls.
  difficulty: { def: 'easy', list: ['easy', 'normal', 'hard'],
    easy:   { weak: { radius: 2.0, afterglow: 3.5 }, strong: { radius: 15.0, afterglow: 5.0 }, glow: 1.0, walls: true,  aura: true,  rippleA: 1.0 },
    normal: { weak: { radius: 1.5, afterglow: 2.0 }, strong: { radius: 10.0, afterglow: 2.5 }, glow: 0.7, walls: true,  aura: true,  rippleA: 1.0 },
    hard:   { weak: null, strong: null, glow: 0, walls: false, aura: false, rippleA: 0.45, dotR: 0.07, dotA: 0.5 } },
  // opening (ch. 1): bell + one ripple over the inn picture, outline lights for a moment, then on
  opening: { artFadeSec: 1.5, artOpacity: 0.62, pressSec: 1.8, rippleSec: 1.4, glowPeak: 0.10 /* brightness +10% (no flash) */, hardNoteSec: 1.8 },
  ripple: { speed: 10 /* m/s, slower than real sound for readability */ },
  aura: { radius: 0.4, touchMargin: 0.06, touchSoundInterval: 0.35 },
  // plan 1-3: start 72, floor 70, 180 = faint (Stage 1), walk +0.6/s, no bell for 8 s -> +0.8/s, still 0.6 s -> -12/s
  heart: { start: 72, floor: 70, max: 180, walkPerSec: 0.6, darkAfterSec: 8, darkPerSec: 0.8, restAfterSec: 0.6, restPerSec: 12,
           levels: [90, 130, 160],                 // Lv1 / Lv2 / Lv3 lower bounds (Lv0 = below 90)
           lookaheadSec: 0.2,                      // K6: beats are booked on the AudioContext clock this far ahead
           vibrateFromBpm: 130, vibrateMs: 15,     // plan: vibrate per beat from Lv2, 15 ms
           monoAtBpm: 130,                         // decision 1: s1_mono_01 once, when Lv2 is first reached
           tinnitusFromBpm: 160, tinnitusEverySec: 3.6, breathEverySec: 3.4, shallowMinSec: 1.6, shallowMaxSec: 2.8 },
  faint: { enabled: true /* Stage 1 only: 180 = faint, not death */, outSec: 1.5, holdSec: 3.0, inSec: 1.6 },
  respawn: { bedroom: { x: 2.5, y: 3.2 }, honma: { x: 5.7, y: 4.55 }, itanoma: { x: 12.5, y: 3.5 } }, // "restart in that room"
  pulse: { use: 'visual_sync_v1_2' /* key in recipes.json 'heartbeat'; falls back to 'visual_sync' */, smoothSec: 0.5,
           lubAttackSec: 0.05, lubDecaySec: 0.14 },
  fx: { swayPx: [0, 0.4, 0.8, 1.2], chromaPx: [0, 0, 1.0, 1.6], edgeDark: [0, 0.10, 0.22, 0.32], textShakePx: [0, 0.5, 0.8, 1.1],
        textLubDim: 0.06 /* text dims 6% on lub (Lv1+) */, glitchShare: 0.2 /* Lv3: at most 20% of characters faded */ },
  title: { image: null /* set to e.g. 'ui/title_lockup.webp' once ぷらん approves the title art */ },
  echo: { maxVoices: 24, reverbWet: 0.35 },
  audio: { masterGain: 0.5 /* -6 dBFS ceiling */, limiterThreshold: -8 },
  intro: { autoBellDelay: 1.0 },                  // after the last opening line ends; s1.json autoBellDelaySec overrides
  prologue: { fadeInSec: 1.0, panSec: 6.0, titleFadeInSec: 0.8, titleHoldSec: 0.6, titleFadeOutSec: 0.8, dimSec: 0.6, dim: 0.42,
              artFadeOutSec: 1.0, panMinHeight: 1.6, maxScale: 1.2,
              advanceLockSec: 0.9, /* after a line appears, ignore 進む (skip still works) */
              panEndBottom: 1600, /* desktop: stop when the viewport bottom is at this source y (just below the gate) */
              titleTop: 0.28, titleTopWide: 0.15, /* phone keeps 28%; desktop aims at 15%, then slides off moon/roof */
              art: 'bg/inn_exterior.webp', titleJa: 'ui/title_ja.webp', titleEn: 'ui/title_en_name.webp' },
  voice: { langs: ['ja'] /* English = subtitles only */, base: 'voice/', gain: 0.8, tailSec: 0.3 },
  text: { fadeIn: 0.8, holdJa: 3.5, holdEnMin: 3, holdEnMax: 6, enCharsPerSec: 14, fadeOut: 1.2, gap: 0.4, firstDelay: 0.8 },
  clear: { fadeTime: 2.2 },
  materials: { // glow strength, afterglow multiplier, echo recipe (あーと: paper = fusuma, hole = void = silent)
    wood:  { glow: 1.0,  life: 1.0,  echo: 'echo_wood' },
    cloth: { glow: 0.42, life: 0.6,  echo: 'echo_cloth' },
    paper: { glow: 0.75, life: 0.85, echo: 'echo_fusuma' },
    stone: { glow: 1.0,  life: 1.25, echo: 'echo_stone' },
    hole:  { glow: 0,    life: 0,    echo: 'echo_void' },
    mud:   { glow: 0.3,  life: 0.4,  echo: 'echo_mud' }
  }
};

/* ===================== 2. Storage + platform layer (swap in CrazyGames SDK later) ===================== */
var Store = { // every key gets the nk_ prefix
  get: function (k) { try { return localStorage.getItem('nk_' + k); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem('nk_' + k, String(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem('nk_' + k); } catch (e) {} }
};
var Platform = {
  _muted: false, _muteCbs: [],
  init: function () { return Promise.resolve(); },        // TODO(SDK): await SDK.init()
  gameplayStart: function () {},                           // TODO(SDK)
  gameplayStop: function () {},                            // TODO(SDK)
  getLocale: function () {                                 // TODO(SDK): SDK user locale
    var saved = Store.get('lang');
    if (saved === 'ja' || saved === 'en') return saved;
    var langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    return /^ja\b/i.test(langs[0] || '') ? 'ja' : 'en';
  },
  getDevice: function () {                                 // TODO(SDK): SDK system info, not pointer type
    return (window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 'mobile' : 'desktop';
  },
  isMuted: function () { return this._muted; },            // TODO(SDK): SDK game settings (mute)
  onMuteChange: function (cb) { this._muteCbs.push(cb); }, // TODO(SDK): addSettingsChangeListener
  _setMuted: function (m) { this._muted = m; this._muteCbs.forEach(function (cb) { cb(m); }); }
};
/*@TEST*/
// Test build only: imitate the SDK's local "?muteAudio=true" switch. Removed from the public build.
var TEST_PARAMS = new URLSearchParams(location.search);
if (TEST_PARAMS.get('muteAudio') === 'true') Platform._muted = true;
/*@END_TEST*/

var LANG = Platform.getLocale();
document.documentElement.lang = LANG;
var UI = null; // text/ui.json (titles, control labels)
function settingOn(k, def) { var v = Store.get(k); return v == null ? def : v === '1'; }
var SETTINGS = { reduceFlash: settingOn('reduce_flash', false), vibrate: settingOn('vibrate', true) }; // UI for these comes in P0.3

/* ===================== 3. Map (temporary grey-box of 白鷺の間, meters, y = down) ===================== */
// Route: 寝室 -> gap under the fusuma (lower right of the bedroom) -> 本間 -> 板の間 -> 三和土 -> 踏込の引き戸
function W(x1, y1, x2, y2, m) { return { x1: x1, y1: y1, x2: x2, y2: y2, m: m }; }
var MAP = {
  start: { x: 2.5, y: 3.2 },
  exitZone: { x0: 16.55, y0: 2, y1: 5 },
  draft: { x: 17, y: 3.5 },
  areas: [ { id: 'honma', x0: 5.2, y0: -1, x1: 12, y1: 6 }, { id: 'itanoma', x0: 12, y0: 2, x1: 17, y1: 5 } ],
  walls: [
    W(0, 0, 0.6, 0, 'wood'), W(0.6, 0, 4.4, 0, 'cloth'), W(4.4, 0, 5, 0, 'wood'), // front: oshiire futon
    W(0, 0, 0, 5, 'mud'), W(0, 5, 5, 5, 'paper'),
    W(5, 0, 5, 4.25, 'wood'),                                                      // right: fusuma, gap 4.25..5
    W(5, -1, 9, -1, 'paper'), W(9, -1, 10.6, -1, 'hole'), W(10.6, -1, 12, -1, 'paper'),
    W(5, -1, 5, 0, 'wood'), W(5, 5, 5, 6, 'wood'), W(5, 6, 12, 6, 'mud'),
    W(12, -1, 12, 2, 'wood'), W(12, 5, 12, 6, 'wood'),
    W(8.6, 1.4, 8.6, 4.6, 'paper'),                                                // tsuitate
    W(6.4, 1.0, 7.6, 1.0, 'wood'), W(7.6, 1.0, 7.6, 1.7, 'wood'), W(7.6, 1.7, 6.4, 1.7, 'wood'), W(6.4, 1.7, 6.4, 1.0, 'wood'),
    W(12, 2, 15, 2, 'wood'), W(12, 5, 15, 5, 'wood'),
    W(15, 2, 17, 2, 'stone'), W(15, 5, 17, 5, 'stone'),
    W(17, 2, 17, 5, 'wood')                                                        // hikido (exit)
  ],
  floors: [ { x0: 12, y0: 2, x1: 15, y1: 5, f: 'wood' }, { x0: 15, y0: 2, x1: 17, y1: 5, f: 'stone' } ],
  floorAt: function (x, y) {
    for (var i = 0; i < this.floors.length; i++) { var r = this.floors[i]; if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r.f; }
    return 'tatami';
  },
  areaAt: function (x, y) {
    for (var i = this.areas.length - 1; i >= 0; i--) { var r = this.areas[i]; if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r.id; }
    return 'bedroom';
  }
};

/* ===================== 4. Geometry ===================== */
function raySeg(px, py, dx, dy, w) {
  var sx = w.x2 - w.x1, sy = w.y2 - w.y1, den = dx * sy - dy * sx;
  if (Math.abs(den) < 1e-9) return -1;
  var qx = w.x1 - px, qy = w.y1 - py, t = (qx * sy - qy * sx) / den, u = (qx * dy - qy * dx) / den;
  return (t > 1e-6 && u >= 0 && u <= 1) ? t : -1;
}
function closestOnSeg(px, py, w) {
  var sx = w.x2 - w.x1, sy = w.y2 - w.y1, l2 = sx * sx + sy * sy;
  var u = l2 ? ((px - w.x1) * sx + (py - w.y1) * sy) / l2 : 0;
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  return { x: w.x1 + sx * u, y: w.y1 + sy * u };
}

/* ===================== 5. Data loading (sound recipes + stage text + UI text) ===================== */
var DATA = { recipes: {}, sound: {}, text: null, ready: false };
function getJSON(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
var dataReady = Promise.all([
  getJSON('audio/recipes.json').then(function (j) {
    DATA.sound = j;
    (j.recipes || []).forEach(function (l) { (DATA.recipes[l.name] = DATA.recipes[l.name] || []).push(l); });
  }).catch(function () {}),             // no recipes -> silent sounds, game still playable
  getJSON('text/s1.json').then(function (j) { DATA.text = j; }).catch(function () {}),
  getJSON('text/ui.json').then(function (j) { UI = j[LANG] || j.en; }).catch(function () {}),
  getJSON('text/prologue.json').then(function (j) { DATA.prologue = j; }).catch(function () {}),
  getJSON('audio/prologue_sfx.json').then(function (j) {
    (j.recipes || []).forEach(function (l) { (DATA.recipes[l.name] = DATA.recipes[l.name] || []).push(l); });
  }).catch(function () {})
]).then(function () { DATA.ready = true; buildPulse(); applyUiText(); });
var FONTS_READY = document.fonts && document.fonts.load ? Promise.all([
  document.fonts.load('20px "NK Mincho"', '鳴'), document.fonts.load('20px "NK Garamond"', 'N')]).catch(function () {}) : Promise.resolve();

/* ===================== 6. Audio ===================== */
// One "env" per AudioContext (the live one, or an OfflineAudioContext in the test build's loudness check).
// Seeded random for the synth (noise, IR, noise start points): the same sound renders the same way every time,
// so the loudness calibration is exact. Reseeded per env; the live game keeps one env, so sounds still vary over time.
var aSeed = 1;
function arand() { aSeed = (aSeed + 0x6D2B79F5) | 0; var t = Math.imul(aSeed ^ (aSeed >>> 15), 1 | aSeed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
function makeEnv(ctx, dest) {
  aSeed = 20261117;
  var env = { ctx: ctx, dest: dest, noise: {}, revs: {}, presets: {} };
  var len = ctx.sampleRate * 2;
  ['white', 'pink', 'brown'].forEach(function (kind) {
    var buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), b0 = 0, b1 = 0, b2 = 0, last = 0, peak = 0, i, w;
    for (i = 0; i < len; i++) {
      w = arand() * 2 - 1;
      if (kind === 'pink') { b0 = 0.99765 * b0 + w * 0.0990460; b1 = 0.96300 * b1 + w * 0.2965164; b2 = 0.57000 * b2 + w * 1.0526913; d[i] = b0 + b1 + b2 + w * 0.1848; }
      else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last; }
      else d[i] = w;
      if (Math.abs(d[i]) > peak) peak = Math.abs(d[i]);
    }
    for (i = 0; i < len; i++) d[i] /= peak || 1;            // every colour normalized to the same peak
    env.noise[kind] = buf;
  });
  return env;
}
function revLegacy(env, sec) { // P0.1 synthesized IR per tail length (step / touch / clear sounds)
  var key = 'L' + Math.round(sec * 10) / 10;
  if (env.revs[key]) return env.revs[key];
  var ctx = env.ctx, n = Math.max(1, Math.floor(ctx.sampleRate * sec)), ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (var c = 0; c < 2; c++) { var ch = ir.getChannelData(c); for (var j = 0; j < n; j++) ch[j] = (arand() * 2 - 1) * Math.pow(1 - j / n, 3.2); }
  var cv = ctx.createConvolver(); cv.buffer = ir;
  var g = ctx.createGain(); g.gain.value = CONFIG.echo.reverbWet; cv.connect(g); g.connect(env.dest);
  return (env.revs[key] = cv);
}
function revPreset(env, name) { // あーと's reverb_presets: noise IR, exponential decay, pre-delay, low/high-pass, density
  if (env.revs[name]) return env.revs[name];
  var P = (DATA.sound.reverbPresets || {})[name]; if (!P) return null;
  var ctx = env.ctx, sr = ctx.sampleRate, n = Math.max(1, Math.floor(sr * P.duration_sec)), pre = Math.floor(sr * (P.pre_delay_sec || 0));
  var ir = ctx.createBuffer(2, n, sr), aL = Math.exp(-2 * Math.PI * (P.lowpass_hz || 8000) / sr), aH = Math.exp(-2 * Math.PI * (P.highpass_hz || 20) / sr);
  var dens = P.density || 1, norm = 1 / Math.sqrt(Math.max(0.05, dens));
  for (var c = 0; c < 2; c++) {
    var ch = ir.getChannelData(c), lp = 0, lo = 0, x;
    for (var j = 0; j < n; j++) {
      if (j < pre) { ch[j] = 0; continue; }
      x = arand() < dens ? (arand() * 2 - 1) * norm : 0;
      x *= Math.exp(-6.91 * ((j - pre) / sr) / Math.max(0.01, P.decay_sec));   // decay_sec = time to -60 dB
      lp = (1 - aL) * x + aL * lp;     // one-pole low-pass
      lo = (1 - aH) * lp + aH * lo;    // the part below highpass_hz ...
      ch[j] = lp - lo;                 // ... removed (= high-pass)
    }
  }
  var cv = ctx.createConvolver(); cv.buffer = ir; cv.connect(env.dest);
  return (env.revs[name] = cv);
}
function level(name) { var L = DATA.sound.levels; return (L && L[name]) || 1; }
/* Play one recipe (all layers of that name) on env. opt: at (absolute ctx time), delay, pan, gainMul, lowpassHz, cutSec, freqMul,
   noiseFilterMul, dest (node), raw (skip level calibration). Returns end time. */
function voice(env, name, opt) {
  var layers = DATA.recipes[name];
  if (!env || !layers) return 0;
  opt = opt || {};
  var ctx = env.ctx, t0 = (opt.at != null ? opt.at : ctx.currentTime + 0.008) + (opt.delay || 0), end = t0;
  var head = ctx.createGain(), last = head;
  if (opt.lowpassHz) { var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = opt.lowpassHz; head.connect(lp); last = lp; }
  if (opt.cutSec) { head.gain.setValueAtTime(1, t0 + opt.cutSec * 0.5); head.gain.exponentialRampToValueAtTime(0.0001, t0 + opt.cutSec); } // short (broken bell)
  var pn = panNode(ctx, opt.pan || 0); last.connect(pn); pn.connect(opt.dest || env.dest);
  var gm = (opt.gainMul == null ? 1 : opt.gainMul) * (opt.raw ? 1 : level(name)), fm = opt.freqMul || 1, nm = opt.noiseFilterMul || 1;
  layers.forEach(function (L) {
    var t = t0 + (L.delaySec || 0), dur = Math.max(0.01, L.durationSec), a = Math.max(0.001, L.attackSec || 0.001);
    var rel = Math.min(Math.max(0.005, L.releaseSec || 0.01), dur), holdEnd = Math.max(t + a + (L.decaySec || 0), t + dur - rel);
    var src, f = null;
    if (L.wave === 'noise') {
      src = ctx.createBufferSource(); src.buffer = env.noise[L.noise || 'white'];
      f = ctx.createBiquadFilter(); f.type = L.filterType || 'bandpass';
      f.frequency.setValueAtTime(L.freqHz * nm, t); if (L.freqEndHz) f.frequency.exponentialRampToValueAtTime(L.freqEndHz * nm, t + dur);
      if (L.filterQ) f.Q.value = L.filterQ;
      src.start(t, arand() * 1.5);
    } else {
      src = ctx.createOscillator(); src.type = L.wave || 'sine';
      src.frequency.setValueAtTime(L.freqHz * fm, t); if (L.freqEndHz) src.frequency.exponentialRampToValueAtTime(L.freqEndHz * fm, t + dur);
      if (L.filterType) {
        f = ctx.createBiquadFilter(); f.type = L.filterType; f.frequency.setValueAtTime(L.filterHz || L.freqHz, t);
        if (L.filterEndHz) f.frequency.exponentialRampToValueAtTime(L.filterEndHz, t + dur);
        if (L.filterQ) f.Q.value = L.filterQ;
      }
      src.start(t);
    }
    var g = ctx.createGain(), peak = Math.max(0.0002, Math.min(1, L.gain * gm));
    var sus = L.decaySec ? Math.max(0.0001, peak * (L.sustain || 0)) : peak;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (L.decaySec) g.gain.exponentialRampToValueAtTime(sus, t + a + L.decaySec);
    g.gain.setValueAtTime(sus, holdEnd);
    g.gain.exponentialRampToValueAtTime(0.0001, holdEnd + rel);
    src.stop(holdEnd + rel + 0.05);
    (f ? (src.connect(f), f) : src).connect(g); g.connect(head);
    if (L.reverbPreset && L.reverbMix > 0) {
      var rv = L.reverbPreset === 'dry' ? null : revPreset(env, L.reverbPreset);
      if (rv) { var sg = ctx.createGain(); sg.gain.value = L.reverbMix; g.connect(sg); sg.connect(rv); }
    } else if (L.reverbSec > 0) g.connect(revLegacy(env, L.reverbSec));
    end = Math.max(end, holdEnd + rel);
  });
  return end;
}
function panNode(ctx, p) {
  if (ctx.createStereoPanner) { var s = ctx.createStereoPanner(); s.pan.value = Math.max(-1, Math.min(1, p)); return s; }
  return ctx.createGain();
}

var A = { ctx: null, env: null, bus: null, faintGain: null, faintLP: null, tin: null, voices: [], draftGain: null, draftPan: null, bellBuf: {} };
function audioInit() {
  if (A.ctx) return;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} // K4: iOS silent switch
  var ctx = A.ctx = new AC();
  var lim = ctx.createDynamicsCompressor();
  lim.threshold.value = CONFIG.audio.limiterThreshold; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
  var out = ctx.createGain(); out.gain.value = CONFIG.audio.masterGain;
  A.bus = ctx.createGain(); A.bus.gain.value = Platform.isMuted() ? 0 : 1;           // mute switch: everything goes through here
  A.faintLP = ctx.createBiquadFilter(); A.faintLP.type = 'lowpass'; A.faintLP.frequency.value = 20000; A.faintLP.Q.value = 0.5;
  A.faintGain = ctx.createGain(); A.faintGain.gain.value = 1;                         // faint: master low-pass + fade
  A.bus.connect(A.faintLP); A.faintLP.connect(A.faintGain); A.faintGain.connect(lim); lim.connect(out); out.connect(ctx.destination);
  A.env = makeEnv(ctx, A.bus);
  A.tin = ctx.createGain(); A.tin.gain.value = 0; A.tin.connect(A.bus);              // tinnitus bed (Lv3)
  startAmbience();
  prerenderBells();
}
function audioResume() {
  if (!A.ctx) audioInit();
  if (A.ctx && A.ctx.state !== 'running' && !paused) A.ctx.resume().catch(function () {});
}
function now() { return A.ctx ? A.ctx.currentTime : 0; }
function play(name, opt) { return A.env ? voice(A.env, name, opt) : 0; }
// The echo carries a faint, filtered copy of the bell (あーと's source_filter). Bells are rendered once into buffers.
function prerenderBells() {
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) return;
  dataReady.then(function () {
    ['bell_weak', 'bell_strong'].forEach(function (nm) {
      try {
        var sr = A.ctx.sampleRate, off = new OAC(1, Math.ceil(sr * 2.4), sr), env = makeEnv(off, off.destination);
        voice(env, nm, { at: 0 });
        var p = off.startRendering(); if (p && p.then) p.then(function (b) { A.bellBuf[nm] = b; }).catch(function () {});
        else off.oncomplete = function (e) { A.bellBuf[nm] = e.renderedBuffer; };
      } catch (e) {}
    });
  });
}
function sndEcho(mat, dist, pan, strong) {
  var rid = CONFIG.materials[mat].echo, M = (DATA.sound.echoModel || {})[rid] || {};
  if (!A.ctx || M.play === false || mat === 'hole') return;
  A.voices = A.voices.filter(function (e) { return e > now(); });
  if (A.voices.length >= CONFIG.echo.maxVoices) return;
  var delay = Math.min(M.delayMaxSec || 0.08, dist * (M.delayPerM || 0.003));
  var k = M.rollOff || 0.25, ref = M.gainRefM || 2, gain = (1 + k * ref) / (1 + k * dist);
  var lpHz = Math.max(500, 9000 / (1 + dist * 0.25)), t = now() + 0.008 + delay;
  var end = play(rid, { at: t, pan: pan, gainMul: gain, lowpassHz: lpHz });
  var S = M.source, buf = A.bellBuf[strong ? 'bell_strong' : 'bell_weak'];
  if (S && buf) {
    var ctx = A.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), pn = panNode(ctx, pan);
    s.buffer = buf; f.type = S.filterType; f.frequency.value = S.freqHz; f.Q.value = S.q;
    var pk = Math.max(0.0002, S.gain * gain * level('bell_' + (strong ? 'strong' : 'weak')));
    g.gain.setValueAtTime(pk, t); g.gain.exponentialRampToValueAtTime(0.0001, t + S.decaySec);
    s.connect(f); f.connect(g); g.connect(pn); pn.connect(A.bus); s.start(t); s.stop(t + S.decaySec + 0.05);
    end = Math.max(end, t + S.decaySec);
  }
  if (end) A.voices.push(end);
}
function startAmbience() { // looping beds stay in code (not one-shot recipes)
  var n = A.env.noise.white, s = A.ctx.createBufferSource(); s.buffer = n; s.loop = true;
  var lp = A.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
  var g = A.ctx.createGain(); g.gain.value = 0.012; s.connect(lp); lp.connect(g); g.connect(A.bus); s.start();
  var d = A.ctx.createBufferSource(); d.buffer = n; d.loop = true;
  var bp = A.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 1.5;
  var lfo = A.ctx.createOscillator(); lfo.frequency.value = 0.17; var lg = A.ctx.createGain(); lg.gain.value = 250; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
  A.draftGain = A.ctx.createGain(); A.draftGain.gain.value = 0; A.draftPan = panNode(A.ctx, 0);
  d.connect(bp); bp.connect(A.draftGain); A.draftGain.connect(A.draftPan); A.draftPan.connect(A.bus); d.start();
}
function updateAmbience() {
  if (!A.ctx || !A.draftGain) return;
  var dx = MAP.draft.x - P.x, dist = Math.hypot(dx, MAP.draft.y - P.y);
  A.draftGain.gain.setTargetAtTime(started ? 0.05 / (1 + dist * 0.3) : 0, now(), 0.3);
  if (A.draftPan.pan) A.draftPan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, dx / 6)), now(), 0.3);
}
function setMuted(m) {
  document.getElementById('muted').classList.toggle('show', m);
  if (A.bus) A.bus.gain.setTargetAtTime(m ? 0 : 1, now(), 0.02);
  if (m) vibrateStop();
}
Platform.onMuteChange(setMuted);
function faintAudio(out) { // あーと faint_out / faint_in: master low-pass + fade, silence, back with the room air
  if (!A.ctx) return;
  var t = now(), F = CONFIG.faint, g = A.faintGain.gain, f = A.faintLP.frequency;
  g.cancelScheduledValues(t); f.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t); f.setValueAtTime(Math.max(40, f.value), t);
  if (out) { f.setValueAtTime(8000, t); f.exponentialRampToValueAtTime(200, t + F.outSec); g.exponentialRampToValueAtTime(0.0001, t + F.outSec); play('faint_out'); }
  else { f.setValueAtTime(300, t); f.exponentialRampToValueAtTime(20000, t + F.inSec); g.exponentialRampToValueAtTime(1, t + F.inSec); play('faint_in'); }
}

/* Voice (Japanese only, VOICEVOX:玄野武宏(CV:ガロ)): loaded per stage in the background after play starts.
   No file / not loaded yet / decode error = subtitles only. Muted = not played. English never requests anything. */
var Voice = {
  buffers: {}, sec: {}, stage: null,
  on: function () { return CONFIG.voice.langs.indexOf(LANG) >= 0; },
  loadStage: function (td) {
    if (!this.on() || !td || !A.ctx || this.stage === td.stage) return;
    this.stage = td.stage;
    var self = this, base = CONFIG.voice.base + LANG + '/', a = document.createElement('audio');
    var opus = a.canPlayType && a.canPlayType('audio/ogg; codecs=opus') !== '';
    fetch(base + 'manifest.json').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (m) {
      td.lines.forEach(function (l) {
        var e = m.lines && m.lines[l.id]; if (!e) return;
        var order = opus ? [e.ogg, e.m4a] : [e.m4a, e.ogg];
        (function tryNext(i) {
          if (i >= order.length || !order[i]) return;
          fetch(base + order[i]).then(function (r) { if (!r.ok) throw 0; return r.arrayBuffer(); })
            .then(function (ab) { return new Promise(function (ok, ng) { A.ctx.decodeAudioData(ab, ok, ng); }); })
            .then(function (b) { self.buffers[l.id] = b; self.sec[l.id] = b.duration; })
            .catch(function () { tryNext(i + 1); });
        })(0);
      });
    }).catch(function () {});
  },
  play: function (id) { // true if a voice started
    var b = this.buffers[id]; if (!b || !A.ctx || Platform.isMuted()) return false;
    var s = A.ctx.createBufferSource(), g = A.ctx.createGain(); g.gain.value = CONFIG.voice.gain;
    s.buffer = b; s.connect(g); g.connect(A.bus); s.start(now() + 0.05);
    /*@TEST*/ TestVoice.played.push(id); /*@END_TEST*/
    return true;
  }
};

/* ===================== 7. Subtitles (HTML overlay; ja vertical, en horizontal) ===================== */
// ja: '|' marks the only places a column may break. Each piece is one no-wrap span; the '|' itself is never shown.
var subEl = document.getElementById('sub');
subEl.className = LANG === 'ja' ? 'ja' : 'en';
function clean(s) { return String(s).replace(/\|/g, ''); }
function renderLine(text) {
  while (subEl.firstChild) subEl.removeChild(subEl.firstChild);
  var parts = LANG === 'ja' ? String(text).split('|') : clean(text).split(' ');
  subEl.style.fontSize = '';
  parts.forEach(function (p, i) {
    if (i > 0) subEl.appendChild(LANG === 'ja' ? document.createElement('wbr') : document.createTextNode(' '));
    var seg = document.createElement('span'); seg.className = 'seg';
    for (var k = 0; k < p.length; k++) { var ch = document.createElement('span'); ch.className = 'ch'; ch.textContent = p[k]; seg.appendChild(ch); }
    subEl.appendChild(seg);
  });
  fitSubtitle();
}
function fitSegments() { // a piece longer than one column may wrap inside itself rather than run off the screen
  if (LANG !== 'ja') return;
  var max = parseFloat(getComputedStyle(subEl).maxHeight) || innerHeight;
  [].forEach.call(subEl.querySelectorAll('.seg'), function (s) { s.classList.remove('long'); if (s.getBoundingClientRect().height > max + 1) s.classList.add('long'); });
}
function boxesOverlap(a, b) { return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom); }
function fitSubtitle() { // P0.2-1: keep the subtitle above the control pictures; shrink the type if it still overlaps or leaves the screen
  fitSegments();
  if (!subEl.firstChild) return;
  var howto = document.getElementById('howto'), minPx = LANG === 'ja' ? 16 : 14, i;
  for (i = 0; i < 10; i++) {
    var sr = subEl.getBoundingClientRect(), icons = [];
    if (howto && howto.classList.contains('show')) {
      [].forEach.call(howto.querySelectorAll('.hi'), function (e) {
        if (parseFloat(getComputedStyle(e).opacity) > 0.01) icons.push(e.getBoundingClientRect());
      });
    }
    var overlap = icons.some(function (ir) { return boxesOverlap(ir, sr); });
    var off = sr.top < -0.5 || sr.left < -0.5 || sr.right > innerWidth + 0.5 || sr.bottom > innerHeight + 0.5;
    if (!overlap && !off) return;
    var fs = parseFloat(getComputedStyle(subEl).fontSize);
    if (fs <= minPx + 0.01) return;
    subEl.style.fontSize = Math.max(minPx, fs - 1) + 'px';
    if (LANG === 'ja') fitSegments();
  }
}
window.addEventListener('resize', function () { if (subEl.firstChild) fitSubtitle(); });
var autoBellIn = -1; // seconds of unpaused time left until Tatsuo's intro bell; -1 = not armed
var Sub = {
  queue: [], cur: null, t: 0, shown: {}, alpha: 0, glitch: false, hold: null,
  openingFinished: false, pendingBell: false, bellSeen: false, faded: false,
  opening: function () {
    var base = (DATA.text && DATA.text.opening) || [], e = Echo.forHook('s1_after_01'), out = [], i;
    for (i = 0; i < base.length; i++) { out.push(base[i]); if (e && base[i] === 's1_line_01') out.push(e.id); }
    return out;
  },
  autoBellDelay: function () { var d = DATA.text && DATA.text.autoBellDelaySec; return d != null ? d : CONFIG.intro.autoBellDelay; },
  startOpening: function () { // driven by the opening list in s1.json (insert e1a / e1b between 01 and 02 later)
    this.openingFinished = false; this.pendingBell = false; this.bellSeen = false; autoBellIn = -1;
    var ids = this.opening();
    if (ids.length) this.push(ids[0]);
    else { this.openingFinished = true; autoBellIn = this.autoBellDelay(); }
  },
  byTrigger: function (tr, front) {
    if (tr === 'first_bell') {
      this.bellSeen = true; autoBellIn = -1;
      if (!this.openingFinished) { this.pendingBell = true; return; }
    }
    if (!DATA.text) return; var self = this;
    DATA.text.lines.forEach(function (l) { if (l.trigger === tr) self.push(l.id, front); });
  },
  push: function (id, front) { if (this.shown[id]) return; this.shown[id] = true; if (front) this.queue.unshift(id); else this.queue.push(id); },
  line: function (id) {
    var L = DATA.text && DATA.text.lines, E = DATA.prologue && DATA.prologue.echoes, i;
    for (i = 0; L && i < L.length; i++) if (L[i].id === id) return L[i];
    for (i = 0; E && i < E.length; i++) if (E[i].id === id) return E[i];
    return null;
  },
  holdTime: function (l) {
    if (LANG === 'ja') return Math.max(CONFIG.text.holdJa, this.voiced ? this.voiced + CONFIG.voice.tailSec - CONFIG.text.fadeIn : 0); // stay up while the voice speaks
    return Math.max(CONFIG.text.holdEnMin, Math.min(CONFIG.text.holdEnMax, l.en.length / CONFIG.text.enCharsPerSec));
  },
  show: function (l) {
    this.cur = l; this.t = 0; this.glitch = false; this.faded = false; renderLine(l[LANG]); subEl.dataset.id = l.id; this.voiced = Voice.play(l.id) ? Voice.sec[l.id] : 0;
    /*@TEST*/ TestSub.log.push({ id: l.id, event: 'show', at: simTime, voiced: this.voiced || 0 }); /*@END_TEST*/
  },
  update: function (dt) {
    var T = CONFIG.text;
    if (!this.cur && this.queue.length) { var l = this.line(this.queue.shift()); if (l) this.show(l); }
    if (!this.cur) { this.alpha = 0; return; }
    this.t += dt;
    /*@TEST*/ if (this.hold) this.t = T.fadeIn + 0.01; /*@END_TEST*/
    var h = this.holdTime(this.cur), t = this.t;
    if (t < T.fadeIn) this.alpha = t / T.fadeIn;
    else if (t < T.fadeIn + h) this.alpha = 1;
    else this.alpha = Math.max(0, 1 - (t - T.fadeIn - h) / T.fadeOut);
    this.setGlitch(heartLevel(heart.bpm) >= 3 && !SETTINGS.reduceFlash);
    if (!this.faded && t > T.fadeIn + h + T.fadeOut) { this.faded = true; this.onFadeOut(this.cur.id); }
    if (t > T.fadeIn + h + T.fadeOut + T.gap) {
      var done = this.cur.id; this.cur = null; while (subEl.firstChild) subEl.removeChild(subEl.firstChild); delete subEl.dataset.id; subEl.style.fontSize = '';
      this.onLineDone(done);
    }
  },
  onFadeOut: function (id) { // subtitle gone (voice already finished: holdTime covers it)
    /*@TEST*/ TestSub.log.push({ id: id, event: 'fadeOut', at: simTime }); TestSub.lineDoneAt[id] = simTime; /*@END_TEST*/
    var ids = this.opening(), last = ids.length ? ids[ids.length - 1] : null;
    if (id === last) { this.openingFinished = true; if (!this.bellSeen) autoBellIn = this.autoBellDelay(); }
  },
  onLineDone: function (id) {
    /*@TEST*/ TestSub.log.push({ id: id, event: 'done', at: simTime }); /*@END_TEST*/
    var ids = this.opening(), i = ids.indexOf(id);
    if (i >= 0 && i + 1 < ids.length) { this.push(ids[i + 1]); return; }
    if (i >= 0 && i + 1 === ids.length) { if (this.pendingBell) { this.pendingBell = false; this.byTrigger('first_bell'); } return; }
    this.byTrigger('after:' + id);
  },
  setGlitch: function (on) { // Lv3: a fixed share of characters fade and double (no blinking; most of the line stays readable)
    if (on === this.glitch) return; this.glitch = on;
    var chs = [].slice.call(subEl.querySelectorAll('.ch')), n = Math.floor(chs.length * CONFIG.fx.glitchShare);
    chs.forEach(function (c) { c.classList.remove('gx'); });
    if (!on) return;
    for (var i = 0; i < n; i++) chs[(i * 7 + 3) % chs.length].classList.add('gx'); // spread out, stable per line
  },
  reset: function () {
    this.queue = []; this.cur = null; this.shown = {}; this.alpha = 0;
    this.openingFinished = false; this.pendingBell = false; this.bellSeen = false; this.faded = false; autoBellIn = -1;
    while (subEl.firstChild) subEl.removeChild(subEl.firstChild); subEl.style.opacity = 0; subEl.style.fontSize = '';
    /*@TEST*/ TestSub.log = []; TestSub.autoBellAt = -1; TestSub.lineDoneAt = {}; /*@END_TEST*/
  }
};

/* ===================== 7b. Control pictures (decision 2: no instructions, one picture per action, gone once used) ===================== */
var Howto = {
  el: document.getElementById('howto'), left: {},
  build: function () {
    var dev = Platform.getDevice() === 'mobile' ? 'mobile' : 'pc', self = this;
    this.el.className = dev + ' ' + LANG;
    ['move', 'tap', 'hold', 'release'].forEach(function (k) {
      var d = document.createElement('div'); d.className = 'hi hi-' + k;
      var im = document.createElement('img'); im.src = 'ui/howto_' + dev + '_' + k + '.webp'; im.alt = ''; im.draggable = false;
      var lb = document.createElement('div'); lb.className = 'hl';
      var txt = UI && UI.howto ? UI.howto[(dev === 'pc' ? 'pc_' : '') + k] || UI.howto[k] : '';
      txt.split('|').forEach(function (seg) { var sp = document.createElement('span'); sp.textContent = seg; sp.style.whiteSpace = LANG === 'ja' ? 'nowrap' : 'normal'; lb.appendChild(sp); });
      d.appendChild(im); d.appendChild(lb); self.el.appendChild(d); self.left[k] = d;
    });
  },
  start: function () { for (var k in this.left) this.left[k].classList.remove('used'); this.el.classList.add('show'); },
  used: function (k) { var d = this.left[k]; if (d && !d.classList.contains('used')) d.classList.add('used'); },
  hide: function () { this.el.classList.remove('show'); }
};
function setText(id, t) { var el = document.getElementById(id); if (el) el.textContent = t == null ? '' : t; }
function applyUiText() {
  var tEl = document.getElementById('title'), sEl = document.getElementById('subtitle');
  if (CONFIG.title.image) { // swap-in point for the title art (not used until approved)
    tEl.textContent = ''; var im = document.createElement('img'); im.src = CONFIG.title.image; im.alt = UI ? UI.title : ''; im.className = 'titleimg'; tEl.appendChild(im); sEl.textContent = '';
  } else if (UI) { tEl.textContent = UI.title; sEl.textContent = UI.subtitle; }
  if (UI) {
    document.title = UI.titleFull || document.title;
    setText('titlealt', UI.titleAlt); setText('genre', UI.genre); setText('phonestext', UI.headphones);
    var M = UI.menu || {}, D = UI.difficulty || {};
    setText('btn-new', M.newGame); setText('btn-cont', M.cont); setText('btn-credits', M.credits); setText('creditsclose', M.close);
    setText('diffhead', D.head); setText('hardnotetext', D.hardNote); setText('pausediffhead', D.pauseHead);
    CONFIG.difficulty.list.forEach(function (k) {
      setText('diff-' + k + '-l', D[k]); setText('diff-' + k + '-d', D[k + 'Desc']); setText('pdiff-' + k, D[k]);
    });
    var cl = document.getElementById('creditslist');
    if (cl && UI.credits) { cl.innerHTML = ''; UI.credits.forEach(function (t, i) { var d = document.createElement('div'); d.className = i === 0 ? 'ctitle' : (t === '' ? 'cgap' : 'cl'); d.textContent = t; cl.appendChild(d); }); }
  }
  if (UI && UI.credit) {
    var cvEl = document.getElementById('credit-voice') || document.getElementById('credit');
    if (cvEl) cvEl.textContent = UI.credit;
  }
  if (UI && UI.artCredit) { var ca = document.getElementById('credit-art'); if (ca) ca.textContent = UI.artCredit; }
  Howto.build();
  Opening.refresh();
}

/* ===================== 7c. Prologue (plan 1; text from text/prologue.json) ===================== */
var phase = 'title'; // title | prologue | stage1
var Echo = {
  lastAt: -99, pending: null,
  choices: function () { return { c1: Store.get('pro_c1'), c2: Store.get('pro_c2'), c3: Store.get('pro_c3') }; },
  forHook: function (hook) {
    var list = (DATA.prologue && DATA.prologue.echoes) || [], ch = this.choices(), i, e, w, k, ok;
    for (i = 0; i < list.length; i++) {
      e = list[i]; if (e.hook !== hook) continue;
      w = e.when || {}; ok = true;
      for (k in w) if (Object.prototype.hasOwnProperty.call(w, k) && ch[k] !== w[k]) ok = false;
      if (ok) return e;
    }
    return null;
  },
  trigger: function (hook) {
    var e = this.forHook(hook), gap = (DATA.prologue && DATA.prologue.echoGapSec) || 2;
    /*@TEST*/ TestPro.log.push({ event: 'echo', hook: hook, id: e ? e.id : null, at: simTime }); /*@END_TEST*/
    if (!e) return null;
    if (phase === 'stage1') {
      if (hook === 's3_desk_bell' && this.lastAt >= 0 && simTime - this.lastAt < gap) this.pending = { e: e, at: simTime + (gap - (simTime - this.lastAt)) };
      else { Sub.push(e.id); this.lastAt = simTime; }
    }
    return e.id;
  },
  tick: function () {
    if (this.pending && simTime >= this.pending.at) { Sub.push(this.pending.e.id); this.lastAt = simTime; this.pending = null; }
  }
};
var Prologue = {
  on: false, i: -1, stepId: null, mode: null, t: 0,
  line: null, lineT: 0, lineHold: 0, advanceAt: 0, eatUntil: 0,
  panT: 0, panP: 0, panPhase: '', artA: 0, titleA: 0, dimA: 0, fadeBlack: 0, artFade: 0,
  artOk: false, artFailed: false, artStarted: false, img: null, titleImg: null,
  chosen: { c1: null, c2: null, c3: null },
  loadArt: function () {
    if (this.artStarted) return;
    this.artStarted = true;
    var self = this, C = CONFIG.prologue;
    this.img = new Image();
    this.img.onload = function () { self.artOk = true; };
    this.img.onerror = function () { self.artFailed = true; };
    this.img.src = C.art;
    this.titleImg = new Image();
    this.titleImg.onload = function () { var el = document.getElementById('protitle'); if (el && !el.src) el.src = self.titleImg.src; };
    this.titleImg.src = LANG === 'ja' ? C.titleJa : C.titleEn;
    var tel = document.getElementById('protitle'); if (tel) tel.src = this.titleImg.src;
  },
  failArt: function () { this.artOk = false; this.artFailed = true; },
  start: function () {
    phase = 'prologue'; this.on = true; this.booted = false; this.i = -1; this.chosen = { c1: null, c2: null, c3: null };
    this.artA = 0; this.titleA = 0; this.dimA = 0; this.fadeBlack = 0; this.artFade = 0; this.panP = 0; this.stepId = null; this.mode = null;
    this.advanceAt = 0; this.eatUntil = performance.now() + 500;
    document.getElementById('pro').classList.add('on');
    document.getElementById('pro').setAttribute('aria-hidden', 'false');
    this.loadArt();
    this.hideChoices(); this.hideNext(); this.hideLine(); this.applyTitle();
  },
  boot: function () {
    if (this.booted || !DATA.ready) return;
    if (!DATA.prologue || !this.steps().length) { startStage1(); return; }
    this.booted = true; this.i = -1;
    ['c1', 'c2', 'c3'].forEach(function (k) { try { localStorage.removeItem('nk_pro_' + k); } catch (e) {} });
    /*@TEST*/ TestPro.log = []; /*@END_TEST*/
    this.next();
  },
  stop: function () {
    this.on = false; this.hideChoices(); this.hideNext(); this.hideLine(); this.titleA = 0; this.applyTitle();
    var el = document.getElementById('pro'); if (el) { el.classList.remove('on'); el.setAttribute('aria-hidden', 'true'); }
    subEl.classList.remove('pro-inn');
  },
  steps: function () { return (DATA.prologue && DATA.prologue.steps) || []; },
  goto: function (id) {
    var steps = this.steps(), i;
    if (!this.booted) this.boot();
    for (i = 0; i < steps.length; i++) if (steps[i].id === id) { this.i = i - 1; this.next(); return true; }
    return false;
  },
  next: function () {
    var steps = this.steps();
    this.i++;
    while (this.i < steps.length) {
      var s = steps[this.i];
      if (s.wait === 'line' && s.choice && this.chosen[s.choice] !== s.value) { this.i++; continue; }
      this.enter(s); return;
    }
    this.finish();
  },
  enter: function (s) {
    this.stepId = s.id; this.t = 0; this.mode = s.wait; this.fadeBlack = s.fade === 'black' ? 0.0001 : this.fadeBlack;
    /*@TEST*/ TestPro.log.push({ id: s.id, event: 'enter', at: simTime }); /*@END_TEST*/
    if (s.sfx) s.sfx.forEach(function (n) { play(n); });
    if (s.inn === 'fadeout') this.artFade = 0.0001;
    if (s.wait === 'next' || s.wait === 'start') this.advanceAt = simTime + (CONFIG.prologue.advanceLockSec || 0.9);
    if (s.wait === 'pan') { this.hideLine(); this.hideNext(); this.hideChoices(); this.startPan(); return; }
    if (s.wait === 'choice') { this.hideLine(); this.hideNext(); this.showChoices(s); return; }
    this.hideChoices(); this.showLine(s);
    this.showNextBtn(false); // shown once the advance lock ends
  },
  showLine: function (s) {
    renderLine(s[LANG] || s.en || '');
    subEl.dataset.id = s.id;
    if (s.on === 'inn') subEl.classList.add('pro-inn'); else subEl.classList.remove('pro-inn');
    this.line = s; this.lineT = 0;
    this.lineHold = LANG === 'ja' ? CONFIG.text.holdJa : Math.max(CONFIG.text.holdEnMin, Math.min(CONFIG.text.holdEnMax, String(s.en || '').length / CONFIG.text.enCharsPerSec));
  },
  hideLine: function () {
    this.line = null; subEl.style.opacity = 0; delete subEl.dataset.id;
    while (subEl.firstChild) subEl.removeChild(subEl.firstChild);
    subEl.classList.remove('pro-inn');
  },
  showNextBtn: function (on) { document.getElementById('pronext').classList.toggle('on', !!on); },
  hideNext: function () { this.showNextBtn(false); },
  showChoices: function (s) {
    var box = document.getElementById('prochoices'); box.innerHTML = '';
    ['A', 'B'].forEach(function (v) {
      var b = document.createElement('button'); b.type = 'button'; b.dataset.value = v;
      b.textContent = (s[v] && s[v][LANG]) || (s[v] && s[v].en) || v;
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); Prologue.choose(v); });
      box.appendChild(b);
    });
    box.classList.add('on');
    if (s.on === 'inn') subEl.classList.add('pro-inn');
  },
  hideChoices: function () { var box = document.getElementById('prochoices'); box.classList.remove('on'); box.innerHTML = ''; },
  choose: function (v) {
    if (!this.on || this.mode !== 'choice' || (v !== 'A' && v !== 'B')) return;
    var s = this.steps()[this.i];
    Store.set('pro_' + s.id, v); this.chosen[s.id] = v;
    /*@TEST*/ TestPro.log.push({ id: s.id, event: 'choose', value: v, at: simTime }); /*@END_TEST*/
    this.hideChoices(); this.next();
  },
  eatingStart: function () { return this.eatUntil && performance.now() < this.eatUntil; },
  consumeStart: function () { this.eatUntil = 0; },
  canAdvance: function () {
    if (!this.on || paused) return false;
    if ((this.mode === 'next' || this.mode === 'start') && simTime < this.advanceAt) return false;
    return this.mode === 'next' || this.mode === 'start' || this.mode === 'pan';
  },
  advance: function () {
    if (!this.on || paused) return;
    if (this.mode === 'pan') { this.skipPanToEnd(); return; }
    if ((this.mode === 'next' || this.mode === 'start') && simTime < this.advanceAt) return;
    if (this.mode === 'next' || this.mode === 'start') this.next();
  },
  skipAll: function () {
    if (!this.on) return;
    ['c1', 'c2', 'c3'].forEach(function (k) { if (!Store.get('pro_' + k)) Store.set('pro_' + k, 'A'); });
    this.chosen.c1 = Store.get('pro_c1'); this.chosen.c2 = Store.get('pro_c2'); this.chosen.c3 = Store.get('pro_c3');
    /*@TEST*/ TestPro.log.push({ event: 'skip', at: simTime, chosen: Object.assign({}, this.chosen) }); /*@END_TEST*/
    this.finish();
  },
  finish: function () { this.stop(); startStage1(); },
  startPan: function () {
    this.panT = 0; this.panP = 0; this.artA = 0; this.titleA = 0; this.dimA = 0; this.panPhase = 'fadein';
    this.applyTitle();
    /*@TEST*/ TestPro.log.push({ event: 'panStart', at: simTime, artOk: this.artOk }); /*@END_TEST*/
  },
  skipPanToEnd: function () {
    var C = CONFIG.prologue;
    this.panP = 1; this.artA = this.artOk ? 1 : 0; this.titleA = 0; this.dimA = this.artOk ? C.dim : 0; this.panPhase = 'done';
    this.applyTitle();
    /*@TEST*/ TestPro.log.push({ event: 'panSkip', at: simTime }); /*@END_TEST*/
    this.next();
  },
  updatePan: function (dt) {
    var C = CONFIG.prologue, t, u, ti = C.titleFadeInSec, th = C.titleHoldSec, to = C.titleFadeOutSec;
    this.panT += dt; t = this.panT;
    if (this.artOk && this.img && this.img.naturalWidth) {
      if (t < C.fadeInSec) { this.panPhase = 'fadein'; this.artA = t / C.fadeInSec; this.panP = 0; }
      else if (t < C.fadeInSec + C.panSec) {
        this.panPhase = 'pan'; this.artA = 1; u = (t - C.fadeInSec) / C.panSec; this.panP = u * u * (3 - 2 * u);
      } else {
        this.artA = 1; this.panP = 1; u = t - (C.fadeInSec + C.panSec);
        if (u < ti) { this.panPhase = 'title'; this.titleA = u / ti; }
        else if (u < ti + th) { this.panPhase = 'title'; this.titleA = 1; }
        else if (u < ti + th + to) { this.panPhase = 'title'; this.titleA = 1 - (u - ti - th) / to; }
        else if (u < ti + th + to + C.dimSec) { this.panPhase = 'dim'; this.titleA = 0; this.dimA = C.dim * ((u - ti - th - to) / C.dimSec); }
        else { this.dimA = C.dim; this.titleA = 0; if (this.panPhase !== 'done') { this.panPhase = 'done'; /*@TEST*/ TestPro.log.push({ event: 'panDone', at: simTime, panT: this.panT }); /*@END_TEST*/ this.next(); } }
      }
    } else {
      // no picture: black + title only, then continue
      this.artA = 0; this.panP = 1;
      if (t < ti) { this.panPhase = 'title'; this.titleA = t / ti; }
      else if (t < ti + th) { this.panPhase = 'title'; this.titleA = 1; }
      else if (t < ti + th + to) { this.panPhase = 'title'; this.titleA = 1 - (t - ti - th) / to; }
      else { this.titleA = 0; if (this.panPhase !== 'done') { this.panPhase = 'done'; /*@TEST*/ TestPro.log.push({ event: 'panDone', at: simTime, fallback: true, panT: this.panT }); /*@END_TEST*/ this.next(); } }
    }
    this.applyTitle();
  },
  applyTitle: function () {
    var w = document.getElementById('protitlewrap'); if (!w) return;
    w.style.opacity = this.titleA ? String(this.titleA) : '0';
    this.placeTitle(w);
  },
  placeTitle: function (w) {
    var C = CONFIG.prologue, pc = Platform.getDevice() === 'desktop', desired = pc ? C.titleTopWide : C.titleTop;
    w.classList.toggle('wide', !!pc);
    w.style.top = (desired * 100) + '%';
    w.style.transform = 'translate(-50%,-50%)';
    if (!pc || !this.artOk || !this.img) return;
    var L = this.layout(), y0 = L.yEnd, s = L.s, x0 = L.x0, vh = H_, vw = W_;
    var img = document.getElementById('protitle');
    if (img) { img.style.maxHeight = ''; img.style.maxWidth = ''; }
    var natH = (img && img.naturalHeight) || 112, natW = (img && img.naturalWidth) || 621;
    var capH = Math.min(vh * 0.24, natH), capW = Math.min(vw * 0.74, natW);
    var scale0 = Math.min(capH / natH, capW / natW, 1), th = natH * scale0, tw = natW * scale0;
    var avoid = [{ x0: 400, y0: 700, x1: 590, y1: 850 }, { x0: 280, y0: 960, x1: 1320, y1: 1600 }];
    function hits(cy, h, wdt) {
      var top = cy - h / 2, bot = cy + h / 2, left = vw / 2 - wdt / 2, right = vw / 2 + wdt / 2, i, a, sy0, sy1, sx0, sx1;
      if (top < 8 || bot > vh - 8) return true;
      for (i = 0; i < avoid.length; i++) {
        a = avoid[i];
        sy0 = (a.y0 - y0) * s; sy1 = (a.y1 - y0) * s;
        sx0 = x0 + (a.x0 - L.srcX) * s; sx1 = x0 + (a.x1 - L.srcX) * s;
        if (top < sy1 && bot > sy0 && left < sx1 && right > sx0) return true;
      }
      return false;
    }
    function applySize(h) {
      th = h; tw = natW * (h / natH);
      if (img) { img.style.maxHeight = h + 'px'; img.style.maxWidth = tw + 'px'; }
    }
    var cy = desired * vh, minH = Math.max(36, vh * 0.07), h, i;
    applySize(th);
    if (hits(cy, th, tw)) {
      h = th;
      while (h > minH && hits(cy, h, natW * (h / natH))) h -= 2;
      applySize(h);
    }
    if (!hits(cy, th, tw)) { w.style.top = cy + 'px'; return; }
    for (i = 1; i <= Math.ceil(vh); i += 2) {
      if (cy + i <= vh - 8 && !hits(cy + i, th, tw)) { w.style.top = (cy + i) + 'px'; return; }
      if (cy - i >= 8 && !hits(cy - i, th, tw)) { w.style.top = (cy - i) + 'px'; return; }
    }
    w.style.top = cy + 'px';
  },
  update: function (dt) {
    if (!this.on) return;
    if (!this.booted) { this.boot(); if (!this.booted) return; }
    this.t += dt;
    if (this.mode === 'pan') this.updatePan(dt);
    if (this.artFade > 0) { this.artFade += dt; this.artA = Math.max(0, 1 - this.artFade / CONFIG.prologue.artFadeOutSec); this.dimA *= this.artA; if (this.artA <= 0) { this.artFade = 0; this.dimA = 0; } }
    if (this.fadeBlack > 0) this.fadeBlack += dt;
    if (this.line) {
      var T = CONFIG.text, h = this.lineHold, t;
      this.lineT += dt; t = this.lineT;
      subEl.style.opacity = String(t < T.fadeIn ? t / T.fadeIn : t < T.fadeIn + h ? 1 : Math.max(0, 1 - (t - T.fadeIn - h) / T.fadeOut));
      if ((this.mode === 'auto' || this.mode === 'line') && t > T.fadeIn + h + T.fadeOut + T.gap) {
        if (this.line.fade === 'black') { this.hideLine(); this.finish(); }
        else this.next();
      }
    }
    if ((this.mode === 'next' || this.mode === 'start') && this.canAdvance()) this.showNextBtn(true);
  },
  layout: function () {
    var vw = W_, vh = H_, imgW = (this.img && this.img.naturalWidth) || 1600, imgH = (this.img && this.img.naturalHeight) || 2400;
    var pc = Platform.getDevice() === 'desktop', s, bandW, x0, srcW, srcX, srcH, maxS = CONFIG.prologue.maxScale;
    if (pc) {
      s = 1; if (imgW * s > vw) s = vw / imgW; if (s > maxS) s = maxS;
      bandW = imgW * s; x0 = (vw - bandW) / 2; srcW = imgW; srcX = 0; srcH = Math.min(imgH, vh / s);
    } else {
      s = Math.max(vw / imgW, (vh * CONFIG.prologue.panMinHeight) / imgH);
      bandW = Math.min(vw, imgW * s); x0 = (vw - bandW) / 2; srcW = bandW / s; srcX = (imgW - srcW) / 2; srcH = Math.min(imgH, vh / s);
    }
    var yStart = Math.max(0, imgH - srcH), yEnd = 0, endBottom = yStart + srcH;
    if (pc && CONFIG.prologue.panEndBottom) {
      endBottom = Math.min(imgH, CONFIG.prologue.panEndBottom);
      yEnd = Math.max(0, endBottom - srcH);
    }
    return { s: s, x0: x0, bandW: bandW, srcX: srcX, srcW: srcW, srcH: srcH, pan: yStart, yStart: yStart, yEnd: yEnd, endBottom: endBottom };
  },
  render: function (c) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    if (this.artA > 0 && this.img && this.img.naturalWidth) {
      var L = this.layout(), y0 = L.yStart + (L.yEnd - L.yStart) * this.panP, dpr = DPR;
      c.save(); c.globalAlpha = this.artA;
      c.drawImage(this.img, L.srcX, y0, L.srcW, L.srcH, L.x0 * dpr, 0, L.bandW * dpr, H_ * dpr);
      var fade = Math.min(80, L.bandW * 0.08) * dpr, xL = L.x0 * dpr, xR = (L.x0 + L.bandW) * dpr, g;
      if (L.x0 > 0.5) { g = c.createLinearGradient(xL, 0, xL + fade, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(xL, 0, fade, cv.height); }
      if (L.x0 + L.bandW < W_ - 0.5) { g = c.createLinearGradient(xR - fade, 0, xR, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = g; c.fillRect(xR - fade, 0, fade, cv.height); }
      if (this.dimA > 0) { c.fillStyle = 'rgba(0,0,0,' + this.dimA + ')'; c.fillRect(0, 0, cv.width, cv.height); }
      c.restore();
    }
    if (this.fadeBlack > 0) { c.fillStyle = 'rgba(0,0,0,' + Math.min(1, this.fadeBlack / 1.6).toFixed(3) + ')'; c.fillRect(0, 0, cv.width, cv.height); }
  }
};
function swallowStartGesture(e) {
  if (!Prologue.on || !Prologue.eatingStart()) return false;
  Prologue.consumeStart();
  e.preventDefault(); e.stopPropagation();
  return true;
}
document.addEventListener('pointerup', swallowStartGesture, true);
document.addEventListener('click', swallowStartGesture, true);
document.addEventListener('touchend', swallowStartGesture, true);
document.getElementById('pronext').addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); if (swallowStartGesture(e)) return; Prologue.advance(); });
document.getElementById('proskip').addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); Prologue.skipAll(); });
document.getElementById('pro').addEventListener('click', function (e) {
  if (swallowStartGesture(e)) return;
  if (e.target === this || e.target.id === 'protitlewrap' || e.target.id === 'protitle') Prologue.advance();
});

/* ===================== 8. State ===================== */
var P = { x: MAP.start.x, y: MAP.start.y, moving: false, stepT: 0, touchT: 0, area: 'bedroom' };
var started = false, paused = false, clearing = 0, simTime = 0, playTime = 0, readyMarked = false;
var ripples = [], glows = [], auraTouch = [];
var cool = { weak: 0, strong: 0 };
function newHeart() {
  return { bpm: CONFIG.heart.start, still: 0, sinceBell: 0, resting: false, inputSinceRest: false,
           nextBeat: -1, pending: [], lastLub: -99, lubs: 0, tinNext: -1, breathNext: -1, shallowNext: -1 };
}
var heart = newHeart(), monoDone = false, faint = null;
var fx = { I: 0.16, lvS: 0, darkS: 0 };
function newStats() { return { weak: 0, strong: 0, auto: 0, ripples: 0, moved: 0, clears: 0, firstBell: -1, clearTime: -1, maxBpm: CONFIG.heart.start, recoveries: 0, faints: 0, inputs: 0, monoAt: -1 }; }
var stats = newStats();
/* Difficulty (ch. 2): saved as nk_difficulty. The active one is fixed when a stage starts; a change from the pause menu waits for the next stage. */
function validDiff(d) { return CONFIG.difficulty.list.indexOf(d) >= 0 ? d : CONFIG.difficulty.def; }
var DIFF = validDiff(Store.get('difficulty'));
function diffCfg() { return CONFIG.difficulty[DIFF]; }
/* Bell life B (ch. 3): cracks. Weak ring never depends on this (always possible = no soft-lock). */
var Bell = {
  d: CONFIG.bell.life.max, lastRing: -99, brokenUntil: -1, brokenCount: 0,
  reset: function () { this.d = CONFIG.bell.life.max; this.lastRing = -99; this.brokenUntil = -1; },
  broken: function () { return this.brokenUntil >= 0; },
  canStrong: function () { return !this.broken() && this.d >= CONFIG.bell.life.strongMin; },
  muddy: function () { return this.broken() ? 2 : this.d <= CONFIG.bell.life.muddyAtOrBelow ? 1 : 0; },
  stage: function () { var L = CONFIG.bell.life; return this.broken() ? 3 : this.d >= L.crack1Below ? 0 : this.d >= L.crack2Below ? 1 : 2; },
  spend: function (kind) {
    var L = CONFIG.bell.life; this.lastRing = simTime;
    if (this.broken()) return;                                   // broken: weak still rings (muddy), costs nothing
    this.d = Math.max(0, this.d - (kind === 'strong' ? L.strongCost : L.weakCost));
    if (this.d <= 0) { this.d = 0; this.brokenUntil = simTime + L.breakSec; this.brokenCount++; }
  },
  update: function (dt) {
    var L = CONFIG.bell.life;
    if (this.broken()) { if (simTime >= this.brokenUntil) { this.brokenUntil = -1; this.d = L.afterBreak; } return; }
    if (simTime - this.lastRing >= L.regenDelaySec) this.d = Math.min(L.max, this.d + (L.regenPerSec[DIFF] || L.regenPerSec.easy) * dt);
  }
};
var bellEl = document.getElementById('bellui');
function renderBellUi() {
  if (!bellEl) return;
  var on = started && phase === 'stage1';
  bellEl.classList.toggle('show', on);
  if (!on) return;
  var st = Bell.stage(), cls = 'bs' + st + (Bell.canStrong() ? '' : ' nostrong');
  if (bellEl.getAttribute('data-c') !== cls) { bellEl.setAttribute('data-c', cls); bellEl.className = 'show ' + cls; Howto.el.classList.toggle('nostrong', !Bell.canStrong()); }
  var L = CONFIG.bell.life, k = st === 3 ? L.iconShakePx : 0;
  bellEl.style.opacity = st === 3 ? String(L.iconDim * 0.72) : '';
  bellEl.style.transform = k ? 'translate(' + (k * Math.sin(simTime * 37)).toFixed(2) + 'px,' + (k * Math.sin(simTime * 29 + 1)).toFixed(2) + 'px)' : '';
}
var introBellAt = -1, textStartAt = -1; // introBellAt kept only so clearFx can cancel a pending intro bell
function heartLevel(b) { var L = CONFIG.heart.levels; return b >= L[2] ? 3 : b >= L[1] ? 2 : b >= L[0] ? 1 : 0; }
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function lerp(a, b, t) { return a + (b - a) * t; }

/* ===================== 8b. Heartbeat: sound (K6), vibration, pulse data ===================== */
var HB = null, PULSE = null;
function buildPulse() {
  var hb = DATA.sound.heartbeat || {}, st = hb.stages || [];
  var s0 = st[0] || { typical_bpm: 72, peak_db: -18, freq_scale: 1, lowpass_hz: 160 }, s1 = st[st.length - 1] || { typical_bpm: 180, peak_db: -10, freq_scale: 0.82, lowpass_hz: 90 };
  HB = { ratio: (hb.pattern && hb.pattern.dubOffsetRatio) || 0.3, lub: (hb.pattern && hb.pattern.lub_name) || 'heart_lub', dub: (hb.pattern && hb.pattern.dub_name) || 'heart_dub',
         b0: s0.typical_bpm, b1: s1.typical_bpm, db0: s0.peak_db, db1: s1.peak_db, f0: s0.freq_scale, f1: s1.freq_scale, lp0: s0.lowpass_hz, lp1: s1.lowpass_hz,
         tin: hb.tinnitus_name || 'heart_tinnitus' };
  var v1 = hb.visual_sync || {}, I = v1.intensities_artistic_0_to_1 || {}, a150 = v1.above_150_bpm || {};
  PULSE = { name: 'visual_sync', lv0: I.Lv0 != null ? I.Lv0 : 0.162, lv1: I.Lv1_lub != null ? I.Lv1_lub : 0.558, lv2: I.Lv2_lub_below_150 != null ? I.Lv2_lub_below_150 : 0.9,
            between: 0.4, from: a150.from_bpm || 150, to: a150.to_bpm || 160, period: a150.swell_period_sec || 1.6,
            swell: { inner: 0.38, outer: 1.20, base: I.over_150_swell != null ? I.over_150_swell : 0.648, darkExtra: 0, lightScale: 1, darkScale: 0.75 }, tint: null };
  // Lv3 (150-160 blend, 160+) model, chosen by ONE setting: CONFIG.pulse.use = key under 'heartbeat' in audio/recipes.json
  // ('visual_sync_v1_1', 'visual_sync_v1_2', later 'visual_sync_v1_3'). Shape = fixed vignette whose depth breathes slowly,
  // painted in an outer colour, plus an optional inner band (position, width, colour) - so "black outside, red-black band inside" works too.
  var v2 = CONFIG.pulse.use && hb[CONFIG.pulse.use];
  if (v2 && v2.fixed_vignette) {
    var fv = v2.fixed_vignette, sc = v2.slow_cycle || {}, ec = v2.edge_color || v2.edge || {}, pick = function () { for (var i = 0; i < arguments.length; i++) if (arguments[i] != null) return arguments[i]; };
    var base = pick(fv.intensity, 0.88);
    PULSE.name = CONFIG.pulse.use;
    PULSE.period = sc.period_sec || PULSE.period;
    PULSE.swell = { fixed: true, inner: pick(fv.inner_radius, 0.22), outer: pick(fv.outer_radius, 1.14), power: pick(fv.power, 0.9),
      amtLight: pick(sc.amount_light, base + (sc.light_extra_intensity || 0)), amtDark: pick(sc.amount_dark, base + (sc.dark_extra_intensity || 0)),
      outerDark: pick(ec.outer_dark_srgb, ec.floor_dark_srgb, [18, 8, 14]), outerLight: pick(ec.outer_light_srgb, ec.floor_light_srgb, [29, 10, 15]), band: null };
    var bd = pick(ec.band_dark_srgb, ec.rim_dark_srgb), rb = v2.red_black_band, ob = v2.outer_black_rim;
    if (rb) { // v1.3 style: red-black band inside, smootherstep inner edge, gaussian outer edge
      PULSE.swell.band = { inner: rb.inner_radius, center: rb.peak_radius, outer: rb.outer_radius, dark: rb.wine_dark_srgb, light: rb.wine_light_srgb,
        amtDark: pick(rb.amount_dark, 1), amtLight: pick(rb.amount_light, 1) };
    } else if (bd) PULSE.swell.band = { center: pick(ec.band_center, ec.rim_center, 0.96), width: pick(ec.band_width, ec.rim_width, 0.07),
      amtDark: pick(ec.band_amount_dark, ec.band_amount, ec.rim_amount, 1), amtLight: pick(ec.band_amount_light, ec.band_amount, ec.rim_amount, 1),
      dark: bd, light: pick(ec.band_light_srgb, ec.rim_light_srgb, bd) };
    if (ob) { // v1.3: the very edge stays (near) black, painted over the band
      PULSE.swell.rim = { start: ob.black_start, full: ob.black_full, rgb: ob.target_srgb || [10, 5, 6], amount: pick(ob.amount, 1) };
      if (!v2.edge_color) { PULSE.swell.outerDark = PULSE.swell.outerLight = PULSE.swell.rim.rgb; PULSE.swell.amtDark = PULSE.swell.amtLight = pick(fv.amount, 1); }
    }
    if (v2.edge_tint && v2.edge_tint.intensity > 0) PULSE.tint = { a: v2.edge_tint.intensity, rgb: v2.edge_tint.color_rgb || [42, 12, 16] };
  }
}
function syncCtx(s) { // sim time -> AudioContext time (stable offset, re-synced after pauses/stalls)
  var off = now() - simTime;
  if (A.off == null || Math.abs(off - A.off) > 0.08) A.off = off;
  return Math.max(now() + 0.005, s + A.off);
}
function bookBeat(at, per) {
  if (!A.ctx || !HB) return;
  var x = clamp01((heart.bpm - HB.b0) / (HB.b1 - HB.b0)), db = lerp(HB.db0, HB.db1, x);
  var o = { gainMul: Math.pow(10, (db - HB.db0) / 20), freqMul: lerp(HB.f0, HB.f1, x), noiseFilterMul: lerp(HB.lp0, HB.lp1, x) / HB.lp0 };
  var t = syncCtx(at);
  o.at = t; play(HB.lub, o);
  o.at = t + per * HB.ratio; play(HB.dub, o);          // dub at 30% of the period
  /*@TEST*/ TestBeats.push({ sim: at, lub: t, dub: t + per * HB.ratio, per: per, bpm: heart.bpm }); /*@END_TEST*/
}
function vibrate(ms) {
  if (!SETTINGS.vibrate || Platform.isMuted() || paused || !started || faint || document.hidden || !navigator.vibrate) return;
  try { navigator.vibrate(ms); } catch (e) {}           // iOS Safari has no vibrate(): nothing happens
}
function vibrateStop() { try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) {} }
function onLub(at) {
  heart.lastLub = at; heart.lubs++;
  if (heart.bpm >= CONFIG.heart.vibrateFromBpm) vibrate(CONFIG.heart.vibrateMs);
  /*@TEST*/ TestBeats.lubs.push(at); /*@END_TEST*/
}
function updateBeats() {
  var H = CONFIG.heart;
  if (heart.nextBeat < 0) heart.nextBeat = simTime + 0.05;
  while (heart.nextBeat <= simTime + H.lookaheadSec) {
    var per = 60 / heart.bpm;
    bookBeat(heart.nextBeat, per); heart.pending.push(heart.nextBeat); heart.nextBeat += per;
  }
  while (heart.pending.length && heart.pending[0] <= simTime + 1e-9) onLub(heart.pending.shift());
  // Lv3 tinnitus bed
  var tinOn = heart.bpm >= H.tinnitusFromBpm;
  if (A.tin) A.tin.gain.setTargetAtTime(tinOn ? 1 : 0, now(), tinOn ? 0.4 : 0.6);
  if (tinOn) { if (heart.tinNext < 0) heart.tinNext = simTime; if (heart.tinNext <= simTime + H.lookaheadSec) { if (A.ctx) play(HB.tin, { at: syncCtx(heart.tinNext), dest: A.tin }); heart.tinNext += H.tinnitusEverySec; } }
  else heart.tinNext = -1;
  // breath: deep breath while recovering, shallow breaths from Lv2 when not recovering
  if (heart.resting && heart.bpm > H.floor + 1) { if (simTime >= heart.breathNext) { play('breath_recover'); heart.breathNext = simTime + H.breathEverySec; } }
  else heart.breathNext = 0;
  if (!heart.resting && heart.bpm >= H.levels[1]) {
    if (heart.shallowNext < 0) heart.shallowNext = simTime + lerp(H.shallowMinSec, H.shallowMaxSec, Math.random());
    else if (simTime >= heart.shallowNext) { play('breath_shallow'); heart.shallowNext = simTime + lerp(H.shallowMinSec, H.shallowMaxSec, Math.random()); }
  } else heart.shallowNext = -1;
}

/* ===================== 9. Bell / echo ===================== */
function ringBell(kind, auto) {
  var b = CONFIG.bell[kind], D = diffCfg(), L = CONFIG.bell.life;
  if (cool[kind] > simTime) return false;
  if (kind === 'strong' && !auto && !Bell.canStrong()) return false;   // caller plays the dull sound (dullBell)
  cool.weak = Math.max(cool.weak, simTime + CONFIG.bell.weak.cooldown);
  if (kind === 'strong') cool.strong = simTime + b.cooldown;
  stats[kind]++; stats.ripples++;
  var mud = auto ? 0 : Bell.muddy();
  if (!auto) Bell.spend(kind);                                          // the scripted intro bell costs nothing
  if (auto) { stats.auto++; /*@TEST*/ TestSub.autoBellAt = simTime; /*@END_TEST*/ } else { if (stats.firstBell < 0) stats.firstBell = playTime; heart.bpm += b.bpm; heart.sinceBell = 0; heart.inputSinceRest = true; Howto.used(kind === 'strong' ? 'hold' : 'tap'); }
  var vis = D[kind];                                                    // null on hard: nothing on the walls
  ripples.push({ x: P.x, y: P.y, t0: simTime, maxR: vis ? vis.radius : b.radius, strong: kind === 'strong', a: D.rippleA });
  play(kind === 'strong' ? 'bell_strong' : 'bell_weak', mud === 2 ? { lowpassHz: L.brokenLowpassHz, gainMul: L.brokenGain, cutSec: L.brokenCutSec } : mud === 1 ? { lowpassHz: L.muddyLowpassHz } : undefined);
  if (!auto) vibrate(b.vibrateMs);
  Sub.byTrigger('first_bell');
  var perSeg = {};
  for (var i = 0; i < b.rays; i++) {
    var ang = (i / b.rays) * Math.PI * 2 + (kind === 'weak' ? 0.04 : 0.02);
    var dx = Math.cos(ang), dy = Math.sin(ang), best = Infinity, bi = -1;
    for (var j = 0; j < MAP.walls.length; j++) { var t = raySeg(P.x, P.y, dx, dy, MAP.walls[j]); if (t > 0 && t < best) { best = t; bi = j; } }
    if (bi < 0 || best > b.radius) continue;                           // sound reach: the same on every difficulty
    var w = MAP.walls[bi], mat = CONFIG.materials[w.m];
    if (w.m === 'hole') continue;   // holes swallow the sound: no glow, no echo
    if (D.walls && vis && best <= vis.radius) glows.push({ x: P.x + dx * best, y: P.y + dy * best, w: bi, half: Math.min(0.55, best * Math.PI / b.rays * 1.08) + 0.03,
      at: simTime + best / CONFIG.ripple.speed, life: vis.afterglow * mat.life, a: mat.glow * (kind === 'strong' ? 1 : 0.9) * D.glow });
    var s = perSeg[bi];
    if (!s || best < s.d) perSeg[bi] = { d: best, dx: dx, m: w.m };
  }
  Object.keys(perSeg).map(function (k) { return perSeg[k]; }).sort(function (a, c) { return a.d - c.d; })
    .forEach(function (s) { sndEcho(s.m, s.d, s.dx * 0.9, kind === 'strong'); });
  return true;
}
function dullBell() { // strong refused (durability < 20 or about to break): dull 'kasu', no ripple, no cost
  var L = CONFIG.bell.life; stats.dull = (stats.dull || 0) + 1;
  play('touch', { lowpassHz: L.dullLowpassHz, gainMul: L.dullGain });
  /*@TEST*/ TestBell.dull.push(simTime); /*@END_TEST*/
}

/* ===================== 10. Input ===================== */
var cv = document.getElementById('cv'), g2 = cv.getContext('2d');
var keys = {}, moveTouch = null, presses = {};
var MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
function accepted() { stats.inputs++; heart.inputSinceRest = true; /*@TEST*/ TestHud.inputFlash(); /*@END_TEST*/ }
function inFaint() { return !!faint && !faint.back; }
function canPlay() { return started && phase === 'stage1' && !paused && !clearing && DATA.ready && !inFaint(); }
function pressStart(id) { if (!presses[id]) { presses[id] = { t0: simTime, fired: false }; } }
function pressEnd(id) {
  var p = presses[id]; if (!p) return;
  delete presses[id];
  if (!p.fired && canPlay() && ringBell('weak')) accepted();
}
function updatePresses() {
  for (var id in presses) {
    var p = presses[id];
    if (!p.fired && simTime - p.t0 >= CONFIG.input.strongHold) {
      p.fired = true;
      if (!Bell.canStrong()) { dullBell(); accepted(); Howto.used('hold'); }   // ch. 3: dull sound only, durability unchanged
      else if (ringBell('strong') || ringBell('weak')) accepted();
    }
  }
}
function inputHeld() { return Object.keys(presses).length > 0 || moveTouch !== null || MOVE_KEYS.some(function (k) { return keys[k]; }); }
function dropInput() { presses = {}; moveTouch = null; keys = {}; }

cv.addEventListener('pointerdown', function (e) {
  e.preventDefault(); audioResume();
  if (!started || paused || clearing || inFaint()) return;
  try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  if (e.pointerType === 'mouse') { if (e.button === 0) pressStart('m'); return; }
  if (e.clientX < innerWidth / 2 && !moveTouch) moveTouch = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, acc: false };
  else pressStart('p' + e.pointerId);
});
cv.addEventListener('pointermove', function (e) { if (moveTouch && e.pointerId === moveTouch.id) { moveTouch.x = e.clientX; moveTouch.y = e.clientY; } });
function ptrUp(e) {
  if (moveTouch && e.pointerId === moveTouch.id) { moveTouch = null; return; }
  pressEnd(e.pointerType === 'mouse' ? 'm' : 'p' + e.pointerId);
}
cv.addEventListener('pointerup', ptrUp);
cv.addEventListener('pointercancel', ptrUp);
['contextmenu', 'selectstart', 'gesturestart', 'dblclick'].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false }); });
document.addEventListener('touchstart', function (e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove', function (e) { if (!e.target.closest || !e.target.closest('.scroll')) e.preventDefault(); }, { passive: false });
window.addEventListener('keydown', function (e) {
  audioResume();
  if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
  if (e.repeat) return;
  if (!started) { if (document.getElementById('credits').classList.contains('show')) { document.getElementById('credits').classList.remove('show'); return; } Opening.key(e.code); return; }
  if (e.code === 'KeyP') { setPaused(!paused); return; }
  if (phase === 'prologue') { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); Prologue.advance(); } return; }
  if (paused || inFaint()) return;
  keys[e.code] = true;
  if (e.code === 'Space') pressStart('k');
});
window.addEventListener('keyup', function (e) { keys[e.code] = false; if (e.code === 'Space') pressEnd('k'); });
window.addEventListener('blur', dropInput);
function moveVector() {
  var x = 0, y = 0;
  if (keys.KeyW || keys.ArrowUp) y -= 1;
  if (keys.KeyS || keys.ArrowDown) y += 1;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  if (moveTouch) { var dx = moveTouch.x - moveTouch.x0, dy = moveTouch.y - moveTouch.y0; if (Math.hypot(dx, dy) > CONFIG.input.dragDeadzonePx) { x += dx; y += dy; } }
  var l = Math.hypot(x, y);
  return l > 0 ? { x: x / l, y: y / l } : null;
}

/* ===================== 11. Simulation (fixed 60 Hz, every rate is per second x dt) ===================== */
function collide(nx, ny) {
  var r = CONFIG.player.radius;
  for (var it = 0; it < 3; it++) for (var j = 0; j < MAP.walls.length; j++) {
    var c = closestOnSeg(nx, ny, MAP.walls[j]), dx = nx - c.x, dy = ny - c.y, d = Math.hypot(dx, dy);
    if (d < r && d > 1e-9) { nx = c.x + dx / d * r; ny = c.y + dy / d * r; }
  }
  return { x: nx, y: ny };
}
function updateHeart(dt) {
  var H = CONFIG.heart;
  heart.sinceBell += dt;
  if (P.moving) heart.bpm += H.walkPerSec * dt;
  if (heart.sinceBell > H.darkAfterSec) heart.bpm += H.darkPerSec * dt;
  heart.still = inputHeld() ? 0 : heart.still + dt;
  var rest = heart.still >= H.restAfterSec;
  if (rest && !heart.resting && heart.inputSinceRest) { Howto.used('release'); if (heart.bpm > H.floor + 1) stats.recoveries++; }
  if (rest) heart.inputSinceRest = false;
  heart.resting = rest;
  if (rest) heart.bpm = Math.max(H.floor, heart.bpm - H.restPerSec * dt);
  heart.bpm = Math.min(H.max, heart.bpm);
  /*@TEST*/ if (TestPin.bpm != null) heart.bpm = TestPin.bpm; /*@END_TEST*/
  if (heart.bpm > stats.maxBpm) stats.maxBpm = heart.bpm;
  if (!monoDone && heart.bpm >= H.monoAtBpm) { monoDone = true; stats.monoAt = playTime; Sub.byTrigger('heart_lv2_once', true); } // decision 1, once per play
  if (CONFIG.faint.enabled && heart.bpm >= H.max /*@TEST*/ && TestPin.bpm == null /*@END_TEST*/) { startFaint(); return; }
  updateBeats();
}
function startFaint() { // Stage 1: 180 = faint, not death (decision 1)
  faint = { t: 0, back: false }; stats.faints++; dropInput(); vibrateStop(); faintAudio(true);
}
function updateFaint(dt) {
  var F = CONFIG.faint; faint.t += dt;
  if (!faint.back && faint.t >= F.outSec + F.holdSec) { // 3 s of black, then wake up in the same room
    var r = CONFIG.respawn[P.area] || MAP.start;
    P.x = r.x; P.y = r.y; P.moving = false; heart = newHeart(); ripples = []; glows = []; faint.back = true; faintAudio(false);
    Bell.reset(); // ch. 3: a restart refills the bell
  }
  if (faint.t >= F.outSec + F.holdSec + F.inSec) faint = null;
}
function faintBlack() {
  if (!faint) return 0; var F = CONFIG.faint, t = faint.t;
  return t < F.outSec ? t / F.outSec : t < F.outSec + F.holdSec ? 1 : Math.max(0, 1 - (t - F.outSec - F.holdSec) / F.inSec);
}
function updateFx(dt) { // smoothed (non-beat) values for the pulse level and distortion
  var lv = heartLevel(heart.bpm), k = 1 - Math.exp(-dt / CONFIG.pulse.smoothSec);
  var target = PULSE ? (lv === 0 ? PULSE.lv0 : lv === 1 ? PULSE.lv1 : PULSE.lv2) : 0.16;
  fx.I += (target - fx.I) * k; fx.lvS += (lv - fx.lvS) * k;
}
function step(dt) {
  simTime += dt;
  if (!started) { Opening.update(dt); return; }
  if (paused) return;
  if (phase === 'prologue') { if (!DATA.ready) return; Prologue.update(dt); Echo.tick(); return; }
  if (!DATA.ready) return;                     // input not accepted until data is in
  if (!readyMarked) { readyMarked = true; textStartAt = simTime + CONFIG.text.firstDelay; Voice.loadStage(DATA.text);
    /*@TEST*/ TestHud.ready(); /*@END_TEST*/ }
  Sub.update(dt);
  updateFx(dt);
  if (clearing) { clearing += dt; if (clearing >= CONFIG.clear.fadeTime) finishClear(); return; }
  playTime += dt;
  if (faint) { updateFaint(dt); if (faint && !faint.back) return; }
  if (textStartAt > 0 && simTime >= textStartAt) { textStartAt = -1; Sub.startOpening(); }
  if (autoBellIn > 0) { autoBellIn -= dt; if (autoBellIn <= 0) { autoBellIn = -1; ringBell('weak', true); } }
  updatePresses();
  Bell.update(dt);
  var v = moveVector();
  if (v && !P.moving) accepted();
  P.moving = !!v;
  if (v) {
    Howto.used('move');
    var sp = CONFIG.player.speed * dt, n = collide(P.x + v.x * sp, P.y + v.y * sp);
    stats.moved += Math.hypot(n.x - P.x, n.y - P.y); P.x = n.x; P.y = n.y;
    P.stepT -= dt;
    if (P.stepT <= 0) { P.stepT = CONFIG.player.stepInterval; play('step_' + MAP.floorAt(P.x, P.y)); }
  } else P.stepT = 0.05;
  if (!faint || faint.back) updateHeart(dt);
  if (faint && !faint.back) return;
  var area = MAP.areaAt(P.x, P.y);
  if (area !== P.area) { P.area = area; Sub.byTrigger('enter:' + area); }
  auraTouch = [];
  var reach = CONFIG.aura.radius + CONFIG.aura.touchMargin;
  for (var j = 0; j < MAP.walls.length; j++) {
    var c = closestOnSeg(P.x, P.y, MAP.walls[j]), d = Math.hypot(c.x - P.x, c.y - P.y);
    if (d <= reach) auraTouch.push({ ang: Math.atan2(c.y - P.y, c.x - P.x), k: 1 - d / reach });
  }
  if (P.moving && simTime > P.touchT && auraTouch.some(function (a) { return a.k > 0.35; })) {
    P.touchT = simTime + CONFIG.aura.touchSoundInterval; play('touch', { pan: Math.cos(auraTouch[0].ang) * 0.7 });
  }
  if (P.x >= MAP.exitZone.x0 && P.y >= MAP.exitZone.y0 && P.y <= MAP.exitZone.y1) {
    clearing = 0.0001; stats.clears++; stats.clearTime = playTime; play('clear_door'); Platform.gameplayStop(); Howto.hide();
  }
  ripples = ripples.filter(function (r) { return (simTime - r.t0) * CONFIG.ripple.speed < r.maxR + 0.5; });
  glows = glows.filter(function (gl) { return simTime < gl.at + gl.life + 0.2; });
}

/* ===================== 12. Render ===================== */
var W_, H_, DPR, PPM;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, CONFIG.view.maxDpr);
  W_ = innerWidth; H_ = innerHeight;
  cv.width = Math.round(W_ * DPR); cv.height = Math.round(H_ * DPR);
  PPM = Math.min(W_, H_) / CONFIG.view.metersAcrossShortSide;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', function () { setTimeout(resize, 200); });
resize();
function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
// Edge masks (あーと's pulse_mask): rx = elliptical radius (1 = screen edge), edge = clamp((rx-inner)/(outer-inner))^p
var GR = {};
function rgbStr(c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + a.toFixed(4) + ')'; }
function edgeGrad(c, key, alphaAt, rgb) {
  if (key && GR[key]) return GR[key];
  var g = c.createRadialGradient(0, 0, 0, 0, 0, 1.5);
  for (var i = 0; i <= 60; i++) { var rx = 1.5 * i / 60; g.addColorStop(i / 60, rgbStr(rgb, clamp01(alphaAt(rx)))); }
  if (key) GR[key] = g;
  return g;
}
function smooth(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function bandAt(B, rx) { // band profile: v1.3 = smootherstep up from inner to peak, gaussian x smoothstep down after; v1.2 = plain gaussian
  if (B.inner == null) return rx < 0.22 ? 0 : Math.exp(-Math.pow(rx - B.center, 2) / (2 * B.width * B.width));
  if (rx < B.inner) return 0;
  if (rx <= B.center) { var x = (rx - B.inner) / (B.center - B.inner); return x * x * x * (x * (6 * x - 15) + 10); }
  var w = (B.outer - B.center) / 2; return Math.exp(-Math.pow(rx - B.center, 2) / (2 * w * w)) * (1 - smooth(B.outer, B.outer + 0.08, rx));
}
function maskFn(inner, outer, p) { return function (rx) { return Math.pow(clamp01((rx - inner) / (outer - inner)), p); }; }
function fillEdge(c, grad, alpha) {
  if (alpha <= 0.0005) return;
  c.globalAlpha = Math.min(1, alpha); c.fillStyle = grad; c.fillRect(-1, -1, 2, 2); c.globalAlpha = 1;
}
var COL = { between: [22, 8, 14], lub: [42, 12, 16], swellLight: [29, 10, 15], swellDark: [18, 8, 14] };
function lerpRgb(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function pulseState() { // everything the red-black pulse needs at this instant (also read by the test build)
  var b = heart.bpm, lv = heartLevel(b), Pp = PULSE, rf = SETTINGS.reduceFlash ? 0.5 : 1;
  if (!Pp) return null;
  var t = clamp01((b - Pp.from) / (Pp.to - Pp.from)), age = simTime - heart.lastLub, C = CONFIG.pulse;
  var env = age < 0 ? 0 : age < C.lubAttackSec ? age / C.lubAttackSec : Math.exp(-(age - C.lubAttackSec) / C.lubDecaySec);
  var lubOn = lv >= 1 ? 1 : 0, s = 0.5 - 0.5 * Math.cos(2 * Math.PI * simTime / Pp.period); // s: 0 = light side, 1 = dark side
  return { lv: lv, t: t, env: env, s: s, rf: rf,
    base: fx.I * Pp.between * (1 - t) * 0.9 * rf,
    lub: fx.I * (1 - Pp.between) * env * lubOn * (1 - t) * 0.9 * rf * (SETTINGS.reduceFlash ? 0.5 : 1),
    swell: t * rf };
}
function drawPulse(c) { // drawn UNDER the wall lines: only the dark background is tinted, lines never blink with the beat
  var ps = pulseState(); if (!ps) return;
  c.setTransform(DPR * W_ / 2, 0, 0, DPR * H_ / 2, DPR * W_ / 2, DPR * H_ / 2);
  fillEdge(c, edgeGrad(c, 'between', maskFn(0.52, 1.14, 0.9), COL.between), ps.base);
  fillEdge(c, edgeGrad(c, 'lub', maskFn(0.52, 1.14, 0.7), COL.lub), ps.lub);
  if (ps.swell > 0.0005) {
    var S = PULSE.swell;
    if (S.fixed) {
      var amt = lerp(S.amtLight, S.amtDark, ps.s), m = maskFn(S.inner, S.outer, S.power);
      fillEdge(c, edgeGrad(c, null, function (rx) { return amt * m(rx); }, lerpRgb(S.outerLight, S.outerDark, ps.s)), ps.swell);
      if (S.band) { var B = S.band, ba = lerp(B.amtLight, B.amtDark, ps.s);
        fillEdge(c, edgeGrad(c, null, function (rx) { return ba * bandAt(B, rx); }, lerpRgb(B.light, B.dark, ps.s)), ps.swell); }
      if (S.rim) { var Rm = S.rim;
        fillEdge(c, edgeGrad(c, 'rim_' + PULSE.name, function (rx) { return Rm.amount * smooth(Rm.start, Rm.full, rx); }, Rm.rgb), ps.swell); }
    } else {
      fillEdge(c, edgeGrad(c, 'swellv1', maskFn(S.inner, S.outer, 0.9), lerpRgb(COL.swellLight, COL.swellDark, ps.s)), S.base * lerp(S.lightScale, S.darkScale, ps.s) * 0.9 * ps.swell);
    }
    if (PULSE.tint) fillEdge(c, edgeGrad(c, 'tint', maskFn(0.52, 1.14, 0.7), PULSE.tint.rgb), PULSE.tint.a * 0.9 * ps.swell);
  }
}
function lvLerp(arr) { var v = Math.max(0, Math.min(3, fx.lvS)), i = Math.min(2, Math.floor(v)); return lerp(arr[i], arr[i + 1], v - i); }
function render() {
  var c = g2;
  if (phase === 'prologue') { Prologue.render(c); return; }
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
  renderBellUi();
  if (!started) { Opening.render(); applyTextFx(); return; }
  drawPulse(c);
  var sway = lvLerp(CONFIG.fx.swayPx), ox = sway * Math.sin(simTime * 2 * Math.PI * 0.23), oy = sway * Math.sin(simTime * 2 * Math.PI * 0.17 + 1);
  c.setTransform(DPR * PPM, 0, 0, DPR * PPM, DPR * (W_ / 2 - P.x * PPM + ox), DPR * (H_ / 2 - P.y * PPM + oy));
  var px1 = 1 / PPM, chroma = lvLerp(CONFIG.fx.chromaPx) * (SETTINGS.reduceFlash ? 0.5 : 1) * px1, blur = 1 + 0.5 * clamp01(fx.lvS - 1);
  c.lineCap = 'round';
  for (var i = 0; i < glows.length; i++) {          // wall afterglow
    var gl = glows[i], age = simTime - gl.at;
    if (age < 0) continue;
    var a = (age < 0.08 ? age / 0.08 : Math.pow(Math.max(0, 1 - (age - 0.08) / gl.life), 1.6)) * gl.a;
    if (a <= 0.003) continue;
    var w = MAP.walls[gl.w], sx = w.x2 - w.x1, sy = w.y2 - w.y1, l = Math.hypot(sx, sy) || 1, ux = sx / l * gl.half, uy = sy / l * gl.half;
    c.strokeStyle = 'rgba(200,212,235,' + (a * 0.16).toFixed(3) + ')'; c.lineWidth = 7 * blur * px1; line(c, gl.x - ux, gl.y - uy, gl.x + ux, gl.y + uy);
    if (chroma > 0.05 * px1) { // Lv2+: faint red / cyan offset copies (colour shift, static per level)
      c.lineWidth = 1.6 * px1;
      c.strokeStyle = 'rgba(220,70,70,' + (a * 0.28).toFixed(3) + ')'; line(c, gl.x - ux - chroma, gl.y - uy, gl.x + ux - chroma, gl.y + uy);
      c.strokeStyle = 'rgba(70,200,220,' + (a * 0.22).toFixed(3) + ')'; line(c, gl.x - ux + chroma, gl.y - uy, gl.x + ux + chroma, gl.y + uy);
    }
    c.strokeStyle = 'rgba(232,236,244,' + a.toFixed(3) + ')'; c.lineWidth = 1.8 * px1; line(c, gl.x - ux, gl.y - uy, gl.x + ux, gl.y + uy);
  }
  for (var k = 0; k < ripples.length; k++) {        // ripples
    var r = ripples[k], rad = (simTime - r.t0) * CONFIG.ripple.speed;
    if (rad <= 0) continue;
    var fade = Math.max(0, 1 - rad / r.maxR);
    var ra = r.a == null ? 1 : r.a;
    c.strokeStyle = 'rgba(210,218,232,' + (fade * (r.strong ? 0.55 : 0.45) * ra).toFixed(3) + ')'; c.lineWidth = (r.strong ? 2.2 : 1.3) * px1;
    c.beginPath(); c.arc(r.x, r.y, Math.min(rad, r.maxR), 0, Math.PI * 2); c.stroke();
    if (r.strong && rad > 0.6) { c.strokeStyle = 'rgba(210,218,232,' + (fade * 0.22 * ra).toFixed(3) + ')'; c.lineWidth = px1; c.beginPath(); c.arc(r.x, r.y, rad - 0.6, 0, Math.PI * 2); c.stroke(); }
  }
  var D = diffCfg();
  if (!D.aura) {                                     // hard: only a small dot where I am (no ring, no wall-touch arcs)
    c.fillStyle = 'rgba(214,220,232,' + D.dotA + ')'; c.beginPath(); c.arc(P.x, P.y, D.dotR, 0, Math.PI * 2); c.fill();
  } else {
  var R = CONFIG.aura.radius, breath = 0.85 + 0.15 * Math.sin(simTime * 1.7);   // aura
  var grd = c.createRadialGradient(P.x, P.y, 0, P.x, P.y, R);
  grd.addColorStop(0, 'rgba(190,200,220,' + (0.10 * breath).toFixed(3) + ')'); grd.addColorStop(1, 'rgba(190,200,220,0)');
  c.fillStyle = grd; c.beginPath(); c.arc(P.x, P.y, R, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(200,210,228,' + (0.16 * breath).toFixed(3) + ')'; c.lineWidth = px1; c.beginPath(); c.arc(P.x, P.y, R, 0, Math.PI * 2); c.stroke();
  for (var m = 0; m < auraTouch.length; m++) {
    var at = auraTouch[m];
    c.strokeStyle = 'rgba(230,234,244,' + (0.25 + 0.5 * at.k).toFixed(3) + ')'; c.lineWidth = 2 * px1;
    c.beginPath(); c.arc(P.x, P.y, R, at.ang - 0.55, at.ang + 0.55); c.stroke();
  }
  }
  // edges sink over the lines too, but only with the smoothed level (never with the beat)
  c.setTransform(DPR * W_ / 2, 0, 0, DPR * H_ / 2, DPR * W_ / 2, DPR * H_ / 2);
  fillEdge(c, edgeGrad(c, 'dark', maskFn(0.30, 1.14, 0.9), [0, 0, 0]), lvLerp(CONFIG.fx.edgeDark));
  c.setTransform(1, 0, 0, 1, 0, 0);
  var black = Math.max(clearing ? Math.min(1, clearing / (CONFIG.clear.fadeTime * 0.8)) : 0, faintBlack());
  if (black > 0) { c.fillStyle = 'rgba(0,0,0,' + black.toFixed(3) + ')'; c.fillRect(0, 0, cv.width, cv.height); }
  applyTextFx();
}
function applyTextFx() { // text by heart level: Lv1 tremble + dims a little on the lub, Lv2 red/cyan shift, Lv3 + glitch (Sub.setGlitch)
  var a = Sub.alpha * (1 - faintBlack());
  if (!Sub.cur || a <= 0) { subEl.style.opacity = 0; return; }
  var ps = pulseState(), lv = ps ? ps.lv : 0, rf = SETTINGS.reduceFlash;
  if (lv >= 1 && !rf && ps) a *= 1 - CONFIG.fx.textLubDim * ps.env;
  subEl.style.opacity = a.toFixed(3);
  subEl.style.filter = a < 1 ? 'blur(' + ((1 - Sub.alpha) * 3).toFixed(2) + 'px)' : 'none';
  var sh = lvLerp(CONFIG.fx.textShakePx) * (rf ? 0.4 : 1), t = simTime;
  var dx = sh * (Math.sin(t * 19.5) + 0.5 * Math.sin(t * 29.5 + 1)) / 1.5, dy = sh * (Math.sin(t * 23.1 + 2) + 0.5 * Math.sin(t * 31.7)) / 1.5;
  subEl.style.transform = (LANG === 'ja' ? '' : 'translateX(-50%) ') + 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px)';
  var ch = lvLerp(CONFIG.fx.chromaPx) * (rf ? 0.5 : 1), base = '0 0 6px rgba(0,0,0,.9),0 0 14px rgba(170,180,200,.25)';
  subEl.style.textShadow = ch > 0.05 ? (ch.toFixed(2) + 'px 0 rgba(230,60,60,.45),' + (-ch).toFixed(2) + 'px 0 rgba(60,210,230,.35),' + base) : base;
}

/* ===================== 13. Flow ===================== */
var startEl = document.getElementById('start'), pausedEl = document.getElementById('paused');
function beginGame(diff) {
  if (started) return;
  audioResume();
  if (diff) { DIFF = validDiff(diff); Store.set('difficulty', DIFF); }
  Store.del('stage');                     // a new game replaces the old save (saved again when Stage 1 starts)
  Opening.close();
  /*@TEST*/ TestHud.startTap(); /*@END_TEST*/
  started = true; phase = 'prologue'; readyMarked = false; playTime = 0; startEl.classList.add('hide');
  P.x = MAP.start.x; P.y = MAP.start.y; P.area = 'bedroom';
  heart = newHeart(); monoDone = false; faint = null; fx.I = PULSE ? PULSE.lv0 : 0.16; fx.lvS = 0;
  stats = newStats();
  Sub.reset(); Howto.hide();
  Platform.gameplayStart();
  Prologue.start();
}
function startStage1() {
  if (phase === 'stage1') return;
  if (Prologue.on) Prologue.stop();
  started = true; phase = 'stage1';
  readyMarked = false; playTime = 0;
  DIFF = validDiff(Store.get('difficulty')); Bell.reset(); Store.set('stage', 's1'); // ch. 1: save = start of this stage (no mid-stage save)
  startEl.classList.add('hide'); Opening.close();
  P.x = MAP.start.x; P.y = MAP.start.y; P.area = 'bedroom'; P.moving = false;
  heart = newHeart(); monoDone = false; faint = null; fx.I = PULSE ? PULSE.lv0 : 0.16; fx.lvS = 0;
  stats = newStats(); clearing = 0; ripples = []; glows = [];
  textStartAt = -1; autoBellIn = -1; introBellAt = -1;
  Sub.reset(); Howto.start();
}
function finishClear() {
  clearing = 0; started = false; phase = 'title'; ripples = []; glows = []; dropInput();
  if (Prologue.on) Prologue.stop();
  P.x = MAP.start.x; P.y = MAP.start.y; Sub.reset(); Howto.hide();
  Opening.reset();
  /*@TEST*/ if (TestHud.showLog()) return; /*@END_TEST*/
  startEl.classList.remove('hide');
}
function setPaused(v) {
  if (!started || paused === v) return;
  paused = v; pausedEl.classList.toggle('show', v); if (v) markPauseDiff();
  dropInput();
  if (v) { vibrateStop(); Platform.gameplayStop(); if (A.ctx) A.ctx.suspend().catch(function () {}); }
  else { Platform.gameplayStart(); audioResume(); }
}
function continueGame() { // ch. 1: back to the start of the saved stage, with the saved difficulty and prologue choices
  if (started || !Store.get('stage')) return;
  audioResume();
  /*@TEST*/ TestHud.startTap(); /*@END_TEST*/
  Platform.gameplayStart();
  startStage1();
}
/* Opening (ch. 1): inn picture C fades in, title + subtitle + genre line + headphones; 新しく / 続きから.
   A press rings the clay bell once (bell_weak), one ripple crosses the picture and the inn brightens a little, then on. */
var Opening = {
  state: 'main', t: 0, action: null, diffSel: CONFIG.difficulty.def, artOk: false, artStarted: false, x: 0.5, y: 0.5,
  el: function (id) { return document.getElementById(id); },
  hasSave: function () { return !!Store.get('stage'); },
  refresh: function () {
    var c = this.el('btn-cont'); if (!c) return;
    var ok = this.hasSave(); c.disabled = !ok; c.classList.toggle('off', !ok); c.setAttribute('aria-disabled', ok ? 'false' : 'true');
    this.diffSel = validDiff(Store.get('difficulty'));
    this.markDiff();
  },
  markDiff: function () { var self = this; CONFIG.difficulty.list.forEach(function (k) { var b = self.el('diff-' + k); if (b) b.classList.toggle('sel', k === self.diffSel); }); },
  show: function (st) {
    this.state = st; this.t = 0;
    startEl.setAttribute('data-state', st);
  },
  reset: function () { this.action = null; this.show('main'); this.refresh(); this.el('credits').classList.remove('show'); },
  close: function () { this.action = null; this.state = 'off'; startEl.setAttribute('data-state', 'off'); this.el('credits').classList.remove('show'); },
  loadArt: function () { // after the page has loaded: never part of the first load; black + text until it is in
    if (this.artStarted) return; this.artStarted = true;
    var self = this, im = new Image();
    im.onload = function () { self.artOk = true; var bg = self.el('startbg'); bg.style.backgroundImage = 'url(' + CONFIG.prologue.art + ')'; bg.classList.add('on'); };
    im.src = CONFIG.prologue.art;
  },
  press: function (what, ev) {
    if (started || this.state !== 'main' || this.action) return;
    if (what === 'cont' && !this.hasSave()) return;
    audioResume();
    var r = ev && ev.currentTarget && ev.currentTarget.getBoundingClientRect ? ev.currentTarget.getBoundingClientRect() : null;
    this.x = r ? (r.left + r.width / 2) / innerWidth : 0.5; this.y = r ? (r.top + r.height / 2) / innerHeight : 0.6;
    this.action = what; this.show('press');
    play('bell_weak');                                       // 土鈴: the current weak bell
    /*@TEST*/ TestBell.opening.push({ what: what, at: simTime }); /*@END_TEST*/
  },
  pickDiff: function (d) {
    if (started || this.state !== 'diff') return;
    this.diffSel = validDiff(d); this.markDiff();
    if (this.diffSel === 'hard') { this.show('hardnote'); return; }  // one line: please wear headphones, walls are not shown
    beginGame(this.diffSel);
  },
  update: function (dt) {
    this.t += dt;
    if (this.state === 'press' && this.t >= CONFIG.opening.pressSec) {
      var a = this.action; this.action = null;
      if (a === 'cont') continueGame(); else this.show('diff');
    } else if (this.state === 'hardnote' && this.t >= CONFIG.opening.hardNoteSec) beginGame('hard');
  },
  render: function () {
    var rp = this.el('oripple'), bg = this.el('startbg'); if (!rp) return;
    var O = CONFIG.opening, p = this.state === 'press' ? clamp01(this.t / O.rippleSec) : 1;
    if (p >= 1) { rp.style.opacity = 0; bg.style.filter = ''; return; }
    var m = Math.max(innerWidth, innerHeight) * 1.1 * p;
    rp.style.left = (this.x * innerWidth - m) + 'px'; rp.style.top = (this.y * innerHeight - m) + 'px';
    rp.style.width = rp.style.height = (2 * m) + 'px'; rp.style.opacity = (0.55 * (1 - p)).toFixed(3);
    bg.style.filter = 'brightness(' + (1 + O.glowPeak * Math.sin(Math.PI * p)).toFixed(3) + ')';   // the inn outline lights for a moment
  },
  key: function (code) {
    var L = CONFIG.difficulty.list, i;
    if (this.state === 'main') { if (code === 'Space' || code === 'Enter') this.press('new'); return; }
    if (this.state !== 'diff') return;
    i = L.indexOf(this.diffSel);
    if (code === 'ArrowUp' || code === 'KeyW') { this.diffSel = L[Math.max(0, i - 1)]; this.markDiff(); }
    else if (code === 'ArrowDown' || code === 'KeyS') { this.diffSel = L[Math.min(L.length - 1, i + 1)]; this.markDiff(); }
    else if (code === 'Space' || code === 'Enter') this.pickDiff(this.diffSel);
  }
};
function onBtn(id, fn) { var e = document.getElementById(id); if (e) e.addEventListener('pointerdown', function (ev) { ev.preventDefault(); ev.stopPropagation(); fn(ev); }); }
onBtn('btn-new', function (e) { Opening.press('new', e); });
onBtn('btn-cont', function (e) { Opening.press('cont', e); });
CONFIG.difficulty.list.forEach(function (k) {
  onBtn('diff-' + k, function () { Opening.pickDiff(k); });
  onBtn('pdiff-' + k, function () { Store.set('difficulty', k); markPauseDiff(); }); // takes effect from the next stage start
});
onBtn('btn-credits', function () { if (!started) document.getElementById('credits').classList.add('show'); });
onBtn('credits', function () { document.getElementById('credits').classList.remove('show'); });
function markPauseDiff() { var cur = validDiff(Store.get('difficulty')); CONFIG.difficulty.list.forEach(function (k) { var b = document.getElementById('pdiff-' + k); if (b) b.classList.toggle('sel', k === cur); }); }
if (document.readyState === 'complete') Opening.loadArt(); else window.addEventListener('load', function () { Opening.loadArt(); });
Opening.refresh();
document.getElementById('pause').addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); setPaused(true); });
pausedEl.addEventListener('pointerdown', function (e) { e.preventDefault(); setPaused(false); });
document.addEventListener('visibilitychange', function () { if (document.hidden) { vibrateStop(); setPaused(true); } });
setMuted(Platform.isMuted());

var last = -1, acc = 0, STEP = 1 / CONFIG.sim.hz;
function advance(realDt) { // real elapsed time -> fixed steps
  acc += Math.min(0.25, realDt);
  var n = 0;
  while (acc >= STEP && n < CONFIG.sim.maxStepsPerFrame) { step(STEP); acc -= STEP; n++; }
  if (n === CONFIG.sim.maxStepsPerFrame) acc = 0;
}
var manualClock = false;
function frame(t) {
  if (last < 0) last = t;
  var dt = (t - last) / 1000; last = t;
  if (!manualClock) advance(dt);
  updateAmbience();
  render();
  /*@TEST*/ TestHud.frame(t); /*@END_TEST*/
  requestAnimationFrame(frame);
}

/*@TEST*/
/* ===================== TEST BUILD ONLY (removed by tools/build_public.py) ===================== */
var TestHud = (function () {
  var hud = document.getElementById('testhud'), dot = document.getElementById('testdot'), logEl = document.getElementById('testlog');
  var frames = 0, fpsT = 0, fps = 0, tapAt = -1, readyAt = -1, flashUntil = 0;
  function log() {
    return {
      build: 'P0.2-test', lang: LANG, device: Platform.getDevice(), ua: navigator.userAgent,
      loadToReadyMs: readyAt >= 0 ? Math.round(readyAt) : null,
      startTapToReadyMs: readyAt >= 0 && tapAt >= 0 ? Math.round(readyAt - tapAt) : null,
      firstBellSec: stats.firstBell >= 0 ? +stats.firstBell.toFixed(1) : null,
      clearSec: stats.clearTime >= 0 ? +stats.clearTime.toFixed(1) : null,
      maxBpm: Math.round(stats.maxBpm), recoveries: stats.recoveries, faints: stats.faints,
      monoSec: stats.monoAt >= 0 ? +stats.monoAt.toFixed(1) : null, bellsWeak: stats.weak - stats.auto, bellsStrong: stats.strong, movedM: +stats.moved.toFixed(1), fpsAtEnd: fps
    };
  }
  function text(o) { return Object.keys(o).map(function (k) { return k + ': ' + o[k]; }).join('\n'); }
  document.getElementById('testcopy').addEventListener('pointerdown', function (e) {
    e.preventDefault(); e.stopPropagation();
    var t = text(log()), b = this;
    function done() { b.textContent = LANG === 'ja' ? 'コピーしました' : 'Copied'; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { selectFallback(t); done(); });
    else { selectFallback(t); done(); }
  });
  function selectFallback(t) { var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }
  document.getElementById('testagain').addEventListener('pointerdown', function (e) {
    e.preventDefault(); e.stopPropagation(); logEl.classList.remove('show'); startEl.classList.remove('hide');
  });
  document.getElementById('testcopy').textContent = LANG === 'ja' ? '記録をコピー' : 'Copy log';
  document.getElementById('testagain').textContent = LANG === 'ja' ? 'もう一度' : 'Again';
  hud.classList.add('on');
  return {
    startTap: function () { tapAt = performance.now(); readyAt = -1; dot.classList.remove('ready'); try { performance.mark('nk_start_tap'); } catch (e) {} },
    ready: function () { readyAt = performance.now(); dot.classList.add('ready'); try { performance.mark('nk_input_ready'); } catch (e) {} },
    inputFlash: function () { flashUntil = performance.now() + 120; dot.classList.add('flash'); },
    frame: function (t) {
      frames++;
      if (t - fpsT >= 500) { fps = Math.round(frames * 1000 / (t - fpsT)); frames = 0; fpsT = t; hud.firstChild.nodeValue = fps + ' fps'; }
      if (flashUntil && t > flashUntil) { flashUntil = 0; dot.classList.remove('flash'); }
    },
    showLog: function () { document.getElementById('testlogtext').textContent = text(log()); logEl.classList.add('show'); return true; },
    log: log
  };
})();
var TestBeats = [];                // booked beats (sim time, AudioContext lub/dub time, period)
var TestVoice = { played: [] };
var TestSub = { log: [], autoBellAt: -1, lineDoneAt: {} };
var TestPro = { log: [] };
var TestBell = { dull: [], opening: [] };
TestBeats.lubs = [];               // sim times at which the visual lub happened
var TestPin = { bpm: null };
window.NK_TEST = {
  state: function () { return { started: started, paused: paused, ready: readyMarked, x: P.x, y: P.y, bpm: heart.bpm, simTime: simTime, area: P.area,
    stats: JSON.parse(JSON.stringify(stats)), ripples: ripples.length, glows: glows.length, lang: LANG, device: Platform.getDevice(),
    audio: A.ctx ? A.ctx.state : 'none', muted: Platform.isMuted(), sub: subEl.dataset.id || null, recipes: Object.keys(DATA.recipes).length,
    faint: faint ? { t: faint.t, back: faint.back } : null, black: faintBlack(), lubs: heart.lubs, level: heartLevel(heart.bpm),
    pulse: PULSE ? PULSE.name : null, monoDone: monoDone, resting: heart.resting }; },
  log: function () { return TestHud.log(); },
  teleport: function (x, y) { P.x = x; P.y = y; },
  // drive the simulation with a fake display rate (for the 60 Hz vs 144 Hz check)
  runAtRate: function (hz, seconds, holdKey) {
    manualClock = true; keys = {}; if (holdKey) keys[holdKey] = true;
    heart = newHeart(); acc = 0;
    var x0 = P.x, y0 = P.y, b0 = heart.bpm, l0 = heart.lubs;
    for (var i = 0, n = Math.round(hz * seconds); i < n; i++) advance(1 / hz);
    keys = {}; manualClock = false;
    return { dist: Math.hypot(P.x - x0, P.y - y0), bpmDelta: heart.bpm - b0, lubs: heart.lubs - l0 };
  },
  // render frames at a fixed rate under manual control (for luminance measurement); returns pulse states
  frames: function (n, hz) {
    manualClock = true; var out = [];
    for (var i = 0; i < n; i++) { advance(1 / hz); render(); out.push(pulseState()); }
    return out;
  },
  release: function () { manualClock = false; },
  pinBpm: function (b) { TestPin.bpm = b; if (b != null) { heart.bpm = b; fx.lvS = heartLevel(b); var lv = fx.lvS; fx.I = PULSE ? (lv === 0 ? PULSE.lv0 : lv === 1 ? PULSE.lv1 : PULSE.lv2) : 0.16; } },
  setBpm: function (b) { heart.bpm = b; },
  holdSub: function (id) { var l = Sub.line(id); Sub.hold = id; if (l) { Sub.queue = []; Sub.show(l); Sub.t = CONFIG.text.fadeIn + 0.01; Sub.alpha = 1; } },
  freeSub: function () { Sub.hold = null; },
  setReduceFlash: function (v) { SETTINGS.reduceFlash = !!v; },
  setPulse: function (key) { CONFIG.pulse.use = key; buildPulse(); return PULSE.name; },
  setPulseData: function (key, obj) { DATA.sound.heartbeat[key] = obj; CONFIG.pulse.use = key; buildPulse(); return PULSE.name; },
  howto: function () { var o = {}; for (var k in Howto.left) o[k] = !Howto.left[k].classList.contains('used'); o.shown = Howto.el.classList.contains('show'); return o; },
  clearFx: function () { ripples = []; glows = []; introBellAt = -1; autoBellIn = -1; },
  voice: function () { return { on: Voice.on(), loaded: Object.keys(Voice.buffers), played: TestVoice.played.slice() }; },
  subLog: function () { return { log: TestSub.log.slice(), autoBellAt: TestSub.autoBellAt, lineDoneAt: Object.assign({}, TestSub.lineDoneAt), opening: Sub.opening(), openingFinished: Sub.openingFinished, pendingBell: !!Sub.pendingBell, bellSeen: !!Sub.bellSeen, autoBellIn: autoBellIn }; },
  ring: function (kind, auto) { return ringBell(kind || 'weak', !!auto); },
  startStage1: function () { startStage1(); },
  prologue: function () {
    var L = (Prologue.artOk && Prologue.img) ? Prologue.layout() : null, y0 = L ? (L.yStart + (L.yEnd - L.yStart) * Prologue.panP) : null;
    var tw = document.getElementById('protitlewrap'), tr = tw && tw.getBoundingClientRect();
    return { phase: phase, id: Prologue.stepId, mode: Prologue.mode, panP: Prologue.panP, panT: Prologue.panT, panPhase: Prologue.panPhase, artA: Prologue.artA, titleA: Prologue.titleA, dimA: Prologue.dimA, artOk: !!Prologue.artOk, artFailed: !!Prologue.artFailed, artStarted: !!Prologue.artStarted, chosen: Object.assign({}, Prologue.chosen), stored: { c1: Store.get('pro_c1'), c2: Store.get('pro_c2'), c3: Store.get('pro_c3') }, log: TestPro.log.slice(), fadeBlack: Prologue.fadeBlack, layout: L, srcY0: y0, srcY1: (L && y0 != null) ? y0 + L.srcH : null, advanceAt: Prologue.advanceAt, canAdvance: Prologue.canAdvance(), titleTop: tr && tr.height ? (tr.top + tr.height / 2) / H_ : null, titleBox: tr ? { top: tr.top, bottom: tr.bottom, left: tr.left, right: tr.right, mid: (tr.top + tr.bottom) / 2 } : null, titleSrc: (Prologue.titleImg && Prologue.titleImg.src) ? String(Prologue.titleImg.src) : '' };
  },
  choose: function (v) { Prologue.choose(v); },
  proNext: function () { Prologue.advance(); },
  proSkip: function () { Prologue.skipAll(); },
  setChoices: function (o) { ['c1', 'c2', 'c3'].forEach(function (k) { if (o && o[k]) Store.set('pro_' + k, o[k]); }); },
  clearChoices: function () { ['c1', 'c2', 'c3'].forEach(function (k) { try { localStorage.removeItem('nk_pro_' + k); } catch (e) {} }); },
  triggerEcho: function (hook) { return Echo.trigger(hook); },
  opening: function () { return Sub.opening(); },
  failArt: function () { Prologue.failArt(); },
  proGoto: function (id) { return Prologue.goto(id); },



  beats: function () { return { booked: TestBeats.slice(-400), lubs: TestBeats.lubs.slice(-400) }; },
  resetBeats: function () { TestBeats.length = 0; TestBeats.lubs.length = 0; },
  pulseInfo: function () { return { name: PULSE.name, swell: PULSE.swell, from: PULSE.from, to: PULSE.to, period: PULSE.period, lv: [PULSE.lv0, PULSE.lv1, PULSE.lv2] }; },
  // loudness check: render one recipe into an OfflineAudioContext (before the master limiter) and return its peak in dBFS
  measure: function (name, opt) {
    opt = opt || {}; var sr = 44100, off = new OfflineAudioContext(2, Math.ceil(sr * (opt.sec || 3)), sr), env = makeEnv(off, off.destination);
    var o = Object.assign({ at: 0.01 }, opt); voice(env, name, o);
    if (opt.also) voice(env, opt.also, Object.assign({}, o, { at: 0.01 + (opt.alsoAt || 0) }));
    return off.startRendering().then(function (b) { var pk = 0; for (var c = 0; c < b.numberOfChannels; c++) { var d = b.getChannelData(c); for (var i = 0; i < d.length; i++) { var v = Math.abs(d[i]); if (v > pk) pk = v; } } return 20 * Math.log10(pk || 1e-9); });
  },
  heartMods: function (bpm) { var x = clamp01((bpm - HB.b0) / (HB.b1 - HB.b0)), db = lerp(HB.db0, HB.db1, x); return { gainMul: Math.pow(10, (db - HB.db0) / 20), freqMul: lerp(HB.f0, HB.f1, x), noiseFilterMul: lerp(HB.lp0, HB.lp1, x) / HB.lp0, targetDb: db, ratio: HB.ratio }; },
  setMuted: function (m) { Platform._setMuted(m); },
  setPaused: function (v) { setPaused(v); },
  // p04: difficulty, bell life, opening
  bell: function () { return { d: Bell.d, broken: Bell.broken(), brokenLeft: Bell.broken() ? Bell.brokenUntil - simTime : 0, stage: Bell.stage(), canStrong: Bell.canStrong(), muddy: Bell.muddy(),
    sinceRing: simTime - Bell.lastRing, dull: TestBell.dull.length, brokenCount: Bell.brokenCount, icon: bellEl ? bellEl.className : '' }; },
  setBell: function (d) { Bell.d = d; Bell.brokenUntil = -1; },
  diff: function () { return { active: DIFF, saved: Store.get('difficulty'), cfg: diffCfg() }; },
  setDiff: function (d) { DIFF = validDiff(d); return DIFF; },
  glows: function () { return glows.map(function (g) { return { w: g.w, life: g.life, a: g.a, wall: MAP.walls[g.w].m }; }); },
  ripplesInfo: function () { return ripples.map(function (r) { return { maxR: r.maxR, a: r.a, strong: r.strong }; }); },
  hold: function (sec) { pressStart('t'); manualClock = true; var n = Math.round(sec * 60); for (var i = 0; i < n; i++) advance(1 / 60); manualClock = false; pressEnd('t'); },
  tap: function () { pressStart('t'); pressEnd('t'); },
  run: function (sec) { manualClock = true; var n = Math.round(sec * 60); for (var i = 0; i < n; i++) advance(1 / 60); manualClock = false; },
  openingState: function () { return { state: Opening.state, t: Opening.t, action: Opening.action, diffSel: Opening.diffSel, artOk: Opening.artOk, artStarted: Opening.artStarted, hasSave: Opening.hasSave(), log: TestBell.opening.slice() }; },
  store: function () { var o = {}; for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; },
  config: CONFIG, settings: SETTINGS
};
/*@END_TEST*/

Platform.init().then(function () { requestAnimationFrame(frame); });
})();
