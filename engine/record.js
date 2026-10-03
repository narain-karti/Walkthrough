// record.js
// Elite screen recording runner with MacBook physics cursor & cinematic clamped camera
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const configPath = './storyboard.json';
  const storyboard = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const outputDir = path.resolve(storyboard.outputDir || './walkthrough-output');
  const rawDir = path.join(outputDir, 'raw');
  fs.mkdirSync(rawDir, { recursive: true });

  const cursorScript = fs.readFileSync('./cursor-overlay.js', 'utf8');
  const cameraScript = fs.readFileSync('./camera-engine.js', 'utf8');

  console.log(`[Walkthrough Engine] Launching browser for: ${storyboard.title}`);
  
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=OverlayScrollbar', '--hide-scrollbars', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: rawDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();
  
  await page.addInitScript(cursorScript);
  await page.addInitScript(cameraScript);

  console.log(`[Walkthrough Engine] Navigating to ${storyboard.baseUrl}...`);
  await page.goto(storyboard.baseUrl, { waitUntil: 'load' });
  await page.waitForTimeout(400);

  await page.evaluate(cursorScript);
  await page.evaluate(cameraScript);

  // Scene 1: Initial Wide View Overview (1.0x)
  console.log(`[Walkthrough Engine] Scene 1: Cinematic Wide Overview`);
  await page.waitForTimeout(storyboard.steps[0].holdMs || 5000);

  // Smooth cinematic glide into focused interactive view (1.18x)
  console.log(`[Walkthrough Camera] Smooth cinematic pan & focus into dashboard controls`);
  await page.evaluate(() => window.__camera && window.__camera.focusOn('.hero-section', 1.18));
  await page.waitForTimeout(900);

  // Scene 2: 30-Day Window Filter
  const step2 = storyboard.steps[1];
  console.log(`[Walkthrough Cursor] Gliding smoothly to ${step2.selector}`);
  await page.evaluate((sel) => window.__macCursor && window.__macCursor.glideTo(sel, 950), step2.selector);
  await page.waitForTimeout(400);

  const el2 = await page.waitForSelector(step2.selector);
  await page.evaluate(() => window.__macCursor && window.__macCursor.click());
  await el2.click({ delay: 60 });
  await page.waitForTimeout(step2.holdMs || 4000);

  // Scene 3: Search Microservices
  const step3 = storyboard.steps[2];
  console.log(`[Walkthrough Cursor] Gliding smoothly to ${step3.selector}`);
  await page.evaluate((sel) => window.__macCursor && window.__macCursor.glideTo(sel, 950), step3.selector);
  await page.waitForTimeout(400);

  const el3 = await page.waitForSelector(step3.selector);
  await page.evaluate(() => window.__macCursor && window.__macCursor.click());
  await el3.click();
  await page.keyboard.type(step3.text, { delay: step3.typeDelay || 85 });
  await page.waitForTimeout(step3.holdMs || 3000);

  // Scene 4: Trigger Canary Deploy
  const step4 = storyboard.steps[3];
  console.log(`[Walkthrough Cursor] Gliding smoothly to ${step4.selector}`);
  await page.evaluate((sel) => window.__macCursor && window.__macCursor.glideTo(sel, 950), step4.selector);
  await page.waitForTimeout(400);

  const el4 = await page.waitForSelector(step4.selector);
  await page.evaluate(() => window.__macCursor && window.__macCursor.click());
  await el4.click({ delay: 60 });
  await page.waitForTimeout(2000);

  // Smooth Zoom-out back to wide overview as deployment settles
  console.log(`[Walkthrough Camera] Pulling back to full wide shot`);
  await page.evaluate(() => window.__camera && window.__camera.reset());
  await page.waitForTimeout(step4.holdMs ? step4.holdMs - 2000 : 3500);

  const videoObj = page.video();
  await context.close();
  await browser.close();

  if (videoObj) {
    const videoPath = await videoObj.path();
    const destPath = path.join(outputDir, 'raw_walkthrough.webm');
    fs.copyFileSync(videoPath, destPath);
    console.log(`[Walkthrough Engine] Raw video captured at: ${destPath}`);
  }
}

main().catch((err) => {
  console.error('[Walkthrough Engine] Error:', err);
  process.exit(1);
});
