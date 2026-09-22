import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import DbProblem from '@/models/dbProblem';
import Company from '@/models/company';
import { requireAuth, AuthError } from '@/lib/auth';
import { executeSqlQuery, gradeMongoQuery } from '@/lib/dbSandbox';

export const runtime = 'nodejs';

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
      { success: false, error: 'Please verify your email before posting problems.' },
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

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }

  const {
    title,
    description,
    difficulty = 'Medium',
    dbType,
    schemaDefinition,
    referenceQuery,
    resultComparisonMode = 'unordered',
    problemType = 'company',
  } = body;

  if (!title?.trim() || !description?.trim()) {
    return NextResponse.json({ success: false, error: 'Title and description are required.' }, { status: 400 });
  }

  if (!dbType || !['sql', 'mongodb'].includes(dbType)) {
    return NextResponse.json({ success: false, error: 'dbType must be "sql" or "mongodb".' }, { status: 400 });
  }

  if (!schemaDefinition?.trim()) {
    return NextResponse.json({ success: false, error: 'schemaDefinition is required.' }, { status: 400 });
  }

  if (!referenceQuery?.trim()) {
    return NextResponse.json({ success: false, error: 'referenceQuery is required.' }, { status: 400 });
  }

  if (!['ordered', 'unordered'].includes(resultComparisonMode)) {
    return NextResponse.json({ success: false, error: 'resultComparisonMode must be "ordered" or "unordered".' }, { status: 400 });
  }

  // Cross-verify reference query against schemaDefinition live
  let expectedResult: any[] = [];
  try {
    if (dbType === 'sql') {
      const execRes = await executeSqlQuery({
        schemaDefinition,
        query: referenceQuery,
      });
      if (!execRes.success || execRes.error) {
        return NextResponse.json(
          { success: false, error: `Reference SQL query failed to execute: ${execRes.error}` },
          { status: 400 }
        );
      }
      expectedResult = execRes.results;
    } else {
      // MongoDB
      const execRes = await gradeMongoQuery({
        schemaDefinition,
        studentQuery: referenceQuery,
        comparisonMode: resultComparisonMode,
      });
      if (execRes.error) {
        return NextResponse.json(
          { success: false, error: `Reference MongoDB query failed to execute: ${execRes.error}` },
          { status: 400 }
        );
      }
      expectedResult = execRes.actualResult;
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: `Verification of reference query failed: ${err.message}` },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const newProblem = await DbProblem.create({
    title: title.trim(),
    description: description.trim(),
    difficulty,
    dbType,
    schemaDefinition: schemaDefinition.trim(),
    referenceQuery: referenceQuery.trim(),
    expectedResult,
    resultComparisonMode,
    status: 'open',
    postedBy: session.userId,
    postedByRole: session.role,
    problemType: session.role === 'mentor' ? 'class_assignment' : problemType,
    companyId: session.role === 'hiring_manager' ? session.companyId : undefined,
    collegeId: session.collegeId ?? null,
    classId: session.role === 'mentor' && body.classId ? body.classId : undefined,
  });

  return NextResponse.json(
    {
      success: true,
      problem: {
        _id: newProblem._id,
        title: newProblem.title,
        description: newProblem.description,
        difficulty: newProblem.difficulty,
        dbType: newProblem.dbType,
        schemaDefinition: newProblem.schemaDefinition,
        resultComparisonMode: newProblem.resultComparisonMode,
        status: newProblem.status,
        expectedResult: newProblem.expectedResult,
      },
    },
    { status: 201 }
  );
}
