import * as dotenv from 'dotenv';
import path from 'path';

// 1. Ensure .env.local is loaded before lib/neo4j is imported
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

async function run() {
  console.log('=== Neo4j Problem Graph Verification ===\n');

  // Dynamic import to guarantee process.env variables are populated
  const { getNeo4jSession, closeNeo4jDriver } = await import('../lib/neo4j');

  let session;
  try {
    session = getNeo4jSession();
  } catch (err: any) {
    console.error('Failed to initialize Neo4j session:', err.message);
    process.exit(1);
  }

  try {
    // -------------------------------------------------------------
    // Query 1: List all Problem nodes
    // -------------------------------------------------------------
    console.log('Query 1: Listing all :Problem nodes in graph...');
    const q1Result = await session.run(
      'MATCH (p:Problem) RETURN p.id AS id, p.title AS title, p.archetype AS archetype, p.difficulty AS difficulty, p.status AS status'
    );

    if (q1Result.records.length === 0) {
      console.log('  (No :Problem nodes found in graph)\n');
    } else {
      q1Result.records.forEach((record, index) => {
        console.log(`  [${index + 1}] ID: ${record.get('id')}`);
        console.log(`      Title: ${record.get('title')}`);
        console.log(`      Archetype: ${record.get('archetype')}`);
        console.log(`      Difficulty: ${record.get('difficulty')}`);
        console.log(`      Status: ${record.get('status')}`);
      });
      console.log('');
    }

    // -------------------------------------------------------------
    // Query 2: Problem -> REQUIRES_SKILL -> Skill
    // -------------------------------------------------------------
    console.log('Query 2: Checking REQUIRES_SKILL relationships...');
    const q2Result = await session.run(
      'MATCH (p:Problem)-[:REQUIRES_SKILL]->(sk:Skill) RETURN p.title AS title, collect(sk.name) AS skills'
    );

    if (q2Result.records.length === 0) {
      console.log('  (No :REQUIRES_SKILL edges found in graph)\n');
    } else {
      q2Result.records.forEach((record) => {
        console.log(`  Problem: "${record.get('title')}" -> Skills: [${record.get('skills').join(', ')}]`);
      });
      console.log('');
    }

    // -------------------------------------------------------------
    // Query 3: Company -> POSTED -> Problem
    // -------------------------------------------------------------
    console.log('Query 3: Checking Company -[:POSTED]-> Problem relationships...');
    const q3Result = await session.run(
      'MATCH (c:Company)-[:POSTED]->(p:Problem) RETURN c.name AS companyName, p.title AS title'
    );

    if (q3Result.records.length === 0) {
      console.log('  (No :POSTED edges found in graph)\n');
    } else {
      q3Result.records.forEach((record) => {
        console.log(`  Company: "${record.get('companyName')}" -> Problem: "${record.get('title')}"`);
      });
      console.log('');
    }

    // -------------------------------------------------------------
    // Query 4: Detailed verification of "Distributed Cache Service"
    // -------------------------------------------------------------
    console.log('Query 4: Detailed PASS/FAIL Evaluation for "Distributed Cache Service"...');
    const targetTitle = 'Distributed Cache Service';

    const pCheck = await session.run(
      'MATCH (p:Problem {title: $title}) RETURN p',
      { title: targetTitle }
    );
    const problemExists = pCheck.records.length > 0;

    const skillsCheck = await session.run(
      `MATCH (p:Problem {title: $title})-[r:REQUIRES_SKILL]->(sk:Skill)
       RETURN sk.name AS skill, r.weight AS weight`,
      { title: targetTitle }
    );

    const skillsMap = new Map<string, number>();
    skillsCheck.records.forEach((r) => {
      const weight = typeof r.get('weight') === 'object' && r.get('weight')?.toNumber
        ? r.get('weight').toNumber()
        : Number(r.get('weight'));
      skillsMap.set(r.get('skill'), weight);
    });

    const companyCheck = await session.run(
      `MATCH (c:Company)-[:POSTED]->(p:Problem {title: $title})
       RETURN c.name AS companyName`,
      { title: targetTitle }
    );

    const connectedCompanyName = companyCheck.records.length > 0
      ? companyCheck.records[0].get('companyName')
      : null;

    console.log(`  1. Problem node with title "${targetTitle}" exists: ${problemExists ? 'YES' : 'NO'}`);
    console.log(`  2. Attached Skills & Weights:`, Object.fromEntries(skillsMap));
    console.log(`  3. Connected Company: ${connectedCompanyName ?? 'NONE'}\n`);

    const hasExpectedSkills =
      skillsMap.size === 3 &&
      skillsMap.get('Go') === 2 &&
      skillsMap.get('Distributed Systems') === 3 &&
      skillsMap.get('Redis') === 1;

    const hasExpectedCompany = connectedCompanyName === 'Acme Corp';

    console.log('========================================');
    if (problemExists && hasExpectedSkills && hasExpectedCompany) {
      console.log('OVERALL STATUS: PASS');
      console.log('The Problem, Company, and required Skill edges are correctly stored in Neo4j.');
    } else {
      console.log('OVERALL STATUS: FAIL');
      if (!problemExists) {
        console.log('  - Problem node was not found in Neo4j.');
      }
      if (!hasExpectedSkills) {
        console.log('  - Required skills or weights did not match (expected Go:2, Distributed Systems:3, Redis:1).');
      }
      if (!hasExpectedCompany) {
        console.log('  - Company edge not found or company name is not "Acme Corp".');
      }
    }
    console.log('========================================\n');
  } catch (err: any) {
    console.error('ERROR during Neo4j query execution:');
    console.error(err.message);
    console.log('\n========================================');
    console.log('OVERALL STATUS: FAIL (Database connection or query error)');
    console.log('========================================\n');
  } finally {
    if (session) {
      await session.close();
    }
    await closeNeo4jDriver();
  }
}

run().catch((err) => {
  console.error('Fatal error in verification script:', err);
  process.exit(1);
});