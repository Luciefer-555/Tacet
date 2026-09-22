"use client"

import { useAuth } from "./providers"
import Navbar from "@/components/navbar"
import HomePage from "@/components/home-page"
import ProblemStatements from "@/components/pages/problem-statements"
import ClassesPage from "@/components/pages/classes"
import Profile from "@/components/pages/profile"
import AboutTacet from "@/components/pages/about-tacet"
import WrappedDashboard from "@/components/pages/wrapped-dashboard"
import { HeroSplash } from "@/components/hero-splash"
import { useState } from "react"

export default function Page() {
  const { isLoggedIn, user } = useAuth()
  const [currentPage, setCurrentPage] = useState("dashboard")
  const [heroDone, setHeroDone] = useState(false)

  if (!heroDone) {
    return <HeroSplash onComplete={() => setHeroDone(true)} />
  }

  const renderPage = () => {
    if (!isLoggedIn) {
      return <HomePage />
    }

    switch (currentPage) {
      case "dashboard":
      case "wrapped":
        return <WrappedDashboard />
      case "problem-statements":
        return <ProblemStatements />
      case "classes":
        return user?.role === "student" ? <ClassesPage /> : <WrappedDashboard />
      case "profile":
        return <Profile />
      case "about":
        return <AboutTacet />
      default:
        return <WrappedDashboard />
    }
  }

  return (
    <div className={`min-h-screen ${isLoggedIn ? "bg-[#FAF7F2] text-[#1A1A1A]" : "bg-background"}`}>
      {isLoggedIn && <Navbar currentPage={currentPage} onNavigate={setCurrentPage} />}
      <main className={isLoggedIn ? "pt-16 min-h-screen bg-[#FAF7F2] text-[#1A1A1A]" : ""}>
        {renderPage()}
      </main>
    </div>
  )
}

