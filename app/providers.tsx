"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { Spinner } from "@/components/ui/spinner"
import { AUTH_STORAGE_KEY } from "@/lib/constants/auth"

export interface PublicUser {
  userId?: string
  username: string
  profileId: string
  collegeId?: string
  collegeName?: string
  companyId?: string
  emailVerified?: boolean
  skills?: string[]
  role: string
  joinedAt?: string
  email?: string
  branch?: string
  year?: string
  avatarUrl?: string
}

interface AuthContextType {
  isLoggedIn: boolean
  isLoading: boolean
  user: PublicUser | null
  login: (user: PublicUser) => void
  logout: () => void
}

const STORAGE_KEY = AUTH_STORAGE_KEY

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function verifySession() {
      try {
        const res = await fetch("/api/user/profile", {
          credentials: "include",
          headers: { "Cache-Control": "no-cache" },
        })

        if (!isMounted) return

        if (res.ok) {
          const data = await res.json()
          if (data.success && data.profile) {
            const serverProfile: PublicUser = {
              userId: data.profile.userId,
              profileId: data.profile.profileId,
              username: data.profile.username,
              role: data.profile.role,
              collegeId: data.profile.collegeId,
              collegeName: data.profile.collegeName,
              companyId: data.profile.companyId,
              branch: data.profile.branch,
              year: data.profile.year,
              skills: data.profile.skills,
              avatarUrl: data.profile.avatarUrl,
              email: data.profile.email,
              joinedAt: data.profile.joinedAt,
            }

            setUser(serverProfile)
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serverProfile))
            setIsLoading(false)
            return
          }
        }

        // 401 or unexpected response: clear stale local data
        setUser(null)
        window.localStorage.removeItem(STORAGE_KEY)
      } catch (err) {
        console.error("Failed to verify session with /api/user/profile:", err)
        setUser(null)
        window.localStorage.removeItem(STORAGE_KEY)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    verifySession()

    return () => {
      isMounted = false
    }
  }, [])

  const login = (nextUser: PublicUser) => {
    setUser(nextUser)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser))
    } catch (error) {
      console.error("Failed to persist user", error)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/user/logout', { method: 'POST', credentials: 'include' })
    } catch {
      // Even if network fails, client state is cleared below
    }
    setUser(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error("Failed to remove stored user", error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn: Boolean(user), isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
