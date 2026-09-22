import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import DbProblem from '@/models/dbProblem';
import { requireAuth, AuthError } from '@/lib/auth';
import { getStudentProblemScope } from '@/lib/studentProblemVisibility';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ problemId: string }> }
) {
  let session;
  try {
    session = await requireAuth(['student', 'hiring_manager', 'mentor', 'admin']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  const { problemId } = await params;

  if (!Types.ObjectId.isValid(problemId)) {
    return NextResponse.json({ success: false, error: 'Invalid problemId format.' }, { status: 400 });
  }

  await connectToDatabase();

  const problem = session.role === 'student'
    ? await DbProblem.findOne({ _id: problemId, ...(await getStudentProblemScope(session.userId, session.collegeId)) }).lean()
    : await DbProblem.findById(problemId).select('+expectedResult +referenceQuery').lean() as any;

  if (!problem) {
    return NextResponse.json({ success: false, error: 'Database problem not found.' }, { status: 404 });
  }

  const isPoster = (problem as any).postedBy?.toString() === session.userId;

  // Role scoping & ownership checks:
  if (session.role === 'hiring_manager') {
    const isSameCompany = (problem as any).companyId && (problem as any).companyId === session.companyId;
    if (!isPoster && !isSameCompany) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to view this problem.' },
        { status: 403 }
      );
    }
  } else if (session.role === 'mentor') {
    const isSameCollege = (problem as any).collegeId && (problem as any).collegeId.toString() === session.collegeId;
    if (!isPoster || !isSameCollege) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to view this problem.' },
        { status: 403 }
      );
    }
  } else if (session.role === 'student') {
    // If it is a mentor's class assignment, restrict to students of that college
    if ((problem as any).problemType === 'class_assignment' || (problem as any).postedByRole === 'mentor') {
      if ((problem as any).collegeId && session.collegeId !== (problem as any).collegeId.toString()) {
        return NextResponse.json(
          { success: false, error: 'This class assignment is restricted to students of the hosting college.' },
          { status: 403 }
        );
      }
    }

    // Student: problem statement only — NEVER expectedResult or referenceQuery
    return NextResponse.json({
      success: true,
      problem: {
        _id: problem._id,
        title: problem.title,
        description: problem.description,
        difficulty: problem.difficulty,
        dbType: problem.dbType,
        schemaDefinition: problem.schemaDefinition,
        resultComparisonMode: problem.resultComparisonMode,
        status: problem.status,
        problemType: problem.problemType,
        postedByRole: problem.postedByRole,
        createdAt: problem.createdAt,
      },
    });
  }

  // Owning hiring manager / mentor / admin gets expectedResult and referenceQuery
  return NextResponse.json({
    success: true,
    problem: {
      _id: problem._id,
      title: problem.title,
      description: problem.description,
      difficulty: problem.difficulty,
      dbType: problem.dbType,
      schemaDefinition: problem.schemaDefinition,
      resultComparisonMode: problem.resultComparisonMode,
      status: problem.status,
      expectedResult: problem.expectedResult,
      referenceQuery: problem.referenceQuery,
      problemType: problem.problemType,
      postedByRole: problem.postedByRole,
      createdAt: problem.createdAt,
    },
  });
}
