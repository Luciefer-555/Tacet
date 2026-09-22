import { NextResponse } from 'next/server';
import { z } from 'zod';

import { connectToDatabase } from '@/lib/mongodb';
import UserProgress from '@/models/userProgress';
import { requireAuth, AuthError } from '@/lib/auth';

const allowedOrigin = process.env.CORS_ORIGIN ?? '*';
const allowedHeaders = 'Content-Type, Authorization';
const allowedMethods = 'GET, POST, OPTIONS';

const progressSchema = z.object({
  // username is no longer accepted from the body — identity comes from session
  problemsSolved: z.number().int().min(0).optional(),
  streakDays: z.number().int().min(0).optional(),
  hackathons: z.number().int().min(0).optional(),
  collaborations: z.number().int().min(0).optional(),
});

function withCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Methods', allowedMethods);
  response.headers.set('Access-Control-Allow-Headers', allowedHeaders);
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

function createJsonResponse<T>(data: T, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  return withCors(response);
}

function createErrorResponse(message: string, status = 400) {
  return createJsonResponse({ success: false, error: message }, { status });
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  return withCors(response);
}

export async function GET(request: Request) {
  // GET /api/progress is private — a user may only read their OWN progress.
  // Previously it accepted ?username= from query which allowed anyone to read
  // any user's stats by passing a different username. Session enforces ownership.
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  const username = session.username;

  try {
    await connectToDatabase();

    const progress = await UserProgress.findOne({ username }).lean();

    if (!progress) {
      return createJsonResponse({
        success: true,
        data: {
          username,
          problemsSolved: 0,
          streakDays: 0,
          hackathons: 0,
          collaborations: 0,
          recentActivity: [],
        },
        message: 'No progress found. Returning defaults.',
      });
    }

    return createJsonResponse({ success: true, data: progress });
  } catch (error) {
    console.error('Error fetching progress:', error);
    return createErrorResponse('Failed to fetch user progress.', 500);
  }
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  const username = session.username;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.error('Invalid JSON payload for progress POST:', error);
    return createErrorResponse('Invalid JSON payload.');
  }

  const parseResult = progressSchema.safeParse(payload);
  if (!parseResult.success) {
    return createErrorResponse(parseResult.error.issues[0]?.message ?? 'Invalid request payload.');
  }

  const { problemsSolved, streakDays, hackathons, collaborations } = parseResult.data;

  try {
    await connectToDatabase();

    const updateFields: Record<string, unknown> = {};
    if (typeof problemsSolved === 'number') updateFields.problemsSolved = problemsSolved;
    if (typeof streakDays === 'number') updateFields.streakDays = streakDays;
    if (typeof hackathons === 'number') updateFields.hackathons = hackathons;
    if (typeof collaborations === 'number') updateFields.collaborations = collaborations;

    const updatedProgress = await UserProgress.findOneAndUpdate(
      { username },
      {
        $set: updateFields,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    return createJsonResponse({ success: true, data: updatedProgress });
  } catch (error) {
    console.error('Error updating progress:', error);
    return createErrorResponse('Failed to update user progress.', 500);
  }
}