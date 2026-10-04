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
const { execFileSync } = require('child_process');
const { readStoryboard } = require('./storyboard');

async function waitForOutcome(page, condition) {
  if (!condition) return;
  const timeout = condition.timeoutMs || 5000;
  if (condition.selector) await page.locator(condition.selector).waitFor({ state: condition.state || 'visible', timeout });
  if (condition.text) await page.getByText(condition.text, { exact: !!condition.exact }).waitFor({ state: 'visible', timeout });
  if (condition.url) await page.waitForURL(condition.url, { timeout });
  if (condition.value != null && condition.selector) {
    const value = await page.locator(condition.selector).inputValue({ timeout });
    if (value !== String(condition.value)) throw new Error(`Expected ${condition.selector} to have value ${condition.value}`);
  }
}

async function performAction(page, step) {
  const locator = page.locator(step.selector).first();
  await locator.waitFor({ state: 'visible', timeout: step.timeoutMs || 5000 });
  if (step.action === 'click') await locator.click({ delay: step.clickDelayMs || 45 });
  if (step.action === 'type') {
    await locator.fill('');
    await locator.type(step.text ?? step.value, { delay: step.typeDelay || 55 });
  }
  if (step.action === 'press') await locator.press(step.key ?? step.value ?? step.text);
  if (step.action === 'hover') await locator.hover();
  if (step.action === 'select') await locator.selectOption(step.value ?? step.text);
}

function trimPreroll(sourcePath, cleanPath, trimMs) {
  // Playwright starts its video stream as the page is being created.  The page
  // is intentionally ready before the directed take begins, so preserve the
  // uncut session for diagnosis and render a clean take from that exact point.
  execFileSync('ffmpeg', [
    '-y', '-ss', (trimMs / 1000).toFixed(3), '-i', sourcePath,
    '-map', '0:v:0', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', cleanPath,
  ], { stdio: 'inherit' });
}

