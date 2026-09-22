import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Class from '@/models/class';
import ClassMembership from '@/models/classMembership';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  props: { params: Promise<{ classId: string; studentId: string }> }
) {
  let session;
  try {
    session = await requireAuth(['mentor']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  const { classId: rawClassId, studentId } = await props.params;
  const classId = (rawClassId || '').trim().toUpperCase();

  await connectToDatabase();

  const classDoc = await Class.findOne({ classId });
  if (!classDoc || classDoc.mentorId.toString() !== session.userId) {
    return NextResponse.json({ success: false, error: 'Class not found or access denied.' }, { status: 403 });
  }

  const membership = await ClassMembership.findOneAndUpdate(
    { classId: classDoc._id, studentId, status: 'pending' },
    { $set: { status: 'rejected', decidedAt: new Date() } },
    { new: true }
  );

  if (!membership) {
    return NextResponse.json({ success: false, error: 'No pending request found for this student.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, status: 'rejected' });
}
