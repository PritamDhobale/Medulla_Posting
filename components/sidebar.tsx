"use client"

import type React from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LogOut, Upload, ListTodo, BarChart3, GitCompare } from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  roles: ("agent" | "manager")[]
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const navItems: NavItem[] = [
    { label: "Upload File", href: "/upload", icon: <Upload className="w-4 h-4" />, roles: ["agent", "manager"] },
    { label: "Worklist", href: "/worklist", icon: <ListTodo className="w-4 h-4" />, roles: ["agent", "manager"] },

    // Manager-only pages
    { label: "Agents", href: "/agents", icon: <ListTodo className="w-4 h-4" />, roles: ["manager"] },
    { label: "Reports", href: "/reports", icon: <BarChart3 className="w-4 h-4" />, roles: ["manager"] },
    { label: "Reconciliation", href: "/reconciliation", icon: <GitCompare className="w-4 h-4" />, roles: ["manager"] },
  ]

  const visibleItems = navItems.filter((item) => item.roles.includes(user?.role || "agent"))

  // ✅ await logout before navigation (avoids race conditions)
  const handleLogout = async () => {
    await logout()
    router.replace("/")
    router.refresh()
  }

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm">
            M
          </div>
          <h1 className="text-lg font-bold text-sidebar-foreground">Medulla</h1>
        </div>
        <p className="text-xs text-sidebar-foreground/60">Bank Reconciliation</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {visibleItems.map((item) => (
          <button
            key={item.href}
            onClick={() => router.push(item.href)}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname === item.href
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <div className="px-4 py-2">
          <p className="text-xs font-medium text-sidebar-foreground">{user?.name}</p>
          <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.role}</p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </aside>
  )
}
