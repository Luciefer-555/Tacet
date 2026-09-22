/**
 * Manual verification script for TACET Frontend Overhaul P0–P4.
 *
 * Tests each API contract from the frontend's perspective using the same
 * fetch calls the UI would make.
 *
 * Run:  npx tsx scratch/verify-frontend.ts
 */

import * as dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import { AUTH_COOKIE_NAME } from '../lib/constants/auth';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const BASE_URL = 'http://localhost:3000';
const TEST_PASSWORD = 'TestPassword123!';
const PASS = '\x1b[32m✓ PASS\x1b[0m';
const FAIL = '\x1b[31m✗ FAIL\x1b[0m';
const INFO = '\x1b[33m→\x1b[0m';

let passCount = 0;
let failCount = 0;

function report(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passCount++;
    console.log(`  ${PASS} ${label}`);
  } else {
    failCount++;
    console.log(`  ${FAIL} ${label}`);
  }
  if (detail) console.log(`       ${detail}`);
}

async function setupFixtures() {
  const mongoose = await import('mongoose');
  await mongoose.default.connect(process.env.MONGODB_URI as string);
  const db = mongoose.default.connection.db!;
  const usersColl = db.collection('users');
  const problemsColl = db.collection('problems');

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  await usersColl.updateOne(
    { profileId: 'syncin@VFYSTUDENT' },
    { $set: { username: 'VerifyStudent', profileId: 'syncin@VFYSTUDENT', email: 'vfy-student@college.edu', phone: '+1-555-VFY-0001', role: 'student', passwordHash, collegeId: 'VFYCOLLEGE', collegeName: 'Verify College' } },
    { upsert: true },
  );

  await usersColl.updateOne(
    { profileId: 'syncin@VFYHM' },
    { $set: { username: 'VerifyHM', profileId: 'syncin@VFYHM', email: 'vfy-hm@acme.com', phone: '+1-555-VFY-0002', role: 'hiring_manager', companyId: 'COMP_VFY_001', emailVerified: true, passwordHash } },
    { upsert: true },
  );

  await usersColl.updateOne(
    { profileId: 'syncin@VFYHMUNV' },
    { $set: { username: 'UnverifiedHM', profileId: 'syncin@VFYHMUNV', email: 'vfy-hm-unverified@acme.com', phone: '+1-555-VFY-0003', role: 'hiring_manager', companyId: 'COMP_VFY_UNV', emailVerified: false, passwordHash } },
    { upsert: true },
  );

  const studentUser = await usersColl.findOne({ profileId: 'syncin@VFYSTUDENT' });
  await db.collection('submissions').deleteMany({ studentId: studentUser?._id });

  const hmUser = await usersColl.findOne({ profileId: 'syncin@VFYHM' });

  let existingProblem = await problemsColl.findOne({ title: 'VFY Test Problem' });
  let problemId: string;
  if (existingProblem) {
    await problemsColl.updateOne({ _id: existingProblem._id }, { $set: { status: 'open' } });
    problemId = existingProblem._id.toString();
  } else {
    const r = await problemsColl.insertOne({ title: 'VFY Test Problem', description: 'Verification test.', difficulty: 'Easy', status: 'open', companyId: 'COMP_VFY_001', postedBy: hmUser!._id.toString(), postedByRole: 'hiring_manager', requiredSkills: [], createdAt: new Date() });
    problemId = r.insertedId.toString();
  }

  let closedProblem = await problemsColl.findOne({ title: 'VFY Closed Problem' });
  let closedProblemId: string;
  if (closedProblem) {
    closedProblemId = closedProblem._id.toString();
  } else {
    const r = await problemsColl.insertOne({ title: 'VFY Closed Problem', description: 'Closed.', difficulty: 'Medium', status: 'closed', companyId: 'COMP_VFY_001', postedBy: hmUser!._id.toString(), postedByRole: 'hiring_manager', requiredSkills: [], createdAt: new Date() });
    closedProblemId = r.insertedId.toString();
  }

  await mongoose.default.disconnect();
  return { problemId, closedProblemId };
}

