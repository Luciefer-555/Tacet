import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Class from '@/models/class';
import ClassMembership from '@/models/classMembership';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  props: { params: Promise<{ classId: string }> }
) {
  let session;
  try {
    session = await requireAuth(['mentor']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  const { classId: rawClassId } = await props.params;
  const classId = (rawClassId || '').trim().toUpperCase();

  await connectToDatabase();

  const classDoc = await Class.findOne({ classId });
  if (!classDoc || classDoc.mentorId.toString() !== session.userId) {
    return NextResponse.json({ success: false, error: 'Class not found or access denied.' }, { status: 403 });
  }

  const result = await ClassMembership.updateMany(
    { classId: classDoc._id, status: 'pending' },
    { $set: { status: 'approved', decidedAt: new Date() } }
  );

  return NextResponse.json({
    success: true,
    approvedCount: result.modifiedCount,
  });
}
