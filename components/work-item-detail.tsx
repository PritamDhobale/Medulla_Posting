"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import type { WorkItem, User } from "@/lib/data-context"

interface WorkItemDetailProps {
  item: WorkItem
  onClose: () => void
  onUpdate: (updates: Partial<WorkItem>) => Promise<void>
  currentUser: User
}

export function WorkItemDetail({ item, onClose, onUpdate, currentUser }: WorkItemDetailProps) {
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({
    status: item.status,
    notes: item.notes,
    insuranceCompany: item.insuranceCompany,
  })

  const handleSave = async () => {
    await onUpdate({ ...formData })
    setEditMode(false)
  }

  const statusOptions = [
    "Posted",
    "Pending",
    "Posted by Medulla",
    "Missing EOB",
    "Missing Portal Credentials",
    "Other Issues",
  ]

  const isInsuranceEditable = ["Lockbox", "ACH", "Pre-authorized ACH"].includes(item.transactionType)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Posted":
      case "Posted by Medulla":
        return "bg-accent/10 text-accent-foreground"
      case "Pending":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
      case "Missing EOB":
      case "Missing Portal Credentials":
        return "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
      case "Other Issues":
        return "bg-destructive/10 text-destructive-foreground"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-background border border-border rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-background border-b border-border p-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">Work Item Details</h2>
              <p className="text-xs text-muted-foreground mt-1">ID: {item.id}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Read-only Information */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Source File</label>
                <p className="text-sm font-medium text-foreground mt-1">{item.sourceFileName}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Source Sheet</label>
                <p className="text-sm font-medium text-foreground mt-1">{item.sourceSheetFullName}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Clinic Name</label>
                <p className="text-sm font-medium text-foreground mt-1">{item.clinicName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">State</label>
                  <p className="text-sm font-medium text-foreground mt-1">{item.state}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Deposit Date</label>
                  <p className="text-sm font-medium text-foreground mt-1">{item.depositDate}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Transaction Type</label>
                  <p className="text-sm font-medium text-foreground mt-1">{item.transactionType}</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Check Number</label>
                  <p className="text-sm font-mono font-medium text-foreground mt-1">{item.checkNumber}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">Check Amount</label>
                <p className="text-lg font-bold text-foreground mt-1">${item.checkAmount.toFixed(2)}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Original Bank Description
                </label>
                <p className="text-sm text-muted-foreground mt-1">{item.originalBankDescription}</p>
              </div>
            </div>

            {/* Editable Section */}
            <div className="pt-6 border-t border-border space-y-4">
              {isInsuranceEditable && (
                <div>
                  <label
                    htmlFor="insurance"
                    className="text-xs font-semibold text-muted-foreground uppercase block mb-2"
                  >
                    Insurance Name {!editMode && "(Edit to Correct)"}
                  </label>
                  {editMode ? (
                    <input
                      id="insurance"
                      type="text"
                      value={formData.insuranceCompany}
                      onChange={(e) => setFormData({ ...formData, insuranceCompany: e.target.value })}
                      className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    />
                  ) : (
                    <p className="text-sm text-foreground">{formData.insuranceCompany}</p>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="status" className="text-xs font-semibold text-muted-foreground uppercase block mb-2">
                  Status
                </label>
                {editMode ? (
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(formData.status)}`}
                  >
                    {formData.status}
                  </span>
                )}
              </div>

              <div>
                <label htmlFor="notes" className="text-xs font-semibold text-muted-foreground uppercase block mb-2">
                  Notes
                </label>
                {editMode ? (
                  <textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add notes about this work item..."
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm min-h-24 resize-none"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{formData.notes || "(No notes)"}</p>
                )}
              </div>
            </div>

            {!editMode && item.lastTouchedBy && (
              <div className="pt-6 border-t border-border space-y-2 bg-muted/50 p-4 rounded-md">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Last Updated</p>
                <div className="space-y-1 text-sm text-foreground">
                  <p>
                    <strong>Updated By:</strong> {item.lastTouchedBy}
                  </p>
                  <p>
                    <strong>Date/Time:</strong> {item.lastTouchedAt ? new Date(item.lastTouchedAt).toLocaleString() : ""}
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-6 border-t border-border">
              {editMode ? (
                <>
                  <Button onClick={handleSave} className="flex-1">
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFormData({ status: item.status, notes: item.notes, insuranceCompany: item.insuranceCompany })
                      setEditMode(false)
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button onClick={() => setEditMode(true)} className="w-full">
                  Edit Item
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
