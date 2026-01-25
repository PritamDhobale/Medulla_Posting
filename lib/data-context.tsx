"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/lib/auth-context"

export interface User {
  id: string
  name: string
  role: "agent" | "manager"
}

export interface WorkItem {
  id: string
  clinicName: string
  depositDate: string
  transactionType: string
  checkAmount: number
  originalBankDescription: string
  insuranceCompany: string
  checkNumber: string
  status: "Posted" | "Pending" | "Posted by Medulla" | "Missing EOB" | "Missing Portal Credentials" | "Other Issues"
  notes: string
  sourceSheet: string
  sourceFileName: string
  sourceSheetFullName: string
  state: string
  lastTouchedBy?: string
  lastTouchedAt?: string // ISO string
  uploadId?: string
}

export interface UploadSession {
  id: string
  fileName: string
  uploadDate: string
  itemsCreated: number
  sheets: string[]
}

interface DataContextType {
  workItems: WorkItem[]
  uploadSessions: UploadSession[]
  refreshWorkItems: () => Promise<void>
  createUploadAndWorkItems: (fileName: string, items: Omit<WorkItem, "id">[]) => Promise<void>
  updateWorkItem: (id: string, item: Partial<WorkItem>) => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

function toIsoDateOnly(d: any): string | null {
  if (d === null || d === undefined) return null

  // handle Excel serial numbers if any
  if (typeof d === "number" && Number.isFinite(d)) {
    const epoch = new Date(Date.UTC(1899, 11, 30))
    epoch.setUTCDate(epoch.getUTCDate() + Math.floor(d))
    return epoch.toISOString().slice(0, 10)
  }

  if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)

  let s = String(d).trim()
  s = s.replace(/^"+|"+$/g, "").trim() // remove quotes: "" or "\"\""
  if (!s) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)

  return null
}

function mapDbToWorkItem(row: any): WorkItem {
  const updaterEmail: string | undefined = row.updater?.email
  const lastTouchedBy = updaterEmail ? updaterEmail.split("@")[0] : undefined
  const lastTouchedAt = row.last_updated_at ? String(row.last_updated_at) : undefined

  return {
    id: row.id,
    clinicName: row.clinic_name ?? "",
    depositDate: row.deposit_date ? String(row.deposit_date) : "",
    transactionType: row.transaction_type ?? "",
    checkAmount: Number(row.check_amount ?? 0),
    originalBankDescription: row.original_bank_description ?? "",
    insuranceCompany: row.insurance_name ?? "",
    checkNumber: row.check_number ?? "",
    status: row.status,
    notes: row.notes ?? "",
    sourceSheet: row.source_sheet ?? "",
    sourceSheetFullName: row.source_sheet_full_name ?? "",
    sourceFileName: row.uploads?.file_name ?? "",
    state: row.state ?? "",
    lastTouchedBy,
    lastTouchedAt,
    uploadId: row.upload_id,
  }
}

async function insertInChunks(table: string, rows: any[], chunkSize = 500) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from(table).insert(chunk)
    if (error) throw error
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [uploadSessions, setUploadSessions] = useState<UploadSession[]>([])

  const refreshWorkItems = async () => {
    if (!user) {
      setWorkItems([])
      return
    }

    const { data, error } = await supabase
      .from("work_items")
      .select(
        `
        id,
        upload_id,
        clinic_name,
        deposit_date,
        transaction_type,
        check_amount,
        original_bank_description,
        insurance_name,
        check_number,
        status,
        notes,
        source_sheet,
        source_sheet_full_name,
        state,
        last_updated_at,
        uploads:uploads!work_items_upload_id_fkey(file_name),
        updater:profiles!work_items_last_updated_by_fkey(email)
      `,
      )
      .order("deposit_date", { ascending: false })

    if (error) {
      console.error("refreshWorkItems error:", error)
      return
    }

    setWorkItems((data || []).map(mapDbToWorkItem))
  }

  useEffect(() => {
    refreshWorkItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const createUploadAndWorkItems = async (fileName: string, items: Omit<WorkItem, "id">[]) => {
    if (!user) throw new Error("Not logged in")

    // 1) create upload row
    const { data: upload, error: uploadErr } = await supabase
      .from("uploads")
      .insert({
        file_name: fileName,
        uploaded_by: user.id,
      })
      .select("id,file_name,uploaded_at")
      .single()

    if (uploadErr) throw uploadErr

    const nowIso = new Date().toISOString()
    const safeItems = items
    .map((i) => {
      const depositIso = toIsoDateOnly(i.depositDate)
      return { ...i, depositDate: depositIso ?? "" }
    })
    .filter((i) => i.clinicName?.trim() && i.depositDate?.trim())

    if (safeItems.length === 0) {
      throw new Error(
        "No valid rows found in selected sheets. Check Excel headers (Account Name / As of Date) and try again."
      )
    }

    // 2) insert work_items
    const dbRows = safeItems.map((i) => ({
      upload_id: upload.id,
      clinic_name: i.clinicName,
      state: i.state || null,
      deposit_date: i.depositDate, // already YYYY-MM-DD
      transaction_type: i.transactionType || null,
      check_amount: i.checkAmount ?? 0,
      original_bank_description: i.originalBankDescription || null,
      insurance_name: i.insuranceCompany || null,
      check_number: i.checkNumber || null,
      source_sheet: i.sourceSheet || null,
      source_sheet_full_name: i.sourceSheetFullName || null,
      status: i.status || "Pending",
      notes: i.notes || null,

      // IMPORTANT: to make agent see their own uploaded items immediately
      last_updated_by: user.id,
      last_updated_at: nowIso,
    }))

    await insertInChunks("work_items", dbRows, 500)

    // 3) update local uploadSessions (optional display use later)
    setUploadSessions((prev) => [
      ...prev,
      {
        id: upload.id,
        fileName: upload.file_name,
        uploadDate: new Date(upload.uploaded_at).toLocaleDateString(),
        itemsCreated: safeItems.length,
        sheets: Array.from(new Set(safeItems.map((x) => x.sourceSheet).filter(Boolean))),
      },
    ])

    // 4) refresh list
    await refreshWorkItems()
  }

  const updateWorkItem = async (id: string, item: Partial<WorkItem>) => {
    if (!user) throw new Error("Not logged in")

    const nowIso = new Date().toISOString()

    const patch: any = {
      last_updated_by: user.id,
      last_updated_at: nowIso,
    }

    if (item.insuranceCompany !== undefined) patch.insurance_name = item.insuranceCompany
    if (item.status !== undefined) patch.status = item.status
    if (item.notes !== undefined) patch.notes = item.notes

    const { error } = await supabase.from("work_items").update(patch).eq("id", id)
    if (error) throw error

    // Update local state immediately
    setWorkItems((prev) =>
      prev.map((wi) =>
        wi.id === id
          ? {
              ...wi,
              ...item,
              lastTouchedBy: user.name,
              lastTouchedAt: nowIso,
            }
          : wi,
      ),
    )
  }

  return (
    <DataContext.Provider value={{ workItems, uploadSessions, refreshWorkItems, createUploadAndWorkItems, updateWorkItem }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error("useData must be used within DataProvider")
  return context
}
