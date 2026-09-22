import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/user';
import { requireAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireAuth(['hiring_manager']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  await connectToDatabase();
  const colleges = await User.aggregate([
    { $match: { role: { $in: ['student', 'mentor'] }, collegeId: { $type: 'string' } } },
    { $group: { _id: '$collegeId', name: { $first: '$collegeName' } } },
    { $sort: { name: 1, _id: 1 } },
    { $project: { _id: 0, id: '$_id', name: 1 } },
  ]);

  return NextResponse.json({ success: true, colleges });
}
