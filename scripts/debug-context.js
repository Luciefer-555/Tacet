const { chromium } = require('playwright');

async function debugContext() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage();
  
  await page.addInitScript(() => {
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      const ctx = origGetContext.apply(this, [type, ...args]);
      if (type && type.includes('webgl')) {
        console.log('GETCONTEXT CALLED:', type, 'on canvas:', this);
        this.addEventListener('webglcontextlost', (e) => {
          console.log('WEBGLCONTEXTLOST EVENT FIRED!', e);
          console.trace('webglcontextlost stack');
        });
      }
      return ctx;
    };
  });

  page.on('console', msg => console.log('LOG:', msg.text()));

  await page.goto('http://localhost:3000');
  await page.waitForSelector('button:has-text("skip")');
  await page.click('button:has-text("skip")');
  await page.waitForTimeout(4000);

  await browser.close();
}

debugContext().catch(console.error);
