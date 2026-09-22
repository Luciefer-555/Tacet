import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI as string;
const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('=== Proof-of-Concept: Authentication Spoofing Test ===\n');

  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  const db = mongoose.connection.db!;
  const usersColl = db.collection('users');

  // Step 1: Query an existing student user
  const student = await usersColl.findOne({ role: 'student' });
  if (!student) {
    console.error('✗ Prerequisite missing: No student user found in database.');
    process.exit(1);
  }
  console.log(`1. Target Student Account:`);
  console.log(`   - Username:  ${student.username}`);
  console.log(`   - ProfileId: ${student.profileId}`);
  console.log(`   - Role:      ${student.role}\n`);

  // Step 2: Query an existing hiring manager user
  const hiringManager = await usersColl.findOne({ role: 'hiring_manager' });
  if (!hiringManager) {
    console.error('✗ Prerequisite missing: No hiring_manager user found in database.');
    process.exit(1);
  }
  console.log(`2. Target Hiring Manager Account (victim of impersonation):`);
  console.log(`   - Username:  ${hiringManager.username}`);
  console.log(`   - ProfileId: ${hiringManager.profileId}`);
  console.log(`   - Role:      ${hiringManager.role}\n`);

  // Step 3: Sending unauthenticated HTTP POST to /api/problems/create
  console.log('3. Sending unauthenticated HTTP POST to /api/problems/create:');
  console.log('   - No session cookie included at all');
  console.log(`   - Body profileId: "${hiringManager.profileId}" (spoofed, should now be ignored)`);

  const response = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profileId: hiringManager.profileId,
      title: 'PoC Spoofed Problem - Should Fail Now',
      description: 'This should be rejected with 401.',
      difficulty: 'Medium',
    }),
  });

  const status = response.status;
  const data = await response.json();
  console.log(`   Response Status Code: ${status}`);
  console.log('   Response Body:', JSON.stringify(data, null, 2));

  console.log('\n======================================================');
  if (status === 401) {
    console.log('VERDICT: FIXED — unauthenticated request correctly rejected with 401.');
  } else {
    console.log('VERDICT: STILL VULNERABLE — expected 401, got ' + status);
  }
  console.log('======================================================\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});