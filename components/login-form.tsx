"use client"

import type React from "react"
import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const { login, isLoading } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    try {
      await login(email, password)
      router.replace("/dashboard")
      router.refresh()
    } catch (err: any) {
      console.error(err)
      alert(err?.message || "Login failed")
    }
  }

  return (
    
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">

      <img
    src="/sage_healthy_rcm_logo.png"
    alt="Logo"
    className="h-12 w-auto object-contain"  // bigger + no background box
  />
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-4">
  
  <h1 className="text-xl font-bold text-foreground leading-none">
    Medulla Posting App
  </h1>
</div>

          <CardTitle>Bank Reconciliation</CardTitle>
          <CardDescription>Sign in to manage your posting workflow</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
  type="submit"
  disabled={isLoading || !email || !password}
  className="w-full bg-[#738e00] hover:bg-[#667f00] text-white"
>
  {isLoading ? "Signing in..." : "Sign In"}
</Button>

          </form>
        </CardContent>
      </Card>
    </div>
  )
}