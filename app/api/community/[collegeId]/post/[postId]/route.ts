import { NextRequest, NextResponse } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import CollegeCommunity from '@/models/collegeCommunity';
import { requireAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ collegeId: string; postId: string }> }
) {
  let session;
  try {
    session = await requireAuth();
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  if (session.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: 'Only admins can delete posts' },
      { status: 403 }
    );
  }

  try {
    const { collegeId, postId } = await context.params;

    await connectToDatabase();

    const community = await CollegeCommunity.findOne({ collegeId });
    if (!community) {
      return NextResponse.json(
        { success: false, error: 'Community not found' },
        { status: 404 }
      );
    }

    const initialLength = community.posts.length;
    community.posts = community.posts.filter(post => post.postId !== postId);

    if (community.posts.length === initialLength) {
      return NextResponse.json(
        { success: false, error: 'Post not found' },
        { status: 404 }
      );
    }

    await community.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete post' },
      { status: 500 }
    );
  }
}