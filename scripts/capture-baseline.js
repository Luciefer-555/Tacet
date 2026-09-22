const { chromium } = require('playwright');

async function capture() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--enable-webgl', '--ignore-gpu-blocklist']
  }).catch(() => chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=default']
  }));

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  page.on('console', msg => console.log('PAGE LOG [' + msg.type() + ']:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('response', res => {
    if (res.status() >= 400) console.log('HTTP ' + res.status() + ':', res.url());
  });

  console.log('Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000');

  const skipBtn = await page.waitForSelector('button:has-text("skip")', { timeout: 10000 }).catch(() => null);
  if (skipBtn) {
    console.log('Skipping splash...');
    await skipBtn.click();
  }

  // Wait for 3D canvases and models to load and initial animations to begin
  console.log('Waiting for baseline landing page to render...');
  await page.waitForTimeout(3000);

  // Take screenshot of the unmodified v0 baseline hero
  await page.screenshot({ path: 'public/v0-baseline-desktop.png' });
  console.log('Saved public/v0-baseline-desktop.png');

  // Test personalizing the badge
  const nameInput = page.locator('input#userName');
  if (await nameInput.isVisible()) {
    console.log('Testing badge personalization with "GUILHERME"...');
    await nameInput.fill('GUILHERME');
    await page.click('button:has-text("Apply")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'public/v0-baseline-personalized.png' });
    console.log('Saved public/v0-baseline-personalized.png');
  }

  // Drag the lanyard card to test physics
  const canvases = page.locator('canvas');
  const count = await canvases.count();
  console.log(`Found ${count} canvas elements`);
  if (count >= 2) {
    const lanyardCanvas = canvases.nth(1);
    const box = await lanyardCanvas.boundingBox();
    if (box) {
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;
      console.log('Interacting with 3D physics lanyard...');
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 100, startY + 50, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(800);
      await page.screenshot({ path: 'public/v0-baseline-physics.png' });
      console.log('Saved public/v0-baseline-physics.png');
    }
  }

  // Scroll down to capture full page sections (Features, Agenda, CallToAction, Footer)
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'public/v0-baseline-features.png' });
  console.log('Saved public/v0-baseline-features.png');

  await browser.close();
  console.log('Baseline verification capture completed!');
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
