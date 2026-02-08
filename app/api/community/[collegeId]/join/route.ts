import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { connectToDatabase } from '@/lib/mongodb';
import CollegeCommunity from '@/models/collegeCommunity';
import User from '@/models/user';

export const runtime = 'nodejs';

const joinSchema = z.object({
  profileId: z.string().trim().min(1, 'profileId is required'),
  collegeName: z.string().trim().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ collegeId: string }> }
) {
  try {
    const payload = await request.json();
    const parseResult = joinSchema.safeParse(payload);

    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return NextResponse.json({ success: false, error: issue?.message ?? 'Invalid request body' }, { status: 400 });
    }

    const { profileId, collegeName } = parseResult.data;

    const { collegeId } = await context.params;
    const collegeIdTrimmed = collegeId.trim();

    await connectToDatabase();

    const user = await User.findOne({ profileId, collegeId: collegeIdTrimmed }).lean();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No matching user found for that profile ID and college.' },
        { status: 404 },
      );
    }

    const derivedCollegeName = collegeName ?? user.collegeName ?? 'Unknown College';

    const community = await CollegeCommunity.findOneAndUpdate(
      { collegeId: collegeIdTrimmed },
      {
        $setOnInsert: { collegeId: collegeIdTrimmed, collegeName: derivedCollegeName, members: [], posts: [] },
        $addToSet: { members: profileId },
        $set: { collegeName: derivedCollegeName },
      },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json({
      success: true,
      data: {
        collegeId: community?.collegeId,
        collegeName: community?.collegeName,
        members: community?.members ?? [],
      },
    });
  } catch (error) {
    console.error('Error joining community:', error);
    return NextResponse.json({ success: false, error: 'Failed to join community' }, { status: 500 });
  }
}
