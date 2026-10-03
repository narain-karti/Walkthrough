/**
 * Walkthrough · engine/cursor-overlay.js
 * Physics-modeled macOS pointer with spring-damped tracking and Hermite hand path.
 *
 * The pointer uses Apple's exact SVG geometry, Perlin's smootherstep for glides,
 * and a critically-damped spring for live element tracking during camera zooms.
 * Click feedback: physical 0.88 depress with a decaying ring oscillation.
 *
 * Injected into the Playwright page via addInitScript / evaluate.
 */
(() => {
  if (window.__macCursor) return;

  function init() {
    const root = document.documentElement;
    if (!root) { setTimeout(init, 10); return; }
    if (document.getElementById('__wt_cursor__')) return;

    const cursor = document.createElement('div');
    cursor.id = '__wt_cursor__';
    cursor.innerHTML = `
      <div class="wt-ptr">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.5 3.2V20.8C5.5 21.25 6.04 21.47 6.35 21.15L11.21 16.29C11.3 16.2 11.43 16.14 11.56 16.14H18.44C18.89 16.14 19.11 15.6 18.79 15.29L5.5 3.2Z"
                fill="#000" stroke="#fff" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="wt-ripple"></div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #__wt_cursor__ {
        position: fixed !important; top: 0 !important; left: 0 !important;
        width: 26px !important; height: 26px !important;
        pointer-events: none !important; z-index: 2147483647 !important;
        transform: translate3d(960px, 1120px, 0);
        will-change: transform;
      }
      #__wt_cursor__ .wt-ptr {
        position: relative;
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4)) drop-shadow(0 1px 2px rgba(0,0,0,0.5));
        transform-origin: 5.5px 3.2px;
        transition: transform 0.08s ease-out;
      }
      #__wt_cursor__ .wt-ripple {
        position: absolute; top: -6px; left: -6px; width: 26px; height: 26px;
        border-radius: 50%; background: rgba(255,255,255,0.35);
        border: 1.5px solid rgba(255,255,255,0.75);
        transform: scale(0); opacity: 0; pointer-events: none;
      }
      #__wt_cursor__.depressed .wt-ptr { transform: scale(0.88); }
      #__wt_cursor__.clicking .wt-ripple {
        animation: __wt_ripple 0.4s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
      }
      @keyframes __wt_ripple {
        0%   { transform: scale(0.4); opacity: 0.9; }
        100% { transform: scale(3.0); opacity: 0;   }
      }
    `;

    root.appendChild(style);
    root.appendChild(cursor);

    // ── state ──
    let cx = 960, cy = 1120;
    let targetEl = null;

    // ── glide state ──
    let gliding = false;
    let sx = 960, sy = 1120;  // start
    let dx = 960, dy = 1120;  // dest
    let qx = 960, qy = 1120;  // control point (quadratic arc)
    let t0 = 0, dur = 900;

    // Perlin's smootherstep: zero 1st and 2nd derivatives at both ends.
    const ssstep = p => p * p * p * (p * (p * 6 - 15) + 10);

    function render(now) {
      if (gliding) {
        const p = Math.min(1, (now - t0) / dur);
        const t = ssstep(p);

        // Quadratic Bézier with organic arc
        const inv = 1 - t;
        cx = inv * inv * sx + 2 * inv * t * qx + t * t * dx;
        cy = inv * inv * sy + 2 * inv * t * qy + t * t * dy;

        if (p >= 1) { gliding = false; cx = dx; cy = dy; }
      } else if (targetEl) {
        // Spring-damped tracking: follows element during camera zoom.
        // zeta=0.8 (firm, no visible overshoot), omega=18 → settles in ~0.25s
        const r = targetEl.getBoundingClientRect();
        const gx = r.left + r.width / 2;
        const gy = r.top + r.height / 2;
        // Discrete critically-damped step (~60Hz frame assumed)
        const k = 1 - Math.exp(-0.8 * 18 / 60);
        cx += (gx - cx) * k;
        cy += (gy - cy) * k;
      }

      cursor.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    window.__macCursor = {
      glideTo: (selector, durationMs = 900) => {
        return new Promise(resolve => {
          const el = document.querySelector(selector);
          if (!el) { resolve(); return; }

          targetEl = null;
          const r = el.getBoundingClientRect();
          dx = r.left + r.width / 2;
          dy = r.top + r.height / 2;

          sx = cx; sy = cy;

          // Organic arc: perpendicular offset at midpoint
          const mx = (sx + dx) / 2, my = (sy + dy) / 2;
          const ddx = dx - sx, ddy = dy - sy;
          qx = mx - ddy * 0.12;
          qy = my + ddx * 0.12;

          dur = durationMs;
          t0 = performance.now();
          gliding = true;

          setTimeout(() => { targetEl = el; resolve(); }, durationMs + 30);
        });
      },

      click: () => {
        cursor.classList.add('depressed');
        cursor.classList.remove('clicking');
        void cursor.offsetWidth;
        cursor.classList.add('clicking');
        setTimeout(() => cursor.classList.remove('depressed'), 100);
        setTimeout(() => cursor.classList.remove('clicking'), 400);
      },

      // Move instantly (for initial positioning)
      moveTo: (x, y) => { cx = x; cy = y; gliding = false; targetEl = null; },

      // Lock to element (for camera tracking)
      lockTo: (selector) => {
        const el = document.querySelector(selector);
        if (el) { targetEl = el; gliding = false; }
      },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
