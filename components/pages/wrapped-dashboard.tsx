"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/app/providers"
import { Award, Code2, Download, Flame, Database, ArrowUpRight, CheckCircle2 } from "lucide-react"

interface StudentStats {
  totalSubmissions: number
  problemsAttempted: number
  scoredSubmissions: number
  avgAiScore: number
  highestScoring: { score: number; problemTitle: string; submittedAt: string } | null
  dbSubmissionsTotal?: number
  dbSubmissionsPassed?: number
  topSkills: string[]
  persona: {
    label: string
    description: string
    isCalibrating: boolean
    archetype: string | null
  }
}

interface MentorStats {
  assignmentsPosted: number
  totalSubmissionsReceived: number
  uniqueStudentsReached: number
  avgScore: number
  topSubmission: { score: number; studentName: string; problemTitle: string; submittedAt: string } | null
  focusArea: {
    label: string
    description: string
    isCalibrating: boolean
  }
}

interface HiringManagerStats {
  problemsPosted: number
  totalSubmissionsReceived: number
  submissionsRanked: number
  submissionsPending: number
  avgRankScore: number
  topRankedSubmission: { score: number; candidateName: string; candidateProfileId: string; problemTitle: string } | null
  domainProfile: {
    label: string
    description: string
    isCalibrating: boolean
  }
}

