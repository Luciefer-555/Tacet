require('dotenv').config({ path: '.env.local' });
/**
 * E2E test: Coding problems — Piston execution, correctness gate, Seashell ranking
 *
 * Flow:
 * 1. Create test HM + 2 student accounts via /api/auth/register, verify HM email directly in DB
 * 2. HM creates a coding problem (Python, 3 test cases: 2 visible, 1 hidden)
 * 3. Student A (correct code) → submit → verify gate passed, real Piston outputs logged
 * 4. Student B (broken code) → submit → verify gate failed, status=failed_gate
 * 5. HM ranks → verify only Student A reaches Seashell, gets aiScore
 * 6. Fetch Student B doc from for-problem endpoint → CONFIRM aiScore is null
 */

const { MongoClient, ObjectId } = require('mongodb');
const MONGO_URI = process.env.MONGODB_URI;
const BASE = 'http://localhost:3000';
const TS = Date.now();

const HM_EMAIL = `coding_hm_${TS}@acme.com`;
const SA_EMAIL = `coding_sa_${TS}@test.edu`;
const SB_EMAIL = `coding_sb_${TS}@test.edu`;
const TEST_PASSWORD = process.env.TEST_ACCOUNT_PASSWORD_2;
const COMPANY_ID = 'COMP_CODING_TEST';

async function req(method, path, body, cookies) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  if (cookies) opts.headers['Cookie'] = cookies;
  const res = await fetch(`${BASE}${path}`, opts);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') };
}

function extractCookie(setCookie) {
  return setCookie ? setCookie.split(';')[0] : '';
}

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.error(`  ❌ FAIL: ${msg}`); process.exit(1); }
function section(msg) { console.log(`\n── ${msg} ──`); }

async function login(profileId, password, email) {
  const r = await req('POST', '/api/user/login', { profileId, password, email });
  if (r.status !== 200 || !r.json.success) fail(`Login failed for ${profileId} (${email}): ${JSON.stringify(r.json)}`);
  return extractCookie(r.setCookie);
}

