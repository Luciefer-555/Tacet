const { chromium } = require('playwright');

async function capture() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--enable-webgl', '--ignore-gpu-blocklist']
  }).catch(() => chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=default']
  }));

  // 1. Desktop (1920x1080)
  const contextDesktop = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const pageDesktop = await contextDesktop.newPage();

  pageDesktop.on('console', msg => console.log('PAGE LOG:', msg.text()));
  pageDesktop.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log('Navigating to desktop view...');
  await pageDesktop.goto('http://localhost:3000');
  
  // Click skip on hero splash
  await pageDesktop.waitForSelector('button:has-text("skip")', { timeout: 10000 });
  await pageDesktop.click('button:has-text("skip")');
  
  // Wait for 3D canvas and model to load
  await pageDesktop.waitForTimeout(3000);

  // Test personalizing the badge
  const nameInput = pageDesktop.locator('input#userName');
  if (await nameInput.isVisible()) {
    console.log('Testing badge personalization with ALEX RIVERA...');
    await nameInput.fill('ALEX RIVERA');
    await pageDesktop.click('button:has-text("Apply")');
    await pageDesktop.waitForTimeout(1000);
  }

  // Drag the lanyard card to demonstrate physics
  const canvas = pageDesktop.locator('canvas').nth(1);
  if (await canvas.isVisible()) {
    const box = await canvas.boundingBox();
    if (box) {
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;
      console.log('Interacting with 3D physics lanyard...');
      await pageDesktop.mouse.move(startX, startY);
      await pageDesktop.mouse.down();
      await pageDesktop.mouse.move(startX + 80, startY + 60, { steps: 5 });
      await pageDesktop.mouse.up();
      await pageDesktop.waitForTimeout(600);
    }
  }

  await pageDesktop.screenshot({ path: 'public/landing-desktop.png' });
  console.log('Saved public/landing-desktop.png');

  // Test scrolling to Learn More (#overview)
  const learnMoreBtn = pageDesktop.locator('a:has-text("Learn More")');
  if (await learnMoreBtn.isVisible()) {
    await learnMoreBtn.click();
    await pageDesktop.waitForTimeout(800);
    await pageDesktop.screenshot({ path: 'public/landing-overview.png' });
    console.log('Saved public/landing-overview.png');
  }

  // Navigation test on desktop
  console.log('Testing Log In link...');
  const loginLink = pageDesktop.locator('header a:has-text("Log In")');
  if (await loginLink.isVisible()) {
    await loginLink.click();
    await pageDesktop.waitForURL('**/login', { timeout: 10000 });
    console.log('Successfully navigated to:', pageDesktop.url());
  }

  await pageDesktop.close();
  await contextDesktop.close();

  // 2. Mobile Portrait (390x844 - iPhone 12/13/14)
  console.log('Navigating to mobile view (390x844)...');
  const contextMobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const pageMobile = await contextMobile.newPage();
  pageMobile.on('console', msg => console.log('MOBILE LOG:', msg.text()));
  pageMobile.on('pageerror', err => console.log('MOBILE ERROR:', err.message));

  await pageMobile.goto('http://localhost:3000');
  await pageMobile.waitForSelector('button:has-text("skip")', { timeout: 10000 });
  await pageMobile.click('button:has-text("skip")');
  await pageMobile.waitForTimeout(3000);

  // Check layout bounds
  const scrollWidth = await pageMobile.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await pageMobile.evaluate(() => document.documentElement.clientWidth);
  console.log(`Mobile dimensions: scrollWidth=${scrollWidth}, clientWidth=${clientWidth} (Overflow: ${scrollWidth > clientWidth})`);

  await pageMobile.screenshot({ path: 'public/landing-mobile.png' });
  console.log('Saved public/landing-mobile.png');

  // Scroll down on mobile to view the 3D lanyard badge on mobile
  await pageMobile.evaluate(() => window.scrollBy(0, 700));
  await pageMobile.waitForTimeout(1000);
  await pageMobile.screenshot({ path: 'public/landing-mobile-badge.png' });
  console.log('Saved public/landing-mobile-badge.png');

  await pageMobile.close();
  await contextMobile.close();

  await browser.close();
  console.log('All verification completed successfully.');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
