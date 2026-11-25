/**
 * Walkthrough · engine/cursor-overlay.js
 * Physics-modeled macOS pointer with spring-damped tracking and smootherstep Bézier arcs.
 *
 * The pointer tip sits at (5.5, 3.2) inside the 26x26 SVG viewBox, so all target
 * coordinates are offset by (-HOTSPOT_X, -HOTSPOT_Y) and ripples radiate from the tip.
 */
(() => {
  if (window.__macCursor) return;

  const HOTSPOT_X = 5.5;
  const HOTSPOT_Y = 3.2;

  function init() {
    const root = document.documentElement;
    if (!root) { setTimeout(init, 10); return; }
    if (document.getElementById('__wt_cursor__')) return;

    const start = window.__wtCursorStart || { x: 960, y: 1120 };

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
        transform: translate3d(${start.x}px, ${start.y}px, 0);
        will-change: transform;
      }
      #__wt_cursor__ .wt-ptr {
        position: relative;
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4)) drop-shadow(0 1px 2px rgba(0,0,0,0.5));
        transform-origin: ${HOTSPOT_X}px ${HOTSPOT_Y}px;
        transition: transform 0.08s ease-out;
      }
      #__wt_cursor__ .wt-ripple {
        position: absolute;
        top: ${HOTSPOT_Y - 13}px;
        left: ${HOTSPOT_X - 13}px;
        width: 26px; height: 26px;
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

    let cx = start.x, cy = start.y;
    let targetEl = null;
    let targetOffsetX = 0, targetOffsetY = 0;

    let gliding = false;
    let sx = cx, sy = cy;
    let dx = cx, dy = cy;
    let qx = cx, qy = cy;
    let t0 = 0, dur = 900;
    let lastNow = performance.now();

    const ssstep = p => p * p * p * (p * (p * 6 - 15) + 10);

    function targetOrigin(el, ox = 0, oy = 0) {
      const r = el.getBoundingClientRect();
      return {
        x: r.left + r.width / 2 + ox - HOTSPOT_X,
        y: r.top + r.height / 2 + oy - HOTSPOT_Y,
      };
    }

    function render(now) {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;

      if (gliding) {
        const p = Math.min(1, (now - t0) / dur);
        const t = ssstep(p);
        const inv = 1 - t;
        cx = inv * inv * sx + 2 * inv * t * qx + t * t * dx;
        cy = inv * inv * sy + 2 * inv * t * qy + t * t * dy;

        if (p >= 1) { gliding = false; cx = dx; cy = dy; }
      } else if (targetEl && targetEl.isConnected) {
        const g = targetOrigin(targetEl, targetOffsetX, targetOffsetY);
        const k = 1 - Math.exp(-0.8 * 18 * dt);
        cx += (g.x - cx) * k;
        cy += (g.y - cy) * k;
      }

      cursor.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    window.__macCursor = {
      HOTSPOT_X,
      HOTSPOT_Y,

      glideTo: (selector, durationMs = 900, opts = {}) => {
        return new Promise(resolve => {
          const el = document.querySelector(selector);
          if (!el) { resolve(); return; }

          targetEl = null;
          targetOffsetX = opts.offsetX || 0;
          targetOffsetY = opts.offsetY || 0;

          const dest = targetOrigin(el, targetOffsetX, targetOffsetY);
          dx = dest.x;
          dy = dest.y;
          sx = cx;
          sy = cy;

          const mx = (sx + dx) / 2, my = (sy + dy) / 2;
          const ddx = dx - sx, ddy = dy - sy;
          qx = mx - ddy * 0.12;
          qy = my + ddx * 0.12;

          dur = Math.max(120, durationMs);
          t0 = performance.now();
          gliding = true;

          setTimeout(() => { targetEl = el; resolve(); }, dur + 30);
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

      moveTo: (x, y) => {
        cx = x - HOTSPOT_X;
        cy = y - HOTSPOT_Y;
        gliding = false;
        targetEl = null;
      },

      getPosition: () => ({
        x: cx,
        y: cy,
        tipX: cx + HOTSPOT_X,
        tipY: cy + HOTSPOT_Y,
      }),

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
