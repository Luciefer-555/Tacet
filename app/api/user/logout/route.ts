import { NextResponse } from 'next/server';
import { getSession, clearSessionCookie } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/user';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getSession();
  if (session?.userId) {
    try {
      await connectToDatabase();
      await User.findByIdAndUpdate(session.userId, { $set: { loggedOutAt: new Date() } });
    } catch (err) {
      console.error('Failed to update loggedOutAt during logout:', err);
    }
  }

  const response = NextResponse.json({ success: true });
  await clearSessionCookie(response);
  return response;
}
