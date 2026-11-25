/**
 * Walkthrough · engine/record.js
 * Playwright-driven screen recorder with injected cursor physics, clamped camera,
 * audio-synced pacing, and optional intro/outro template capture.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        flags[k] = true;
      } else {
        flags[k] = next;
        i++;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function resolveTargetUrl(rawUrl, storyboardDir) {
  if (/^(https?|file):\/\//i.test(rawUrl)) return rawUrl;
  const fromCwd = path.resolve(process.cwd(), rawUrl);
  if (fs.existsSync(fromCwd)) return pathToFileURL(fromCwd).href;
  const fromBoard = path.resolve(storyboardDir, rawUrl);
  if (fs.existsSync(fromBoard)) return pathToFileURL(fromBoard).href;
  return rawUrl;
}

async function launchBrowser(browserPref, headless) {
  const candidates = browserPref
    ? [browserPref === 'chromium' ? {} : { channel: browserPref }]
    : [{}, { channel: 'msedge' }, { channel: 'chrome' }];

  let lastErr;
  for (const opts of candidates) {
    try {
      return await chromium.launch({
        ...opts,
        headless,
        args: ['--enable-features=OverlayScrollbar', '--hide-scrollbars', '--no-sandbox'],
      });
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(
    `No usable Chromium/Edge/Chrome browser found (${lastErr?.message || 'unknown error'}). Run: npx playwright install chromium`,
  );
}

async function recordStaticScene(browser, templateUrl, outWebm, durationMs) {
  const rawDir = path.join(path.dirname(outWebm), '_tmp_scene');
  fs.mkdirSync(rawDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  await page.goto(templateUrl, { waitUntil: 'load' });
  await page.waitForTimeout(durationMs);

  const videoObj = page.video();
  await context.close();
  if (videoObj) {
    fs.copyFileSync(await videoObj.path(), outWebm);
  }
  fs.rmSync(rawDir, { recursive: true, force: true });
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const configPath = path.resolve(process.cwd(), positional[0] || './showcase/storyboard.json');
  if (!fs.existsSync(configPath)) {
    console.error(`[Walkthrough] Storyboard not found: ${configPath}`);
    process.exit(1);
  }

  const storyboardDir = path.dirname(configPath);
  const storyboard = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const outputDir = path.resolve(process.cwd(), flags.output || storyboard.outputDir || './walkthrough-output');
  const rawDir = path.join(outputDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  const timingPath = path.join(outputDir, 'timing.json');
  const timing = fs.existsSync(timingPath) ? JSON.parse(fs.readFileSync(timingPath, 'utf8')) : null;

  const headless = flags.headless === undefined ? true : flags.headless !== 'false';
  const browser = await launchBrowser(flags.browser, headless);

  try {
    // Optional Act 1 Intro scene
    if (storyboard.intro && storyboard.intro.template) {
      const introUrl = resolveTargetUrl(storyboard.intro.template, storyboardDir);
      const introMs = Math.ceil(((timing?.clipBudgets?.intro || storyboard.intro.durationSec || 7.5) + 0.5) * 1000);
      const introOut = path.join(rawDir, 'act_intro.webm');
      console.log(`[Walkthrough] Recording intro template (${(introMs / 1000).toFixed(1)}s)...`);
      await recordStaticScene(browser, introUrl, introOut, introMs);
    }

    // Main App Walkthrough
    const targetUrl = resolveTargetUrl(flags.url || storyboard.baseUrl, storyboardDir);
    const cursorScript = fs.readFileSync(path.resolve(__dirname, 'cursor-overlay.js'), 'utf8');
    const cameraScript = fs.readFileSync(path.resolve(__dirname, 'camera-engine.js'), 'utf8');

    console.log(`[Walkthrough] Recording: ${storyboard.title || 'Untitled'}`);
    console.log(`[Walkthrough] Target: ${targetUrl}`);

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
    });

    const page = await context.newPage();
    if (Array.isArray(storyboard.cursorStart) && storyboard.cursorStart.length === 2) {
      const [sx, sy] = storyboard.cursorStart;
      await page.addInitScript(`window.__wtCursorStart = { x: ${Number(sx)}, y: ${Number(sy)} };`);
    }
    await page.addInitScript(cursorScript);
    await page.addInitScript(cameraScript);

    await page.goto(targetUrl, { waitUntil: 'load' });
    await page.waitForTimeout(350);

    await page.evaluate(cursorScript);
    await page.evaluate(cameraScript);

    const recordStart = Date.now();
    const timeline = [];
    const steps = storyboard.steps || [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepStart = Date.now();
      console.log(`[Walkthrough] Step ${i + 1}/${steps.length}: ${step.desc || step.action || 'hold'}`);

      if (step.waitFor) {
        await page.waitForSelector(step.waitFor, { timeout: 8000 });
      }

      if (step.selector) {
        const el = await page.waitForSelector(step.selector, { timeout: 8000 });

        if (step.scrollIntoView !== false) {
          await page.evaluate((sel) => {
            const node = document.querySelector(sel);
            if (!node) return;
            const r = node.getBoundingClientRect();
            if (r.top < 0 || r.bottom > window.innerHeight) {
              node.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
          }, step.selector);
        }

        const glideMs = step.glideMs || 850;
        const offset = Array.isArray(step.cursorOffset)
          ? { offsetX: step.cursorOffset[0], offsetY: step.cursorOffset[1] }
          : {};
        await page.evaluate(
          ({ sel, ms, off }) => window.__macCursor && window.__macCursor.glideTo(sel, ms, off),
          { sel: step.selector, ms: glideMs, off: offset },
        );
        await page.waitForTimeout(250);

        const zoomScale = typeof step.zoom === 'number' ? step.zoom : (step.zoomOnClick ? 1.14 : null);
        if (zoomScale && zoomScale > 1) {
          await page.evaluate(
            ({ sel, sc, hl }) => window.__camera && window.__camera.focusOn(sel, sc, { highlight: hl }),
            { sel: step.selector, sc: zoomScale, hl: step.highlight !== false },
          );
        }

        const box = await el.boundingBox();
        const actionTimeMs = Date.now() - recordStart;

        if (step.action === 'click') {
          await page.evaluate(() => window.__macCursor && window.__macCursor.click());
          await el.click({ delay: 60 });
        } else if (step.action === 'type' && step.text !== undefined) {
          await page.evaluate(() => window.__macCursor && window.__macCursor.click());
          await el.click();
          await page.keyboard.type(String(step.text), { delay: step.typeDelay || 80 });
        } else if (step.action === 'hover') {
          await el.hover();
        }

        timeline.push({
          step: i,
          timeMs: actionTimeMs,
          action: step.action || 'focus',
          selector: step.selector,
          box: box ? { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) } : null,
        });
      }

      const audioDurMs = timing?.stepTimings?.[String(i)]?.duration
        ? Math.round(timing.stepTimings[String(i)].duration * 1000 + (timing.stepPauseDur || 0.18) * 1000)
        : null;
      const elapsedMs = Date.now() - stepStart;
      const holdMs = step.holdMs !== undefined
        ? step.holdMs
        : Math.max(step.minHoldMs ?? 900, (audioDurMs ?? 3200) - elapsedMs);

      await page.waitForTimeout(holdMs);

      const nextStep = steps[i + 1];
      const thisZoomed = Boolean(step.zoomOnClick || (typeof step.zoom === 'number' && step.zoom > 1));
      const nextZoomed = nextStep && Boolean(nextStep.zoomOnClick || (typeof nextStep.zoom === 'number' && nextStep.zoom > 1));
      if (thisZoomed && !nextZoomed) {
        await page.evaluate(() => window.__camera && window.__camera.reset());
        await page.waitForTimeout(550);
      }
    }

    // Ensure raw video meets compositor's required main clip budget
    const requiredMainMs = timing?.clipBudgets?.main ? Math.ceil(timing.clipBudgets.main * 1000 + 400) : 0;
    const totalElapsed = Date.now() - recordStart;
    if (requiredMainMs > totalElapsed) {
      await page.waitForTimeout(requiredMainMs - totalElapsed);
    }

    const videoObj = page.video();
    await context.close();

    if (videoObj) {
      const videoPath = await videoObj.path();
      const destPath = path.join(outputDir, 'raw_walkthrough.webm');
      fs.copyFileSync(videoPath, destPath);
      console.log(`[Walkthrough] Raw video: ${destPath}`);
    }

    const timelineOut = path.join(outputDir, 'timeline.json');
    fs.writeFileSync(timelineOut, JSON.stringify(timeline, null, 2));

    // Optional Act 3 Outro scene
    if (storyboard.outro && storyboard.outro.template) {
      const outroUrl = resolveTargetUrl(storyboard.outro.template, storyboardDir);
      const outroMs = Math.ceil(((timing?.clipBudgets?.outro || storyboard.outro.durationSec || 5.8) + 0.6) * 1000);
      const outroOut = path.join(rawDir, 'act_outro.webm');
      console.log(`[Walkthrough] Recording outro template (${(outroMs / 1000).toFixed(1)}s)...`);
      await recordStaticScene(browser, outroUrl, outroOut, outroMs);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[Walkthrough] Error:', err.message);
  process.exit(1);
});
