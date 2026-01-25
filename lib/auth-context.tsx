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
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role")
    .eq("id", userId)
    .single()

  if (error) throw error
  return data as { id: string; email: string; role: UserRole }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Load session on refresh + subscribe to auth state
  useEffect(() => {
    const hydrate = async () => {
      const { data } = await supabase.auth.getSession()
      const sessionUser = data.session?.user
      if (!sessionUser?.id || !sessionUser.email) return

      try {
        const profile = await fetchProfile(sessionUser.id)
        setUser({
          id: sessionUser.id,
          email: sessionUser.email,
          name: sessionUser.email.split("@")[0],
          role: profile.role,
        })
      } catch (e) {
        console.error("Profile load error:", e)
        // If profile doesn't exist, we force logout to avoid weird half-auth state
        await supabase.auth.signOut()
        setUser(null)
      }
    }

    hydrate()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user
      if (!u?.id || !u.email) {
        setUser(null)
        return
      }

      try {
        const profile = await fetchProfile(u.id)
        setUser({
          id: u.id,
          email: u.email,
          name: u.email.split("@")[0],
          role: profile.role,
        })
      } catch (e) {
        console.error("Auth change profile error:", e)
        await supabase.auth.signOut()
        setUser(null)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      // Sign in only (NO auto-signup)
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) throw signInErr

      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw userErr
      const u = userData.user
      if (!u?.id || !u.email) throw new Error("Auth user not found")

      // Role is controlled by DB profile only
      let profile
      try {
        profile = await fetchProfile(u.id)
      } catch {
        throw new Error("Profile not found for this user. Add a row in profiles table with the correct role.")
      }

      setUser({
        id: u.id,
        email: u.email,
        name: u.email.split("@")[0],
        role: profile.role,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
