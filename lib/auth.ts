import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import User from '@/models/user';
import { AUTH_COOKIE_NAME } from '@/lib/constants/auth';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is missing.');
  }
  return new TextEncoder().encode(secret);
}
export const COOKIE_NAME = AUTH_COOKIE_NAME;
const SESSION_DURATION = '7d';

export interface SessionPayload {
  userId: string;
  profileId: string;
  username: string;
  role: 'student' | 'hiring_manager' | 'mentor' | 'admin';
  emailVerified?: boolean;
  companyId?: string;
  collegeId?: string;
  iat?: number;
}

interface VerificationTokenPayload {
  userId: string;
  purpose: 'email_verification';
}

export async function createVerificationToken(userId: string): Promise<string> {
  const token = await new SignJWT({ userId, purpose: 'email_verification' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getJwtSecret());
  return token;
}

export async function verifyVerificationToken(token: string): Promise<VerificationTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (payload.purpose !== 'email_verification') return null;
    return payload as unknown as VerificationTokenPayload;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getJwtSecret());
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const session = payload as unknown as SessionPayload;
    if (session.userId && session.iat) {
      await connectToDatabase();
      const user = (await User.findById(session.userId).select('loggedOutAt').lean()) as any;
      if (user?.loggedOutAt) {
        const loggedOutTime = new Date(user.loggedOutAt).getTime();
        const tokenIssuedTime = session.iat * 1000;
        if (tokenIssuedTime < loggedOutTime) {
          return null;
        }
      }
    }
    return session;
  } catch {
    return null;
  }
}

export async function clearSessionCookie(response?: any): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  if (response?.cookies) {
    response.cookies.set(COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  }
}

export class AuthError extends Response {
  constructor(status: 401 | 403, message: string) {
    super(JSON.stringify({ success: false, error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function requireAuth(
  allowedRoles?: SessionPayload['role'][]
): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError(401, 'Not authenticated');
  }
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    throw new AuthError(403, 'Insufficient permissions');
  }
  return session;
}