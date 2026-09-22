import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Problem from '@/models/problem';
import DbProblem from '@/models/dbProblem';
import Submission from '@/models/submission';
import DbSubmission from '@/models/dbSubmission';
import { requireAuth, AuthError } from '@/lib/auth';
import Company from '@/models/company';
import Class from '@/models/class';
import { getStudentProblemScope } from '@/lib/studentProblemVisibility';

export const runtime = 'nodejs';

export async function GET() {
  let session;
  try {
    session = await requireAuth(['student', 'hiring_manager', 'mentor']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  await connectToDatabase();

  if (session.role === 'student') {
    const scope = await getStudentProblemScope(session.userId, session.collegeId);
    const [standardProblems, dbProblems] = await Promise.all([
      Problem.find(scope).select('title problemFormat companyId classId createdAt').sort({ createdAt: -1 }).lean(),
      DbProblem.find(scope).select('title dbType companyId classId createdAt').sort({ createdAt: -1 }).lean(),
    ]);
    const companyIds = [...standardProblems, ...dbProblems].map((problem) => problem.companyId).filter(Boolean);
    const classIds = [...standardProblems, ...dbProblems].map((problem) => problem.classId).filter(Boolean);
    const [companies, classes] = await Promise.all([
      Company.find({ companyId: { $in: companyIds } }).select('companyId name').lean(),
      Class.find({ _id: { $in: classIds } }).select('name').lean(),
    ]);
    const companyNames = new Map(companies.map((company) => [company.companyId, company.name]));
    const classNames = new Map(classes.map((classDoc) => [classDoc._id.toString(), classDoc.name]));
    const problems = [
      ...standardProblems.map((problem) => ({
        id: String(problem._id),
        title: problem.title,
        format: problem.problemFormat || 'open_ended',
        companyName: problem.companyId ? companyNames.get(problem.companyId) ?? null : null,
        className: problem.classId ? classNames.get(problem.classId.toString()) ?? null : null,
        postedAt: problem.createdAt,
      })),
      ...dbProblems.map((problem) => ({
        id: String(problem._id),
        title: problem.title,
        format: problem.dbType === 'sql' ? 'sql' : 'mongodb',
        companyName: problem.companyId ? companyNames.get(problem.companyId) ?? null : null,
        className: problem.classId ? classNames.get(problem.classId.toString()) ?? null : null,
        postedAt: problem.createdAt,
      })),
    ].sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
    return NextResponse.json({ success: true, problems });
  }

  let filter: Record<string, any> = {};
  if (session.role === 'hiring_manager') {
    if (!session.companyId) {
      return NextResponse.json({ success: true, problems: [] });
    }
    filter = { companyId: session.companyId };
  } else if (session.role === 'mentor') {
    if (!session.collegeId) {
      return NextResponse.json({ success: true, problems: [] });
    }
    filter = { collegeId: session.collegeId };
  }

  // Fetch standard and database problems in parallel
  const [stdProblems, dbProblems] = (await Promise.all([
    Problem.find(filter).sort({ createdAt: -1 }).lean(),
    DbProblem.find(filter).sort({ createdAt: -1 }).lean(),
  ])) as [any[], any[]];

  const stdIds = stdProblems.map((p) => p._id.toString());
  const dbIds = dbProblems.map((p) => p._id.toString());

  // Aggregate submission counts cheaply in two grouped queries
  const [stdCounts, dbCounts] = await Promise.all([
    stdIds.length > 0
      ? Submission.aggregate([
          { $match: { problemId: { $in: stdIds } } },
          { $group: { _id: '$problemId', count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
    dbIds.length > 0
      ? DbSubmission.aggregate([
          { $match: { problemId: { $in: dbIds } } },
          { $group: { _id: '$problemId', count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ]);

  const countMap: Record<string, number> = {};
  for (const c of stdCounts) {
    if (c._id) countMap[String(c._id)] = c.count;
  }
  for (const c of dbCounts) {
    if (c._id) countMap[String(c._id)] = c.count;
  }

  const items = [
    ...stdProblems.map((p) => ({
      id: p._id.toString(),
      title: p.title,
      description: p.description,
      format: p.problemFormat || 'open_ended',
      gradingMode: p.gradingMode || (p.problemFormat === 'coding' ? 'stdin_stdout' : null),
      language: p.language || null,
      difficulty: p.difficulty || 'Medium',
      status: p.status || 'open',
      submissionCount: countMap[p._id.toString()] || 0,
      isDbProblem: false,
      createdAt: p.createdAt,
    })),
    ...dbProblems.map((p) => ({
      id: p._id.toString(),
      title: p.title,
      description: p.description,
      format: p.dbType === 'sql' ? 'sql' : 'mongodb',
      gradingMode: null,
      language: p.dbType,
      difficulty: p.difficulty || 'Medium',
      status: p.status || 'open',
      submissionCount: countMap[p._id.toString()] || 0,
      isDbProblem: true,
      createdAt: p.createdAt,
    })),
  ];

  // Sort newest first
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    success: true,
    problems: items,
  });
}
