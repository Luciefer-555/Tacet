import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import DbProblem from '@/models/dbProblem';
import { requireAuth, AuthError } from '@/lib/auth';
import { getStudentProblemScope } from '@/lib/studentProblemVisibility';

export const runtime = 'nodejs';

export async function GET(
  { params }: { params: Promise<{ problemId: string }> }
) {
  let session;
  try { session = await requireAuth(['student']); }
  catch (err) { if (err instanceof AuthError) return err; throw err; }
  const { problemId } = await params;
  if (!Types.ObjectId.isValid(problemId)) return NextResponse.json({ success: false, error: 'Invalid problemId format.' }, { status: 400 });
  await connectToDatabase();
  const problem = await DbProblem.findOne({ _id: problemId, ...(await getStudentProblemScope(session.userId, session.collegeId)) })
    .select('dbType schemaDefinition').lean() as { dbType: 'sql' | 'mongodb'; schemaDefinition: string } | null;
  if (!problem) return NextResponse.json({ success: false, error: 'Database problem not found.' }, { status: 404 });
  return NextResponse.json({ success: true, seed: { dbType: problem.dbType, schemaDefinition: problem.schemaDefinition } });
}
