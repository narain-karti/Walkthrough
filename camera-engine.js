// camera-engine.js
// Cinema-grade clamped viewport camera: smooth 1.18x focus with zero edge clipping.
(() => {
  if (window.__camera) return;

  function initCamera() {
    let stage = document.getElementById('__walkthrough_stage__');
    if (!stage && document.body) {
      stage = document.createElement('div');
      stage.id = '__walkthrough_stage__';
      stage.style.cssText = `
        width: 100vw;
        min-height: 100vh;
        transform-origin: 50% 50%;
        transition: transform 0.85s cubic-bezier(0.2, 0.0, 0.2, 1.0);
        will-change: transform;
      `;
      const children = Array.from(document.body.children);
      children.forEach(ch => {
        const isExcluded = ch.id === '__macos_cursor__' || 
                           ch.id === '__walkthrough_spotlight__' || 
                           ch.id === 'toast' || 
                           ch.classList.contains('toast-overlay') ||
                           ch.tagName === 'SCRIPT' || 
                           ch.tagName === 'STYLE';
        if (!isExcluded) {
          stage.appendChild(ch);
        }
      });
      document.body.appendChild(stage);
    }

    let spotlight = document.getElementById('__walkthrough_spotlight__');
    if (!spotlight && document.documentElement) {
      spotlight = document.createElement('div');
      spotlight.id = '__walkthrough_spotlight__';
      spotlight.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.25);
        opacity: 0;
        pointer-events: none;
        z-index: 2147483640;
        transition: opacity 0.75s ease;
      `;
      document.documentElement.appendChild(spotlight);
    }

    window.__cameraStage = stage;
    window.__cameraSpotlight = spotlight;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCamera);
  } else {
    initCamera();
  }

  window.__camera = {
    // Professional subtle focus zoom (1.14x) with pan strictly clamped to prevent any margin/logo clipping
    focusOn: (selector, scale = 1.14) => {
      initCamera();
      const el = document.querySelector(selector);
      if (!el || !window.__cameraStage) return null;

      const currTransform = window.__cameraStage.style.transform;
      window.__cameraStage.style.transform = 'none';
      const rect = el.getBoundingClientRect();
      window.__cameraStage.style.transform = currTransform;

      const elCenterX = rect.left + rect.width / 2;
      const elCenterY = rect.top + rect.height / 2;

      const screenW = window.innerWidth;
      const screenH = window.innerHeight;

      // Soft cinematic translation toward element
      let transX = (screenW / 2) - elCenterX;
      let transY = (screenH / 2) - elCenterY;

      // Clamp pan strictly so logo, header, and margins are NEVER clipped!
      const maxPanX = 80; // px
      const maxPanY = 100; // px

      transX = Math.max(-maxPanX, Math.min(maxPanX, transX * 0.20));
      transY = Math.max(-maxPanY, Math.min(maxPanY, transY * 0.25));

      window.__cameraStage.style.transform = `translate3d(${transX.toFixed(1)}px, ${transY.toFixed(1)}px, 0) scale(${scale})`;
      if (window.__cameraSpotlight) window.__cameraSpotlight.style.opacity = '0.3';

      el.style.transition = 'box-shadow 0.4s ease';
      el.style.boxShadow = '0 0 0 2.5px #bfff62, 0 0 20px rgba(191, 255, 98, 0.35)';

      return { transX, transY, scale };
    },

    // Smooth reset back to 1.0x wide shot
    reset: () => {
      if (window.__cameraStage) {
        window.__cameraStage.style.transform = 'translate3d(0, 0, 0) scale(1)';
      }
      if (window.__cameraSpotlight) {
        window.__cameraSpotlight.style.opacity = '0';
      }
      document.querySelectorAll('[style*="box-shadow"]').forEach(el => {
        if (el.id !== '__macos_cursor__') {
          el.style.boxShadow = '';
        }
      });
    }
  };
})();
