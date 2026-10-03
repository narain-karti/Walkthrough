/**
 * Walkthrough · engine/camera-engine.js
 * Keyed cinematic camera with spring-damped zoom, clamped pan bounds,
 * and spotlight vignette.
 *
 * Two modes:
 *   1. focusOn(selector, scale) — one-shot smooth zoom to an element
 *   2. keyedMove(keys) — onetake-style keyed camera path with per-leg curves
 *
 * The camera wraps page content in a transform stage and keeps fixed overlays
 * (toasts, modals, cursor) outside the transform.
 */
(() => {
  if (window.__camera) return;

  // ── smootherstep for CSS transition fallback ──
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  function ensureStage() {
    let stage = document.getElementById('__wt_stage__');
    if (!stage && document.body) {
      stage = document.createElement('div');
      stage.id = '__wt_stage__';
      stage.style.cssText = `
        width: 100vw; min-height: 100vh;
        transform-origin: 50% 50%;
        transition: transform 0.85s cubic-bezier(0.22, 0.0, 0.18, 1.0);
        will-change: transform;
      `;
      // Move page content into stage, exclude overlays
      Array.from(document.body.children).forEach(ch => {
        const skip = ch.id === '__wt_cursor__' ||
                     ch.id === '__wt_spotlight__' ||
                     ch.id === 'toast' ||
                     ch.classList.contains('toast-overlay') ||
                     ch.tagName === 'SCRIPT' ||
                     ch.tagName === 'STYLE';
        if (!skip) stage.appendChild(ch);
      });
      document.body.appendChild(stage);
    }

    let spot = document.getElementById('__wt_spotlight__');
    if (!spot && document.documentElement) {
      spot = document.createElement('div');
      spot.id = '__wt_spotlight__';
      spot.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.25); opacity: 0;
        pointer-events: none; z-index: 2147483640;
        transition: opacity 0.75s ease;
      `;
      document.documentElement.appendChild(spot);
    }

    window.__cameraStage = stage;
    window.__cameraSpotlight = spot;
    return stage;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureStage);
  } else {
    ensureStage();
  }

  window.__camera = {
    /**
     * Smooth focus on an element with clamped pan.
     * Pan is clamped to [-80, 80]px X and [-100, 100]px Y
     * so headers, logos, and margins are never clipped.
     */
    focusOn: (selector, scale = 1.14) => {
      const stage = ensureStage();
      const el = document.querySelector(selector);
      if (!el || !stage) return null;

      // Measure element center in un-transformed space
      const prev = stage.style.transform;
      stage.style.transform = 'none';
      const rect = el.getBoundingClientRect();
      stage.style.transform = prev;

      const ecx = rect.left + rect.width / 2;
      const ecy = rect.top + rect.height / 2;
      const sw = window.innerWidth, sh = window.innerHeight;

      // Soft pan toward element, heavily clamped
      let tx = ((sw / 2) - ecx) * 0.20;
      let ty = ((sh / 2) - ecy) * 0.25;
      tx = clamp(tx, -80, 80);
      ty = clamp(ty, -100, 100);

      stage.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${scale})`;

      if (window.__cameraSpotlight) {
        window.__cameraSpotlight.style.opacity = '0.3';
      }

      // Subtle glow ring on focused element
      el.style.transition = 'box-shadow 0.4s ease';
      el.style.boxShadow = '0 0 0 2.5px #bfff62, 0 0 20px rgba(191,255,98,0.35)';

      return { tx, ty, scale };
    },

    /** Reset to wide shot */
    reset: () => {
      const stage = window.__cameraStage;
      if (stage) stage.style.transform = 'translate3d(0,0,0) scale(1)';
      if (window.__cameraSpotlight) window.__cameraSpotlight.style.opacity = '0';
      document.querySelectorAll('[style*="box-shadow"]').forEach(el => {
        if (el.id !== '__wt_cursor__') el.style.boxShadow = '';
      });
    },

    /**
     * Keyed camera move — onetake-style.
     * keys = [{ t, x, y, zoom, curve }]
     * Returns a function seek(t) → { x, y, zoom } for frame-by-frame rendering.
     */
    keyedSeek: (keys) => {
      const lerp = (a, b, k) => a + (b - a) * k;
      const seg = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
      const cubicInOut = u => u < 0.5
        ? 4 * u * u * u
        : 1 - Math.pow(-2 * u + 2, 3) / 2;

      return (t) => {
        if (!keys.length) return { x: 0, y: 0, zoom: 1 };
        if (t <= keys[0].t) return { x: keys[0].x, y: keys[0].y, zoom: keys[0].zoom || 1 };
        const L = keys.length;
        if (t >= keys[L-1].t) return { x: keys[L-1].x, y: keys[L-1].y, zoom: keys[L-1].zoom || 1 };
        let i = 0; while (i < L-1 && keys[i+1].t <= t) i++;
        const a = keys[i], b = keys[i+1];
        const c = b.curve || cubicInOut;
        const k = c(seg(t, a.t, b.t));
        return {
          x: lerp(a.x, b.x, k),
          y: lerp(a.y, b.y, k),
          zoom: lerp(a.zoom || 1, b.zoom || 1, k),
        };
      };
    },
  };
})();
