"use client"

import { useState, useRef, useEffect } from "react"
import { useAuth } from "@/app/providers"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Logo from "@/components/logo"
import { User, LogOut, Info, ChevronDown } from "lucide-react"

interface NavbarProps {
  currentPage?: string
  onNavigate?: (page: string) => void
}

export default function Navbar({ currentPage = "dashboard", onNavigate }: NavbarProps) {
  const { isLoggedIn, user, logout } = useAuth()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleLogout = () => {
    setDropdownOpen(false)
    logout()
    router.push("/")
  }

  const handleNavigate = (page: string) => {
    setDropdownOpen(false)
    if (onNavigate) {
      onNavigate(page)
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#FAF7F2]/90 backdrop-blur-md border-b border-[#E8E2D9] transition-all">
      <div className="max-w-6xl mx-auto px-6 h-full flex items-center justify-between">
        {/* Left: Logo & Brand + Primary Nav Links */}
        <div className="flex items-center gap-10">
          <button
            type="button"
            onClick={() => handleNavigate("dashboard")}
            className="flex items-center gap-2.5 text-[#1A1A1A] hover:opacity-85 transition-opacity cursor-pointer group"
          >
            <Logo size={26} decorative className="text-[#1A1A1A]" />
            <span className="font-display text-xl font-bold tracking-wider text-[#1A1A1A]">
              TACET
            </span>
          </button>

          {isLoggedIn && (
            <nav className="hidden sm:flex items-center gap-8">
              <button
                type="button"
                onClick={() => handleNavigate("dashboard")}
                className={`text-sm tracking-wide font-medium transition-colors cursor-pointer py-1 ${
                  currentPage === "dashboard" || currentPage === "wrapped"
                    ? "text-[#1A1A1A] border-b-2 border-[#1A1A1A]"
                    : "text-[#78716C] hover:text-[#1A1A1A]"
                }`}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => handleNavigate("problem-statements")}
                className={`text-sm tracking-wide font-medium transition-colors cursor-pointer py-1 ${
                  currentPage === "problem-statements"
                    ? "text-[#1A1A1A] border-b-2 border-[#1A1A1A]"
                    : "text-[#78716C] hover:text-[#1A1A1A]"
                }`}
              >
                Problem Statements
              </button>
            </nav>
          )}
        </div>

        {/* Right: Controls / Profile Dropdown */}
        <div className="flex items-center gap-4">
          {!isLoggedIn ? (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-[#1A1A1A] hover:text-[#1A1A1A]/80 px-3 py-1.5 transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center rounded-full bg-black px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-black/90 transition-all cursor-pointer"
              >
                Apply
              </Link>
            </div>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2.5 rounded-full border border-[#E8E2D9] bg-white px-3 py-1.5 text-sm font-medium text-[#1A1A1A] shadow-xs hover:bg-[#F5F0E8] transition-all cursor-pointer"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <div className="w-6 h-6 rounded-full bg-[#3F3FF3]/15 text-[#3F3FF3] flex items-center justify-center text-xs font-bold uppercase">
                  {user?.username ? user.username.charAt(0) : "U"}
                </div>
                <span className="hidden sm:inline max-w-[120px] truncate text-xs font-semibold">
                  {user?.username || "Account"}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#78716C] transition-transform duration-150 ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown Menu (HyperUI pattern) */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[#E8E2D9] bg-white p-1.5 shadow-lg z-50 text-[#1A1A1A] animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2 border-b border-[#F0EBE1] mb-1">
                    <p className="text-xs font-semibold text-[#1A1A1A] truncate">{user?.username}</p>
                    <p className="text-[11px] text-[#78716C] font-mono truncate">{user?.profileId}</p>
                    <span className="mt-1 inline-block rounded-md bg-[#3F3FF3]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#3F3FF3]">
                      {user?.role?.replace("_", " ")}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleNavigate("profile")}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                      currentPage === "profile" ? "bg-[#FAF7F2] text-[#1A1A1A] font-semibold" : "text-[#44403C] hover:bg-[#FAF7F2] hover:text-[#1A1A1A]"
                    }`}
                  >
                    <User className="w-3.5 h-3.5 text-[#78716C]" />
                    Profile
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavigate("about")}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                      currentPage === "about" ? "bg-[#FAF7F2] text-[#1A1A1A] font-semibold" : "text-[#44403C] hover:bg-[#FAF7F2] hover:text-[#1A1A1A]"
                    }`}
                  >
                    <Info className="w-3.5 h-3.5 text-[#78716C]" />
                    About Tacet
                  </button>

                  <div className="my-1 border-t border-[#F0EBE1]" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
