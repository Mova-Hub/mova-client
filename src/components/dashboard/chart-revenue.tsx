"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchCharts, type ChartDataPoint } from "@/api/dashboard"
import { Skeleton } from "@/components/ui/skeleton"

export function ChartRevenue({ range }: { range: "7d"|"30d"|"90d" }) {
  const [data, setData] = React.useState<ChartDataPoint[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    fetchCharts(range)
      .then(res => { if (alive) setData(res.chart_data) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [range])

  if (loading) return <Skeleton className="h-[350px] w-full rounded-xl" />

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Financière</CardTitle>
        <CardDescription>Comparatif Facturé vs Encaissé sur la période</CardDescription>
      </CardHeader>
      <CardContent className="pl-0">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis 
              dataKey="date" 
              tickLine={false} 
              axisLine={false} 
              tickMargin={10} 
              tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              style={{ fontSize: '12px', fill: 'var(--muted-foreground)' }}
            />
            <Tooltip 
              cursor={{ fill: 'var(--muted)', opacity: 0.2 }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="text-xs font-bold mb-1">{new Date(label).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1 text-emerald-600 font-bold">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          Encaissé: {Number(payload[0].value).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1 text-primary font-bold">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          Facturé: {Number(payload[1].value).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            
            {/* Collected (Cash In) */}
            <Bar 
              dataKey="collected" 
              name="Encaissé" 
              fill="#10b981"  // Emerald-500
              radius={[4, 4, 0, 0]} 
              barSize={20}
            />
            
            {/* Booked (Sales) */}
            <Bar 
              dataKey="booked" 
              name="Facturé" 
              fill="currentColor" 
              className="fill-primary" 
              radius={[4, 4, 0, 0]} 
              barSize={20} 
              opacity={0.3} // Ghost bars behind
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}