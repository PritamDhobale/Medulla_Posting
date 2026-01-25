import type React from "react"
import { LayoutWrapper } from "@/components/layout-wrapper"

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return <LayoutWrapper>{children}</LayoutWrapper>
}
