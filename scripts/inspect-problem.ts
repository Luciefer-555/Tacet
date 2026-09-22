import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  const doc = await mongoose.connection.db!.collection('problems').findOne({ _id: new mongoose.Types.ObjectId('6aa37b74a1d4fb86d5b659bb') });
  console.log(JSON.stringify(doc?.variants, null, 2));
  await mongoose.disconnect();
}
check().catch(console.error);
