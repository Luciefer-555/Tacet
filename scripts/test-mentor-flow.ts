import * as dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createVerificationToken } from '../lib/auth';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000';
const TEST_PASSWORD = 'TestPassword123!';

const MENTOR_1_EMAIL = 'mentor1_test@mit.edu';
const MENTOR_2_EMAIL = 'mentor2_test@stanford.edu';
const STUDENT_SAME_EMAIL = 'student_mit@mit.edu';
const STUDENT_DIFF_EMAIL = 'student_harv@harvard.edu';

const COLLEGE_MIT = 'COL_MIT_001';
const COLLEGE_STANFORD = 'COL_STAN_002';
const COLLEGE_HARVARD = 'COL_HARV_003';

async function login(profileId: string) {
  const res = await fetch(`${BASE_URL}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId, password: TEST_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed for ${profileId}: ${res.status}`);
  return res.headers.get('set-cookie')?.split(';')[0] ?? '';
}

async function main() {
  console.log('=== Starting End-to-End Mentor Role & Authorization Test ===\n');

  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db!;
  const usersColl = db.collection('users');
  const problemsColl = db.collection('problems');
  const submissionsColl = db.collection('submissions');

  const testEmails = [MENTOR_1_EMAIL, MENTOR_2_EMAIL, STUDENT_SAME_EMAIL, STUDENT_DIFF_EMAIL];
  await usersColl.deleteMany({ email: { $in: testEmails } });
  await problemsColl.deleteMany({ collegeId: { $in: [COLLEGE_MIT, COLLEGE_STANFORD] } });

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  // Pre-seed Mentor 2 (Stanford), Student 1 (MIT), Student 2 (Harvard)
  await usersColl.insertMany([
    {
      username: 'MentorStanford',
      profileId: 'syncin@MENTOR_STAN',
      collegeId: COLLEGE_STANFORD,
      collegeName: 'Stanford University',
      email: MENTOR_2_EMAIL,
      phone: '+1-555-777-0002',
      role: 'mentor',
      emailVerified: true,
      passwordHash,
      createdAt: new Date(),
    },
    {
      username: 'StudentMIT',
      profileId: 'syncin@STUDENT_MIT',
      collegeId: COLLEGE_MIT,
      collegeName: 'MIT',
      email: STUDENT_SAME_EMAIL,
      phone: '+1-555-777-0003',
      role: 'student',
      emailVerified: true,
      passwordHash,
      createdAt: new Date(),
    },
    {
      username: 'StudentHarvard',
      profileId: 'syncin@STUDENT_HARV',
      collegeId: COLLEGE_HARVARD,
      collegeName: 'Harvard University',
      email: STUDENT_DIFF_EMAIL,
      phone: '+1-555-777-0004',
      role: 'student',
      emailVerified: true,
      passwordHash,
      createdAt: new Date(),
    },
  ]);
  console.log('✓ Seeded Mentor 2 (Stanford), Student Same (MIT), and Student Diff (Harvard).\n');

  // STEP 1: Register Mentor 1 (MIT)
  console.log('1. Registering Mentor 1 (MIT)...');
  const regRes = await fetch(`${BASE_URL}/api/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'ProfessorMIT',
      email: MENTOR_1_EMAIL,
      phone: '+1-555-777-0001',
      password: TEST_PASSWORD,
      role: 'mentor',
      collegeId: COLLEGE_MIT,
      collegeName: 'MIT',
    }),
  });
  const regData = await regRes.json();
  if (!regRes.ok || !regData.success) {
    throw new Error(`Mentor registration failed: ${JSON.stringify(regData)}`);
  }
  const mentor1ProfileId = regData.user.profileId;
  console.log(`   Registered profile: ${mentor1ProfileId}`);

  const mentor1Doc = await usersColl.findOne({ email: MENTOR_1_EMAIL });
  if (!mentor1Doc) throw new Error('Mentor 1 not found in DB');
  console.log(`   emailVerified in DB: ${mentor1Doc.emailVerified}`);
  console.log(`   Verification token issued: ${mentor1Doc.emailVerificationTokenIssuedAt != null}`);

  // STEP 2: Unverified mentor attempts to create class assignment -> 403
  console.log('\n2. Unverified mentor attempting to create class assignment...');
  const cookieUnverified = await login(mentor1ProfileId);
  const unverifiedPostRes = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieUnverified },
    body: JSON.stringify({
      title: 'Distributed Systems Project 1',
      description: 'Implement Raft consensus algorithm.',
      difficulty: 'Hard',
      collegeId: COLLEGE_MIT,
    }),
  });
  const unverifiedPostData = await unverifiedPostRes.json();
  console.log(`   Status: ${unverifiedPostRes.status}`);
  console.log(`   Body:`, unverifiedPostData);
  if (unverifiedPostRes.status !== 403 || !unverifiedPostData.error?.includes('verify your email')) {
    throw new Error(`Expected 403 with email verification error, got ${unverifiedPostRes.status}`);
  }
  console.log('✓ Correctly rejected unverified mentor (403 Forbidden).');

  // STEP 3: Verify Mentor 1 email
  console.log('\n3. Verifying Mentor 1 email via verification token...');
  const token = await createVerificationToken(mentor1Doc._id.toString());
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
  console.log('✓ Mentor 1 email successfully verified.');

  // STEP 4: Verified mentor logs in and posts class assignment
  console.log('\n4. Verified mentor posting class assignment...');
  const cookieMentor1 = await login(mentor1ProfileId);
  const createRes = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieMentor1 },
    body: JSON.stringify({
      title: 'Distributed Systems Project 1',
      description: 'Implement Raft consensus algorithm in Go or TypeScript.',
      difficulty: 'Hard',
      collegeId: COLLEGE_MIT,
    }),
  });
  const createData = await createRes.json();
  console.log(`   Status: ${createRes.status}`);
  console.log(`   Body:`, createData);
  if (createRes.status !== 201 || !createData.success) {
    throw new Error(`Failed to create assignment: ${JSON.stringify(createData)}`);
  }
  const problemId = createData.problem._id;
  console.log(`✓ Assignment created! ID: ${problemId}`);
  console.log(`   problemType: ${createData.problem.problemType}`);
  console.log(`   postedByRole: ${createData.problem.postedByRole}`);
  console.log(`   collegeId: ${createData.problem.collegeId}`);

  if (createData.problem.problemType !== 'class_assignment' || createData.problem.collegeId !== COLLEGE_MIT) {
    throw new Error(`Problem properties mismatch: ${JSON.stringify(createData.problem)}`);
  }

  // STEP 5: Mentor 1 attempts to post for a DIFFERENT college -> 403
  console.log('\n5. Mentor 1 attempting to post for a DIFFERENT college (Stanford)...');
  const crossCollegePostRes = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieMentor1 },
    body: JSON.stringify({
      title: 'Spoofed Assignment',
      description: 'Trying to post for Stanford.',
      difficulty: 'Easy',
      collegeId: COLLEGE_STANFORD,
    }),
  });
  const crossCollegePostData = await crossCollegePostRes.json();
  console.log(`   Status: ${crossCollegePostRes.status}`);
  console.log(`   Body:`, crossCollegePostData);
  if (crossCollegePostRes.status !== 403 || !crossCollegePostData.error?.includes('different college')) {
    throw new Error(`Expected 403 for different college assignment, got ${crossCollegePostRes.status}`);
  }
  console.log('✓ Correctly rejected cross-college assignment posting (403 Forbidden).');

  // STEP 6: Cross-college student (Harvard) attempts to submit to MIT class assignment -> 403 (Option A)
  console.log('\n6. Cross-college student (Harvard) attempting to submit to MIT class assignment...');
  const cookieStudentHarv = await login('syncin@STUDENT_HARV');
  const crossStudentSubRes = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieStudentHarv },
    body: JSON.stringify({
      problemId,
      content: 'Here is my submission from Harvard.',
    }),
  });
  const crossStudentSubData = await crossStudentSubRes.json();
  console.log(`   Status: ${crossStudentSubRes.status}`);
  console.log(`   Body:`, crossStudentSubData);
  if (crossStudentSubRes.status !== 403 || !crossStudentSubData.error?.includes('restricted to students of the hosting college')) {
    throw new Error(`Expected 403 for cross-college student submission, got ${crossStudentSubRes.status}`);
  }
  console.log('✓ Option A enforced: Cross-college student submission rejected (403 Forbidden).');

  // STEP 7: Same-college student (MIT) submits to MIT class assignment -> 201 Created
  console.log('\n7. Same-college student (MIT) submitting to MIT class assignment...');
  const cookieStudentMit = await login('syncin@STUDENT_MIT');
  const validSubRes = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieStudentMit },
    body: JSON.stringify({
      problemId,
      content: 'Here is my complete Raft implementation with leader election and log replication.',
    }),
  });
  const validSubData = await validSubRes.json();
  console.log(`   Status: ${validSubRes.status}`);
  console.log(`   Body:`, validSubData);
  if (validSubRes.status !== 201 || !validSubData.success) {
    throw new Error(`Expected 201 for same-college student submission, got ${validSubRes.status}`);
  }
  console.log('✓ Same-college student submission accepted (201 Created).');

  // STEP 8: Different mentor (Stanford) attempts to VIEW submissions for MIT assignment -> 403
  console.log('\n8. Different mentor (Stanford) attempting to VIEW submissions for MIT assignment...');
  const cookieMentor2 = await login('syncin@MENTOR_STAN');
  const crossMentorViewRes = await fetch(`${BASE_URL}/api/submissions/for-problem/${problemId}`, {
    method: 'GET',
    headers: { cookie: cookieMentor2 },
  });
  const crossMentorViewData = await crossMentorViewRes.json();
  console.log(`   Status: ${crossMentorViewRes.status}`);
  console.log(`   Body:`, crossMentorViewData);
  if (crossMentorViewRes.status !== 403 || !crossMentorViewData.error?.includes('your own class assignments')) {
    throw new Error(`Expected 403 for cross-mentor submission viewing, got ${crossMentorViewRes.status}`);
  }
  console.log('✓ Cross-mentor submission viewing rejected (403 Forbidden).');

  // STEP 9: Different mentor (Stanford) attempts to RANK submissions for MIT assignment -> 403
  console.log('\n9. Different mentor (Stanford) attempting to RANK submissions for MIT assignment...');
  const crossMentorRankRes = await fetch(`${BASE_URL}/api/submissions/rank/${problemId}`, {
    method: 'POST',
    headers: { cookie: cookieMentor2 },
  });
  const crossMentorRankData = await crossMentorRankRes.json();
  console.log(`   Status: ${crossMentorRankRes.status}`);
  console.log(`   Body:`, crossMentorRankData);
  if (crossMentorRankRes.status !== 403 || !crossMentorRankData.error?.includes('your own class assignments')) {
    throw new Error(`Expected 403 for cross-mentor submission ranking, got ${crossMentorRankRes.status}`);
  }
  console.log('✓ Cross-mentor submission ranking rejected (403 Forbidden).');

  // STEP 10: Owning mentor (MIT) views submissions -> 200 OK
  console.log('\n10. Owning mentor (MIT) viewing submissions for own assignment...');
  const ownerViewRes = await fetch(`${BASE_URL}/api/submissions/for-problem/${problemId}`, {
    method: 'GET',
    headers: { cookie: cookieMentor1 },
  });
  const ownerViewData = await ownerViewRes.json();
  console.log(`   Status: ${ownerViewRes.status}`);
  console.log(`   Submissions count: ${ownerViewData.submissions?.length}`);
  if (ownerViewRes.status !== 200 || !ownerViewData.success || ownerViewData.submissions?.length !== 1) {
    throw new Error(`Expected 200 with 1 submission for owning mentor, got ${ownerViewRes.status}`);
  }
  console.log('✓ Owning mentor successfully viewed submissions (200 OK).');

  // STEP 11: Owning mentor (MIT) ranks submissions -> 200 OK
  console.log('\n11. Owning mentor (MIT) ranking submissions for own assignment...');
  const ownerRankRes = await fetch(`${BASE_URL}/api/submissions/rank/${problemId}`, {
    method: 'POST',
    headers: { cookie: cookieMentor1 },
  });
  const ownerRankData = await ownerRankRes.json();
  console.log(`   Status: ${ownerRankRes.status}`);
  console.log(`   Ranking results:`, ownerRankData);
  if (ownerRankRes.status !== 200 || !ownerRankData.success) {
    throw new Error(`Expected 200 for owning mentor ranking, got ${ownerRankRes.status}`);
  }
  console.log('✓ Owning mentor successfully ranked submissions (200 OK).');

  // STEP 12: Cleanup
  console.log('\n12. Cleaning up test data...');
  await usersColl.deleteMany({ email: { $in: testEmails } });
  await problemsColl.deleteOne({ _id: new mongoose.Types.ObjectId(problemId) });
  await submissionsColl.deleteMany({ problemId: new mongoose.Types.ObjectId(problemId) });
  await mongoose.disconnect();
  console.log('✓ Cleanup complete. All 11 verification checks PASSED!');
}

main().catch((err) => {
  console.error('\n✗ Test failed:', err);
  process.exit(1);
});
