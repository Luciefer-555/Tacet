/**
 * Neo4j schema migration script.
 * Applies uniqueness constraints for all graph node types.
 *
 * Run with:  npx tsx scripts/neo4j-migrate.ts
 */
import neo4j from 'neo4j-driver';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local from the project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const NEO4J_URI = process.env.NEO4J_URI as string;
const NEO4J_USER = process.env.NEO4J_USER as string;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD as string;
const NEO4J_DATABASE = process.env.NEO4J_DATABASE ?? 'neo4j';

if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
  console.error('Missing NEO4J_URI, NEO4J_USER, or NEO4J_PASSWORD in .env.local');
  process.exit(1);
}

const CONSTRAINTS = [
  { name: 'student_id',    cypher: 'CREATE CONSTRAINT student_id IF NOT EXISTS FOR (s:Student) REQUIRE s.id IS UNIQUE' },
  { name: 'company_id',    cypher: 'CREATE CONSTRAINT company_id IF NOT EXISTS FOR (c:Company) REQUIRE c.id IS UNIQUE' },
  { name: 'problem_id',    cypher: 'CREATE CONSTRAINT problem_id IF NOT EXISTS FOR (p:Problem) REQUIRE p.id IS UNIQUE' },
  { name: 'submission_id', cypher: 'CREATE CONSTRAINT submission_id IF NOT EXISTS FOR (sub:Submission) REQUIRE sub.id IS UNIQUE' },
  { name: 'skill_name',    cypher: 'CREATE CONSTRAINT skill_name IF NOT EXISTS FOR (sk:Skill) REQUIRE sk.name IS UNIQUE' },
  { name: 'college_id',    cypher: 'CREATE CONSTRAINT college_id IF NOT EXISTS FOR (col:College) REQUIRE col.id IS UNIQUE' },
];

async function main() {
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session({ database: NEO4J_DATABASE });

  try {
    console.log(`Connecting to Neo4j at ${NEO4J_URI} (database: ${NEO4J_DATABASE})...\n`);

    for (const constraint of CONSTRAINTS) {
      try {
        await session.run(constraint.cypher);
        console.log(`  ✓ ${constraint.name}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ ${constraint.name}: ${message}`);
      }
    }

    console.log('\nMigration complete.');
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});