"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/app/providers"
import { User, Mail, IdCard, GraduationCap, CheckCircle2, AlertCircle, X, Plus } from "lucide-react"

export default function Profile() {
  const { user, login } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null)

  const [formData, setFormData] = useState({
    username: "",
    collegeName: "",
    branch: "",
    year: "",
    avatarUrl: "",
    skills: [] as string[],
  })
  const [skillInput, setSkillInput] = useState("")

  useEffect(() => {
    async function loadProfile() {
      setLoading(true)
      try {
        const res = await fetch("/api/user/profile", {
          credentials: "include",
          headers: { "Cache-Control": "no-cache" },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.profile) {
            setFormData({
              username: data.profile.username || "",
              collegeName: data.profile.collegeName || "",
              branch: data.profile.branch || "",
              year: data.profile.year || "",
              avatarUrl: data.profile.avatarUrl || "",
              skills: Array.isArray(data.profile.skills) ? data.profile.skills : [],
            })
          }
        }
      } catch (err) {
        console.error("Failed to load profile:", err)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleAddSkill = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ("key" in e && e.key !== "Enter") return
    e.preventDefault()
    const trimmed = skillInput.trim()
    if (!trimmed) return
    if (formData.skills.includes(trimmed)) {
      setSkillInput("")
      return
    }
    setFormData((prev) => ({
      ...prev,
      skills: [...prev.skills, trimmed],
    }))
    setSkillInput("")
  }

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skillToRemove),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    setSaving(true)

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update profile")
      }

      // Update local auth context
      login(data.profile)
      setStatus({ kind: "success", message: "Profile saved successfully." })
    } catch (err: any) {
      console.error("Failed to save profile:", err)
      setStatus({ kind: "error", message: err.message || "An unexpected error occurred." })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] p-8 sm:p-12 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-[#3F3FF3] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[#78716C] text-sm font-medium">Loading profile...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1A1A1A] py-10 px-6 sm:px-12">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header — YC Editorial Style */}
        <div className="border-b border-[#E8E2D9] pb-6">
          <span className="text-xs uppercase tracking-wider font-semibold text-[#3F3FF3]">
            Account & Identity
          </span>
          <h1 className="font-serif italic text-3xl sm:text-4xl font-bold tracking-tight text-[#1A1A1A] mt-1">
            Your Profile
          </h1>
          <p className="text-sm text-[#78716C] mt-1.5">
            Manage your academic credentials, verified campus details, and technical skill tags.
          </p>
        </div>

        {/* Status Message Banner */}
        {status && (
          <div
            className={`rounded-xl p-4 flex items-center gap-3 text-sm font-medium ${
              status.kind === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {status.kind === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        )}

        {/* Read-Only Verified Credential Banner (HyperUI pattern) */}
        <div className="rounded-2xl border border-[#E8E2D9] bg-white p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#3F3FF3]/10 text-[#3F3FF3] flex items-center justify-center font-bold text-lg">
              {formData.username ? formData.username.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-[#1A1A1A]">{formData.username || "Candidate"}</span>
                <span className="rounded-md bg-[#3F3FF3]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#3F3FF3]">
                  {user?.role?.replace("_", " ")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#78716C] mt-1">
                <span className="flex items-center gap-1 font-mono">
                  <IdCard className="w-3.5 h-3.5" />
                  {user?.profileId}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  {user?.email}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Editable Form (HyperUI application form pattern) */}
        <form onSubmit={handleSubmit} className="rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Full Name */}
            <div>
              <label htmlFor="username" className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2">
                Full Name
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                placeholder="Ada Lovelace"
                className="w-full rounded-lg border border-[#E8E2D9] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder:text-[#A8A29E] focus:bg-white focus:border-[#1A1A1A] focus:outline-none transition-colors"
              />
            </div>

            {/* College / University */}
            <div>
              <label htmlFor="collegeName" className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2">
                College / Institution
              </label>
              <input
                id="collegeName"
                name="collegeName"
                type="text"
                value={formData.collegeName}
                onChange={handleChange}
                placeholder="National Institute of Technology"
                className="w-full rounded-lg border border-[#E8E2D9] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder:text-[#A8A29E] focus:bg-white focus:border-[#1A1A1A] focus:outline-none transition-colors"
              />
            </div>

            {/* Branch / Major */}
            <div>
              <label htmlFor="branch" className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2">
                Branch / Major
              </label>
              <input
                id="branch"
                name="branch"
                type="text"
                value={formData.branch}
                onChange={handleChange}
                placeholder="Computer Science & Engineering"
                className="w-full rounded-lg border border-[#E8E2D9] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder:text-[#A8A29E] focus:bg-white focus:border-[#1A1A1A] focus:outline-none transition-colors"
              />
            </div>

            {/* Year of Study */}
            <div>
              <label htmlFor="year" className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2">
                Year of Study
              </label>
              <select
                id="year"
                name="year"
                value={formData.year}
                onChange={handleChange}
                className="w-full rounded-lg border border-[#E8E2D9] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1A1A1A] focus:bg-white focus:border-[#1A1A1A] focus:outline-none transition-colors cursor-pointer"
              >
                <option value="">Select current year</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
                <option value="Graduate / Alum">Graduate / Alum</option>
              </select>
            </div>
          </div>

          {/* Technical Skills Tag Input */}
          <div className="pt-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2">
              Skills & Tech Stack (Tags)
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {formData.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#FAF7F2] border border-[#E8E2D9] px-3 py-1 text-xs font-medium text-[#1A1A1A]"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="text-[#78716C] hover:text-red-600 transition-colors cursor-pointer"
                    aria-label={`Remove ${skill}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {formData.skills.length === 0 && (
                <span className="text-xs text-[#A8A29E]">No skills added yet.</span>
              )}
            </div>

            <div className="flex items-center gap-2 max-w-md">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleAddSkill}
                placeholder="Type a skill and press Enter (e.g. Python, Docker, React)"
                className="flex-1 rounded-lg border border-[#E8E2D9] bg-[#FAF7F2] px-3.5 py-2 text-xs text-[#1A1A1A] placeholder:text-[#A8A29E] focus:bg-white focus:border-[#1A1A1A] focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="rounded-lg border border-[#E8E2D9] bg-white px-3 py-2 text-xs font-semibold text-[#1A1A1A] hover:bg-[#FAF7F2] transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>

          {/* Profile Picture URL */}
          <div className="pt-2">
            <label htmlFor="avatarUrl" className="block text-xs font-semibold uppercase tracking-wider text-[#78716C] mb-2">
              Avatar / Picture URL (Optional)
            </label>
            <input
              id="avatarUrl"
              name="avatarUrl"
              type="url"
              value={formData.avatarUrl}
              onChange={handleChange}
              placeholder="https://example.com/avatar.png"
              className="w-full rounded-lg border border-[#E8E2D9] bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-[#1A1A1A] placeholder:text-[#A8A29E] focus:bg-white focus:border-[#1A1A1A] focus:outline-none transition-colors"
            />
          </div>

          {/* Save Action */}
          <div className="pt-6 border-t border-[#F0EBE1] flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white shadow-xs hover:bg-black/85 disabled:opacity-50 transition-all cursor-pointer inline-flex items-center gap-2"
            >
              {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
