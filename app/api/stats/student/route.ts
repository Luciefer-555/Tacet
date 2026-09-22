import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { requireAuth, AuthError } from '@/lib/auth';
import User from '@/models/user';
import Problem from '@/models/problem';
import Submission from '@/models/submission';
import DbProblem from '@/models/dbProblem';
import DbSubmission from '@/models/dbSubmission';

export const runtime = 'nodejs';

export async function GET() {
  let session;
  try {
    session = await requireAuth(['student']);
  } catch (err) {
    if (err instanceof AuthError) return err;
    throw err;
  }

  await connectToDatabase();

  const studentObjectId = new mongoose.Types.ObjectId(session.userId);

  // 1. Fetch student user profile for skills
  const user = await User.findById(studentObjectId).select('skills username').lean();
  const userSkills: string[] = (user as any)?.skills ?? [];

  // 2. Fetch all submissions by this student (standard and database)
  const [submissions, dbSubmissions] = await Promise.all([
    Submission.find({ studentId: studentObjectId })
      .populate({
        path: 'problemId',
        select: 'title difficulty archetype requiredSkills',
      })
      .sort({ submittedAt: -1 })
      .lean(),
    DbSubmission.find({ studentId: studentObjectId })
      .populate({
        path: 'problemId',
        select: 'title difficulty dbType',
      })
      .sort({ submittedAt: -1 })
      .lean(),
  ]);

  const totalSubmissions = submissions.length + dbSubmissions.length;

  const attemptedProblemIdSet = new Set<string>();
  let scoredCount = 0;
  let scoreSum = 0;
  let highestSub: { score: number; problemTitle: string; submittedAt: string } | null = null;
  const problemSkillsSet = new Set<string>();
  const difficultyCounts: Record<string, number> = { Easy: 0, Medium: 0, Hard: 0 };
  const archetypeCounts: Record<string, number> = {};

  let dbSubmissionsPassed = 0;
  for (const dbSub of dbSubmissions) {
    const prob = dbSub.problemId as any;
    if (prob && prob._id) {
      attemptedProblemIdSet.add(prob._id.toString());
      if (prob.difficulty && difficultyCounts[prob.difficulty] !== undefined) {
        difficultyCounts[prob.difficulty]++;
      }
      if (prob.dbType === 'sql') {
        problemSkillsSet.add('SQL');
      } else if (prob.dbType === 'mongodb') {
        problemSkillsSet.add('MongoDB');
      }
    }
    if (dbSub.passed) {
      dbSubmissionsPassed++;
    }
  }

  for (const sub of submissions) {
    const prob = sub.problemId as any;
    if (prob && prob._id) {
      attemptedProblemIdSet.add(prob._id.toString());
      if (prob.difficulty && difficultyCounts[prob.difficulty] !== undefined) {
        difficultyCounts[prob.difficulty]++;
      }
      if (prob.archetype) {
        archetypeCounts[prob.archetype] = (archetypeCounts[prob.archetype] || 0) + 1;
      }
      if (Array.isArray(prob.requiredSkills)) {
        prob.requiredSkills.forEach((s: any) => {
          if (s?.name) problemSkillsSet.add(s.name);
        });
      }
    }

    if (typeof sub.aiScore === 'number') {
      scoredCount++;
      scoreSum += sub.aiScore;
      if (!highestSub || sub.aiScore > highestSub.score) {
        highestSub = {
          score: sub.aiScore,
          problemTitle: prob?.title || 'Unknown Problem',
          submittedAt: sub.submittedAt ? new Date(sub.submittedAt).toISOString() : new Date().toISOString(),
        };
      }
    }
  }

  const problemsAttempted = attemptedProblemIdSet.size;
  const avgAiScore = scoredCount > 0 ? Math.round((scoreSum / scoredCount) * 10) / 10 : 0;

  // Combine user profile skills with problem skills
  const mergedSkills = Array.from(new Set([...userSkills, ...Array.from(problemSkillsSet)])).slice(0, 8);

  // Compute Persona (Honest threshold: < 2 AI-scored submissions = Calibrating)
  let persona;
  if (scoredCount < 2) {
    persona = {
      label: 'Calibrating...',
      description: 'Solve at least 2 AI-evaluated challenges to reveal your engineering archetype and playstyle.',
      isCalibrating: true,
      archetype: null,
    };
  } else {
    // Determine dominant difficulty or archetype
    const hardCount = difficultyCounts['Hard'] || 0;
    const medCount = difficultyCounts['Medium'] || 0;

    if (avgAiScore >= 85) {
      persona = {
        label: 'The High-Roller',
        description: 'Consistently delivering top-decile AI quality scores on technical solutions.',
        isCalibrating: false,
        archetype: 'Excellence',
      };
    } else if (hardCount >= medCount && hardCount > 0) {
      persona = {
        label: 'The Hardcore Optimizer',
        description: 'Gravitates toward high-difficulty problems and algorithmic depth.',
        isCalibrating: false,
        archetype: 'Algorithms',
      };
    } else {
      // Find top archetype if available
      const topArch = Object.entries(archetypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      persona = {
        label: topArch ? `${topArch} Specialist` : 'The Pragmatic Builder',
        description: 'Focuses on working end-to-end architectures and robust solution delivery.',
        isCalibrating: false,
        archetype: topArch || 'Full-Stack',
      };
    }
  }

  return NextResponse.json({
    success: true,
    stats: {
      totalSubmissions,
      problemsAttempted,
      scoredSubmissions: scoredCount,
      avgAiScore,
      highestScoring: highestSub,
      dbSubmissionsTotal: dbSubmissions.length,
      dbSubmissionsPassed,
      topSkills: mergedSkills,
      persona,
    },
  });
}
