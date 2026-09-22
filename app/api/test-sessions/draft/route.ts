import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import TestSession from '@/models/testSession';

export const runtime = 'nodejs';

// PATCH — Save draft code for an active timed test
export async function PATCH(request: Request) {
  let session;
  try {
    session = await requireAuth(['student']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  try {
    const body = await request.json();
    const { problemId, draftCode } = body;

    if (!problemId) {
      return NextResponse.json({ success: false, error: 'problemId is required.' }, { status: 400 });
    }

    await connectToDatabase();

    const testSession = await TestSession.findOne({
      problemId,
      studentId: session.userId,
      status: 'active',
    });

    if (!testSession) {
      return NextResponse.json({ success: false, error: 'No active test session found.' }, { status: 404 });
    }

    // Allow draft saves even slightly past deadline — the submission endpoint enforces the real cutoff
    testSession.draftCode = typeof draftCode === 'string' ? draftCode : '';
    testSession.lastDraftSavedAt = new Date();
    await testSession.save();

    return NextResponse.json({ success: true, savedAt: testSession.lastDraftSavedAt });
  } catch (err: any) {
    console.error('Failed to save test draft:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
