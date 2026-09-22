import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import DbSubmission from '@/models/dbSubmission';
import DbProblem from '@/models/dbProblem';
import { requireAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  let session;
  try {
    session = await requireAuth(['student']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  await connectToDatabase();

  // Ensure DbProblem model is registered
  if (!DbProblem) {
    // dummy check to register
  }

  const submissions = await DbSubmission.find({ studentId: session.userId })
    .populate('problemId', 'title difficulty dbType status')
    .sort({ submittedAt: -1 })
    .lean();

  return NextResponse.json({ success: true, submissions });
}
