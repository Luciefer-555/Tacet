import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import DbProblem from '@/models/dbProblem';
import DbSubmission from '@/models/dbSubmission';
import { requireAuth, AuthError } from '@/lib/auth';
import { gradeSqlQuery, gradeMongoQuery } from '@/lib/dbSandbox';

export const runtime = 'nodejs';

const submissionSchema = z.object({
  problemId: z.string().min(1, 'problemId is required'),
  query: z.string().min(1, 'Query cannot be empty'),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAuth(['student']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const parseResult = submissionSchema.safeParse(payload);
  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: parseResult.error.issues[0]?.message ?? 'Invalid submission data.' },
      { status: 400 }
    );
  }

  const { problemId, query } = parseResult.data;

  if (!Types.ObjectId.isValid(problemId)) {
    return NextResponse.json({ success: false, error: 'Invalid problemId format.' }, { status: 400 });
  }

  await connectToDatabase();

  const problem = (await DbProblem.findById(problemId).select('+expectedResult +referenceQuery').lean()) as any;
  if (!problem) {
    return NextResponse.json({ success: false, error: 'Database problem not found.' }, { status: 404 });
  }

  if (problem.status !== 'open') {
    return NextResponse.json({ success: false, error: 'This problem is not open for submissions.' }, { status: 400 });
  }

  // Check college restrictions for class assignments
  if (problem.problemType === 'class_assignment' || problem.postedByRole === 'mentor') {
    if (problem.collegeId && session.collegeId !== problem.collegeId.toString()) {
      return NextResponse.json(
        { success: false, error: 'This class assignment is restricted to students of the hosting college.' },
        { status: 403 }
      );
    }
  }

  // Prevent duplicate submissions by the same student
  const existingSubmission = await DbSubmission.findOne({ problemId, studentId: session.userId });
  if (existingSubmission) {
    return NextResponse.json(
      { success: false, error: 'You have already submitted a query for this problem.' },
      { status: 409 }
    );
  }

  // Grade the query based on dbType
  let gradeResult: { passed: boolean; actualResult: any[]; error?: string | null };

  if (problem.dbType === 'sql') {
    try {
      gradeResult = await gradeSqlQuery({
        schemaDefinition: problem.schemaDefinition,
        studentQuery: query,
        expectedResult: problem.expectedResult,
        comparisonMode: problem.resultComparisonMode,
      });
    } catch (err: any) {
      gradeResult = {
        passed: false,
        actualResult: [],
        error: `SQL grading service error: ${err.message}`,
      };
    }
  } else if (problem.dbType === 'mongodb') {
    gradeResult = await gradeMongoQuery({
      schemaDefinition: problem.schemaDefinition,
      studentQuery: query,
      expectedResult: problem.expectedResult,
      comparisonMode: problem.resultComparisonMode,
    });
  } else {
    return NextResponse.json({ success: false, error: `Unsupported dbType: ${problem.dbType}` }, { status: 400 });
  }

  const submissionStatus = gradeResult.passed ? 'scored' : 'failed_gate';

  let newSubmission: any;
  try {
    newSubmission = await DbSubmission.create({
      problemId: problem._id,
      studentId: session.userId,
      dbType: problem.dbType,
      query,
      actualResult: gradeResult.actualResult,
      passed: gradeResult.passed,
      error: gradeResult.error || null,
      status: submissionStatus,
      submittedAt: new Date(),
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return NextResponse.json(
        { success: false, error: 'You have already submitted a query for this problem.' },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json(
    {
      success: true,
      submission: {
        _id: newSubmission._id,
        problemId: newSubmission.problemId,
        studentId: newSubmission.studentId,
        dbType: newSubmission.dbType,
        query: newSubmission.query,
        actualResult: newSubmission.actualResult,
        passed: newSubmission.passed,
        error: newSubmission.error,
        status: newSubmission.status,
        submittedAt: newSubmission.submittedAt,
      },
    },
    { status: 201 }
  );
}
