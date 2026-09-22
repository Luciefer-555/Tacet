import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { requireAuth, AuthError } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Class from '@/models/class';

export const runtime = 'nodejs';

function generateClassId(name: string): string {
  const cleanPrefix = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'CLASS';
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${cleanPrefix}-${suffix}`;
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireAuth(['mentor']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  try {
    const body = await request.json();
    const { name, password } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Class name is required.' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 4) {
      return NextResponse.json(
        { success: false, error: 'Class password must be at least 4 characters.' },
        { status: 400 }
      );
    }

    if (!session.collegeId) {
      return NextResponse.json(
        { success: false, error: 'Mentor must belong to a college to create classes.' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Generate unique classId
    let classId = generateClassId(name);
    let attempts = 0;
    while (await Class.findOne({ classId }) && attempts < 5) {
      classId = generateClassId(name);
      attempts++;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // QR code encodes classId only — student still enters password after scanning
    const qrCodeDataUrl = await QRCode.toDataURL(classId, {
      width: 320,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const newClass = await Class.create({
      mentorId: session.userId,
      collegeId: session.collegeId,
      name: name.trim(),
      classId,
      passwordHash,
      qrCodeDataUrl,
    });

    return NextResponse.json(
      {
        success: true,
        class: {
          id: (newClass as any)._id.toString(),
          name: newClass.name,
          classId: newClass.classId,
          collegeId: newClass.collegeId,
          qrCodeDataUrl: newClass.qrCodeDataUrl,
          createdAt: newClass.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Failed to create class:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
