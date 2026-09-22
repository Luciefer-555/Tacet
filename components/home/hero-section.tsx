"use client";

import React from "react";
import Link from "next/link";
import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";
import { TextEffect } from "@/components/motion-primitives/text-effect";
import { AnimatedGroup } from "@/components/motion-primitives/animated-group";
import DecryptedText from "@/components/DecryptedText";
import { transitionVariants } from "@/lib/utils";
import LanyardWithControls from "@/components/lanyard-with-controls";
import Dither from "@/components/Dither";
import { ArrowRight, CheckCircle2, Trophy, Cpu, Building2, GraduationCap } from "lucide-react";

export default function HeroSection() {
  return (
    <main className="dark min-h-screen bg-black text-white relative overflow-x-hidden selection:bg-primary selection:text-primary-foreground">
      {/* Halftone / Dot-Matrix Wave Background */}
      <div className="absolute top-0 left-0 right-0 h-[650px] lg:h-[800px] overflow-hidden pointer-events-none z-0 opacity-70">
        <Dither
          waveColor={[0.31, 0.31, 0.31]}
          disableAnimation={false}
          enableMouseInteraction={false}
          mouseRadius={0.3}
          colorNum={4}
          pixelSize={2}
          waveAmplitude={0.3}
          waveFrequency={3}
          waveSpeed={0.05}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black pointer-events-none" />
      </div>

      {/* Top Navbar */}
      <header className="fixed top-0 left-0 right-0 z-40 border-b border-white/10 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="TACET home">
            <Logo size={32} decorative className="text-white" />
            <span className="font-display text-xl font-bold tracking-tight text-white">TACET</span>
          </Link>

          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">
              <Link href="/login">Log In</Link>
            </Button>
            <Button asChild size="sm" className="bg-white text-black hover:bg-white/90 font-medium">
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-screen pt-24 lg:pt-0 flex items-center">
        <div className="w-full mx-auto max-w-7xl px-6 py-12 lg:py-24 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Left Column: Typography & CTAs */}
          <div className="relative z-10 max-w-xl text-left">
            <div className="mb-6 inline-block">
              <DecryptedText
                text="STUDENT PROBLEMS. REAL COMPANIES. AI-RANKED."
                animateOn="view"
                revealDirection="start"
                sequential
                useOriginalCharsOnly={false}
                speed={40}
                delay={300}
                parentClassName="inline-flex items-center font-mono text-xs md:text-sm text-neutral-400 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-full uppercase tracking-wider backdrop-blur-sm"
                className="font-mono"
                encryptedClassName="font-mono text-neutral-600"
              />
            </div>

            <TextEffect
              preset="fade-in-blur"
              speedSegment={0.3}
              delay={0.4}
              as="h1"
              className="text-balance text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white leading-none font-display"
            >
              Solve.
            </TextEffect>

            <TextEffect
              preset="fade-in-blur"
              speedSegment={0.3}
              delay={0.7}
              as="h1"
              className="text-balance text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white/90 mt-2 leading-tight font-display"
            >
              Get Ranked. Get Hired.
            </TextEffect>

            <TextEffect
              per="line"
              preset="fade-in-blur"
              speedSegment={0.3}
              delay={1.0}
              as="p"
              className="mt-6 text-base sm:text-lg text-neutral-300 leading-relaxed max-w-lg"
            >
              A university-partnered platform where companies post real business problems, students submit solutions, and AI pre-screens and ranks submissions before hiring teams see them.
            </TextEffect>

            <AnimatedGroup
              variants={{
                container: {
                  visible: {
                    transition: {
                      staggerChildren: 0.05,
                      delayChildren: 1.3,
                    },
                  },
                },
                ...transitionVariants,
              }}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <Button asChild size="lg" className="px-6 py-6 text-base font-semibold bg-white text-black hover:bg-neutral-200">
                <Link href="/signup">
                  Sign Up <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="px-6 py-6 text-base font-medium border-white/20 bg-white/5 hover:bg-white/10 text-white backdrop-blur-sm"
              >
                <Link href="#overview">Learn More</Link>
              </Button>
            </AnimatedGroup>

            {/* Micro proof points */}
            <div className="mt-12 flex flex-wrap items-center gap-6 text-xs text-neutral-400 border-t border-white/10 pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Real Company Problems</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Automated AI Pre-Screening</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Merit-Based Recruiting</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Lanyard Badge Simulation */}
          <div className="relative w-full h-[550px] sm:h-[650px] lg:h-[800px] flex items-center justify-center">
            <LanyardWithControls
              position={[0, 0, 20]}
              containerClassName="w-full h-full relative select-none"
              defaultName=""
            />
          </div>
        </div>
      </section>

      {/* Overview Section for "Learn More" scroll target */}
      <section id="overview" className="relative border-t border-white/10 bg-neutral-950/80 backdrop-blur-md py-24 px-6">
        <div className="mx-auto max-w-6xl">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400 mb-2">How Tacet Works</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">Problem to Production to Hire</h2>
            <p className="mt-4 text-neutral-400 text-base">
              Replace algorithmic puzzles and resume spam with verifiable work tested on real enterprise challenges.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 relative overflow-hidden group hover:border-white/25 transition-colors">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center mb-6 text-white">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">1. Real Industry Challenges</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Partner companies post genuine architectural, data, and software challenges they actually need solved.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 relative overflow-hidden group hover:border-white/25 transition-colors">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center mb-6 text-white">
                <Cpu className="h-6 w-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">2. AI-Ranked Evaluation</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Submissions pass through automated OCR, semantic scoring, and Rubric AI before human evaluators review them.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 relative overflow-hidden group hover:border-white/25 transition-colors">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center mb-6 text-white">
                <GraduationCap className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">3. Direct Hiring Signals</h3>
              <p className="text-neutral-400 text-sm leading-relaxed">
                Top performers earn verified student credentials and direct interview placement based on objective proof of competence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-black py-8 px-6 text-center text-xs text-neutral-500 font-mono">
        © {new Date().getFullYear()} Tacet. All rights reserved.
      </footer>
    </main>
  );
}
