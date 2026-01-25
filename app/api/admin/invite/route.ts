import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : ""

    if (!token) return NextResponse.json({ error: "Missing auth token" }, { status: 401 })

    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // 1) Validate caller (must be manager)
    const anonClient = createClient(url, anon)
    const { data: userRes, error: userErr } = await anonClient.auth.getUser(token)
    if (userErr || !userRes?.user?.id) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const serviceClient = createClient(url, service)

    const { data: prof, error: profErr } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", userRes.user.id)
      .single()

    if (profErr || prof?.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 2) Invite user (Supabase sends email with set-password link)
    const { data, error } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://medulla-posting.vercel.app"}/auth/set-password`,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, invitedUserId: data.user?.id })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}
