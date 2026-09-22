const { chromium } = require('playwright');

async function check() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000');
  await page.waitForSelector('button:has-text("skip")');
  await page.click('button:has-text("skip")');
  await page.waitForTimeout(2000);

  const allImgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(img => ({
      outer: img.outerHTML,
      src: img.src,
      rect: img.getBoundingClientRect()
    }));
  });
  console.log('ALL IMGS:', JSON.stringify(allImgs, null, 2));

  // Also check what element is at (1200, 400)
  const elAtPoint = await page.evaluate(() => {
    const el = document.elementFromPoint(1200, 400);
    return el ? {
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      outerHTML: el.outerHTML.slice(0, 300)
    } : 'none';
  });
  console.log('Element at (1200, 400):', elAtPoint);

  await browser.close();
}

check().catch(console.error);
