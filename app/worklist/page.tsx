import { Suspense } from "react"
import { WorklistContent } from "@/components/worklist-content"

export default function WorklistPage() {
  return (
    <Suspense fallback={null}>
      <WorklistContent />
    </Suspense>
  )
}
