"use client"

import * as React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Phone, Mail, CreditCard, Calendar } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

import peopleApi, { type Person } from "@/api/people"

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const ROLE_CONFIG: Record<string, { label: string; badge: string }> = {
  driver:    { label: "Chauffeur",   badge: "bg-sky-50 text-sky-700 border-sky-200" },
  conductor: { label: "Receveur",    badge: "bg-violet-50 text-violet-700 border-violet-200" },
  owner:     { label: "Propriétaire", badge: "bg-amber-50 text-amber-700 border-amber-200" },
}

const STATUS_CONFIG: Record<string, { dot: string; label: string; badge: string }> = {
  active:    { dot: "bg-emerald-500", label: "Actif",    badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  inactive:  { dot: "bg-slate-400",   label: "Inactif",  badge: "bg-slate-50 text-slate-700 border-slate-200" },
  suspended: { dot: "bg-red-500",     label: "Suspendu", badge: "bg-red-50 text-red-700 border-red-200" },
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 w-full">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [person, setPerson] = React.useState<Person | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!id) return
    peopleApi.get(id)
      .then((res) => setPerson(res.data))
      .catch(() => { toast.error("Impossible de charger les données."); navigate("/people") })
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) return <PageSkeleton />
  if (!person) return null

  const role = ROLE_CONFIG[person.role] ?? { label: person.role, badge: "" }
  const status = STATUS_CONFIG[person.status ?? "inactive"]
  const initials = (person.name ?? "")
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
          onClick={() => navigate("/people")}
        >
          <ArrowLeft className="size-4" />
          Personnel
        </Button>
        <span>/</span>
        <span className="font-semibold text-foreground">{person.name}</span>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900 to-teal-900 p-6 sm:p-8 shadow-lg">
        <div className="pointer-events-none absolute -bottom-14 -right-10 size-44 rounded-full bg-white/5" />

        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div className="flex items-center gap-5">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
              <span className="text-3xl font-black text-white">{initials}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{person.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`text-xs ${role.badge}`}>{role.label}</Badge>
                {person.licenseNo && (
                  <span className="text-sm text-white/60">· Permis {person.licenseNo}</span>
                )}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <Badge variant="outline" className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${status.badge}`}>
            <span className={`mr-2 inline-block size-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </Badge>
        </div>
      </div>

      {/* ── Contact & Info cards ──────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Contact */}
        <Card className="border-muted/60 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</p>
            {person.phone ? (
              <a href={`tel:${person.phone}`} className="flex items-center gap-3 text-sm text-foreground transition-colors hover:text-primary">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Phone className="size-4 text-muted-foreground" />
                </div>
                {person.phone}
              </a>
            ) : (
              <p className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                  <Phone className="size-4" />
                </span>
                Non renseigné
              </p>
            )}
            {person.email ? (
              <a href={`mailto:${person.email}`} className="flex items-center gap-3 text-sm text-foreground transition-colors hover:text-primary">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Mail className="size-4 text-muted-foreground" />
                </div>
                {person.email}
              </a>
            ) : (
              <p className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                  <Mail className="size-4" />
                </span>
                Non renseigné
              </p>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card className="border-muted/60 shadow-sm">
          <CardContent className="p-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informations</p>
            <div className="flex items-center gap-3 text-sm text-foreground">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <CreditCard className="size-4 text-muted-foreground" />
              </div>
              <span>Permis : <span className="font-mono font-semibold">{person.licenseNo ?? "—"}</span></span>
            </div>
            <div className="flex items-center gap-3 text-sm text-foreground">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Calendar className="size-4 text-muted-foreground" />
              </div>
              <span>Depuis le {formatDate(person.createdAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
