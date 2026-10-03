/**
 * Walkthrough · lib/motion.js
 * Physics-based motion primitives as pure functions of time.
 *
 * Inspired by onetake's f(t) architecture: every value is a deterministic
 * function of time. No state, no Math.random() on the render path.
 * The same arguments always return the same numbers.
 *
 * Usage:
 *   <script src="motion.js"></script>  → window.WM
 *   const WM = require('./motion.js')  → Node
 *
 * Categories:
 *   curves    ease.* · tween · spring · springVel · settle · ring
 *   enter     wordRise · popIn · maskRise · typeOn
 *   carry     morphRect · zoomThrough · iris
 *   camera    camera · shake · drift
 *   util      clamp · lerp · seg · spline · rng
 *
 * MIT License · Narain Karti
 */
(function (root) {
  'use strict';

  // ─── scalars ─────────────────────────────────────────────────────
  const clamp  = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp   = (a, b, k) => a + (b - a) * k;
  const seg    = (t, t0, t1) => (t1 === t0 ? (t >= t1 ? 1 : 0) : clamp((t - t0) / (t1 - t0)));
  const sstep  = (e0, e1, x) => { const k = clamp((x - e0) / (e1 - e0)); return k * k * (3 - 2 * k); };
  const ssstep = (e0, e1, x) => { const k = clamp((x - e0) / (e1 - e0)); return k * k * k * (k * (k * 6 - 15) + 10); };

  // ─── easing curves ───────────────────────────────────────────────
  // t80 = share of duration before 80% distance is covered.
  // Low = snaps then settles (launch-clip feel); ~.7 = symmetric S-curve.
  const powOut   = n => u => 1 - Math.pow(1 - u, n);
  const powInOut = n => u => (u < 0.5 ? Math.pow(2, n - 1) * Math.pow(u, n) : 1 - Math.pow(-2 * u + 2, n) / 2);
  const EXPO = 1 - Math.pow(2, -10);

  const ease = {
    linear:     u => u,                                            // t80 .80
    smooth:     u => u * u * (3 - 2 * u),                          // t80 .71 — smoothstep
    smoother:   u => u * u * u * (u * (u * 6 - 15) + 10),          // t80 .67 — smootherstep (Perlin)
    sineInOut:  u => -(Math.cos(Math.PI * u) - 1) / 2,
    cubicInOut: powInOut(3),
    quintInOut: powInOut(5),
    quadOut:    powOut(2),                                          // t80 .55
    cubicOut:   powOut(3),                                          // t80 .42
    quartOut:   powOut(4),                                          // t80 .33
    quintOut:   powOut(5),                                          // t80 .28
    expoOut:    u => (u <= 0 ? 0 : u >= 1 ? 1 : (1 - Math.pow(2, -10 * u)) / EXPO),  // t80 .23
    expoIn:     u => (u <= 0 ? 0 : u >= 1 ? 1 : (Math.pow(2, 10 * u) - 1) / 1023),
    expoInOut:  u => (u < 0.5 ? (Math.pow(2, 10 * (2 * u) - 10) - Math.pow(2, -10)) / (2 * EXPO)
                               : 1 - (Math.pow(2, -10 * (2 * u - 1)) - Math.pow(2, -10)) / (2 * EXPO)),
    circOut:    u => Math.sqrt(1 - Math.pow(1 - clamp(u), 2)),
    backOut:    u => { const s = 1.70158; return 1 + (s + 1) * Math.pow(u - 1, 3) + s * Math.pow(u - 1, 2); },
  };

  // tween(t, start, end, curve) → 0…1
  const tween = (t, t0, t1, curve = ease.expoOut) => curve(seg(t, t0, t1));

  // ─── springs ─────────────────────────────────────────────────────
  // Damped spring step response 0→1 from rest. zeta<1 overshoots.
  function spring(tau, zeta = 0.6, omega = 20) {
    if (tau <= 0) return 0;
    if (zeta < 1) {
      const wd = omega * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * omega * tau) * (Math.cos(wd * tau) + (zeta * omega / wd) * Math.sin(wd * tau));
    }
    if (zeta === 1) return 1 - Math.exp(-omega * tau) * (1 + omega * tau);
    const q = omega * Math.sqrt(zeta * zeta - 1), r1 = -zeta * omega + q, r2 = -zeta * omega - q;
    return 1 - (r2 * Math.exp(r1 * tau) - r1 * Math.exp(r2 * tau)) / (r2 - r1);
  }

  // d/dtau of spring() — progress per second. For squash-from-velocity.
  function springVel(tau, zeta = 0.6, omega = 20) {
    if (tau <= 0) return 0;
    if (zeta < 1) {
      const s = Math.sqrt(1 - zeta * zeta);
      return (omega / s) * Math.exp(-zeta * omega * tau) * Math.sin(omega * s * tau);
    }
    if (zeta === 1) return omega * omega * tau * Math.exp(-omega * tau);
    const q = omega * Math.sqrt(zeta * zeta - 1), r1 = -zeta * omega + q, r2 = -zeta * omega - q;
    return omega * omega * (Math.exp(r1 * tau) - Math.exp(r2 * tau)) / (r1 - r2);
  }

  // Decaying oscillation — a click, a landing, a wobble.
  function ring(tau, decay = 9, omega = 26) {
    return tau <= 0 ? 0 : Math.exp(-decay * tau) * Math.sin(omega * tau);
  }

  // Seconds until spring settles within eps of 1.
  function settle(zeta = 0.6, omega = 20, eps = 0.02) {
    let last = 0;
    for (let i = 1; i <= 20000; i++) {
      const t = i / 1000;
      if (Math.abs(1 - spring(t, zeta, omega)) > eps) last = t;
    }
    return last;
  }

  // ─── Hermite spline through knots — hand path ───────────────────
  function spline(knots, t) {
    if (t <= knots[0].t) return [knots[0].x, knots[0].y];
    const L = knots.length;
    if (t >= knots[L - 1].t) return [knots[L - 1].x, knots[L - 1].y];
    let i = 0; while (knots[i + 1].t < t) i++;
    const k0 = knots[i], k1 = knots[i + 1], h = k1.t - k0.t, u = (t - k0.t) / h;
    const km = knots[Math.max(0, i - 1)], kp = knots[Math.min(L - 1, i + 2)];
    const m0x = (k1.x - km.x) / (k1.t - km.t) * h, m0y = (k1.y - km.y) / (k1.t - km.t) * h;
    const m1x = (kp.x - k0.x) / (kp.t - k0.t) * h, m1y = (kp.y - k0.y) / (kp.t - k0.t) * h;
    const h00 = 2*u**3 - 3*u**2 + 1, h10 = u**3 - 2*u**2 + u, h01 = -2*u**3 + 3*u**2, h11 = u**3 - u**2;
    return [h00*k0.x + h10*m0x + h01*k1.x + h11*m1x, h00*k0.y + h10*m0y + h01*k1.y + h11*m1y];
  }

  // ─── deterministic RNG ───────────────────────────────────────────
  function rng(seed = 42) {
    let s = seed | 0;
    return () => { s = (s * 1664525 + 1013904223) & 0x7fffffff; return s / 0x7fffffff; };
  }

  // ─── entrances ───────────────────────────────────────────────────
  // Words rising from below with stagger.
  function wordRise(t, t0, dur, index, total, { rise = 40, curve = ease.expoOut } = {}) {
    const stagger = dur * 0.6 / Math.max(1, total);
    const start = t0 + index * stagger;
    const k = curve(seg(t, start, start + dur * 0.5));
    return { y: rise * (1 - k), opacity: k };
  }

  // Pop in with overshoot.
  function popIn(t, t0, dur = 0.3, { overshoot = 1.08 } = {}) {
    const k = seg(t, t0, t0 + dur);
    const s = spring(k * settle(0.5, 18), 0.5, 18);
    return { scale: s, opacity: clamp(k * 5) };
  }

  // Mask rise — clip from bottom.
  function maskRise(t, t0, dur = 0.4) {
    const k = ease.expoOut(seg(t, t0, t0 + dur));
    return { clipPercent: 100 * (1 - k) };
  }

  // Typewriter.
  function typeOn(t, t0, text, charPerSec = 12) {
    const elapsed = Math.max(0, t - t0);
    const chars = Math.min(text.length, Math.floor(elapsed * charPerSec));
    return { text: text.substring(0, chars), done: chars >= text.length };
  }

  // ─── carries (section boundary transitions) ─────────────────────
  // Morph one rect into another — the element that survives the cut.
  function morphRect(t, t0, dur, from, to, curve = ease.cubicInOut) {
    const k = curve(seg(t, t0, t0 + dur));
    return {
      x: lerp(from.x, to.x, k),
      y: lerp(from.y, to.y, k),
      w: lerp(from.w, to.w, k),
      h: lerp(from.h, to.h, k),
      r: lerp(from.r || 0, to.r || 0, k),
    };
  }

  // Zoom through — camera pushes into a card until it fills the frame.
  function zoomThrough(t, t0, dur, { startScale = 1, endScale = 8, curve: c = ease.expoInOut } = {}) {
    const k = c(seg(t, t0, t0 + dur));
    return { scale: lerp(startScale, endScale, k), opacity: k > 0.85 ? clamp((1 - k) * 6) : 1 };
  }

  // Iris — a circle opens from the subject to reveal the next scene.
  function iris(t, t0, dur, cx, cy, maxR, curve = ease.cubicInOut) {
    const k = curve(seg(t, t0, t0 + dur));
    return { cx, cy, r: maxR * k };
  }

  // ─── camera ──────────────────────────────────────────────────────
  // Keyed camera: interpolate between keyframes with per-leg curves.
  // keys = [{ t, x, y, zoom, curve }]
  function camera(t, keys) {
    if (!keys.length) return { x: 0, y: 0, zoom: 1 };
    if (t <= keys[0].t) return { x: keys[0].x, y: keys[0].y, zoom: keys[0].zoom || 1 };
    const L = keys.length;
    if (t >= keys[L - 1].t) return { x: keys[L-1].x, y: keys[L-1].y, zoom: keys[L-1].zoom || 1 };
    let i = 0; while (i < L - 1 && keys[i + 1].t <= t) i++;
    const a = keys[i], b = keys[i + 1];
    const c = (b.curve || ease.cubicInOut);
    const k = c(seg(t, a.t, b.t));
    return {
      x: lerp(a.x, b.x, k),
      y: lerp(a.y, b.y, k),
      zoom: lerp(a.zoom || 1, b.zoom || 1, k),
    };
  }

  // Landing shake — decaying oscillation on each axis.
  function shake(t, t0, { ampX = 4, ampY = 6, decay = 12, omega = 30 } = {}) {
    const tau = t - t0;
    if (tau <= 0) return { x: 0, y: 0 };
    const d = Math.exp(-decay * tau);
    return { x: ampX * d * Math.sin(omega * tau), y: ampY * d * Math.cos(omega * 1.3 * tau) };
  }

  // Slow breathing drift — two-sine float.
  function drift(t, { ampX = 3, ampY = 2, freqX = 0.15, freqY = 0.21 } = {}) {
    return {
      x: ampX * Math.sin(2 * Math.PI * freqX * t),
      y: ampY * Math.sin(2 * Math.PI * freqY * t + 1.2),
    };
  }

  // ─── export ──────────────────────────────────────────────────────
  const WM = {
    clamp, lerp, seg, sstep, ssstep,
    ease, tween,
    spring, springVel, ring, settle,
    spline, rng,
    wordRise, popIn, maskRise, typeOn,
    morphRect, zoomThrough, iris,
    camera, shake, drift,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = WM;
  else root.WM = WM;
})(typeof globalThis !== 'undefined' ? globalThis : this);
