import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: {
      userId: session.userId,
      profileId: session.profileId,
      username: session.username,
      role: session.role,
      collegeId: session.collegeId,
      companyId: session.companyId,
      emailVerified: session.emailVerified,
    },
  });
}
