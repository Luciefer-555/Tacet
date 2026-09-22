const MAX_SEED_BYTES = 2 * 1024 * 1024
const MAX_SEED_ROWS = 1000

export function validateSeedDefinition(dbType: "sql" | "mongodb", definition: string) {
  if (Buffer.byteLength(definition, "utf8") > MAX_SEED_BYTES) return "Dataset seed data must be 2 MB or smaller."
  if (dbType === "mongodb") {
    let parsed: unknown
    try { parsed = JSON.parse(definition) } catch { return "MongoDB seed data must be valid JSON." }
    if (!Array.isArray(parsed) || parsed.length > MAX_SEED_ROWS || parsed.some((item) => !item || typeof item !== "object" || Array.isArray(item))) return `MongoDB seed data must be an array of at most ${MAX_SEED_ROWS} objects.`
  }
  return null
}
