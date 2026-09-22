import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Problem from '@/models/problem';
import Company from '@/models/company';
import Class from '@/models/class';
import { syncProblemNode } from '@/lib/graphSync';
import { requireAuth, AuthError } from '@/lib/auth';
import { validateCollegeIds } from '@/lib/collegeTargeting';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAuth(['hiring_manager', 'mentor']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  try {
    if (!session.emailVerified) {
      return NextResponse.json(
        { success: false, error: 'Please verify your email before posting problems. Check your inbox or request a new verification link.' },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const body = await req.json();

  if (session.role === 'hiring_manager') {
    const companyExists = await Company.exists({ companyId: session.companyId });
    if (!companyExists) {
      return NextResponse.json(
        { success: false, error: 'Please complete company onboarding before posting problems.' },
        { status: 403 }
      );
    }
    if (body.companyId && body.companyId !== session.companyId) {
      return NextResponse.json(
        { success: false, error: 'Cannot create a problem for a different company than your own.' },
        { status: 403 }
      );
    }
    const collegeTargeting = await validateCollegeIds(body.collegeIds);
    if (!collegeTargeting.valid) {
      return NextResponse.json({ success: false, error: collegeTargeting.error }, { status: 400 });
    }
    body.collegeIds = collegeTargeting.ids;
  } else if (session.role === 'mentor') {
    if (body.collegeId && body.collegeId !== session.collegeId) {
      return NextResponse.json(
        { success: false, error: 'Cannot create a class assignment for a different college than your own.' },
        { status: 403 }
      );
    }
    // If classId provided, verify mentor owns that class
    if (body.classId) {
      const classDoc = await Class.findById(body.classId);
      if (!classDoc || classDoc.mentorId.toString() !== session.userId) {
        return NextResponse.json(
          { success: false, error: 'Class not found or you do not own this class.' },
          { status: 403 }
        );
      }
    }
  }

  // Coding-problem validation
  const problemFormat = body.problemFormat ?? 'open_ended';
  if (problemFormat === 'coding') {
    if (!body.language || !['python', 'java', 'c', 'cpp'].includes(body.language)) {
      return NextResponse.json(
        { success: false, error: 'Coding problems require language to be "python", "java", "c", or "cpp".' },
        { status: 400 }
      );
    }
    const isFunctionGrading = body.gradingMode === 'function_signature';
    if (isFunctionGrading) {
      if (!Array.isArray(body.functionTestCases) || body.functionTestCases.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Function-signature problems require at least one function test case.' },
          { status: 400 }
        );
      }
    } else {
      if (!Array.isArray(body.testCases) || body.testCases.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Coding problems require at least one test case.' },
          { status: 400 }
        );
      }
    }
  }

  const problem = await Problem.create({
    title: body.title,
    description: body.description,
    archetype: body.archetype ?? null,
    difficulty: body.difficulty
      ? body.difficulty.charAt(0).toUpperCase() + body.difficulty.slice(1).toLowerCase()
      : 'Medium',
    status: body.status ?? 'open',
    requiredSkills: body.requiredSkills ?? [],
    problemFormat,
    gradingMode: body.gradingMode ?? 'stdin_stdout',
    functionName: body.functionName,
    parameters: body.parameters,
    returnType: body.returnType,
    functionTestCases: body.functionTestCases ?? [],
    language: problemFormat === 'coding' ? body.language : undefined,
    testCases: problemFormat === 'coding' ? (body.testCases ?? []) : [],
    companyId: session.role === 'hiring_manager' ? session.companyId : undefined,
    collegeIds: session.role === 'hiring_manager' ? body.collegeIds : undefined,
    collegeId: session.role === 'mentor' ? session.collegeId : undefined,
    classId: session.role === 'mentor' && body.classId ? body.classId : undefined,
    timeLimit: body.timeLimit ? Number(body.timeLimit) : undefined,
    opensAt: body.opensAt ? new Date(body.opensAt) : undefined,
    problemType: session.role === 'mentor' ? 'class_assignment' : 'company',
    postedBy: session.userId,
    postedByRole: session.role,
    createdAt: new Date(),
  });

  syncProblemNode({
    id: String((problem as any)._id),
    title: problem.title,
    archetype: problem.archetype,
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

    return NextResponse.json({ success: true, problem: (problem as any).toObject() }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating problem:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
