import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/user';
import { createSession, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

const loginSchema = z.object({
  email: z.string().email('A valid email is required').optional(),
  profileId: z.string().trim().min(1, 'Profile ID is required'),
  collegeId: z.string().trim().optional(),
  password: z.string().min(8, 'Password is required'),
});

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parseResult = loginSchema.safeParse(payload);

    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return NextResponse.json({ success: false, error: issue?.message ?? 'Invalid credentials' }, { status: 400 });
    }

    const { email, profileId, collegeId, password } = parseResult.data;

    if (email) {
      const normalizedEmail = email.toLowerCase();
      const isCollegeEmail = /@(.*\.)?(edu|ac)(\.\w+)?$/i.test(normalizedEmail);
      if (!isCollegeEmail && !collegeId) {
        // Optional warning for college email
      }
    }

    await connectToDatabase();

    const query: Record<string, any> = { profileId };
    if (email) query.email = email.toLowerCase();
    if (collegeId) query.collegeId = collegeId;

    const user = await User.findOne(query);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'We could not find a matching profile for those credentials.' },
        { status: 404 },
      );
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        { success: false, error: 'Password authentication is not enabled for this account yet. Please reset your password.' },
        { status: 400 },
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Incorrect password. Please try again or reset your password.' },
        { status: 401 },
      );
    }

    // --- inside the success branch, after password verification passes ---
    const sessionToken = await createSession({
      userId: String((user as any)._id),
      profileId: user.profileId,
      username: user.username,
      role: user.role as any,
      emailVerified: Boolean(user.emailVerified),
      companyId: user.companyId ?? undefined,
      collegeId: user.collegeId ?? undefined,
    });
    await setSessionCookie(sessionToken);

    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error during user login:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}