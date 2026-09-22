"use client"

import React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import Features from "@/components/features-3"
import Agenda from "@/components/agenda"
import CallToAction from "@/components/call-to-action"
import FooterSection from "@/components/footer"

const Dither = dynamic(() => import("@/components/Dither"), { ssr: false })
const HeroSection = dynamic(() => import("@/components/hero-section"), { ssr: false })

export default function HomePage() {
  return (
    <div className="dark min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground relative overflow-x-hidden">
      <div className="absolute w-full h-dvh max-h-155 sm:max-h-115 md:max-h-125 lg:max-h-190 xl:max-h-195 pointer-events-none z-0">
        <Dither
          waveColor={[0.30980392156862746, 0.30980392156862746, 0.30980392156862746]}
          disableAnimation={false}
          enableMouseInteraction
          mouseRadius={0.3}
          colorNum={4}
          pixelSize={2}
          waveAmplitude={0.3}
          waveFrequency={3}
          waveSpeed={0.05}
        />
      </div>
      <div className="fixed top-4 right-6 z-20 flex gap-4 text-sm">
        <Link href="/login" className="text-zinc-400 hover:text-white transition-colors">Log In</Link>
        <Link href="/signup" className="text-zinc-400 hover:text-white transition-colors">Sign Up</Link>
      </div>
      <HeroSection />
      <Features />
      <Agenda />
      <CallToAction />
      <FooterSection />
    </div>
  )
}
