const { chromium } = require('playwright');

async function test(glMode) {
  console.log(`\nTesting with ${glMode}...`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', `--use-gl=angle`, `--use-angle=${glMode}`]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  page.on('console', msg => console.log('  PAGE:', msg.text()));

  await page.goto('http://localhost:3000');
  await page.waitForSelector('button:has-text("skip")');
  await page.click('button:has-text("skip")');
  await page.waitForTimeout(2500);

  const status = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return 'No canvas';
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'No gl context';
    return {
      isContextLost: gl.isContextLost(),
      renderer: gl.getParameter(gl.RENDERER)
    };
  });

  console.log('  Result:', status);
  await page.screenshot({ path: `public/test-${glMode}.png` });
  await browser.close();
}

(async () => {
  await test('d3d11');
  await test('swiftshader');
})();
