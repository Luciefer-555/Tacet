const { chromium } = require('playwright');
const path = require('path');

const OUT_DIR = 'C:\\Users\\saipr\\.gemini\\antigravity\\brain\\a94f9ad5-4c4a-44f3-b5b3-3433415a70a8';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  console.log('1. Navigating to /login...');
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');

  console.log('2. Filling in mentor credentials...');
  await page.fill('#profileId', 'syncin@QJT852');
  await page.fill('#password', 'MentorPassword2026!');
  
  const navPromise = page.waitForNavigation();
  await page.click('button[type="submit"]');

  console.log('3. Waiting for login to succeed and redirect...');
  try {
    await navPromise;
  } catch (err) {
    console.log('Navigation failed or timed out. Taking screenshot...');
    await page.screenshot({ path: path.join(OUT_DIR, 'debug_login_error.png') });
    throw err;
  }

  console.log('3.5. Checking for Hero Splash screen and clicking Skip if present...');
  try {
    // Look for the skip button and click it to bypass the animation
    const skipLocator = page.locator('button:has-text("skip")');
    // We only wait a short time because it might have skipped automatically or we might not see it
    await skipLocator.waitFor({ state: 'visible', timeout: 5000 });
    await skipLocator.click();
    console.log('Clicked "skip" on Hero Splash.');
    // Wait for the exit animation to finish (600ms defined in the code)
    await page.waitForTimeout(1000);
  } catch (e) {
    console.log('No hero splash skip button found or it timed out. Continuing...');
  }

  console.log('4. Clicking "Problem Statements" in sidebar...');
  // It's a button in the sidebar with a child span containing "Problem Statements"
  await page.click('button:has-text("Problem Statements")');
  
  // Wait a bit for the state update and render
  await page.waitForTimeout(1000);

  console.log('5. Taking screenshot of Assignments Dashboard landing...');
  try {
    await page.waitForSelector('text=Assignments Dashboard', { timeout: 10000 });
  } catch (err) {
    console.log('Could not find Assignments Dashboard. Taking screenshot...');
    await page.screenshot({ path: path.join(OUT_DIR, 'debug_problems_error.png'), fullPage: true });
    throw err;
  }
  
  const ss1 = path.join(OUT_DIR, 'dashboard_landing.png');
  await page.screenshot({ path: ss1, fullPage: true });
  console.log(`Saved screenshot to ${ss1}`);

  console.log('6. Filling out assignment creation form...');
  await page.fill('[placeholder="Assignment title"]', 'Playwright UI Integration Test Assignment');
  await page.fill('[placeholder="Describe the assignment clearly…"]', 'This is an end-to-end assignment created via Playwright to verify the Mentor UI integrations and role-aware forms are working correctly.');
  
  await page.click('button:has-text("Post Assignment")');

  console.log('7. Waiting for success message...');
  const successLocator = page.locator('text=/posted! ID:/i').last();
  await successLocator.waitFor({ state: 'visible', timeout: 15000 });
  const successText = await successLocator.innerText();
  console.log('Success text:', successText);

  const ss2 = path.join(OUT_DIR, 'assignment_created.png');
  await page.screenshot({ path: ss2, fullPage: true });
  console.log(`Saved screenshot to ${ss2}`);

  const idMatch = successText.match(/ID:\s*([a-f0-9]+)/);
  if (idMatch && idMatch[1]) {
    const assignmentId = idMatch[1];
    console.log(`Extracted assignment ID: ${assignmentId}`);

    console.log('8. Loading submissions for assignment...');
    await page.fill('[placeholder="Assignment ID"]', assignmentId);
    await page.click('button:has-text("Load")');
    
    await page.waitForSelector('text=No submissions yet.', { timeout: 10000 });

    const ss3 = path.join(OUT_DIR, 'assignment_submissions.png');
    await page.screenshot({ path: ss3, fullPage: true });
    console.log(`Saved screenshot to ${ss3}`);
  } else {
    console.log('Could not extract assignment ID from success text.');
  }

  await browser.close();
  console.log('DONE');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
