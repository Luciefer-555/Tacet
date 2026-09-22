import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { connectToDatabase } from '@/lib/mongodb';
import Submission from '@/models/submission';
import Problem from '@/models/problem';
import TestSession from '@/models/testSession';
import ClassMembership from '@/models/classMembership';
import { requireAuth, AuthError } from '@/lib/auth';
import { syncSubmission } from '@/lib/graphSync';
import { ALLOWED_UPLOAD_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES, hasValidUploadSignature } from '@/lib/uploadSecurity';

const RANKING_SERVICE_URL = process.env.RANKING_SERVICE_URL ?? 'http://localhost:8001';
const PISTON_URL = 'https://emkc.org/api/v2/piston/execute';
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'submissions');
const ALLOWED_FILE_TYPES: string[] = [...ALLOWED_UPLOAD_EXTENSIONS];
const MAX_FILE_SIZE_BYTES = MAX_UPLOAD_SIZE_BYTES;

const textOnlySchema = z.object({
  problemId: z.string().min(1, 'problemId is required'),
  content: z.string().trim().min(1, 'Submission content cannot be empty'),
});

import { executeSnippet } from '@/lib/codeExecutor';
import { buildJavaHarness } from '@/lib/function-grading/java-harness-template';
import { compareFunctionOutput } from '@/lib/function-grading/compare-output';
import { gradeAndCreateCodingSubmission } from '@/lib/submissionGrading';

const codingSchema = z.object({
  problemId: z.string().min(1, 'problemId is required'),
  code: z.string().min(1, 'Code cannot be empty'),
  language: z.enum(['python', 'java', 'c', 'cpp'], { errorMap: () => ({ message: 'Language must be python, java, c, or cpp.' }) }).optional(),
});

