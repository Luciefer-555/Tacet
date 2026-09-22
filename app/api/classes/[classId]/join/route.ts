import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth, AuthError } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Class from '@/models/class';
import ClassMembership from '@/models/classMembership';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  props: { params: Promise<{ classId: string }> }
) {
  let session;
  try {
    session = await requireAuth(['student']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  const { classId: rawClassId } = await props.params;
  const classId = (rawClassId || '').trim().toUpperCase();

  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ success: false, error: 'Class password is required.' }, { status: 400 });
    }

    await connectToDatabase();

    const classDoc = await Class.findOne({ classId }).select('+passwordHash');
    if (!classDoc) {
      return NextResponse.json({ success: false, error: 'Class not found.' }, { status: 404 });
    }

    // College restriction: student must belong to the same college as the mentor's class
    if (classDoc.collegeId && session.collegeId !== classDoc.collegeId) {
      return NextResponse.json(
        {
          success: false,
          error: 'This class is restricted to students of the hosting institution.',
        },
        { status: 403 }
      );
    }

    // Verify password — do NOT create pending record on failure
    const isValidPassword = await bcrypt.compare(password, classDoc.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json({ success: false, error: 'Invalid class password.' }, { status: 400 });
    }

    // Check existing membership
    const existing = await ClassMembership.findOne({
      classId: classDoc._id,
      studentId: session.userId,
    });

    if (existing) {
      if (existing.status === 'approved') {
        return NextResponse.json({
          success: true,
          status: 'approved',
          message: 'You are already an approved member of this class.',
        });
      }
      if (existing.status === 'pending') {
        return NextResponse.json({
          success: true,
          status: 'pending',
          message: 'Your join request is already pending mentor approval.',
        });
      }
      // If previously rejected, allow re-requesting
      existing.status = 'pending';
      existing.requestedAt = new Date();
      existing.decidedAt = undefined;
      await existing.save();

      return NextResponse.json({
        success: true,
        status: 'pending',
        message: 'Join request re-submitted. Awaiting mentor approval.',
      });
    }

    // Create new pending membership
    await ClassMembership.create({
      classId: classDoc._id,
      studentId: session.userId,
      status: 'pending',
      requestedAt: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        status: 'pending',
        message: 'Join request submitted. Awaiting mentor approval.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Failed to join class:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
