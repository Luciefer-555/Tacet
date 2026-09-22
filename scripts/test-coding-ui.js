require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const path = require('path');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI;
const OUT_DIR = 'C:\\Users\\saipr\\.gemini\\antigravity\\brain\\a94f9ad5-4c4a-44f3-b5b3-3433415a70a8';
const BASE_URL = 'http://localhost:3000';
const TS = Date.now();

const HM_EMAIL = `ui_hm_${TS}@acme.com`;
const STUDENT_EMAIL = `ui_student_${TS}@test.edu`;
const TEST_PASSWORD = process.env.TEST_ACCOUNT_PASSWORD_2;

async function setupAccounts() {
  const client = await MongoClient.connect(MONGO_URI);
  const db = client.db('seeby');

  // Register HM
  const hmRes = await fetch(`${BASE_URL}/api/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: HM_EMAIL,
      password: PASSWORD,
      phone: `+1${String(TS).slice(-9)}1`,
      username: `ui_hm_${TS}`,
      role: 'hiring_manager',
      companyId: 'COMP_UI_TEST',
      companyName: 'UI Tech'
    })
  });
  const hmJson = await hmRes.json();
  const hmProfileId = hmJson.user.profileId;

  // Verify HM email directly
  await db.collection('users').updateOne({ email: HM_EMAIL }, { $set: { emailVerified: true } });

  // Register Student
  const sRes = await fetch(`${BASE_URL}/api/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: STUDENT_EMAIL,
      password: PASSWORD,
      phone: `+1${String(TS).slice(-9)}2`,
      username: `ui_student_${TS}`,
      role: 'student',
      collegeName: 'UI College'
    })
  });
  const sJson = await sRes.json();
  const sProfileId = sJson.user.profileId;

  await client.close();
  return { hmProfileId, sProfileId };
}

async function skipHeroSplash(page) {
  try {
    const skipLocator = page.locator('button:has-text("skip")');
    await skipLocator.waitFor({ state: 'visible', timeout: 5000 });
    await skipLocator.click();
    console.log('Clicked "skip" on Hero Splash.');
    await page.waitForTimeout(1000);
  } catch (e) {
    console.log('No hero splash found or it already dismissed.');
  }
}

