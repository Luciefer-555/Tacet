import { NextResponse } from 'next/server';
import { Types } from 'mongoose';

import { connectToDatabase } from '@/lib/mongodb';
import DbSubmission from '@/models/dbSubmission';
import DbProblem from '@/models/dbProblem';
import '@/models/user';
import { requireAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  context: { params: Promise<{ problemId: string }> }
) {
  let session;
  try {
    session = await requireAuth(['hiring_manager', 'mentor']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  const { problemId } = await context.params;

  if (!Types.ObjectId.isValid(problemId)) {
    return NextResponse.json({ success: false, error: 'Invalid problemId format.' }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const problem = (await DbProblem.findById(problemId).lean()) as any;
    if (!problem) {
      return NextResponse.json({ success: false, error: 'Database problem not found.' }, { status: 404 });
    }

    const isPoster = (problem as any).postedBy?.toString() === session.userId;

    // Ownership check:
    // - Hiring managers may only view submissions for their own company's problems.
    // - Mentors may only view submissions for problems they posted at their own college.
    if (session.role === 'hiring_manager') {
      const isSameCompany = (problem as any).companyId && (problem as any).companyId === session.companyId;
      if (!isPoster && !isSameCompany) {
        return NextResponse.json(
          { success: false, error: 'You can only view submissions for your own company\'s problems.' },
          { status: 403 }
        );
      }
    } else if (session.role === 'mentor') {
      const isSameCollege = (problem as any).collegeId && (problem as any).collegeId.toString() === session.collegeId;
      if (!isPoster || !isSameCollege) {
        return NextResponse.json(
          { success: false, error: 'You can only view submissions for your own class assignments.' },
          { status: 403 }
        );
      }
    }

    const rawSubmissions = await DbSubmission.find({ problemId })
      .populate('studentId', 'username email collegeName')
      .sort({ submittedAt: -1 })
      .lean();

    const submissions = rawSubmissions.map((s: any) => ({
      _id: s._id,
      id: s._id.toString(),
      studentName: s.studentId?.username ?? 'Anonymous',
      studentEmail: s.studentId?.email ?? '',
      studentCollege: s.studentId?.collegeName ?? '',
      query: s.query,
      actualResult: s.actualResult,
      passed: s.passed,
      error: s.error ?? null,
      status: s.status,
      submittedAt: s.submittedAt,
    }));

    return NextResponse.json({ success: true, submissions });
  } catch (error) {
    console.error('Error fetching DB submissions for problem:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch DB submissions.' }, { status: 500 });
  }
}
