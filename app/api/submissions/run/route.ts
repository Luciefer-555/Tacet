import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/mongodb';
import Problem from '@/models/problem';
import { requireAuth, AuthError } from '@/lib/auth';
import { executeSnippet } from '@/lib/codeExecutor';
import { buildJavaHarness } from '@/lib/function-grading/java-harness-template';
import { compareFunctionOutput } from '@/lib/function-grading/compare-output';

export const runtime = 'nodejs';

const runSchema = z.object({
  problemId: z.string().min(1, 'problemId is required'),
  code: z.string().min(1, 'Code cannot be empty'),
});

export async function POST(req: Request) {
  let session;
  try {
    session = await requireAuth(['student']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const parseResult = runSchema.safeParse(payload);
  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: parseResult.error.issues[0]?.message ?? 'Invalid run payload.' },
      { status: 400 }
    );
  }

  const { problemId, code } = parseResult.data;

  if (!Types.ObjectId.isValid(problemId)) {
    return NextResponse.json({ success: false, error: 'Invalid problemId format.' }, { status: 400 });
  }

  await connectToDatabase();

  const problem = await Problem.findById(problemId).lean();
  if (!problem) {
    return NextResponse.json({ success: false, error: 'Problem not found.' }, { status: 404 });
  }

  // Check college restrictions for class assignments
  if ((problem as any).problemType === 'class_assignment' || (problem as any).postedByRole === 'mentor') {
    if ((problem as any).collegeId && session.collegeId !== (problem as any).collegeId.toString()) {
      return NextResponse.json(
        { success: false, error: 'This class assignment is restricted to students of the hosting college.' },
        { status: 403 }
      );
    }
  }

  const isFunctionSignature = (problem as any).gradingMode === 'function_signature';

  if (isFunctionSignature) {
    const visibleCases = ((problem as any).functionTestCases || []).filter((tc: any) => !tc.hidden);
    const results: Array<{
      inputs: Record<string, any>;
      expectedOutput: any;
      actualOutput: string;
      passed: boolean;
      time: number | null;
      memory: number | null;
      harnessSource?: string;
    }> = [];

    for (const tc of visibleCases) {
      let harnessCode: string;
      try {
        harnessCode = buildJavaHarness({
          functionName: (problem as any).functionName,
          parameters: (problem as any).parameters || [],
          returnType: (problem as any).returnType,
          studentCode: code,
          testCaseInputsJson: JSON.stringify(tc.inputs),
        });
      } catch (err: any) {
        return NextResponse.json(
          { success: false, error: `Harness generation failed: ${err.message}` },
          { status: 400 }
        );
      }

      try {
        const execRes = await executeSnippet('java', harnessCode, '');
        const passed = compareFunctionOutput((problem as any).returnType, execRes.output, tc.expectedOutput);
        results.push({
          inputs: tc.inputs,
          expectedOutput: tc.expectedOutput,
          actualOutput: execRes.output,
          passed,
          time: execRes.time,
          memory: execRes.memory,
          harnessSource: harnessCode, // Included for inspection / verification
        });
      } catch (err: any) {
        results.push({
          inputs: tc.inputs,
          expectedOutput: tc.expectedOutput,
          actualOutput: `Execution error: ${err.message}`,
          passed: false,
          time: null,
          memory: null,
          harnessSource: harnessCode,
        });
      }
    }

    // Do NOT write anything to MongoDB! Computed live only.
    const passedCases = results.filter((r) => r.passed).length;
    return NextResponse.json({
      success: true,
      testResults: results,
      results,
      passedCases,
      totalCases: results.length,
    });
  } else {
    // Standard stdin/stdout coding problem
    const visibleCases = ((problem as any).testCases || []).filter((tc: any) => !tc.hidden);
    const results: Array<{
      input: string;
      expectedOutput: string;
      actualOutput: string;
      passed: boolean;
      time: number | null;
      memory: number | null;
    }> = [];

    const language = (problem as any).language || 'python';

    for (const tc of visibleCases) {
      try {
        const execRes = await executeSnippet(language, code, tc.input ?? '');
        const passed = execRes.output === (tc.expectedOutput ?? '').trimEnd();
        results.push({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: execRes.output,
          passed,
          time: execRes.time,
          memory: execRes.memory,
        });
      } catch (err: any) {
        results.push({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: `Execution error: ${err.message}`,
          passed: false,
          time: null,
          memory: null,
        });
      }
    }

    // Do NOT write anything to MongoDB!
    const passedCases = results.filter((r) => r.passed).length;
    return NextResponse.json({
      success: true,
      testResults: results,
      results,
      passedCases,
      totalCases: results.length,
    });
  }
}
