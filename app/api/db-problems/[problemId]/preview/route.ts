import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import DbProblem from '@/models/dbProblem';
import { requireAuth, AuthError } from '@/lib/auth';
import { getStudentProblemScope } from '@/lib/studentProblemVisibility';
import { executeSqlQuery, gradeMongoQuery } from '@/lib/dbSandbox';

export const runtime = 'nodejs';

const previewSchema = z.object({ query: z.string().min(1, 'Query cannot be empty.') });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ problemId: string }> }
) {
  let session;
  try {
    session = await requireAuth(['student']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  const { problemId } = await params;
  if (!Types.ObjectId.isValid(problemId)) {
    return NextResponse.json({ success: false, error: 'Invalid problemId format.' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }
  const parsed = previewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid preview query.' }, { status: 400 });
  }

  await connectToDatabase();
  const problem = await DbProblem.findOne({
    _id: problemId,
    ...(await getStudentProblemScope(session.userId, session.collegeId)),
  }).lean() as unknown as { dbType: 'sql' | 'mongodb'; schemaDefinition: string } | null;
  if (!problem) return NextResponse.json({ success: false, error: 'Database problem not found.' }, { status: 404 });

  try {
    const result = problem.dbType === 'sql'
      ? await executeSqlQuery({ schemaDefinition: problem.schemaDefinition, query: parsed.data.query })
      : await gradeMongoQuery({ schemaDefinition: problem.schemaDefinition, studentQuery: parsed.data.query });
    const results = 'results' in result ? result.results : result.actualResult;

    return NextResponse.json({
      success: !result.error,
      results: results ?? [],
      error: result.error ?? null,
    }, { status: result.error ? 400 : 200 });
  } catch (err) {
    return NextResponse.json({
      success: false,
      results: [],
      error: err instanceof Error ? err.message : 'Preview execution failed.',
    }, { status: 502 });
  }
}
