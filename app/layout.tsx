import type { Metadata, Viewport } from "next"
import fs from "fs"
import path from "path"
import localFont from "next/font/local"
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "./providers"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const melodrame = localFont({
  src: "../public/fonts/melodrame.ttf",
  variable: "--font-display",
  fallback: ["Instrument Serif", "serif"],
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
})

// Safe fallback for --font-display when melodrame.ttf is missing or placeholder
const displayFallback = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
})

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
})

// Build-time deploy safety: if .is-fallback marker exists, fall back to Instrument Serif for --font-display
const fontDir = path.join(process.cwd(), "public", "fonts")
const isFallback = fs.existsSync(path.join(fontDir, ".is-fallback"))
const displayFontVariable = isFallback ? displayFallback.variable : melodrame.variable

export const metadata: Metadata = {
  title: {
    default: 'TACET | Student Platform',
    template: '%s | TACET'
  },
  description: 'Track your academic and technical growth with Tacet',
  keywords: ['student', 'education', 'learning', 'academics', 'progress tracking'],
  authors: [{ name: 'TACET' }],
  creator: 'TACET',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://syncin.vercel.app',
    title: 'TACET | Student Platform',
    description: 'Track your academic and technical growth with Tacet',
    siteName: 'TACET',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TACET | Student Platform',
    description: 'Track your academic and technical growth with Tacet',
  },
}

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0C1221" }],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${displayFontVariable} ${instrumentSerif.variable} ${geistSans.variable} ${geistMono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark">
          <AuthProvider>{children}</AuthProvider>
          <Analytics />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
