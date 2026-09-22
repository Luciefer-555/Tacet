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
    session = await requireAuth(['hiring_manager']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  await connectToDatabase();

  const hmObjectId = new mongoose.Types.ObjectId(session.userId);

  // 1. Find problems belonging to this hiring manager / company
  const query: any = {
    $or: [{ postedBy: hmObjectId }],
  };
  if (session.companyId) {
    query.$or.push({ companyId: session.companyId });
  }

  const [problems, dbProblems] = await Promise.all([
    Problem.find(query).select('title difficulty archetype companyId').lean(),
    DbProblem.find(query).select('title difficulty dbType companyId').lean(),
  ]);

  const problemsPosted = problems.length + dbProblems.length;
  const problemIds = problems.map((p) => p._id);
  const dbProblemIds = dbProblems.map((p) => p._id);

  if (problemsPosted === 0) {
    return NextResponse.json({
      success: true,
      stats: {
        problemsPosted: 0,
        totalSubmissionsReceived: 0,
        submissionsRanked: 0,
        submissionsPending: 0,
        avgRankScore: 0,
        topRankedSubmission: null,
        domainProfile: {
          label: 'Not Enough Activity Yet',
          description: 'Post real business challenges to attract and benchmark student engineering talent.',
          isCalibrating: true,
        },
      },
    });
  }

  // 2. Fetch submissions for these problems
  const [submissions, dbSubmissions] = await Promise.all([
    Submission.find({ problemId: { $in: problemIds } })
      .populate('studentId', 'username profileId')
      .populate('problemId', 'title difficulty')
      .lean(),
    DbSubmission.find({ problemId: { $in: dbProblemIds } })
      .lean(),
  ]);

  const totalSubmissionsReceived = submissions.length + dbSubmissions.length;
  let submissionsRanked = 0;
  let scoreSum = 0;
  let topRanked: { score: number; candidateName: string; candidateProfileId: string; problemTitle: string } | null = null;

  for (const sub of submissions) {
    const candidate = sub.studentId as any;
    const problem = sub.problemId as any;

    if (typeof sub.aiScore === 'number' || sub.status === 'scored') {
      const score = sub.aiScore ?? sub.manualScore ?? 0;
      submissionsRanked++;
      scoreSum += score;

      if (!topRanked || score > topRanked.score) {
        topRanked = {
          score,
          candidateName: candidate?.username || 'Anonymous Candidate',
          candidateProfileId: candidate?.profileId || '',
          problemTitle: problem?.title || 'Company Challenge',
        };
      }
    }
  }

  const submissionsPending = Math.max(0, totalSubmissionsReceived - submissionsRanked);
  const avgRankScore = submissionsRanked > 0 ? Math.round((scoreSum / submissionsRanked) * 10) / 10 : 0;

  const domainProfile = {
    label: 'Talent Pipeline Active',
    description: `Benchmarking candidate submissions across ${problemsPosted} posted company ${problemsPosted === 1 ? 'problem' : 'problems'}.`,
    isCalibrating: false,
  };

  return NextResponse.json({
    success: true,
    stats: {
      problemsPosted,
      totalSubmissionsReceived,
      submissionsRanked,
      submissionsPending,
      avgRankScore,
      topRankedSubmission: topRanked,
      domainProfile,
    },
  });
}
