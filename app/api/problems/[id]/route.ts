import { NextResponse } from 'next/server';
import { Types } from 'mongoose';

import { connectToDatabase } from '@/lib/mongodb';
import Problem from '@/models/problem';
import { requireAuth, AuthError } from '@/lib/auth';
import { getStudentProblemScope } from '@/lib/studentProblemVisibility';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAuth(['student', 'hiring_manager', 'mentor']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  const { id } = await context.params;

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: false, error: 'Invalid problem ID format.' }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const problem = session.role === 'student'
      ? await Problem.findOne({ _id: id, ...(await getStudentProblemScope(session.userId, session.collegeId)) }).lean()
      : await Problem.findById(id).lean();
    if (!problem) {
      return NextResponse.json({ success: false, error: 'Problem not found.' }, { status: 404 });
    }

    const p = problem as any;

    // Students only see non-hidden test cases
    const testCases = session.role === 'student'
      ? (p.testCases ?? []).filter((tc: any) => !tc.hidden)
      : p.testCases ?? [];

    return NextResponse.json({
      success: true,
      problem: {
        _id: p._id,
        title: p.title,
        description: p.description,
        difficulty: p.difficulty,
        status: p.status,
        problemFormat: p.problemFormat ?? 'open_ended',
        language: p.language ?? null,
        testCases,
        requiredSkills: p.requiredSkills ?? [],
      },
    });
  } catch (error) {
    console.error('Error fetching problem:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch problem.' }, { status: 500 });
  }
}
