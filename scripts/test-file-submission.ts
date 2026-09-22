import * as dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const BASE_URL = 'http://localhost:3000';
const TEST_PASSWORD = 'TestPassword123!';

const RAW_BRIEF = `
We are testing file upload capability. We need a document that explains file uploads.
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

  await users.deleteMany({ profileId: { $in: ['syncin@FILE_HM', 'syncin@FILE_S1', 'syncin@FILE_S2'] } });

  const docs = [
    ['syncin@FILE_HM', { role: 'hiring_manager', companyId: 'COMP_FILE_001', email: 'fhm@acme.com', phone: '+1-555-003-0001' }],
    ['syncin@FILE_S1', { role: 'student', email: 'fs1@uni.edu', phone: '+1-555-003-0002' }],
    ['syncin@FILE_S2', { role: 'student', email: 'fs2@uni.edu', phone: '+1-555-003-0003' }],
  ].map(([profileId, extra]) => ({
    profileId,
    passwordHash: hash,
    firstName: profileId.toString().split('@')[1],
    lastName: 'Test',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...(extra as any),
  }));
  await users.insertMany(docs);
  console.log('Fixtures setup complete.');
}

async function runTest() {
  await setupFixtures();
  
  const hmCookie = await login('syncin@FILE_HM');
  const s1Cookie = await login('syncin@FILE_S1');
  const s2Cookie = await login('syncin@FILE_S2');

  console.log('Creating problem...');
  const createRes = await fetch(`${BASE_URL}/api/problems/create-with-variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: hmCookie },
    body: JSON.stringify({ rawData: RAW_BRIEF, variantCount: 1, difficulty: 'Medium' }),
  });
  if (!createRes.ok) throw new Error(`Problem creation failed: ${await createRes.text()}`);
  const { problem } = await createRes.json();
  const problemId = problem._id;
  console.log(`Problem created: ${problemId}`);

  // Test 1: Multipart file upload
  console.log('\\n--- Test 1: Multipart file upload ---');
  const filePath = path.resolve(__dirname, '../test-ocr-text.png');
  const fileBytes = fs.readFileSync(filePath);
  
  const formData = new FormData();
  formData.append('problemId', problemId);
  formData.append('file', new Blob([fileBytes]), 'test-ocr-text.png');

  const sub1Res = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { cookie: s1Cookie },
    body: formData,
  });

  if (!sub1Res.ok) throw new Error(`File upload submission failed: ${await sub1Res.text()}`);
  const sub1Result = await sub1Res.json();
  console.log('File upload successful:', sub1Result.submission.fileUrl);
  console.log('Extracted content:', sub1Result.submission.extractedContent);

  if (!sub1Result.submission.fileUrl || !sub1Result.submission.extractedContent || sub1Result.submission.fileType !== 'png') {
    throw new Error('File upload submission missing fields');
  }

  // Test 2: Text-only submission
  console.log('\\n--- Test 2: Text-only submission ---');
  const sub2Res = await fetch(`${BASE_URL}/api/submissions/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: s2Cookie },
    body: JSON.stringify({ problemId, content: 'This is a text-only submission.' }),
  });

  if (!sub2Res.ok) throw new Error(`Text submission failed: ${await sub2Res.text()}`);
  const sub2Result = await sub2Res.json();
  console.log('Text submission successful:', sub2Result.submission._id);

  if (sub2Result.submission.fileUrl || sub2Result.submission.extractedContent) {
    throw new Error('Text submission should not have file fields');
  }

  // Cleanup
  console.log('\\nCleaning up...');
  const mongoose = await import('mongoose');
  await mongoose.default.connection.db!.collection('problems').deleteOne({ _id: new mongoose.default.Types.ObjectId(problemId) });
  await mongoose.default.connection.db!.collection('submissions').deleteMany({ problemId: new mongoose.default.Types.ObjectId(problemId) });
  await mongoose.default.connection.db!.collection('users').deleteMany({ profileId: { $in: ['syncin@FILE_HM', 'syncin@FILE_S1', 'syncin@FILE_S2'] } });
  
  if (sub1Result.submission.fileUrl) {
    const localPath = path.join(__dirname, '..', sub1Result.submission.fileUrl);
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  }
  
  console.log('Cleanup complete. Tests passed!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error(err);
  process.exit(1);
});
