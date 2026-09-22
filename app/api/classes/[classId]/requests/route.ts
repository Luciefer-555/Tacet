import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Class from '@/models/class';
import ClassMembership from '@/models/classMembership';

export const runtime = 'nodejs';

export async function GET(
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
  if (!classDoc) {
    return NextResponse.json({ success: false, error: 'Class not found.' }, { status: 404 });
  }

  // Mentor ownership check
  if (classDoc.mentorId.toString() !== session.userId) {
    return NextResponse.json({ success: false, error: 'Access denied. You do not own this class.' }, { status: 403 });
  }

  const requests = await ClassMembership.find({
    classId: classDoc._id,
    status: 'pending',
  })
    .populate({
      path: 'studentId',
      select: 'username email profileId branch year collegeName skills',
    })
    .sort({ requestedAt: -1 })
    .lean();

  const formattedRequests = requests
    .filter((r) => r.studentId != null)
    .map((r: any) => ({
      membershipId: r._id.toString(),
      studentId: r.studentId._id.toString(),
      username: r.studentId.username,
      email: r.studentId.email,
      profileId: r.studentId.profileId,
      branch: r.studentId.branch || '',
      year: r.studentId.year || '',
      collegeName: r.studentId.collegeName || '',
      skills: r.studentId.skills || [],
      requestedAt: r.requestedAt,
    }));

  return NextResponse.json({
    success: true,
    classId: classDoc.classId,
    className: classDoc.name,
    requests: formattedRequests,
  });
}
