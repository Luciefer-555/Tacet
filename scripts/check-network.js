const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const failed = [];
  page.on('requestfailed', req => failed.push({ url: req.url(), failure: req.failure().errorText }));
  page.on('response', res => {
    if (res.status() >= 400 && !res.url().includes('/api/user/me')) {
      failed.push({ url: res.url(), status: res.status() });
    }
  });
  await page.goto('http://localhost:3000');
  await page.waitForSelector('button:has-text("skip")');
  await page.click('button:has-text("skip")');
  await page.waitForTimeout(3000);
  console.log('Failed/4xx requests:', failed);
  await browser.close();
}

run().catch(console.error);
