/**
 * Walkthrough · engine/render_scenes.js
 * Headless Playwright renderer for Act 1 (Intro) and Act 3 (Outro) editorial scenes.
 *
 * Records 1080p 60fps video directly from HTML/CSS/GSAP motion templates.
 *
 * Usage:
 *   node engine/render_scenes.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function renderScene(browser, templatePath, durationMs, outPath) {
  const rawDir = path.dirname(outPath);
  fs.mkdirSync(rawDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } },
  });

  const page = await context.newPage();
  const fileUrl = 'file:///' + path.resolve(templatePath).replace(/\\/g, '/');

  console.log(`[Walkthrough Scenes] Rendering ${path.basename(templatePath)} for ${(durationMs / 1000).toFixed(1)}s...`);
  await page.goto(fileUrl, { waitUntil: 'load' });
  await page.waitForTimeout(durationMs);

  const videoObj = page.video();
  await context.close();

  if (videoObj) {
    const videoPath = await videoObj.path();
    fs.copyFileSync(videoPath, outPath);
    console.log(`[Walkthrough Scenes] Saved: ${outPath}`);
  }
}

async function main() {
  const flagshipDir = path.resolve('./flagship-output');
  const rawDir = path.join(flagshipDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  let durAct1 = 8500;
  let durAct3 = 7000;

  const timingFile = path.join(flagshipDir, 'timing.json');
  if (fs.existsSync(timingFile)) {
    try {
      const timing = JSON.parse(fs.readFileSync(timingFile, 'utf8'));
      if (timing.dur_act1) durAct1 = Math.ceil((timing.dur_act1 + timing.fade_dur + 0.5) * 1000);
      if (timing.dur_act3) durAct3 = Math.ceil((timing.dur_act3 + timing.fade_dur + 0.5) * 1000);
    } catch (_) {}
  }

  let browser;
  const channel = process.env.WALKTHROUGH_BROWSER_CHANNEL || 'msedge';
  const launchArgs = ['--hide-scrollbars', '--no-sandbox'];
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

  try {
    const act1Html = path.resolve(__dirname, '../templates/act1_intro.html');
    const act3Html = path.resolve(__dirname, '../templates/act3_outro.html');

    if (fs.existsSync(act1Html)) {
      await renderScene(browser, act1Html, durAct1, path.join(rawDir, 'act1_intro.webm'));
    }
    if (fs.existsSync(act3Html)) {
      await renderScene(browser, act3Html, durAct3, path.join(rawDir, 'act3_outro.webm'));
    }
  } finally {
    await browser.close();
  }

  console.log('[Walkthrough Scenes] Editorial scene templates rendered successfully.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[Walkthrough Scenes Error]', err.message);
    process.exit(1);
  });
}

module.exports = { renderScene, main };
