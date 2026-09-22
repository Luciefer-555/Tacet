/**
 * verify-auto-promote.mjs
 * Live end-to-end verification of auto-promotion of dropped-connection drafts.
 *
 * Run: node scripts/verify-auto-promote.mjs
 *
 * Proves:
 *   1. draftCode is stored after PATCH /api/test-sessions/draft
 *   2. Session past deadline+5min with draft is promoted via overview hook
 *   3. Promotion creates a real Submission with autoPromoted=true
 *   4. SCOPING: mentor loading Student A's overview promotes A, NOT B
 *   5. GET /api/submissions/mine shows autoPromoted flag
 *   6. Explicit /api/test-sessions/auto-promote is idempotent for already-promoted A
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local') });

import mongoose from 'mongoose';

// ── helpers ──────────────────────────────────────────────────────────────────

const BASE = 'http://localhost:3000';
const uid = () => Math.random().toString(36).slice(2, 8);

function extractCookie(headers) {
  const raw = headers.getSetCookie?.() ?? [];
  if (raw.length) return raw.map(c => c.split(';')[0]).join('; ');
  return (headers.get('set-cookie') ?? '').split(';')[0];
}

async function api(method, path, body, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _parseError: text.slice(0, 300) }; }
  return { status: res.status, json, headers: res.headers };
}

function ok(label, cond, detail = '') {
  if (cond) {
    console.log(`  ✅ ${label}`);
  } else {
    console.error(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    process.exitCode = 1;
  }
}

// ── MongoDB direct (for email-verify bypass + backdating) ────────────────────

async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env.local');
  if (mongoose.connection.readyState === 0) await mongoose.connect(uri);
}

const db = () => mongoose.connection.db;
const { ObjectId } = mongoose.Types;

async function setEmailVerified(userId) {
  await db().collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { emailVerified: true } }
  );
}

async function backdateSession(sessionId) {
  // Push startedAt 7min back → past timeLimit(1min) + 5min grace = 6min
  const sevenMinAgo = new Date(Date.now() - 7 * 60 * 1000);
  await db().collection('testsessions').updateOne(
    { _id: new ObjectId(sessionId) },
    { $set: { startedAt: sevenMinAgo } }
  );
}

async function getTestSession(id) {
  return db().collection('testsessions').findOne({ _id: new ObjectId(id) });
}

async function getSubmission(id) {
  return db().collection('submissions').findOne({ _id: new ObjectId(id) });
}

async function getUserId(profileId) {
  const u = await db().collection('users').findOne({ profileId });
  return u?._id?.toString();
}

// ── registration + login ──────────────────────────────────────────────────────

async function register(suffix) {
  const email = `ap_${suffix}_${uid()}@college.edu`;
  const TEST_PASSWORD = process.env.TEST_ACCOUNT_PASSWORD_5;
  const r = await api('POST', '/api/user/register', {
    username: `AP_${suffix}_${uid()}`,
    email,
    password,
    phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    collegeName: 'Test University',
    collegeId: 'testcollege',
    role: suffix === 'mentor' ? 'mentor' : 'student',
  });
  if (r.status !== 200) throw new Error(`Register ${suffix} failed (${r.status}): ${JSON.stringify(r.json)}`);
  const profileId = r.json.user?.profileId;
  if (!profileId) throw new Error(`No profileId in register response: ${JSON.stringify(r.json)}`);
  return { profileId, email, password };
}

async function login(profileId, password) {
  const r = await api('POST', '/api/user/login', { profileId, password });
  if (r.status !== 200) throw new Error(`Login ${profileId} failed (${r.status}): ${JSON.stringify(r.json)}`);
  return extractCookie(r.headers);
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log('\n=== AUTO-PROMOTE VERIFICATION ===\n');

await connectMongo();

// 1. Register 3 users
process.stdout.write('→ Registering mentor + 2 students… ');
const [mentorCreds, studentACreds, studentBCreds] = await Promise.all([
  register('mentor'), register('studentA'), register('studentB'),
]);
console.log('done');

// Get mentor user ID first (needed before login for DB bypass)
process.stdout.write('→ Getting mentor userId for email bypass… ');
const mentorId = await getUserId(mentorCreds.profileId);
console.log(mentorId);

// 3. Verify mentor email BEFORE login so it's baked into the JWT
process.stdout.write('→ Verifying mentor email via DB bypass… ');
await setEmailVerified(mentorId);
console.log('done');

// 2b. Login all three (mentor after email verify)
process.stdout.write('→ Logging in… ');
const [mentorCookie, studentACookie, studentBCookie] = await Promise.all([
  login(mentorCreds.profileId, mentorCreds.password),
  login(studentACreds.profileId, studentACreds.password),
  login(studentBCreds.profileId, studentBCreds.password),
]);
console.log('done');

const [studentAId, studentBId] = await Promise.all([
  getUserId(studentACreds.profileId),
  getUserId(studentBCreds.profileId),
]);

// 4. Mentor creates a class
process.stdout.write('→ Creating class… ');
const classPassword = 'class1234';
const classR = await api('POST', '/api/classes/create', {
  name: `AP_Class_${uid()}`,
  password: classPassword,
}, mentorCookie);
ok('class created (201)', classR.status === 201, JSON.stringify(classR.json).slice(0, 200));
const classMongoId = classR.json.class?.id;   // MongoDB ObjectId string
const classStringId = classR.json.class?.classId; // e.g. "APCLA-AB1234"
console.log(`  classId (string): ${classStringId}  classId (ObjectId): ${classMongoId}`);

// 5. Students join class (using string classId in URL, password in body)
process.stdout.write('→ Students joining class… ');
const [joinA, joinB] = await Promise.all([
  api('POST', `/api/classes/${classStringId}/join`, { password: classPassword }, studentACookie),
  api('POST', `/api/classes/${classStringId}/join`, { password: classPassword }, studentBCookie),
]);
ok('A join pending', [200, 201].includes(joinA.status), `status=${joinA.status} ${JSON.stringify(joinA.json)}`);
ok('B join pending', [200, 201].includes(joinB.status), `status=${joinB.status} ${JSON.stringify(joinB.json)}`);

// 6. Mentor approves both (studentId in URL path)
process.stdout.write('→ Mentor approving students… ');
const [approveA, approveB] = await Promise.all([
  api('POST', `/api/classes/${classStringId}/requests/${studentAId}/approve`, {}, mentorCookie),
  api('POST', `/api/classes/${classStringId}/requests/${studentBId}/approve`, {}, mentorCookie),
]);
ok('A approved', approveA.status === 200, `status=${approveA.status} ${JSON.stringify(approveA.json)}`);
ok('B approved', approveB.status === 200, `status=${approveB.status} ${JSON.stringify(approveB.json)}`);

// 7. Mentor creates timed coding problem (classId = MongoDB ObjectId)
process.stdout.write('→ Creating timed coding problem… ');
const probR = await api('POST', '/api/problems/create', {
  title: `AP_TwoSum_${uid()}`,
  description: 'Return indices of two numbers that add to target.',
  difficulty: 'Easy',
  classId: classMongoId,
  problemFormat: 'coding',
  gradingMode: 'stdin_stdout',
  language: 'python',
  timeLimit: 1,
  testCases: [
    { input: '4\n2 7 11 15\n9', expectedOutput: '0 1' },
    { input: '3\n3 2 4\n6', expectedOutput: '1 2' },
  ],
}, mentorCookie);
ok('problem created (201)', probR.status === 201, JSON.stringify(probR.json).slice(0, 300));
console.log('  RAW problem response:', JSON.stringify(probR.json).slice(0, 500));
const problemId = probR.json.problem?._id;
console.log(`  problemId: ${problemId}`);

// 8. Both students start test sessions
process.stdout.write('→ Students starting test sessions… ');
const [startA, startB] = await Promise.all([
  api('POST', '/api/test-sessions/start', { problemId }, studentACookie),
  api('POST', '/api/test-sessions/start', { problemId }, studentBCookie),
]);
ok('A session started', [200, 201].includes(startA.status), `status=${startA.status} ${JSON.stringify(startA.json).slice(0, 150)}`);
ok('B session started', [200, 201].includes(startB.status), `status=${startB.status} ${JSON.stringify(startB.json).slice(0, 150)}`);
const sessionAId = startA.json.testSession?.id;
const sessionBId = startB.json.testSession?.id;
console.log(`  sessionA: ${sessionAId}`);
console.log(`  sessionB: ${sessionBId}`);

// 9. Both autosave drafts (PATCH, field = draftCode)
process.stdout.write('→ Autosaving drafts (PATCH /api/test-sessions/draft)… ');
const [draftA, draftB] = await Promise.all([
  api('PATCH', '/api/test-sessions/draft', { problemId, draftCode: 'def solution(): return [0,1]  # Student A draft' }, studentACookie),
  api('PATCH', '/api/test-sessions/draft', { problemId, draftCode: 'def solution(): return [1,2]  # Student B draft' }, studentBCookie),
]);
ok('A draft saved', draftA.status === 200, JSON.stringify(draftA.json));
ok('B draft saved', draftB.status === 200, JSON.stringify(draftB.json));

// 10. Read both sessions from DB before backdating
const sessionABefore = await getTestSession(sessionAId);
const sessionBBefore = await getTestSession(sessionBId);

console.log('\n── SESSION STATE BEFORE PROMOTION ──');
console.log('Student A TestSession:', JSON.stringify({
  _id: sessionABefore?._id,
  status: sessionABefore?.status,
  draftCode: sessionABefore?.draftCode?.slice(0, 80),
  autoPromoted: sessionABefore?.autoPromoted,
  startedAt: sessionABefore?.startedAt,
}, null, 2));
console.log('Student B TestSession:', JSON.stringify({
  _id: sessionBBefore?._id,
  status: sessionBBefore?.status,
  draftCode: sessionBBefore?.draftCode?.slice(0, 80),
  autoPromoted: sessionBBefore?.autoPromoted,
  startedAt: sessionBBefore?.startedAt,
}, null, 2));

ok('A has draftCode', !!sessionABefore?.draftCode, String(sessionABefore?.draftCode));
ok('B has draftCode', !!sessionBBefore?.draftCode, String(sessionBBefore?.draftCode));
ok('A status=active before', sessionABefore?.status === 'active');
ok('B status=active before', sessionBBefore?.status === 'active');
ok('A autoPromoted=false before', !sessionABefore?.autoPromoted);
ok('B autoPromoted=false before', !sessionBBefore?.autoPromoted);

// 11. Backdate both → past timeLimit(1min) + 5min grace
process.stdout.write('\n→ Backdating both sessions to 7 min ago… ');
await backdateSession(sessionAId);
await backdateSession(sessionBId);
console.log('done');

// 12. === SCOPING TEST === Mentor loads ONLY Student A's overview
console.log('\n── SCOPING TEST: mentor loads Student A overview only ──');
const overviewA = await api('GET', `/api/classes/${classStringId}/students/${studentAId}/overview`, null, mentorCookie);
ok('overview A returned 200', overviewA.status === 200, JSON.stringify(overviewA.json).slice(0, 300));

// 13. Check DB state after
const sessionAAfter = await getTestSession(sessionAId);
const sessionBAfter = await getTestSession(sessionBId);

console.log('\n── SESSION STATE AFTER MENTOR LOADED STUDENT A ONLY ──');
console.log('Student A TestSession:', JSON.stringify({
  _id: sessionAAfter?._id,
  status: sessionAAfter?.status,
  autoPromoted: sessionAAfter?.autoPromoted,
  autoPromotedAt: sessionAAfter?.autoPromotedAt,
  submissionId: sessionAAfter?.submissionId,
}, null, 2));
console.log('Student B TestSession:', JSON.stringify({
  _id: sessionBAfter?._id,
  status: sessionBAfter?.status,
  autoPromoted: sessionBAfter?.autoPromoted,
  autoPromotedAt: sessionBAfter?.autoPromotedAt,
  submissionId: sessionBAfter?.submissionId,
}, null, 2));

ok('A promoted → submitted', sessionAAfter?.status === 'submitted', `status=${sessionAAfter?.status}`);
ok('A autoPromoted=true', sessionAAfter?.autoPromoted === true, `autoPromoted=${sessionAAfter?.autoPromoted}`);
ok('A has submissionId', !!sessionAAfter?.submissionId);
ok('B NOT promoted (status≠submitted)', sessionBAfter?.status !== 'submitted', `status=${sessionBAfter?.status}`);
ok('B autoPromoted still false', !sessionBAfter?.autoPromoted, `autoPromoted=${sessionBAfter?.autoPromoted}`);
ok('B has no submissionId', !sessionBAfter?.submissionId, String(sessionBAfter?.submissionId));

// 14. Verify Student A's Submission document
if (sessionAAfter?.submissionId) {
  const sub = await getSubmission(sessionAAfter.submissionId.toString());
  console.log('\n── STUDENT A SUBMISSION DOCUMENT ──');
  console.log(JSON.stringify({
    _id: sub?._id,
    studentId: sub?.studentId,
    problemId: sub?.problemId,
    autoPromoted: sub?.autoPromoted,
    autoPromotionReason: sub?.autoPromotionReason,
    correctnessScore: sub?.correctnessScore,
    createdAt: sub?.createdAt,
  }, null, 2));
  ok('sub.autoPromoted=true', sub?.autoPromoted === true, `autoPromoted=${sub?.autoPromoted}`);
  ok('sub.autoPromotionReason set', !!sub?.autoPromotionReason, sub?.autoPromotionReason);
  ok('sub.correctnessScore is number', typeof sub?.correctnessScore === 'number', String(sub?.correctnessScore));
} else {
  console.error('  ⚠️  No submissionId on session A');
  process.exitCode = 1;
}

// 14b. POST /api/test-sessions/start (Student A attempts to re-enter)
console.log('\n── POST /api/test-sessions/start (Student A re-entering promoted session) ──');
const restartA = await api('POST', '/api/test-sessions/start', { problemId }, studentACookie);
console.log('Student A start response:', JSON.stringify(restartA.json, null, 2));
ok('re-start returns 200', restartA.status === 200, `status=${restartA.status}`);
ok('re-start status=submitted', restartA.json.status === 'submitted');
ok('re-start autoPromoted=true', restartA.json.autoPromoted === true);
ok('re-start has autoPromoted message', restartA.json.message === 'Your test was auto-submitted from your last saved draft after your connection was lost', restartA.json.message);

// 15. GET /api/submissions/mine (Student A) — verify autoPromoted flag appears
console.log('\n── GET /api/submissions/mine (Student A) ──');
const mineA = await api('GET', '/api/submissions/mine', null, studentACookie);
ok('/submissions/mine 200', mineA.status === 200, `status=${mineA.status}`);
const myAutoPromotedSub = mineA.json.submissions?.find(s => s.autoPromoted);
ok('autoPromoted submission visible in /mine', !!myAutoPromotedSub, JSON.stringify(myAutoPromotedSub));
if (myAutoPromotedSub) {
  console.log('  autoPromoted submission:', JSON.stringify({
    _id: myAutoPromotedSub._id,
    autoPromoted: myAutoPromotedSub.autoPromoted,
    autoPromotionReason: myAutoPromotedSub.autoPromotionReason,
    correctnessScore: myAutoPromotedSub.correctnessScore,
  }, null, 2));
}

// 16. POST /api/test-sessions/auto-promote on A — must be idempotent (0 promoted)
console.log('\n── POST /api/test-sessions/auto-promote (A already promoted — idempotency) ──');
const explicitA = await api('POST', '/api/test-sessions/auto-promote', { studentId: studentAId, problemId }, mentorCookie);
ok('explicit promote 200', explicitA.status === 200, JSON.stringify(explicitA.json).slice(0, 200));
ok('promotedCount=0 (idempotent)', explicitA.json.promotedCount === 0,
  `promotedCount=${explicitA.json.promotedCount} outcomes=${JSON.stringify(explicitA.json.outcomes)}`);

console.log('\n=== DONE ===');
console.log(process.exitCode ? '❌ Some checks failed (see above).' : '✅ All checks passed.');
await mongoose.disconnect();
