import { NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/user';
import { requireAuth, AuthError, createVerificationToken } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';

const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
const APP_BASE_URL = process.env.APP_BASE_URL ?? 'http://localhost:3000';

export async function POST(_req: Request) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  try {
    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ success: false, error: 'Email is already verified.' }, { status: 400 });
    }

    if (
      user.emailVerificationTokenIssuedAt &&
      Date.now() - new Date(user.emailVerificationTokenIssuedAt).getTime() < RESEND_COOLDOWN_MS
    ) {
      return NextResponse.json(
        { success: false, error: 'Please wait a couple minutes before requesting another verification email.' },
        { status: 429 }
      );
    }

    const token = await createVerificationToken(String((user as any)._id));
    const verificationLink = `${APP_BASE_URL}/verify-email?token=${token}`;

    await sendVerificationEmail(user.email, verificationLink);

    user.emailVerificationTokenIssuedAt = new Date();
    await user.save();

    return NextResponse.json({ success: true, message: 'Verification email sent.' });
  } catch (error) {
    console.error('Error resending verification email:', error);
    return NextResponse.json({ success: false, error: 'Failed to resend verification email.' }, { status: 500 });
  }
}
