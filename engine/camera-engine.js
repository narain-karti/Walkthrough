/**
 * Walkthrough · engine/camera-engine.js
 * Keyed cinematic camera with viewport-safe clamped pan/zoom and spotlight vignette.
 *
 * Clamping invariant for transform `translate3d(tx, ty, 0) scale(s)` at `50% 50%`:
 *   |tx| <= ((s - 1) / 2) * viewportWidth
 *   |ty| <= ((s - 1) / 2) * viewportHeight
 * This guarantees the zoomed stage always covers 100% of the viewport with zero black edges.
 */
(() => {
  if (window.__camera) return;

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  function ensureStage() {
    let stage = document.getElementById('__wt_stage__');
    if (!stage && document.body) {
      const bodyBg = getComputedStyle(document.body).backgroundColor;
      if (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)' && bodyBg !== 'transparent') {
        document.documentElement.style.backgroundColor = bodyBg;
      }

      stage = document.createElement('div');
      stage.id = '__wt_stage__';
      stage.style.cssText = `
        width: 100vw; min-height: 100vh;
        transform-origin: 50% 50%;
        transition: transform 0.85s cubic-bezier(0.22, 0.0, 0.18, 1.0);
        will-change: transform;
      `;

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
        background: rgba(0,0,0,0.22); opacity: 0;
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

  function clearHighlights() {
    document.querySelectorAll('[data-wt-highlighted="1"]').forEach(el => {
      el.style.boxShadow = el.dataset.wtPrevShadow || '';
      delete el.dataset.wtPrevShadow;
      delete el.dataset.wtHighlighted;
    });
  }

  window.__camera = {
    /**
     * Smoothly focus on `selector` while keeping the stage strictly within viewport edges.
     */
    focusOn: (selector, scale = 1.14, options = {}) => {
      const stage = ensureStage();
      const el = document.querySelector(selector);
      if (!el || !stage) return null;

      const safeScale = Math.max(1, Number(scale) || 1.14);

      const prev = stage.style.transform;
      stage.style.transform = 'none';
      const rect = el.getBoundingClientRect();
      stage.style.transform = prev;

      const ecx = rect.left + rect.width / 2;
      const ecy = rect.top + rect.height / 2;
      const sw = window.innerWidth;
      const sh = window.innerHeight;

      const maxTx = Math.max(0, ((safeScale - 1) / 2) * sw - 1);
      const maxTy = Math.max(0, ((safeScale - 1) / 2) * sh - 1);
      const panFactor = options.panFactor ?? 0.45;

      const tx = clamp(((sw / 2) - ecx) * panFactor, -maxTx, maxTx);
      const ty = clamp(((sh / 2) - ecy) * panFactor, -maxTy, maxTy);

      stage.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${safeScale})`;

      if (window.__cameraSpotlight) {
        window.__cameraSpotlight.style.opacity = options.spotlight === false ? '0' : '0.28';
      }

      clearHighlights();
      if (options.highlight !== false) {
        el.dataset.wtPrevShadow = el.style.boxShadow || '';
        el.dataset.wtHighlighted = '1';
        el.style.transition = 'box-shadow 0.4s ease';
        el.style.boxShadow = '0 0 0 2.5px #bfff62, 0 0 18px rgba(191,255,98,0.32)';
      }

      return { tx, ty, scale: safeScale, maxTx, maxTy };
    },

    reset: () => {
      const stage = window.__cameraStage;
      if (stage) stage.style.transform = 'translate3d(0,0,0) scale(1)';
      if (window.__cameraSpotlight) window.__cameraSpotlight.style.opacity = '0';
      clearHighlights();
    },

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
        if (t >= keys[L - 1].t) return { x: keys[L - 1].x, y: keys[L - 1].y, zoom: keys[L - 1].zoom || 1 };
        let i = 0; while (i < L - 1 && keys[i + 1].t <= t) i++;
        const a = keys[i], b = keys[i + 1];
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
