import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { connectToDatabase } from '@/lib/mongodb';
import Submission from '@/models/submission';
import Problem from '@/models/problem';
import { requireAuth, AuthError } from '@/lib/auth';

export const runtime = 'nodejs';
const MIME_TYPES: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const INLINE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'pdf']);
const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const ALLOWED_DIRECTORIES = new Set(['company-logos', 'submissions']);
const FILENAME_PATTERN = /^[A-Za-z0-9_.-]+$/;
type SubmissionLookup = { studentId?: string | { toString(): string }; problemId?: unknown };
type ProblemLookup = { companyId?: string; postedBy?: string | { toString(): string }; collegeId?: string };

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  let session;
  try { session = await requireAuth(); } catch (err) { if (err instanceof AuthError) return err; throw err; }
  try {
    const segments = (await params).path || [];
    if (segments.length !== 2) return new NextResponse('Bad request', { status: 400 });
    const [sub, name] = segments;
    if (!ALLOWED_DIRECTORIES.has(sub) || !name || name.includes('..') || name.includes('%') || name.includes('\\') || name.includes('/') || name.includes('\0') || name.startsWith('/') || !FILENAME_PATTERN.test(name)) {
      return new NextResponse('Bad request', { status: 400 });
    }
    const ext = path.extname(name).slice(1).toLowerCase();
    const contentType = MIME_TYPES[ext];
    if (!contentType) return new NextResponse('Bad request', { status: 400 });
    const resolved = path.resolve(UPLOAD_ROOT, sub, name);
    if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) return new NextResponse('Bad request', { status: 400 });
    const stat = await fs.stat(resolved).catch(() => null);
    if (!stat?.isFile()) return new NextResponse('Not found', { status: 404 });
    const [realRoot, realPath] = await Promise.all([fs.realpath(UPLOAD_ROOT).catch(() => null), fs.realpath(resolved).catch(() => null)]);
    if (!realRoot || !realPath || !realPath.startsWith(realRoot + path.sep)) return new NextResponse('Not found', { status: 404 });
    if (sub === 'submissions') {
      await connectToDatabase();
      const submission = await Submission.findOne({ fileUrl: `/uploads/submissions/${name}` }).lean() as unknown as SubmissionLookup | null;
      const problem = submission ? await Problem.findById(submission.problemId).lean() as unknown as ProblemLookup | null : null;
      const isSubmitter = submission?.studentId?.toString() === session.userId;
      const isHiringManager = session.role === 'hiring_manager' && problem?.companyId === session.companyId;
      const isMentor = session.role === 'mentor' && problem?.postedBy?.toString() === session.userId && problem?.collegeId === session.collegeId;
      if (!submission || (!isSubmitter && !isHiringManager && !isMentor)) return new NextResponse('Not found', { status: 404 });
    }
    return new NextResponse(await fs.readFile(realPath), {
      status: 200,
      headers: {
        'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox',
        'Cache-Control': sub === 'submissions' ? 'private, no-store' : 'private, max-age=300',
        'Content-Disposition': `${INLINE_EXTENSIONS.has(ext) ? 'inline' : 'attachment'}; filename="${name}"`,
      },
    });
  } catch (err) {
    console.error('Error serving upload:', err instanceof Error ? err.message : 'unknown error');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
