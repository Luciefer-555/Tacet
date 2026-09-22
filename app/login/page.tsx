"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "../providers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff } from "lucide-react"
import Logo from "@/components/logo"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [profileId, setProfileId] = useState("")
  const [collegeId, setCollegeId] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<{ kind: "error" | "success"; message: string } | null>(null)

  const { login } = useAuth()
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)

    if (!profileId.trim()) {
      setStatus({ kind: "error", message: "Profile ID is required." })
      return
    }
    if (!password.trim()) {
      setStatus({ kind: "error", message: "Password is required." })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/user/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          profileId: profileId.trim(),
          collegeId: collegeId.trim() || undefined,
          password,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Sign-in failed. Please try again.")
      }

      const serverUser = json.user as { username: string; role: string }
      login({
        username: serverUser.username,
        profileId: profileId.trim(),
        collegeId: collegeId.trim(),
        collegeName: "",
        skills: [],
        role: serverUser.role,
        joinedAt: new Date().toISOString(),
        email: email.trim() || undefined,
      })

      setStatus({ kind: "success", message: "Signed in successfully." })
      router.push("/")
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "An unexpected error occurred." })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dark min-h-screen flex font-sans bg-zinc-950 text-white">
      {/* Left Marketing Panel with Signature Blue */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{ backgroundColor: "#3F3FF3" }}>
        <div className="relative z-10 flex flex-col justify-between w-full px-12 py-12">
          {/* TACET Wordmark */}
          <div className="flex items-center">
            <Logo size={36} decorative className="mr-3 text-white" />
            <h1 className="text-2xl font-bold tracking-wider font-display text-white">TACET</h1>
          </div>

          {/* Marketing Copy */}
          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <h2 className="text-4xl font-semibold text-white mb-6 leading-tight">
              Solve real problems. Get ranked. Get hired.
            </h2>
            <p className="text-white/90 text-lg leading-relaxed">
              Log in to solve genuine company challenges, see your multi-agent AI score, and get fast-tracked to hiring teams.
            </p>
          </div>

          {/* Footer Info */}
          <div className="flex justify-between items-center text-white/70 text-sm">
            <span>&copy; {new Date().getFullYear()} Tacet. All rights reserved.</span>
            <span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
          </div>
        </div>
      </div>

      {/* Right Form Panel with Dark Inversion */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-zinc-950">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-6">
            <Logo size={36} decorative className="mx-auto mb-2 text-white" />
            <h1 className="text-xl font-bold tracking-wider font-display text-white">TACET</h1>
          </div>

          <div className="space-y-6">
            <div className="space-y-2 text-center lg:text-left">
              <h2 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h2>
              <p className="text-zinc-300 text-sm">
                Enter your credentials to access your account.
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

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Profile ID (Required) */}
              <div className="space-y-2">
                <Label htmlFor="profileId" className="text-sm font-medium text-zinc-200">
                  Profile ID <span className="text-[#3F3FF3]">*</span>
                </Label>
                <Input
                  id="profileId"
                  placeholder="tacet@ABC123"
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  className="h-12 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0"
                />
              </div>

              {/* Password (Required) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-zinc-200">
                    Password <span className="text-[#3F3FF3]">*</span>
                  </Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs hover:underline"
                    style={{ color: "#3F3FF3" }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 text-zinc-400 hover:text-white hover:bg-transparent cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Email Address (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-zinc-300">
                  Email address <span className="text-zinc-500 text-xs">(optional)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0"
                />
              </div>

              {/* College ID (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="collegeId" className="text-sm font-medium text-zinc-300">
                  College ID <span className="text-zinc-500 text-xs">(optional)</span>
                </Label>
                <Input
                  id="collegeId"
                  placeholder="e.g., NITD123"
                  value={collegeId}
                  onChange={(e) => setCollegeId(e.target.value)}
                  className="h-12 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-500 rounded-lg focus-visible:border-[#3F3FF3] focus-visible:ring-0"
                />
              </div>

              {/* Helper Links */}
              <div className="text-xs text-zinc-400">
                <Link href="/recover-credentials" className="text-zinc-400 hover:text-zinc-200 underline">
                  Lost your profile or college ID?
                </Link>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90 shadow-none cursor-pointer mt-2"
                style={{ backgroundColor: "#3F3FF3" }}
              >
                {submitting ? "Signing in..." : "Log In"}
              </Button>
            </form>

            <div className="text-center text-sm text-zinc-400 pt-2">
              Don't have an account?{" "}
              <Link
                href="/signup"
                className="font-semibold hover:underline"
                style={{ color: "#3F3FF3" }}
              >
                Register Now.
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
