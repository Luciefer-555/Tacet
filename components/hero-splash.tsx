"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type HeroSplashProps = {
  /** Called once the hero is finished (video ended or user skipped). */
  onComplete: () => void
}

export function HeroSplash({ onComplete }: HeroSplashProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasTouched, setHasTouched] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  // Fade out, then hand off to the app.
  const finish = useCallback(() => {
    setIsExiting(true)
    window.setTimeout(onComplete, 600) // must match the exit transition duration below
  }, [onComplete])

  const handleTouch = useCallback(() => {
    if (hasTouched) return
    setHasTouched(true)

    const video = videoRef.current
    if (!video) {
      finish()
      return
    }

    video.currentTime = 0
    const playPromise = video.play()
    // If autoplay is blocked for any reason, don't strand the user on a dead screen.
    if (playPromise) {
      playPromise.catch(() => finish())
    }
  }, [hasTouched, finish])

  // Keyboard parity with touch/click.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleTouch()
      }
    },
    [handleTouch],
  )

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Touch to begin"
      onClick={handleTouch}
      onKeyDown={handleKeyDown}
      className={`fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black transition-opacity duration-[600ms] ease-out ${
        isExiting ? "pointer-events-none opacity-0" : "opacity-100"
      } ${hasTouched ? "cursor-default" : "cursor-pointer"}`}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        onEnded={finish}
        className="h-full w-full object-contain"
      >
        <source src="/hero-touch.mp4" type="video/mp4" />
      </video>

      {/* "touch here" — breathing until touched, then fades out */}
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
          hasTouched ? "opacity-0" : "opacity-100"
        }`}
      >
        <span
          className={`select-none text-sm font-light tracking-[0.35em] text-white/80 md:text-base ${
            prefersReducedMotion ? "" : "animate-breathe"
          }`}
        >
          touch here
        </span>
      </div>

      {/* Skip — always available, low-key until hovered/focused */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          finish()
        }}
        className="absolute bottom-6 right-6 text-xs tracking-widest text-white/30 transition-colors hover:text-white/80 focus:text-white/80 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
      >
        skip
      </button>
    </div>
  )
}
