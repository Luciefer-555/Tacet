const { chromium } = require('playwright');

async function check() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:3000');
  await page.waitForSelector('button:has-text("skip")');
  await page.click('button:has-text("skip")');
  await page.waitForTimeout(2000);

  const elements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 200 && rect.height > 100 && rect.left > 900;
    }).map(el => ({
      tagName: el.tagName,
      className: el.className,
      src: el.src,
      id: el.id,
      innerHTML: el.innerHTML.slice(0, 100)
    }));
  });

  console.log('Right side elements:', elements);
  await browser.close();
}

check().catch(console.error);
