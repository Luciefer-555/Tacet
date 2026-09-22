/**
 * Neo4j write-through sync layer.
 *
 * Every function uses MERGE for idempotency so re-syncing is safe.
 * Sessions are opened/closed in try/finally blocks.
 *
 * Design: Mongo is the single source of truth. Neo4j stores only thin nodes
 * (IDs + minimal properties for traversal/ranking) and relationship edges.
 * All graph node IDs are derived from Mongo _id.toString().
 */
import { getNeo4jSession } from '@/lib/neo4j';

// ---------------------------------------------------------------------------
// Type definitions for sync function inputs
// ---------------------------------------------------------------------------

/** Minimal shape expected from a Mongo User document. */
export interface StudentInput {
  _id: { toString(): string };
  username: string;
  profileId: string;
  email: string;
  collegeId: string;
  collegeName: string;
  skills: string[];
  role?: string;
  // Future fields — pass null/undefined until the User model has them
  year?: number | null;
  archetype?: string | null;
}

/** Shape for syncing a problem node. Not hooked to any route yet. */
export interface ProblemInput {
  id: string;
  title: string;
  archetype?: string | null;
  difficulty?: string | null;
  status?: string | null;
  postedAt?: Date | string | null;
  companyId?: string | null;
  companyName?: string | null;
  companyIndustry?: string | null;
  requiredSkills?: { name: string; weight: number }[];
}

/** Shape for syncing a submission node. Not hooked to any route yet. */
export interface SubmissionInput {
  id: string;
  studentId: string;   // Mongo _id.toString() of the student
  problemId: string;   // Mongo _id.toString() of the problem
  aiScore?: number | null;
  rank?: number | null;
  submittedAt: Date | string;
}

// ---------------------------------------------------------------------------
// syncStudentNode — upserts :Student + :College + :Skill nodes and edges
// ---------------------------------------------------------------------------

