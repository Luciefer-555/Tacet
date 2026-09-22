"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "../providers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, EyeOff, GraduationCap, Briefcase, Sparkles } from "lucide-react"
import Logo from "@/components/logo"
import { Rise, Morph } from "cube-motion/react"

type Status = { kind: "error" | "success"; message: string } | null
type SupportedRole = "student" | "hiring_manager" | "mentor"

const ROLE_MESSAGES: Record<SupportedRole, Array<{ headline: string; subtext: string }>> = {
  student: [
    {
      headline: "Show your work. Skip the resume screen.",
      subtext: "Join students and engineering teams tackling real company problems evaluated by a multi-agent AI panel.",
    },
    {
      headline: "Solve real problems, not puzzles.",
      subtext: "Work on challenges straight from engineering backlogs — real stacks, real constraints, real code.",
    },
    {
      headline: "Get ranked by AI, seen by real teams.",
      subtext: "Your code is evaluated across architecture, edge cases, and clarity — then delivered directly to hiring engineers.",
    },
  ],
  hiring_manager: [
    {
      headline: "Hire on signal, not pedigree.",
      subtext: "Skip keyword screens and LeetCode. Evaluate candidates on actual production-style problem solving.",
    },
    {
      headline: "Post once, get a ranked bench.",
      subtext: "Drop in problems straight from your backlog. Our panel scores architecture, test coverage, and decisions.",
    },
    {
      headline: "Candidates ready to ship.",
      subtext: "Every submission includes a complete evaluation breakdown — see how they think, not just if it passes.",
    },
  ],
  mentor: [
    {
      headline: "Help shape the next generation of engineers.",
      subtext: "Guide candidates through real problems, review approaches, and leave actionable feedback.",
    },
    {
      headline: "High-impact, low-overhead.",
      subtext: "Step in where candidates need senior perspective — architecture reviews, trade-offs, production patterns.",
    },
    {
      headline: "Recognized for your craft.",
      subtext: "Build your reputation as a mentor while helping teams discover candidates who know how to build.",
    },
  ],
}

function RotatingPanelCopy({ role }: { role: SupportedRole }) {
  const messages = ROLE_MESSAGES[role] || ROLE_MESSAGES.student
  const [active, setActive] = useState(false)
  const [faceA, setFaceA] = useState(messages[0])
  const [faceB, setFaceB] = useState(messages[0])
  const activeRef = useRef(active)
  activeRef.current = active
  const indexRef = useRef(0)
  const isInitialMount = useRef(true)

  // Immediate smooth morph when role changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    indexRef.current = 0
    const target = messages[0]
    if (activeRef.current) {
      setFaceA(target)
      setActive(false)
    } else {
      setFaceB(target)
      setActive(true)
    }
  }, [role, messages])

  // Automatic interval rotation (4s)
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    const timer = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % messages.length
      const nextMsg = messages[indexRef.current]
      if (activeRef.current) {
        setFaceA(nextMsg)
        setActive(false)
      } else {
        setFaceB(nextMsg)
        setActive(true)
      }
    }, 4000)

    return () => clearInterval(timer)
  }, [role, messages])

  return (
    <div className="flex-1 flex flex-col justify-center max-w-lg">
      <div className="min-h-[6rem] mb-6 flex flex-col justify-center">
        <Morph
          active={active}
          off={<h2 className="text-4xl font-semibold text-white leading-tight">{faceA.headline}</h2>}
          on={<h2 className="text-4xl font-semibold text-white leading-tight">{faceB.headline}</h2>}
          className="morph-wrap block w-full"
        />
      </div>
      <div className="min-h-[5.5rem] flex flex-col justify-start">
        <Morph
          active={active}
          off={<p className="text-white/90 text-lg leading-relaxed">{faceA.subtext}</p>}
          on={<p className="text-white/90 text-lg leading-relaxed">{faceB.subtext}</p>}
          className="morph-wrap block w-full"
        />
      </div>
    </div>
  )
}

