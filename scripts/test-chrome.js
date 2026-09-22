const { chromium } = require('playwright');

async function run() {
  // Launch with system Chrome if available, or chromium with angle
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--enable-webgl', '--ignore-gpu-blocklist']
  }).catch(e => chromium.launch({ headless: true }));

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  page.on('console', msg => console.log('PAGE:', msg.text()));
  page.on('response', res => {
    if (res.status() === 404) console.log('>>> 404 RESOURCE:', res.url());
  });

  await page.goto('http://localhost:3000');
  await page.waitForSelector('button:has-text("skip")');
  await page.click('button:has-text("skip")');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'public/chrome-test.png' });
  console.log('Saved public/chrome-test.png');
  await browser.close();
}

run().catch(console.error);
