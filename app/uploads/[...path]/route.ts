import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export const runtime = 'nodejs';

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const filePathSegments = resolvedParams.path || [];
    if (filePathSegments.length === 0) {
      return new NextResponse('Not found', { status: 404 });
    }

    // Prevent directory traversal
    const safePath = path.normalize(path.join(process.cwd(), 'uploads', ...filePathSegments));
    const uploadsRoot = path.normalize(path.join(process.cwd(), 'uploads'));

    if (!safePath.startsWith(uploadsRoot)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const stat = await fs.stat(safePath).catch(() => null);
    if (!stat || !stat.isFile()) {
      return new NextResponse('File not found', { status: 404 });
    }

    const ext = path.extname(safePath).replace('.', '').toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const fileBuffer = await fs.readFile(safePath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
      },
    });
  } catch (err) {
    console.error('Error serving upload:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
