import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { requireAuth, AuthError } from '@/lib/auth';
import Problem from '@/models/problem';
import Submission from '@/models/submission';
import DbProblem from '@/models/dbProblem';
import DbSubmission from '@/models/dbSubmission';

export const runtime = 'nodejs';

export async function GET() {
  let session;
  try {
    session = await requireAuth(['mentor']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  await connectToDatabase();

  const mentorObjectId = new mongoose.Types.ObjectId(session.userId);

  // 1. Find all problems posted by this mentor
  const [problems, dbProblems] = await Promise.all([
    Problem.find({
      $or: [{ postedBy: mentorObjectId }, { collegeId: session.collegeId, postedByRole: 'mentor' }],
    })
      .select('title difficulty archetype problemType requiredSkills')
      .lean(),
    DbProblem.find({
      $or: [{ postedBy: mentorObjectId }, { collegeId: session.collegeId, postedByRole: 'mentor' }],
    })
      .select('title difficulty dbType problemType')
      .lean(),
  ]);

  const assignmentsPosted = problems.length + dbProblems.length;
  const problemIds = problems.map((p) => p._id);
  const dbProblemIds = dbProblems.map((p) => p._id);

  if (assignmentsPosted === 0) {
    return NextResponse.json({
      success: true,
      stats: {
        assignmentsPosted: 0,
        totalSubmissionsReceived: 0,
        uniqueStudentsReached: 0,
        avgScore: 0,
        topSubmission: null,
        focusArea: {
          label: 'Not Enough Activity Yet',
          description: 'Post your first class assignment to begin tracking cohort performance and submissions.',
          isCalibrating: true,
        },
      },
    });
  }

  // 2. Find submissions for these problems
  const [submissions, dbSubmissions] = await Promise.all([
    Submission.find({ problemId: { $in: problemIds } })
      .populate('studentId', 'username profileId')
      .populate('problemId', 'title difficulty')
      .lean(),
    DbSubmission.find({ problemId: { $in: dbProblemIds } })
      .populate('studentId', 'username profileId')
      .lean(),
  ]);

  const totalSubmissionsReceived = submissions.length + dbSubmissions.length;
  const uniqueStudentsSet = new Set<string>();

  for (const dbSub of dbSubmissions) {
    const student = dbSub.studentId as any;
    if (student?._id) {
      uniqueStudentsSet.add(student._id.toString());
    }
  }
  let scoredCount = 0;
  let scoreSum = 0;
  let topSub: { score: number; studentName: string; problemTitle: string; submittedAt: string } | null = null;

  for (const sub of submissions) {
    const student = sub.studentId as any;
    const problem = sub.problemId as any;

    if (student?._id) {
      uniqueStudentsSet.add(student._id.toString());
    }

    if (typeof sub.aiScore === 'number') {
      scoredCount++;
      scoreSum += sub.aiScore;
      if (!topSub || sub.aiScore > topSub.score) {
        topSub = {
          score: sub.aiScore,
          studentName: student?.username || 'Student',
          problemTitle: problem?.title || 'Assignment',
          submittedAt: sub.submittedAt ? new Date(sub.submittedAt).toISOString() : new Date().toISOString(),
        };
      }
    }
  }

  const uniqueStudentsReached = uniqueStudentsSet.size;
  const avgScore = scoredCount > 0 ? Math.round((scoreSum / scoredCount) * 10) / 10 : 0;

  // Derive Focus Area
  const focusArea = {
    label: 'Active Cohort Mentor',
    description: `Mentoring across ${assignmentsPosted} ${assignmentsPosted === 1 ? 'assignment' : 'assignments'} reaching ${uniqueStudentsReached} ${uniqueStudentsReached === 1 ? 'student' : 'students'}.`,
    isCalibrating: false,
  };

  return NextResponse.json({
    success: true,
    stats: {
      assignmentsPosted,
      totalSubmissionsReceived,
      uniqueStudentsReached,
      avgScore,
      topSubmission: topSub,
      focusArea,
    },
  });
}
