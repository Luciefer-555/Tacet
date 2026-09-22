import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import Submission from '@/models/submission';
import { requireAuth, AuthError } from '@/lib/auth';
import { checkAndPromoteStudentSessions } from '@/lib/submissionGrading';

export async function GET(_req: Request) {
  let session;
  try {
    session = await requireAuth(['student']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  try {
    await connectToDatabase();

    // Opportunistically promote any of this student's expired active test sessions
    await checkAndPromoteStudentSessions({ studentId: session.userId });

    const submissions = await Submission.find({ studentId: session.userId })
      .populate('problemId', 'title archetype difficulty status companyId collegeId problemType postedByRole problemFormat')
      .sort({ submittedAt: -1 })
      .lean();

    // Strip hidden test case inputs from student view
    const safe = submissions.map((s: any) => ({
      ...s,
      testResults: (s.testResults ?? []).map((r: any) =>
        r.hidden
          ? { passed: r.passed, hidden: true }
          : r
      ),
    }));

    return NextResponse.json({ success: true, submissions: safe });
  } catch (error) {
    console.error('Error fetching own submissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch your submissions.' }, { status: 500 });
  }
}
