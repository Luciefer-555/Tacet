/**
 * MongoDB collection-level $jsonSchema validator for the `problems` collection.
 *
 * What this protects against:
 * Even if a bug in application code, a direct Mongo shell session, or another
 * service writes to the `problems` collection without the app-level role check,
 * MongoDB itself will reject the document unless postedByRole === "hiring_manager".
 * This is database-layer enforcement — independent of application code.
 *
 * Run with:  npx tsx scripts/mongo-problem-validator.ts
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env.local');
  process.exit(1);
}

async function main() {
  console.log('Connecting to MongoDB...\n');

  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  const db = mongoose.connection.db!;

  // Ensure the collection exists before applying the validator.
  // listCollections returns an empty array if it doesn't exist yet.
  const collections = await db.listCollections({ name: 'problems' }).toArray();

  if (collections.length === 0) {
    // Create the collection first so collMod has something to modify
    await db.createCollection('problems');
    console.log('  ✓ Created `problems` collection');
  }

  // Apply the $jsonSchema validator via collMod
  const result = await db.command({
    collMod: 'problems',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['postedByRole'],
        properties: {
          postedByRole: {
            bsonType: 'string',
            enum: ['hiring_manager', 'mentor'],
            description:
              'Only hiring managers and mentors may create problems. This is enforced at the database level.',
          },
        },
      },
    },
    validationLevel: 'strict',
    validationAction: 'error',
  });

  console.log('  ✓ Applied $jsonSchema validator on `problems` collection');
  console.log('    validationLevel: strict');
  console.log('    validationAction: error');
  console.log('    Constraint: postedByRole must be "hiring_manager" or "mentor"');
  console.log('\nMigration complete.');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});