export async function syncStudentNode(student: StudentInput): Promise<void> {
  const session = getNeo4jSession();
  try {
    const studentId = student._id.toString();

    // 1. MERGE the Student node and College node, wire STUDIES_AT
    await session.run(
      `
      MERGE (s:Student {id: $studentId})
      SET s.name       = $name,
          s.profileId  = $profileId,
          s.email      = $email,
          s.college    = $collegeId,
          s.year       = $year,
          s.archetype  = $archetype

      MERGE (c:College {id: $collegeId})
      SET c.name = $collegeName

      MERGE (s)-[:STUDIES_AT]->(c)
      `,
      {
        studentId,
        name: student.username,
        profileId: student.profileId,
        email: student.email,
        collegeId: student.collegeId,
        collegeName: student.collegeName,
        year: student.year ?? null,
        archetype: student.archetype ?? null,
      }
    );

    // 2. Sync HAS_SKILL edges — MERGE each skill, then remove stale edges
    if (student.skills.length > 0) {
      await session.run(
        `
        MATCH (s:Student {id: $studentId})
        UNWIND $skills AS skillName
        MERGE (sk:Skill {name: skillName})
        MERGE (s)-[r:HAS_SKILL]->(sk)
        ON CREATE SET r.level = 1
        `,
        { studentId, skills: student.skills }
      );
    }

    // 3. Remove HAS_SKILL edges for skills no longer in the array
    await session.run(
      `
      MATCH (s:Student {id: $studentId})-[r:HAS_SKILL]->(sk:Skill)
      WHERE NOT sk.name IN $skills
      DELETE r
      `,
      { studentId, skills: student.skills }
    );
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------------------
// syncProblemNode — upserts :Problem + optional :Company + :Skill edges
// Not hooked to any route yet (no Problem Mongo model exists).
// ---------------------------------------------------------------------------

export async function syncProblemNode(problem: ProblemInput): Promise<void> {
  const session = getNeo4jSession();
  try {
    // 1. MERGE the Problem node
    await session.run(
      `
      MERGE (p:Problem {id: $id})
      SET p.title      = $title,
          p.archetype  = $archetype,
          p.difficulty = $difficulty,
          p.status     = $status,
          p.postedAt   = $postedAt
      `,
      {
        id: problem.id,
        title: problem.title,
        archetype: problem.archetype ?? null,
        difficulty: problem.difficulty ?? null,
        status: problem.status ?? null,
        postedAt: problem.postedAt ? String(problem.postedAt) : null,
      }
    );

    // 2. If a company is specified, MERGE Company + POSTED edge
    if (problem.companyId) {
      await session.run(
        `
        MATCH (p:Problem {id: $problemId})
        MERGE (c:Company {id: $companyId})
        SET c.name     = $companyName,
            c.industry = $companyIndustry
        MERGE (c)-[:POSTED]->(p)
        `,
        {
          problemId: problem.id,
          companyId: problem.companyId,
          companyName: problem.companyName ?? null,
          companyIndustry: problem.companyIndustry ?? null,
        }
      );
    }

    // 3. Sync REQUIRES_SKILL edges
    const requiredSkills = problem.requiredSkills ?? [];
    if (requiredSkills.length > 0) {
      await session.run(
        `
        MATCH (p:Problem {id: $problemId})
        UNWIND $skills AS s
        MERGE (sk:Skill {name: s.name})
        MERGE (p)-[r:REQUIRES_SKILL]->(sk)
        SET r.weight = s.weight
        `,
        {
          problemId: problem.id,
          skills: requiredSkills.map((s) => ({ name: s.name, weight: s.weight })),
        }
      );
    }

    // 4. Remove stale REQUIRES_SKILL edges
    await session.run(
      `
      MATCH (p:Problem {id: $problemId})-[r:REQUIRES_SKILL]->(sk:Skill)
      WHERE NOT sk.name IN $skillNames
      DELETE r
      `,
      {
        problemId: problem.id,
        skillNames: requiredSkills.map((s) => s.name),
      }
    );
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------------------
// syncSubmission — creates :Submission + SUBMITTED / FOR edges
// Not hooked to any route yet (no Submission Mongo model exists).
// ---------------------------------------------------------------------------

export async function syncSubmission(submission: SubmissionInput): Promise<void> {
  const session = getNeo4jSession();
  try {
    await session.run(
      `
      MERGE (sub:Submission {id: $id})
      SET sub.aiScore     = $aiScore,
          sub.rank        = $rank,
          sub.submittedAt = $submittedAt

      WITH sub

      MATCH (s:Student {id: $studentId})
      MERGE (s)-[r:SUBMITTED]->(sub)
      SET r.submittedAt = $submittedAt

      WITH sub

      MATCH (p:Problem {id: $problemId})
      MERGE (sub)-[:FOR]->(p)
      `,
      {
        id: submission.id,
        studentId: submission.studentId,
        problemId: submission.problemId,
        aiScore: submission.aiScore ?? null,
        rank: submission.rank ?? null,
        submittedAt: String(submission.submittedAt),
      }
    );
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------------------
// getRankedStudentsForProblem — graph traversal for skill-overlap ranking
// ---------------------------------------------------------------------------

export interface RankedStudent {
  studentId: string;
  name: string;
  email: string;
  college: string;
  score: number;
  matchedSkills: string[];
}

export async function getRankedStudentsForProblem(
  problemId: string
): Promise<RankedStudent[]> {
  const session = getNeo4jSession();
  try {
    const result = await session.run(
      `
      MATCH (p:Problem {id: $problemId})-[rs:REQUIRES_SKILL]->(sk:Skill)<-[hs:HAS_SKILL]-(s:Student)
      WITH s,
           collect(sk.name) AS matchedSkills,
           sum(rs.weight * hs.level) AS score
      RETURN s.id      AS studentId,
             s.name    AS name,
             s.email   AS email,
             s.college AS college,
             score,
             matchedSkills
      ORDER BY score DESC
      `,
      { problemId }
    );

    return result.records.map((record) => ({
      studentId: record.get('studentId'),
      name: record.get('name'),
      email: record.get('email'),
      college: record.get('college'),
      score: typeof record.get('score') === 'object'
        ? (record.get('score') as any).toNumber()
        : Number(record.get('score')),
      matchedSkills: record.get('matchedSkills'),
    }));
  } finally {
    await session.close();
  }
}