import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { requireAuth, AuthError } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import Class from '@/models/class';
import ClassMembership from '@/models/classMembership';
import Problem from '@/models/problem';
import DbProblem from '@/models/dbProblem';
import Submission from '@/models/submission';
import DbSubmission from '@/models/dbSubmission';
import User from '@/models/user';
import { checkAndPromoteStudentSessions } from '@/lib/submissionGrading';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  props: { params: Promise<{ classId: string; studentId: string }> }
) {
  let session;
  try {
    session = await requireAuth(['mentor']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  const { classId: rawClassId, studentId } = await props.params;
  const classId = (rawClassId || '').trim().toUpperCase();

  await connectToDatabase();

  const classDoc = await Class.findOne({ classId });
  if (!classDoc || classDoc.mentorId.toString() !== session.userId) {
    return NextResponse.json({ success: false, error: 'Class not found or access denied.' }, { status: 403 });
  }

  // Verify student is an approved member
  const membership = await ClassMembership.findOne({
    classId: classDoc._id,
    studentId,
    status: 'approved',
  });
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Student is not an approved member of this class.' }, { status: 404 });
  }

  const studentObjectId = new mongoose.Types.ObjectId(studentId);

  // Fetch student info
  const student = await User.findById(studentId)
    .select('username email profileId branch year collegeName skills')
    .lean();

  // Opportunistic auto-promotion scoped strictly to this student in this class
  await checkAndPromoteStudentSessions({
    studentId,
    classId: (classDoc as any)._id.toString(),
  });

  // Find all problems scoped to this class
  const [classProblems, classDbProblems] = await Promise.all([
    Problem.find({ classId: classDoc._id }).select('title difficulty problemFormat gradingMode createdAt timeLimit').lean(),
    DbProblem.find({ classId: classDoc._id }).select('title difficulty dbType createdAt').lean(),
  ]);

  const problemIds = classProblems.map((p: any) => p._id);
  const dbProblemIds = classDbProblems.map((p: any) => p._id);

  // Fetch submissions scoped to class problems only
  const [submissions, dbSubmissions] = await Promise.all([
    Submission.find({ studentId: studentObjectId, problemId: { $in: problemIds } })
      .select('problemId status correctnessScore aiScore submittedAt code language autoPromoted autoPromotionReason')
      .sort({ submittedAt: -1 })
      .lean(),
    DbSubmission.find({ studentId: studentObjectId, problemId: { $in: dbProblemIds } })
      .select('problemId status passed query submittedAt')
      .sort({ submittedAt: -1 })
      .lean(),
  ]);

  // Build problem map for easy lookup
  const problemMap: Record<string, any> = {};
  for (const p of classProblems as any[]) {
    problemMap[p._id.toString()] = { title: p.title, difficulty: p.difficulty, type: 'coding', format: p.problemFormat };
  }
  for (const p of classDbProblems as any[]) {
    problemMap[p._id.toString()] = { title: p.title, difficulty: p.difficulty, type: 'database', dbType: p.dbType };
  }

  const formattedSubmissions = submissions.map((s: any) => ({
    problemId: s.problemId.toString(),
    problem: problemMap[s.problemId.toString()] || null,
    status: s.status,
    correctnessScore: s.correctnessScore,
    aiScore: s.aiScore,
    submittedAt: s.submittedAt,
    autoPromoted: Boolean(s.autoPromoted),
    autoPromotionReason: s.autoPromotionReason || null,
  }));

  const formattedDbSubmissions = dbSubmissions.map((s: any) => ({
    problemId: s.problemId.toString(),
    problem: problemMap[s.problemId.toString()] || null,
    status: s.status,
    passed: s.passed,
    submittedAt: s.submittedAt,
  }));

  return NextResponse.json({
    success: true,
    student,
    classInfo: {
      name: classDoc.name,
      classId: classDoc.classId,
    },
    totalProblems: classProblems.length + classDbProblems.length,
    totalSubmissions: submissions.length + dbSubmissions.length,
    submissions: formattedSubmissions,
    dbSubmissions: formattedDbSubmissions,
  });
}
