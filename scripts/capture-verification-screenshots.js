require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'C:\\Users\\saipr\\.gemini\\antigravity\\brain\\735bff2b-4d58-4c97-9999-82abb403c846';
const BASE_URL = 'http://localhost:3000';
const TS = Date.now();
const STUDENT_EMAIL = `verify_student_${TS}@test.edu`;
const TEST_PASSWORD = process.env.TEST_ACCOUNT_PASSWORD_1;

async function skipHeroSplash(page) {
  try {
    const skipLocator = page.locator('button:has-text("skip")');
    await skipLocator.waitFor({ state: 'visible', timeout: 4000 });
    await skipLocator.click();
    console.log('Clicked "skip" on Hero Splash.');
    await page.waitForTimeout(1000);
  } catch (e) {
    console.log('No hero splash found or it already dismissed.');
  }
}

async function run() {
  console.log('Starting screenshot verification run...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Landing Page (Dark guardrail)
  console.log('1. Capturing Landing Page...');
  await page.goto(`${BASE_URL}/`);
  await skipHeroSplash(page);
  await page.waitForTimeout(1500);
  const landingPath = path.join(OUT_DIR, 'landing_page.png');
  await page.screenshot({ path: landingPath, fullPage: false });
  console.log(`Saved landing page screenshot to ${landingPath}`);

  // 2. Login Page (Dark guardrail)
  console.log('2. Capturing Login Page...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  const loginPath = path.join(OUT_DIR, 'login_page.png');
  await page.screenshot({ path: loginPath, fullPage: false });
  console.log(`Saved login page screenshot to ${loginPath}`);

  // 3. Signup Page (Dark guardrail)
  console.log('3. Capturing Signup Page...');
  await page.goto(`${BASE_URL}/signup`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  const signupPath = path.join(OUT_DIR, 'signup_page.png');
  await page.screenshot({ path: signupPath, fullPage: false });
  console.log(`Saved signup page screenshot to ${signupPath}`);

  // 4. Register a student for authenticating
  console.log('4. Registering test student for authenticated view...');
  const regRes = await fetch(`${BASE_URL}/api/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: STUDENT_EMAIL,
      password: PASSWORD,
      phone: `+1${String(TS).slice(-9)}9`,
      username: 'Ada Lovelace',
      role: 'student',
      collegeName: 'National Institute of Technology'
    })
  });
  const regJson = await regRes.json();
  if (!regRes.ok || !regJson.user?.profileId) {
    throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);
  }
  const profileId = regJson.user.profileId;
  console.log(`Registered user: ${profileId}`);

  // 5. Login
  console.log('5. Logging in...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('#profileId', profileId);
  await page.fill('#password', PASSWORD);

  const navPromise = page.waitForNavigation();
  await page.click('button[type="submit"]');
  await navPromise;
  await skipHeroSplash(page);
  await page.waitForTimeout(2000);

  // 6. Dashboard (Warm YC Style)
  console.log('6. Capturing Dashboard...');
  await page.waitForSelector('text=Engineering Dashboard', { timeout: 10000 });
  const dashboardPath = path.join(OUT_DIR, 'dashboard_page.png');
  await page.screenshot({ path: dashboardPath, fullPage: false });
  console.log(`Saved dashboard screenshot to ${dashboardPath}`);

  // 7. Problem Statements (Warm YC Style)
  console.log('7. Navigating to and Capturing Problem Statements...');
  await page.click('button:has-text("Problem Statements")');
  await page.waitForTimeout(1500);
  const problemsPath = path.join(OUT_DIR, 'problem_statements_page.png');
  await page.screenshot({ path: problemsPath, fullPage: false });
  console.log(`Saved problem statements screenshot to ${problemsPath}`);

  // 8. Profile Page (Warm YC Style)
  console.log('8. Navigating to and Capturing Profile...');
  // Click user dropdown menu in Navbar
  const userMenuBtn = page.locator('header button:has(.rounded-full)');
  await userMenuBtn.click();
  await page.waitForTimeout(500);
  await page.click('button:has-text("Profile")');
  await page.waitForTimeout(1500);
  await page.waitForSelector('text=Your Profile', { timeout: 10000 });
  const profilePath = path.join(OUT_DIR, 'profile_page.png');
  await page.screenshot({ path: profilePath, fullPage: false });
  console.log(`Saved profile screenshot to ${profilePath}`);

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Error during screenshot capture:', err);
  process.exit(1);
});
