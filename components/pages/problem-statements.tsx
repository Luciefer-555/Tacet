"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useAuth } from "@/app/providers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  FileText,
  Upload,
  Trophy,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Code,
  Trash2,
  Eye,
  EyeOff,
  Database,
  Building2,
  Globe,
  Copy,
  Check,
  ExternalLink,
  ArrowUpRight,
  QrCode,
  Clock,
  Users,
  Timer,
  UserCheck,
  UserX,
  ChevronRight,
} from "lucide-react"
import CodeMirror from "@uiw/react-codemirror"
import { python } from "@codemirror/lang-python"
import { java } from "@codemirror/lang-java"
import { MentorClassesSection, TimedTestController } from "@/components/classes-hub"
import { DbProblemEditor } from "@/components/db-problem-editor"
import { buildSqlSeed, DATASET_MAX_BYTES, parseCsv, parseMongoJson, type DatasetColumn, type DatasetType } from "@/lib/datasetParser"

// ─── Types ─────────────────────────────────────────────────────────────────

type TestResult = {
  input?: string
  expectedOutput?: string
  actualOutput?: string
  passed: boolean
  hidden: boolean
  functionInputs?: Record<string, any>
  time?: string | null
  memory?: number | null
}

type Submission = {
  _id: string
  problemId: string | { _id: string; title?: string; difficulty?: string; status?: string; problemFormat?: string }
  content?: string
  code?: string
  language?: string
  fileUrl?: string
  fileType?: string
  status: "submitted" | "scored" | "failed_gate"
  aiScore?: number
  aiRationale?: string
  correctnessScore?: number
  correctnessGatePassed?: boolean
  testResults?: TestResult[]
  submittedAt: string
  rank?: number
  flags?: string[]
  studentId?: { username?: string; email?: string; collegeName?: string } | string
  autoPromoted?: boolean
  autoPromotionReason?: string
}

type Variant = {
  variantId: string
  title: string
  description: string
  generationFailed?: boolean
}

type SkillEntry = { name: string; weight: number }

const BOILERPLATES: Record<string, string> = {
  python: `# Read from stdin, write to stdout\nimport sys\n\n`,
  java: `// WARNING: Class must remain named 'Main' for the judge runner to compile\npublic class Main {\n    public static void main(String[] args) {\n        // your code here\n    }\n}\n`,
  c: `#include <stdio.h>\n#include <stdlib.h>\n\nint main() {\n    // your code here\n    return 0;\n}\n`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    // your code here\n    return 0;\n}\n`,
}

// ─── Inline status banner ────────────────────────────────────────────────────

function StatusBanner({
  kind,
  children,
}: {
  kind: "error" | "success" | "warning" | "info"
  children: React.ReactNode
}) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  }
  return (
    <p className={`rounded-xl border px-4 py-3 text-sm font-sans ${styles[kind]}`}>{children}</p>
  )
}

// ─── Score badge ─────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
    score >= 50 ? "bg-amber-50 text-amber-700 border border-amber-200" :
                  "bg-red-50 text-red-700 border border-red-200"
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
      {score.toFixed(0)} pts
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENT VIEW
// ═══════════════════════════════════════════════════════════════════════════