async function main() {
  const configPath = process.argv[2] || './storyboard.json';
  if (!fs.existsSync(configPath)) {
    console.error(`[Walkthrough] Storyboard not found: ${configPath}`);
    process.exit(1);
  }

  const storyboard = readStoryboard(configPath);
  const outputDir = path.resolve(storyboard.outputDir || './walkthrough-output');
  const rawDir = path.join(outputDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });
  const events = [];
  const stepTimings = [];

  const cursorScript = fs.readFileSync(path.resolve(__dirname, 'cursor-overlay.js'), 'utf8');
  const cameraScript = fs.readFileSync(path.resolve(__dirname, 'camera-engine.js'), 'utf8');

  console.log(`[Walkthrough] Recording: ${storyboard.title || 'Untitled'}`);
  console.log(`[Walkthrough] Target: ${storyboard.baseUrl}`);

  let browser;
  const channel = process.env.WALKTHROUGH_BROWSER_CHANNEL || 'msedge';
  const launchArgs = ['--enable-features=OverlayScrollbar', '--hide-scrollbars', '--no-sandbox'];
  try {
    browser = await chromium.launch({
      channel,
      headless: true,
      args: launchArgs,
    });
  } catch (_) {
    browser = await chromium.launch({
      headless: true,
      args: launchArgs,
    });
  }

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
  });

  const page = await context.newPage();
  // Playwright's video clock starts with the recording context.  Keep the
  // event clock on that same origin so SFX stays in sync with the raw file.
  const captureStartedAt = Date.now();
  await page.addInitScript(cursorScript);
  await page.addInitScript(cameraScript);

  let targetUrl = storyboard.baseUrl;
  if (!/^https?:\/\//i.test(targetUrl) && !/^file:\/\//i.test(targetUrl)) {
    const resolvedPath = path.resolve(path.dirname(storyboard.__file), targetUrl);
    targetUrl = 'file:///' + resolvedPath.replace(/\\/g, '/');
  }

  await page.goto(targetUrl, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  // Re-inject (addInitScript only fires on navigation)
  await page.evaluate(cursorScript);
  await page.evaluate(cameraScript);
  // All delivered timestamps are relative to this ready frame, not to the
  // temporary white/new-page frames in Playwright's raw stream.
  const takeStartedAt = Date.now();

  // Execute storyboard steps
  for (let i = 0; i < storyboard.steps.length; i++) {
    const step = storyboard.steps[i];
    const stepStartMs = Date.now() - captureStartedAt;
    console.log(`[Walkthrough] Step ${i + 1}/${storyboard.steps.length}: ${step.title}`);

    if (step.selector && step.action) {
      // Glide cursor to element
      await page.evaluate(
        (sel) => window.__macCursor && window.__macCursor.glideTo(sel, 900),
        step.selector,
      );
      await page.waitForTimeout(step.arrivalPauseMs ?? 180);

      const box = await page.locator(step.selector).first().boundingBox();
      if (!box) throw new Error(`Target is not visible: ${step.selector}`);
      const atMs = Date.now() - captureStartedAt;
      events.push({ time: atMs / 1000, type: 'cursor_arrive', x: box.x + box.width / 2, y: box.y + box.height / 2, box, step: step.id });

      if (step.zoomOnClick) {
        await page.evaluate(
          (sel) => window.__camera && window.__camera.focusOn(sel, 1.14),
          step.selector,
        );
        events.push({ time: atMs / 1000, type: 'zoom', x: box.x + box.width / 2, y: box.y + box.height / 2, zoomIn: true, step: step.id });
      }

      if (step.action === 'click' || step.action === 'type') {
        await page.evaluate(() => window.__macCursor && window.__macCursor.click());
      }
      await performAction(page, step);
      events.push({ time: atMs / 1000, type: step.action === 'type' ? 'type' : step.action, x: box.x + box.width / 2, y: box.y + box.height / 2, box, step: step.id });
      await waitForOutcome(page, step.waitFor);
      events.push({ time: (Date.now() - captureStartedAt) / 1000, type: 'outcome', passed: true, step: step.id });
    }

    // Hold for specified duration
    await page.waitForTimeout(step.holdMs || 4000);

    // Reset camera after zoomed step (unless next step also zooms)
    const nextStep = storyboard.steps[i + 1];
    if (step.zoomOnClick && (!nextStep || !nextStep.zoomOnClick)) {
      await page.evaluate(() => window.__camera && window.__camera.reset());
      await page.waitForTimeout(600);
    }
    stepTimings.push({ id: step.id, title: step.title, start: stepStartMs / 1000, end: (Date.now() - captureStartedAt) / 1000, hasOutcome: !!step.waitFor });
  }

  // Capture video path before closing
  const videoObj = page.video();
  await context.close();
  await browser.close();

  if (videoObj) {
    const videoPath = await videoObj.path();
    const sessionPath = path.join(outputDir, 'raw_session.webm');
    const destPath = path.join(outputDir, 'raw_walkthrough.mp4');
    fs.copyFileSync(videoPath, sessionPath);
    const prerollMs = Math.max(0, takeStartedAt - captureStartedAt);
    trimPreroll(sessionPath, destPath, prerollMs);
    // Rebase metadata to the clean delivered take.  This keeps SFX and review
    // evidence in sync with what the viewer sees.
    for (const event of events) event.time = Math.max(0, Number((event.time - prerollMs / 1000).toFixed(3)));
    for (const timing of stepTimings) {
      timing.start = Math.max(0, Number((timing.start - prerollMs / 1000).toFixed(3)));
      timing.end = Math.max(0, Number((timing.end - prerollMs / 1000).toFixed(3)));
    }
    console.log(`[Walkthrough] Clean take: ${destPath}`);
    console.log(`[Walkthrough] Uncut diagnostic session: ${sessionPath}`);
  }
  fs.writeFileSync(path.join(outputDir, 'events.json'), JSON.stringify(events, null, 2));
  fs.writeFileSync(path.join(outputDir, 'recording-manifest.json'), JSON.stringify({
    storyboard: path.basename(storyboard.__file), mode: storyboard.mode, captureFps: 25,
    cleanTake: 'raw_walkthrough.mp4', diagnosticSession: 'raw_session.webm',
    timeline: stepTimings, events,
    note: 'Playwright WebM capture is currently 25fps. Do not market the source as native 60fps.'
  }, null, 2));
  console.log(`[Walkthrough] Interaction events: ${path.join(outputDir, 'events.json')}`);
}

main().catch(err => {
  console.error('[Walkthrough] Error:', err.message);
  process.exit(1);
});
