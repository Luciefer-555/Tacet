"use client"

import { CheckCircle2 } from "lucide-react"

export default function AboutTacet() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1A1A1A] py-10 px-6 sm:px-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="border-b border-[#E8E2D9] pb-6">
          <span className="text-xs uppercase tracking-wider font-semibold text-[#3F3FF3]">
            Platform Overview
          </span>
          <h1 className="font-serif italic text-3xl sm:text-4xl font-bold tracking-tight text-[#1A1A1A] mt-1">
            About TACET
          </h1>
          <p className="text-sm text-[#78716C] mt-1.5">
            Engineering problem-solving evaluated on real signal, not resumes.
          </p>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="font-serif italic text-xl font-bold text-[#1A1A1A] mb-3">Our Mission</h2>
            <p className="text-sm text-[#6B6661] leading-relaxed">
              Tacet connects students and engineering teams through real production-style problem solving. We bypass keyword screens, automated resume parsers, and trivia questions in favor of architectural rigor, edge case resilience, and executable solutions evaluated by a multi-agent AI panel.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E8E2D9] bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="font-serif italic text-xl font-bold text-[#1A1A1A] mb-4">How Tacet Works</h2>
            <ul className="space-y-3 text-sm text-[#6B6661]">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#3F3FF3] shrink-0 mt-0.5" />
                <span><strong>Real Engineering Backlogs:</strong> Problems originate from genuine production constraints rather than synthetic puzzles.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#3F3FF3] shrink-0 mt-0.5" />
                <span><strong>Multi-Agent AI Panel:</strong> Specialized agents evaluate code correctness, edge-case coverage, system architecture, and decision rationale.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#3F3FF3] shrink-0 mt-0.5" />
                <span><strong>Verified Candidate Bench:</strong> Hiring teams receive a ranked pipeline of candidates who have demonstrated verified problem-solving ability.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
