import * as dotenv from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const BASE_URL = 'http://localhost:3000';
const TEST_PASSWORD = 'TestPassword123!';

const BRIEFS = [
  {
    domain: 'Data Science',
    difficulty: 'Hard',
    rawData: `We have 2 years of customer support ticket data (50,000 tickets) with resolution time, category, agent assigned, and customer satisfaction score. We want to predict which tickets are likely to get escalated before they happen, so we can proactively assign senior agents. Need someone who can build a classification model and explain the top features driving escalation risk to our support ops team, who aren't technical.`,
  },
  {
    domain: 'Sales',
    difficulty: 'Medium',
    rawData: `Our SDR team sends about 3,000 cold outreach emails a month with an 8% reply rate. We have the email templates, subject lines, and reply/no-reply outcomes for the last 6 months. We want a new outreach sequence (email 1 through 4) targeting mid-market SaaS companies, with reasoning for why each email should perform better than our current baseline.`,
  },
  {
    domain: 'Marketing/Content',
    difficulty: 'Medium',
    rawData: `We're launching a new B2B product and need a content calendar for the first 6 weeks post-launch across LinkedIn, a company blog, and email newsletter. We have our brand voice guide and 3 existing successful blog posts as reference. Deliverable should include specific post topics, formats, and a rationale for the channel/timing choices.`,
  },
  {
    domain: 'Finance/Ops',
    difficulty: 'Hard',
    rawData: `We're deciding whether to build or buy a new inventory forecasting tool. We have 18 months of SKU-level demand data across 3 warehouses, current forecasting accuracy (MAPE 22%), and rough build-vs-buy cost estimates. Need a recommendation with a financial model showing the breakeven point and key assumptions.`,
  },
];

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

  await users.updateOne(
    { profileId: 'syncin@SHELLFISH_HM' },
    {
      $set: {
        username: 'ShellfishHM',
        profileId: 'syncin@SHELLFISH_HM',
        passwordHash: hash,
        role: 'hiring_manager',
        companyId: 'COMP_MULTI_001',
        email: 'multi_hm@company.com',
        phone: '+1-555-003-0001',
      },
    },
    { upsert: true }
  );

  await mongoose.default.disconnect();
}

async function main() {
  console.log('=== Shellfish Multi-Domain Adaptability Test ===\n');

  console.log('1. Setting up hiring manager fixture...');
  await setupFixtures();
  const hmCookie = await login('syncin@SHELLFISH_HM');
  console.log('✓ Hiring Manager logged in.\n');

  for (let idx = 0; idx < BRIEFS.length; idx++) {
    const item = BRIEFS[idx];
    console.log(`=======================================================`);
    console.log(`BRIEF ${idx + 1} — ${item.domain}`);
    console.log(`=======================================================`);
    console.log(`Raw Brief: "${item.rawData.substring(0, 100)}..."\n`);

    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/problems/create-with-variants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: hmCookie,
      },
      body: JSON.stringify({
        rawData: item.rawData,
        variantCount: 3,
        difficulty: item.difficulty,
        companyName: `Test Org ${idx + 1}`,
      }),
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    if (!res.ok) {
      const err = await res.text();
      console.error(`FAILED (${elapsed}s):`, err);
      continue;
    }

    const data = await res.json();
    const p = data.problem;
    const ai = data.ai;

    console.log(`Status: 201 Created in ${elapsed}s`);
    console.log(`Problem ID: ${p._id}`);
    console.log(`\n--- CANONICAL EXTRACTION ---`);
    console.log(`Core Challenge:\n${ai.coreChallenge}`);
    console.log(`\nRubric:\n${ai.rubric}`);
    console.log(`\nDataset Summary:\n${ai.datasetSummary}`);
    console.log(`\nRequired Skills Extracted:`);
    console.log(JSON.stringify(ai.requiredSkillsExtracted, null, 2));

    console.log(`\n--- GENERATED VARIANTS (3) ---`);
    p.variants.forEach((v: any) => {
      console.log(`\n[${v.variantId}] ${v.title}`);
      console.log(`Description:\n${v.description}`);
    });

    console.log(`\n`);
  }

  console.log('=== MULTI-DOMAIN TEST COMPLETE (All test problems left in DB) ===');
}

main().catch((err) => {
  console.error('\nMulti-domain test encountered error:', err);
  process.exit(1);
});
