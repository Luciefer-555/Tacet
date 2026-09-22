require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const uri = process.env.MONGODB_URI;
async function update() {
  const client = await MongoClient.connect(uri);
  const db = client.db('seeby');
  const res = await db.collection('users').updateOne(
    { profileId: 'syncin@QJT852' },
    { $set: { emailVerified: true } }
  );
  console.log('Modified:', res.modifiedCount, 'Matched:', res.matchedCount);
  await client.close();
}
update();
