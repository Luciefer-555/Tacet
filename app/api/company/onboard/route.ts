import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { connectToDatabase } from '@/lib/mongodb';
import Company from '@/models/company';
import { requireAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'company-logos');
const ALLOWED_IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAuth(['hiring_manager']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  if (!session.companyId) {
    return NextResponse.json(
      { success: false, error: 'No companyId found on session.' },
      { status: 400 }
    );
  }

  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { success: false, error: 'Request must be multipart/form-data with company logo.' },
      { status: 400 }
    );
  }

  const formData = await req.formData();
  const name = formData.get('name');
  const website = formData.get('website');
  const description = formData.get('description');
  const logoFile = formData.get('logo') as File | null;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json(
      { success: false, error: 'Company name is required.' },
      { status: 400 }
    );
  }

  if (!logoFile) {
    return NextResponse.json(
      { success: false, error: 'Company logo upload is required.' },
      { status: 400 }
    );
  }

  if (logoFile.size > MAX_LOGO_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Logo file exceeds the 5MB size limit.' },
      { status: 400 }
    );
  }

  const ext = (logoFile.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(ext)) {
    return NextResponse.json(
      {
        success: false,
        error: `Unsupported logo image format: .${ext}. Allowed formats: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      },
      { status: 400 }
    );
  }

  await connectToDatabase();

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const sanitizedFilename = `${session.userId}_${Date.now()}.${ext}`;
  const savedFilePath = path.join(UPLOAD_DIR, sanitizedFilename);
  const buffer = Buffer.from(await logoFile.arrayBuffer());
  await fs.writeFile(savedFilePath, buffer);
  const logoUrl = `/uploads/company-logos/${sanitizedFilename}`;

  const company = await Company.findOneAndUpdate(
    { companyId: session.companyId },
    {
      companyId: session.companyId,
      name: name.trim(),
      logoUrl,
      website: typeof website === 'string' && website.trim() ? website.trim() : null,
      description: typeof description === 'string' && description.trim() ? description.trim() : null,
      createdBy: session.userId,
      createdAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json(
    {
      success: true,
      company,
    },
    { status: 201 }
  );
}
