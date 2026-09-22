import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Problem from '@/models/problem';
import TestSession from '@/models/testSession';
import ClassMembership from '@/models/classMembership';
import { autoPromoteTestSession, AUTO_PROMOTION_MESSAGE } from '@/lib/submissionGrading';

export const runtime = 'nodejs';

// POST — Start a timed test session (records server-side startedAt)
export async function POST(request: Request) {
  let session;
  try {
    session = await requireAuth(['student']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  try {
    const body = await request.json();
    const { problemId } = body;

    if (!problemId) {
      return NextResponse.json({ success: false, error: 'problemId is required.' }, { status: 400 });
    }

    await connectToDatabase();

    const problem = await Problem.findById(problemId).lean() as any;
    if (!problem) {
      return NextResponse.json({ success: false, error: 'Problem not found.' }, { status: 404 });
    }

    if (!problem.timeLimit) {
      return NextResponse.json({ success: false, error: 'This problem is not a timed test.' }, { status: 400 });
    }

    // If problem has opensAt, check if it's past the gate
    if (problem.opensAt && new Date() < new Date(problem.opensAt)) {
      return NextResponse.json(
        { success: false, error: 'This test has not opened yet.', opensAt: problem.opensAt },
        { status: 403 }
      );
    }

    // If class-scoped, verify student membership
    if (problem.classId) {
      const membership = await ClassMembership.findOne({
        classId: problem.classId,
        studentId: session.userId,
        status: 'approved',
      });
      if (!membership) {
        return NextResponse.json(
          { success: false, error: 'You must be an approved member of the class to start this test.' },
          { status: 403 }
        );
      }
    }

    // Check for existing session — if already started, return existing (idempotent)
    const existing = await TestSession.findOne({
      problemId,
      studentId: session.userId,
    });

    if (existing) {
      const deadlineMs = new Date(existing.startedAt).getTime() + existing.timeLimitMinutes * 60 * 1000;
      const now = Date.now();

      // Check if already submitted or auto-promoted
      if (existing.status === 'submitted') {
        return NextResponse.json({
          success: true,
          status: 'submitted',
          autoPromoted: Boolean(existing.autoPromoted),
          message: existing.autoPromoted
            ? AUTO_PROMOTION_MESSAGE
            : 'You have already submitted this test.',
          submissionId: existing.submissionId ? existing.submissionId.toString() : null,
        });
      }

      // Check if past deadline + 5 minutes for dropped-connection auto-promotion
      if (existing.status === 'active' && now > deadlineMs + 5 * 60 * 1000) {
        const promo = await autoPromoteTestSession(existing);
        if (promo.promoted) {
          return NextResponse.json({
            success: true,
            status: 'submitted',
            autoPromoted: true,
            message: AUTO_PROMOTION_MESSAGE,
            submissionId: promo.submission?._id.toString(),
          });
        }
      }

      if (now > deadlineMs + 60_000) {
        // Past deadline + grace: mark expired
        existing.status = 'expired';
        await existing.save();
        return NextResponse.json(
          { success: false, error: 'Your test session has expired.' },
          { status: 410 }
        );
      }
      return NextResponse.json({
        success: true,
        testSession: {
          id: (existing as any)._id.toString(),
          startedAt: existing.startedAt,
          timeLimitMinutes: existing.timeLimitMinutes,
          deadlineMs,
          remainingMs: Math.max(0, deadlineMs - now),
          draftCode: existing.draftCode || '',
          status: existing.status,
        },
      });
    }

    // Create new test session — server stamps the start time
    const testSession = await TestSession.create({
      problemId,
      studentId: session.userId,
      classId: problem.classId || null,
      startedAt: new Date(),
      timeLimitMinutes: problem.timeLimit,
      status: 'active',
    });

    const deadlineMs = testSession.startedAt.getTime() + testSession.timeLimitMinutes * 60 * 1000;

    return NextResponse.json(
      {
        success: true,
        testSession: {
          id: (testSession as any)._id.toString(),
          startedAt: testSession.startedAt,
          timeLimitMinutes: testSession.timeLimitMinutes,
          deadlineMs,
          remainingMs: Math.max(0, deadlineMs - Date.now()),
          draftCode: '',
          status: 'active',
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Failed to start test session:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
