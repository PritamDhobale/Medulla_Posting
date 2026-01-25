"use client"

import { useAuth } from "@/lib/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { LoginForm } from "@/components/login-form"

export default function Home() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (user && pathname === "/") {
      router.push("/dashboard")
    }
  }, [user, router, pathname])

  if (user) {
    return null
  }

  return <LoginForm />
}
