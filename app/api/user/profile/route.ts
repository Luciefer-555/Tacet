import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/user';

export const runtime = 'nodejs';

// Safe profile projection whitelist — strictly excludes sensitive authentication/token fields
function sanitizeProfile(userDoc: any) {
  return {
    userId: userDoc._id ? userDoc._id.toString() : userDoc.userId,
    profileId: userDoc.profileId ?? '',
    username: userDoc.username ?? '',
    email: userDoc.email ?? '',
    role: userDoc.role ?? 'student',
    collegeId: userDoc.collegeId ?? '',
    collegeName: userDoc.collegeName ?? '',
    companyId: userDoc.companyId ?? undefined,
    branch: userDoc.branch ?? '',
    year: userDoc.year ?? '',
    avatarUrl: userDoc.avatarUrl ?? '',
    skills: Array.isArray(userDoc.skills) ? userDoc.skills : [],
    joinedAt: userDoc.joinedAt ? new Date(userDoc.joinedAt).toISOString() : undefined,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      profile: sanitizeProfile(user),
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch profile' }, { status: 500 });
  }
}

const updateProfileSchema = z.object({
  username: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
  collegeName: z.string().trim().max(200).optional(),
  branch: z.string().trim().max(100).optional(),
  year: z.string().trim().max(50).optional(),
  skills: z.array(z.string().trim()).max(50).optional(),
  avatarUrl: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const { username, collegeName, branch, year, skills, avatarUrl } = parsed.data;

    if (username !== undefined) user.username = username;
    if (collegeName !== undefined) user.collegeName = collegeName;
    if (branch !== undefined) user.branch = branch;
    if (year !== undefined) user.year = year;
    if (skills !== undefined) user.skills = skills;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

    await user.save();

    return NextResponse.json({
      success: true,
      profile: sanitizeProfile(user),
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
