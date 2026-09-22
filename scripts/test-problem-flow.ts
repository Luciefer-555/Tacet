import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI as string;
const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('--- Starting Problem Creation & Enforcement Test ---\n');

  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  const db = mongoose.connection.db!;
  const usersColl = db.collection('users');
  const problemsColl = db.collection('problems');

  // 1. Setup a student and a hiring manager in Mongo
  const studentProfileId = 'syncin@TESTSTUDENT1';
  const hiringManagerProfileId = 'syncin@TESTHIRINGM1';

  await usersColl.updateOne(
    { profileId: studentProfileId },
    {
      $set: {
        username: 'TestStudent',
        profileId: studentProfileId,
        collegeId: 'COL001',
        collegeName: 'Test Tech Institute',
        email: 'student_test@college.edu',
        phone: '+91-9111111111',
        skills: ['Python', 'SQL'],
        role: 'student',
        joinedAt: new Date(),
      },
    },
    { upsert: true }
  );
  console.log('✓ Student test user prepared: ' + studentProfileId + ' (role: student)');

  await usersColl.updateOne(
    { profileId: hiringManagerProfileId },
    {
      $set: {
        username: 'TestHiringManager',
        profileId: hiringManagerProfileId,
        collegeId: 'COL001',
        collegeName: 'Test Tech Institute',
        email: 'hiring_mgr@college.edu',
        phone: '+91-9222222222',
        skills: ['System Design', 'Management'],
        role: 'hiring_manager',
        joinedAt: new Date(),
      },
    },
    { upsert: true }
  );
  console.log('✓ Hiring Manager test user prepared: ' + hiringManagerProfileId + ' (role: hiring_manager)\n');

  // 2. Test DB-Level $jsonSchema Validator directly on MongoDB
  console.log('--- Test A: Direct MongoDB $jsonSchema Validator Enforcement ---');
  try {
    await problemsColl.insertOne({
      title: 'Direct Malicious Insert',
      description: 'Bypassing API',
      difficulty: 'Easy',
      status: 'open',
      postedBy: new mongoose.Types.ObjectId(),
      postedByRole: 'student', // Invalid! Must be hiring_manager
      createdAt: new Date(),
    });
    console.error('✗ FAILED: MongoDB allowed inserting postedByRole = "student"!');
  } catch (err: any) {
    console.log('✓ SUCCESS: MongoDB rejected non-hiring_manager insert at database level!');
    console.log('  Error message: ' + err.message + '\n');
  }

  // 3. Test App-Level Route with Student profileId (should return 403)
  console.log('--- Test B: API Route rejection for Student (role !== hiring_manager) ---');
  const studentReqBody = {
    profileId: studentProfileId,
    title: 'Student Attempt Problem',
    description: 'Should be rejected',
    difficulty: 'Medium',
    requiredSkills: [{ name: 'Python', weight: 1 }],
  };

  const studentRes = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(studentReqBody),
  });

  const studentResJson = await studentRes.json();
  console.log('  HTTP Status:', studentRes.status);
  console.log('  Response:', JSON.stringify(studentResJson));

  if (studentRes.status === 403) {
    console.log('✓ SUCCESS: Route returned 403 Forbidden for student session.\n');
  } else {
    console.error('✗ FAILED: Expected status 403, got ' + studentRes.status + '\n');
  }

  // 4. Test App-Level Route with Hiring Manager profileId (should return 201)
  console.log('--- Test C: API Route success for Hiring Manager ---');
  const hmReqBody = {
    profileId: hiringManagerProfileId,
    title: 'Distributed Cache Service',
    description: 'Design and implement an in-memory distributed cache with LRU eviction and replication.',
    archetype: 'Backend Engineer',
    difficulty: 'Hard',
    companyId: 'COMP_ACME_001',
    companyName: 'Acme Corp',
    companyIndustry: 'Cloud Infrastructure',
    requiredSkills: [
      { name: 'Go', weight: 2 },
      { name: 'Distributed Systems', weight: 3 },
      { name: 'Redis', weight: 1 },
    ],
  };

  const hmRes = await fetch(`${BASE_URL}/api/problems/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(hmReqBody),
  });

  const hmResJson = await hmRes.json();
  console.log('  HTTP Status:', hmRes.status);
  console.log('  Response:', JSON.stringify(hmResJson, null, 2));

  if (hmRes.status === 201 && hmResJson.success) {
    console.log('✓ SUCCESS: Problem created via hiring_manager session.');
    console.log('  Created Problem ID:', hmResJson.problem._id);

    // Verify it exists in MongoDB
    const mongoDoc = await problemsColl.findOne({ _id: new mongoose.Types.ObjectId(hmResJson.problem._id) });
    if (mongoDoc) {
      console.log('✓ Verified document exists in MongoDB `problems` collection:');
      console.log('  Title:', mongoDoc.title);
      console.log('  PostedByRole:', mongoDoc.postedByRole);
    }
  } else {
    console.error('✗ FAILED: Problem creation was not successful.\n');
  }

  await mongoose.disconnect();
  console.log('\n--- All Tests Completed ---');
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});