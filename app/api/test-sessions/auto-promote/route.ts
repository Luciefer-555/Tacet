import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import TestSession from '@/models/testSession';
import { autoPromoteTestSession } from '@/lib/submissionGrading';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let session;
  try {
    session = await requireAuth(['student', 'mentor', 'admin']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  try {
    await connectToDatabase();
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // empty body allowed
    }

    const query: Record<string, any> = { status: 'active' };

    // If student, scope to themselves
    if (session.role === 'student') {
      query.studentId = session.userId;
    } else if (body.studentId) {
      query.studentId = body.studentId;
    }

    if (body.problemId) {
      query.problemId = body.problemId;
    }
    if (body.classId) {
      query.classId = body.classId;
    }

    const sessions = await TestSession.find(query);
    const outcomes = [];

    for (const s of sessions) {
      const result = await autoPromoteTestSession(s);
      outcomes.push({ sessionId: (s as any)._id.toString(), ...result });
    }

    return NextResponse.json({
      success: true,
      evaluatedCount: sessions.length,
      promotedCount: outcomes.filter((o) => o.promoted).length,
      outcomes,
    });
  } catch (err: any) {
    console.error('Failed to run auto-promotion:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
