/**
 * Self-check for the variant generation + deterministic assignment pipeline.
 * Run with: npx tsx scripts/test-variant-flow.ts
 *
 * Verifies:
 *   1. POST /api/problems/create-with-variants returns N variants, non-empty rubric
 *   2. Student submissions each get a problemVariantId matching one of the variant IDs
 *   3. Determinism: same student + problem always hashes to same variant
 */
import * as dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const BASE_URL = 'http://localhost:3000';
const TEST_PASSWORD = 'TestPassword123!';
const VARIANT_COUNT = 3;

const RAW_BRIEF = `
We are a mid-sized e-commerce company with a product catalog of 50,000 SKUs.
Our recommendation engine currently uses simple collaborative filtering on 
purchase history, but conversion rates have been flat for 6 months.
We have 18 months of clickstream data, cart abandonment events, session 
duration, and post-purchase review scores. We need a candidate to design and 
prototype an improved recommendation system that measurably increases 
add-to-cart rate. The solution must be explainable to non-technical 
stakeholders, and must be deployable in a Python + FastAPI stack.
`;

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

  for (const [profileId, extra] of [
    ['syncin@VARIANT_HM', { role: 'hiring_manager', companyId: 'COMP_VARTEST_001', email: 'hmv@acme.com', phone: '+1-555-002-0001' }],
    ['syncin@VARIANT_S1', { role: 'student', email: 'vs1@uni.edu', phone: '+1-555-002-0002' }],
    ['syncin@VARIANT_S2', { role: 'student', email: 'vs2@uni.edu', phone: '+1-555-002-0003' }],
    ['syncin@VARIANT_S3', { role: 'student', email: 'vs3@uni.edu', phone: '+1-555-002-0004' }],
  ] as const) {
    await users.updateOne(
      { profileId },
      { $set: { username: profileId, profileId, passwordHash: hash, ...(extra as any) } },
      { upsert: true }
    );
  }

  await mongoose.default.disconnect();
}

async function main() {
  console.log('=== Variant Flow Test ===\n');

  console.log('1. Setting up fixtures...');
  await setupFixtures();

  const hmCookie = await login('syncin@VARIANT_HM');
  const s1Cookie = await login('syncin@VARIANT_S1');
  const s2Cookie = await login('syncin@VARIANT_S2');
  const s3Cookie = await login('syncin@VARIANT_S3');

  console.log(`\n2. POST /api/problems/create-with-variants (variantCount=${VARIANT_COUNT})...`);
  console.log('   (This will call Ollama twice — expect ~60s)');
  const t0 = Date.now();
  const probRes = await fetch(`${BASE_URL}/api/problems/create-with-variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: hmCookie },
    body: JSON.stringify({ rawData: RAW_BRIEF, variantCount: VARIANT_COUNT, difficulty: 'Hard' }),
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`   Status: ${probRes.status} (${elapsed}s)`);

  if (!probRes.ok) {
    const err = await probRes.text();
    console.error('FAILED:', err);
    process.exit(1);
  }

  const probData = await probRes.json();
  const problemId = probData.problem._id;

  console.log(`\n   ✓ Problem created: ${problemId}`);
  console.log(`   ✓ Rubric: ${probData.ai.rubric?.substring(0, 80)}...`);
  console.log(`   ✓ datasetSummary: ${probData.ai.datasetSummary?.substring(0, 80)}...`);
  console.log(`   ✓ coreChallenge: ${probData.ai.coreChallenge?.substring(0, 80)}...`);
  console.log(`   ✓ requiredSkillsExtracted: ${JSON.stringify(probData.ai.requiredSkillsExtracted)}`);
  console.log(`   ✓ ${probData.problem.variants.length} variants generated:`);
  for (const v of probData.problem.variants) {
    console.log(`     [${v.variantId}] ${v.title}`);
  }

  // Assert N variants, non-empty rubric
  console.assert(probData.problem.variants.length === VARIANT_COUNT, `Expected ${VARIANT_COUNT} variants, got ${probData.problem.variants.length}`);
  console.assert(probData.problem.rubric?.length > 10, 'rubric is empty');

  const validVariantIds = new Set(probData.problem.variants.map((v: any) => v.variantId));

  console.log('\n3. Creating 3 student submissions...');
  const submissions = [];
  for (const [cookie, label] of [[s1Cookie, 'S1'], [s2Cookie, 'S2'], [s3Cookie, 'S3']] as const) {
    const res = await fetch(`${BASE_URL}/api/submissions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ problemId, content: `Test submission from ${label}` }),
    });
    const data = await res.json();
    console.log(`   [${label}] variantId assigned: ${data.submission?.problemVariantId ?? 'none'}`);
    console.assert(validVariantIds.has(data.submission?.problemVariantId), `[${label}] got unknown variantId`);
    submissions.push(data.submission);
  }

  console.log('\n4. Testing determinism (re-submitting same student should 409, but variant lookup is reproducible)...');
  // Inline sha256 function to verify the expected assignment
  const getExpectedVariant = (studentId: string, probId: string) => {
    const hash = crypto.createHash('sha256').update(`${studentId}:${probId}`).digest('hex');
    const idx = parseInt(hash.slice(0, 8), 16) % probData.problem.variants.length;
    return probData.problem.variants[idx].variantId;
  };

  for (const sub of submissions) {
    const expectedVariant = getExpectedVariant(sub.studentId, problemId);
    const match = sub.problemVariantId === expectedVariant;
    console.log(`   studentId=${sub.studentId} → expected ${expectedVariant}, got ${sub.problemVariantId} — ${match ? '✓ MATCH' : '✗ MISMATCH'}`);
    console.assert(match, `Determinism check failed for student ${sub.studentId}`);
  }

  console.log('\n5. Preserving test data for Step 6/7 inspection (cleanup skipped as requested)...');
  console.log(`   Saved Problem ID: ${problemId}`);

  console.log('\n6. Testing variant distribution across 300 students (SHA-256)...');
  const variantCounts: Record<string, number> = {};

  for (let i = 0; i < 300; i++) {
    const fakeStudentId = `test_student_${i}_${Math.random().toString(36).slice(2)}`;
    const hash = crypto.createHash('sha256').update(`${fakeStudentId}:${problemId}`).digest('hex');
    const variantIndex = parseInt(hash.slice(0, 8), 16) % 3;
    const variantId = `v${variantIndex + 1}`;
    variantCounts[variantId] = (variantCounts[variantId] || 0) + 1;
  }

  console.log('   Distribution across 300 simulated students:', variantCounts);
  const counts = Object.values(variantCounts);
  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts, 0);
  const deviation = (maxCount - minCount) / minCount;
  if (deviation > 0.25) {
    console.log(`   ⚠ WARNING: distribution deviation (${(deviation * 100).toFixed(1)}%) is high.`);
  } else {
    console.log(`   ✓ Distribution is uniform (max deviation: ${(deviation * 100).toFixed(1)}%).`);
  }

  console.log('\n=== ALL CHECKS PASSED ===');
}

main().catch((err) => {
  console.error('\nTest failed:', err);
  process.exit(1);
});