export default function WrappedDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [studentStats, setStudentStats] = useState<StudentStats | null>(null)
  const [mentorStats, setMentorStats] = useState<MentorStats | null>(null)
  const [hmStats, setHmStats] = useState<HiringManagerStats | null>(null)

  const role = user?.role || "student"

  useEffect(() => {
    let endpoint = "/api/stats/student"
    if (role === "mentor") endpoint = "/api/stats/mentor"
    if (role === "hiring_manager") endpoint = "/api/stats/hiring-manager"

    async function fetchStats() {
      setLoading(true)
      try {
        const res = await fetch(endpoint)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.stats) {
            if (role === "student") setStudentStats(data.stats)
            else if (role === "mentor") setMentorStats(data.stats)
            else if (role === "hiring_manager") setHmStats(data.stats)
          }
        }
      } catch (e) {
        console.error("Failed to fetch stats", e)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [role])

  // Native Client-Side Canvas Image Export (Warm YC Style)
  const handleDownloadImage = async () => {
    let displayFont = 'Melodrame, "Instrument Serif", serif'
    let serifFont = '"Instrument Serif", serif'
    let sansFont = 'Geist, sans-serif'
    let monoFont = '"Geist Mono", monospace'

    if (typeof document !== "undefined" && document.fonts) {
      await document.fonts.ready
      const style = getComputedStyle(document.documentElement)
      displayFont = style.getPropertyValue('--font-display').trim() || displayFont
      serifFont = style.getPropertyValue('--font-serif').trim() || serifFont
      sansFont = style.getPropertyValue('--font-sans').trim() || sansFont
      monoFont = style.getPropertyValue('--font-mono').trim() || monoFont

      try {
        await Promise.all([
          document.fonts.load(`bold 14px ${displayFont}`),
          document.fonts.load(`italic bold 44px ${serifFont}`),
          document.fonts.load(`18px ${sansFont}`),
          document.fonts.load(`14px ${sansFont}`),
          document.fonts.load(`bold 52px ${monoFont}`),
          document.fonts.load(`bold 26px ${sansFont}`),
          document.fonts.load(`14px ${monoFont}`),
        ])
      } catch (_) {}
    }

    const canvas = document.createElement("canvas")
    canvas.width = 1200
    canvas.height = 630
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Warm background
    ctx.fillStyle = "#FAF7F2"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Warm border
    ctx.strokeStyle = "#E8E2D9"
    ctx.lineWidth = 4
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40)

    // Tag
    ctx.fillStyle = "#3F3FF3"
    ctx.beginPath()
    ctx.roundRect(80, 70, 240, 36, 18)
    ctx.fill()
    ctx.fillStyle = "#FFFFFF"
    ctx.font = `bold 14px ${displayFont}`
    ctx.fillText("TACET OVERVIEW", 100, 93)

    // User Name & Role
    ctx.fillStyle = "#1A1A1A"
    ctx.font = `italic bold 44px ${serifFont}`
    ctx.fillText(user?.username || "Tacet Engineer", 80, 175)

    ctx.font = `18px ${sansFont}`
    ctx.fillStyle = "#78716C"
    ctx.fillText(`Role: ${role.replace("_", " ").toUpperCase()} • Profile ID: ${user?.profileId || "tacet"}`, 80, 210)

    // Stat Boxes (White cards on warm canvas)
    let stat1Label = "Submissions"
    let stat1Val = "0"
    let stat2Label = "Avg AI Score"
    let stat2Val = "0"
    let personaText = "Calibrating..."

    if (role === "student" && studentStats) {
      stat1Label = "Total Submissions"
      stat1Val = String(studentStats.totalSubmissions)
      stat2Label = "Avg AI Score"
      stat2Val = `${studentStats.avgAiScore}/100`
      personaText = studentStats.persona.label
    } else if (role === "mentor" && mentorStats) {
      stat1Label = "Assignments Posted"
      stat1Val = String(mentorStats.assignmentsPosted)
      stat2Label = "Students Reached"
      stat2Val = String(mentorStats.uniqueStudentsReached)
      personaText = mentorStats.focusArea.label
    } else if (role === "hiring_manager" && hmStats) {
      stat1Label = "Problems Posted"
      stat1Val = String(hmStats.problemsPosted)
      stat2Label = "Ranked Submissions"
      stat2Val = String(hmStats.submissionsRanked)
      personaText = hmStats.domainProfile.label
    }

    // Box 1
    ctx.fillStyle = "#FFFFFF"
    ctx.strokeStyle = "#E8E2D9"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(80, 260, 310, 160, 16)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = "#78716C"
    ctx.font = `14px ${sansFont}`
    ctx.fillText(stat1Label, 105, 305)
    ctx.fillStyle = "#1A1A1A"
    ctx.font = `bold 52px ${monoFont}`
    ctx.fillText(stat1Val, 105, 380)

    // Box 2
    ctx.beginPath()
    ctx.roundRect(430, 260, 310, 160, 16)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = "#78716C"
    ctx.font = `14px ${sansFont}`
    ctx.fillText(stat2Label, 455, 305)
    ctx.fillStyle = "#3F3FF3"
    ctx.font = `bold 52px ${monoFont}`
    ctx.fillText(stat2Val, 455, 380)

    // Box 3
    ctx.beginPath()
    ctx.roundRect(780, 260, 340, 160, 16)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = "#78716C"
    ctx.font = `14px ${sansFont}`
    ctx.fillText("Engineering Archetype", 805, 305)
    ctx.fillStyle = "#1A1A1A"
    ctx.font = `bold 26px ${sansFont}`
    ctx.fillText(personaText, 805, 360)

    // Footer
    ctx.fillStyle = "#A8A29E"
    ctx.font = `14px ${monoFont}`
    ctx.fillText("Verified on Tacet • Multi-Agent AI Ranking", 80, 560)

    const link = document.createElement("a")
    link.download = `tacet-overview-${role}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] p-8 sm:p-12 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#3F3FF3] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[#78716C] text-sm font-medium">Aggregating live performance data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1A1A1A] py-10 px-6 sm:px-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Page Header — YC Editorial Style */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#E8E2D9]">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-[#3F3FF3]">
              {role.replace("_", " ")} Overview
            </span>
            <h1 className="font-serif italic text-3xl sm:text-4xl font-bold tracking-tight text-[#1A1A1A] mt-1">
              Engineering Dashboard
            </h1>
            <p className="text-sm text-[#78716C] mt-1.5 max-w-xl">
              Real-time performance benchmarks, architecture assessments, and submission statistics scored by Tacet's multi-agent AI panel.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleDownloadImage}
              className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-black/85 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Card
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STUDENT ROLE DASHBOARD                                                    */}
        {/* ========================================================================= */}
        {role === "student" && studentStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Primary Hero Stats Card (HyperUI pattern) */}
            <div className="md:col-span-2 rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                  Cumulative Progress
                </span>
                <h2 className="font-serif italic text-2xl sm:text-3xl font-bold text-[#1A1A1A] mt-1">
                  {studentStats.totalSubmissions > 0
                    ? `${studentStats.totalSubmissions} Challenges Completed`
                    : "Ready for your first challenge"}
                </h2>
                <p className="text-xs sm:text-sm text-[#78716C] mt-1.5 max-w-lg">
                  {studentStats.totalSubmissions > 0
                    ? `You have attempted ${studentStats.problemsAttempted} distinct problems evaluated across code correctness, system design, and execution efficiency.`
                    : "No submissions yet. Head to Problem Statements to submit your code and receive multi-agent evaluation feedback."}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-6 mt-6 border-t border-[#F0EBE1]">
                <div>
                  <p className="text-xs text-[#78716C] uppercase font-semibold">Submissions</p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[#1A1A1A] mt-0.5">
                    {studentStats.totalSubmissions}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#78716C] uppercase font-semibold">Problems</p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[#1A1A1A] mt-0.5">
                    {studentStats.problemsAttempted}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#78716C] uppercase font-semibold">Avg AI Score</p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[#3F3FF3] mt-0.5">
                    {studentStats.avgAiScore}
                  </p>
                </div>
              </div>
            </div>

            {/* Persona Card */}
            <div className="rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                    Engineering Persona
                  </span>
                  <Award className="w-5 h-5 text-[#3F3FF3]" />
                </div>
                <h3 className="text-xl font-bold text-[#1A1A1A] mt-3">{studentStats.persona.label}</h3>
                <p className="text-xs text-[#78716C] mt-2 leading-relaxed">
                  {studentStats.persona.description}
                </p>
              </div>

              <div className="pt-4 border-t border-[#F0EBE1] mt-6">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  studentStats.persona.isCalibrating
                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  {studentStats.persona.isCalibrating ? "Calibrating" : "Calibrated Signal"}
                </span>
              </div>
            </div>

            {/* Top Skills Stack */}
            <div className="rounded-2xl border border-[#E8E2D9] bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                  Demonstrated Skills
                </h4>
                <Code2 className="w-4 h-4 text-[#78716C]" />
              </div>

              {studentStats.topSkills.length > 0 ? (
                <div className="space-y-3">
                  {studentStats.topSkills.slice(0, 5).map((sk, idx) => (
                    <div key={sk} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium text-[#1A1A1A]">
                        <span>{sk}</span>
                        <span className="text-[#78716C]">{100 - idx * 12}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#FAF7F2] border border-[#E8E2D9] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#3F3FF3] rounded-full"
                          style={{ width: `${100 - idx * 12}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#78716C] py-4">No skills recorded yet. Add skills in your profile.</p>
              )}

              {Boolean(studentStats.dbSubmissionsTotal && studentStats.dbSubmissionsTotal > 0) && (
                <div className="pt-3 border-t border-[#F0EBE1] flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-[#78716C]">
                    <Database className="w-3.5 h-3.5 text-[#3F3FF3]" />
                    Database
                  </span>
                  <span className="rounded-full bg-[#3F3FF3]/10 text-[#3F3FF3] px-2 py-0.5 text-[11px] font-semibold">
                    {studentStats.dbSubmissionsPassed && studentStats.dbSubmissionsPassed > 0
                      ? `${studentStats.dbSubmissionsPassed} Passed`
                      : `${studentStats.dbSubmissionsTotal} Queries`}
                  </span>
                </div>
              )}
            </div>

            {/* Highest-Scoring Submission Card */}
            <div className="md:col-span-2 rounded-2xl border border-[#E8E2D9] bg-white p-6 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                    Highest-Scoring Problem
                  </span>
                </div>
                {studentStats.highestScoring && (
                  <span className="rounded-full bg-[#3F3FF3]/10 text-[#3F3FF3] px-3 py-1 font-mono text-xs font-bold">
                    {studentStats.highestScoring.score} / 100
                  </span>
                )}
              </div>

              {studentStats.highestScoring ? (
                <div className="my-4">
                  <h4 className="text-lg font-bold text-[#1A1A1A]">{studentStats.highestScoring.problemTitle}</h4>
                  <p className="text-xs text-[#78716C] mt-1">
                    Evaluated on {new Date(studentStats.highestScoring.submittedAt).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <div className="py-6 text-xs text-[#78716C]">
                  No scored submissions recorded yet. Complete a problem statement to highlight your top performance.
                </div>
              )}

              <div className="text-xs text-[#78716C] border-t border-[#F0EBE1] pt-3 flex items-center justify-between">
                <span>Multi-agent scoring criteria</span>
                <span className="font-semibold text-[#1A1A1A]">{studentStats.scoredSubmissions} Scored</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MENTOR ROLE DASHBOARD                                                     */}
        {/* ========================================================================= */}
        {role === "mentor" && mentorStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                  Classroom Engagement
                </span>
                <h2 className="font-serif italic text-2xl sm:text-3xl font-bold text-[#1A1A1A] mt-1">
                  Cohort Performance
                </h2>
                <p className="text-xs sm:text-sm text-[#78716C] mt-1.5">
                  Track student submissions across your published assignments and review multi-agent evaluations.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-6 mt-6 border-t border-[#F0EBE1]">
                <div>
                  <p className="text-xs text-[#78716C] uppercase font-semibold">Assignments</p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[#1A1A1A] mt-0.5">
                    {mentorStats.assignmentsPosted}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#78716C] uppercase font-semibold">Submissions</p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[#1A1A1A] mt-0.5">
                    {mentorStats.totalSubmissionsReceived}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#78716C] uppercase font-semibold">Students</p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[#3F3FF3] mt-0.5">
                    {mentorStats.uniqueStudentsReached}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                  Curriculum Focus
                </span>
                <h3 className="text-xl font-bold text-[#1A1A1A] mt-3">{mentorStats.focusArea.label}</h3>
                <p className="text-xs text-[#78716C] mt-2 leading-relaxed">
                  {mentorStats.focusArea.description}
                </p>
              </div>

              <div className="pt-4 border-t border-[#F0EBE1] mt-6">
                <span className="text-xs font-medium text-[#78716C]">
                  Average Cohort Score: <strong className="text-[#1A1A1A]">{mentorStats.avgScore}/100</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* HIRING MANAGER ROLE DASHBOARD                                             */}
        {/* ========================================================================= */}
        {role === "hiring_manager" && hmStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                  Hiring Pipeline
                </span>
                <h2 className="font-serif italic text-2xl sm:text-3xl font-bold text-[#1A1A1A] mt-1">
                  Candidate Pipeline
                </h2>
                <p className="text-xs sm:text-sm text-[#78716C] mt-1.5">
                  Production-style problem submissions scored and ranked for your engineering team.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-6 mt-6 border-t border-[#F0EBE1]">
                <div>
                  <p className="text-xs text-[#78716C] uppercase font-semibold">Posted</p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[#1A1A1A] mt-0.5">
                    {hmStats.problemsPosted}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#78716C] uppercase font-semibold">Ranked</p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[#3F3FF3] mt-0.5">
                    {hmStats.submissionsRanked}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#78716C] uppercase font-semibold">Pending</p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[#1A1A1A] mt-0.5">
                    {hmStats.submissionsPending}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#78716C]">
                  Domain Profile
                </span>
                <h3 className="text-xl font-bold text-[#1A1A1A] mt-3">{hmStats.domainProfile.label}</h3>
                <p className="text-xs text-[#78716C] mt-2 leading-relaxed">
                  {hmStats.domainProfile.description}
                </p>
              </div>

              <div className="pt-4 border-t border-[#F0EBE1] mt-6">
                <span className="text-xs font-medium text-[#78716C]">
                  Average Candidate Score: <strong className="text-[#1A1A1A]">{hmStats.avgRankScore}/100</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
