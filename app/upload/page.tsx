"use client"

import { useState } from "react"
import * as XLSX from "xlsx"
import { useData } from "@/lib/data-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { UploadIcon, CheckCircle2 } from "lucide-react"

type UploadStep = "upload" | "sheets" | "preview" | "success"

type SheetMeta = { name: string; displayName: string }

function toIsoDateOnly(d: any): string | null {
  if (d === null || d === undefined) return null

  // Excel date serial number support
  if (typeof d === "number" && Number.isFinite(d)) {
    // Excel epoch (1899-12-30)
    const epoch = new Date(Date.UTC(1899, 11, 30))
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(d))
    return epoch.toISOString().slice(0, 10)
  }

  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)

  let s = String(d).trim()

  // remove wrapping quotes like "" or "\"\""
  s = s.replace(/^"+|"+$/g, "").trim()
  if (!s) return null

  // already yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)

  return null
}

function parseInsuranceAndCheck(desc: string) {
  const d = desc || ""
  const checkMatch =
    d.match(/(?:CHK|CHECK)\s*#?\s*([A-Za-z0-9-]+)/i) ||
    d.match(/\b([A-Za-z]{2,}-\d+)\b/i) ||
    d.match(/\b(\d{3,})\b/)

  const check_number = checkMatch?.[1] || ""

  const fromMatch = d.match(/\bfrom\b\s+(.+)$/i)
  const insurance_name = fromMatch?.[1]?.trim() || ""

  return { insurance_name, check_number }
}

function pick(row: any, keys: string[]) {
  const map: Record<string, string> = {}
  for (const k of Object.keys(row || {})) {
    map[String(k).trim().toLowerCase()] = k
  }

  for (const want of keys) {
    const actual = map[String(want).trim().toLowerCase()]
    if (!actual) continue
    const v = row[actual]
    if (v !== undefined && v !== null && String(v).trim() !== "") return v
  }

  return ""
}

export default function UploadPage() {
  const [step, setStep] = useState<UploadStep>("upload")
  const [fileName, setFileName] = useState("")
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null)
  const [availableSheets, setAvailableSheets] = useState<SheetMeta[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [previewCounts, setPreviewCounts] = useState<Record<string, number>>({})
  const { createUploadAndWorkItems } = useData()
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  const handleFileSelect = async (file: File) => {
    setFileName(file.name)
    const buf = await file.arrayBuffer()
    setFileBuffer(buf)

    const wb = XLSX.read(buf, { type: "array", cellDates: true })
    const sheets = wb.SheetNames.map((name) => ({
      name,
      displayName: name,
    }))
    setAvailableSheets(sheets)

    // auto-detect "deposit" sheets: (01.15 style) OR includes "Daily Deposit"
    const deposit = wb.SheetNames.filter(
      (s) => /^\d{2}\.\d{2}/.test(s) || /daily deposit/i.test(s) || /vcc/i.test(s)
    )
    setSelectedSheets(deposit.length ? deposit : wb.SheetNames.slice(0, Math.min(4, wb.SheetNames.length)))

    setStep("sheets")
  }

  const handleSheetToggle = (sheet: string) => {
    setSelectedSheets((prev) => (prev.includes(sheet) ? prev.filter((s) => s !== sheet) : [...prev, sheet]))
  }

  const handleConfirmSheets = () => {
    setStep("preview")
  }

  const handleCreateWorkItems = async () => {
    if (!fileBuffer) return
    if (creating) return // ✅ block double-click

    setCreating(true)

    try {
      const wb = XLSX.read(fileBuffer, { type: "array", cellDates: true })

      const allItems = selectedSheets.flatMap((sheetName) => {
        const ws = wb.Sheets[sheetName]
        if (!ws) return []

        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" })

        setPreviewCounts((p) => ({ ...p, [sheetName]: rows.length }))

        const mapped = rows
          .map((r) => {
            const clinic = pick(r, [
              "Account Name",
              "Clinic Name",
              "Clinic",
              "Account",
              "Account Number",
              "__EMPTY",
              "__EMPTY_1",
            ])

            const deposit = pick(r, ["As of Date", "As of date", "Deposit Date", "Date"])
            const txn = pick(r, ["Transaction", "Transaction Type", "Type"])
            const amt = Number(pick(r, ["Amount", "Check Amount", "Amt"])) || 0

            const desc = String(pick(r, ["Description", "Original Bank Details", "Details"]) || "")
            const payer = String(pick(r, ["Payer", "Payor", "Insurance", "Insurance Name", "Payer Name"]) || "").trim()
            const paymentDetails = String(pick(r, ["Payment Details", "TRN", "Details"]) || "").trim()

            const vccNum = String(
              pick(r, ["VCC #", "VCC#", "VCC Number", "Check Number", "Check #", "Check"]) || "",
            ).trim()

            const depositIso = toIsoDateOnly(deposit)
            const clinicName = String(clinic || "").trim()

            if (!clinicName) return null
            if (!depositIso) return null

            let insurance_name = payer || ""
            let check_number = vccNum || ""

            const trnMatch = (paymentDetails || desc).match(/TRN\*1\*([^*]+)\*/i)
            if (!check_number && trnMatch?.[1]) check_number = trnMatch[1].trim()

            if (!insurance_name || !check_number) {
              const parsed = parseInsuranceAndCheck(desc)
              if (!insurance_name) insurance_name = parsed.insurance_name
              if (!check_number) check_number = parsed.check_number
            }

            return {
              clinicName,
              depositDate: depositIso,
              transactionType: String(txn || ""),
              checkAmount: amt,
              originalBankDescription: desc,
              insuranceCompany: insurance_name,
              checkNumber: check_number,
              status: "Pending" as const,
              notes: "",
              sourceSheet: sheetName,
              sourceFileName: fileName,
              sourceSheetFullName: availableSheets.find((s) => s.name === sheetName)?.displayName || sheetName,
              state: String(pick(r, ["State"]) || ""),
              uploadId: undefined,
              lastTouchedBy: undefined,
              lastTouchedAt: undefined,
            }
          })
          .filter(Boolean)

        return mapped as any
      })

      if (!allItems.length) {
        throw new Error("No valid rows found in selected sheets. Check headers (Account/Clinic + As of Date) and try again.")
      }

      await createUploadAndWorkItems(fileName, allItems)
      setStep("success")
    } catch (e: any) {
      console.error("Create work items failed:", e)
      alert(e?.message || JSON.stringify(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Upload Bank Reconciliation</h1>
        <p className="text-muted-foreground">Import Excel files and create work items for your team</p>
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>Select File</CardTitle>
            <CardDescription>Choose an Excel file containing bank reconciliation data</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex items-center justify-center w-full p-8 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted transition-colors">
              <div className="text-center">
                <UploadIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground mb-1">Drag file here or click to select</p>
                <p className="text-sm text-muted-foreground">Excel files (.xlsx, .xls)</p>
              </div>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </label>
          </CardContent>
        </Card>
      )}

      {step === "sheets" && (
        <Card>
          <CardHeader>
            <CardTitle>Select Sheets</CardTitle>
            <CardDescription>Choose which sheets to process (deposit sheets pre-selected)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-foreground font-medium">
              File: <strong>{fileName}</strong>
            </p>

            <div className="space-y-3">
              {availableSheets.map((sheet) => (
                <label
                  key={sheet.name}
                  className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedSheets.includes(sheet.name)}
                    onChange={() => handleSheetToggle(sheet.name)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-foreground">{sheet.displayName}</span>
                </label>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={() => setStep("upload")} variant="outline">
                Back
              </Button>
              <Button onClick={handleConfirmSheets} disabled={selectedSheets.length === 0}>
                Next: Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Data</CardTitle>
            <CardDescription>Confirm and create work items in Supabase</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Selected sheets: <strong>{selectedSheets.join(", ")}</strong>
            </p>

            <div className="flex gap-3 pt-4">
              <Button onClick={() => setStep("sheets")} variant="outline">
                Back
              </Button>
              <Button onClick={handleCreateWorkItems} disabled={creating}>
                {creating ? "Creating..." : "Create Work Items"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "success" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-6 h-6" />
              Upload Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 p-4 bg-accent/10 rounded-lg">
              <p className="text-sm text-foreground">
                <strong>File:</strong> {fileName}
              </p>
              <p className="text-sm text-foreground">
                <strong>Sheets Processed:</strong> {selectedSheets.join(", ")}
              </p>
            </div>

            <div className="flex gap-3">
              <Button onClick={() => router.push("/worklist")} className="flex-1">
                View Worklist
              </Button>
              <Button
                onClick={() => {
                  setStep("upload")
                  setFileName("")
                  setFileBuffer(null)
                  setAvailableSheets([])
                  setSelectedSheets([])
                  setPreviewCounts({})
                }}
                variant="outline"
                className="flex-1"
              >
                Upload Another File
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