async function run() {
  console.log('--- Setting up UI test accounts ---');
  const { hmProfileId, sProfileId } = await setupAccounts();
  console.log(`HM profile: ${hmProfileId}, Student profile: ${sProfileId}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  // ── Step 1: Login as Hiring Manager ──
  console.log('1. Logging in as Hiring Manager...');
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.fill('#profileId', hmProfileId);
  await page.fill('#password', PASSWORD);
  
  const navPromise = page.waitForNavigation();
  await page.click('button[type="submit"]');
  await navPromise;

  await skipHeroSplash(page);

  // ── Step 2: Navigate to Problems Dashboard ──
  console.log('2. Navigating to Problems Dashboard...');
  await page.click('button:has-text("Problem Statements")');
  await page.waitForTimeout(1000);
  await page.waitForSelector('text=Problems Dashboard', { timeout: 10000 });

  // ── Step 3: Switch to Coding format and fill form ──
  console.log('3. Selecting Coding problem format...');
  await page.click('button:has-text("Coding")');
  await page.waitForTimeout(600);

  await page.fill('[placeholder="Problem title"]', `Array Sum Challenge [${TS}]`);
  await page.fill('[placeholder="Describe the problem clearly…"]', 'Given N followed by N integers on the next line, print their sum.');

  // Fill in test case 1 (input and expected output)
  const inputAreas = page.locator('textarea[placeholder*="e.g. 5"]');
  const expectedAreas = page.locator('textarea[placeholder*="e.g. 14"]');

  if (await inputAreas.count() > 0) {
    await inputAreas.first().fill('3\n10 20 30');
  }
  if (await expectedAreas.count() > 0) {
    await expectedAreas.first().fill('60');
  }

  // Click Post Problem
  console.log('4. Posting coding problem...');
  await page.click('button:has-text("Post Problem")');

  const successLocator = page.locator('text=/posted! ID:/i').last();
  await successLocator.waitFor({ state: 'visible', timeout: 15000 });
  const successText = await successLocator.innerText();
  console.log('Success text:', successText);

  const idMatch = successText.match(/ID:\s*([a-f0-9]+)/);
  if (!idMatch) throw new Error('Could not extract problem ID from success banner');
  const problemId = idMatch[1];
  console.log('Extracted Problem ID:', problemId);

  await page.screenshot({ path: path.join(OUT_DIR, 'coding_problem_posted.png'), fullPage: true });

  // ── Step 4: Login as Student and submit via CodeMirror ──
  console.log('5. Logging out and logging in as Student...');
  await context.clearCookies();

  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('#profileId', sProfileId);
  await page.fill('#password', PASSWORD);
  
  const studentNav = page.waitForNavigation();
  await page.click('button[type="submit"]');
  await studentNav;

  await skipHeroSplash(page);

  console.log('6. Navigating to Student Problem Statements view...');
  await page.click('button:has-text("Problem Statements")');
  await page.waitForTimeout(1000);

  // Enter problem ID
  console.log('7. Entering problem ID into submission form...');
  await page.fill('input#problemId', problemId);
  // Wait for problem metadata to debounce and fetch
  await page.waitForTimeout(2000);

  // Check if CodeMirror and coding badge rendered
  await page.waitForSelector('.cm-editor', { timeout: 10000 });
  console.log('CodeMirror editor successfully rendered!');

  await page.screenshot({ path: path.join(OUT_DIR, 'student_codemirror_loaded.png'), fullPage: true });

  // Type correct code into CodeMirror
  console.log('8. Typing code into CodeMirror editor...');
  const pythonCode = `n = int(input())
nums = list(map(int, input().split()))
print(sum(nums))`;

  // Focus editor and insert text
  await page.click('.cm-content');
  await page.evaluate((code) => {
    const content = document.querySelector('.cm-content');
    if (content) {
      content.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, code);
    }
  }, pythonCode);
  await page.waitForTimeout(1000);

  // Submit
  console.log('9. Clicking "Run & Submit"...');
  await page.click('button:has-text("Run & Submit")');

  // Wait for submission response and test result banner
  try {
    const resultBanner = page.locator('text=/test case(s)? passed/i').first();
    await resultBanner.waitFor({ state: 'visible', timeout: 25000 });
    console.log('Student received test results banner:', await resultBanner.innerText());
  } catch (err) {
    console.log('Wait for banner timed out. Taking debug screenshot...');
    await page.screenshot({ path: path.join(OUT_DIR, 'debug_student_submit.png'), fullPage: true });
    const banner = page.locator('.space-y-5').first();
    if (await banner.count() > 0) {
      console.log('Form text on screen:', await banner.innerText());
    }
    throw err;
  }

  await page.screenshot({ path: path.join(OUT_DIR, 'student_submission_results.png'), fullPage: true });

  // ── Step 5: Login back as HM to verify Submissions view ──
  console.log('10. Logging back as HM to verify Submissions Panel...');
  await context.clearCookies();

  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('#profileId', hmProfileId);
  await page.fill('#password', PASSWORD);
  const hmNav = page.waitForNavigation();
  await page.click('button[type="submit"]');
  await hmNav;

  await skipHeroSplash(page);

  await page.click('button:has-text("Problem Statements")');
  await page.waitForTimeout(1000);

  console.log('11. Loading problem submissions in HM view...');
  await page.fill('[placeholder="Problem ID"]', problemId);
  await page.click('button:has-text("Load")');

  // Wait for submission card to appear
  await page.waitForSelector('text=100% tests', { timeout: 10000 });
  console.log('Found submission card with correctness score badge!');

  await page.screenshot({ path: path.join(OUT_DIR, 'hm_submissions_gate_view.png'), fullPage: true });

  console.log('══════════════════════════════════════════════════════════');
  console.log('ALL PLAYWRIGHT UI CHECKS PASSED');
  console.log('Screenshots saved:');
  console.log('  1. coding_problem_posted.png');
  console.log('  2. student_codemirror_loaded.png');
  console.log('  3. student_submission_results.png');
  console.log('  4. hm_submissions_gate_view.png');
  console.log('══════════════════════════════════════════════════════════');

  await browser.close();
}

run().catch(err => {
  console.error('Playwright UI test error:', err);
  process.exit(1);
});
