"use client"

import { Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { StudentClassJoinBar } from "@/components/classes-hub"

export default function ClassesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div>
        <div className="mb-2 flex items-center gap-2 text-[#3F3FF3]">
          <Users className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">Campus</span>
        </div>
        <h1 className="font-serif text-3xl font-normal tracking-tight text-[#1A1A1A]">Classes</h1>
        <p className="mt-1 text-sm text-[#78716C]">Join mentor-led classes and access their assignments once approved.</p>
      </div>
      <Card className="rounded-2xl border border-[#E8E2D9] bg-white p-6 shadow-sm">
        <StudentClassJoinBar />
      </Card>
    </div>
  )
}
