import * as dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import { createVerificationToken } from '../lib/auth';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000';
const TEST_EMAIL = 'test_hm_verify@acme.com';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_COMPANY_ID = 'COMP_VERIFY_TEST_001';

async function main() {
  console.log('--- Starting Hiring Manager Email Verification Test ---\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI not found in environment');
  }

  await mongoose.connect(mongoUri);
  const usersColl = mongoose.connection.db!.collection('users');
  const problemsColl = mongoose.connection.db!.collection('problems');

  // Pre-cleanup
  await usersColl.deleteMany({ email: TEST_EMAIL });
  await problemsColl.deleteMany({ companyId: TEST_COMPANY_ID });

  console.log('1. Registering new hiring manager account...');
  const regRes = await fetch(`${BASE_URL}/api/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'TestHiringManagerVerify',
      email: TEST_EMAIL,
      phone: '+1-555-888-0001',
      password: TEST_PASSWORD,
      role: 'hiring_manager',
      companyId: TEST_COMPANY_ID,
      collegeId: 'COL_VERIFY_001',
      collegeName: 'Acme Institute',
    }),
  });

  const regData = await regRes.json();
  if (!regRes.ok || !regData.success) {
    throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
  }

  const profileId = regData.user.profileId;
  console.log(`✓ Registration succeeded. Profile ID: ${profileId}`);

  // Fetch the created user to get userId and verify token issued
  const userDoc = await usersColl.findOne({ email: TEST_EMAIL });
  if (!userDoc) throw new Error('User not found in DB after registration');

  console.log(`✓ User document in DB has emailVerified = ${userDoc.emailVerified}`);
  console.log(`✓ Verification token issued at: ${userDoc.emailVerificationTokenIssuedAt}`);

  const token = await createVerificationToken(userDoc._id.toString());
  const verificationLink = `${BASE_URL}/verify-email?token=${token}`;
  console.log(`\n========== EMAIL (STUB — VERIFIED IN TEST) ==========`);
  console.log(`To: ${TEST_EMAIL}`);
  console.log(`Subject: Verify your Tacet hiring manager account`);
  console.log(`Body:`);
  console.log(`Click this link to verify your account and start posting problems:\n\n${verificationLink}\n\nThis link expires in 24 hours.`);
  console.log(`=====================================================\n`);

  // 2. Log in as unverified hiring manager
  console.log('2. Logging in as unverified hiring manager...');
  const loginRes1 = await fetch(`${BASE_URL}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profileId,
      password: TEST_PASSWORD,
    }),
  });

  if (!loginRes1.ok) throw new Error(`Login 1 failed: ${await loginRes1.text()}`);
  const cookie1 = loginRes1.headers.get('set-cookie')?.split(';')[0] ?? '';

  console.log('   Attempting POST /api/problems/create with unverified session...');
  const createRes1 = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookie1,
    },
    body: JSON.stringify({
      title: 'Unverified Attempt Problem',
      description: 'Should be rejected because email is not verified.',
      difficulty: 'Medium',
      companyId: TEST_COMPANY_ID,
    }),
  });

  const createData1 = await createRes1.json();
  console.log(`   Response status: ${createRes1.status}`);
  console.log(`   Response body:`, createData1);

  if (createRes1.status !== 403) {
    throw new Error(`Expected 403 Forbidden for unverified hiring manager, got ${createRes1.status}`);
  }
  if (!createData1.error?.includes('Please verify your email')) {
    throw new Error(`Unexpected error message: ${createData1.error}`);
  }
  console.log('✓ Successfully blocked unverified hiring manager from posting problem (403 Forbidden).\n');

  // 3. Verify email using the token
  console.log('3. Calling POST /api/user/verify-email with verification token...');
  const verifyRes = await fetch(`${BASE_URL}/api/user/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  const verifyData = await verifyRes.json();
  console.log(`   Verify response:`, verifyData);
  if (!verifyRes.ok || !verifyData.success) {
    throw new Error(`Email verification failed: ${JSON.stringify(verifyData)}`);
  }
  console.log('✓ Email verified successfully.\n');

  // 4. Log in again to obtain a fresh session with emailVerified: true
  console.log('4. Logging in again to obtain refreshed session with emailVerified: true...');
  const loginRes2 = await fetch(`${BASE_URL}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profileId,
      password: TEST_PASSWORD,
    }),
  });

  if (!loginRes2.ok) throw new Error(`Login 2 failed: ${await loginRes2.text()}`);
  const cookie2 = loginRes2.headers.get('set-cookie')?.split(';')[0] ?? '';

  console.log('   Retrying POST /api/problems/create with verified session...');
  const createRes2 = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookie2,
    },
    body: JSON.stringify({
      title: 'Verified HM Problem',
      description: 'Successfully posted after email verification.',
      difficulty: 'Medium',
      companyId: TEST_COMPANY_ID,
    }),
  });

  const createData2 = await createRes2.json();
  console.log(`   Response status: ${createRes2.status}`);
  console.log(`   Response body:`, createData2);

  if (createRes2.status !== 201 || !createData2.success) {
    throw new Error(`Expected 201 Created for verified hiring manager, got ${createRes2.status}`);
  }
  console.log('✓ Successfully posted problem as verified hiring manager (201 Created).\n');

  // 5. Test POST /api/user/resend-verification on an already-verified account
  console.log('5. Testing POST /api/user/resend-verification on already-verified account...');
  const resendRes = await fetch(`${BASE_URL}/api/user/resend-verification`, {
    method: 'POST',
    headers: {
      cookie: cookie2,
    },
  });

  const resendData = await resendRes.json();
  console.log(`   Resend response status: ${resendRes.status}`);
  console.log(`   Resend response body:`, resendData);

  if (resendRes.status !== 400 || resendData.success) {
    throw new Error(`Expected 400 for resending verification to verified account, got ${resendRes.status}`);
  }
  if (!resendData.error?.includes('already verified')) {
    throw new Error(`Unexpected error message: ${resendData.error}`);
  }
  console.log('✓ Successfully rejected resend verification for already-verified account (400 Bad Request).\n');

  // 6. Cleanup
  console.log('6. Cleaning up test data...');
  await usersColl.deleteMany({ email: TEST_EMAIL });
  await problemsColl.deleteMany({ companyId: TEST_COMPANY_ID });
  await mongoose.disconnect();
  console.log('✓ Cleanup complete. All verification checks passed!\n');
}

main().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
