"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { supabase } from "@/lib/supabase"

export type UserRole = "agent" | "manager"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isReady: boolean // ✅ NEW: tells the app when auth hydration is finished
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("id,email,role").eq("id", userId).single()
  if (error) throw error
  return data as { id: string; email: string; role: UserRole }
}

function toUser(u: { id: string; email: string }, role: UserRole): User {
  return {
    id: u.id,
    email: u.email,
    name: u.email.split("@")[0],
    role,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let mounted = true

    const hydrate = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const sessionUser = data.session?.user

        if (!sessionUser?.id || !sessionUser.email) {
          if (mounted) setUser(null)
          return
        }

        const profile = await fetchProfile(sessionUser.id)
        if (mounted) setUser(toUser({ id: sessionUser.id, email: sessionUser.email }, profile.role))
      } catch (e) {
        console.error("Auth hydrate error:", e)
        await supabase.auth.signOut()
        if (mounted) setUser(null)
      } finally {
        if (mounted) setIsReady(true) // ✅ hydration finished
      }
    }

    hydrate()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        const u = session?.user
        if (!u?.id || !u.email) {
          setUser(null)
          setIsReady(true)
          return
        }

        const profile = await fetchProfile(u.id)
        setUser(toUser({ id: u.id, email: u.email }, profile.role))
        setIsReady(true)
      } catch (e) {
        console.error("Auth state change error:", e)
        await supabase.auth.signOut()
        setUser(null)
        setIsReady(true)
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      // Sign in only
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const u = data.user
      if (!u?.id || !u.email) throw new Error("Auth user not found")

      const profile = await fetchProfile(u.id)
      setUser(toUser({ id: u.id, email: u.email }, profile.role))
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  return <AuthContext.Provider value={{ user, isLoading, isReady, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
