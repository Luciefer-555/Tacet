import { NextResponse } from 'next/server';
import { Types } from 'mongoose';

import { connectToDatabase } from '@/lib/mongodb';
import Submission from '@/models/submission';
import Problem from '@/models/problem';
import { requireAuth, AuthError } from '@/lib/auth';
import { syncSubmission } from '@/lib/graphSync';

const RANKING_SERVICE_URL = process.env.RANKING_SERVICE_URL ?? 'http://localhost:8001';

export async function POST(
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
    // - Hiring managers may only rank submissions for their own company's problems.
    // - Mentors may only rank submissions for class assignments they posted at their own college.
    if (session.role === 'hiring_manager') {
      if ((problem as any).companyId !== session.companyId) {
        return NextResponse.json(
          { success: false, error: 'You can only rank submissions for your own company\'s problems.' },
          { status: 403 }
        );
      }
    } else if (session.role === 'mentor') {
      if (
        (problem as any).postedBy?.toString() !== session.userId ||
        (problem as any).collegeId !== session.collegeId
      ) {
        return NextResponse.json(
          { success: false, error: 'You can only rank submissions for your own class assignments.' },
          { status: 403 }
        );
      }
    }

    // status: 'submitted' already excludes 'failed_gate' coding submissions
    const unscored = await Submission.find({ problemId, status: 'submitted' }).lean();

    if (unscored.length === 0) {
      return NextResponse.json({ success: true, message: 'No unscored submissions to rank.', ranked: [] });
    }

    const isCoding = (problem as any).problemFormat === 'coding';

    const rankingResponse = await fetch(`${RANKING_SERVICE_URL}/rank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem: {
          title: (problem as any).title,
          description: (problem as any).description,
          requiredSkills: (problem as any).requiredSkills ?? [],
          problemFormat: (problem as any).problemFormat ?? 'open_ended',
          language: (problem as any).language ?? null,
        },
        submissions: unscored.map((s: any) => ({
          id: s._id.toString(),
          content: isCoding ? (s.code ?? '') : (s.content ?? ''),
          code: s.code ?? null,
          language: s.language ?? null,
          testResults: s.testResults ?? [],
        })),
      }),
    });

    if (!rankingResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'Ranking service failed to respond.' },
        { status: 502 }
      );
    }

    const { results } = await rankingResponse.json();

    // Sort by score descending to assign ranks
    const sorted = [...results].sort((a: any, b: any) => (b.finalScore ?? 0) - (a.finalScore ?? 0));

    const updated = [];
    for (let i = 0; i < sorted.length; i++) {
      const r = sorted[i];
      const rank = i + 1;

      const updatedDoc = await Submission.findByIdAndUpdate(
        r.submissionId,
        {
          aiScore: r.finalScore,
          aiRationale: r.rationale,
          status: 'scored',
        },
        { new: true }
      ).lean();

      if (updatedDoc) {
        updated.push({ ...updatedDoc, rank, flags: r.flags });

        syncSubmission({
          id: (updatedDoc as any)._id.toString(),
          studentId: (updatedDoc as any).studentId.toString(),
          problemId,
          aiScore: r.finalScore,
          rank,
          submittedAt: (updatedDoc as any).submittedAt,
        }).catch((err: unknown) => {
          console.error('Neo4j sync failed for ranked submission:', err);
        });
      }
    }

    return NextResponse.json({ success: true, ranked: updated });
  } catch (error) {
    console.error('Error ranking submissions:', error);
    return NextResponse.json({ success: false, error: 'Failed to rank submissions.' }, { status: 500 });
  }
}
