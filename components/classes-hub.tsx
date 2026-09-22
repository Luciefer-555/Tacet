"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  QrCode,
  Users,
  Plus,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Timer,
  ChevronRight,
  UserCheck,
  UserX,
  X,
  RefreshCw,
  ExternalLink,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

export interface ClassItem {
  id: string
  name: string
  classId: string
  collegeId: string
  qrCodeDataUrl: string
  createdAt: string
  pendingCount: number
  approvedCount: number
}

export interface PendingRequest {
  membershipId: string
  studentId: string
  username: string
  email: string
  profileId: string
  branch: string
  year: string
  collegeName: string
  skills: string[]
  requestedAt: string
}

export interface StudentOverview {
  student: {
    username: string
    email: string
    profileId: string
    branch?: string
    year?: string
    collegeName?: string
    skills?: string[]
  }
  classInfo: {
    name: string
    classId: string
  }
  totalProblems: number
  totalSubmissions: number
  submissions: Array<{
    problemId: string
    problem: { title: string; difficulty: string; type: string } | null
    status: string
    correctnessScore?: number
    aiScore?: number
    submittedAt: string
  }>
  dbSubmissions: Array<{
    problemId: string
    problem: { title: string; difficulty: string; type: string } | null
    status: string
    passed: boolean
    submittedAt: string
  }>
}

// ═══════════════════════════════════════════════════════════════════════════
// MENTOR CLASSES SECTION
// ═══════════════════════════════════════════════════════════════════════════

