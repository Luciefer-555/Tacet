import { NextResponse } from 'next/server';
import { Types } from 'mongoose';

import { connectToDatabase } from '@/lib/mongodb';
import Submission from '@/models/submission';
import Problem from '@/models/problem';
import '@/models/user';
import { requireAuth, AuthError } from '@/lib/auth';

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

    const problem = await Problem.findById(problemId).lean();
    if (!problem) {
      return NextResponse.json({ success: false, error: 'Problem not found.' }, { status: 404 });
    }

    // Ownership check:
    // - Hiring managers may only view submissions for their own company's problems.
    // - Mentors may only view submissions for problems they posted at their own college.
    if (session.role === 'hiring_manager') {
      if ((problem as any).companyId !== session.companyId) {
        return NextResponse.json(
          { success: false, error: 'You can only view submissions for your own company\'s problems.' },
          { status: 403 }
        );
      }
    } else if (session.role === 'mentor') {
      if (
        (problem as any).postedBy?.toString() !== session.userId ||
        (problem as any).collegeId !== session.collegeId
      ) {
        return NextResponse.json(
          { success: false, error: 'You can only view submissions for your own class assignments.' },
          { status: 403 }
        );
      }
    }

    const submissions = await Submission.find({ problemId })
      .populate('studentId', 'username email collegeName')
      .sort({ submittedAt: -1 })
      .lean();

    return NextResponse.json({ success: true, submissions });
  } catch (error) {
    console.error('Error fetching submissions for problem:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch submissions.' }, { status: 500 });
  }
}
