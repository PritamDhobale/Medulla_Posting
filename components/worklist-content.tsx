"use client"

import { useState, useMemo } from "react"
import { useData } from "@/lib/data-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronRight, Filter, Search } from "lucide-react"
import { WorkItemDetail } from "@/components/work-item-detail"
import type { WorkItem } from "@/lib/data-context"

interface Filters {
  clinic: string
  status: string
  dateFrom: string
  dateTo: string
  searchTerm: string
}

export function WorklistContent() {
  const { user } = useAuth()
  const { workItems, updateWorkItem } = useData()
  if (!user) return null
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null)
  const [filters, setFilters] = useState<Filters>({
    clinic: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    searchTerm: "",
  })
  const [sortBy, setSortBy] = useState("depositDate")
  const [page, setPage] = useState(1)
  const itemsPerPage = 10

  // Get unique clinics and statuses for filters
  const clinics = Array.from(new Set(workItems.map((item) => item.clinicName)))
  const statuses = Array.from(new Set(workItems.map((item) => item.status)))

  // Filter and sort
  const filteredItems = useMemo(() => {
    return workItems
      .filter((item) => {
        if (filters.clinic && item.clinicName !== filters.clinic) return false
        if (filters.status && item.status !== filters.status) return false
        if (filters.dateFrom && item.depositDate < filters.dateFrom) return false
        if (filters.dateTo && item.depositDate > filters.dateTo) return false
        if (filters.searchTerm) {
          const search = filters.searchTerm.toLowerCase()
          return (
            item.insuranceCompany.toLowerCase().includes(search) ||
            item.checkNumber.toLowerCase().includes(search) ||
            item.clinicName.toLowerCase().includes(search)
          )
        }
        return true
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "depositDate":
            return new Date(b.depositDate).getTime() - new Date(a.depositDate).getTime()
          case "amount":
            return b.checkAmount - a.checkAmount
          case "clinic":
            return a.clinicName.localeCompare(b.clinicName)
          default:
            return 0
        }
      })
  }, [workItems, filters, sortBy])

  const paginatedItems = filteredItems.slice((page - 1) * itemsPerPage, page * itemsPerPage)
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)

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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Work Items</h1>
        <p className="text-muted-foreground">Manage and track {filteredItems.length} work items</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search insurance, check #..."
                value={filters.searchTerm}
                onChange={(e) => {
                  setFilters({ ...filters, searchTerm: e.target.value })
                  setPage(1)
                }}
                className="pl-10 h-10"
              />
            </div>

            {/* Clinic Filter */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Clinic</label>
              <select
                value={filters.clinic}
                onChange={(e) => {
                  setFilters({ ...filters, clinic: e.target.value })
                  setPage(1)
                }}
                className="w-full h-10 px-3 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              >
                <option value="">All Clinics</option>
                {clinics.map((clinic) => (
                  <option key={clinic} value={clinic}>
                    {clinic}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Status</label>
              <select
                value={filters.status}
                onChange={(e) => {
                  setFilters({ ...filters, status: e.target.value })
                  setPage(1)
                }}
                className="w-full h-10 px-3 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              >
                <option value="">All Statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* Deposit Date From */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Deposit From</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => {
                  setFilters({ ...filters, dateFrom: e.target.value })
                  setPage(1)
                }}
                className="text-sm h-10"
              />
            </div>

            {/* Deposit Date To */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase mb-2 block">Deposit To</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => {
                  setFilters({ ...filters, dateTo: e.target.value })
                  setPage(1)
                }}
                className="text-sm h-10"
              />
            </div>
          </div>

          {(filters.clinic || filters.status || filters.dateFrom || filters.dateTo || filters.searchTerm) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({ clinic: "", status: "", dateFrom: "", dateTo: "", searchTerm: "" })
                setPage(1)
              }}
              className="mt-4"
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Worklist Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Work Items</CardTitle>
            <CardDescription>
              Showing {paginatedItems.length} of {filteredItems.length} items
            </CardDescription>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          >
            <option value="depositDate">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
            <option value="clinic">Sort by Clinic</option>
          </select>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-2">No work items found</p>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-foreground text-sm">Clinic</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground text-sm">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground text-sm">Check #</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground text-sm">Amount</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground text-sm">Insurance</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground text-sm">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-foreground text-sm">Last Updated</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-border hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => setSelectedItem(item)}
                      >
                        <td className="py-3 px-4 text-sm text-foreground">{item.clinicName}</td>
                        <td className="py-3 px-4 text-sm text-foreground">{item.depositDate}</td>
                        <td className="py-3 px-4 text-sm font-mono text-foreground">{item.checkNumber}</td>
                        <td className="py-3 px-4 text-sm text-foreground font-medium">
                          ${item.checkAmount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{item.insuranceCompany}</td>
                        <td className="py-3 px-4 text-sm">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {item.lastTouchedBy && (
                            <div>
                              <p>{item.lastTouchedBy}</p>
                              <p>{item.lastTouchedAt ? new Date(item.lastTouchedAt).toLocaleString() : ""}</p>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedItem && (
        <WorkItemDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdate={async (updates) => {
            const nowIso = new Date().toISOString()

            // 1) Update DB + main list state
            await updateWorkItem(selectedItem.id, updates)

            // 2) Update modal state so "Last Updated" refreshes immediately
            setSelectedItem((prev) =>
              prev
                ? {
                    ...prev,
                    ...updates,
                    lastTouchedBy: user.name,     // manager/agent name
                    lastTouchedAt: nowIso,        // correct updated time
                  }
                : prev,
            )
          }}
          currentUser={user}
        />
      )}
    </div>
  )
}
