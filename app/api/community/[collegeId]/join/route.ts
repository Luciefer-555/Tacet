import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { connectToDatabase } from '@/lib/mongodb';
import CollegeCommunity from '@/models/collegeCommunity';
import User from '@/models/user';
import { requireAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

const joinSchema = z.object({
  collegeName: z.string().trim().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ collegeId: string }> }
) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  const { collegeId } = await context.params;
  const collegeIdTrimmed = collegeId.trim();

  if (session.collegeId !== collegeIdTrimmed) {
    return NextResponse.json(
      { success: false, error: 'You can only interact with your own college community.' },
      { status: 403 }
    );
  }

  try {
    let collegeName: string | undefined;
    try {
      const payload = await request.json();
      const parseResult = joinSchema.safeParse(payload);
      if (parseResult.success) {
        collegeName = parseResult.data.collegeName;
      }
    } catch {
      // Body is optional
    }

    await connectToDatabase();

    const user = await User.findOne({ profileId: session.profileId, collegeId: collegeIdTrimmed }).lean();
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
        $addToSet: { members: session.profileId },
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