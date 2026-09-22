const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const hash = await bcrypt.hash('TestPassword123!', 12);

  const accounts = [
    {
      profileId: 'syncin@TESTSTUDENT1',
      role: 'student',
      username: 'TestStudent1',
      email: 's1@college.edu',
      collegeId: 'testcollege',
      collegeName: 'Test Campus',
    },
    {
      profileId: 'syncin@QJT852',
      role: 'mentor',
      username: 'Dr. Vikram Raman',
      email: 'vikram.mentor1993@iitb.ac.in',
      collegeId: 'testcollege',
      collegeName: 'Test Campus',
    },
    {
      profileId: 'syncin@TESTHIRINGM1',
      role: 'hiring_manager',
      username: 'TestHiringManager',
      email: 'hiring_mgr@college.edu',
      companyId: 'COMP_TEST_001',
      companyName: 'Acme Corp',
    },
    {
      profileId: 'syncin@ADMIN001',
      role: 'admin',
      username: 'TestAdmin',
      email: 'admin@syncin.edu',
    },
  ];

  for (const acc of accounts) {
    await db.collection('users').updateOne(
      { profileId: acc.profileId },
      {
        $set: {
          ...acc,
          passwordHash: hash,
          emailVerified: true,
        },
      },
      { upsert: true }
    );
    console.log(`Ready: [${acc.role}] ProfileId: ${acc.profileId} | Email: ${acc.email}`);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
