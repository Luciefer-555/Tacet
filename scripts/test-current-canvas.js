const { chromium } = require('playwright');

async function testCurrentCanvas() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  await page.goto('http://localhost:3000');
  await page.waitForSelector('button:has-text("skip")');
  await page.click('button:has-text("skip")');
  
  // Wait 4 seconds for all initial mounts/unmounts/textures to settle
  await page.waitForTimeout(4000);

  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return 'No canvas found';
    
    // Check if three.js is actively drawing frames
    return {
      width: canvas.width,
      height: canvas.height,
      styleWidth: canvas.style.width,
      styleHeight: canvas.style.height,
      hasDataEngine: canvas.getAttribute('data-engine')
    };
  });

  console.log('Canvas Info at 4s:', canvasInfo);
  await page.screenshot({ path: 'public/canvas-test.png' });
  await browser.close();
}

testCurrentCanvas().catch(console.error);