async function run() {
  const mongo = await MongoClient.connect(MONGO_URI);
  const db = mongo.db('seeby');

  try {
    // ── 0. Cleanup old test data ──────────────────────────────────────────
    section('0. Cleanup + create test accounts');
    await db.collection('users').deleteMany({ email: { $in: [HM_EMAIL, SA_EMAIL, SB_EMAIL] } });

    // Register HM
    const hmReg = await req('POST', '/api/user/register', {
      email: HM_EMAIL, password: PASSWORD, phone: `+1${String(TS).slice(-9)}1`,
      username: `coding_hm_${TS}`, role: 'hiring_manager', companyId: COMPANY_ID, companyName: 'Coding Corp'
    });
    if (!hmReg.json.success) fail(`HM register failed: ${JSON.stringify(hmReg.json)}`);
    const hmProfileId = hmReg.json.user.profileId;

    // Register Student A
    const saReg = await req('POST', '/api/user/register', {
      email: SA_EMAIL, password: PASSWORD, phone: `+1${String(TS).slice(-9)}2`,
      username: `coding_sa_${TS}`, role: 'student', collegeName: 'Test U'
    });
    if (!saReg.json.success) fail(`Student A register failed: ${JSON.stringify(saReg.json)}`);
    const saProfileId = saReg.json.user.profileId;

    // Register Student B
    const sbReg = await req('POST', '/api/user/register', {
      email: SB_EMAIL, password: PASSWORD, phone: `+1${String(TS).slice(-9)}3`,
      username: `coding_sb_${TS}`, role: 'student', collegeName: 'Test U'
    });
    if (!sbReg.json.success) fail(`Student B register failed: ${JSON.stringify(sbReg.json)}`);
    const sbProfileId = sbReg.json.user.profileId;

    // Verify HM email in DB (lib/email.ts is a stub, no real link sent)
    await db.collection('users').updateOne({ email: HM_EMAIL }, { $set: { emailVerified: true } });
    pass(`Accounts created: HM=${HM_EMAIL} (${hmProfileId}), SA=${SA_EMAIL} (${saProfileId}), SB=${SB_EMAIL} (${sbProfileId})`);

    // ── 1. Healthcheck ────────────────────────────────────────────────────
    section('1. Healthcheck');
    const hc = await req('GET', '/api/healthcheck');
    console.log('  MongoDB:', hc.json.mongodb, '| Neo4j:', hc.json.neo4j);
    if (hc.json.mongodb !== 'connected') fail('MongoDB not connected');
    pass('MongoDB connected');

    // ── 2. HM login + create coding problem ───────────────────────────────
    section('2. HM creates coding problem (Python, 3 test cases)');
    const hmCookie = await login(hmProfileId, PASSWORD, HM_EMAIL);

    const problemPayload = {
      title: `Sum of List [coding-test-${TS}]`,
      description: 'Read N on first line, then N space-separated ints. Print their sum.',
      difficulty: 'Easy',
      problemFormat: 'coding',
      language: 'python',
      testCases: [
        { input: '3\n1 2 3', expectedOutput: '6', hidden: false },
        { input: '4\n10 20 30 40', expectedOutput: '100', hidden: false },
        { input: '5\n1 1 1 1 1', expectedOutput: '5', hidden: true },  // hidden
      ],
    };

    const createR = await req('POST', '/api/problems/create', problemPayload, hmCookie);
    if (!createR.json.success) fail(`Problem create: ${createR.json.error}`);
    const problemId = createR.json.problem._id;

    console.log('  Problem ID:', problemId);
    console.log('  problemFormat:', createR.json.problem.problemFormat);
    console.log('  language:', createR.json.problem.language);
    console.log('  testCases stored:', createR.json.problem.testCases?.length);

    if (createR.json.problem.problemFormat !== 'coding') fail('problemFormat not saved as coding');
    if (createR.json.problem.testCases?.length !== 3) fail('Expected 3 test cases');
    const hiddenCount = createR.json.problem.testCases.filter(tc => tc.hidden).length;
    if (hiddenCount !== 1) fail(`Expected 1 hidden test case, got ${hiddenCount}`);
    pass('Problem created: 3 test cases (2 visible, 1 hidden), format=coding, language=python');

    // ── 3. Student A — correct code ───────────────────────────────────────
    section('3. Student A — correct Python code (all 3 cases should pass)');
    const saCookie = await login(saProfileId, PASSWORD, SA_EMAIL);

    const correctCode = `n = int(input())
nums = list(map(int, input().split()))
print(sum(nums))`;

    const subAR = await req('POST', '/api/submissions/create', {
      problemId, code: correctCode, language: 'python',
    }, saCookie);

    console.log('  Response status:', subAR.status);
    console.log('  success:', subAR.json.success);
    console.log('  correctnessGatePassed:', subAR.json.correctnessGatePassed);
    console.log('  correctnessScore:', subAR.json.correctnessScore);
    console.log('  passedCases:', subAR.json.passedCases, '/', subAR.json.totalCases);
    console.log('  submission.status:', subAR.json.submission?.status);
    console.log('\n  Student-facing testResults (hidden input stripped):');
    const saResults = subAR.json.submission?.testResults ?? [];
    saResults.forEach((r, i) => {
      if (r.hidden) {
        console.log(`    [Case ${i+1}] HIDDEN — passed: ${r.passed}`);
        if (r.input) fail('Hidden test case input leaked to student!');
      } else {
        console.log(`    [Case ${i+1}] input="${r.input}", expected="${r.expectedOutput}", got="${r.actualOutput}", passed=${r.passed}`);
      }
    });

    if (!subAR.json.success) fail(`Student A submission: ${subAR.json.error}`);
    if (!subAR.json.correctnessGatePassed) fail('Student A should pass the gate (all 3 correct)');
    if (subAR.json.passedCases !== 3) fail(`Expected 3/3, got ${subAR.json.passedCases}/3`);
    if (subAR.json.submission?.status !== 'submitted') fail(`Expected submitted, got ${subAR.json.submission?.status}`);
    if (subAR.json.submission?.aiScore !== null && subAR.json.submission?.aiScore !== undefined) {
      fail(`aiScore should be null before ranking, got ${subAR.json.submission?.aiScore}`);
    }
    pass('Student A: 3/3 passed, status=submitted, hidden input stripped, aiScore=null pre-ranking');
    const subAId = subAR.json.submission?._id;

    // ── 4. Student B — broken code ────────────────────────────────────────
    section('4. Student B — broken code (always prints 0)');
    const sbCookie = await login(sbProfileId, PASSWORD, SB_EMAIL);

    const brokenCode = `# Always prints wrong answer
print(0)`;

    const subBR = await req('POST', '/api/submissions/create', {
      problemId, code: brokenCode, language: 'python',
    }, sbCookie);

    console.log('  Response status:', subBR.status);
    console.log('  correctnessGatePassed:', subBR.json.correctnessGatePassed);
    console.log('  correctnessScore:', subBR.json.correctnessScore);
    console.log('  passedCases:', subBR.json.passedCases, '/', subBR.json.totalCases);
    console.log('  submission.status:', subBR.json.submission?.status);
    console.log('\n  Real Piston outputs for visible cases:');
    const sbResults = subBR.json.submission?.testResults ?? [];
    sbResults.filter(r => !r.hidden).forEach((r, i) => {
      console.log(`    [Case ${i+1}] input="${r.input}", expected="${r.expectedOutput}", piston_got="${r.actualOutput}", passed=${r.passed}`);
    });

    if (!subBR.json.success) fail(`Student B submission: ${subBR.json.error}`);
    if (subBR.json.correctnessGatePassed !== false) fail('Student B should FAIL the gate');
    if (subBR.json.submission?.status !== 'failed_gate') fail(`Expected failed_gate, got ${subBR.json.submission?.status}`);
    if (subBR.json.submission?.aiScore !== null && subBR.json.submission?.aiScore !== undefined) {
      fail(`CRITICAL: aiScore populated on failed-gate submission! Got: ${subBR.json.submission?.aiScore}`);
    }
    pass('Student B: 0/3 passed, status=failed_gate, aiScore=null, real Piston outputs logged above');
    const subBId = subBR.json.submission?._id;

    // ── 5. Rank submissions ───────────────────────────────────────────────
    section('5. HM ranks — only Student A should reach Seashell');
    const rankR = await req('POST', `/api/submissions/rank/${problemId}`, null, hmCookie);

    console.log('  Rank response ranked count:', rankR.json.ranked?.length);
    if (rankR.json.ranked) {
      rankR.json.ranked.forEach(r => {
        console.log(`  Ranked: _id=${r._id}, aiScore=${r.aiScore}, status=${r.status}`);
      });
    }

    if (!rankR.json.success) fail(`Ranking failed: ${rankR.json.error}`);
    if (rankR.json.ranked?.length !== 1) fail(`Expected exactly 1 ranked, got ${rankR.json.ranked?.length}`);
    const rankedSub = rankR.json.ranked[0];
    if (rankedSub._id !== subAId) fail(`Wrong submission ranked! Got ${rankedSub._id}, expected ${subAId}`);
    if (rankedSub.aiScore == null) fail('Ranked submission should have aiScore from Seashell');
    pass(`Student A ranked with aiScore=${rankedSub.aiScore}. Student B correctly excluded.`);

    // ── 6. Confirm Student B doc: aiScore still null ──────────────────────
    section('6. CRITICAL CHECK — Student B document still has aiScore=null');
    const forProbR = await req('GET', `/api/submissions/for-problem/${problemId}`, null, hmCookie);
    if (!forProbR.json.success) fail('for-problem fetch failed');

    const subBDoc = forProbR.json.submissions?.find(s => s._id === subBId);
    if (!subBDoc) fail('Student B submission not found in for-problem response');

    console.log('\n  Student B document (authoritative DB values):');
    console.log('    _id:', subBDoc._id);
    console.log('    status:', subBDoc.status);
    console.log('    aiScore:', subBDoc.aiScore);
    console.log('    aiRationale:', subBDoc.aiRationale);
    console.log('    correctnessGatePassed:', subBDoc.correctnessGatePassed);
    console.log('    correctnessScore:', subBDoc.correctnessScore);
    console.log('    testResults count:', subBDoc.testResults?.length);
    console.log('    language:', subBDoc.language);

    if (subBDoc.status !== 'failed_gate') fail(`Expected failed_gate, got ${subBDoc.status}`);
    if (subBDoc.aiScore !== null && subBDoc.aiScore !== undefined) {
      fail(`CRITICAL FAILURE: Student B has aiScore=${subBDoc.aiScore}. It reached Seashell!`);
    }
    if (subBDoc.aiRationale !== null && subBDoc.aiRationale !== undefined) {
      fail(`CRITICAL: Student B has aiRationale. It reached Seashell!`);
    }

    // Also confirm from MongoDB directly (belt and suspenders)
    const subBMongo = await db.collection('submissions').findOne({ _id: new ObjectId(subBId) });
    console.log('\n  Student B direct from MongoDB:');
    console.log('    status:', subBMongo.status);
    console.log('    aiScore:', subBMongo.aiScore);
    console.log('    correctnessGatePassed:', subBMongo.correctnessGatePassed);
    if (subBMongo.aiScore !== null && subBMongo.aiScore !== undefined) {
      fail(`MongoDB shows aiScore=${subBMongo.aiScore} on failed-gate submission!`);
    }

    pass('CONFIRMED via API + MongoDB: Student B aiScore=null, status=failed_gate, never reached Seashell');

    // ── Summary ───────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('ALL CHECKS PASSED');
    console.log(`  Problem: ${problemId}`);
    console.log(`  Student A (${SA_EMAIL}): ${subAId} | status=scored | aiScore=${rankedSub.aiScore}`);
    console.log(`  Student B (${SB_EMAIL}): ${subBId} | status=failed_gate | aiScore=null`);
    console.log('  Gate is working: Piston real outputs verified, Seashell never called for broken code');
    console.log('══════════════════════════════════════════════════════════\n');

  } finally {
    // Cleanup test accounts
    await db.collection('users').deleteMany({ email: { $in: [HM_EMAIL, SA_EMAIL, SB_EMAIL] } });
    await mongo.close();
  }
}

run().catch(err => {
  console.error('\n❌ UNCAUGHT ERROR:', err.message, err.stack);
  process.exit(1);
});
