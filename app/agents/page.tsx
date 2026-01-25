"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ProfileRow = {
  id: string
  email: string
  role: "agent" | "manager"
  created_at: string
}

export default function AgentsPage() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<ProfileRow[]>([])
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  const loadAgents = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,role,created_at")
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    setAgents((data || []).filter((x) => x.role === "agent"))
  }

  useEffect(() => {
    if (user?.role === "manager") loadAgents()
  }, [user?.role])

  const inviteAgent = async () => {
    if (!email.trim()) return
    setLoading(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) throw new Error("Not authenticated")

      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Invite failed")

      setEmail("")
      await loadAgents()
      alert("Invite sent to agent email.")
    } catch (e: any) {
      console.error(e)
      alert(e?.message || "Invite failed")
    } finally {
      setLoading(false)
    }
  }

  if (user?.role !== "manager") {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">You do not have permission to view this page.</CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agents</h1>
        <p className="text-muted-foreground">Invite agents and manage access</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite New Agent</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Input
            placeholder="agent@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button onClick={inviteAgent} disabled={loading || !email.trim()}>
            {loading ? "Sending..." : "Send Invite"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agent List</CardTitle>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-muted-foreground">No agents found.</p>
          ) : (
            <div className="space-y-2">
              {agents.map((a) => (
                <div key={a.id} className="flex items-center justify-between border border-border rounded-md p-3">
                  <div>
                    <div className="font-medium">{a.email}</div>
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(a.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded bg-muted">Agent</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
