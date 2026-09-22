import * as dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const BASE_URL = 'http://localhost:3000';
const TEST_PASSWORD = 'HiringManagerPass123!';

async function ensureHiringManagerAccount() {
  const mongoose = await import('mongoose');
  await mongoose.default.connect(process.env.MONGODB_URI as string);
  const usersColl = mongoose.default.connection.db!.collection('users');

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  await usersColl.updateOne(
    { profileId: 'syncin@TESTHIRINGM1' },
    {
      $set: {
        username: 'TestHiringManager',
        profileId: 'syncin@TESTHIRINGM1',
        collegeId: 'COL001',
        collegeName: 'Test Tech Institute',
        email: 'hiring_mgr@college.edu',
        phone: '+91-9222222222',
        skills: ['System Design', 'Management'],
        role: 'hiring_manager',
        companyId: 'COMP_ACME_001',
        emailVerified: true,
        passwordHash: passwordHash,
      },
    },
    { upsert: true }
  );

  await mongoose.default.disconnect();
}

async function main() {
  console.log('=== Authorization Scoping Test ===\n');

  await ensureHiringManagerAccount();

  // Step 1: Log in as a real hiring manager to get a session cookie
  console.log('1. Logging in as hiring manager...');
  const loginRes = await fetch(`${BASE_URL}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profileId: 'syncin@TESTHIRINGM1',
      password: TEST_PASSWORD,
    }),
  });

  const setCookieHeader = loginRes.headers.get('set-cookie');
  if (!setCookieHeader) {
    console.error('✗ Login did not return a session cookie. Aborting.');
    const data = await loginRes.json().catch(() => null);
    console.error('Login response:', loginRes.status, data);
    process.exit(1);
  }
  const sessionCookie = setCookieHeader.split(';')[0];
  console.log('✓ Logged in, session cookie captured.\n');

  // Step 2: Attempt to create a problem for a DIFFERENT company
  console.log('2. Attempting to create a problem for a DIFFERENT company (should fail 403)...');
  const wrongCompanyRes = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      title: 'Cross-company test problem',
      description: 'Should be rejected.',
      companyId: 'SOME_OTHER_COMPANY_ID',
      difficulty: 'Easy',
    }),
  });
  console.log(`   Status: ${wrongCompanyRes.status}`);
  console.log(`   Body:`, await wrongCompanyRes.json());
  console.log(wrongCompanyRes.status === 403 ? '✓ Correctly rejected.\n' : '✗ FAILED — expected 403.\n');

  // Step 3: Attempt to create a problem for their OWN company
  console.log('3. Attempting to create a problem for their OWN company (should succeed 201)...');
  const ownCompanyRes = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      title: 'Legitimate own-company problem',
      description: 'Should succeed.',
      difficulty: 'Easy',
    }),
  });
  console.log(`   Status: ${ownCompanyRes.status}`);
  const ownCompanyData = await ownCompanyRes.json();
  console.log(`   Body:`, ownCompanyData);
  console.log(ownCompanyRes.status === 201 ? '✓ Correctly succeeded.\n' : '✗ FAILED — expected 201.\n');

  // Cleanup
  if (ownCompanyRes.status === 201 && ownCompanyData.problem?._id) {
    const mongoose = await import('mongoose');
    await mongoose.default.connect(process.env.MONGODB_URI as string);
    await mongoose.default.connection.db!
      .collection('problems')
      .deleteOne({ _id: new mongoose.default.Types.ObjectId(ownCompanyData.problem._id) });
    await mongoose.default.disconnect();
    console.log('✓ Cleaned up test problem document.');
  }
}

main().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});