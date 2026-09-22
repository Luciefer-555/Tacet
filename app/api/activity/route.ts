import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';

import { connectToDatabase } from '@/lib/mongodb';
import UserProgress from '@/models/userProgress';
import { requireAuth, AuthError } from '@/lib/auth';

const allowedOrigin = process.env.CORS_ORIGIN ?? '*';
const allowedHeaders = 'Content-Type, Authorization';
const allowedMethods = 'POST, OPTIONS';

const activitySchema = z.object({
  // username is no longer accepted from the body — identity comes from session
  activityId: z.string().optional(),
  activity: z.object({
    title: z.string().min(1, 'Activity title is required'),
    time: z.string().min(1, 'Activity time is required'),
    points: z.number().int().min(0, 'Activity points must be >= 0'),
  }),
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

function getObjectId(activityId: string) {
  if (!Types.ObjectId.isValid(activityId)) {
    return null;
  }
  return new Types.ObjectId(activityId);
}

export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  return withCors(response);
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
    console.error('Invalid JSON payload for activity POST:', error);
    return createErrorResponse('Invalid JSON payload.');
  }

  const parseResult = activitySchema.safeParse(payload);
  if (!parseResult.success) {
    return createErrorResponse(parseResult.error.issues[0]?.message ?? 'Invalid request payload.');
  }

  const { activity, activityId } = parseResult.data;

  try {
    await connectToDatabase();

    if (activityId) {
      const objectId = getObjectId(activityId);

      if (!objectId) {
        return createErrorResponse('Invalid activityId format.', 400);
      }

      // Ownership is implicitly enforced: the filter includes both username and
      // the specific activity _id, so the update only succeeds if this session's
      // user actually owns that activity record.
      const updatedDocument = await UserProgress.findOneAndUpdate(
        {
          username,
          'recentActivity._id': objectId,
        },
        {
          $set: {
            'recentActivity.$.title': activity.title,
            'recentActivity.$.time': activity.time,
            'recentActivity.$.points': activity.points,
          },
        },
        { new: true }
      ).lean();

      if (!updatedDocument) {
        return createErrorResponse('Activity not found or does not belong to your account.', 404);
      }

      return createJsonResponse({ success: true, data: updatedDocument, message: 'Activity updated successfully.' });
    }

    const updatedDocument = await UserProgress.findOneAndUpdate(
      { username },
      {
        $setOnInsert: { username },
        $push: { recentActivity: activity },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    return createJsonResponse({ success: true, data: updatedDocument, message: 'Activity added successfully.' });
  } catch (error) {
    console.error('Error creating/updating activity:', error);
    return createErrorResponse('Failed to create or update activity.', 500);
  }
}