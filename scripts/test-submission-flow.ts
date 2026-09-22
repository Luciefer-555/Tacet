import * as dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const BASE_URL = 'http://localhost:3000';
const TEST_PASSWORD = 'TestPassword123!';

async function setupFixtures() {
  const mongoose = await import('mongoose');
  await mongoose.default.connect(process.env.MONGODB_URI as string);
  const usersColl = mongoose.default.connection.db!.collection('users');

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  await usersColl.updateOne(
    { profileId: 'syncin@TESTSTUDENT' },
    {
      $set: {
        username: 'TestStudent',
        profileId: 'syncin@TESTSTUDENT',
        email: 'student@college.edu',
        phone: '+1-555-000-0003',
        role: 'student',
        passwordHash: passwordHash,
      },
    },
    { upsert: true }
  );

  await usersColl.updateOne(
    { profileId: 'syncin@TESTHM1' },
    {
      $set: {
        username: 'TestHM1',
        profileId: 'syncin@TESTHM1',
        email: 'hm1@acme.com',
        phone: '+1-555-000-0001',
        role: 'hiring_manager',
        companyId: 'COMP_ACME_001',
        passwordHash: passwordHash,
      },
    },
    { upsert: true }
  );

  await usersColl.updateOne(
    { profileId: 'syncin@TESTHM2' },
    {
      $set: {
        username: 'TestHM2',
        profileId: 'syncin@TESTHM2',
        email: 'hm2@other.com',
        phone: '+1-555-000-0002',
        role: 'hiring_manager',
        companyId: 'COMP_OTHER_002',
        passwordHash: passwordHash,
      },
    },
    { upsert: true }
  );

  await mongoose.default.disconnect();
}

async function login(profileId: string) {
  const loginRes = await fetch(`${BASE_URL}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileId, password: TEST_PASSWORD }),
  });
  
  if (!loginRes.ok) {
    throw new Error(`Login failed for ${profileId}`);
  }
  
  const setCookieHeader = loginRes.headers.get('set-cookie');
  if (!setCookieHeader) {
    throw new Error(`No cookie returned for ${profileId}`);
  }
  return setCookieHeader.split(';')[0];
}

async function main() {
  console.log('=== Submission Flow Test ===\n');

  console.log('1. Setting up users...');
  await setupFixtures();
  
  const hm1Cookie = await login('syncin@TESTHM1');
  
  console.log('2. Creating problem via HM1...');
  const probRes = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: hm1Cookie },
    body: JSON.stringify({
      title: 'Test Submission Flow Problem',
      description: 'Test problem description',
      difficulty: 'Easy',
    }),
  });
  const probData = await probRes.json();
  if (!probRes.ok || !probData.problem) {
      console.error('Failed to create problem', probData);
      process.exit(1);
  }
  const problemId = probData.problem._id;
  console.log(`✓ Problem created: ${problemId}\n`);

  console.log('3. Logging in as student...');
  const studentCookie = await login('syncin@TESTSTUDENT');
  console.log('✓ Logged in.\n');

  console.log('4. POST /api/submissions/create (valid content)...');
  const createRes1 = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentCookie },
    body: JSON.stringify({ problemId, content: 'print("Hello World")' }),
  });
  console.log(`   Status: ${createRes1.status}`);
  console.log(`   Body:`, await createRes1.json());
  console.log(createRes1.status === 201 ? '✓ Correctly succeeded.\n' : '✗ FAILED — expected 201.\n');

  console.log('5. POST /api/submissions/create (duplicate)...');
  const createRes2 = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: studentCookie },
    body: JSON.stringify({ problemId, content: 'print("Hello World Again")' }),
  });
  console.log(`   Status: ${createRes2.status}`);
  console.log(`   Body:`, await createRes2.json());
  console.log(createRes2.status === 409 ? '✓ Correctly rejected duplicate.\n' : '✗ FAILED — expected 409.\n');

  console.log('6. GET /api/submissions/for-problem/[id] (as HM1)...');
  const hm1Res = await fetch(`${BASE_URL}/api/submissions/for-problem/${problemId}`, {
    method: 'GET',
    headers: { Cookie: hm1Cookie },
  });
  console.log(`   Status: ${hm1Res.status}`);
  console.log(`   Body:`, await hm1Res.json());
  console.log(hm1Res.status === 200 ? '✓ Correctly succeeded.\n' : '✗ FAILED — expected 200.\n');

  console.log('7. Logging in as HM2 (non-owner) and GET /api/submissions/for-problem/[id]...');
  const hm2Cookie = await login('syncin@TESTHM2');
  const hm2Res = await fetch(`${BASE_URL}/api/submissions/for-problem/${problemId}`, {
    method: 'GET',
    headers: { Cookie: hm2Cookie },
  });
  console.log(`   Status: ${hm2Res.status}`);
  console.log(`   Body:`, await hm2Res.json());
  console.log(hm2Res.status === 403 ? '✓ Correctly rejected non-owner.\n' : '✗ FAILED — expected 403.\n');

  console.log('8. Student GET /api/submissions/mine...');
  const mineRes = await fetch(`${BASE_URL}/api/submissions/mine`, {
    method: 'GET',
    headers: { Cookie: studentCookie },
  });
  console.log(`   Status: ${mineRes.status}`);
  console.log(`   Body:`, await mineRes.json());
  console.log(mineRes.status === 200 ? '✓ Correctly succeeded.\n' : '✗ FAILED — expected 200.\n');

  console.log('9. Cleaning up...');
  const mongoose = await import('mongoose');
  await mongoose.default.connect(process.env.MONGODB_URI as string);
  await mongoose.default.connection.db!.collection('submissions').deleteMany({ problemId: new mongoose.default.Types.ObjectId(problemId) });
  await mongoose.default.connection.db!.collection('problems').deleteOne({ _id: new mongoose.default.Types.ObjectId(problemId) });
  // Also clean up Neo4j for the submission
  const neo4jSession = (await import('../lib/neo4j')).getNeo4jSession();
  try {
    await neo4jSession.run('MATCH (s:Submission)-[:FOR]->(p:Problem {id: $problemId}) DETACH DELETE s', { problemId });
  } catch(e) {
    console.error('Neo4j cleanup error', e);
  } finally {
    await neo4jSession.close();
  }
  await mongoose.default.disconnect();
  console.log('✓ Cleaned up test data.\n');
}

main().catch(err => {
  console.error('Error running test script:', err);
  process.exit(1);
});
