"use client"

import { useMemo, useState } from "react"
import CodeMirror from "@uiw/react-codemirror"
import { Button } from "@/components/ui/button"

type Column = { name: string; type: string }
type Props = { dbType: "sql" | "mongodb"; schemaDefinition: string; problemId: string; value: string; onChange: (value: string) => void }

function sqlTables(schema: string) {
  const tables: { name: string; columns: Column[] }[] = []
  for (const match of schema.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([\w]+)["`]?\s*\(([^;]+)\)/gi)) {
    const columns = match[2].split(",").map((part) => part.trim()).filter((part) => part && !/^(PRIMARY|UNIQUE|FOREIGN|CHECK|CONSTRAINT)\b/i.test(part)).map((part) => {
      const bits = part.match(/^["`]?([\w]+)["`]?(?:\s+([A-Za-z]+))?/) || []
      return { name: bits[1] || part, type: bits[2] || "text" }
    })
    tables.push({ name: match[1], columns })
  }
  return tables
}

function mongoFields(schema: string) {
  try {
    const docs = JSON.parse(schema) as Record<string, unknown>[]
    const fields = [...new Set(docs.flatMap((doc) => Object.keys(doc || {})))]
    return [{ name: "documents", columns: fields.map((name) => ({ name, type: typeof docs.find((doc) => doc?.[name] !== undefined)?.[name] })) }]
  } catch { return [] }
}

export function DbProblemEditor({ dbType, schemaDefinition, problemId, value, onChange }: Props) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, unknown>[]>([])
  const tables = useMemo(() => dbType === "sql" ? sqlTables(schemaDefinition) : mongoFields(schemaDefinition), [dbType, schemaDefinition])
  const run = async () => {
    setRunning(true); setError(null); setResults([])
    try {
      const response = await fetch(`/api/db-problems/${problemId}/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: value }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.success) throw new Error(json.error || "Preview failed.")
      setResults(Array.isArray(json.results) ? json.results : [])
    } catch (err) { setError(err instanceof Error ? err.message : "Preview failed.") }
    finally { setRunning(false) }
  }
  const keys = [...new Set(results.flatMap((row) => Object.keys(row)))]
  return <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
    <aside className="rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] p-3 text-xs">
      <p className="mb-2 font-semibold text-[#1A1A1A]">{dbType === "sql" ? "Tables" : "Collections"}</p>
      {!tables.length ? <p className="text-[#78716C]">No tables loaded yet.</p> : tables.map((table) => <div key={table.name} className="mb-3"><p className="font-mono font-semibold text-[#1A1A1A]">{table.name}</p>{table.columns.map((column) => <div key={column.name} className="flex justify-between gap-2 py-0.5 pl-2 text-[#78716C]"><span>{column.name}</span><span className="font-mono">{column.type}</span></div>)}</div>)}
    </aside>
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-[#E8E2D9] shadow-sm"><CodeMirror value={value} onChange={onChange} theme="dark" height="220px" placeholder={dbType === "sql" ? "SELECT * FROM users;" : '{"role":"engineer"}'} /></div>
      <Button type="button" onClick={run} disabled={running || !value.trim()} className="rounded-full bg-black text-white hover:bg-zinc-800">{running ? "Running…" : "Run"}</Button>
      {error && <pre className="whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</pre>}
      {!error && !results.length && <p className="rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] p-3 text-sm text-[#78716C]">No rows returned.</p>}
      {!error && results.length > 0 && <div className="overflow-x-auto rounded-xl border border-[#E8E2D9]"><table className="min-w-full text-left text-xs"><thead className="bg-[#FAF7F2]"><tr>{keys.map((key) => <th key={key} className="px-3 py-2 font-semibold">{key}</th>)}</tr></thead><tbody>{results.map((row, index) => <tr key={index} className="border-t border-[#E8E2D9]"><td colSpan={0} className="hidden" />{keys.map((key) => <td key={key} className="px-3 py-2 font-mono">{typeof row[key] === "object" ? JSON.stringify(row[key]) : String(row[key] ?? "NULL")}</td>)}</tr>)}</tbody></table></div>}
    </div>
  </div>
}
