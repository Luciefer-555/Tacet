import * as dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const BASE_URL = 'http://localhost:3000';
const TEST_PASSWORD = 'TestPassword123!';

const SALES_BRIEF = `Our SDR team sends about 3,000 cold outreach emails a month with an 8% reply rate. We have the email templates, subject lines, and reply/no-reply outcomes for the last 6 months. We want a new outreach sequence (email 1 through 4) targeting mid-market SaaS companies, with reasoning for why each email should perform better than our current baseline.`;

async function login(profileId: string) {
  const res = await fetch(`${BASE_URL}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId, password: TEST_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed for ${profileId}: ${res.status}`);
  return res.headers.get('set-cookie')?.split(';')[0] ?? '';
}

async function setupFixtures() {
  const mongoose = await import('mongoose');
  await mongoose.default.connect(process.env.MONGODB_URI as string);
  const users = mongoose.default.connection.db!.collection('users');
  const hash = await bcrypt.hash(TEST_PASSWORD, 12);

  await users.updateOne(
    { profileId: 'syncin@SHELLFISH_HM' },
    {
      $set: {
        username: 'ShellfishHM',
        profileId: 'syncin@SHELLFISH_HM',
        passwordHash: hash,
        role: 'hiring_manager',
        companyId: 'COMP_SALES_RETRY',
        email: 'sales_hm@company.com',
        phone: '+1-555-004-0001',
      },
    },
    { upsert: true }
  );

  await mongoose.default.disconnect();
}

async function main() {
  console.log('=== Testing Sales Brief with Retry & Failure Surfacing ===\n');

  await setupFixtures();
  const hmCookie = await login('syncin@SHELLFISH_HM');

  console.log('Submitting Sales Brief to /api/problems/create-with-variants...');
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/api/problems/create-with-variants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: hmCookie,
    },
    body: JSON.stringify({
      rawData: SALES_BRIEF,
      variantCount: 3,
      difficulty: 'Medium',
      companyName: 'Sales Outreach Test Co',
    }),
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (!res.ok) {
    const err = await res.text();
    console.error(`FAILED (${elapsed}s):`, err);
    process.exit(1);
  }

  const data = await res.json();
  const p = data.problem;

  console.log(`✓ Status: 201 Created in ${elapsed}s`);
  console.log(`Problem ID: ${p._id}`);
  console.log(`Canonical Title: ${p.title}\n`);

  console.log('--- VARIANTS INSPECTION ---');
  p.variants.forEach((v: any) => {
    console.log(`[${v.variantId}] ${v.title}`);
    console.log(`  generationFailed: ${v.generationFailed ?? false}`);
    console.log(`  description (first 150 chars): ${v.description ? v.description.substring(0, 150) + '...' : '(empty)'}`);
    console.log('');
  });

  console.log('=== TEST COMPLETED SUCCESSFULLY ===');
}

main().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
