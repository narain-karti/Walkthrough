// cursor-overlay.js
// Ultra-refined macOS cursor with smootherstep cushioned physics & Apple design.
(() => {
  if (window.__macCursor) return;

  function init() {
    const root = document.documentElement;
    if (!root) { setTimeout(init, 10); return; }
    if (document.getElementById('__macos_cursor__')) return;

    const cursor = document.createElement('div');
    cursor.id = '__macos_cursor__';
    cursor.innerHTML = `
      <div class="mac-pointer">
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.5 3.2V20.8C5.5 21.25 6.04 21.47 6.35 21.15L11.21 16.29C11.3 16.2 11.43 16.14 11.56 16.14H18.44C18.89 16.14 19.11 15.6 18.79 15.29L5.5 3.2Z" 
                fill="#000000" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="mac-click-ripple"></div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #__macos_cursor__ {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 26px !important;
        height: 26px !important;
        pointer-events: none !important;
        z-index: 2147483647 !important;
        transform: translate3d(960px, 1120px, 0);
        will-change: transform;
      }
      #__macos_cursor__ .mac-pointer {
        position: relative;
        filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.4)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
        transform-origin: 5.5px 3.2px;
        transition: transform 0.1s ease-out;
      }
      #__macos_cursor__ .mac-click-ripple {
        position: absolute;
        top: -6px;
        left: -6px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.35);
        border: 1.5px solid rgba(255, 255, 255, 0.75);
        transform: scale(0);
        opacity: 0;
        pointer-events: none;
      }
      #__macos_cursor__.depressed .mac-pointer {
        transform: scale(0.88);
      }
      #__macos_cursor__.clicking .mac-click-ripple {
        animation: __mac_ripple 0.4s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
      }
      @keyframes __mac_ripple {
        0% { transform: scale(0.4); opacity: 0.9; }
        100% { transform: scale(3.0); opacity: 0; }
      }
    `;

    root.appendChild(style);
    root.appendChild(cursor);

    // State & Physics
    let currentX = 960;
    let currentY = 1120;
    let targetX = 960;
    let targetY = 1120;
    let targetEl = null;

    // Continuous smootherstep animation state
    let isGliding = false;
    let startX = 960, startY = 1120;
    let destX = 960, destY = 1120;
    let ctrlX = 960, ctrlY = 1120;
    let startTime = 0;
    let duration = 900;

    function render(now) {
      if (isGliding) {
        const elapsed = now - startTime;
        const p = Math.min(1, elapsed / duration);
        
        // Ken Perlin's SmootherStep (zero 1st and 2nd derivatives at both ends)
        // Guarantees zero sudden jerk at start and arrival
        const t = p * p * p * (p * (p * 6 - 15) + 10);

        // Quadratic Bezier with subtle natural curve
        const invT = 1 - t;
        currentX = (invT * invT * startX) + (2 * invT * t * ctrlX) + (t * t * destX);
        currentY = (invT * invT * startY) + (2 * invT * t * ctrlY) + (t * t * destY);

        if (p >= 1) {
          isGliding = false;
          currentX = destX;
          currentY = destY;
        }
      } else if (targetEl) {
        // Live element lock: perfectly follows element during camera zoom
        const r = targetEl.getBoundingClientRect();
        const goalX = r.left + r.width / 2;
        const goalY = r.top + r.height / 2;

        // Critically damped spring tracking (0.2 velocity factor avoids any jump)
        currentX += (goalX - currentX) * 0.22;
        currentY += (goalY - currentY) * 0.22;
      }

      cursor.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;
      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    window.__macCursor = {
      glideTo: (selector, durationMs = 950) => {
        return new Promise((resolve) => {
          const el = document.querySelector(selector);
          if (!el) { resolve(); return; }

          targetEl = null;
          const r = el.getBoundingClientRect();
          destX = r.left + r.width / 2;
          destY = r.top + r.height / 2;

          startX = currentX;
          startY = currentY;

          // Subtle organic arc
          const dx = destX - startX;
          const dy = destY - startY;
          const midX = (startX + destX) / 2;
          const midY = (startY + destY) / 2;
          const curve = 0.12;

          ctrlX = midX - (dy * curve);
          ctrlY = midY + (dx * curve);

          duration = durationMs;
          startTime = performance.now();
          isGliding = true;

          setTimeout(() => {
            targetEl = el;
            resolve();
          }, durationMs + 30);
        });
      },

      click: () => {
        cursor.classList.add('depressed');
        cursor.classList.remove('clicking');
        void cursor.offsetWidth;
        cursor.classList.add('clicking');

        setTimeout(() => cursor.classList.remove('depressed'), 120);
        setTimeout(() => cursor.classList.remove('clicking'), 450);
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
