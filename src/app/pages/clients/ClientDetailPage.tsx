"use client"

import * as React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Phone, Mail, ShoppingBag, Calendar, Clock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

import clientApi, { type Client } from "@/api/client"

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 w-full">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [client, setClient] = React.useState<Client | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!id) return
    clientApi.show(id)
      .then((res) => setClient(res.data))
      .catch(() => { toast.error("Impossible de charger le client."); navigate("/clients") })
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) return <PageSkeleton />
  if (!client) return null

  const initials = (client.name ?? "")
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?"

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 w-full">

      {/* ── Breadcrumb ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/clients")}
        >
          <ArrowLeft className="size-4" />
          Clients
        </Button>
        <span>/</span>
        <span className="font-semibold text-foreground">{client.name}</span>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-950 to-indigo-900 p-6 sm:p-8 shadow-lg">
        <div className="pointer-events-none absolute -bottom-16 -right-10 size-48 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -top-10 right-32 size-32 rounded-full bg-white/[0.04]" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <span className="text-3xl font-black text-white">{initials}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{client.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              {client.phone && (
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
                >
                  <Phone className="size-3.5" /> {client.phone}
                </a>
              )}
              {client.email && (
                <a
                  href={`mailto:${client.email}`}
                  className="flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
                >
                  <Mail className="size-3.5" /> {client.email}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Commandes", value: String(client.ordersCount ?? 0), Icon: ShoppingBag },
          { label: "Inscrit le", value: formatDate(client.createdAt), Icon: Calendar },
          {
            label: "Dernière connexion",
            value: client.lastLoginAt ? formatDate(client.lastLoginAt) : "Jamais",
            Icon: Clock,
          },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="flex items-center gap-4 rounded-xl border bg-card p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="text-sm font-bold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
