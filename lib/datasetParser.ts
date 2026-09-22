export type DatasetType = "int" | "float" | "date" | "text"

export type DatasetColumn = { name: string; type: DatasetType }

export const DATASET_MAX_BYTES = 2 * 1024 * 1024
export const DATASET_MAX_ROWS = 1000

function formulaCell(value: string) {
  return /^[=+@\t]/.test(value.trim())
}

export function inferDatasetType(values: unknown[]): DatasetType {
  const present = values.filter((value) => value !== null && value !== undefined && String(value).trim() !== "").map(String)
  if (!present.length) return "text"
  if (present.every((value) => /^[-+]?\d+$/.test(value.trim()))) return "int"
  if (present.every((value) => /^[-+]?(?:\d+\.\d*|\d*\.\d+)$/.test(value.trim()))) return "float"
  if (present.every((value) => /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?$/.test(value.trim()))) return "date"
  return "text"
}

export function parseCsv(text: string, filename: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 1 }
      else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"' && cell.length === 0) quoted = true
    else if (char === ",") { row.push(cell); cell = "" }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1
      row.push(cell); cell = ""
      if (row.some((value) => value !== "")) rows.push(row)
      row = []
    } else cell += char
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.")
  if (cell || row.length) { row.push(cell); if (row.some((value) => value !== "")) rows.push(row) }
  if (rows.length < 2) throw new Error("CSV needs a header row and at least one data row.")
  if (rows.length - 1 > DATASET_MAX_ROWS) throw new Error(`CSV exceeds the ${DATASET_MAX_ROWS}-row limit.`)
  const headers = rows[0].map((value) => value.trim())
  if (headers.some((value) => !value) || new Set(headers.map((value) => value.toLowerCase())).size !== headers.length) {
    throw new Error("CSV headers must be non-empty and unique.")
  }
  if (rows.slice(1).some((values) => values.length !== headers.length)) throw new Error("CSV rows must have the same number of columns as the header.")
  if (rows.some((values) => values.some(formulaCell))) throw new Error("CSV formula/script cells are not allowed.")
  const data = rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]])))
  const columns = headers.map((name) => ({ name, type: inferDatasetType(data.map((item) => item[name])) }))
  const table = filename.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_]/g, "_").replace(/^(?=\d)/, "_") || "uploaded_data"
  return { columns, rows: data, table }
}

export function parseMongoJson(text: string) {
  let parsed: unknown
  try { parsed = JSON.parse(text) } catch { throw new Error("JSON dataset is not valid JSON.") }
  if (!Array.isArray(parsed) || !parsed.length || parsed.length > DATASET_MAX_ROWS || parsed.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error(`Mongo dataset must be a non-empty array of at most ${DATASET_MAX_ROWS} objects.`)
  }
  const docs = parsed as Record<string, unknown>[]
  const fields = [...new Set(docs.flatMap((doc) => Object.keys(doc)))]
  return { docs, columns: fields.map((name) => ({ name, type: inferDatasetType(docs.map((doc) => doc[name])) })) }
}

function quoteIdentifier(value: string) { return `"${value.replaceAll('"', '""')}"` }
function quoteValue(value: string) { return value === "" ? "NULL" : /^[-+]?\d+$/.test(value.trim()) || /^[-+]?(?:\d+\.\d*|\d*\.\d+)$/.test(value.trim()) ? value.trim() : `'${value.replaceAll("'", "''")}'` }

export function buildSqlSeed(table: string, columns: DatasetColumn[], rows: Record<string, string>[]) {
  const ddl = `CREATE TABLE ${quoteIdentifier(table)} (${columns.map((column) => `${quoteIdentifier(column.name)} ${column.type === "int" ? "INTEGER" : column.type === "float" ? "REAL" : "TEXT"}`).join(", ")});`
  const inserts = rows.map((row) => `INSERT INTO ${quoteIdentifier(table)} (${columns.map((column) => quoteIdentifier(column.name)).join(", ")}) VALUES (${columns.map((column) => quoteValue(row[column.name] ?? "")).join(", ")});`).join("\n")
  return `${ddl}\n${inserts}`
}
