"use client"

import type React from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { LayoutWrapper } from "@/components/layout-wrapper"

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isReady } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // ✅ Only redirect AFTER auth has finished hydrating
    if (isReady && !user) {
      router.replace("/")
      router.refresh()
    }
  }, [isReady, user, router])

  // ✅ During hydration, don't redirect and don't blank-screen the app
  if (!isReady) return null

  if (!user) return null

  return <LayoutWrapper>{children}</LayoutWrapper>
}
