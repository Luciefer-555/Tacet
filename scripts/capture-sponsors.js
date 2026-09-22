const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--enable-webgl', '--ignore-gpu-blocklist']
  }).catch(() => chromium.launch({ headless: true }));

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('http://localhost:3000');
  const skipBtn = await page.waitForSelector('button:has-text("skip")', { timeout: 10000 }).catch(() => null);
  if (skipBtn) await skipBtn.click();
  await page.waitForTimeout(3000);

  const supportedBy = page.locator('text=Supported by');
  if (await supportedBy.isVisible()) {
    console.log('Supported by is visible! Scrolling into view...');
    await supportedBy.scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'public/v0-baseline-sponsors.png' });
    console.log('Saved public/v0-baseline-sponsors.png');
  } else {
    console.log('Supported by is NOT visible');
  }

  await browser.close();
}

run().catch(console.error);
