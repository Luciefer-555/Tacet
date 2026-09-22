import mongoose from 'mongoose';
import { connectToDatabase } from './mongodb';

// ponytail: using shared Atlas cluster with throwaway collections; upgrade to SANDBOX_MONGODB_URI when concurrent grading spikes
const RANKING_SERVICE_URL = (process.env.RANKING_SERVICE_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');

export interface SqlGradeResponse {
  passed: boolean;
  actualResult: any[];
  expectedResult?: any[];
  error?: string | null;
}

export interface MongoGradeResponse {
  passed: boolean;
  actualResult: any[];
  expectedResult?: any[];
  error?: string | null;
}

/**
 * Normalizes document/row arrays for unordered multiset comparison
 */
export function normalizeDocs(docs: any[]): string[] {
  if (!Array.isArray(docs)) return [];
  return docs
    .map((doc) => {
      // Remove _id from comparison if present unless explicit
      const cleanDoc = { ...doc };
      if (cleanDoc._id) {
        cleanDoc._id = cleanDoc._id.toString();
      }
      return JSON.stringify(cleanDoc, Object.keys(cleanDoc).sort());
    })
    .sort();
}

/**
 * Evaluates a student's SQL query using the ranking-service SQLite sandbox
 */
export async function gradeSqlQuery(params: {
  schemaDefinition: string;
  studentQuery: string;
  referenceQuery?: string;
  expectedResult?: any;
  comparisonMode?: 'ordered' | 'unordered';
}): Promise<SqlGradeResponse> {
  const res = await fetch(`${RANKING_SERVICE_URL}/grade-sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schemaDefinition: params.schemaDefinition,
      studentQuery: params.studentQuery,
      referenceQuery: params.referenceQuery,
      expectedResult: params.expectedResult,
      comparisonMode: params.comparisonMode || 'unordered',
    }),
  });

  if (!res.ok) {
    throw new Error(`SQL grading service returned status ${res.status}`);
  }

  return await res.json();
}

/**
 * Runs reference query to produce expected result for SQL problems
 */
export async function executeSqlQuery(params: {
  schemaDefinition: string;
  query: string;
}): Promise<{ success: boolean; results: any[]; error?: string | null }> {
  const res = await fetch(`${RANKING_SERVICE_URL}/execute-sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schemaDefinition: params.schemaDefinition,
      query: params.query,
    }),
  });

  if (!res.ok) {
    throw new Error(`SQL execution service returned status ${res.status}`);
  }

  return await res.json();
}

/**
 * Evaluates a MongoDB query safely inside an ephemeral collection without eval()
 */
export async function gradeMongoQuery(params: {
  schemaDefinition: string; // JSON string of document fixtures
  studentQuery: string;    // JSON string: find filter object or aggregation pipeline array
  expectedResult?: any;
  referenceQuery?: string;
  comparisonMode?: 'ordered' | 'unordered';
}): Promise<MongoGradeResponse> {
  await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection is not available');
  }

  // 1. Validate fixtures
  let fixtures: any[];
  try {
    const parsed = JSON.parse(params.schemaDefinition);
    fixtures = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return {
      passed: false,
      actualResult: [],
      error: 'Invalid schemaDefinition JSON fixtures.',
    };
  }

  // 2. Validate student query format (Strict JSON only, no eval)
  let queryData: any;
  try {
    queryData = JSON.parse(params.studentQuery);
  } catch (err: any) {
    return {
      passed: false,
      actualResult: [],
      error: `Query must be valid JSON: ${err.message}`,
    };
  }

  // 3. Security Inspection: Prohibit JS-code injection operators
  const rawQuery = JSON.stringify(queryData);
  const dangerousOperators = ['$where', '$accumulator', '$function'];
  for (const op of dangerousOperators) {
    if (rawQuery.includes(`"${op}"`)) {
      return {
        passed: false,
        actualResult: [],
        error: `Security violation: Operator '${op}' is strictly prohibited.`,
      };
    }
  }

  // Generate ephemeral isolated collection
  const ephemeralColName = `tmp_eval_${new mongoose.Types.ObjectId().toString()}`;
  const tmpCol = db.collection(ephemeralColName);

  try {
    // Seed fixtures
    if (fixtures.length > 0) {
      await tmpCol.insertMany(fixtures.map((doc) => ({ ...doc })));
    }

    // Execute student query
    let actualResult: any[] = [];
    if (Array.isArray(queryData)) {
      // Aggregation pipeline
      actualResult = await tmpCol.aggregate(queryData).toArray();
    } else if (typeof queryData === 'object' && queryData !== null) {
      if (queryData.operation === 'aggregate' && Array.isArray(queryData.pipeline)) {
        actualResult = await tmpCol.aggregate(queryData.pipeline).toArray();
      } else if (queryData.operation === 'find') {
        const cursor = tmpCol.find(queryData.filter || {}, {
          projection: queryData.projection || { _id: 0 },
        });
        if (queryData.sort) cursor.sort(queryData.sort);
        if (queryData.limit) cursor.limit(queryData.limit);
        actualResult = await cursor.toArray();
      } else {
        // Standard find filter object
        actualResult = await tmpCol.find(queryData, { projection: { _id: 0 } }).toArray();
      }
    } else {
      return {
        passed: false,
        actualResult: [],
        error: 'Query must be a JSON filter object or aggregation pipeline array.',
      };
    }

    // Clean actualResult serialization
    actualResult = JSON.parse(JSON.stringify(actualResult));

    // Determine expected result
    let expected = params.expectedResult;
    if (expected === undefined && params.referenceQuery) {
      const refParsed = JSON.parse(params.referenceQuery);
      if (Array.isArray(refParsed)) {
        expected = await tmpCol.aggregate(refParsed).toArray();
      } else {
        expected = await tmpCol.find(refParsed, { projection: { _id: 0 } }).toArray();
      }
      expected = JSON.parse(JSON.stringify(expected));
    }

    // Compare results
    let passed = false;
    const mode = params.comparisonMode || 'unordered';
    if (mode === 'ordered') {
      passed = JSON.stringify(actualResult) === JSON.stringify(expected);
    } else {
      const normActual = normalizeDocs(actualResult);
      const normExpected = normalizeDocs(expected || []);
      passed = JSON.stringify(normActual) === JSON.stringify(normExpected);
    }

    return {
      passed,
      actualResult,
      expectedResult: expected,
      error: null,
    };
  } catch (err: any) {
    return {
      passed: false,
      actualResult: [],
      error: err.message || 'Database query execution failed.',
    };
  } finally {
    // Drop ephemeral collection unconditionally
    await tmpCol.drop().catch(() => {});
  }
}
