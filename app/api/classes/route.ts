import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAuth, AuthError } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Class from '@/models/class';
import ClassMembership from '@/models/classMembership';

export const runtime = 'nodejs';

export async function GET() {
  let session;
  try {
    session = await requireAuth(['mentor', 'student']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  await connectToDatabase();

  if (session.role === 'mentor') {
    const mentorId = new mongoose.Types.ObjectId(session.userId);
    const classes = await Class.find({ mentorId }).sort({ createdAt: -1 }).lean();

    // Aggregate pending and approved counts for each class
    const classIds = classes.map((c) => c._id);
    const counts = await ClassMembership.aggregate([
      { $match: { classId: { $in: classIds } } },
      { $group: { _id: { classId: '$classId', status: '$status' }, count: { $sum: 1 } } },
    ]);

    const countMap: Record<string, { pending: number; approved: number }> = {};
    for (const c of classes) {
      countMap[c._id.toString()] = { pending: 0, approved: 0 };
    }
    for (const row of counts) {
      const cid = row._id.classId.toString();
      if (countMap[cid]) {
        if (row._id.status === 'pending') countMap[cid].pending = row.count;
        if (row._id.status === 'approved') countMap[cid].approved = row.count;
      }
    }

    const result = classes.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      classId: c.classId,
      collegeId: c.collegeId,
      qrCodeDataUrl: c.qrCodeDataUrl,
      createdAt: c.createdAt,
      pendingCount: countMap[c._id.toString()]?.pending ?? 0,
      approvedCount: countMap[c._id.toString()]?.approved ?? 0,
    }));

    return NextResponse.json({ success: true, classes: result });
  }

  // If student: return classes where student is an approved member
  const studentId = new mongoose.Types.ObjectId(session.userId);
  const memberships = await ClassMembership.find({ studentId, status: 'approved' })
    .populate({
      path: 'classId',
      select: 'name classId collegeId createdAt qrCodeDataUrl mentorId',
      populate: { path: 'mentorId', select: 'username email' },
    })
    .lean();

  const studentClasses = memberships
    .filter((m) => m.classId != null)
    .map((m: any) => ({
      membershipId: m._id.toString(),
      id: m.classId._id.toString(),
      name: m.classId.name,
      classId: m.classId.classId,
      collegeId: m.classId.collegeId,
      mentorName: m.classId.mentorId?.username || 'Mentor',
      joinedAt: m.decidedAt || m.createdAt,
    }));

  return NextResponse.json({ success: true, classes: studentClasses });
}
