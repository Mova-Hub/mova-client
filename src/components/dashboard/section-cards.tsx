"use client"

import * as React from "react"
import {
  // IconTrendingUp, IconTrendingDown, 
  IconCreditCard, IconUsers, IconChartPie, IconBus
} from "@tabler/icons-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchCards, type CardsResponse } from "@/api/dashboard"
import { Skeleton } from "@/components/ui/skeleton"

export function SectionCards({ range }: { range: "7d"|"30d"|"90d" }) {
  const [data, setData] = React.useState<CardsResponse['cards'] | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let alive = true
    setLoading(true)
    fetchCards(range)
      .then(d => { if (alive) setData(d.cards) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [range])

  if (loading) return <CardsSkeleton />
  if (!data) return null

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard 
        title="Trésorerie Encaissée" 
        icon={IconCreditCard} 
        data={data.revenue} 
      />
      <StatsCard 
        title="Nouveaux Leads" 
        icon={IconUsers} 
        data={data.leads} 
      />
      <StatsCard 
        title="Conversion" 
        icon={IconChartPie} 
        data={data.conversion} 
      />
      <StatsCard 
        title="Véhicule Tendance" 
        icon={IconBus} 
        data={data.demand} 
      />
    </div>
  )
}

function StatsCard({ title, icon: Icon, data }: { title: string, icon: any, data: any }) {
  const isPositive = data.delta_pct >= 0
  
  // Format Value
  let displayValue = data.value
  if (data.format === 'money') displayValue = `${Number(data.value).toLocaleString('fr-FR')} FCFA`
  if (data.format === 'percent') displayValue = `${Number(data.value).toFixed(1)}%`

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{displayValue}</div>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          {data.format !== 'text' && (
             <span className={isPositive ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
               {isPositive ? "+" : ""}{Number(data.delta_pct).toFixed(1)}%
             </span>
          )}
          <span className="opacity-70">{data.subtext}</span>
        </p>
      </CardContent>
    </Card>
  )
}

function CardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1,2,3,4].map(i => (
        <Card key={i}><CardHeader><Skeleton className="h-4 w-[100px]" /></CardHeader><CardContent><Skeleton className="h-8 w-[120px] mb-2" /><Skeleton className="h-3 w-[80px]" /></CardContent></Card>
      ))}
    </div>
  )
}