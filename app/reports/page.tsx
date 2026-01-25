"use client"

import { useState, useMemo } from "react"
import { useData } from "@/lib/data-context"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download } from "lucide-react"

function inDateRange(isoTs: string | undefined, from?: string, to?: string) {
  if (!isoTs) return false
  const d = new Date(isoTs)
  if (Number.isNaN(d.getTime())) return false

  if (from) {
    const f = new Date(from + "T00:00:00")
    if (d < f) return false
  }
  if (to) {
    const t = new Date(to + "T23:59:59")
    if (d > t) return false
  }
  return true
}

export default function ReportsPage() {
  const { workItems } = useData()
  const { user } = useAuth()
  const [reportTab, setReportTab] = useState("production")

  // Production Report
  const [prodDateFrom, setProdDateFrom] = useState("")
  const [prodDateTo, setProdDateTo] = useState("")

  const productionData = useMemo(() => {
    let filtered = workItems

    if (prodDateFrom || prodDateTo) {
      filtered = filtered.filter((item) => inDateRange(item.lastTouchedAt, prodDateFrom, prodDateTo))
    }

    const agentStats: Record<string, { name: string; count: number; amountPosted: number }> = {}

    filtered.forEach((item) => {
      const agent = item.lastTouchedBy || "Unassigned"
      if (!agentStats[agent]) agentStats[agent] = { name: agent, count: 0, amountPosted: 0 }

      agentStats[agent].count++

      // Total Amount Posted = only Posted / Posted by Medulla
      if (item.status === "Posted" || item.status === "Posted by Medulla") {
        agentStats[agent].amountPosted += item.checkAmount
      }
    })

    return Object.values(agentStats).sort((a, b) => b.count - a.count)
  }, [workItems, prodDateFrom, prodDateTo])

  // Clinic Summary
  const [clinicDateFrom, setClinicDateFrom] = useState("")
  const [clinicDateTo, setClinicDateTo] = useState("")
  const [selectedState, setSelectedState] = useState("")
  const [selectedClinics, setSelectedClinics] = useState<string[]>([])

  const allStates = Array.from(new Set(workItems.map((item) => item.state).filter(Boolean))).sort()
  const allClinics = Array.from(
    new Set(workItems.filter((item) => !selectedState || item.state === selectedState).map((item) => item.clinicName)),
  ).sort()

  const clinicSummaryData = useMemo(() => {
    let filtered = workItems

    if (clinicDateFrom) filtered = filtered.filter((item) => item.depositDate >= clinicDateFrom)
    if (clinicDateTo) filtered = filtered.filter((item) => item.depositDate <= clinicDateTo)
    if (selectedState) filtered = filtered.filter((item) => item.state === selectedState)
    if (selectedClinics.length > 0) filtered = filtered.filter((item) => selectedClinics.includes(item.clinicName))

    const clinicStats: Record<
      string,
      { clinic: string; totalAmount: number; postedAmount: number; remainingAmount: number; itemCount: number }
    > = {}

    filtered.forEach((item) => {
      if (!clinicStats[item.clinicName]) {
        clinicStats[item.clinicName] = {
          clinic: item.clinicName,
          totalAmount: 0,
          postedAmount: 0,
          remainingAmount: 0,
          itemCount: 0,
        }
      }

      clinicStats[item.clinicName].totalAmount += item.checkAmount
      clinicStats[item.clinicName].itemCount++

      if (item.status === "Posted" || item.status === "Posted by Medulla") {
        clinicStats[item.clinicName].postedAmount += item.checkAmount
      } else {
        clinicStats[item.clinicName].remainingAmount += item.checkAmount
      }
    })

    return Object.values(clinicStats).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [workItems, clinicDateFrom, clinicDateTo, selectedState, selectedClinics])

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
  }

  const exportProductionCSV = () => {
    const headers = ["Agent", "Items Touched", "Total Amount Posted"]
    const rows = productionData.map((d) => [d.name, d.count, d.amountPosted.toFixed(2)])
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    downloadCSV(csv, "production-report.csv")
  }

  const exportClinicCSV = () => {
    const headers = ["Clinic", "Total Amount", "Posted Amount", "Remaining Amount", "Item Count"]
    const rows = clinicSummaryData.map((d) => [
      d.clinic,
      d.totalAmount.toFixed(2),
      d.postedAmount.toFixed(2),
      d.remainingAmount.toFixed(2),
      d.itemCount,
    ])
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n")
    downloadCSV(csv, "clinic-summary-report.csv")
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
        <h1 className="text-3xl font-bold text-foreground mb-2">Reports</h1>
        <p className="text-muted-foreground">Track production metrics and clinic performance</p>
      </div>

      <Tabs value={reportTab} onValueChange={setReportTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="production">Production Report</TabsTrigger>
          <TabsTrigger value="clinic">Clinic Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="production" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Production Report</CardTitle>
              <CardDescription>Track items touched by each user</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Date From</label>
                  <Input type="date" value={prodDateFrom} onChange={(e) => setProdDateFrom(e.target.value)} className="mt-2" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Date To</label>
                  <Input type="date" value={prodDateTo} onChange={(e) => setProdDateTo(e.target.value)} className="mt-2" />
                </div>
                <Button variant="outline" onClick={() => { setProdDateFrom(""); setProdDateTo(""); }}>
                  Clear
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-foreground">Agent</th>
                      <th className="text-right py-3 px-4 font-medium text-foreground">Items Touched</th>
                      <th className="text-right py-3 px-4 font-medium text-foreground">Total Amount Posted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionData.map((data) => (
                      <tr key={data.name} className="border-b border-border hover:bg-muted">
                        <td className="py-3 px-4 text-foreground">{data.name}</td>
                        <td className="py-3 px-4 text-right text-foreground font-medium">{data.count}</td>
                        <td className="py-3 px-4 text-right text-foreground font-semibold">${data.amountPosted.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button onClick={exportProductionCSV} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Export as CSV
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clinic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Clinic Summary</CardTitle>
              <CardDescription>Total check amounts by clinic with posted and remaining amounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase block mb-2">State</label>
                  <select
                    value={selectedState}
                    onChange={(e) => { setSelectedState(e.target.value); setSelectedClinics([]); }}
                    className="w-full px-3 py-2 bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  >
                    <option value="">All States</option>
                    {allStates.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">Date From</label>
                    <Input type="date" value={clinicDateFrom} onChange={(e) => setClinicDateFrom(e.target.value)} className="mt-2" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">Date To</label>
                    <Input type="date" value={clinicDateTo} onChange={(e) => setClinicDateTo(e.target.value)} className="mt-2" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase block mb-2">
                    Clinics (Select from {selectedState || "all states"})
                  </label>
                  <div className="border border-border rounded-md p-3 bg-input max-h-48 overflow-y-auto">
                    {allClinics.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No clinics available for selected state</p>
                    ) : (
                      <div className="space-y-2">
                        {allClinics.map((clinic) => (
                          <label key={clinic} className="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded">
                            <input
                              type="checkbox"
                              checked={selectedClinics.includes(clinic)}
                              onChange={(e) => e.target.checked
                                ? setSelectedClinics([...selectedClinics, clinic])
                                : setSelectedClinics(selectedClinics.filter((c) => c !== clinic))
                              }
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-sm text-foreground">{clinic}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Button variant="outline" onClick={() => { setClinicDateFrom(""); setClinicDateTo(""); setSelectedState(""); setSelectedClinics([]); }}>
                  Clear Filters
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-foreground">Clinic</th>
                      <th className="text-right py-3 px-4 font-medium text-foreground">Total Amount</th>
                      <th className="text-right py-3 px-4 font-medium text-foreground">Posted Amount</th>
                      <th className="text-right py-3 px-4 font-medium text-foreground">Remaining Amount</th>
                      <th className="text-right py-3 px-4 font-medium text-foreground">Item Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinicSummaryData.map((data) => (
                      <tr key={data.clinic} className="border-b border-border hover:bg-muted">
                        <td className="py-3 px-4 text-foreground">{data.clinic}</td>
                        <td className="py-3 px-4 text-right text-foreground font-semibold">${data.totalAmount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-foreground font-semibold text-green-600">${data.postedAmount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-foreground font-semibold text-orange-600">${data.remainingAmount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-foreground">{data.itemCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button onClick={exportClinicCSV} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Export as CSV
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
