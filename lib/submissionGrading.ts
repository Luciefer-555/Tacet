import crypto from 'crypto';
import mongoose from 'mongoose';
import Problem, { ProblemDocument } from '@/models/problem';
import Submission from '@/models/submission';
import TestSession, { ITestSession } from '@/models/testSession';
import { executeSnippet } from '@/lib/codeExecutor';
import { buildJavaHarness } from '@/lib/function-grading/java-harness-template';
import { compareFunctionOutput } from '@/lib/function-grading/compare-output';
import { syncSubmission } from '@/lib/graphSync';

export const AUTO_PROMOTION_MESSAGE =
  'Your test was auto-submitted from your last saved draft after your connection was lost';

export function getVariantIdForStudent(
  studentId: string,
  problemId: string,
  variants: any[]
): string | null {
  const validVariants = (variants || []).filter((v) => !v.generationFailed);
  if (validVariants.length === 0) return null;
  const hash = crypto.createHash('sha256').update(`${studentId}:${problemId}`).digest('hex');
  const index = parseInt(hash.slice(0, 8), 16) % validVariants.length;
  return validVariants[index].variantId;
}

export interface GradeSubmissionParams {
  problem: ProblemDocument | any;
  studentId: string;
  code: string;
  language?: string | null;
  autoPromoted?: boolean;
  autoPromotionReason?: string | null;
}

export async function gradeAndCreateCodingSubmission({
  problem,
  studentId,
  code,
  language,
  autoPromoted = false,
  autoPromotionReason = null,
}: GradeSubmissionParams) {
  const submittedCode = code;
  const submittedLanguage = language || problem.language || 'python';
  const problemId = problem._id.toString();

  // Run code against test cases
  const testResults: Array<{
    input: string;
    expectedOutput: string;
    actualOutput: string;
    passed: boolean;
    hidden: boolean;
    time: number | null;
    memory: number | null;
  }> = [];

  const isFunctionSignature = problem.gradingMode === 'function_signature';

  if (isFunctionSignature) {
    for (const tc of problem.functionTestCases || []) {
      const harnessCode = buildJavaHarness({
        functionName: problem.functionName,
        parameters: problem.parameters || [],
        returnType: problem.returnType,
        studentCode: submittedCode,
        testCaseInputsJson: JSON.stringify(tc.inputs),
      });

      const execRes = await executeSnippet('java', harnessCode, '');
      const passed = compareFunctionOutput(problem.returnType, execRes.output, tc.expectedOutput);

      testResults.push({
        input: JSON.stringify(tc.inputs),
        expectedOutput: JSON.stringify(tc.expectedOutput),
        actualOutput: execRes.output,
        passed,
        hidden: tc.hidden ?? false,
        time: execRes.time,
        memory: execRes.memory,
      });
    }
  } else {
    for (const tc of problem.testCases || []) {
      const execRes = await executeSnippet(submittedLanguage, submittedCode, tc.input ?? '');
      const actualOutput = execRes.output;
      const passed = actualOutput === (tc.expectedOutput ?? '').trimEnd();

      testResults.push({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        actualOutput,
        passed,
        hidden: tc.hidden ?? false,
        time: execRes.time,
        memory: execRes.memory,
      });
    }
  }

  const totalCases = testResults.length;
  const passedCases = testResults.filter((r) => r.passed).length;
  const correctnessScore = totalCases > 0 ? passedCases / totalCases : 0;
  const correctnessGatePassed = correctnessScore === 1;

  const problemVariantId = getVariantIdForStudent(studentId, problemId, problem.variants);

  const submission = await Submission.create({
    problemId: new mongoose.Types.ObjectId(problemId),
    studentId: new mongoose.Types.ObjectId(studentId),
    code: submittedCode,
    language: submittedLanguage,
    testResults,
    correctnessScore,
    correctnessGatePassed,
    status: correctnessGatePassed ? 'submitted' : 'failed_gate',
    problemVariantId,
    autoPromoted,
    autoPromotionReason: autoPromoted ? (autoPromotionReason || AUTO_PROMOTION_MESSAGE) : null,
  });

  // Async Neo4j graph sync (best effort)
  syncSubmission({
    id: String(submission._id),
    studentId,
    problemId,
    aiScore: null,
    rank: null,
    submittedAt: submission.submittedAt,
  }).catch((err: unknown) => {
    console.error('Neo4j graph sync failed for submission:', err);
  });

  return {
    submission,
    testResults,
    correctnessScore,
    correctnessGatePassed,
    passedCases,
    totalCases,
  };
}

/**
 * Evaluates a single TestSession document for auto-promotion.
 * Condition: now > deadline + 5 minutes AND status === 'active'.
 */
export async function autoPromoteTestSession(testSession: ITestSession) {
  if (testSession.status !== 'active') {
    return { promoted: false, status: testSession.status };
  }

  const deadlineMs =
    new Date(testSession.startedAt).getTime() + testSession.timeLimitMinutes * 60 * 1000;
  const promotionThresholdMs = deadlineMs + 5 * 60 * 1000; // deadline + 5 minutes
  const now = Date.now();

  if (now <= promotionThresholdMs) {
    // Has not reached deadline + 5 minutes yet
    return { promoted: false, status: 'active', remainingBeforePromotionMs: promotionThresholdMs - now };
  }

  // If no autosaved draft exists at all, mark expired without creating a submission
  if (!testSession.draftCode || !testSession.draftCode.trim()) {
    testSession.status = 'expired';
    await testSession.save();
    return { promoted: false, status: 'expired', reason: 'No autosave draft was recorded' };
  }

  // Load problem details
  const problem = await Problem.findById(testSession.problemId);
  if (!problem) {
    testSession.status = 'expired';
    await testSession.save();
    return { promoted: false, status: 'expired', error: 'Problem not found' };
  }

  // Check if a submission already exists for this problem + student (idempotency guard)
  const existingSub = await Submission.findOne({
    problemId: testSession.problemId,
    studentId: testSession.studentId,
  });

  if (existingSub) {
    testSession.status = 'submitted';
    testSession.submissionId = existingSub._id as any;
    await testSession.save();
    return { promoted: false, status: 'submitted', submission: existingSub };
  }

  // Grade and create submission using the identical pipeline
  const { submission } = await gradeAndCreateCodingSubmission({
    problem,
    studentId: testSession.studentId.toString(),
    code: testSession.draftCode,
    language: problem.language || 'python',
    autoPromoted: true,
    autoPromotionReason: AUTO_PROMOTION_MESSAGE,
  });

  testSession.status = 'submitted';
  testSession.autoPromoted = true;
  testSession.autoPromotedAt = new Date();
  testSession.submissionId = submission._id as any;
  testSession.submittedAt = new Date();
  await testSession.save();

  return {
    promoted: true,
    status: 'submitted',
    submission,
    testSession,
  };
}

/**
 * Opportunistic check for a student's active test sessions.
 * Can be strictly scoped to a specific problem and/or class.
 */
export async function checkAndPromoteStudentSessions({
  studentId,
  problemId,
  classId,
}: {
  studentId: string;
  problemId?: string;
  classId?: string;
}) {
  const query: Record<string, any> = {
    studentId: new mongoose.Types.ObjectId(studentId),
    status: 'active',
  };

  if (problemId) {
    query.problemId = new mongoose.Types.ObjectId(problemId);
  }
  if (classId) {
    query.classId = new mongoose.Types.ObjectId(classId);
  }

  const activeSessions = await TestSession.find(query);
  const results = [];

  for (const session of activeSessions) {
    const outcome = await autoPromoteTestSession(session);
    results.push(outcome);
  }

  return results;
}
