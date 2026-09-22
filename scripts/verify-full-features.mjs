import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error('MONGODB_URI not found in environment');
}

function extractCookie(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
  const match = raw.find((c) => c && c.startsWith('tacet_session=')) || raw[0] || '';
  return match.split(';')[0];
}

async function run() {
  console.log('=== STARTING LIVE VERIFICATION ===\n');

  // Connect directly to Mongo for fixture setups
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: REAL LOGOUT & SERVER-SIDE TOKEN REVOCATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 1: Real Logout & Server-Side Token Revocation ---');

  const testUserEmail = `logout_test_${Date.now()}@college.edu`;
  const registerRes = await fetch(`${BASE_URL}/api/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'LogoutUser',
      email: testUserEmail,
      password: process.env.TEST_ACCOUNT_PASSWORD_1,
      phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      role: 'student',
      collegeId: 'COLLEGE_01',
      collegeName: 'Institute of Tech',
    }),
  });

  const regData = await registerRes.json();
  if (!regData.success) throw new Error('Failed to register user: ' + JSON.stringify(regData));

  // Mark email verified
  await db.collection('users').updateOne(
    { email: testUserEmail },
    { $set: { emailVerified: true } }
  );

  // Login
  const userDoc0 = await db.collection('users').findOne({ email: testUserEmail });
  const loginRes = await fetch(`${BASE_URL}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: userDoc0.profileId, password: process.env.TEST_ACCOUNT_PASSWORD_1 }),
  });

  const loginJson = await loginRes.json();
  const sessionCookie = extractCookie(loginRes);
  console.log('1. User logged in:', loginJson);
  console.log('   Captured session cookie:', sessionCookie.slice(0, 35) + '...');

  // Confirm active session
  const meBefore = await fetch(`${BASE_URL}/api/user/profile`, {
    headers: { Cookie: sessionCookie },
  });
  console.log('2. GET /api/user/profile with active cookie status:', meBefore.status);
  if (meBefore.status !== 200) throw new Error('Active session check failed');

  // Call POST /api/user/logout
  const logoutRes = await fetch(`${BASE_URL}/api/user/logout`, {
    method: 'POST',
    headers: { Cookie: sessionCookie },
  });
  console.log('3. POST /api/user/logout status:', logoutRes.status);
  const logoutSetCookie = logoutRes.headers.get('set-cookie');
  console.log('   Logout Set-Cookie header value:');
  console.log('   -->', logoutSetCookie);

  // Directly verify MongoDB loggedOutAt was stamped
  const userInDb = await db.collection('users').findOne({ email: testUserEmail });
  console.log('4. MongoDB loggedOutAt timestamp:', userInDb?.loggedOutAt);
  if (!userInDb?.loggedOutAt) throw new Error('loggedOutAt was not set in DB!');

  // Now re-attach the OLD session cookie and hit GET /api/user/profile
  const meAfterOldCookie = await fetch(`${BASE_URL}/api/user/profile`, {
    headers: { Cookie: sessionCookie },
  });
  console.log('5. GET /api/user/profile with RE-ATTACHED OLD COOKIE status:', meAfterOldCookie.status);
  const meAfterJson = await meAfterOldCookie.json();
  console.log('   Response payload:', meAfterJson);

  if (meAfterOldCookie.status !== 401) {
    throw new Error(`Expected 401 Unauthorized for re-attached token, got ${meAfterOldCookie.status}`);
  }
  console.log('✓ TEST 1 PASSED: Server rejected re-attached JWT because iat < loggedOutAt!\n');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: MENTOR CLASSES, QR JOIN FLOW, & BULK APPROVE
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 2: Mentor Classes, QR Join Flow, & Bulk Approve ---');

  // Create Mentor
  const mentorEmail = `mentor_${Date.now()}@college.edu`;
  const mentorReg = await fetch(`${BASE_URL}/api/user/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'Prof Alan Turing',
      email: mentorEmail,
      password: process.env.TEST_ACCOUNT_PASSWORD_6,
      phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      role: 'mentor',
      collegeId: 'COLLEGE_CS_01',
      collegeName: 'School of Computer Science',
    }),
  });
  await db.collection('users').updateOne(
    { email: mentorEmail },
    { $set: { emailVerified: true } }
  );

  const mentorDoc = await db.collection('users').findOne({ email: mentorEmail });
  const mentorLogin = await fetch(`${BASE_URL}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: mentorDoc.profileId, password: process.env.TEST_ACCOUNT_PASSWORD_6 }),
  });
  const mentorCookie = extractCookie(mentorLogin);

  // Mentor creates class
  const createClassRes = await fetch(`${BASE_URL}/api/classes/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: mentorCookie },
    body: JSON.stringify({
      name: 'CS301 Advanced Operating Systems',
      password: process.env.TEST_ACCOUNT_PASSWORD_7,
    }),
  });
  const createClassData = await createClassRes.json();
  console.log('1. POST /api/classes/create status:', createClassRes.status);
  console.log('   Created classId:', createClassData.class?.classId);
  console.log('   QR Code Data URL prefix:', createClassData.class?.qrCodeDataUrl?.slice(0, 30) + '...');
  if (!createClassData.class?.qrCodeDataUrl?.startsWith('data:image/png;base64,')) {
    throw new Error('Invalid QR code data URL generated!');
  }
  const targetClassId = createClassData.class.classId;

  // Helper to create and login student in same college
  async function makeStudent(name, tag) {
    const email = `stud_${tag}_${Date.now()}@college.edu`;
    await fetch(`${BASE_URL}/api/user/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: name,
        email,
        password: process.env.TEST_ACCOUNT_PASSWORD_8,
        phone: `91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        role: 'student',
        collegeId: 'COLLEGE_CS_01',
        collegeName: 'School of Computer Science',
      }),
    });
    await db.collection('users').updateOne({ email }, { $set: { emailVerified: true } });
    const userDoc = await db.collection('users').findOne({ email });
    const logRes = await fetch(`${BASE_URL}/api/user/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId: userDoc.profileId, password: process.env.TEST_ACCOUNT_PASSWORD_8 }),
    });
    const cookie = extractCookie(logRes);
    return { id: userDoc._id.toString(), email, cookie };
  }

  const studentA = await makeStudent('Ada Lovelace', 'ada');
  const studentB = await makeStudent('Grace Hopper', 'grace');
  const studentC = await makeStudent('Margaret Hamilton', 'margaret');

  // Test join with WRONG password
  console.log('2. Student attempting join with WRONG password...');
  const wrongPassRes = await fetch(`${BASE_URL}/api/classes/${targetClassId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentA.cookie },
    body: JSON.stringify({ password: 'IncorrectPassword' }),
  });
  console.log('   Join with wrong password status:', wrongPassRes.status);
  const wrongPassJson = await wrongPassRes.json();
  console.log('   Error message:', wrongPassJson.error);
  if (wrongPassRes.status !== 400) throw new Error('Expected 400 for wrong password');

  // Assert NO pending membership created in DB
  const pendingCheck = await db.collection('classmemberships').findOne({
    studentId: new mongoose.Types.ObjectId(studentA.id),
  });
  console.log('   No membership record created after wrong password:', pendingCheck === null);
  if (pendingCheck !== null) throw new Error('Membership was created despite wrong password!');

  // Test join with CORRECT password for Student A
  console.log('3. Student A joining with CORRECT password...');
  const correctJoinRes = await fetch(`${BASE_URL}/api/classes/${targetClassId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentA.cookie },
    body: JSON.stringify({ password: process.env.TEST_ACCOUNT_PASSWORD_7 }),
  });
  console.log('   Join status:', correctJoinRes.status);
  const correctJoinJson = await correctJoinRes.json();
  console.log('   Membership status:', correctJoinJson.status);
  if (correctJoinJson.status !== 'pending') throw new Error('Expected status to be pending');

  // Join Student B and Student C
  await fetch(`${BASE_URL}/api/classes/${targetClassId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentB.cookie },
    body: JSON.stringify({ password: process.env.TEST_ACCOUNT_PASSWORD_7 }),
  });
  await fetch(`${BASE_URL}/api/classes/${targetClassId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentC.cookie },
    body: JSON.stringify({ password: process.env.TEST_ACCOUNT_PASSWORD_7 }),
  });

  // Mentor inspects pending requests
  console.log('4. Mentor fetching pending requests...');
  const reqsRes = await fetch(`${BASE_URL}/api/classes/${targetClassId}/requests`, {
    headers: { Cookie: mentorCookie },
  });
  const reqsData = await reqsRes.json();
  console.log('   Total pending requests retrieved:', reqsData.requests?.length);
  if (reqsData.requests?.length !== 3) throw new Error('Expected 3 pending requests');

  // Individual Approve on Student A
  console.log('5. Mentor testing individual APPROVE for Student A...');
  const approveARes = await fetch(
    `${BASE_URL}/api/classes/${targetClassId}/requests/${studentA.id}/approve`,
    { method: 'POST', headers: { Cookie: mentorCookie } }
  );
  console.log('   Individual approve status:', approveARes.status);

  // Bulk Approve remaining students (B and C)
  console.log('6. Mentor testing BULK APPROVE (approve-all) for remaining students...');
  const bulkApproveRes = await fetch(
    `${BASE_URL}/api/classes/${targetClassId}/requests/approve-all`,
    { method: 'POST', headers: { Cookie: mentorCookie } }
  );
  const bulkData = await bulkApproveRes.json();
  console.log('   Bulk approve modifiedCount:', bulkData.approvedCount);
  if (bulkData.approvedCount !== 2) throw new Error('Expected 2 students approved via bulk approve');

  // Verify class overview for Student A
  console.log('7. Mentor viewing student class-scoped overview...');
  const overviewRes = await fetch(
    `${BASE_URL}/api/classes/${targetClassId}/students/${studentA.id}/overview`,
    { headers: { Cookie: mentorCookie } }
  );
  const overviewData = await overviewRes.json();
  console.log('   Overview status:', overviewRes.status);
  console.log('   Student username:', overviewData.student?.username);
  console.log('   Class name:', overviewData.classInfo?.name);
  console.log('✓ TEST 2 PASSED: Full Class creation, QR generation, single and bulk approvals working!\n');

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: TIMED TESTS & DEADLINE SIMULATION (30s, 61s, 90s)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- TEST 3: Timed Tests & Deadline Window Simulation ---');

  // Mentor creates a timed test coding problem assigned to this class with timeLimit: 1 (1 minute)
  const createProbRes = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: mentorCookie },
    body: JSON.stringify({
      title: 'Reverse String Fast',
      description: 'Write code to reverse a string.',
      difficulty: 'Easy',
      problemFormat: 'coding',
      gradingMode: 'stdin_stdout',
      language: 'python',
      classId: createClassData.class.id,
      timeLimit: 1, // 1 minute limit
      testCases: [
        { input: 'hello', expectedOutput: 'olleh', hidden: false },
        { input: 'world', expectedOutput: 'dlrow', hidden: false },
      ],
    }),
  });
  const probData = await createProbRes.json();
  const timedProblemId = probData.problem?._id || probData.problem?.id;
  console.log('1. Created class-scoped timed problem ID:', timedProblemId);

  // Student A starts test session
  console.log('2. Student A starts timed test session...');
  const startSessionRes = await fetch(`${BASE_URL}/api/test-sessions/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentA.cookie },
    body: JSON.stringify({ problemId: timedProblemId }),
  });
  const startSessionData = await startSessionRes.json();
  console.log('   Session start status:', startSessionRes.status);
  console.log('   Server-stamped startedAt:', startSessionData.testSession?.startedAt);
  console.log('   Server-computed deadlineMs:', startSessionData.testSession?.deadlineMs);

  // Student saves draft
  console.log('3. Student A autosaves draft...');
  const draftRes = await fetch(`${BASE_URL}/api/test-sessions/draft`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: studentA.cookie },
    body: JSON.stringify({
      problemId: timedProblemId,
      draftCode: 'import sys\nprint(sys.stdin.read().strip()[::-1])',
    }),
  });
  console.log('   Draft save status:', draftRes.status);

  // ── SIMULATION A: Arriving 30 seconds past server deadline (within 60s grace) ──
  console.log('\n--> SIMULATION A: Submission arriving 30s past deadline (within 60s grace window)...');
  // Set startedAt to: now - (1 minute limit + 30 seconds) = 90 seconds ago
  await db.collection('testsessions').updateOne(
    { problemId: new mongoose.Types.ObjectId(timedProblemId), studentId: new mongoose.Types.ObjectId(studentA.id) },
    { $set: { startedAt: new Date(Date.now() - 90 * 1000), status: 'active' } }
  );

  const subA = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentA.cookie },
    body: JSON.stringify({
      problemId: timedProblemId,
      code: 'import sys\nprint(sys.stdin.read().strip()[::-1])',
      language: 'python',
    }),
  });
  console.log('   Result for +30s arrival status:', subA.status);
  const subAJson = await subA.json();
  console.log('   Success:', subAJson.success, '| Correctness:', subAJson.correctnessScore);
  if (subA.status !== 201) throw new Error('Expected 201 (accepted within grace) for +30s arrival');
  console.log('   ✓ +30s arrival ACCEPTED and graded normally under the 60s grace period.');

  // ── SIMULATION B: Arriving 61 seconds past server deadline (1s past 60s grace) ──
  console.log('\n--> SIMULATION B: Submission arriving 61s past deadline (grace expired by 1s)...');
  // Reset for Student B
  await fetch(`${BASE_URL}/api/test-sessions/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentB.cookie },
    body: JSON.stringify({ problemId: timedProblemId }),
  });
  // Set startedAt to: now - (1 minute limit + 61 seconds) = 121 seconds ago
  await db.collection('testsessions').updateOne(
    { problemId: new mongoose.Types.ObjectId(timedProblemId), studentId: new mongoose.Types.ObjectId(studentB.id) },
    { $set: { startedAt: new Date(Date.now() - 121 * 1000), status: 'active' } }
  );

  const subB = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentB.cookie },
    body: JSON.stringify({
      problemId: timedProblemId,
      code: 'import sys\nprint(sys.stdin.read().strip()[::-1])',
      language: 'python',
    }),
  });
  console.log('   Result for +61s arrival status:', subB.status);
  const subBJson = await subB.json();
  console.log('   Server rejection response:', subBJson.error);
  if (subB.status !== 403) throw new Error(`Expected 403 for +61s arrival, got ${subB.status}`);
  console.log('   ✓ +61s arrival REJECTED with 403 (grace window closed).');

  // ── SIMULATION C: Arriving 90 seconds past server deadline (30s past 60s grace) ──
  console.log('\n--> SIMULATION C: Submission arriving 90s past deadline (grace expired by 30s)...');
  await fetch(`${BASE_URL}/api/test-sessions/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentC.cookie },
    body: JSON.stringify({ problemId: timedProblemId }),
  });
  // Set startedAt to: now - (1 minute limit + 90 seconds) = 150 seconds ago
  await db.collection('testsessions').updateOne(
    { problemId: new mongoose.Types.ObjectId(timedProblemId), studentId: new mongoose.Types.ObjectId(studentC.id) },
    { $set: { startedAt: new Date(Date.now() - 150 * 1000), status: 'active' } }
  );

  const subC = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentC.cookie },
    body: JSON.stringify({
      problemId: timedProblemId,
      code: 'import sys\nprint(sys.stdin.read().strip()[::-1])',
      language: 'python',
    }),
  });
  console.log('   Result for +90s arrival status:', subC.status);
  const subCJson = await subC.json();
  console.log('   Server rejection response:', subCJson.error);
  if (subC.status !== 403) throw new Error(`Expected 403 for +90s arrival, got ${subC.status}`);
  console.log('   ✓ +90s arrival REJECTED with 403 (grace window closed).');

  console.log('\n=========================================');
  console.log('ALL VERIFICATIONS PASSED WITH REAL EVIDENCE!');
  console.log('=========================================');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
