"use client"

import { useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Status {
  kind: "idle" | "success" | "error"
  message: string
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [profileId, setProfileId] = useState("")
  const [requestStatus, setRequestStatus] = useState<Status>({ kind: "idle", message: "" })
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  const [token, setToken] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [resetStatus, setResetStatus] = useState<Status>({ kind: "idle", message: "" })

  const handleRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRequestStatus({ kind: "idle", message: "" })

    if (!email.trim()) {
      setRequestStatus({ kind: "error", message: "Email is required." })
      return
    }

    try {
      const response = await fetch("/api/user/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), profileId: profileId.trim() || undefined }),
      })

      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Unable to generate reset token.")
      }

      setResetToken(json.resetToken ?? null)
      setExpiresAt(json.expiresAt ?? null)
      setRequestStatus({ kind: "success", message: json.message ?? "Password reset instructions sent." })
    } catch (error) {
      setRequestStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong. Please try again.",
      })
    }
  }

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setResetStatus({ kind: "idle", message: "" })

    if (!token.trim()) {
      setResetStatus({ kind: "error", message: "Reset token is required." })
      return
    }

    if (!password.trim() || password.length < 8) {
      setResetStatus({ kind: "error", message: "Password must be at least 8 characters." })
      return
    }

    if (password !== confirmPassword) {
      setResetStatus({ kind: "error", message: "Passwords do not match." })
      return
    }

    try {
      const response = await fetch("/api/user/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password }),
      })

      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Unable to reset password.")
      }

      setResetStatus({ kind: "success", message: json.message ?? "Password changed. You can now sign in." })
      setToken("")
      setPassword("")
      setConfirmPassword("")
    } catch (error) {
      setResetStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong. Please try again.",
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d0d0f] to-[#1a1a1c] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-alata text-3xl text-white">Reset your password</h1>
          <p className="text-white/70 text-sm font-sans">
            Enter your registered email to receive a reset token or use a token below to set a new password.
          </p>
        </div>

        <section className="rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-lg space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white font-sans">Request reset token</h2>
            <form onSubmit={handleRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white font-sans text-sm">
                  College email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@college.edu"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 font-sans focus:border-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profileId" className="text-white font-sans text-sm">
                  Profile ID (optional)
                </Label>
                <Input
                  id="profileId"
                  placeholder="tacet@ABC123"
                  value={profileId}
                  onChange={(event) => setProfileId(event.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 font-sans focus:border-white/40"
                />
              </div>

              <Button type="submit" className="w-full bg-white text-black hover:bg-white/90 font-sans font-semibold py-3">
                Send reset token
              </Button>

              {requestStatus.kind !== "idle" && (
                <p
                  className={`text-sm rounded-xl px-4 py-3 font-sans ${
                    requestStatus.kind === "success"
                      ? "border border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                      : "border border-red-400/40 bg-red-400/10 text-red-100"
                  }`}
                >
                  {requestStatus.message}
                </p>
              )}

              {(resetToken || expiresAt) && (
                <div className="space-y-1 text-xs text-white/70 font-mono bg-black/40 border border-white/10 rounded-lg p-3">
                  {resetToken && (
                    <p>
                      <span className="text-white/60">Token:</span> {resetToken}
                    </p>
                  )}
                  {expiresAt && (
                    <p>
                      <span className="text-white/60">Expires:</span> {new Date(expiresAt).toLocaleString()}
                    </p>
                  )}
                  <p className="text-white/60">Store this token securely. You&apos;ll need it to reset your password.</p>
                </div>
              )}
            </form>
          </div>
        </section>

        <section className="rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-lg space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white font-sans">Set a new password</h2>
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="token" className="text-white font-sans text-sm">
                  Reset token
                </Label>
                <Input
                  id="token"
                  placeholder="Paste your reset token"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 font-sans focus:border-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white font-sans text-sm">
                  New password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 font-sans focus:border-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white font-sans text-sm">
                  Confirm password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 font-sans focus:border-white/40"
                />
              </div>

              <Button type="submit" className="w-full bg-white text-black hover:bg-white/90 font-sans font-semibold py-3">
                Reset password
              </Button>

              {resetStatus.kind !== "idle" && (
                <p
                  className={`text-sm rounded-xl px-4 py-3 font-sans ${
                    resetStatus.kind === "success"
                      ? "border border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                      : "border border-red-400/40 bg-red-400/10 text-red-100"
                  }`}
                >
                  {resetStatus.message}
                </p>
              )}
            </form>
          </div>
        </section>

        <p className="text-center text-sm text-white/60 font-sans">
          <Link href="/login" className="text-white hover:underline font-semibold">
            Return to login
          </Link>
        </p>
      </div>
    </div>
  )
}
