"use client"

import { useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function Dashboard() {
  const { user } = useAuth()
  const router = useRouter()

  // ✅ Redirect after render (prevents "Cannot update Router while rendering Dashboard" warning)
  useEffect(() => {
    if (!user) router.replace("/")
  }, [user, router])

  // ✅ Avoid rendering dashboard content while redirecting
  if (!user) return null

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Welcome, {user.name}</h1>
        <p className="text-muted-foreground">
          {user.role === "manager"
            ? "Manage your bank reconciliation workflow and reports"
            : "Process bank reconciliations and manage work items"}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push("/upload")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">📤</span>
              Upload File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Upload new Excel bank reconciliation files</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push("/worklist")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              Worklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">View and manage all work items</p>
          </CardContent>
        </Card>

        {user.role === "manager" && (
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => router.push("/reports")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">📊</span>
                Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Production and clinic summary reports</p>
            </CardContent>
          </Card>
        )}
      </div>

      {user.role === "manager" && (
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation</CardTitle>
            <CardDescription>Compare Platinum reports with bank reconciliation</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/reconciliation")}>Open Reconciliation</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