function getVariantIdForStudent(studentId: string, problemId: string, variants: any[]): string | null {
  const validVariants = (variants || []).filter((v) => !v.generationFailed);
  if (validVariants.length === 0) return null;
  const hash = crypto.createHash('sha256').update(`${studentId}:${problemId}`).digest('hex');
  const index = parseInt(hash.slice(0, 8), 16) % validVariants.length;
  return validVariants[index].variantId;
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAuth(['student']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  const contentType = req.headers.get('content-type') || '';

  let problemId: string;
  let content = '';
  let fileUrl: string | null = null;
  let fileType: string | null = null;
  let extractedContent: string | null = null;
  let codeFromPayload: string | null = null;
  let languageFromPayload: string | null = null;

  try {
    await connectToDatabase();

    if (contentType.includes('multipart/form-data')) {
      // ── File upload path ──────────────────────────────────────────────
      const formData = await req.formData();
      const problemIdField = formData.get('problemId');
      const file = formData.get('file') as File | null;

      if (!problemIdField || typeof problemIdField !== 'string') {
        return NextResponse.json({ success: false, error: 'problemId is required.' }, { status: 400 });
      }
      problemId = problemIdField;

      if (!file) {
        return NextResponse.json({ success: false, error: 'No file provided.' }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ success: false, error: 'File exceeds 15MB limit.' }, { status: 400 });
      }

      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_FILE_TYPES.includes(ext)) {
        return NextResponse.json(
          { success: false, error: `Unsupported file type: ${ext}. Allowed: ${ALLOWED_FILE_TYPES.join(', ')}` },
          { status: 400 }
        );
      }
      fileType = ext;

      const buffer = Buffer.from(await file.arrayBuffer());
      if (!hasValidUploadSignature(buffer, ext)) {
        return NextResponse.json({ success: false, error: 'File contents do not match the file extension.' }, { status: 400 });
      }

      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      const savedFilename = `${session.userId}_${Date.now()}.${ext}`;
      const savedPath = path.join(UPLOAD_DIR, savedFilename);
      await fs.writeFile(savedPath, buffer);
      fileUrl = `/uploads/submissions/${savedFilename}`;

      // Call Sand Flea to extract content from the file
      const extractFormData = new FormData();
      extractFormData.append('file', new Blob([buffer]), file.name);
      extractFormData.append('file_type', ext);

      const extractResponse = await fetch(`${RANKING_SERVICE_URL}/extract-document`, {
        method: 'POST',
        body: extractFormData,
      });

      if (!extractResponse.ok) {
        return NextResponse.json(
          { success: false, error: 'Document extraction service failed.' },
          { status: 502 }
        );
      }

      const extractResult = await extractResponse.json();
      extractedContent = extractResult.extractedText;
      content = extractedContent ?? ''; // Seashell scores extractedContent as the effective "content"
    } else {
      // ── JSON path: try coding schema first, fall back to text-only ────
      let payload: any;
      try {
        payload = await req.json();
      } catch {
        return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
      }

      if (!payload.problemId || typeof payload.problemId !== 'string') {
        return NextResponse.json(
          { success: false, error: 'problemId is required.' },
          { status: 400 }
        );
      }
      problemId = payload.problemId;

      if (payload.code !== undefined) {
        // Coding submission path
        const parseResult = codingSchema.safeParse(payload);
        if (!parseResult.success) {
          return NextResponse.json(
            { success: false, error: parseResult.error.issues[0]?.message ?? 'Invalid coding submission.' },
            { status: 400 }
          );
        }
        codeFromPayload = parseResult.data.code;
        languageFromPayload = parseResult.data.language ?? null;
      } else {
        // Text-only submission path
        const parseResult = textOnlySchema.safeParse(payload);
        if (!parseResult.success) {
          return NextResponse.json(
            { success: false, error: parseResult.error.issues[0]?.message ?? 'Invalid request body.' },
            { status: 400 }
          );
        }
        content = parseResult.data.content;
      }
    }

    if (!Types.ObjectId.isValid(problemId)) {
      return NextResponse.json({ success: false, error: 'Invalid problemId format.' }, { status: 400 });
    }

    const problem = await Problem.findById(problemId).lean();
    if (!problem) {
      return NextResponse.json({ success: false, error: 'Problem not found.' }, { status: 404 });
    }
    if ((problem as any).status !== 'open') {
      return NextResponse.json({ success: false, error: 'This problem is not open for submissions.' }, { status: 400 });
    }

    // Option A: Class assignments are restricted to students belonging to the mentor's college
    if ((problem as any).problemType === 'class_assignment' || (problem as any).postedByRole === 'mentor') {
      if ((problem as any).collegeId && session.collegeId !== (problem as any).collegeId) {
        return NextResponse.json(
          { success: false, error: 'This class assignment is restricted to students of the hosting college.' },
          { status: 403 }
        );
      }
    }

    // Class-scoped membership enforcement
    if ((problem as any).classId) {
      const membership = await ClassMembership.findOne({
        classId: (problem as any).classId,
        studentId: session.userId,
        status: 'approved',
      });
      if (!membership) {
        return NextResponse.json(
          { success: false, error: 'You must be an approved member of the class to submit.' },
          { status: 403 }
        );
      }
    }

    // Timed test deadline enforcement — server is source of truth
    // ponytail: 60s grace window is hardcoded; upgrade path: configurable per-problem grace
    const GRACE_PERIOD_MS = 60_000;
    if ((problem as any).timeLimit) {
      const testSession = await TestSession.findOne({
        problemId,
        studentId: session.userId,
      });
      if (!testSession) {
        return NextResponse.json(
          { success: false, error: 'You must start the timed test before submitting.' },
          { status: 400 }
        );
      }
      if (testSession.status === 'submitted') {
        return NextResponse.json(
          { success: false, error: 'You have already submitted this timed test.' },
          { status: 409 }
        );
      }
      const serverDeadlineMs = new Date(testSession.startedAt).getTime() + testSession.timeLimitMinutes * 60 * 1000;
      const nowMs = Date.now();
      if (nowMs > serverDeadlineMs + GRACE_PERIOD_MS) {
        // Past the grace window — reject and mark expired
        testSession.status = 'expired';
        await testSession.save();
        return NextResponse.json(
          { success: false, error: 'Time limit exceeded. Your test session has expired.' },
          { status: 403 }
        );
      }
      // Mark test session as submitted
      testSession.status = 'submitted';
      testSession.submittedAt = new Date();
      await testSession.save();
    }

    const isCoding = (problem as any).problemFormat === 'coding';

    // ── Coding submission path ────────────────────────────────────────
    if (isCoding) {
      if (fileUrl) {
        return NextResponse.json(
          { success: false, error: 'Coding problems require code submission, not file uploads.' },
          { status: 400 }
        );
      }

      if (!codeFromPayload) {
        return NextResponse.json(
          { success: false, error: 'Coding problems require a code field in the submission.' },
          { status: 400 }
        );
      }

      const submittedCode = codeFromPayload;
      const submittedLanguage = languageFromPayload || (problem as any).language;

      if ((problem as any).language && submittedLanguage !== (problem as any).language) {
        return NextResponse.json(
          { success: false, error: `This problem requires submissions in ${(problem as any).language}.` },
          { status: 400 }
        );
      }

      let gradedResult;
      try {
        gradedResult = await gradeAndCreateCodingSubmission({
          problem,
          studentId: session.userId,
          code: submittedCode,
          language: submittedLanguage,
        });
      } catch (err: any) {
        if (err?.code === 11000) {
          return NextResponse.json(
            { success: false, error: 'You have already submitted to this problem.' },
            { status: 409 }
          );
        }
        throw err;
      }

      const {
        submission,
        testResults,
        correctnessScore,
        correctnessGatePassed,
        passedCases,
        totalCases,
      } = gradedResult;

      // Strip hidden test case details from student response
      const safeTestResults = testResults.map(r =>
        r.hidden
          ? { passed: r.passed, hidden: true }
          : { input: r.input, expectedOutput: r.expectedOutput, actualOutput: r.actualOutput, passed: r.passed, hidden: false }
      );

      return NextResponse.json({
        success: true,
        submission: {
          ...submission.toObject(),
          testResults: safeTestResults,
        },
        testResults: safeTestResults,
        correctnessScore,
        correctnessGatePassed,
        passedCases,
        totalCases,
      }, { status: 201 });
    }

    // ── Open-ended submission path (unchanged) ─────────────────────────
    const problemVariantId = getVariantIdForStudent(session.userId, problemId, (problem as any).variants);

    let submission;
    try {
      submission = await Submission.create({
        problemId,
        studentId: session.userId,
        content,
        fileUrl,
        fileType,
        extractedContent,
        problemVariantId,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        return NextResponse.json(
          { success: false, error: 'You have already submitted to this problem.' },
          { status: 409 }
        );
      }
      throw err;
    }

    syncSubmission({
      id: String((submission as any)._id),
      studentId: session.userId,
      problemId,
      aiScore: null,
      rank: null,
      submittedAt: submission.submittedAt,
    }).catch((err: unknown) => {
      console.error('Neo4j graph sync failed for submission:', err);
    });

    return NextResponse.json({ success: true, submission }, { status: 201 });
  } catch (error) {
    console.error('Error creating submission:', error);
    return NextResponse.json({ success: false, error: 'Failed to create submission.' }, { status: 500 });
  }
}
