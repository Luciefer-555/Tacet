import { NextResponse } from 'next/server';
import { z } from 'zod';

import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/user';
import { verifyVerificationToken } from '@/lib/auth';

const verifySchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export async function POST(req: Request) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const parseResult = verifySchema.safeParse(payload);
  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: parseResult.error.issues[0]?.message ?? 'Invalid request body.' },
      { status: 400 }
    );
  }

  const { token } = parseResult.data;

  const decoded = await verifyVerificationToken(token);
  if (!decoded) {
    return NextResponse.json(
      { success: false, error: 'This verification link is invalid or has expired.' },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();

    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ success: true, message: 'Email already verified.' });
    }

    user.emailVerified = true;
    await user.save();

    return NextResponse.json({ success: true, message: 'Email verified successfully.' });
  } catch (error) {
    console.error('Error verifying email:', error);
    return NextResponse.json({ success: false, error: 'Failed to verify email.' }, { status: 500 });
  }
}
