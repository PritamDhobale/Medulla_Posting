import type React from "react"
import { LayoutWrapper } from "@/components/layout-wrapper"

export default function UploadLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <LayoutWrapper>{children}</LayoutWrapper>
}
