const { chromium } = require('playwright');

async function testLifecycle() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));

  await page.goto('http://localhost:3000');
  await page.waitForSelector('button:has-text("skip")');
  await page.click('button:has-text("skip")');
  await page.waitForTimeout(4000);

  await browser.close();
}

testLifecycle().catch(console.error);