export function MentorClassesSection() {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create class modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newClassName, setNewClassName] = useState("")
  const [newClassPassword, setNewClassPassword] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // QR Modal
  const [activeQrClass, setActiveQrClass] = useState<ClassItem | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  // Pending Requests Modal
  const [activeRequestsClass, setActiveRequestsClass] = useState<ClassItem | null>(null)
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestsError, setRequestsError] = useState<string | null>(null)
  const [processingStudentId, setProcessingStudentId] = useState<string | null>(null)
  const [bulkApproving, setBulkApproving] = useState(false)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Student Overview Modal
  const [viewingStudent, setViewingStudent] = useState<{ classId: string; studentId: string } | null>(null)
  const [studentOverview, setStudentOverview] = useState<StudentOverview | null>(null)
  const [loadingOverview, setLoadingOverview] = useState(false)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const fetchClasses = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/classes")
      if (!res.ok) throw new Error("Failed to load classes.")
      const data = await res.json()
      setClasses(data.classes || [])
    } catch (err: any) {
      setError(err.message || "Could not load classes.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClasses()
  }, [])

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClassName.trim() || !newClassPassword.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch("/api/classes/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClassName.trim(), password: newClassPassword }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create class.")
      setNewClassName("")
      setNewClassPassword("")
      setShowCreateModal(false)
      fetchClasses()
    } catch (err: any) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const openRequestsModal = async (classItem: ClassItem) => {
    setActiveRequestsClass(classItem)
    setLoadingRequests(true)
    setRequestsError(null)
    setActionSuccess(null)
    try {
      const res = await fetch(`/api/classes/${classItem.classId}/requests`)
      if (!res.ok) throw new Error("Failed to load pending requests.")
      const data = await res.json()
      setRequests(data.requests || [])
    } catch (err: any) {
      setRequestsError(err.message)
    } finally {
      setLoadingRequests(false)
    }
  }

  const handleDecision = async (studentId: string, action: "approve" | "reject") => {
    if (!activeRequestsClass) return
    setProcessingStudentId(studentId)
    try {
      const res = await fetch(`/api/classes/${activeRequestsClass.classId}/requests/${studentId}/${action}`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to ${action} student.`)
      setRequests((prev) => prev.filter((r) => r.studentId !== studentId))
      setActionSuccess(`Student successfully ${action}d.`)
      fetchClasses()
    } catch (err: any) {
      setRequestsError(err.message)
    } finally {
      setProcessingStudentId(null)
    }
  }

  const handleBulkApprove = async () => {
    if (!activeRequestsClass) return
    setBulkApproving(true)
    setRequestsError(null)
    try {
      const res = await fetch(`/api/classes/${activeRequestsClass.classId}/requests/approve-all`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to approve all requests.")
      setActionSuccess(`Approved ${data.approvedCount} students!`)
      setRequests([])
      fetchClasses()
    } catch (err: any) {
      setRequestsError(err.message)
    } finally {
      setBulkApproving(false)
    }
  }

  const openStudentOverview = async (classId: string, studentId: string) => {
    setViewingStudent({ classId, studentId })
    setLoadingOverview(true)
    setOverviewError(null)
    try {
      const res = await fetch(`/api/classes/${classId}/students/${studentId}/overview`)
      if (!res.ok) throw new Error("Failed to load student class overview.")
      const data = await res.json()
      setStudentOverview(data)
    } catch (err: any) {
      setOverviewError(err.message)
    } finally {
      setLoadingOverview(false)
    }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E8E2D9]">
        <div>
          <h3 className="font-serif italic text-xl font-bold text-[#1A1A1A]">Mentor Classes & Rosters</h3>
          <p className="text-xs text-[#78716C] mt-0.5">
            Create classes, generate join QR codes, manage membership approvals, and inspect class-scoped progress.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="rounded-full bg-black text-white hover:bg-zinc-800 text-xs py-2 px-5 font-medium cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Class
        </Button>
      </div>

      {/* ── Class List ── */}
      {loading ? (
        <div className="text-center py-12 text-xs text-[#78716C]">Loading your classes...</div>
      ) : error ? (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs">{error}</div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-[#E8E2D9] rounded-2xl bg-white p-8">
          <Users className="w-8 h-8 text-[#A8A29E] mx-auto mb-2" />
          <p className="font-serif italic text-base font-bold text-[#1A1A1A]">No classes created yet</p>
          <p className="text-xs text-[#78716C] max-w-sm mx-auto mt-1 mb-4">
            Create your first class to distribute assignments, show a join QR code in your classroom, and manage student attempts.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="rounded-full bg-black text-white hover:bg-zinc-800 text-xs"
          >
            + Create Your First Class
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {classes.map((c) => (
            <Card key={c.id} className="rounded-2xl border border-[#E8E2D9] bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-serif italic font-bold text-base text-[#1A1A1A]">{c.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs font-semibold text-[#3F3FF3] bg-[#3F3FF3]/10 px-2 py-0.5 rounded">
                      {c.classId}
                    </span>
                    <button
                      onClick={() => copyCode(c.classId)}
                      className="text-[#78716C] hover:text-[#1A1A1A] p-0.5 rounded transition-colors"
                      title="Copy Class Code"
                    >
                      {copiedCode === c.classId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveQrClass(c)}
                  className="rounded-full border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#FAF7F2] text-xs h-8 px-3"
                >
                  <QrCode className="w-3.5 h-3.5 mr-1 text-[#3F3FF3]" /> QR Code
                </Button>
              </div>

              <div className="flex items-center justify-between text-xs pt-3 border-t border-[#E8E2D9]/60">
                <div className="flex items-center gap-1.5 text-[#78716C]">
                  <Users className="w-3.5 h-3.5" />
                  <span>
                    <strong className="text-[#1A1A1A]">{c.approvedCount}</strong> students enrolled
                  </span>
                </div>

                {c.pendingCount > 0 ? (
                  <Button
                    size="sm"
                    onClick={() => openRequestsModal(c)}
                    className="rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs h-7 px-3 font-medium"
                  >
                    {c.pendingCount} Pending Requests
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openRequestsModal(c)}
                    className="text-xs text-[#78716C] hover:text-[#1A1A1A] h-7 px-2"
                  >
                    Manage Roster
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create Class Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="rounded-2xl border border-[#E8E2D9] bg-white p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-[#78716C] hover:text-[#1A1A1A]"
            >
              <X className="w-4 h-4" />
            </button>
            <h4 className="font-serif italic text-lg font-bold text-[#1A1A1A] mb-1">Create a New Class</h4>
            <p className="text-xs text-[#78716C] mb-4">
              Enter class name and a join password. Students will need this password along with the QR code.
            </p>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A1A1A]">Class Name</Label>
                <Input
                  placeholder="e.g. CS301 - Systems Programming"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] text-xs h-9 focus:border-[#1A1A1A] focus:bg-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A1A1A]">Class Password</Label>
                <Input
                  type="password"
                  placeholder="Min 4 characters (e.g. CS301Pass!)"
                  value={newClassPassword}
                  onChange={(e) => setNewClassPassword(e.target.value)}
                  className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] text-xs h-9 focus:border-[#1A1A1A] focus:bg-white"
                  required
                />
              </div>

              {createError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                  {createError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs text-[#78716C]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  className="rounded-full bg-black text-white hover:bg-zinc-800 text-xs px-5"
                >
                  {creating ? "Generating QR..." : "Create Class"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ── QR Code Preview Modal ── */}
      {activeQrClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="rounded-2xl border border-[#E8E2D9] bg-white p-6 w-full max-w-sm text-center shadow-2xl relative">
            <button
              onClick={() => setActiveQrClass(null)}
              className="absolute top-4 right-4 text-[#78716C] hover:text-[#1A1A1A]"
            >
              <X className="w-4 h-4" />
            </button>
            <h4 className="font-serif italic text-lg font-bold text-[#1A1A1A] mb-1">{activeQrClass.name}</h4>
            <p className="text-xs text-[#78716C] mb-4">Display this QR code for students to scan in class</p>

            <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#E8E2D9] inline-block mx-auto mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeQrClass.qrCodeDataUrl}
                alt={`QR code for ${activeQrClass.name}`}
                className="w-48 h-48 mx-auto rounded-lg"
              />
            </div>

            <div className="bg-[#FAF7F2] p-2 rounded-xl border border-[#E8E2D9] mb-4">
              <span className="text-[10px] uppercase font-bold text-[#78716C] block">Class Code</span>
              <span className="font-mono text-sm font-bold text-[#1A1A1A]">{activeQrClass.classId}</span>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                onClick={() => copyCode(activeQrClass.classId)}
                className="rounded-full bg-black text-white hover:bg-zinc-800 text-xs px-4"
              >
                {copiedCode === activeQrClass.classId ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                Copy Code
              </Button>
              <a
                href={activeQrClass.qrCodeDataUrl}
                download={`${activeQrClass.classId}-QR.png`}
                className="inline-flex items-center text-xs py-1.5 px-3 rounded-full border border-[#E8E2D9] bg-white text-[#1A1A1A] hover:bg-[#FAF7F2] font-medium"
              >
                Download PNG
              </a>
            </div>
          </Card>
        </div>
      )}

      {/* ── Pending Requests & Roster Modal ── */}
      {activeRequestsClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="rounded-2xl border border-[#E8E2D9] bg-white p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative">
            <button
              onClick={() => setActiveRequestsClass(null)}
              className="absolute top-4 right-4 text-[#78716C] hover:text-[#1A1A1A]"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-between pb-3 border-b border-[#E8E2D9] pr-8">
              <div>
                <h4 className="font-serif italic text-lg font-bold text-[#1A1A1A]">
                  Membership Requests: {activeRequestsClass.name}
                </h4>
                <p className="text-xs text-[#78716C]">
                  Class Code: <span className="font-mono font-bold text-[#1A1A1A]">{activeRequestsClass.classId}</span>
                </p>
              </div>

              {requests.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleBulkApprove}
                  disabled={bulkApproving}
                  className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4"
                >
                  <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                  {bulkApproving ? "Approving..." : `Approve All (${requests.length})`}
                </Button>
              )}
            </div>

            {actionSuccess && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {requestsError && (
              <div className="mt-3 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
                {requestsError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto mt-4 space-y-3">
              {loadingRequests ? (
                <div className="text-center py-8 text-xs text-[#78716C]">Loading requests...</div>
              ) : requests.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#78716C]">
                  No pending join requests for this class.
                </div>
              ) : (
                requests.map((r) => (
                  <div
                    key={r.membershipId}
                    className="p-3.5 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#1A1A1A]">{r.username}</span>
                        <Badge className="bg-white text-[#78716C] border-[#E8E2D9] text-[10px]">
                          {r.branch || "General"} {r.year ? `• Year ${r.year}` : ""}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#78716C] mt-0.5">{r.email}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openStudentOverview(activeRequestsClass.classId, r.studentId)}
                        className="text-xs text-[#3F3FF3] hover:text-[#3F3FF3] hover:bg-[#3F3FF3]/10 h-8 px-2"
                      >
                        Overview
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDecision(r.studentId, "reject")}
                        disabled={processingStudentId === r.studentId}
                        className="rounded-full border-red-200 text-red-600 hover:bg-red-50 text-xs h-8 px-3"
                      >
                        <UserX className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDecision(r.studentId, "approve")}
                        disabled={processingStudentId === r.studentId}
                        className="rounded-full bg-black text-white hover:bg-zinc-800 text-xs h-8 px-4"
                      >
                        <UserCheck className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── Scoped Student Overview Modal ── */}
      {viewingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="rounded-2xl border border-[#E8E2D9] bg-white p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative">
            <button
              onClick={() => setViewingStudent(null)}
              className="absolute top-4 right-4 text-[#78716C] hover:text-[#1A1A1A]"
            >
              <X className="w-4 h-4" />
            </button>

            {loadingOverview ? (
              <div className="text-center py-12 text-xs text-[#78716C]">Loading class overview...</div>
            ) : overviewError ? (
              <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs">{overviewError}</div>
            ) : studentOverview ? (
              <>
                <div className="pb-4 border-b border-[#E8E2D9] pr-8">
                  <div className="flex items-center gap-2">
                    <h4 className="font-serif italic text-lg font-bold text-[#1A1A1A]">
                      {studentOverview.student.username}
                    </h4>
                    <Badge className="bg-[#3F3FF3]/10 text-[#3F3FF3] border-[#3F3FF3]/20 text-[10px] uppercase font-bold">
                      {studentOverview.classInfo.name}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#78716C] mt-0.5">
                    {studentOverview.student.email} • {studentOverview.student.branch} Year {studentOverview.student.year}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 my-4">
                  <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9]">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">Class Assignments</span>
                    <span className="font-mono text-lg font-bold text-[#1A1A1A]">{studentOverview.totalProblems}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FAF7F2] border border-[#E8E2D9]">
                    <span className="text-[10px] uppercase font-bold text-[#78716C] block">Class Submissions</span>
                    <span className="font-mono text-lg font-bold text-[#3F3FF3]">{studentOverview.totalSubmissions}</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-[#78716C] mb-2">Class Submissions</h5>
                  {studentOverview.submissions.length === 0 && studentOverview.dbSubmissions.length === 0 ? (
                    <p className="text-xs text-[#78716C] text-center py-6">No submissions recorded for this class yet.</p>
                  ) : (
                    <>
                      {studentOverview.submissions.map((sub, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-[#E8E2D9] bg-[#FAF7F2] flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-[#1A1A1A] block">{sub.problem?.title || "Problem"}</span>
                            <span className="text-[10px] text-[#78716C]">
                              {new Date(sub.submittedAt).toLocaleDateString()} at {new Date(sub.submittedAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {sub.correctnessScore != null && (
                              <Badge className="bg-white border-[#E8E2D9] text-[#1A1A1A]">
                                Score: {(sub.correctnessScore * 100).toFixed(0)}%
                              </Badge>
                            )}
                            <Badge
                              className={
                                sub.status === "submitted"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }
                            >
                              {sub.status}
                            </Badge>
                            {(sub as any).autoPromoted && (
                              <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px]">
                                Auto-Submitted
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </>
            ) : null}
          </Card>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENT JOIN CLASS MODAL & BAR
// ═══════════════════════════════════════════════════════════════════════════

export function StudentClassJoinBar({ onJoined }: { onJoined?: () => void }) {
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [classCode, setClassCode] = useState("")
  const [password, setPassword] = useState("")
  const [joining, setJoining] = useState(false)
  const [joinStatus, setJoinStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null)
  const [studentClasses, setStudentClasses] = useState<any[]>([])

  const loadClasses = async () => {
    try {
      const res = await fetch("/api/classes")
      if (res.ok) {
        const json = await res.json()
        setStudentClasses(json.classes || [])
      }
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    loadClasses()
  }, [])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!classCode.trim() || !password.trim()) return
    setJoining(true)
    setJoinStatus(null)

    try {
      const cleanCode = classCode.trim().toUpperCase()
      const res = await fetch(`/api/classes/${cleanCode}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to join class.")

      setJoinStatus({
        kind: "success",
        message: data.message || "Join request submitted! Awaiting mentor approval.",
      })
      setClassCode("")
      setPassword("")
      loadClasses()
      if (onJoined) onJoined()
    } catch (err: any) {
      setJoinStatus({ kind: "error", message: err.message })
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#E8E2D9] bg-white p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#3F3FF3]/10 border border-[#3F3FF3]/20 flex items-center justify-center text-[#3F3FF3] shrink-0">
          <Users className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">Campus Classes</span>
            {studentClasses.length > 0 && (
              <Badge className="bg-[#FAF7F2] text-[#78716C] border-[#E8E2D9] text-[10px]">
                {studentClasses.length} Enrolled
              </Badge>
            )}
          </div>
          <p className="text-xs text-[#78716C]">
            {studentClasses.length > 0
              ? studentClasses.map((c) => c.name).join(", ")
              : "Enter your mentor's class code or scan their QR code to access assignments."}
          </p>
        </div>
      </div>

      <Button
        size="sm"
        onClick={() => setShowJoinModal(true)}
        className="rounded-full bg-black text-white hover:bg-zinc-800 text-xs py-1.5 px-4 font-medium shrink-0"
      >
        <Plus className="w-3.5 h-3.5 mr-1" /> Join Class
      </Button>

      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="rounded-2xl border border-[#E8E2D9] bg-white p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => {
                setShowJoinModal(false)
                setJoinStatus(null)
              }}
              className="absolute top-4 right-4 text-[#78716C] hover:text-[#1A1A1A]"
            >
              <X className="w-4 h-4" />
            </button>

            <h4 className="font-serif italic text-lg font-bold text-[#1A1A1A] mb-1">Join a Class</h4>
            <p className="text-xs text-[#78716C] mb-4">
              Enter the Class Code and Password provided by your mentor.
            </p>

            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A1A1A]">Class Code</Label>
                <Input
                  placeholder="e.g. CS301-A1B2"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                  className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] text-xs h-9 font-mono uppercase focus:border-[#1A1A1A] focus:bg-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-[#1A1A1A]">Class Password</Label>
                <Input
                  type="password"
                  placeholder="Enter class password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#FAF7F2] border-[#E8E2D9] text-[#1A1A1A] text-xs h-9 focus:border-[#1A1A1A] focus:bg-white"
                  required
                />
              </div>

              {joinStatus && (
                <div
                  className={`p-2.5 rounded-lg border text-xs ${
                    joinStatus.kind === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  {joinStatus.message}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowJoinModal(false)}
                  className="text-xs text-[#78716C]"
                >
                  Close
                </Button>
                <Button
                  type="submit"
                  disabled={joining}
                  className="rounded-full bg-black text-white hover:bg-zinc-800 text-xs px-5"
                >
                  {joining ? "Submitting..." : "Submit Join Request"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMED TEST CONTROLLER & ACTIVE TIMER
// ═══════════════════════════════════════════════════════════════════════════

export function TimedTestController({
  problemId,
  timeLimitMinutes,
  onAutoSubmit,
  currentCode,
}: {
  problemId: string
  timeLimitMinutes: number
  onAutoSubmit: () => void
  currentCode: string
}) {
  const [sessionState, setSessionState] = useState<{
    started: boolean
    remainingMs: number
    expired: boolean
  }>({
    started: false,
    remainingMs: timeLimitMinutes * 60 * 1000,
    expired: false,
  })
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [autoPromotedMessage, setAutoPromotedMessage] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null)

  // Check initial test session status
  useEffect(() => {
    if (!problemId) return
    let active = true
    async function checkExisting() {
      try {
        const res = await fetch("/api/test-sessions/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problemId }),
        })
        const data = await res.json()
        if (!active) return
        if (data.autoPromoted) {
          setAutoPromotedMessage(
            data.message || "Your test was auto-submitted from your last saved draft after your connection was lost"
          )
        } else if (data.success && data.testSession) {
          setSessionState({
            started: true,
            remainingMs: data.testSession.remainingMs,
            expired: data.testSession.remainingMs <= 0,
          })
        }
      } catch {
        // silent
      }
    }
    checkExisting()
    return () => {
      active = false
    }
  }, [problemId])

  // Start test session on server
  const startTest = async () => {
    setStarting(true)
    setStartError(null)
    try {
      const res = await fetch("/api/test-sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to start timed test session.")

      if (data.autoPromoted) {
        setAutoPromotedMessage(
          data.message || "Your test was auto-submitted from your last saved draft after your connection was lost"
        )
        return
      }

      setSessionState({
        started: true,
        remainingMs: data.testSession.remainingMs,
        expired: data.testSession.remainingMs <= 0,
      })
    } catch (err: any) {
      setStartError(err.message)
    } finally {
      setStarting(false)
    }
  }

  // Countdown loop
  useEffect(() => {
    if (!sessionState.started || sessionState.expired) return

    timerRef.current = setInterval(() => {
      setSessionState((prev) => {
        const nextMs = prev.remainingMs - 1000
        if (nextMs <= 0) {
          clearInterval(timerRef.current!)
          // Trigger auto-submit!
          onAutoSubmit()
          return { ...prev, remainingMs: 0, expired: true }
        }
        return { ...prev, remainingMs: nextMs }
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [sessionState.started, sessionState.expired, onAutoSubmit])

  // Periodic draft autosave every 20 seconds
  useEffect(() => {
    if (!sessionState.started || sessionState.expired) return

    autoSaveRef.current = setInterval(async () => {
      if (!currentCode) return
      try {
        await fetch("/api/test-sessions/draft", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problemId, draftCode: currentCode }),
        })
      } catch {
        // best-effort autosave
      }
    }, 20000)

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    }
  }, [sessionState.started, sessionState.expired, problemId, currentCode])

  const formatTime = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const isLowTime = sessionState.remainingMs < 5 * 60 * 1000 // < 5 mins

  if (autoPromotedMessage) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mb-4 text-amber-900 shadow-sm flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-xs uppercase tracking-wider block text-amber-950">
            Auto-Submitted from Saved Draft
          </span>
          <p className="text-xs text-amber-900 mt-0.5 font-medium">
            {autoPromotedMessage}
          </p>
        </div>
      </div>
    )
  }

  if (!sessionState.started) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Timer className="w-5 h-5 text-amber-700 shrink-0" />
          <div>
            <span className="font-bold text-xs text-amber-900 block">Timed Test: {timeLimitMinutes} Minutes</span>
            <span className="text-xs text-amber-800">
              The timer will count down continuously from the moment you click Start. Auto-submits on expiration.
            </span>
          </div>
        </div>
        <Button
          size="sm"
          onClick={startTest}
          disabled={starting}
          className="rounded-full bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold px-4 shrink-0"
        >
          {starting ? "Starting..." : "Start Timed Test"}
        </Button>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border p-3 mb-4 flex items-center justify-between gap-3 transition-colors ${
        isLowTime ? "bg-red-50 border-red-200 text-red-900" : "bg-zinc-900 border-zinc-800 text-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <Timer className={`w-4 h-4 ${isLowTime ? "text-red-600 animate-pulse" : "text-[#3F3FF3]"}`} />
        <span className="text-xs font-medium">Time Remaining:</span>
        <span className="font-mono text-sm font-bold tracking-wider">
          {formatTime(sessionState.remainingMs)}
        </span>
      </div>

      <span className="text-[10px] opacity-80">
        {sessionState.expired ? "Time expired — submitting..." : "Auto-saving draft..."}
      </span>
    </div>
  )
}
