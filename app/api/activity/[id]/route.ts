import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';

import { connectToDatabase } from '@/lib/mongodb';
import UserProgress from '@/models/userProgress';
import { requireAuth, AuthError } from '@/lib/auth';

const allowedOrigin = process.env.CORS_ORIGIN ?? '*';
const allowedHeaders = 'Content-Type, Authorization';
const allowedMethods = 'DELETE, OPTIONS';

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

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  const { id: activityId } = await context.params;

  if (!activityId) {
    return createErrorResponse('Activity ID is required.', 400);
  }

  if (!Types.ObjectId.isValid(activityId)) {
    return createErrorResponse('Invalid activity ID format.', 400);
  }

  const username = session.username;

  try {
    await connectToDatabase();

    // Ownership check: the filter matches BOTH this user's username AND the specific
    // activity _id. If the activity belongs to a different user, findOneAndUpdate
    // returns null and we respond with 404 — the caller cannot delete another user's
    // activity records even with a valid session.
    const result = await UserProgress.findOneAndUpdate(
      { username, 'recentActivity._id': new Types.ObjectId(activityId) },
      { $pull: { recentActivity: { _id: new Types.ObjectId(activityId) } } },
      { new: true }
    ).lean();

    if (!result) {
      return createErrorResponse('Activity not found or does not belong to your account.', 404);
    }

    return createJsonResponse({ success: true, data: result, message: 'Activity deleted successfully.' });
  } catch (error) {
    console.error('Error deleting activity:', error);
    return createErrorResponse('Failed to delete activity.', 500);
  }
}