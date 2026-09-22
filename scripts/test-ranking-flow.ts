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

  // Student 1
  await usersColl.updateOne(
    { profileId: 'syncin@TESTSTUDENT1' },
    { $set: { username: 'TestStudent1', profileId: 'syncin@TESTSTUDENT1', email: 's1@college.edu', phone: '+1-555-001-0001', role: 'student', passwordHash: passwordHash } },
    { upsert: true }
  );

  // Student 2
  await usersColl.updateOne(
    { profileId: 'syncin@TESTSTUDENT2' },
    { $set: { username: 'TestStudent2', profileId: 'syncin@TESTSTUDENT2', email: 's2@college.edu', phone: '+1-555-001-0002', role: 'student', passwordHash: passwordHash } },
    { upsert: true }
  );

  // Hiring Manager
  await usersColl.updateOne(
    { profileId: 'syncin@TESTHM_RANK' },
    { $set: { username: 'TestHMRank', profileId: 'syncin@TESTHM_RANK', email: 'hmrank@acme.com', phone: '+1-555-001-0003', role: 'hiring_manager', companyId: 'COMP_RANKTEST_001', passwordHash: passwordHash } },
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
  if (!loginRes.ok) throw new Error(`Login failed for ${profileId}`);
  return loginRes.headers.get('set-cookie')?.split(';')[0];
}

async function main() {
  console.log('=== Ranking Flow Test ===\n');

  console.log('1. Setting up users...');
  await setupFixtures();
  
  const hmCookie = await login('syncin@TESTHM_RANK');
  const s1Cookie = await login('syncin@TESTSTUDENT1');
  const s2Cookie = await login('syncin@TESTSTUDENT2');
  
  console.log('2. Creating problem via HM...');
  const probRes = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: hmCookie as string },
    body: JSON.stringify({
      title: 'Python API Development Task',
      description: 'Build a scalable REST API in Python to process and serve user data. The API should be robust, well-documented, and production-ready.',
      difficulty: 'Medium',
      requiredSkills: [
        { name: 'Python', weight: 5 },
        { name: 'REST APIs', weight: 4 },
        { name: 'System Design', weight: 3 }
      ]
    }),
  });
  const probData = await probRes.json();
  const problemId = probData.problem._id;
  console.log(`✓ Problem created: ${problemId}\n`);

  console.log('3. Submitting as Student 1 (Good Technical, Practical)...');
  await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: s1Cookie as string },
    body: JSON.stringify({ 
      problemId, 
      content: 'I built the API using FastAPI with Uvicorn. I included Pydantic for validation, SQLAlchemy for the DB layer, and proper pytest coverage. The endpoints use async def for high concurrency. I also added rate limiting via Redis and detailed OpenAPI documentation so frontend devs can easily integrate it.'
    }),
  });
  console.log('✓ Student 1 submitted.\n');

  console.log('4. Submitting as Student 2 (Basic, less practical)...');
  await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: s2Cookie as string },
    body: JSON.stringify({ 
      problemId, 
      content: 'Here is my python code using the built-in http.server module to serve JSON. I parse the URL manually with split() and it works on my machine. No external dependencies needed which makes it very lightweight. I did not write tests but it is a small file.'
    }),
  });
  console.log('✓ Student 2 submitted.\n');

  console.log('5. HM triggering POST /api/submissions/rank/[problemId] (This will call AutoGen)...');
  const rankRes = await fetch(`${BASE_URL}/api/submissions/rank/${problemId}`, {
    method: 'POST',
    headers: { Cookie: hmCookie as string },
  });
  console.log(`   Status: ${rankRes.status}`);
  const rankData = await rankRes.json();
  
  if (rankRes.status === 200) {
    console.log('\n--- RANKING RESULTS ---');
    rankData.ranked.forEach((r: any) => {
      console.log(`Rank: ${r.rank} | Score: ${r.aiScore}`);
      console.log(`Rationale: ${r.aiRationale}`);
      console.log(`Flags: ${r.flags?.join(', ')}`);
      console.log(`Submission content snippet: ${r.content.substring(0, 50)}...\n`);
    });
  } else {
    console.log('Error from ranking service:', rankData);
  }

  console.log('6. Cleaning up...');
  const mongoose = await import('mongoose');
  await mongoose.default.connect(process.env.MONGODB_URI as string);
  await mongoose.default.connection.db!.collection('submissions').deleteMany({ problemId: new mongoose.default.Types.ObjectId(problemId) });
  await mongoose.default.connection.db!.collection('problems').deleteOne({ _id: new mongoose.default.Types.ObjectId(problemId) });
  
  const neo4jSession = (await import('../lib/neo4j')).getNeo4jSession();
  try {
    await neo4jSession.run('MATCH (s:Submission)-[:FOR]->(p:Problem {id: $problemId}) DETACH DELETE s', { problemId });
  } catch(e) { } finally { await neo4jSession.close(); }
  await mongoose.default.disconnect();
  console.log('✓ Cleaned up test data.\n');
}

main().catch(err => {
  console.error('Error running test script:', err);
  process.exit(1);
});
