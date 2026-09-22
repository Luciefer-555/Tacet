import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Problem from '@/models/problem';
import Company from '@/models/company';
import { syncProblemNode } from '@/lib/graphSync';
import { requireAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

const RANKING_SERVICE_URL = process.env.RANKING_SERVICE_URL ?? 'http://localhost:8001';
const MAX_VARIANTS = 5;

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAuth(['hiring_manager', 'mentor']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  if (!session.emailVerified) {
    return NextResponse.json(
      { success: false, error: 'Please verify your email before posting problems. Check your inbox or request a new verification link.' },
      { status: 403 }
    );
  }

  await connectToDatabase();

  if (session.role === 'hiring_manager') {
    const companyExists = await Company.exists({ companyId: session.companyId });
    if (!companyExists) {
      return NextResponse.json(
        { success: false, error: 'Please complete company onboarding before posting problems.' },
        { status: 403 }
      );
    }
  }

  let body: {
    rawData: string;
    variantCount: number;
    difficulty: string;
    problemFormat?: 'open_ended' | 'coding';
    language?: 'python' | 'java';
    companyName?: string;
    companyIndustry?: string;
    // Optional HM override — if provided, replaces the AI-extracted skills.
    requiredSkillsOverride?: { name: string; weight: number }[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON.' }, { status: 400 });
  }

  if (!body.rawData?.trim()) {
    return NextResponse.json({ success: false, error: 'rawData is required.' }, { status: 400 });
  }
  if (!['Easy', 'Medium', 'Hard'].includes(body.difficulty)) {
    return NextResponse.json({ success: false, error: 'difficulty must be Easy, Medium, or Hard.' }, { status: 400 });
  }

  const variantCount = Math.min(Math.max(1, body.variantCount ?? 3), MAX_VARIANTS);

  // Call the ranking-service variant pipeline
  let aiResult: {
    coreChallenge: string;
    requiredSkills: { name: string; weight: number }[];
    rubric: string;
    datasetSummary: string;
    variants: { variantId: string; title: string; description: string; generationFailed?: boolean }[];
    problemFormat?: 'open_ended' | 'coding';
    language?: string;
    testCases?: { input: string; expectedOutput: string; hidden: boolean }[];
    referenceSolution?: string;
  };

  try {
    const pyRes = await fetch(`${RANKING_SERVICE_URL}/generate-variants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawData: body.rawData,
        variantCount,
        problemFormat: body.problemFormat ?? 'open_ended',
        language: body.language ?? 'python',
      }),
    });
    if (!pyRes.ok) {
      const errText = await pyRes.text();
      console.error('Variant service error:', errText);
      return NextResponse.json(
        { success: false, error: 'Variant generation service failed.' },
        { status: 502 }
      );
    }
    aiResult = await pyRes.json();
  } catch (err) {
    console.error('Variant service unreachable:', err);
    return NextResponse.json(
      { success: false, error: 'Variant generation service is not reachable.' },
      { status: 502 }
    );
  }

  // HM override wins; otherwise use AI-extracted skills.
  const requiredSkills = body.requiredSkillsOverride ?? aiResult.requiredSkills;

  // Use first successfully-generated variant as canonical display fields, or fallback.
  const canonical = aiResult.variants.find((v) => !v.generationFailed) ?? aiResult.variants[0];

  await connectToDatabase();

  const isCoding = body.problemFormat === 'coding';

  const problem = await Problem.create({
    title: canonical.title,
    description: canonical.description,
    difficulty: body.difficulty,
    status: 'open',
    companyId: session.role === 'hiring_manager' ? session.companyId : undefined,
    collegeId: session.role === 'mentor' ? session.collegeId : undefined,
    problemType: session.role === 'mentor' ? 'class_assignment' : 'company',
    problemFormat: isCoding ? 'coding' : 'open_ended',
    language: isCoding ? (body.language ?? 'python') : undefined,
    testCases: isCoding ? (aiResult.testCases ?? []) : [],
    referenceSolution: isCoding ? aiResult.referenceSolution : undefined,
    postedBy: session.userId,
    postedByRole: session.role,
    requiredSkills,
    rubric: aiResult.rubric,
    datasetSummary: aiResult.datasetSummary,
    variants: aiResult.variants,
    createdAt: new Date(),
  });

  syncProblemNode({
    id: String((problem as any)._id),
    title: problem.title,
    difficulty: problem.difficulty,
    status: problem.status,
    postedAt: problem.createdAt,
    companyId: problem.companyId,
    companyName: body.companyName ?? null,
    companyIndustry: body.companyIndustry ?? null,
    requiredSkills: problem.requiredSkills,
  }).catch((err: unknown) => {
    console.error('Neo4j graph sync failed for problem:', err);
  });

  // Return the full AI result alongside the saved doc so the HM can review
  // extracted skills and re-POST with requiredSkillsOverride before finalising.
  return NextResponse.json(
    {
      success: true,
      problem,
      ai: {
        coreChallenge: aiResult.coreChallenge,
        datasetSummary: aiResult.datasetSummary,
        rubric: aiResult.rubric,
        requiredSkillsExtracted: aiResult.requiredSkills,
        variants: aiResult.variants,
        problemFormat: problem.problemFormat,
        testCases: isCoding ? aiResult.testCases : undefined,
      },
    },
    { status: 201 }
  );
}