export default function SignupPage() {
  const [selectedRole, setSelectedRole] = useState<SupportedRole>("student")
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    collegeId: "",
    collegeName: "",
    companyName: "",
    password: "",
    confirmPassword: "",
    year: "",
    branch: "",
    skills: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const { login } = useAuth()
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleYearChange = (value: string) => {
    setFormData((prev) => ({ ...prev, year: value }))
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)

    if (!formData.fullName.trim()) {
      setStatus({ kind: "error", message: "Please provide your full name." })
      return
    }
    if (!formData.email.trim()) {
      setStatus({ kind: "error", message: "Email address is required." })
      return
    }
    if (selectedRole === "student" || selectedRole === "mentor") {
      if (!formData.collegeId.trim() || !formData.collegeName.trim()) {
        setStatus({ kind: "error", message: "College ID and college name are required." })
        return
      }
    }
    if (selectedRole === "student") {
      const isCollegeEmail = /@(.*\.)?(edu|ac)(\.\w+)?$/i.test(formData.email.trim())
      if (!isCollegeEmail) {
        setStatus({ kind: "error", message: "Students must provide a valid college email ending in .edu or .ac." })
        return
      }
    }
    if (!formData.phone.trim()) {
      setStatus({ kind: "error", message: "Phone number is required." })
      return
    }
    if (formData.password.length < 8) {
      setStatus({ kind: "error", message: "Password must be at least 8 characters long." })
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setStatus({ kind: "error", message: "Passwords do not match." })
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.fullName.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          collegeId: selectedRole === "hiring_manager" ? "CAMPUS_DEFAULT" : formData.collegeId.trim(),
          collegeName: selectedRole === "hiring_manager" ? (formData.companyName.trim() || "Partner Company") : formData.collegeName.trim(),
          password: formData.password,
          skills: formData.skills
            .split(",")
            .map((skill) => skill.trim())
            .filter(Boolean),
          role: selectedRole,
        }),
      })

      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Unable to create account. Please try again.")
      }

      login(json.user)
      setStatus({ kind: "success", message: `Account created! Your profile ID is ${json.user.profileId}.` })
      router.push("/")
    } catch (error) {
      console.error("Signup failed", error)
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "An unexpected error occurred." })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dark min-h-screen flex font-sans bg-zinc-950 text-white">
      {/* Left Marketing Panel with Signature Blue */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ backgroundColor: "#3F3FF3" }}>
        <Rise as="div" targets="children" className="relative z-10 flex flex-col justify-between w-full px-12 py-12">
          {/* TACET Wordmark */}
          <div className="flex items-center">
            <Logo size={36} decorative className="mr-3 text-white" />
            <h1 className="text-2xl font-bold tracking-wider font-display text-white">TACET</h1>
          </div>

          {/* Marketing Copy */}
          <RotatingPanelCopy role={selectedRole} />

          {/* Footer Info */}
          <div className="flex justify-between items-center text-white/70 text-sm">
            <span>&copy; {new Date().getFullYear()} Tacet. All rights reserved.</span>
            <span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
          </div>
        </Rise>
      </div>

      {/* Right Form Panel with Dark Inversion */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-zinc-950 min-h-screen overflow-y-auto">
        <div className="w-full max-w-lg space-y-6 py-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-4">
            <Logo size={36} decorative className="mx-auto mb-2 text-white" />
            <h1 className="text-xl font-bold tracking-wider font-display text-white">TACET</h1>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-white tracking-tight">Create Account</h2>
            <p className="text-zinc-300 text-sm">
              Choose your role and register to get started on the Tacet platform.
            </p>
          </div>

          {status && (
            <p
              className={`rounded-xl px-4 py-3 text-sm ${
                status.kind === "error"
                  ? "border border-red-500/30 bg-red-500/10 text-red-300"
                  : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {status.message}
            </p>
          )}

          {/* Role Selection Group */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Select Your Role
            </Label>
            <div className="grid grid-cols-3 gap-2.5">
              {/* Student Role (Default) */}
              <button
                type="button"
                onClick={() => setSelectedRole("student")}
                className={`relative flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedRole === "student"
                    ? "border-[#3F3FF3] bg-[#3F3FF3]/15 text-white shadow-sm ring-1 ring-[#3F3FF3]"
                    : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <GraduationCap className={`size-5 mb-1.5 ${selectedRole === "student" ? "text-[#3F3FF3]" : "text-zinc-400"}`} />
                <span className="font-semibold text-xs text-white">Student</span>
                <span className="text-[10px] text-zinc-400 mt-0.5 leading-tight">Solve & Rank</span>
              </button>

              {/* Hiring Team Role */}
              <button
                type="button"
                onClick={() => setSelectedRole("hiring_manager")}
                className={`relative flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedRole === "hiring_manager"
                    ? "border-[#3F3FF3] bg-[#3F3FF3]/15 text-white shadow-sm ring-1 ring-[#3F3FF3]"
                    : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <Briefcase className={`size-5 mb-1.5 ${selectedRole === "hiring_manager" ? "text-[#3F3FF3]" : "text-zinc-400"}`} />
                <span className="font-semibold text-xs text-white">Hiring Team</span>
                <span className="text-[10px] text-zinc-400 mt-0.5 leading-tight">Post & Hire</span>
              </button>

              {/* Mentor Role */}
              <button
                type="button"
                onClick={() => setSelectedRole("mentor")}
                className={`relative flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                  selectedRole === "mentor"
                    ? "border-[#3F3FF3] bg-[#3F3FF3]/15 text-white shadow-sm ring-1 ring-[#3F3FF3]"
                    : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                <Sparkles className={`size-5 mb-1.5 ${selectedRole === "mentor" ? "text-[#3F3FF3]" : "text-zinc-400"}`} />
                <span className="font-semibold text-xs text-white">Mentor</span>
                <span className="text-[10px] text-zinc-400 mt-0.5 leading-tight">Guide & Review</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4 pt-1">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="fullName" className="text-sm font-medium text-zinc-200">
                Full Name <span className="text-[#3F3FF3]">*</span>
              </Label>
              <Input
                id="fullName"
                name="fullName"
                placeholder="John Doe"
                value={formData.fullName}
                onChange={handleChange}
                className="h-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0"
              />
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-zinc-200">
                Email address <span className="text-[#3F3FF3]">*</span>{" "}
                {selectedRole === "student" && (
                  <span className="text-xs text-zinc-400">(.edu or .ac required)</span>
                )}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder={
                  selectedRole === "student"
                    ? "student@university.edu"
                    : selectedRole === "mentor"
                    ? "mentor@university.edu"
                    : "recruiter@company.com"
                }
                value={formData.email}
                onChange={handleChange}
                className="h-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-sm font-medium text-zinc-200">
                Phone number <span className="text-[#3F3FF3]">*</span>{" "}
                <span className="text-xs text-zinc-500">(kept private)</span>
              </Label>
              <Input
                id="phone"
                name="phone"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={handleChange}
                className="h-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0"
              />
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-zinc-200">
                  Password <span className="text-[#3F3FF3]">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 chars"
                    value={formData.password}
                    onChange={handleChange}
                    className="h-11 pr-9 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-2.5 text-zinc-400 hover:text-white hover:bg-transparent cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-200">
                  Confirm Password <span className="text-[#3F3FF3]">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repeat password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="h-11 pr-9 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-2.5 text-zinc-400 hover:text-white hover:bg-transparent cursor-pointer"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Student & Mentor College-scoped details */}
            {(selectedRole === "student" || selectedRole === "mentor") && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="collegeName" className="text-sm font-medium text-zinc-200">
                      College / University <span className="text-[#3F3FF3]">*</span>
                    </Label>
                    <Input
                      id="collegeName"
                      name="collegeName"
                      placeholder="e.g., NIT Trichy"
                      value={formData.collegeName}
                      onChange={handleChange}
                      className="h-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="collegeId" className="text-sm font-medium text-zinc-200">
                      College ID / Campus code <span className="text-[#3F3FF3]">*</span>
                    </Label>
                    <Input
                      id="collegeId"
                      name="collegeId"
                      placeholder="e.g., NITT123"
                      value={formData.collegeId}
                      onChange={handleChange}
                      className="h-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="branch" className="text-sm font-medium text-zinc-300">
                      {selectedRole === "mentor" ? "Department / Specialization" : "Branch / Major"}{" "}
                      <span className="text-zinc-500 text-xs">(optional)</span>
                    </Label>
                    <Input
                      id="branch"
                      name="branch"
                      placeholder={selectedRole === "mentor" ? "Computer Science & Engineering" : "Computer Science"}
                      value={formData.branch}
                      onChange={handleChange}
                      className="h-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0"
                    />
                  </div>

                  {selectedRole === "student" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="year" className="text-sm font-medium text-zinc-300">
                        Year of Study <span className="text-zinc-500 text-xs">(optional)</span>
                      </Label>
                      <Select value={formData.year} onValueChange={handleYearChange}>
                        <SelectTrigger className="h-11 bg-zinc-900 border-zinc-800 text-white rounded-lg focus:ring-0 focus:border-[#3F3FF3]">
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                          <SelectItem value="1st">1st Year</SelectItem>
                          <SelectItem value="2nd">2nd Year</SelectItem>
                          <SelectItem value="3rd">3rd Year</SelectItem>
                          <SelectItem value="4th">4th Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Hiring Team specific field */}
            {selectedRole === "hiring_manager" && (
              <div className="space-y-1.5">
                <Label htmlFor="companyName" className="text-sm font-medium text-zinc-200">
                  Company / Organization Name <span className="text-[#3F3FF3]">*</span>
                </Label>
                <Input
                  id="companyName"
                  name="companyName"
                  placeholder="e.g., Acme Robotics"
                  value={formData.companyName}
                  onChange={handleChange}
                  className="h-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0"
                />
              </div>
            )}

            {/* Skills / Interests */}
            <div className="space-y-1.5">
              <Label htmlFor="skills" className="text-sm font-medium text-zinc-300">
                Skills / Keywords <span className="text-zinc-500 text-xs">(comma separated)</span>
              </Label>
              <Input
                id="skills"
                name="skills"
                placeholder="e.g., Python, React, PyTorch, System Design"
                value={formData.skills}
                onChange={handleChange}
                className="h-11 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90 shadow-none cursor-pointer mt-4"
              style={{ backgroundColor: "#3F3FF3" }}
            >
              {submitting ? "Creating Account..." : "Create Account"}
            </Button>
          </form>

          {/* Login Link */}
          <div className="text-center text-sm text-zinc-400 pt-1">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold hover:underline"
              style={{ color: "#3F3FF3" }}
            >
              Sign In.
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
