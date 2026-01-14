"use client"

import * as React from "react"
import { SectionCards } from "@/components/dashboard/section-cards"
import { ChartRevenue } from "@/components/dashboard/chart-revenue"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function Overview() {
  const [range, setRange] = React.useState<"7d"|"30d"|"90d">("30d")

  return (
    <div className="flex flex-1 flex-col space-y-6 p-4 md:p-8 pt-6">
      
      {/* Header & Controls */}
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Tableau de bord</h2>
        <div className="flex items-center space-x-2">
          <Select value={range} onValueChange={(v: any) => setRange(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 derniers jours</SelectItem>
              <SelectItem value="30d">30 derniers jours</SelectItem>
              <SelectItem value="90d">3 derniers mois</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <SectionCards range={range} />

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <ChartRevenue range={range} />
        </div>
        {/* Placeholder for future specific charts (e.g., Fleet Distribution) */}
        <div className="col-span-3">
           {/* You can add a PieChart here later for Vehicle Types */}
           <div className="h-full min-h-[350px] rounded-xl border bg-muted/10 flex items-center justify-center text-muted-foreground">
              Analytique Secondaire (Bientôt)
           </div>
        </div>
      </div>
    </div>
  )
}