function StudentView() {
  // — Submission form state —
  const [problemId, setProblemId] = useState("")
  const [textContent, setTextContent] = useState("")
  const [codeContent, setCodeContent] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [submitMode, setSubmitMode] = useState<"text" | "file">("text")
  const [submitting, setSubmitting] = useState(false)
  const [running, setRunning] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<{ kind: "success" | "error" | "warning"; message: string } | null>(null)
  const [codingResult, setCodingResult] = useState<{ testResults: TestResult[]; passedCases: number; totalCases: number; correctnessGatePassed: boolean } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // — Problem metadata (for detecting coding, function_signature, or db_query format) —
  const [problemMeta, setProblemMeta] = useState<{
    problemFormat: string
    gradingMode?: 'stdin_stdout' | 'function_signature'
    functionName?: string
    parameters?: Array<{ name: string; type: string }>
    returnType?: string
    functionTestCases?: Array<{ inputs: any; expectedOutput: any; hidden: boolean }>
    language?: string
    title?: string
    description?: string
    dbType?: string
    schemaDefinition?: string
    resultComparisonMode?: string
    testCases?: Array<{ input: string; expectedOutput: string }>
    timeLimit?: number
  } | null>(null)
  const [loadingMeta, setLoadingMeta] = useState(false)

  // Fetch problem metadata when problemId changes (debounced)
  useEffect(() => {
    const trimmed = problemId.trim()
    if (trimmed.length !== 24) {
      setProblemMeta(null)
      return
    }
    setLoadingMeta(true)
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/problems/${trimmed}`)
        if (res.ok) {
          const json = await res.json()
          setProblemMeta(json.problem)
          if (json.problem?.gradingMode === "function_signature") {
            const p = json.problem
            const paramList = (p.parameters || []).map((param: any) => `${param.type} ${param.name}`).join(", ")
            const bp = `class Solution {\n    public ${p.returnType} ${p.functionName}(${paramList}) {\n        \n    }\n}`
            setCodeContent((prev) => (!prev.trim() || Object.values(BOILERPLATES).some((b) => b.trim() === prev.trim()) ? bp : prev))
          } else if (json.problem?.problemFormat === "coding") {
            const lang = json.problem.language || "python"
            setCodeContent((prev) => {
              const isBoilerplate = !prev.trim() || Object.values(BOILERPLATES).some((b) => b.trim() === prev.trim())
              return isBoilerplate ? (BOILERPLATES[lang] ?? "") : prev
            })
          }
        } else {
          // Fallback check: is this a DbProblem?
          const dbRes = await fetch(`/api/db-problems/${trimmed}`)
          if (dbRes.ok) {
            const dbJson = await dbRes.json()
            setProblemMeta({ ...dbJson.problem, problemFormat: "db_query" })
            setCodeContent("")
          } else {
            setProblemMeta(null)
          }
        }
      } catch {
        setProblemMeta(null)
      } finally {
        setLoadingMeta(false)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [problemId])

  const isCodingProblem = problemMeta?.problemFormat === "coding"

  // — My submissions —
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([])
  const [loadingMine, setLoadingMine] = useState(true)
  const [mineError, setMineError] = useState<string | null>(null)

  useEffect(() => {
    fetchMine()
  }, [])

  async function fetchMine() {
    setLoadingMine(true)
    setMineError(null)
    try {
      const res = await fetch("/api/submissions/mine")
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? "Failed to load your submissions.")
      }
      const json = await res.json()
      setMySubmissions(json.submissions ?? [])
    } catch (err) {
      setMineError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoadingMine(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitStatus(null)
    setCodingResult(null)

    if (!problemId.trim()) {
      setSubmitStatus({ kind: "error", message: "Please enter a Problem ID." })
      return
    }

    if (problemMeta?.problemFormat === "db_query") {
      if (!codeContent.trim()) {
        setSubmitStatus({ kind: "error", message: "Your query cannot be empty." })
        return
      }
      setSubmitting(true)
      try {
        const res = await fetch("/api/db-submissions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problemId: problemId.trim(),
            query: codeContent.trim(),
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          setSubmitStatus({ kind: "error", message: json.error ?? "Query submission failed." })
        } else {
          setSubmitStatus({
            kind: json.submission?.passed ? "success" : "warning",
            message: json.submission?.passed
              ? "Query executed successfully and passed all expected result checks!"
              : `Query executed but did not match expected results. ${json.submission?.error || ""}`,
          })
          fetchMine()
        }
      } catch {
        setSubmitStatus({ kind: "error", message: "Network error submitting query." })
      } finally {
        setSubmitting(false)
      }
      return
    }

    if (isCodingProblem) {
      if (!codeContent.trim()) {
        setSubmitStatus({ kind: "error", message: "Your code cannot be empty." })
        return
      }
    } else {
      if (submitMode === "text" && !textContent.trim()) {
        setSubmitStatus({ kind: "error", message: "Your submission cannot be empty." })
        return
      }
      if (submitMode === "file" && !selectedFile) {
        setSubmitStatus({ kind: "error", message: "Please select a file to upload." })
        return
      }
    }

    setSubmitting(true)
    try {
      let res: Response
      if (isCodingProblem) {
        res = await fetch("/api/submissions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problemId: problemId.trim(),
            code: codeContent,
            language: problemMeta?.language ?? "python",
          }),
        })
      } else if (submitMode === "file" && selectedFile) {
        const fd = new FormData()
        fd.append("problemId", problemId.trim())
        fd.append("file", selectedFile)
        res = await fetch("/api/submissions/create", { method: "POST", body: fd })
      } else {
        res = await fetch("/api/submissions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problemId: problemId.trim(), content: textContent.trim() }),
        })
      }

      const json = await res.json().catch(() => ({}))

      if (res.status === 409) {
        setSubmitStatus({ kind: "warning", message: "You've already submitted to this problem." })
        return
      }
      if (res.status === 403 || (res.status === 400 && json.error?.toLowerCase().includes("not open"))) {
        setSubmitStatus({
          kind: "error",
          message: json.error ?? "This problem isn't open for submissions, or you don't have permission.",
        })
        return
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Submission failed.")
      }

      // Coding results
      if (isCodingProblem && (json.submission?.testResults !== undefined || json.testResults !== undefined)) {
        const results = json.submission?.testResults ?? json.testResults ?? []
        setCodingResult({
          testResults: results,
          passedCases: json.passedCases ?? 0,
          totalCases: json.totalCases ?? 0,
          correctnessGatePassed: json.correctnessGatePassed ?? false,
        })
        const gateMsg = json.correctnessGatePassed
          ? `All ${json.totalCases} test cases passed! Your submission is eligible for ranking. 🎉`
          : `${json.passedCases}/${json.totalCases} test cases passed. Must pass all to qualify for ranking.`
        setSubmitStatus({ kind: json.correctnessGatePassed ? "success" : "warning", message: gateMsg })
      } else {
        setSubmitStatus({ kind: "success", message: "Submitted successfully! 🎉" })
      }

      setTextContent("")
      setCodeContent("")
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      // Refresh list
      fetchMine()
    } catch (err) {
      setSubmitStatus({ kind: "error", message: err instanceof Error ? err.message : "Submission failed. Please try again." })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRun() {
    setSubmitStatus(null)
    setCodingResult(null)

    if (!problemId.trim()) {
      setSubmitStatus({ kind: "error", message: "Please enter a Problem ID." })
      return
    }
    if (!codeContent.trim()) {
      setSubmitStatus({ kind: "error", message: "Your code cannot be empty." })
      return
    }

    setRunning(true)
    try {
      const res = await fetch("/api/submissions/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: problemId.trim(),
          code: codeContent,
          language: problemMeta?.language ?? "python",
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Run failed.")
      }

      const results = json.testResults ?? []
      setCodingResult({
        testResults: results,
        passedCases: json.passedCases ?? 0,
        totalCases: json.totalCases ?? 0,
        correctnessGatePassed: json.passedCases === json.totalCases,
      })
      setSubmitStatus({
        kind: json.passedCases === json.totalCases ? "success" : "warning",
        message: `Run complete: ${json.passedCases}/${json.totalCases} visible test cases passed.`,
      })
    } catch (err) {
      setSubmitStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Run failed. Please try again.",
      })
    } finally {
      setRunning(false)
    }
  }

  const problemTitle = (sub: Submission) => {
    if (typeof sub.problemId === "object" && sub.problemId?.title) return sub.problemId.title
    return typeof sub.problemId === "string" ? sub.problemId : "Problem"
  }

  return (
    <div className="space-y-8">
      <Card className="rounded-2xl border border-[#E8E2D9] bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="font-serif text-2xl font-normal tracking-tight text-[#1A1A1A]">Available Problems</h2>
          <p className="text-xs text-[#78716C] font-sans mt-0.5">Choose a problem to start. You can still paste an ID below.</p>
        </div>
        <MyProblemsList
          onSelectProblem={(id) => setProblemId(id)}
          selectedProblemId={problemId || null}
          refreshKey={0}
          studentMode
        />
      </Card>

      {/* ── Submission form ── */}
      <Card className="rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] text-[#1A1A1A]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-2xl font-normal tracking-tight text-[#1A1A1A]">Submit a Solution</h2>
            <p className="text-xs text-[#78716C] font-sans mt-0.5">Paste your Problem or Assignment ID</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {submitStatus && (
            <StatusBanner kind={submitStatus.kind}>{submitStatus.message}</StatusBanner>
          )}

          {problemMeta?.timeLimit && (
            <TimedTestController
              problemId={problemId.trim()}
              timeLimitMinutes={problemMeta.timeLimit}
              onAutoSubmit={() => {
                const fakeEvent = { preventDefault: () => {} } as React.FormEvent
                handleSubmit(fakeEvent)
              }}
              currentCode={codeContent}
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="problemId" className="text-[#1A1A1A] font-sans text-sm font-medium">
              Problem ID
            </Label>
            <Input
              id="problemId"
              value={problemId}
              onChange={(e) => setProblemId(e.target.value)}
              placeholder="e.g. 66f3a1b2c3d4e5f6a7b8c9d0"
              className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] placeholder:text-[#A8A29E] font-sans focus:border-[#1A1A1A] focus:bg-white transition-colors"
            />
            {loadingMeta && <p className="text-xs text-[#78716C] font-sans">Loading problem info…</p>}
            {isCodingProblem && (
              <p className="text-xs text-[#3F3FF3] font-sans font-medium flex items-center gap-1">
                <Code className="h-3 w-3" />
                Coding problem — {problemMeta?.language?.toUpperCase()}
              </p>
            )}
            {problemMeta?.problemFormat === "db_query" && (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs text-[#3F3FF3] font-sans font-medium flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  Database Query — {problemMeta.dbType?.toUpperCase()} ({problemMeta.resultComparisonMode} comparison)
                </p>
                {problemMeta.title && <h4 className="text-sm font-semibold text-[#1A1A1A] font-sans">{problemMeta.title}</h4>}
                {problemMeta.description && <p className="text-xs text-[#78716C] font-sans">{problemMeta.description}</p>}
              </div>
            )}
          </div>

          {/* DB Query editor OR Coding editor OR text/file tabs */}
          {problemMeta?.problemFormat === "db_query" ? (
            <div className="space-y-4">
              <DbProblemEditor dbType={problemMeta.dbType === "mongodb" ? "mongodb" : "sql"} schemaDefinition={problemMeta.schemaDefinition || ""} problemId={problemId.trim()} value={codeContent} onChange={setCodeContent} />
            </div>
          ) : isCodingProblem ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#E8E2D9] overflow-hidden shadow-sm">
                {problemMeta?.language === "java" && (
                  <div className="bg-amber-50 border-b border-amber-200 px-3.5 py-2 text-xs text-amber-900 font-sans">
                    {problemMeta?.gradingMode === "function_signature"
                      ? "💡 Implement the required method inside class Solution."
                      : "⚠️ The public class must remain named Main for the judge runner to compile."}
                  </div>
                )}
                <CodeMirror
                  value={codeContent}
                  onChange={setCodeContent}
                  extensions={[problemMeta?.language === "python" ? python() : java()]}
                  theme="dark"
                  height="300px"
                  placeholder={BOILERPLATES[problemMeta?.language || "python"] || "// Write your code here…"}
                  className="text-sm"
                />
              </div>

              {/* Sample test cases (non-hidden only) */}
              {problemMeta?.gradingMode === "function_signature" && problemMeta.functionTestCases && problemMeta.functionTestCases.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-[#78716C] font-sans font-semibold">Sample Test Cases (Visible)</p>
                  {problemMeta.functionTestCases.filter((tc) => !tc.hidden).map((tc, i) => (
                    <div key={i} className="rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] p-3 grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs text-[#78716C] font-sans">Input</span>
                        <pre className="text-xs text-[#1A1A1A] font-mono mt-1 whitespace-pre-wrap">{JSON.stringify(tc.inputs, null, 2)}</pre>
                      </div>
                      <div>
                        <span className="text-xs text-[#78716C] font-sans">Expected Output</span>
                        <pre className="text-xs text-[#1A1A1A] font-mono mt-1 whitespace-pre-wrap">{JSON.stringify(tc.expectedOutput)}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                problemMeta?.testCases && problemMeta.testCases.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-[#78716C] font-sans font-semibold">Sample Test Cases</p>
                    {problemMeta.testCases.map((tc, i) => (
                      <div key={i} className="rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] p-3 grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs text-[#78716C] font-sans">Input</span>
                          <pre className="text-xs text-[#1A1A1A] font-mono mt-1 whitespace-pre-wrap">{tc.input || "(empty)"}</pre>
                        </div>
                        <div>
                          <span className="text-xs text-[#78716C] font-sans">Expected Output</span>
                          <pre className="text-xs text-[#1A1A1A] font-mono mt-1 whitespace-pre-wrap">{tc.expectedOutput}</pre>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          ) : (
            <Tabs value={submitMode} onValueChange={(v) => setSubmitMode(v as "text" | "file")}>
              <TabsList className="bg-[#F5F2EC] border border-[#E8E2D9] mb-4 p-1 rounded-xl">
                <TabsTrigger value="text" className="data-[state=active]:bg-white data-[state=active]:text-[#1A1A1A] data-[state=active]:shadow-sm text-[#78716C] rounded-lg text-xs font-medium">
                  <FileText className="h-4 w-4 mr-2" />
                  Paste text
                </TabsTrigger>
                <TabsTrigger value="file" className="data-[state=active]:bg-white data-[state=active]:text-[#1A1A1A] data-[state=active]:shadow-sm text-[#78716C] rounded-lg text-xs font-medium">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload file
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text">
                <Textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Write or paste your solution here…"
                  className="min-h-[180px] bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] placeholder:text-[#A8A29E] font-sans resize-none focus:border-[#1A1A1A] focus:bg-white transition-colors"
                />
              </TabsContent>

              <TabsContent value="file">
                <div className="space-y-3">
                  <div
                    className="rounded-xl border-2 border-dashed border-[#E8E2D9] bg-[#FAF7F2] hover:bg-[#F5F2EC] p-8 text-center cursor-pointer transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 text-[#A8A29E] mx-auto mb-3" />
                    {selectedFile ? (
                      <p className="text-sm font-medium text-[#1A1A1A] font-sans">{selectedFile.name}</p>
                    ) : (
                      <>
                        <p className="text-sm text-[#1A1A1A] font-sans">Click to pick a file</p>
                        <p className="text-xs text-[#78716C] font-sans mt-1">PDF, PPTX, DOCX, PNG, JPG — max 15 MB</p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.pptx,.docx,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null
                      if (f) {
                        const ext = (f.name.split(".").pop() || "").toLowerCase()
                        const allowed = ["pdf", "pptx", "docx", "png", "jpg", "jpeg"]
                        if (!allowed.includes(ext)) {
                          setSubmitStatus({
                            kind: "error",
                            message: `Unsupported file type: .${ext}. Only PDF, PPTX, DOCX, PNG, and JPG files are accepted.`,
                          })
                          setSelectedFile(null)
                          if (fileInputRef.current) fileInputRef.current.value = ""
                          return
                        }
                      }
                      setSelectedFile(f)
                      setSubmitStatus(null)
                    }}
                  />
                  {selectedFile && (
                    <button
                      type="button"
                      className="text-xs text-[#78716C] hover:text-[#1A1A1A] underline font-sans"
                      onClick={() => {
                        setSelectedFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ""
                      }}
                    >
                      Remove file
                    </button>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Coding test results */}
          {codingResult && (
            <div className="space-y-2">
              {codingResult.testResults.map((r, i) => (
                <div key={i} className={`rounded-lg border px-3.5 py-2.5 text-xs font-sans ${r.passed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                  {r.hidden ? (
                    <span className={r.passed ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                      Hidden test case — {r.passed ? "Passed ✓" : "Failed ✗"}
                    </span>
                  ) : (
                    <div className="space-y-1">
                      <span className={r.passed ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
                        Test {i + 1} — {r.passed ? "Passed ✓" : "Failed ✗"}
                      </span>
                      <div className="grid grid-cols-3 gap-2 mt-1">
                        <div><span className="text-[#78716C]">Input:</span> <pre className="text-[#1A1A1A] whitespace-pre-wrap">{r.functionInputs ? JSON.stringify(r.functionInputs) : r.input}</pre></div>
                        <div><span className="text-[#78716C]">Expected:</span> <pre className="text-[#1A1A1A] whitespace-pre-wrap">{r.expectedOutput}</pre></div>
                        <div><span className="text-[#78716C]">Got:</span> <pre className="text-[#1A1A1A] whitespace-pre-wrap">{r.actualOutput}</pre></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            {isCodingProblem && (
              <Button
                type="button"
                variant="outline"
                disabled={submitting || running}
                onClick={handleRun}
                className="rounded-full border border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#F5F2EC] font-sans text-xs font-medium py-2 px-5 transition-colors disabled:opacity-60"
              >
                {running ? "Running…" : "Run Code (Visible Cases)"}
              </Button>
            )}
            <Button
              type="submit"
              disabled={submitting || running}
              className="rounded-full bg-black text-white hover:bg-zinc-800 font-sans text-xs font-medium py-2 px-6 transition-colors disabled:opacity-60"
            >
              {submitting
                ? isCodingProblem ? "Submitting…" : submitMode === "file" ? "Reading your file…" : "Submitting…"
                : "Submit Solution"}
            </Button>
          </div>
        </form>
      </Card>

      {/* ── My submissions list ── */}
      <Card className="rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] text-[#1A1A1A]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h2 className="font-serif text-2xl font-normal tracking-tight text-[#1A1A1A]">My Submissions</h2>
          </div>
          <button
            onClick={fetchMine}
            className="text-xs text-[#78716C] hover:text-[#1A1A1A] flex items-center gap-1 font-sans transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>

        {loadingMine ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl bg-[#F5F2EC]" />
            ))}
          </div>
        ) : mineError ? (
          <StatusBanner kind="error">{mineError}</StatusBanner>
        ) : mySubmissions.length === 0 ? (
          <div className="text-center py-10">
            <FileText className="h-10 w-10 text-[#D6D0C7] mx-auto mb-3" />
            <p className="text-[#78716C] font-sans text-sm">No submissions yet.</p>
            <p className="text-[#A8A29E] font-sans text-xs mt-1">Submit your first solution above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {mySubmissions.map((sub) => (
              <div key={sub._id} className={`rounded-xl border px-5 py-4 transition-all ${sub.status === "failed_gate" ? "border-red-200 bg-red-50/40" : "border-[#E8E2D9] bg-[#FAF7F2] hover:bg-white hover:shadow-sm"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1A1A1A] font-sans truncate">{problemTitle(sub)}</p>
                    <p className="text-xs text-[#78716C] font-sans mt-0.5">
                      {sub.code ? `Code (${sub.language?.toUpperCase() ?? "CODE"})` : sub.fileType ? `File upload (${sub.fileType.toUpperCase()})` : "Text submission"}
                      {" · "}
                      {new Date(sub.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sub.status === "scored" && sub.aiScore != null && (
                      <ScoreBadge score={sub.aiScore} />
                    )}
                    {sub.correctnessGatePassed !== null && sub.correctnessGatePassed !== undefined && (
                      <Badge className={`text-xs border ${sub.correctnessGatePassed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                        {sub.correctnessScore !== undefined ? `${Math.round(sub.correctnessScore * 100)}% tests` : sub.correctnessGatePassed ? "✓" : "✗"}
                      </Badge>
                    )}
                    <Badge
                      className={`text-xs border ${
                        sub.status === "scored" ? "bg-blue-50 text-blue-700 border-blue-200"
                        : sub.status === "failed_gate" ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-white text-[#78716C] border-[#E8E2D9]"
                      }`}
                    >
                      {sub.status}
                    </Badge>
                    {sub.autoPromoted && (
                      <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-semibold">
                        Auto-Submitted from Draft
                      </Badge>
                    )}
                  </div>
                </div>
                {sub.autoPromoted && (
                  <div className="mt-2 text-xs text-amber-900 bg-amber-50/80 border border-amber-200 rounded-lg p-2.5 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{sub.autoPromotionReason || "Your test was auto-submitted from your last saved draft after your connection was lost."}</span>
                  </div>
                )}
                {sub.status === "scored" && sub.aiRationale && (
                  <p className="mt-2.5 text-xs text-[#78716C] font-sans line-clamp-2">{sub.aiRationale}</p>
                )}
                {sub.status === "failed_gate" && (
                  <p className="mt-1.5 text-xs text-red-700 font-sans">Code did not pass all test cases — not eligible for ranking</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPANY ONBOARDING GATE
// ═══════════════════════════════════════════════════════════════════════════

function CompanyOnboardingGate({ onCompleted }: { onCompleted: (company: any) => void }) {
  const [name, setName] = useState("")
  const [website, setWebsite] = useState("")
  const [description, setDescription] = useState("")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Logo file must be smaller than 5MB.")
        return
      }
      setLogoFile(file)
      setError(null)
      const reader = new FileReader()
      reader.onload = () => setLogoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError("Company name is required.")
      return
    }
    if (!logoFile) {
      setError("Company logo upload is required.")
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append("name", name.trim())
      fd.append("logo", logoFile)
      if (website.trim()) fd.append("website", website.trim())
      if (description.trim()) fd.append("description", description.trim())

      const res = await fetch("/api/company/onboard", {
        method: "POST",
        body: fd,
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to create company profile.")
      }
      onCompleted(json.company)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#1A1A1A]"></div>

      <div className="flex items-start gap-4 mb-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FAF7F2] text-[#1A1A1A] border border-[#E8E2D9] shrink-0">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider font-bold text-[#3F3FF3]">Onboarding Required</div>
          <h2 className="font-serif text-2xl font-normal tracking-tight text-[#1A1A1A] mt-1">Set Up Your Company Profile</h2>
          <p className="text-sm text-[#78716C] mt-1">
            Complete your company profile before posting problem statements to candidates. This establishes your organization across candidate challenges.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <StatusBanner kind="error">{error}</StatusBanner>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-[#1A1A1A]">
            Company Name <span className="text-red-500">*</span>
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Robotics Labs"
            className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] placeholder:text-[#A8A29E] focus:border-[#1A1A1A] focus:bg-white"
            required
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-[#1A1A1A]">
            Company Logo <span className="text-red-500">*</span>
          </Label>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              <div className="w-16 h-16 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] p-1 flex items-center justify-center overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-[#E8E2D9] bg-[#FAF7F2] flex items-center justify-center text-[#A8A29E] shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
            )}
            <div className="flex-1">
              <Input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileChange}
                className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] text-xs file:bg-black file:text-white file:border-0 file:rounded-full file:px-3 file:py-1 file:text-xs file:font-medium hover:file:bg-zinc-800 cursor-pointer"
                required
              />
              <p className="text-[11px] text-[#78716C] mt-1">PNG, JPG, WebP, or SVG up to 5MB.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-[#1A1A1A]">Website (Optional)</Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] placeholder:text-[#A8A29E] focus:border-[#1A1A1A] focus:bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-[#1A1A1A]">Company Description (Optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Next-generation robotics and autonomous systems"
              className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] placeholder:text-[#A8A29E] focus:border-[#1A1A1A] focus:bg-white"
            />
          </div>
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-black hover:bg-zinc-800 text-white font-medium py-3 transition-all cursor-pointer"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Creating Company Profile...</span>
              </div>
            ) : (
              "Complete Company Setup & Continue"
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED ADD PROBLEM FORM (Part B + Part C ID Surfacing)
// ═══════════════════════════════════════════════════════════════════════════

function UnifiedAddProblemForm({
  onCreated,
  onInspectProblem,
  isMentor,
}: {
  onCreated: (problemId: string) => void
  onInspectProblem?: (problemId: string) => void
  isMentor?: boolean
}) {
  const [problemType, setProblemType] = useState<"open_ended" | "coding" | "sql" | "mongodb">("open_ended")
  const [form, setForm] = useState({ title: "", description: "", difficulty: "Medium" })

  // Coding problem fields
  const [codingLanguage, setCodingLanguage] = useState<"java" | "python" | "c" | "cpp">("java")
  const [gradingMode, setGradingMode] = useState<"function_signature" | "stdin_stdout">("function_signature")
  const [functionName, setFunctionName] = useState("isMirrorSequence")
  const [returnType, setReturnType] = useState("boolean")
  const [parameters, setParameters] = useState<Array<{ name: string; type: string }>>([
    { name: "arr", type: "int[]" },
  ])
  const [functionTestCases, setFunctionTestCases] = useState<Array<{ inputsJson: string; expectedOutput: string; hidden: boolean }>>([
    { inputsJson: JSON.stringify({ arr: [1, 2, 3, 2, 1] }), expectedOutput: "true", hidden: false },
    { inputsJson: JSON.stringify({ arr: [1, 2, 3, 4, 5] }), expectedOutput: "false", hidden: false },
    { inputsJson: JSON.stringify({ arr: [7, 7, 7, 7] }), expectedOutput: "true", hidden: true },
  ])
  const [stdinTestCases, setStdinTestCases] = useState<Array<{ input: string; expectedOutput: string; hidden: boolean }>>([
    { input: "5\n1 2 3 4 5", expectedOutput: "15", hidden: false },
  ])

  // Database problem fields
  const [schemaDefinition, setSchemaDefinition] = useState(
    "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, role TEXT);\nINSERT INTO users VALUES (1, 'Alice', 'engineer');\nINSERT INTO users VALUES (2, 'Bob', 'manager');\nINSERT INTO users VALUES (3, 'Charlie', 'engineer');"
  )
  const [referenceQuery, setReferenceQuery] = useState("SELECT id, name FROM users WHERE role = 'engineer'")
  const [resultComparisonMode, setResultComparisonMode] = useState<"unordered" | "ordered">("unordered")
  const [datasetColumns, setDatasetColumns] = useState<DatasetColumn[]>([])
  const [datasetRows, setDatasetRows] = useState<Record<string, unknown>[]>([])
  const [datasetFileName, setDatasetFileName] = useState("")
  const [datasetError, setDatasetError] = useState<string | null>(null)

  // Open-ended mode toggle
  const [openEndedMode, setOpenEndedMode] = useState<"manual" | "variants">("manual")
  const [rawBrief, setRawBrief] = useState("")
  const [variantCount, setVariantCount] = useState(3)

  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<{ kind: "error" | "success" | "warning"; message: string } | null>(null)
  const [createdProblemId, setCreatedProblemId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [mentorClasses, setMentorClasses] = useState<Array<{ id: string; name: string; classId: string }>>([])
  const [selectedClassId, setSelectedClassId] = useState<string>("none")
  const [collegeOptions, setCollegeOptions] = useState<Array<{ id: string; name: string }>>([])
  const [selectedCollegeIds, setSelectedCollegeIds] = useState<string[]>([])
  const [timeLimit, setTimeLimit] = useState<string>("")

  useEffect(() => {
    if (!isMentor) return
    async function fetchClasses() {
      try {
        const res = await fetch("/api/classes")
        if (res.ok) {
          const json = await res.json()
          setMentorClasses(json.classes || [])
        }
      } catch {
        // silently ignore
      }
    }
    fetchClasses()
  }, [isMentor])

  useEffect(() => {
    if (isMentor) return
    fetch("/api/colleges")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setCollegeOptions(json?.colleges || []))
      .catch(() => setCollegeOptions([]))
  }, [isMentor])

  // Ensure function-signature is only active for Java
  useEffect(() => {
    if (codingLanguage !== "java" && gradingMode === "function_signature") {
      setGradingMode("stdin_stdout")
    }
  }, [codingLanguage, gradingMode])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const resetForm = () => {
    setForm({ title: "", description: "", difficulty: "Medium" })
    setCreatedProblemId(null)
    setStatus(null)
    setDatasetColumns([])
    setDatasetRows([])
    setDatasetFileName("")
    setDatasetError(null)
  }

  const updateDatasetColumnType = (name: string, type: DatasetType) => {
    const columns = datasetColumns.map((column) => column.name === name ? { ...column, type } : column)
    setDatasetColumns(columns)
    if (problemType === "sql") setSchemaDefinition(buildSqlSeed(datasetFileName || "uploaded_data", columns, datasetRows as Record<string, string>[]))
    if (problemType === "mongodb") {
      const rows = datasetRows.map((row) => {
        if (!(name in row) || row[name] === null || row[name] === undefined) return row
        const value = row[name]
        const converted = type === "int" ? Number.parseInt(String(value), 10) : type === "float" ? Number.parseFloat(String(value)) : type === "date" ? String(value) : String(value)
        return { ...row, [name]: Number.isNaN(converted as number) ? value : converted }
      })
      setDatasetRows(rows)
      setSchemaDefinition(JSON.stringify(rows, null, 2))
    }
  }

  const handleDatasetUpload = async (file: File) => {
    setDatasetError(null)
    if (file.size > DATASET_MAX_BYTES) { setDatasetError("Dataset files must be 2 MB or smaller."); return }
    try {
      const text = await file.text()
      setDatasetFileName(file.name)
      if (problemType === "sql") {
        const parsed = parseCsv(text, file.name)
        setDatasetColumns(parsed.columns)
        setDatasetRows(parsed.rows)
        setSchemaDefinition(buildSqlSeed(parsed.table, parsed.columns, parsed.rows))
      } else {
        const parsed = parseMongoJson(text)
        setDatasetColumns(parsed.columns)
        setDatasetRows(parsed.docs)
        setSchemaDefinition(JSON.stringify(parsed.docs, null, 2))
      }
    } catch (err) { setDatasetError(err instanceof Error ? err.message : "Could not parse dataset.") }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    setCreatedProblemId(null)

    if (problemType === "open_ended" && openEndedMode === "variants") {
      if (!rawBrief.trim()) {
        setStatus({ kind: "error", message: "Problem brief is required to generate variants." })
        return
      }
    } else {
      if (!form.title.trim() || !form.description.trim()) {
        setStatus({ kind: "error", message: "Title and description are required." })
        return
      }
    }

    setSubmitting(true)
    try {
      let endpoint = "/api/problems/create"
      let payload: any = {}

      if (problemType === "sql" || problemType === "mongodb") {
        endpoint = "/api/db-problems/create"
        payload = {
          title: form.title.trim(),
          description: form.description.trim(),
          difficulty: form.difficulty,
          dbType: problemType,
          schemaDefinition: schemaDefinition.trim(),
          referenceQuery: referenceQuery.trim(),
          resultComparisonMode,
        }
      } else if (problemType === "coding") {
        endpoint = "/api/problems/create"
        if (gradingMode === "function_signature") {
          const parsedCases = functionTestCases.map((tc, idx) => {
            let inputs: any
            try {
              inputs = JSON.parse(tc.inputsJson)
            } catch {
              throw new Error(`Test Case ${idx + 1}: Inputs must be valid JSON object (e.g. {"arr": [1, 2, 3]}).`)
            }
            let expectedOutput: any
            try {
              expectedOutput = JSON.parse(tc.expectedOutput)
            } catch {
              expectedOutput = tc.expectedOutput
            }
            return {
              inputs,
              expectedOutput,
              hidden: tc.hidden,
            }
          })

          payload = {
            title: form.title.trim(),
            description: form.description.trim(),
            difficulty: form.difficulty,
            problemFormat: "coding",
            gradingMode: "function_signature",
            language: codingLanguage,
            functionName: functionName.trim(),
            returnType: returnType.trim(),
            parameters: parameters.map((p) => ({ name: p.name.trim(), type: p.type.trim() })),
            functionTestCases: parsedCases,
          }
        } else {
          // stdin_stdout
          const validCases = stdinTestCases.filter((tc) => tc.input.trim() || tc.expectedOutput.trim())
          if (validCases.length === 0) {
            throw new Error("At least one test case is required for coding problems.")
          }
          payload = {
            title: form.title.trim(),
            description: form.description.trim(),
            difficulty: form.difficulty,
            problemFormat: "coding",
            gradingMode: "stdin_stdout",
            language: codingLanguage,
            testCases: validCases,
          }
        }
      } else if (problemType === "open_ended") {
        if (openEndedMode === "variants") {
          endpoint = "/api/problems/create-with-variants"
          payload = {
            rawData: rawBrief.trim(),
            variantCount,
            difficulty: form.difficulty,
            problemFormat: "open_ended",
          }
        } else {
          endpoint = "/api/problems/create"
          payload = {
            title: form.title.trim(),
            description: form.description.trim(),
            difficulty: form.difficulty,
            problemFormat: "open_ended",
          }
        }
      }

      if (isMentor && selectedClassId && selectedClassId !== "none") {
        payload.classId = selectedClassId
      }
      if (!isMentor && selectedCollegeIds.length > 0) {
        payload.collegeIds = selectedCollegeIds
      }
      if (timeLimit.trim()) {
        payload.timeLimit = Number(timeLimit.trim())
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Failed to create ${isMentor ? "assignment" : "problem"}.`)
      }

      const newId = json.problem?._id || json.problemId || json.problem?.id
      setCreatedProblemId(newId)
      setStatus({
        kind: "success",
        message: `${isMentor ? "Assignment" : "Problem"} successfully posted! Reference ID: ${newId}`,
      })
      onCreated(newId)
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : "Failed to create problem." })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Problem ID Surfacing Success Banner (Part C) ── */}
      {createdProblemId && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2.5 text-emerald-800 font-semibold text-base">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>{isMentor ? "Assignment Created & Published!" : "Problem Created & Published!"}</span>
          </div>
          <p className="text-xs text-[#78716C]">
            Below is the permanent reference ID for this problem. Use this ID to track submissions, trigger AI ranking, or inspect candidate code.
          </p>
          <div className="flex items-center gap-3 bg-white border border-[#E8E2D9] rounded-xl p-3.5 shadow-sm">
            <code className="text-base sm:text-lg font-mono font-bold text-[#1A1A1A] select-all flex-1 tracking-wider">
              {createdProblemId}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(createdProblemId)}
              className="rounded-full border border-[#E8E2D9] bg-[#FAF7F2] text-[#1A1A1A] hover:bg-[#F5F2EC] text-xs shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1.5" />
                  <span>Copy ID</span>
                </>
              )}
            </Button>
          </div>
          <div className="flex items-center gap-3 pt-2">
            {onInspectProblem && (
              <Button
                type="button"
                size="sm"
                onClick={() => onInspectProblem(createdProblemId)}
                className="rounded-full bg-black hover:bg-zinc-800 text-white text-xs font-medium cursor-pointer"
              >
                <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" />
                Inspect Submissions Now
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetForm}
              className="text-[#78716C] hover:text-[#1A1A1A] text-xs cursor-pointer"
            >
              + Post Another Problem
            </Button>
          </div>
        </div>
      )}

      {status && !createdProblemId && <StatusBanner kind={status.kind}>{status.message}</StatusBanner>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Format Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C] font-sans">
            Step 1: Choose Problem Format
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                id: "open_ended" as const,
                title: "Open-Ended",
                icon: FileText,
                desc: "Multi-agent LLM scored analysis",
              },
              {
                id: "coding" as const,
                title: "Coding",
                icon: Code,
                desc: "Sandbox execution & test cases",
              },
              {
                id: "sql" as const,
                title: "SQL Query",
                icon: Database,
                desc: "Relational schema & SQL grading",
              },
              {
                id: "mongodb" as const,
                title: "MongoDB",
                icon: Database,
                desc: "JSON documents & aggregation",
              },
            ].map((f) => {
              const Icon = f.icon
              const isSelected = problemType === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setProblemType(f.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? "border-[#1A1A1A] bg-[#FAF7F2] text-[#1A1A1A] shadow-sm ring-1 ring-[#1A1A1A]"
                      : "border-[#E8E2D9] bg-white text-[#78716C] hover:border-[#A8A29E] hover:text-[#1A1A1A]"
                  }`}
                >
                  <div>
                    <Icon className={`h-5 w-5 mb-2 ${isSelected ? "text-[#1A1A1A]" : "text-[#78716C]"}`} />
                    <div className="text-xs font-semibold text-[#1A1A1A]">{f.title}</div>
                  </div>
                  <div className="text-[11px] text-[#78716C] mt-1.5 leading-tight">{f.desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2: Common Fields */}
        <div className="space-y-4 pt-2 border-t border-[#E8E2D9]">
          <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C] font-sans">
            Step 2: Basic Information
          </label>

          {problemType === "open_ended" && (
            <div className="flex gap-2 mb-2">
              <Button
                type="button"
                variant={openEndedMode === "manual" ? "default" : "outline"}
                size="sm"
                onClick={() => setOpenEndedMode("manual")}
                className={`text-xs font-sans rounded-full ${openEndedMode === "manual" ? "bg-black text-white hover:bg-zinc-800" : "border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#F5F2EC]"}`}
              >
                Standard Problem
              </Button>
              <Button
                type="button"
                variant={openEndedMode === "variants" ? "default" : "outline"}
                size="sm"
                onClick={() => setOpenEndedMode("variants")}
                className={`text-xs font-sans rounded-full ${openEndedMode === "variants" ? "bg-black text-white hover:bg-zinc-800" : "border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#F5F2EC]"}`}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                Generate Variants with AI
              </Button>
            </div>
          )}

          {problemType === "open_ended" && openEndedMode === "variants" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[#1A1A1A] font-sans text-sm font-medium">Problem Brief for AI Variant Generator</Label>
                <Textarea
                  value={rawBrief}
                  onChange={(e) => setRawBrief(e.target.value)}
                  placeholder="Paste your raw problem brief here. Shellfish will extract skills and synthesize variants..."
                  className="min-h-[140px] bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] placeholder:text-[#A8A29E] font-sans resize-none focus:border-[#1A1A1A] focus:bg-white"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#1A1A1A] font-sans text-sm font-medium">Number of Variants (1–5)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={variantCount}
                    onChange={(e) => setVariantCount(Math.min(5, Math.max(1, Number(e.target.value))))}
                    className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] font-sans focus:border-[#1A1A1A] focus:bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1A1A1A] font-sans text-sm font-medium">Difficulty</Label>
                  <Select value={form.difficulty} onValueChange={(d) => setForm({ ...form, difficulty: d })}>
                    <SelectTrigger className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-[#E8E2D9] text-[#1A1A1A]">
                      <SelectItem value="Easy">Easy</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label className="text-[#1A1A1A] font-sans text-sm font-medium">
                    Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Distributed Consensus Engine"
                    className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] placeholder:text-[#A8A29E] font-sans focus:border-[#1A1A1A] focus:bg-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#1A1A1A] font-sans text-sm font-medium">Difficulty</Label>
                  <Select value={form.difficulty} onValueChange={(d) => setForm({ ...form, difficulty: d })}>
                    <SelectTrigger className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-[#E8E2D9] text-[#1A1A1A]">
                      <SelectItem value="Easy">Easy</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[#1A1A1A] font-sans text-sm font-medium">
                  Description / Problem Statement <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Explain the problem requirements, constraints, and expected outcome..."
                  className="min-h-[100px] bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] placeholder:text-[#A8A29E] font-sans resize-none focus:border-[#1A1A1A] focus:bg-white"
                  required
                />
              </div>

              {isMentor && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E8E2D9]/60">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#1A1A1A] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#3F3FF3]" />
                      Assign to Class (Optional)
                    </Label>
                    <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                      <SelectTrigger className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] text-xs h-9">
                        <SelectValue placeholder="All College Students (Public)" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-[#E8E2D9] text-[#1A1A1A]">
                        <SelectItem value="none">All College Students (Public)</SelectItem>
                        {mentorClasses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.classId})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-[#1A1A1A] flex items-center gap-1.5">
                      <Timer className="w-3.5 h-3.5 text-[#3F3FF3]" />
                      Time Limit (minutes, optional)
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="e.g. 45 (leave blank for unlimited)"
                      value={timeLimit}
                      onChange={(e) => setTimeLimit(e.target.value)}
                      className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] text-xs h-9"
                    />
                  </div>
                </div>
              )}
              {!isMentor && (
                <div className="space-y-2 pt-2 border-t border-[#E8E2D9]/60">
                  <Label className="text-xs font-medium text-[#1A1A1A]">Visible to colleges</Label>
                  <p className="text-[11px] text-[#78716C]">Leave empty to make this problem visible to all colleges.</p>
                  <div className="flex flex-wrap gap-2">
                    {collegeOptions.map((college) => (
                      <label key={college.id} className="flex items-center gap-2 rounded-lg border border-[#E8E2D9] bg-[#FAF7F2] px-3 py-2 text-xs text-[#1A1A1A]">
                        <Checkbox
                          checked={selectedCollegeIds.includes(college.id)}
                          onCheckedChange={(checked) => setSelectedCollegeIds((current) => checked ? [...current, college.id] : current.filter((id) => id !== college.id))}
                        />
                        {college.name} ({college.id})
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Format-Specific Fields */}
        {problemType === "coding" && (
          <div className="space-y-5 pt-4 border-t border-[#E8E2D9]">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C] font-sans">
              Step 3: Coding Execution & Grading Mode
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#1A1A1A] font-sans text-sm font-medium">Target Language</Label>
                <Select
                  value={codingLanguage}
                  onValueChange={(val: any) => {
                    setCodingLanguage(val)
                    if (val !== "java") setGradingMode("stdin_stdout")
                  }}
                >
                  <SelectTrigger className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-[#E8E2D9] text-[#1A1A1A]">
                    <SelectItem value="java">Java (15+)</SelectItem>
                    <SelectItem value="python">Python (3.10+)</SelectItem>
                    <SelectItem value="c">C (GCC 9.2+)</SelectItem>
                    <SelectItem value="cpp">C++ (GCC 9.2+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[#1A1A1A] font-sans text-sm font-medium">Grading Architecture</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (codingLanguage === "java") setGradingMode("function_signature")
                    }}
                    disabled={codingLanguage !== "java"}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all relative ${
                      gradingMode === "function_signature"
                        ? "border-[#1A1A1A] bg-[#FAF7F2] text-[#1A1A1A] ring-1 ring-[#1A1A1A]"
                        : codingLanguage === "java"
                        ? "border-[#E8E2D9] bg-white text-[#78716C] hover:border-[#A8A29E] hover:text-[#1A1A1A] cursor-pointer"
                        : "border-[#E8E2D9]/60 bg-[#FAF7F2]/60 text-[#A8A29E] cursor-not-allowed opacity-60"
                    }`}
                  >
                    <div>Function-Signature</div>
                    {codingLanguage !== "java" && (
                      <span className="text-[10px] text-amber-600 font-mono block mt-0.5">Coming Soon</span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setGradingMode("stdin_stdout")}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition-all cursor-pointer ${
                      gradingMode === "stdin_stdout"
                        ? "border-[#1A1A1A] bg-[#FAF7F2] text-[#1A1A1A] ring-1 ring-[#1A1A1A]"
                        : "border-[#E8E2D9] bg-white text-[#78716C] hover:border-[#A8A29E] hover:text-[#1A1A1A]"
                    }`}
                  >
                    <div>Stdin / Stdout</div>
                    <span className="text-[10px] text-[#A8A29E] block mt-0.5">All Languages</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Function-Signature Parameters & Cases Builder (Java) */}
            {gradingMode === "function_signature" ? (
              <div className="space-y-4 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] p-5">
                <div className="text-xs uppercase tracking-wider font-bold text-[#1A1A1A]">
                  Java Function Specification
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-[#78716C]">Method Name</Label>
                    <Input
                      value={functionName}
                      onChange={(e) => setFunctionName(e.target.value)}
                      placeholder="e.g. isMirrorSequence"
                      className="bg-white border-[#E8E2D9] text-[#1A1A1A] font-mono text-xs focus:border-[#1A1A1A]"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-[#78716C]">Return Type</Label>
                    <Select value={returnType} onValueChange={setReturnType}>
                      <SelectTrigger className="bg-white border-[#E8E2D9] text-[#1A1A1A] font-mono text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-[#E8E2D9] text-[#1A1A1A] font-mono text-xs">
                        <SelectItem value="boolean">boolean</SelectItem>
                        <SelectItem value="int">int</SelectItem>
                        <SelectItem value="String">String</SelectItem>
                        <SelectItem value="double">double</SelectItem>
                        <SelectItem value="int[]">int[]</SelectItem>
                        <SelectItem value="String[]">String[]</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Parameters List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-[#78716C]">Parameters ({parameters.length})</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setParameters((p) => [...p, { name: `param${p.length + 1}`, type: "int" }])}
                      className="rounded-full border border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#F5F2EC] text-xs h-7"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Parameter
                    </Button>
                  </div>
                  {parameters.map((param, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={param.name}
                        onChange={(e) =>
                          setParameters((params) =>
                            params.map((p, idx) => (idx === i ? { ...p, name: e.target.value } : p))
                          )
                        }
                        placeholder="Parameter Name"
                        className="bg-white border-[#E8E2D9] text-[#1A1A1A] font-mono text-xs flex-1 focus:border-[#1A1A1A]"
                        required
                      />
                      <Select
                        value={param.type}
                        onValueChange={(val) =>
                          setParameters((params) =>
                            params.map((p, idx) => (idx === i ? { ...p, type: val } : p))
                          )
                        }
                      >
                        <SelectTrigger className="bg-white border-[#E8E2D9] text-[#1A1A1A] font-mono text-xs w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border border-[#E8E2D9] text-[#1A1A1A] font-mono text-xs">
                          <SelectItem value="int">int</SelectItem>
                          <SelectItem value="int[]">int[]</SelectItem>
                          <SelectItem value="boolean">boolean</SelectItem>
                          <SelectItem value="String">String</SelectItem>
                          <SelectItem value="String[]">String[]</SelectItem>
                          <SelectItem value="double">double</SelectItem>
                        </SelectContent>
                      </Select>
                      {parameters.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setParameters((params) => params.filter((_, idx) => idx !== i))}
                          className="text-[#A8A29E] hover:text-red-600 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Function Test Cases */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-[#78716C]">Function Test Cases ({functionTestCases.length})</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setFunctionTestCases((tcs) => [
                          ...tcs,
                          { inputsJson: "{}", expectedOutput: "true", hidden: false },
                        ])
                      }
                      className="rounded-full border border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#F5F2EC] text-xs h-7"
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Case
                    </Button>
                  </div>
                  {functionTestCases.map((tc, i) => (
                    <div key={i} className="rounded-xl border border-[#E8E2D9] bg-white p-3 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#1A1A1A]">Case {i + 1}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs text-[#78716C] cursor-pointer">
                            <Checkbox
                              checked={tc.hidden}
                              onCheckedChange={(c) =>
                                setFunctionTestCases((tcs) =>
                                  tcs.map((t, idx) => (idx === i ? { ...t, hidden: !!c } : t))
                                )
                              }
                            />
                            <span>Hidden</span>
                          </label>
                          {functionTestCases.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setFunctionTestCases((tcs) => tcs.filter((_, idx) => idx !== i))}
                              className="text-[#A8A29E] hover:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <span className="text-[11px] text-[#78716C] font-mono">Inputs JSON (object)</span>
                          <Input
                            value={tc.inputsJson}
                            onChange={(e) =>
                              setFunctionTestCases((tcs) =>
                                tcs.map((t, idx) => (idx === i ? { ...t, inputsJson: e.target.value } : t))
                              )
                            }
                            placeholder='e.g. {"arr": [1, 2, 3, 2, 1]}'
                            className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] font-mono text-xs focus:border-[#1A1A1A] focus:bg-white"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[11px] text-[#78716C] font-mono">Expected Output</span>
                          <Input
                            value={tc.expectedOutput}
                            onChange={(e) =>
                              setFunctionTestCases((tcs) =>
                                tcs.map((t, idx) => (idx === i ? { ...t, expectedOutput: e.target.value } : t))
                              )
                            }
                            placeholder="e.g. true"
                            className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] font-mono text-xs focus:border-[#1A1A1A] focus:bg-white"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Stdin / Stdout Test Cases Builder */
              <div className="space-y-3 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] p-5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-[#78716C]">Stdin / Stdout Test Cases ({stdinTestCases.length})</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setStdinTestCases((tcs) => [...tcs, { input: "", expectedOutput: "", hidden: false }])}
                    className="rounded-full border border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#F5F2EC] text-xs h-7"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Case
                  </Button>
                </div>
                {stdinTestCases.map((tc, i) => (
                  <div key={i} className="rounded-xl border border-[#E8E2D9] bg-white p-3 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1A1A1A]">Case {i + 1}</span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-[#78716C] cursor-pointer">
                          <Checkbox
                            checked={tc.hidden}
                            onCheckedChange={(c) =>
                              setStdinTestCases((tcs) =>
                                tcs.map((t, idx) => (idx === i ? { ...t, hidden: !!c } : t))
                              )
                            }
                          />
                          <span>Hidden</span>
                        </label>
                        {stdinTestCases.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setStdinTestCases((tcs) => tcs.filter((_, idx) => idx !== i))}
                            className="text-[#A8A29E] hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[11px] text-[#78716C] font-mono">Standard Input (stdin)</span>
                        <Textarea
                          value={tc.input}
                          onChange={(e) =>
                            setStdinTestCases((tcs) =>
                              tcs.map((t, idx) => (idx === i ? { ...t, input: e.target.value } : t))
                            )
                          }
                          placeholder="e.g. 5\n1 2 3"
                          className="min-h-[60px] bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] font-mono text-xs resize-none focus:border-[#1A1A1A] focus:bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-[#78716C] font-mono">Expected Output (stdout)</span>
                        <Textarea
                          value={tc.expectedOutput}
                          onChange={(e) =>
                            setStdinTestCases((tcs) =>
                              tcs.map((t, idx) => (idx === i ? { ...t, expectedOutput: e.target.value } : t))
                            )
                          }
                          placeholder="e.g. 6"
                          className="min-h-[60px] bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] font-mono text-xs resize-none focus:border-[#1A1A1A] focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Database Problem Fields (SQL / MongoDB) */}
        {(problemType === "sql" || problemType === "mongodb") && (
          <div className="space-y-4 pt-4 border-t border-[#E8E2D9]">
            <label className="text-xs font-semibold uppercase tracking-wider text-[#78716C] font-sans">
              Step 3: {problemType === "sql" ? "SQL Schema & Reference Query" : "MongoDB Collections & Aggregation"}
            </label>

            <div className="space-y-2">
              <Label className="text-[#1A1A1A] font-sans text-sm font-medium">
                {problemType === "sql" ? "Schema DDL & Insert Statements" : "Seed Documents (JSON Array)"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={schemaDefinition}
                onChange={(e) => setSchemaDefinition(e.target.value)}
                placeholder={
                  problemType === "sql"
                    ? "CREATE TABLE users (id INT, role TEXT);\nINSERT INTO users VALUES (1, 'engineer');"
                    : '[{"_id": 1, "name": "Alice", "role": "engineer"}]'
                }
                className="min-h-[110px] bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] font-mono text-xs resize-none focus:border-[#1A1A1A] focus:bg-white"
                required
              />
              <div className="rounded-xl border border-dashed border-[#A8A29E] bg-[#FAF7F2] p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-xs font-semibold text-[#1A1A1A]">Upload dataset</p><p className="text-[11px] text-[#78716C]">{problemType === "sql" ? "One CSV file becomes one table." : "A JSON array becomes the Mongo documents."} Max 2 MB / 1,000 rows.</p></div>
                  <Input type="file" accept={problemType === "sql" ? ".csv,text/csv" : ".json,application/json"} onChange={(e) => e.target.files?.[0] && handleDatasetUpload(e.target.files[0])} className="max-w-[230px] text-xs" />
                </div>
                {datasetError && <p className="text-xs text-red-700">{datasetError}</p>}
                {datasetColumns.length > 0 && <div className="space-y-2"><p className="text-[11px] font-semibold text-[#1A1A1A]">Confirm inferred types{datasetFileName ? ` · ${datasetFileName}` : ""}</p><div className="flex flex-wrap gap-2">{datasetColumns.map((column) => <label key={column.name} className="flex items-center gap-1 rounded-lg border border-[#E8E2D9] bg-white px-2 py-1 text-xs"><span>{column.name}</span><select value={column.type} onChange={(e) => updateDatasetColumnType(column.name, e.target.value as DatasetType)} className="rounded border border-[#E8E2D9] bg-white px-1 py-0.5 text-xs"><option value="int">int</option><option value="float">float</option><option value="date">date</option><option value="text">text</option></select></label>)}</div></div>}
                {datasetRows.length > 0 && <div className="overflow-x-auto rounded-lg border border-[#E8E2D9] bg-white"><table className="min-w-full text-left text-[11px]"><thead><tr>{datasetColumns.map((column) => <th key={column.name} className="px-2 py-1.5 font-semibold">{column.name}</th>)}</tr></thead><tbody>{datasetRows.slice(0, 10).map((row, index) => <tr key={index} className="border-t border-[#E8E2D9]">{datasetColumns.map((column) => <td key={column.name} className="max-w-[180px] truncate px-2 py-1.5">{typeof row[column.name] === "object" ? JSON.stringify(row[column.name]) : String(row[column.name] ?? "")}</td>)}</tr>)}</tbody></table></div>}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[#1A1A1A] font-sans text-sm font-medium">
                Reference Solution Query <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={referenceQuery}
                onChange={(e) => setReferenceQuery(e.target.value)}
                placeholder={
                  problemType === "sql"
                    ? "SELECT id, name FROM users WHERE role = 'engineer'"
                    : '{"role": "engineer"}'
                }
                className="min-h-[70px] bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] font-mono text-xs resize-none focus:border-[#1A1A1A] focus:bg-white"
                required
              />
              <p className="text-[11px] text-[#78716C]">
                Executed live in sandbox on save to verify syntax and generate the golden reference answer key.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-[#1A1A1A] font-sans text-sm font-medium">Row Order Matching</Label>
              <Select value={resultComparisonMode} onValueChange={(val: any) => setResultComparisonMode(val)}>
                <SelectTrigger className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white border border-[#E8E2D9] text-[#1A1A1A] text-xs">
                  <SelectItem value="unordered">Unordered (Row order does not matter)</SelectItem>
                  <SelectItem value="ordered">Ordered (Strict row sequence match required)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-black hover:bg-zinc-800 text-white font-medium py-3 transition-all cursor-pointer"
          >
            {submitting ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Publishing {isMentor ? "Assignment" : "Problem"}...</span>
              </div>
            ) : (
              `Publish ${isMentor ? "Assignment" : "Problem"}`
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MY PROBLEMS LIST TABLE (Part C)
// ═══════════════════════════════════════════════════════════════════════════

interface ProblemListItem {
  id: string
  title: string
  description?: string
  format: string
  companyName?: string | null
  className?: string | null
  postedAt?: string
  gradingMode?: string | null
  language?: string | null
  difficulty?: string
  status?: string
  submissionCount?: number
  isDbProblem?: boolean
  createdAt?: string
}

function MyProblemsList({
  onSelectProblem,
  selectedProblemId,
  refreshKey,
  isMentor,
  studentMode,
}: {
  onSelectProblem: (id: string, isDb: boolean) => void
  selectedProblemId: string | null
  refreshKey: number
  isMentor?: boolean
  studentMode?: boolean
}) {
  const [problems, setProblems] = useState<ProblemListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    async function loadProblems() {
      setLoading(true)
      try {
        const res = await fetch("/api/problems")
        if (res.ok) {
          const json = await res.json()
          if (json.success && Array.isArray(json.problems)) {
            setProblems(json.problems)
          }
        }
      } catch (err) {
        console.error("Failed to load problems list:", err)
      } finally {
        setLoading(false)
      }
    }
    loadProblems()
  }, [refreshKey])

  const copyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl bg-[#F5F2EC]" />
        ))}
      </div>
    )
  }

  if (problems.length === 0) {
    if (studentMode) {
      return (
        <div className="rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] p-6 text-center">
          <p className="text-sm text-[#78716C]">No problems yet — check back soon</p>
        </div>
      )
    }
    return (
      <div className="rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] p-8 text-center space-y-2">
        <FileText className="h-8 w-8 text-[#A8A29E] mx-auto" />
        <h4 className="text-sm font-semibold text-[#1A1A1A]">
          {isMentor ? "No assignments posted yet" : "No problems posted yet"}
        </h4>
        <p className="text-xs text-[#78716C] max-w-sm mx-auto">
          {isMentor
            ? "Create your first class assignment using the + Add Assignment button above."
            : "Create your first problem statement using the + Add Problem button above."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-[#78716C] px-1">
        <span>
          Showing {problems.length} {isMentor ? "assignment(s)" : "problem(s)"}
        </span>
      </div>

      <div className="divide-y divide-[#E8E2D9] rounded-xl border border-[#E8E2D9] bg-white overflow-hidden shadow-sm">
        {problems.map((prob) => {
          const isSelected = selectedProblemId === prob.id
          if (studentMode) {
            return (
              <button
                type="button"
                key={prob.id}
                onClick={() => onSelectProblem(prob.id, prob.format === "sql" || prob.format === "mongodb")}
                className={`w-full p-4 text-left transition-colors flex items-center justify-between gap-3 ${isSelected ? "bg-[#FAF7F2] border-l-4 border-l-[#1A1A1A]" : "hover:bg-[#FAF7F2]"}`}
              >
                <span className="min-w-0 space-y-1">
                  <span className="block truncate text-sm font-semibold text-[#1A1A1A]">{prob.title}</span>
                  <span className="flex flex-wrap gap-2 text-xs text-[#78716C]">
                    <span>{prob.format.toUpperCase()}</span>
                    {(prob.companyName || prob.className) && <span>• {prob.companyName || prob.className}</span>}
                    {prob.postedAt && <span>• {new Date(prob.postedAt).toLocaleDateString()}</span>}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#78716C]" />
              </button>
            )
          }
          let formatBadgeText = prob.format.toUpperCase()
          if (prob.format === "coding") {
            formatBadgeText = prob.gradingMode === "function_signature" ? "CODING (FUNC)" : "CODING (STDIN)"
          } else if (prob.format === "sql") {
            formatBadgeText = "SQL QUERY"
          } else if (prob.format === "mongodb") {
            formatBadgeText = "MONGO DB"
          }

          return (
            <div
              key={prob.id}
              className={`p-4 sm:p-5 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isSelected ? "bg-[#FAF7F2] border-l-4 border-l-[#1A1A1A]" : "hover:bg-[#FAF7F2]"
              }`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm text-[#1A1A1A] font-sans truncate">{prob.title}</h3>
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase font-bold border px-2 py-0.5 ${
                      prob.difficulty === "Easy"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : prob.difficulty === "Hard"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {prob.difficulty}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono border-[#E8E2D9] bg-[#FAF7F2] text-[#57534E] px-2 py-0.5"
                  >
                    {formatBadgeText}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#78716C] font-mono flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => copyId(prob.id, e)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FAF7F2] border border-[#E8E2D9] text-[#1A1A1A] hover:bg-[#F5F2EC] transition-colors cursor-pointer text-[11px]"
                    title="Click to copy ID"
                  >
                    <span>ID: {prob.id}</span>
                    {copiedId === prob.id ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3 opacity-60" />
                    )}
                  </button>
                  <span>•</span>
                  <span>{prob.submissionCount ?? 0} Submission(s)</span>
                  <span>•</span>
                  <span>{prob.createdAt && new Date(prob.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <Button
                  size="sm"
                  onClick={() => onSelectProblem(prob.id, Boolean(prob.isDbProblem))}
                  className={`text-xs font-medium rounded-full cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-black text-white hover:bg-zinc-800"
                      : "border border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#F5F2EC]"
                  }`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                  {isSelected ? "Inspecting" : "Inspect Submissions"}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HIRING MANAGER — Variant generator (P3)
// ═══════════════════════════════════════════════════════════════════════════

function VariantGeneratorForm({ onCreated, isMentor }: { onCreated: () => void; isMentor?: boolean }) {
  const [rawBrief, setRawBrief] = useState("")
  const [variantCount, setVariantCount] = useState(3)
  const [difficulty, setDifficulty] = useState("Medium")
  const [problemFormat, setProblemFormat] = useState<"open_ended" | "coding">("open_ended")
  const [codingLanguage, setCodingLanguage] = useState("python")
  const [generating, setGenerating] = useState(false)
  const [genStatus, setGenStatus] = useState<{ kind: "error" | "success"; message: string } | null>(null)
  const [showResend, setShowResend] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(false)

  // Editable review state after generation
  const [generatedVariants, setGeneratedVariants] = useState<Variant[]>([])
  const [generatedSkills, setGeneratedSkills] = useState<SkillEntry[]>([])
  const [savedProblemId, setSavedProblemId] = useState<string | null>(null)

  async function handleResend() {
    setResendCooldown(true)
    try {
      const res = await fetch("/api/user/resend-verification", { method: "POST" })
      const json = await res.json().catch(() => ({}))
      setGenStatus({
        kind: res.ok ? "success" : "error",
        message: res.ok ? "Verification email sent — check your inbox." : (json.error ?? "Could not resend."),
      })
    } catch {
      setGenStatus({ kind: "error", message: "Network error." })
    }
    setTimeout(() => setResendCooldown(false), 120_000)
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setGenStatus(null)
    setShowResend(false)
    setGeneratedVariants([])
    setGeneratedSkills([])
    setSavedProblemId(null)

    if (!rawBrief.trim()) {
      setGenStatus({ kind: "error", message: `Please provide ${isMentor ? "an assignment" : "a problem"} brief.` })
      return
    }

    setGenerating(true)
    try {
      const res = await fetch("/api/problems/create-with-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawData: rawBrief.trim(),
          variantCount,
          difficulty,
          problemFormat,
          language: problemFormat === "coding" ? codingLanguage : undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))

      if (res.status === 403) {
        if (json.error?.toLowerCase().includes("verify")) {
          setGenStatus({ kind: "error", message: `Please verify your email before posting ${isMentor ? "assignments" : "problems"}.` })
          setShowResend(true)
          return
        }
        setGenStatus({ kind: "error", message: json.error ?? "Permission denied." })
        return
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Variant generation failed.")
      }

      setGeneratedVariants(json.ai.variants ?? [])
      setGeneratedSkills(json.ai.requiredSkillsExtracted ?? [])
      setSavedProblemId(json.problem._id)
      setGenStatus({ kind: "success", message: `${isMentor ? "Assignment" : "Problem"} saved (ID: ${json.problem._id}). Review below.` })
      setRawBrief("")
      onCreated()
    } catch (err) {
      setGenStatus({ kind: "error", message: err instanceof Error ? err.message : "Generation failed." })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleGenerate} className="space-y-4">
        {genStatus && (
          <div className="space-y-2">
            <StatusBanner kind={genStatus.kind}>{genStatus.message}</StatusBanner>
            {showResend && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resendCooldown}
                onClick={handleResend}
                className="rounded-full border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-sans text-xs"
              >
                {resendCooldown ? "Email sent — check inbox" : "Resend verification email"}
              </Button>
            )}
          </div>
        )}

        {/* Format Toggle */}
        <div className="space-y-1.5">
          <label className="text-xs text-[#78716C] font-sans font-medium">Format</label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={problemFormat === "open_ended" ? "default" : "outline"}
              size="sm"
              onClick={() => setProblemFormat("open_ended")}
              className={`rounded-full text-xs font-sans ${problemFormat === "open_ended" ? "bg-black text-white hover:bg-zinc-800" : "border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#FAF7F2]"}`}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Open-Ended
            </Button>
            <Button
              type="button"
              variant={problemFormat === "coding" ? "default" : "outline"}
              size="sm"
              onClick={() => setProblemFormat("coding")}
              className={`rounded-full text-xs font-sans ${problemFormat === "coding" ? "bg-black text-white hover:bg-zinc-800" : "border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#FAF7F2]"}`}
            >
              <Code className="h-3.5 w-3.5 mr-1.5" />
              Coding
            </Button>
          </div>
        </div>

        {problemFormat === "coding" && (
          <div className="space-y-1.5">
            <label className="text-xs text-[#78716C] font-sans font-medium">Target Language</label>
            <select
              value={codingLanguage}
              onChange={(e) => setCodingLanguage(e.target.value)}
              className="w-full rounded-md border border-[#E8E2D9] bg-white px-3 py-2 text-xs text-[#1A1A1A] font-sans focus:border-black"
            >
              <option value="python">Python (3.10+)</option>
              <option value="java">Java (15+)</option>
              <option value="c">C (GCC 9.2+)</option>
              <option value="cpp">C++ (GCC 9.2+)</option>
            </select>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-[#1A1A1A] font-sans text-sm font-medium">{isMentor ? "Assignment brief" : "Problem brief"}</Label>
          <Textarea
            value={rawBrief}
            onChange={(e) => setRawBrief(e.target.value)}
            placeholder={isMentor ? "Paste or write your raw assignment brief here. Shellfish will extract skills and generate variants…" : "Paste or write your raw problem brief here. Shellfish will extract skills and generate variants…"}
            className="min-h-[160px] bg-white border-[#E8E2D9] text-[#1A1A1A] placeholder:text-[#A8A29E] font-sans resize-none focus:border-black"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[#1A1A1A] font-sans text-sm font-medium">Number of variants (1–5)</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={variantCount}
              onChange={(e) => setVariantCount(Math.min(5, Math.max(1, Number(e.target.value))))}
              className="bg-white border-[#E8E2D9] text-[#1A1A1A] font-sans focus:border-black"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[#1A1A1A] font-sans text-sm font-medium">Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="bg-white border-[#E8E2D9] text-[#1A1A1A]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border border-[#E8E2D9] text-[#1A1A1A]">
                <SelectItem value="Easy">Easy</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          type="submit"
          disabled={generating}
          className="rounded-full bg-black text-white hover:bg-zinc-800 disabled:opacity-60 text-xs px-5 py-2 font-medium"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          {generating ? "Generating variants…" : "Generate with AI"}
        </Button>
      </form>

      {/* ── AI-generated review panel ── */}
      {generatedVariants.length > 0 && (
        <div className="space-y-5 border-t border-[#E8E2D9] pt-5">
          <div>
            <p className="text-xs text-[#78716C] font-sans mb-1">{isMentor ? "Saved Assignment ID" : "Saved Problem ID"}</p>
            <code className="text-xs text-[#1A1A1A] bg-[#FAF7F2] border border-[#E8E2D9] rounded px-2 py-0.5 font-mono">{savedProblemId}</code>
          </div>

          {/* Extracted skills */}
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A] font-sans mb-2">
              AI-extracted required skills{" "}
              <span className="text-xs text-[#78716C] font-normal">(AI suggestion — editable for reference)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {generatedSkills.map((skill, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-full bg-[#FAF7F2] border border-[#E8E2D9] px-3 py-1">
                  <input
                    className="bg-transparent text-xs text-[#1A1A1A] font-sans outline-none w-24"
                    value={skill.name}
                    onChange={(e) =>
                      setGeneratedSkills((prev) =>
                        prev.map((s, idx) => (idx === i ? { ...s, name: e.target.value } : s))
                      )
                    }
                  />
                  <span className="text-[#78716C] text-xs">×{skill.weight}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Variants */}
          <div>
            <p className="text-sm font-semibold text-[#1A1A1A] font-sans mb-3">Generated variants</p>
            <div className="space-y-3">
              {generatedVariants.map((v, i) => (
                <div
                  key={v.variantId}
                  className={`rounded-2xl border p-4 space-y-2 shadow-xs ${
                    v.generationFailed
                      ? "border-red-200 bg-red-50/50"
                      : "border-[#E8E2D9] bg-[#FAF7F2]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#78716C] font-sans">Variant {i + 1}</span>
                    {v.generationFailed && (
                      <Badge className="text-xs border-0 bg-red-100 text-red-700 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Failed to generate
                      </Badge>
                    )}
                  </div>
                  {v.generationFailed ? (
                    <p className="text-xs text-red-600 font-sans">
                      This variant failed to generate. You can re-run the brief to retry.
                    </p>
                  ) : (
                    <>
                      <input
                        className="w-full bg-transparent text-sm font-semibold text-[#1A1A1A] font-sans outline-none border-b border-[#E8E2D9] pb-1"
                        value={v.title}
                        onChange={(e) =>
                          setGeneratedVariants((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x))
                          )
                        }
                      />
                      <Textarea
                        value={v.description}
                        onChange={(e) =>
                          setGeneratedVariants((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, description: e.target.value } : x))
                          )
                        }
                        className="min-h-[80px] bg-white border-[#E8E2D9] text-[#1A1A1A] text-xs font-sans resize-none focus:border-black"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HIRING MANAGER — Submissions panel for a single problem (P2)
// ═══════════════════════════════════════════════════════════════════════════

function SubmissionsPanel({ problemId }: { problemId: string }) {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [ranking, setRanking] = useState(false)
  const [rankStatus, setRankStatus] = useState<{ kind: "error" | "success" | "info"; message: string } | null>(null)

  useEffect(() => {
    loadSubmissions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId])

  async function loadSubmissions() {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/submissions/for-problem/${problemId}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? "Failed to load submissions.")
      }
      const json = await res.json()
      const sorted = [...(json.submissions ?? [])].sort(
        (a: Submission, b: Submission) => (b.aiScore ?? -1) - (a.aiScore ?? -1)
      )
      setSubmissions(sorted)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  async function handleRank() {
    setRankStatus(null)
    setRanking(true)
    try {
      const res = await fetch(`/api/submissions/rank/${problemId}`, { method: "POST" })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(json.error ?? "Ranking failed.")
      }
      if (json.ranked?.length === 0) {
        setRankStatus({ kind: "info", message: "No unscored submissions to rank." })
      } else {
        setRankStatus({ kind: "success", message: `Ranked ${json.ranked.length} submission(s). Scores updated!` })
        await loadSubmissions()
      }
    } catch (err) {
      setRankStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Ranking failed. Please try again.",
      })
    } finally {
      setRanking(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 pt-3">
        {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl bg-[#E8E2D9]/40" />)}
      </div>
    )
  }

  if (fetchError) {
    return <div className="pt-3"><StatusBanner kind="error">{fetchError}</StatusBanner></div>
  }

  return (
    <div className="pt-3 space-y-4">
      {rankStatus && <StatusBanner kind={rankStatus.kind}>{rankStatus.message}</StatusBanner>}

      <div className="flex items-center justify-between">
        <p className="text-xs text-[#78716C] font-sans">{submissions.length} submission(s)</p>
        <Button
          size="sm"
          disabled={ranking || submissions.length === 0}
          onClick={handleRank}
          className="rounded-full bg-black text-white hover:bg-zinc-800 disabled:opacity-60 text-xs px-4"
        >
          <Trophy className="h-3.5 w-3.5 mr-1.5" />
          {ranking ? "Ranking… this may take a moment" : "Rank submissions"}
        </Button>
      </div>

      {submissions.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-8 w-8 text-[#A8A29E] mx-auto mb-2" />
          <p className="text-[#78716C] text-sm font-sans">No submissions yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map((sub, idx) => {
            const studentName =
              typeof sub.studentId === "object" && sub.studentId?.username
                ? sub.studentId.username
                : "Student"
            const gateFailed = sub.correctnessGatePassed === false
            return (
              <div key={sub._id} className={`rounded-xl border px-4 py-3 shadow-xs ${gateFailed ? "border-red-200 bg-red-50/30 opacity-80" : "border-[#E8E2D9] bg-white"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {sub.status === "scored" && (
                        <span className="text-xs text-[#78716C] font-sans font-bold">#{idx + 1}</span>
                      )}
                      <p className="text-sm font-medium text-[#1A1A1A] font-sans truncate">{studentName}</p>
                      {sub.fileType && (
                        <Badge className="text-xs border border-[#E8E2D9] bg-[#FAF7F2] text-[#78716C]">
                          {sub.fileType.toUpperCase()}
                        </Badge>
                      )}
                      {sub.language && (
                        <Badge className="text-xs border border-[#E8E2D9] bg-[#FAF7F2] text-[#78716C]">
                          {sub.language.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-[#78716C] font-sans">{new Date(sub.submittedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sub.aiScore != null && <ScoreBadge score={sub.aiScore} />}
                    {sub.correctnessGatePassed !== null && sub.correctnessGatePassed !== undefined && (
                      <Badge className={`text-xs border ${sub.correctnessGatePassed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                        {sub.correctnessScore !== undefined ? `${Math.round(sub.correctnessScore * 100)}% tests` : sub.correctnessGatePassed ? "✓ gate" : "✗ gate"}
                      </Badge>
                    )}
                    <Badge
                      className={`text-xs border ${
                        sub.status === "scored" ? "bg-blue-50 text-blue-700 border-blue-200"
                        : sub.status === "failed_gate" ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-[#FAF7F2] text-[#78716C] border-[#E8E2D9]"
                      }`}
                    >
                      {sub.status}
                    </Badge>
                  </div>
                </div>
                {sub.aiRationale && (
                  <p className="mt-2 text-xs text-[#78716C] font-sans line-clamp-2">{sub.aiRationale}</p>
                )}
                {gateFailed && (
                  <p className="mt-1 text-xs text-red-600 font-sans">Did not pass correctness gate — excluded from ranking</p>
                )}
                {sub.flags && sub.flags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {sub.flags.map((flag) => (
                      <Badge key={flag} className="text-xs border border-amber-200 bg-amber-50 text-amber-800">
                        {flag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HIRING MANAGER / MENTOR — Database submissions panel for a single problem
// ═══════════════════════════════════════════════════════════════════════════

interface DbSubmissionItem {
  id: string
  _id?: string
  studentName: string
  studentEmail?: string
  studentCollege?: string
  query: string
  actualResult: any
  passed: boolean
  error?: string | null
  status: string
  submittedAt: string
}

function DbSubmissionsPanel({ problemId }: { problemId: string }) {
  const [submissions, setSubmissions] = useState<DbSubmissionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    loadSubmissions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problemId])

  async function loadSubmissions() {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/db-submissions/for-problem/${problemId}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? "Failed to load database submissions.")
      }
      const json = await res.json()
      setSubmissions(json.submissions ?? [])
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 pt-3">
        {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl bg-[#E8E2D9]/40" />)}
      </div>
    )
  }

  if (fetchError) {
    return <div className="pt-3"><StatusBanner kind="error">{fetchError}</StatusBanner></div>
  }

  return (
    <div className="pt-3 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#78716C] font-sans">{submissions.length} database submission(s)</p>
        <Button
          size="sm"
          variant="outline"
          onClick={loadSubmissions}
          className="rounded-full border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#FAF7F2] text-xs font-sans"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {submissions.length === 0 ? (
        <div className="text-center py-8">
          <Database className="h-8 w-8 text-[#A8A29E] mx-auto mb-2" />
          <p className="text-[#78716C] text-sm font-sans">No database submissions yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => {
            const gateFailed = !sub.passed || sub.status === "failed_gate"
            return (
              <div
                key={sub.id || sub._id}
                className={`rounded-2xl border p-4 space-y-3 transition-colors shadow-xs ${
                  gateFailed
                    ? "border-red-200 bg-red-50/30 opacity-80"
                    : "border-[#E8E2D9] bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#1A1A1A] font-sans truncate">{sub.studentName}</p>
                      {sub.studentCollege && (
                        <span className="text-xs text-[#78716C] font-sans font-mono">({sub.studentCollege})</span>
                      )}
                    </div>
                    {sub.studentEmail && (
                      <p className="text-xs text-[#78716C] font-sans truncate">{sub.studentEmail}</p>
                    )}
                  </div>
                  <Badge
                    className={`text-xs font-sans border shrink-0 ${
                      gateFailed
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {gateFailed ? "FAILED GATE" : "PASSED GATE"}
                  </Badge>
                </div>

                {/* Submitted Query */}
                <div>
                  <p className="text-xs text-[#78716C] font-mono mb-1">Submitted Query:</p>
                  <pre className="text-xs font-mono bg-[#FAF7F2] border border-[#E8E2D9] rounded p-2.5 text-[#1A1A1A] overflow-x-auto whitespace-pre-wrap">
                    {sub.query}
                  </pre>
                </div>

                {/* Error message if failed */}
                {sub.error && (
                  <div className="text-xs font-mono text-red-700 bg-red-50 border border-red-200 rounded p-2">
                    {sub.error}
                  </div>
                )}

                {/* Query Result Rows */}
                {sub.actualResult !== undefined && (
                  <div>
                    <p className="text-xs text-[#78716C] font-mono mb-1">
                      Result Rows ({Array.isArray(sub.actualResult) ? sub.actualResult.length : 1}):
                    </p>
                    <pre className="text-xs font-mono bg-[#FAF7F2] border border-[#E8E2D9] rounded p-2 text-[#1A1A1A] max-h-36 overflow-y-auto">
                      {JSON.stringify(sub.actualResult, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="text-[11px] text-[#78716C] font-mono">
                  Submitted at: {new Date(sub.submittedAt).toLocaleString()}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HIRING MANAGER VIEW
// ═══════════════════════════════════════════════════════════════════════════

function HiringManagerView({ role }: { role?: string }) {
  const isMentor = role === "mentor"
  const isHm = role === "hiring_manager"
  const [checkingCompany, setCheckingCompany] = useState(isHm)
  const [hasCompany, setHasCompany] = useState(!isHm)
  const [company, setCompany] = useState<any>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null)
  const [selectedIsDb, setSelectedIsDb] = useState(false)
  const [viewSubmissionsFor, setViewSubmissionsFor] = useState<string | null>(null)
  const [mentorTab, setMentorTab] = useState<"assignments" | "classes">("assignments")

  const bump = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    if (!isHm) return
    let active = true
    async function checkCompany() {
      try {
        const res = await fetch("/api/company/me")
        if (res.ok) {
          const json = await res.json()
          if (active && json.success) {
            setHasCompany(Boolean(json.hasCompany))
            setCompany(json.company || null)
          }
        }
      } catch (err) {
        console.error("Failed to check company status:", err)
      } finally {
        if (active) setCheckingCompany(false)
      }
    }
    checkCompany()
    return () => {
      active = false
    }
  }, [isHm])

  if (checkingCompany) {
    return (
      <div className="space-y-4 py-8">
        <Skeleton className="h-24 w-full rounded-2xl bg-[#E8E2D9]/40" />
        <Skeleton className="h-64 w-full rounded-2xl bg-[#E8E2D9]/40" />
      </div>
    )
  }

  if (isHm && !hasCompany) {
    return (
      <div className="py-4">
        <CompanyOnboardingGate
          onCompleted={(newCompany) => {
            setCompany(newCompany)
            setHasCompany(true)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Company / Organization Header ── */}
      <div className="rounded-2xl border border-[#E8E2D9] bg-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          {company?.logoUrl ? (
            <div className="w-12 h-12 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9] p-1 flex items-center justify-center overflow-hidden shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={company.logoUrl} alt={company.name} className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-[#3F3FF3]/10 border border-[#3F3FF3]/20 flex items-center justify-center text-[#3F3FF3] shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-serif italic font-bold text-[#1A1A1A]">
                {company?.name || (isMentor ? "Mentor Campus Assignment Desk" : "Organization Dashboard")}
              </h2>
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] uppercase font-bold">
                {isMentor ? "CAMPUS VERIFIED" : "VERIFIED ORG"}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-[#78716C] mt-0.5">
              {company?.website && (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[#3F3FF3] flex items-center gap-1 transition-colors"
                >
                  <Globe className="h-3 w-3" />
                  <span>{company.website.replace(/^https?:\/\//, "")}</span>
                </a>
              )}
              {company?.description && (
                <span className="text-[#78716C] line-clamp-1">{company.description}</span>
              )}
            </div>
          </div>
        </div>

        <Button
          onClick={() => setShowAddModal(!showAddModal)}
          className="rounded-full bg-black text-white hover:bg-zinc-800 text-xs py-2 px-5 font-medium cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          {showAddModal ? "Hide Form" : isMentor ? "+ Add Assignment" : "+ Add Problem"}
        </Button>
      </div>

      {/* ── Mentor Tab Switcher ── */}
      {isMentor && (
        <div className="flex items-center gap-2 p-1 bg-white rounded-full border border-[#E8E2D9] w-fit shadow-xs">
          <button
            type="button"
            onClick={() => setMentorTab("assignments")}
            className={`text-xs px-4 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
              mentorTab === "assignments"
                ? "bg-black text-white"
                : "text-[#78716C] hover:text-[#1A1A1A]"
            }`}
          >
            Assignments & Submissions
          </button>
          <button
            type="button"
            onClick={() => setMentorTab("classes")}
            className={`text-xs px-4 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
              mentorTab === "classes"
                ? "bg-black text-white"
                : "text-[#78716C] hover:text-[#1A1A1A]"
            }`}
          >
            Classes & Rosters
          </button>
        </div>
      )}

      {isMentor && mentorTab === "classes" ? (
        <MentorClassesSection />
      ) : (
        <>
          {/* ── Add Problem Form Drawer ── */}
          {showAddModal && (
        <Card className="rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-md relative">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E8E2D9]">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3F3FF3]/10 text-[#3F3FF3] border border-[#3F3FF3]/20">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif italic text-lg font-bold text-[#1A1A1A]">
                  {isMentor ? "Create New Class Assignment" : "Create New Problem Statement"}
                </h3>
                <p className="text-xs text-[#78716C]">
                  Select a format and fill out the details. Problem ID will be surfaced immediately upon creation.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAddModal(false)}
              className="text-[#78716C] hover:text-[#1A1A1A] text-xs"
            >
              Close
            </Button>
          </div>

          <UnifiedAddProblemForm
            onCreated={(newId) => {
              bump()
            }}
            onInspectProblem={(newId) => {
              setExpandedPanel(newId)
              setShowAddModal(false)
            }}
            isMentor={isMentor}
          />
        </Card>
      )}

      {/* ── My Problems List (Part C) ── */}
      <Card className="rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3F3FF3]/10 text-[#3F3FF3] border border-[#3F3FF3]/20">
              <Trophy className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-serif italic text-lg font-bold text-[#1A1A1A]">
                {isMentor ? "My Class Assignments" : "My Posted Problems"}
              </h2>
              <p className="text-xs text-[#78716C]">
                All problems published under your organization with live submission counts.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={bump}
            className="rounded-full border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#FAF7F2] text-xs cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>

        <MyProblemsList
          refreshKey={refreshKey}
          selectedProblemId={expandedPanel}
          onSelectProblem={(id, isDb) => {
            setExpandedPanel(id)
            setSelectedIsDb(isDb)
            setViewSubmissionsFor(id)
          }}
          isMentor={isMentor}
        />
      </Card>

      {/* ── Active Submissions Panel ── */}
      {expandedPanel && (
        <Card className="rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D9]">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-[#3F3FF3]" />
              <span className="text-sm font-semibold text-[#1A1A1A]">
                Viewing Submissions for Problem: <code className="text-[#3F3FF3] font-mono bg-[#FAF7F2] px-1.5 py-0.5 rounded border border-[#E8E2D9]">{expandedPanel}</code>
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpandedPanel(null)}
              className="text-[#78716C] hover:text-[#1A1A1A] text-xs"
            >
              Close Panel
            </Button>
          </div>

          <Tabs defaultValue={selectedIsDb ? "database" : "coding"} className="w-full">
            <TabsList className="bg-[#FAF7F2] border border-[#E8E2D9] p-1 rounded-xl">
              <TabsTrigger
                value="coding"
                className="data-[state=active]:bg-white data-[state=active]:text-[#1A1A1A] data-[state=active]:shadow-xs text-[#78716C] text-xs font-sans rounded-lg"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Coding & Open-Ended Submissions
              </TabsTrigger>
              <TabsTrigger
                value="database"
                className="data-[state=active]:bg-white data-[state=active]:text-[#1A1A1A] data-[state=active]:shadow-xs text-[#78716C] text-xs font-sans rounded-lg"
              >
                <Database className="h-3.5 w-3.5 mr-1.5" />
                Database Submissions
              </TabsTrigger>
            </TabsList>
            <TabsContent value="coding">
              <SubmissionsPanel key={`std-${expandedPanel}-${refreshKey}`} problemId={expandedPanel} />
            </TabsContent>
            <TabsContent value="database">
              <DbSubmissionsPanel key={`db-${expandedPanel}-${refreshKey}`} problemId={expandedPanel} />
            </TabsContent>
          </Tabs>
        </Card>
      )}

      {/* ── Manual Problem ID Fallback Loader ── */}
      <div className="pt-2 flex items-center justify-between text-xs text-[#78716C]">
        <span className="opacity-70">Looking for an older or external problem ID?</span>
        <div className="flex items-center gap-2">
          <Input
            value={viewSubmissionsFor ?? ""}
            onChange={(e) => setViewSubmissionsFor(e.target.value || null)}
            placeholder="Paste ID"
            className="h-8 w-44 bg-white border-[#E8E2D9] text-[#1A1A1A] font-mono text-xs placeholder:text-[#A8A29E] rounded-full px-3"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (viewSubmissionsFor) setExpandedPanel(viewSubmissionsFor)
            }}
            className="h-8 rounded-full border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#FAF7F2] text-xs"
          >
            Load
          </Button>
        </div>
      </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function ProblemStatements() {
  const { user } = useAuth()
  const role = user?.role ?? "student"
  const isManagement = role === "hiring_manager" || role === "mentor"
  const isMentor = role === "mentor"

  return (
    <div className="min-h-screen bg-[#FAF7F2] pt-8 pb-16 text-[#1A1A1A]">
      <div className="mx-auto w-full max-w-3xl px-6">
        <h1 className="font-serif italic text-4xl font-bold mb-2 tracking-tight text-[#1A1A1A]">
          {isMentor
            ? "Assignments Dashboard"
            : role === "hiring_manager"
            ? "Problems Dashboard"
            : "Problem Statements"}
        </h1>
        <p className="text-[#78716C] font-sans mb-10 text-base">
          {isMentor
            ? "Post class assignments and manage submissions from your students."
            : role === "hiring_manager"
            ? "Post problems and manage submissions from candidates."
            : "Browse and submit your solutions to open problems."}
        </p>

        {isManagement ? <HiringManagerView role={role} /> : <StudentView />}
      </div>
    </div>
  )
}

