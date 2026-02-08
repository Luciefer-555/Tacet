import { NextRequest, NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import CollegeCommunity from '@/models/collegeCommunity';
import User from '@/models/user';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ collegeId: string }> }
) {
  try {
    await connectToDatabase();

    const { collegeId } = await context.params;

    const community = await CollegeCommunity.findOne({ collegeId }).lean();

    if (!community) {
      return NextResponse.json({ success: true, data: [] });
    }

    if (!community.members.length) {
      return NextResponse.json({ success: true, data: [] });
    }

    const members = await User.find({
      collegeId,
      profileId: { $in: community.members },
    })
      .select('username profileId collegeId collegeName skills role joinedAt')
      .lean();

    const memberSummaries = members.map(member => ({
      username: member.username,
      profileId: member.profileId,
      collegeId: member.collegeId,
      collegeName: member.collegeName,
      skills: member.skills ?? [],
      role: member.role,
      joinedAt: member.joinedAt,
    }));

    return NextResponse.json({ success: true, data: memberSummaries });
  } catch (error) {
    console.error('Error fetching community members:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch community members' },
      { status: 500 }
    );
  }
}
