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

export default function RecoverCredentialsPage() {
  const [email, setEmail] = useState("")
  const [requestStatus, setRequestStatus] = useState<Status>({ kind: "idle", message: "" })
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)

  const [code, setCode] = useState("")
  const [verifyStatus, setVerifyStatus] = useState<Status>({ kind: "idle", message: "" })
  const [credentials, setCredentials] = useState<{ profileId: string; collegeId: string; username: string } | null>(null)

  const handleRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRequestStatus({ kind: "idle", message: "" })
    setRecoveryCode(null)
    setExpiresAt(null)

    if (!email.trim()) {
      setRequestStatus({ kind: "error", message: "Email is required." })
      return
    }

    try {
      const response = await fetch("/api/user/recover-credentials/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })

      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Unable to generate recovery code.")
      }

      setRecoveryCode(json.recoveryCode ?? null)
      setExpiresAt(json.expiresAt ?? null)
      setRequestStatus({ kind: "success", message: json.message ?? "Recovery code sent." })
    } catch (error) {
      setRequestStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong. Please try again.",
      })
    }
  }

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setVerifyStatus({ kind: "idle", message: "" })
    setCredentials(null)

    if (!email.trim()) {
      setVerifyStatus({ kind: "error", message: "Email is required." })
      return
    }

    if (!code.trim()) {
      setVerifyStatus({ kind: "error", message: "Recovery code is required." })
      return
    }

    try {
      const response = await fetch("/api/user/recover-credentials/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      })

      const json = await response.json()
      if (!response.ok || !json.success) {
        throw new Error(json.error ?? "Unable to verify recovery code.")
      }

      setCredentials(json.credentials ?? null)
      setVerifyStatus({ kind: "success", message: json.message ?? "Recovery successful." })
    } catch (error) {
      setVerifyStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Something went wrong. Please try again.",
      })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d0d0f] to-[#1a1a1c] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-alata text-3xl text-white">Recover your credentials</h1>
          <p className="text-white/70 text-sm font-sans">
            Generate a short-lived recovery code and verify it to retrieve your profile ID and college ID.
          </p>
        </div>

        <section className="rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-lg space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white font-sans">Request recovery code</h2>
            <form onSubmit={handleRequest} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-request" className="text-white font-sans text-sm">
                  College email
                </Label>
                <Input
                  id="email-request"
                  type="email"
                  placeholder="you@college.edu"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 font-sans focus:border-white/40"
                />
              </div>

              <Button type="submit" className="w-full bg-white text-black hover:bg-white/90 font-sans font-semibold py-3">
                Send recovery code
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

              {(recoveryCode || expiresAt) && (
                <div className="space-y-1 text-xs text-white/70 font-mono bg-black/40 border border-white/10 rounded-lg p-3">
                  {recoveryCode && (
                    <p>
                      <span className="text-white/60">Code:</span> {recoveryCode}
                    </p>
                  )}
                  {expiresAt && (
                    <p>
                      <span className="text-white/60">Expires:</span> {new Date(expiresAt).toLocaleString()}
                    </p>
                  )}
                  <p className="text-white/60">This code expires quickly. Keep it private.</p>
                </div>
              )}
            </form>
          </div>
        </section>

        <section className="rounded-2xl border border-white/20 bg-white/5 p-6 backdrop-blur-lg space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white font-sans">Verify recovery code</h2>
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-verify" className="text-white font-sans text-sm">
                  College email
                </Label>
                <Input
                  id="email-verify"
                  type="email"
                  placeholder="you@college.edu"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 font-sans focus:border-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code" className="text-white font-sans text-sm">
                  Recovery code
                </Label>
                <Input
                  id="code"
                  placeholder="Enter the 6-digit code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 font-sans focus:border-white/40"
                />
              </div>

              <Button type="submit" className="w-full bg-white text-black hover:bg-white/90 font-sans font-semibold py-3">
                Verify code
              </Button>

              {verifyStatus.kind !== "idle" && (
                <p
                  className={`text-sm rounded-xl px-4 py-3 font-sans ${
                    verifyStatus.kind === "success"
                      ? "border border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                      : "border border-red-400/40 bg-red-400/10 text-red-100"
                  }`}
                >
                  {verifyStatus.message}
                </p>
              )}

              {credentials && (
                <div className="space-y-2 text-sm text-white/80 font-mono bg-black/40 border border-white/10 rounded-lg p-3">
                  <p>
                    <span className="text-white/60">Profile ID:</span> {credentials.profileId}
                  </p>
                  <p>
                    <span className="text-white/60">College ID:</span> {credentials.collegeId}
                  </p>
                  <p>
                    <span className="text-white/60">Name:</span> {credentials.username}
                  </p>
                </div>
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
