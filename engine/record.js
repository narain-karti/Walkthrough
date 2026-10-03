/**
 * Walkthrough · engine/record.js
 * Playwright-driven screen recorder with injected cursor physics and camera engine.
 *
 * Records 1080p video of a live web application with:
 *   - macOS cursor overlay with spring-damped tracking
 *   - Cinematic camera with clamped zoom
 *   - Storyboard-driven scene automation
 *
 * Usage:
 *   node engine/record.js [storyboard.json]
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const configPath = process.argv[2] || './storyboard.json';
  if (!fs.existsSync(configPath)) {
    console.error(`[Walkthrough] Storyboard not found: ${configPath}`);
    process.exit(1);
  }

  const storyboard = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const outputDir = path.resolve(storyboard.outputDir || './walkthrough-output');
  const rawDir = path.join(outputDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  const cursorScript = fs.readFileSync(path.resolve(__dirname, 'cursor-overlay.js'), 'utf8');
  const cameraScript = fs.readFileSync(path.resolve(__dirname, 'camera-engine.js'), 'utf8');

  console.log(`[Walkthrough] Recording: ${storyboard.title || 'Untitled'}`);
  console.log(`[Walkthrough] Target: ${storyboard.baseUrl}`);

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=OverlayScrollbar', '--hide-scrollbars', '--no-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
  });

  const page = await context.newPage();
  await page.addInitScript(cursorScript);
  await page.addInitScript(cameraScript);

  await page.goto(storyboard.baseUrl, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  // Re-inject (addInitScript only fires on navigation)
  await page.evaluate(cursorScript);
  await page.evaluate(cameraScript);

  // Execute storyboard steps
  for (let i = 0; i < storyboard.steps.length; i++) {
    const step = storyboard.steps[i];
    console.log(`[Walkthrough] Step ${i + 1}/${storyboard.steps.length}: ${step.desc || ''}`);

    if (step.selector && step.action) {
      // Glide cursor to element
      await page.evaluate(
        (sel) => window.__macCursor && window.__macCursor.glideTo(sel, 900),
        step.selector,
      );
      await page.waitForTimeout(400);

      const el = await page.waitForSelector(step.selector, { timeout: 5000 });

      if (step.zoomOnClick) {
        await page.evaluate(
          (sel) => window.__camera && window.__camera.focusOn(sel, 1.14),
          step.selector,
        );
      }

      if (step.action === 'click') {
        await page.evaluate(() => window.__macCursor && window.__macCursor.click());
        await el.click({ delay: 60 });
      } else if (step.action === 'type' && step.text) {
        await page.evaluate(() => window.__macCursor && window.__macCursor.click());
        await el.click();
        await page.keyboard.type(step.text, { delay: step.typeDelay || 85 });
      }
    }

    // Hold for specified duration
    await page.waitForTimeout(step.holdMs || 4000);

    // Reset camera after zoomed step (unless next step also zooms)
    const nextStep = storyboard.steps[i + 1];
    if (step.zoomOnClick && (!nextStep || !nextStep.zoomOnClick)) {
      await page.evaluate(() => window.__camera && window.__camera.reset());
      await page.waitForTimeout(600);
    }
  }

  // Capture video path before closing
  const videoObj = page.video();
  await context.close();
  await browser.close();

  if (videoObj) {
    const videoPath = await videoObj.path();
    const destPath = path.join(outputDir, 'raw_walkthrough.webm');
    fs.copyFileSync(videoPath, destPath);
    console.log(`[Walkthrough] Raw video: ${destPath}`);
  }
}

main().catch(err => {
  console.error('[Walkthrough] Error:', err.message);
  process.exit(1);
});
