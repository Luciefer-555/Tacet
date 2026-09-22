const { chromium } = require('playwright');

async function testWebGL() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE:', msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));

  await page.goto('http://localhost:3000');
  await page.waitForSelector('button:has-text("skip")');
  await page.click('button:has-text("skip")');
  await page.waitForTimeout(2000);

  const webglStatus = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return 'No canvas found';
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'No webgl context on canvas';
    return {
      isContextLost: gl.isContextLost(),
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION)
    };
  });

  console.log('WebGL status:', webglStatus);
  await browser.close();
}

testWebGL().catch(console.error);
