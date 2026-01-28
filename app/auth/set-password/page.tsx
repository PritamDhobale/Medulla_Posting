"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function SetPasswordPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string>("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const run = async () => {
      try {
        setError("")
        setLoading(true)

        // If user already has a session, allow setting password
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session) {
          setReady(true)
          return
        }

        // Invite tokens are in URL hash
        const hash = window.location.hash?.replace("#", "") || ""
        if (!hash) {
          // Also catch Supabase error params (optional)
          const qp = new URLSearchParams(window.location.search)
          const errDesc = qp.get("error_description")
          if (errDesc) setError(decodeURIComponent(errDesc))
          else setError("Invalid or missing invite token. Please ask the manager to resend the invite.")
          return
        }

        const params = new URLSearchParams(hash)
        const access_token = params.get("access_token")
        const refresh_token = params.get("refresh_token")

        if (!access_token || !refresh_token) {
          setError("Invite link is invalid or expired. Please ask the manager to resend the invite.")
          return
        }

        const { error: setSessionErr } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        })

        if (setSessionErr) {
          setError("Invite link is invalid or expired. Please ask the manager to resend the invite.")
          return
        }

        setReady(true)
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [])

  const handleSetPassword = async () => {
    setError("")

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      const { error: upErr } = await supabase.auth.updateUser({ password })
      if (upErr) {
        setError(upErr.message)
        return
      }

      await supabase.auth.refreshSession()

      // ✅ stop spinner BEFORE navigation (prevents “stuck saving” UI)
      setLoading(false)

      // ✅ soft navigation
      router.replace("/dashboard")
      router.refresh()

      // ✅ hard fallback (if soft navigation is blocked for any reason)
      setTimeout(() => {
        window.location.assign("/dashboard")
      }, 600)
    } catch (e: any) {
      setError(e?.message || "Failed to set password.")
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set Your Password</CardTitle>
          <CardDescription>Complete your account setup to access Medulla Posting App</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading && !ready ? (
            <p className="text-sm text-muted-foreground">Validating invite link…</p>
          ) : (
            <>
              {error ? (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                  {error}
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">New Password</label>
                <Input
                  type="password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!ready || loading}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Confirm Password</label>
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={!ready || loading}
                />
              </div>

              <Button className="w-full" onClick={handleSetPassword} disabled={!ready || loading}>
                {loading ? "Saving..." : "Set Password & Continue"}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                If your invite link expired, ask your manager to resend the invite.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
