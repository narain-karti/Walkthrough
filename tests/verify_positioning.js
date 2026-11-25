/**
 * Positioning & camera bounds check for cursor-overlay.js and camera-engine.js.
 * Fails if zoomed stage exposes viewport edge gaps or cursor tip misses target center.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

async function main() {
  const root = path.resolve(__dirname, '..');
  const demoUrl = pathToFileURL(path.join(root, 'demo/index.html')).href;
  const cursorScript = fs.readFileSync(path.join(root, 'engine/cursor-overlay.js'), 'utf8');
  const cameraScript = fs.readFileSync(path.join(root, 'engine/camera-engine.js'), 'utf8');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.addInitScript(cursorScript);
    await page.addInitScript(cameraScript);
    await page.goto(demoUrl, { waitUntil: 'load' });
    await page.evaluate(cursorScript);
    await page.evaluate(cameraScript);

    const targets = ['button#tab-30d', 'input#service-search', 'button#btn-deploy'];
    for (const sel of targets) {
      await page.evaluate((s) => window.__macCursor.glideTo(s, 200), sel);
      await page.waitForTimeout(260);
      await page.evaluate((s) => window.__camera.focusOn(s, 1.14), sel);
      await page.waitForTimeout(950);

      const state = await page.evaluate((s) => {
        const stage = document.getElementById('__wt_stage__');
        const el = document.querySelector(s);
        return {
          stageRect: stage.getBoundingClientRect().toJSON(),
          elRect: el.getBoundingClientRect().toJSON(),
          cursor: window.__macCursor.getPosition(),
        };
      }, sel);

      // Stage must cover 1920x1080 completely (no black edge gaps)
      assert(state.stageRect.left <= 0.5, `${sel}: left gap (${state.stageRect.left})`);
      assert(state.stageRect.top <= 0.5, `${sel}: top gap (${state.stageRect.top})`);
      assert(state.stageRect.right >= 1919.5, `${sel}: right gap (${state.stageRect.right})`);
      assert(state.stageRect.bottom >= 1079.5, `${sel}: bottom gap (${state.stageRect.bottom})`);

      // Cursor tip must sit inside the target element's bounding box
      assert(
        state.cursor.tipX >= state.elRect.left && state.cursor.tipX <= state.elRect.right,
        `${sel}: cursor tipX ${state.cursor.tipX} outside [${state.elRect.left}, ${state.elRect.right}]`,
      );
      assert(
        state.cursor.tipY >= state.elRect.top && state.cursor.tipY <= state.elRect.bottom,
        `${sel}: cursor tipY ${state.cursor.tipY} outside [${state.elRect.top}, ${state.elRect.bottom}]`,
      );

      await page.evaluate(() => window.__camera.reset());
      await page.waitForTimeout(300);
    }

    console.log('PASS: All cursor tip & viewport-safe camera bounds assertions succeeded.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