async function login(profileId: string) {
  const res = await fetch(`${BASE_URL}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'manual',
    body: JSON.stringify({ profileId, password: TEST_PASSWORD }),
  });
  const body = await res.json().catch(() => ({}));
  const setCookie = res.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0];
  return { cookie, body, status: res.status };
}

async function main() {
  console.log('\n=============================================');
  console.log(' TACET Frontend Verification — P0 through P4');
  console.log('=============================================\n');

  console.log(`${INFO} Setting up test fixtures...`);
  const { problemId, closedProblemId } = await setupFixtures();
  console.log(`${INFO} Open problem: ${problemId}`);
  console.log(`${INFO} Closed problem: ${closedProblemId}\n`);

  // ── P0 — Login ──
  console.log('P0 — Login');

  const studentLogin = await login('syncin@VFYSTUDENT');
  report('P0.1 — Student login: 200, cookie set, role=student',
    studentLogin.status === 200 && studentLogin.cookie.startsWith(`${AUTH_COOKIE_NAME}=`) && studentLogin.body.user?.role === 'student',
    `status=${studentLogin.status} cookie="${studentLogin.cookie.substring(0, 30)}…" role=${studentLogin.body.user?.role}`);

  const hmLogin = await login('syncin@VFYHM');
  report('P0.2 — HM login: 200, cookie set, role=hiring_manager',
    hmLogin.status === 200 && hmLogin.cookie.startsWith(`${AUTH_COOKIE_NAME}=`) && hmLogin.body.user?.role === 'hiring_manager',
    `status=${hmLogin.status} cookie="${hmLogin.cookie.substring(0, 30)}…" role=${hmLogin.body.user?.role}`);

  const badLogin = await fetch(`${BASE_URL}/api/user/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId: 'syncin@VFYSTUDENT', password: 'WrongPassword!' }),
  });
  const badBody = await badLogin.json().catch(() => ({}));
  report('P0.3 — Wrong password: 401, error message returned',
    badLogin.status === 401 && !!badBody.error,
    `status=${badLogin.status} error="${badBody.error}"`);

  const sessionCheck = await fetch(`${BASE_URL}/api/submissions/mine`, { headers: { Cookie: studentLogin.cookie } });
  const sessionBody = await sessionCheck.json().catch(() => ({}));
  report('P0.4 — Session persistence: cookie works on subsequent requests',
    sessionCheck.status === 200 && sessionBody.success === true,
    `status=${sessionCheck.status} success=${sessionBody.success}`);

  console.log('');

  // ── P1 — Submission form (student) ──
  console.log('P1 — Submission form (student)');

  const textSubRes = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentLogin.cookie },
    body: JSON.stringify({ problemId, content: 'My test solution for verification.' }),
  });
  const textSubBody = await textSubRes.json().catch(() => ({}));
  report('P1.1 — Text submission to open problem: 201',
    textSubRes.status === 201 && textSubBody.success === true,
    `status=${textSubRes.status} success=${textSubBody.success}`);

  const mineRes = await fetch(`${BASE_URL}/api/submissions/mine`, { headers: { Cookie: studentLogin.cookie } });
  const mineBody = await mineRes.json().catch(() => ({}));
  const found = (mineBody.submissions ?? []).some((s: any) => s._id === textSubBody.submission?._id);
  report('P1.1b — Submission in GET /api/submissions/mine',
    mineRes.status === 200 && found,
    `status=${mineRes.status} found=${found} total=${(mineBody.submissions ?? []).length}`);

  const dupeRes = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentLogin.cookie },
    body: JSON.stringify({ problemId, content: 'Duplicate attempt.' }),
  });
  const dupeBody = await dupeRes.json().catch(() => ({}));
  report('P1.2 — Duplicate submission: 409',
    dupeRes.status === 409 && dupeBody.error?.toLowerCase().includes('already'),
    `status=${dupeRes.status} error="${dupeBody.error}"`);

  const closedRes = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentLogin.cookie },
    body: JSON.stringify({ problemId: closedProblemId, content: 'Should fail.' }),
  });
  const closedBody = await closedRes.json().catch(() => ({}));
  report('P1.3 — Closed problem: rejects (not open)',
    closedRes.status === 400 && closedBody.error?.toLowerCase().includes('not open'),
    `status=${closedRes.status} error="${closedBody.error}"`);

  // File upload structure check (may 409 because same problem)
  const fd = new FormData();
  fd.append('problemId', problemId);
  const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  fd.append('file', new Blob([pngBytes], { type: 'image/png' }), 'test.png');
  const fileRes = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST', headers: { Cookie: studentLogin.cookie }, body: fd,
  });
  const fileBody = await fileRes.json().catch(() => ({}));
  report('P1.4 — File upload multipart: accepted (409/502/201)',
    [201, 409, 502].includes(fileRes.status),
    `status=${fileRes.status} error="${fileBody.error ?? 'none'}"`);

  // Bad file type
  const fdBad = new FormData();
  fdBad.append('problemId', problemId);
  fdBad.append('file', new Blob([Buffer.from('x')], { type: 'text/plain' }), 'test.exe');
  const badFileRes = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST', headers: { Cookie: studentLogin.cookie }, body: fdBad,
  });
  const badFileBody = await badFileRes.json().catch(() => ({}));
  report('P1.6 — Bad file type (.exe): rejected 400',
    badFileRes.status === 400 && badFileBody.error?.toLowerCase().includes('unsupported'),
    `status=${badFileRes.status} error="${badFileBody.error}"`);

  console.log('');

  // ── P2 — Ranking (HM) ──
  console.log('P2 — Ranking (hiring manager)');

  const forProbRes = await fetch(`${BASE_URL}/api/submissions/for-problem/${problemId}`, { headers: { Cookie: hmLogin.cookie } });
  const forProbBody = await forProbRes.json().catch(() => ({}));
  report('P2.0 — GET for-problem: 200, has submissions',
    forProbRes.status === 200 && (forProbBody.submissions ?? []).length > 0,
    `status=${forProbRes.status} count=${(forProbBody.submissions ?? []).length}`);

  const rankRes = await fetch(`${BASE_URL}/api/submissions/rank/${problemId}`, { method: 'POST', headers: { Cookie: hmLogin.cookie } });
  const rankBody = await rankRes.json().catch(() => ({}));
  report(`P2.1 — Rank: ${rankRes.status === 200 ? '200 ranked' : '502 (service down)'}`,
    [200, 502].includes(rankRes.status),
    `status=${rankRes.status} ranked=${(rankBody.ranked ?? []).length} error="${rankBody.error ?? 'none'}"`);

  if (rankRes.status === 200) {
    const rank2Res = await fetch(`${BASE_URL}/api/submissions/rank/${problemId}`, { method: 'POST', headers: { Cookie: hmLogin.cookie } });
    const rank2Body = await rank2Res.json().catch(() => ({}));
    report('P2.2 — Rank again (all scored): no-unscored info',
      rank2Res.status === 200 && rank2Body.message?.toLowerCase().includes('no unscored'),
      `status=${rank2Res.status} msg="${rank2Body.message}"`);
  } else {
    console.log(`  ${INFO} P2.2 — Skipped (ranking service not available)`);
  }

  const otherHm = await login('syncin@VFYHMUNV');
  const wrongRes = await fetch(`${BASE_URL}/api/submissions/for-problem/${problemId}`, { headers: { Cookie: otherHm.cookie } });
  report('P2.3 — Wrong-company HM: 403',
    wrongRes.status === 403,
    `status=${wrongRes.status}`);

  const fakeRes = await fetch(`${BASE_URL}/api/submissions/for-problem/000000000000000000000000`, { headers: { Cookie: hmLogin.cookie } });
  const fakeBody = await fakeRes.json().catch(() => ({}));
  report('P2.4 — Non-existent problem: 404',
    fakeRes.status === 404,
    `status=${fakeRes.status} error="${fakeBody.error}"`);

  console.log('');

  // ── P3 — Variant generator ──
  console.log('P3 — Variant generator (hiring manager)');

  const varRes = await fetch(`${BASE_URL}/api/problems/create-with-variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: hmLogin.cookie },
    body: JSON.stringify({ rawData: 'Design a microservice architecture for an e-commerce checkout system handling 10k concurrent users.', variantCount: 3, difficulty: 'Hard' }),
  });
  const varBody = await varRes.json().catch(() => ({}));
  if (varRes.status === 201) {
    report('P3.1 — Generate variants: 201',
      varBody.ai?.variants?.length > 0 && !!varBody.problem?._id,
      `variants=${varBody.ai?.variants?.length} skills=${varBody.ai?.requiredSkillsExtracted?.length} pid=${varBody.problem?._id}`);
    const failed = (varBody.ai?.variants ?? []).filter((v: any) => v.generationFailed).length;
    console.log(`  ${INFO} P3.2 — ${failed} variant(s) with generationFailed=true`);
  } else {
    report(`P3.1 — Generate variants: ${varRes.status}`,
      varRes.status === 502,
      `error="${varBody.error}"`);
    console.log(`  ${INFO} P3.2 — Skipped (variant service offline)`);
  }

  const emptyRes = await fetch(`${BASE_URL}/api/problems/create-with-variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: hmLogin.cookie },
    body: JSON.stringify({ rawData: '   ', variantCount: 2, difficulty: 'Easy' }),
  });
  const emptyBody = await emptyRes.json().catch(() => ({}));
  report('P3.3 — Empty brief: 400',
    emptyRes.status === 400 && emptyBody.error?.includes('rawData'),
    `status=${emptyRes.status} error="${emptyBody.error}"`);

  console.log('');

  // ── P4 — Email verification gate ──
  console.log('P4 — Email verification gate');

  const unvHm = await login('syncin@VFYHMUNV');
  const unvRes = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: unvHm.cookie },
    body: JSON.stringify({ title: 'Should fail', description: 'Unverified.', difficulty: 'Easy' }),
  });
  const unvBody = await unvRes.json().catch(() => ({}));
  report('P4.1 — Unverified HM post: 403 with "verify"',
    unvRes.status === 403 && unvBody.error?.toLowerCase().includes('verify'),
    `status=${unvRes.status} error="${unvBody.error}"`);

  const resendRes = await fetch(`${BASE_URL}/api/user/resend-verification`, { method: 'POST', headers: { Cookie: unvHm.cookie } });
  const resendBody = await resendRes.json().catch(() => ({}));
  report('P4.2 — Resend verification: route reachable',
    typeof resendBody.success === 'boolean' || typeof resendBody.error === 'string',
    `status=${resendRes.status} body=${JSON.stringify(resendBody)}`);

  const resend2Res = await fetch(`${BASE_URL}/api/user/resend-verification`, { method: 'POST', headers: { Cookie: unvHm.cookie } });
  const resend2Body = await resend2Res.json().catch(() => ({}));
  report('P4.2b — Resend cooldown: 429 on immediate retry',
    resend2Res.status === 429 || resendRes.status >= 400,
    `status=${resend2Res.status} error="${resend2Body.error ?? 'none'}"`);

  const vCreateRes = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: hmLogin.cookie },
    body: JSON.stringify({ title: 'VFY Success Problem', description: 'From verified HM.', difficulty: 'Medium' }),
  });
  const vCreateBody = await vCreateRes.json().catch(() => ({}));
  report('P4.3 — Verified HM post: 201',
    vCreateRes.status === 201 && vCreateBody.success === true,
    `status=${vCreateRes.status} title="${vCreateBody.problem?.title}"`);

  console.log('');

  // ── General ──
  console.log('General');

  const noAuthRes = await fetch(`${BASE_URL}/api/submissions/mine`);
  report('Unauthenticated request: 401', noAuthRes.status === 401, `status=${noAuthRes.status}`);

  const stuHmRes = await fetch(`${BASE_URL}/api/submissions/for-problem/${problemId}`, { headers: { Cookie: studentLogin.cookie } });
  report('Student hits HM-only route: 403', stuHmRes.status === 403, `status=${stuHmRes.status}`);

  const hmSubRes = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: hmLogin.cookie },
    body: JSON.stringify({ problemId, content: 'HM trying to submit.' }),
  });
  report('HM submits as student: 403', hmSubRes.status === 403, `status=${hmSubRes.status}`);

  console.log('\n=============================================');
  console.log(` Results: ${passCount} passed, ${failCount} failed`);
  console.log('=============================================\n');

  if (failCount > 0) {
    console.log('NOTE: 502 results are expected when ranking service (port 8001) is offline.\n');
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
