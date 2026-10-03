// render_flagship_scenes.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function recordScene(htmlFile, durationMs, outputFileName) {
  const outputDir = path.resolve('./flagship-output/raw');
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`[Flagship Render] Launching browser for: ${htmlFile}`);
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-features=OverlayScrollbar', '--hide-scrollbars', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: outputDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();
  const fileUrl = 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/');
  
  await page.goto(fileUrl, { waitUntil: 'load' });
  await page.waitForTimeout(durationMs);

  const videoObj = page.video();
  await context.close();
  await browser.close();

  if (videoObj) {
    const videoPath = await videoObj.path();
    const dest = path.join(outputDir, outputFileName);
    fs.copyFileSync(videoPath, dest);
    console.log(`[Flagship Render] Saved ${outputFileName} (${durationMs}ms) to ${dest}`);
  }
}

async function main() {
  // Act 1: 8200ms (Headline + 3D Tilt + Camera Dive into Full App)
  await recordScene('./act1_intro.html', 8200, 'act1_intro.webm');

  // Act 3: 6000ms (Terminal + Install + Final CTA)
  await recordScene('./act3_outro.html', 6000, 'act3_outro.webm');
}

main().catch(console.error);
