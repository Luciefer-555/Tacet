import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { connectToDatabase } from '@/lib/mongodb';
import CollegeCommunity from '@/models/collegeCommunity';

export const runtime = 'nodejs';

const deleteSchema = z.object({
  requesterRole: z.enum(['admin', 'mentor', 'student']).default('student'),
});

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ collegeId: string; postId: string }> }
) {
  try {
    const { collegeId, postId } = await context.params;

    const parseResult = deleteSchema.safeParse({
      requesterRole: request.headers.get('x-syncin-role') ?? 'student',
    });

    const { requesterRole } = parseResult.success
      ? parseResult.data
      : { requesterRole: 'student' };

    if (requesterRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only admins can delete posts' },
        { status: 403 }
      );
    }

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
