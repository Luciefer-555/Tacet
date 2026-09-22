import neo4j, { Driver, Session } from 'neo4j-driver';

const NEO4J_URI = process.env.NEO4J_URI as string;
const NEO4J_USER = process.env.NEO4J_USER as string;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD as string;
const NEO4J_DATABASE = process.env.NEO4J_DATABASE ?? 'neo4j';

if (!NEO4J_URI || !NEO4J_USER || !NEO4J_PASSWORD) {
  throw new Error(
    'Please define NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD environment variables inside .env.local'
  );
}

/**
 * Global is used here to maintain a cached driver across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage - mirrors the pattern used in lib/mongodb.ts.
 */
declare global {
  // eslint-disable-next-line no-var
  var _neo4jDriver: Driver | undefined;
}

export function getNeo4jDriver(): Driver {
  if (globalThis._neo4jDriver) {
    return globalThis._neo4jDriver;
  }

  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
  );

  globalThis._neo4jDriver = driver;
  return driver;
}

export function getNeo4jSession(): Session {
  const driver = getNeo4jDriver();
  return driver.session({ database: NEO4J_DATABASE });
}

export async function closeNeo4jDriver(): Promise<void> {
  if (globalThis._neo4jDriver) {
    await globalThis._neo4jDriver.close();
    globalThis._neo4jDriver = undefined;
  }
}
