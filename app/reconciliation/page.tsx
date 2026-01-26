"use client"

import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { useData } from "@/lib/data-context"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertCircle, Upload, Download, CheckCircle2 } from "lucide-react"

type PlatinumRow = {
  id: string
  clinic: string
  depositDate: string
  checkAmount: number
  checkNumber: string
  insuranceName?: string
}

function toIsoDateOnly(d: any): string | null {
  if (d === null || d === undefined) return null
  if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString().slice(0, 10)

  const s = String(d).trim()
  if (!s) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)

  return null
}

function pick(row: any, keys: string[]) {
  const normalized: Record<string, any> = {}
  for (const [k, v] of Object.entries(row || {})) {
    normalized[String(k).trim().toLowerCase()] = v
  }

  for (const k of keys) {
    const v = normalized[String(k).trim().toLowerCase()]
    if (v !== undefined && v !== null && String(v).trim() !== "") return v
  }
  return ""
}


function normText(v: any) {
  return String(v ?? "").trim().toUpperCase()
}

function normMoney(v: any) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : 0 // cents
}

async function insertInChunks(table: string, rows: any[], chunkSize = 500) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from(table).insert(chunk)
    if (error) throw error
  }
}

export default function ReconciliationPage() {
  const { workItems } = useData()
  const { user } = useAuth()

  const [platinumUploadId, setPlatinumUploadId] = useState<string | null>(null)
  const [platinumFileName, setPlatinumFileName] = useState<string>("")
  const [platinumRows, setPlatinumRows] = useState<PlatinumRow[]>([])
  const [reconciliationDone, setReconciliationDone] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Load latest platinum upload on page load (optional quality-of-life)
  useEffect(() => {
    if (user?.role !== "manager") return

    const loadLatest = async () => {
      const { data: latest, error } = await supabase
        .from("platinum_uploads")
        .select("id,file_name,uploaded_at")
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) return
      if (!latest?.id) return

      setPlatinumUploadId(latest.id)
      setPlatinumFileName(latest.file_name)

      const { data: items, error: itemsErr } = await supabase
        .from("platinum_items")
        .select("id, clinic_name, deposit_date, check_amount, check_number, insurance_name")
        .eq("platinum_upload_id", latest.id)

      if (itemsErr) return

      setPlatinumRows(
        (items || []).map((r) => ({
          id: r.id,
          clinic: r.clinic_name,
          depositDate: String(r.deposit_date),
          checkAmount: Number(r.check_amount ?? 0),
          checkNumber: r.check_number ?? "",
          insuranceName: r.insurance_name ?? "",
        })),
      )
    }

    loadLatest()
  }, [user?.role])

  // Missing in Bank (present in Platinum, absent in bank work_items)
  const missingInBank = useMemo(() => {
    // Build a lookup set from bank items
    const bankSet = new Set(
      workItems.map((b) => {
        return [
          normText(b.clinicName),
          normText(b.depositDate),
          normMoney(b.checkAmount),
          normText(b.checkNumber),
        ].join("|")
      }),
    )

    return platinumRows.filter((p) => {
      const key = [normText(p.clinic), normText(p.depositDate), normMoney(p.checkAmount), normText(p.checkNumber)].join("|")
      return !bankSet.has(key)
    })
  }, [platinumRows, workItems])

  // Missing in Platinum (present in bank, absent in Platinum)
  const missingInPlatinum = useMemo(() => {
    const platSet = new Set(
      platinumRows.map((p) =>
        [normText(p.clinic), normText(p.depositDate), normMoney(p.checkAmount), normText(p.checkNumber)].join("|"),
      ),
    )

    return workItems.filter((b) => {
      const key = [normText(b.clinicName), normText(b.depositDate), normMoney(b.checkAmount), normText(b.checkNumber)].join("|")
      return !platSet.has(key)
    })
  }, [platinumRows, workItems])

  const handleUploadPlatinum = async (file: File) => {
    if (!user) return
    setIsUploading(true)
    setReconciliationDone(false)

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array", cellDates: true })

      // Use first sheet by default
      const firstSheet = wb.SheetNames[0]
      const ws = wb.Sheets[firstSheet]
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" })

      // Insert platinum_uploads row
      const { data: upload, error: upErr } = await supabase
        .from("platinum_uploads")
        .insert({ file_name: file.name, uploaded_by: user.id })
        .select("id,file_name,uploaded_at")
        .single()

      if (upErr) throw upErr

      // Convert to DB rows
      const dbRows = rows
      .map((r) => {
        const clinic = pick(r, ["Clinic", "Clinic Name", "Account Number", "Account"])
        const rawDate = pick(r, ["Deposit Date", "As of Date", "Date"])
        const depositDate = toIsoDateOnly(rawDate)

        // ✅ skip rows that would break DB insert
        if (!depositDate) return null

        const amt = Number(pick(r, ["Amount", "Check Amount", "Amt"])) || 0
        const chk = pick(r, ["Check Number", "Check #", "Check", "CHK#", "Check No"])
        const ins = pick(r, ["Insurance", "Insurance Name", "Payer", "Payer Name"])

        return {
          platinum_upload_id: upload.id,
          clinic_name: String(clinic || ""),
          deposit_date: depositDate, // ✅ valid yyyy-mm-dd only
          check_amount: amt,
          check_number: String(chk || ""),
          insurance_name: String(ins || ""),
        }
      })
      .filter(Boolean)

      await insertInChunks("platinum_items", dbRows, 500)

      // Load into UI
      setPlatinumUploadId(upload.id)
      setPlatinumFileName(upload.file_name)

      const { data: saved, error: savedErr } = await supabase
        .from("platinum_items")
        .select("id, clinic_name, deposit_date, check_amount, check_number, insurance_name")
        .eq("platinum_upload_id", upload.id)

      if (savedErr) throw savedErr

      setPlatinumRows(
        (saved || []).map((r) => ({
          id: r.id,
          clinic: r.clinic_name,
          depositDate: String(r.deposit_date),
          checkAmount: Number(r.check_amount ?? 0),
          checkNumber: r.check_number ?? "",
          insuranceName: r.insurance_name ?? "",
        })),
      )
    } catch (e) {
      console.error(e)
      alert("Platinum upload failed. Check console for details.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleRunReconciliation = async () => {
    if (!user) return
    setReconciliationDone(true)

    // Optional: store results for audit/export later
    try {
      // clear previous results by this manager
      await supabase.from("reconciliation_results").delete().eq("created_by", user.id)

      const bankMissingRows = missingInBank.map((r) => ({
        type: "missing_in_bank",
        clinic_name: r.clinic,
        deposit_date: r.depositDate,
        check_amount: r.checkAmount,
        check_number: r.checkNumber,
        insurance_name: r.insuranceName || null,
        created_by: user.id,
      }))

      const platMissingRows = missingInPlatinum.map((r) => ({
        type: "missing_in_platinum",
        clinic_name: r.clinicName,
        deposit_date: r.depositDate,
        check_amount: r.checkAmount,
        check_number: r.checkNumber,
        insurance_name: r.insuranceCompany || null,
        created_by: user.id,
      }))

      if (bankMissingRows.length) await insertInChunks("reconciliation_results", bankMissingRows, 500)
      if (platMissingRows.length) await insertInChunks("reconciliation_results", platMissingRows, 500)
    } catch (e) {
      console.warn("Reconciliation results save skipped (not blocking):", e)
    }
  }

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
  }

  const exportMissingInBank = () => {
    const headers = ["Clinic", "Deposit Date", "Check Amount", "Check Number"]
    const rows = missingInBank.map((d) => [d.clinic, d.depositDate, d.checkAmount.toFixed(2), d.checkNumber])
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    downloadCSV(csv, "missing-in-bank.csv")
  }

  const exportMissingInPlatinum = () => {
    const headers = ["Clinic", "Deposit Date", "Check Amount", "Check Number"]
    const rows = missingInPlatinum.map((d) => [d.clinicName, d.depositDate, d.checkAmount.toFixed(2), d.checkNumber])
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    downloadCSV(csv, "missing-in-platinum.csv")
  }

  if (user?.role !== "manager") {
    return (
      <div className="p-8">
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-sm text-foreground">You do not have permission to access this page.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Reconciliation</h1>
        <p className="text-muted-foreground">Compare Platinum reports with bank reconciliation data</p>
      </div>

      <Tabs defaultValue="compare" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="compare">Compare Data</TabsTrigger>
          <TabsTrigger value="upload">Upload Platinum</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload Platinum Report</CardTitle>
              <CardDescription>Upload a PHI-removed Platinum report for reconciliation</CardDescription>
            </CardHeader>
            <CardContent>
              <label className="flex items-center justify-center w-full p-12 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted transition-colors">
                <div className="text-center">
                  <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-foreground mb-1">{isUploading ? "Uploading..." : "Drag file here or click to select"}</p>
                  <p className="text-sm text-muted-foreground">Excel or CSV files</p>
                </div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => e.target.files?.[0] && handleUploadPlatinum(e.target.files[0])}
                />
              </label>

              {platinumRows.length > 0 && (
                <div className="mt-6 space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    ✓ Platinum loaded: {platinumRows.length} records {platinumFileName ? `(${platinumFileName})` : ""}
                  </p>
                  {platinumUploadId && <p className="text-xs text-muted-foreground">Upload ID: {platinumUploadId}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compare" className="space-y-6">
          {platinumRows.length === 0 ? (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">Upload a Platinum report first to begin reconciliation</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Reconciliation Status</span>
                    {reconciliationDone && (
                      <span className="flex items-center gap-2 text-sm font-normal text-accent">
                        <CheckCircle2 className="w-4 h-4" />
                        Reconciliation Complete
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Platinum Records</p>
                      <p className="text-2xl font-bold text-foreground">{platinumRows.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Bank Records</p>
                      <p className="text-2xl font-bold text-foreground">{workItems.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Missing in Bank</p>
                      <p className="text-2xl font-bold text-destructive">{missingInBank.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Missing in Platinum</p>
                      <p className="text-2xl font-bold text-orange-600">{missingInPlatinum.length}</p>
                    </div>
                  </div>

                  {!reconciliationDone && (
                    <Button
                      onClick={handleRunReconciliation}
                      className="w-full bg-[#738e00] hover:bg-[#667f00] text-white disabled:opacity-60 disabled:hover:bg-[#738e00]"
                    >
                      Run Reconciliation
                    </Button>
                  )}
                </CardContent>
              </Card>

              {reconciliationDone && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-destructive" />
                        Missing in Bank Reconciliation ({missingInBank.length})
                      </CardTitle>
                      <CardDescription>Records found in Platinum but not matched in bank reconciliation</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {missingInBank.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">All Platinum records are matched in bank reconciliation</p>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="text-left py-3 px-4 font-medium text-foreground">Clinic</th>
                                  <th className="text-left py-3 px-4 font-medium text-foreground">Date</th>
                                  <th className="text-left py-3 px-4 font-medium text-foreground">Check #</th>
                                  <th className="text-right py-3 px-4 font-medium text-foreground">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {missingInBank.map((record) => (
                                  <tr key={record.id} className="border-b border-border hover:bg-muted">
                                    <td className="py-3 px-4 text-foreground">{record.clinic}</td>
                                    <td className="py-3 px-4 text-foreground">{record.depositDate}</td>
                                    <td className="py-3 px-4 text-foreground font-mono">{record.checkNumber}</td>
                                    <td className="py-3 px-4 text-right text-foreground font-semibold">${record.checkAmount.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <Button onClick={exportMissingInBank} className="w-full bg-transparent" variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Export Missing in Bank
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-orange-600" />
                        Missing in Platinum ({missingInPlatinum.length})
                      </CardTitle>
                      <CardDescription>Records found in bank reconciliation but not in Platinum</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {missingInPlatinum.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">All bank records are matched in Platinum</p>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="text-left py-3 px-4 font-medium text-foreground">Clinic</th>
                                  <th className="text-left py-3 px-4 font-medium text-foreground">Date</th>
                                  <th className="text-left py-3 px-4 font-medium text-foreground">Check #</th>
                                  <th className="text-right py-3 px-4 font-medium text-foreground">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {missingInPlatinum.map((item) => (
                                  <tr key={item.id} className="border-b border-border hover:bg-muted">
                                    <td className="py-3 px-4 text-foreground">{item.clinicName}</td>
                                    <td className="py-3 px-4 text-foreground">{item.depositDate}</td>
                                    <td className="py-3 px-4 text-foreground font-mono">{item.checkNumber}</td>
                                    <td className="py-3 px-4 text-right text-foreground font-semibold">${item.checkAmount.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <Button onClick={exportMissingInPlatinum} className="w-full bg-transparent" variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Export Missing in Platinum
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
