import api from "@/api/apiService"

export type DashboardCard = {
  label: string
  value: number | string
  format: 'money' | 'number' | 'percent' | 'text'
  delta_pct: number
  subtext: string
}

export type CardsResponse = {
  range: "7d"|"30d"|"90d"
  cards: {
    revenue: DashboardCard
    leads: DashboardCard
    conversion: DashboardCard
    demand: DashboardCard
  }
}

export type ChartDataPoint = {
  date: string
  booked: number
  collected: number
}

export type ChartsResponse = {
  range: "7d"|"30d"|"90d"
  chart_data: ChartDataPoint[]
}

export async function fetchCards(range: "7d"|"30d"|"90d" = "30d") {
  const res = await api.get<CardsResponse>(`/dash/cards?range=${range}`)
  return res.data
}

export async function fetchCharts(range: "7d"|"30d"|"90d" = "30d") {
  const res = await api.get<ChartsResponse>(`/dash/charts?range=${range}`)
  return res.data
}