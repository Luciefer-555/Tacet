import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/mongodb';
import { getNeo4jSession } from '@/lib/neo4j';

export async function GET() {
  const result: { mongodb: string; neo4j: string } = {
    mongodb: 'unknown',
    neo4j: 'unknown',
  };

  // --- MongoDB check ---
  try {
    await connectToDatabase();
    // readyState 1 = connected
    if (mongoose.connection.readyState === 1) {
      result.mongodb = 'connected';
    } else {
      result.mongodb = `failed: unexpected readyState ${mongoose.connection.readyState}`;
    }
  } catch (err: unknown) {
    result.mongodb = `failed: ${err instanceof Error ? err.message : String(err)}`;
  }

  // --- Neo4j check ---
  const session = getNeo4jSession();
  try {
    const queryResult = await session.run('RETURN 1 AS result');
    const value = queryResult.records[0]?.get('result');
    if (value !== null && value !== undefined) {
      result.neo4j = 'connected';
    } else {
      result.neo4j = 'failed: query returned no records';
    }
  } catch (err: unknown) {
    result.neo4j = `failed: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    await session.close();
  }

  return NextResponse.json(result);
}
