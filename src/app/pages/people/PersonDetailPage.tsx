"use client"

import * as React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft, Phone, Mail, CreditCard, Calendar, MapPin,
  Bus, Star, ShieldCheck, AlertTriangle, ChevronLeft, ChevronRight,
} from "lucide-react"
import {
  useReactTable, getCoreRowModel, flexRender,
  type ColumnDef,
} from "@tanstack/react-table"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

import { DataTable } from "@/components/data-table"

import peopleApi, { type Person, type AssignedBusSnippet } from "@/api/people"
import reservationApi, { type UIReservation } from "@/api/reservation"

/* ─── Config ────────────────────────────────────────────────────────────────── */

const ROLE_CONFIG: Record<string, { label: string; badge: string; color: string }> = {
  driver:    { label: "Chauffeur",    badge: "bg-sky-50 text-sky-700 border-sky-200",          color: "#0284c7" },
  conductor: { label: "Receveur",     badge: "bg-violet-50 text-violet-700 border-violet-200", color: "#7c3aed" },
  owner:     { label: "Propriétaire", badge: "bg-amber-50 text-amber-700 border-amber-200",    color: "#d97706" },
}

const STATUS_CONFIG: Record<string, { dot: string; label: string; badge: string }> = {
  active:    { dot: "bg-emerald-500", label: "Actif",    badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  inactive:  { dot: "bg-slate-400",   label: "Inactif",  badge: "bg-slate-50 text-slate-700 border-slate-200"       },
  suspended: { dot: "bg-red-500",     label: "Suspendu", badge: "bg-red-50 text-red-700 border-red-200"             },
}

const BUS_STATUS_CFG: Record<string, { label: string; badge: string }> = {
  active:      { label: "En service",   badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  inactive:    { label: "Hors service", badge: "bg-slate-50 text-slate-600 border-slate-200"       },
  maintenance: { label: "Maintenance",  badge: "bg-amber-50 text-amber-700 border-amber-200"       },
  suspended:   { label: "Suspendu",     badge: "bg-red-50 text-red-700 border-red-200"             },
}

const RES_STATUS_CFG: Record<string, { label: string; badge: string }> = {
  pending:     { label: "En attente", badge: "bg-amber-50 text-amber-700 border-amber-200"     },
  confirmed:   { label: "Confirmée",  badge: "bg-blue-50 text-blue-700 border-blue-200"        },
  completed:   { label: "Terminée",   badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled:   { label: "Annulée",    badge: "bg-red-50 text-red-700 border-red-200"           },
  in_progress: { label: "En cours",   badge: "bg-violet-50 text-violet-700 border-violet-200"  },
}

const BUS_TYPE_LABELS: Record<string, string> = {
  hiace: "Hiace", coaster: "Coaster", sprinter: "Sprinter",
  coach: "Autocar", minibus: "Minibus", bus: "Bus classique", other: "Autre",
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}
function isExpiringSoon(d?: string | null) {
  if (!d) return false
  const diff = new Date(d).getTime() - Date.now()
  return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000
}
function isExpired(d?: string | null) {
  if (!d) return false
  return new Date(d).getTime() < Date.now()
}

/* ─── Quality score ring ─────────────────────────────────────────────────────── */

function QualityRing({ score = 78 }: { score?: number }) {
  const r = 38
  const circ = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444"

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative size-24">
        <svg viewBox="0 0 88 88" className="size-full -rotate-90">
          <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
          <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${filled} ${circ}`} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black leading-none">{score}</span>
          <span className="text-[10px] text-muted-foreground font-medium">/100</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-medium">Score qualité</span>
    </div>
  )
}

/* ─── InfoRow ────────────────────────────────────────────────────────────────── */

function InfoRow({ icon, label, value, mono = false, href }: {
  icon: React.ReactNode; label: string; value?: string | null; mono?: boolean; href?: string
}) {
  const text = value ?? "—"
  const inner = (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium truncate ${mono ? "font-mono" : ""} ${!value ? "text-muted-foreground" : ""}`}>{text}</p>
      </div>
    </div>
  )
  if (href && value) return <a href={href} className="block transition-opacity hover:opacity-80">{inner}</a>
  return <div>{inner}</div>
}

/* ─── Skeleton ───────────────────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 w-full">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-32 rounded-xl lg:col-span-2" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  )
}

/* ─── Reservations tab (drivers & conductors) ────────────────────────────────── */

function ReservationsTab({ person }: { person: Person }) {
  const busId = person.assignedBuses?.[0]?.id

  const [reservations, setReservations] = React.useState<UIReservation[]>([])
  const [page, setPage] = React.useState(1)
  const [lastPage, setLastPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!busId) { setLoading(false); return }
    setLoading(true)
    reservationApi.list({ bus_id: busId, page, per_page: 10 })
      .then((res) => {
        setReservations(res.data.rows)
        setLastPage(res.data.meta.last_page)
      })
      .catch(() => toast.error("Impossible de charger les réservations."))
      .finally(() => setLoading(false))
  }, [busId, page])

  const columns = React.useMemo<ColumnDef<UIReservation>[]>(() => [
    {
      accessorKey: "code",
      header: "Réf.",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.code ?? "—"}</span>
      ),
    },
    {
      id: "passenger",
      header: "Passager",
      cell: ({ row }) => row.original.passenger?.name ?? "—",
    },
    {
      accessorKey: "tripDate",
      header: "Date trajet",
      cell: ({ row }) => formatDate(row.original.tripDate),
    },
    {
      id: "itinerary",
      header: "Itinéraire",
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.route?.from}
          <span className="mx-1 text-muted-foreground">→</span>
          {row.original.route?.to}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => {
        const s = row.original.status ?? ""
        const cfg = RES_STATUS_CFG[s] ?? { label: s || "—", badge: "" }
        return <Badge variant="outline" className={`text-xs ${cfg.badge}`}>{cfg.label}</Badge>
      },
    },
    {
      accessorKey: "priceTotal",
      header: "Montant",
      cell: ({ row }) => {
        const v = row.original.priceTotal
        return v != null ? <span className="font-medium tabular-nums">{v.toLocaleString("fr-FR")} XAF</span> : "—"
      },
    },
  ], [])

  const table = useReactTable({
    data: reservations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: lastPage,
  })

  if (!busId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16 text-center">
        <Bus className="size-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium">Aucun bus assigné</p>
        <p className="text-xs text-muted-foreground mt-1">
          Assignez ce {person.role === "driver" ? "chauffeur" : "receveur"} à un bus pour voir ses réservations
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="text-xs font-semibold">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-sm text-muted-foreground">
                  Aucune réservation enregistrée pour ce bus.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {lastPage > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="icon" className="size-8"
            onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">Page {page} / {lastPage}</span>
          <Button variant="outline" size="icon" className="size-8"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))} disabled={page >= lastPage}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/* ─── Buses tab (owners) ─────────────────────────────────────────────────────── */

function BusesTab({ buses, navigate }: {
  buses: AssignedBusSnippet[]
  navigate: (path: string) => void
}) {
  const columns = React.useMemo<ColumnDef<AssignedBusSnippet>[]>(() => [
    {
      accessorKey: "plate",
      header: "Immatriculation",
      cell: ({ row }) => (
        <span className="font-mono font-bold text-sm tracking-wider">{row.original.plate}</span>
      ),
    },
    {
      id: "brand_model",
      header: "Marque / Modèle",
      cell: ({ row }) => {
        const b = row.original
        return [b.brand, b.model].filter(Boolean).join(" ") || <span className="text-muted-foreground">—</span>
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const t = row.original.type
        return t ? (BUS_TYPE_LABELS[t] ?? t) : <span className="text-muted-foreground">—</span>
      },
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => {
        const s = row.original.status ?? ""
        const cfg = BUS_STATUS_CFG[s] ?? { label: s || "—", badge: "" }
        return <Badge variant="outline" className={`text-xs ${cfg.badge}`}>{cfg.label}</Badge>
      },
    },
  ], [])

  return (
    <DataTable<AssignedBusSnippet>
      data={buses}
      columns={columns}
      getRowId={(r) => String(r.id)}
      searchable={{
        placeholder: "Rechercher par plaque, marque, modèle…",
        fields: ["plate", "brand", "model"] as (keyof AssignedBusSnippet)[],
      }}
      pageSizeOptions={[10, 20, 50]}
      onRowClick={(b) => navigate(`/buses/${b.id}`)}
    />
  )
}

/* ─── Informations tab ───────────────────────────────────────────────────────── */

function InformationsTab({ person }: { person: Person }) {
  const isDriverOrConductor = person.role === "driver" || person.role === "conductor"
  const permit = {
    expired: isExpired(person.permitExpirationDate),
    soon: isExpiringSoon(person.permitExpirationDate),
  }
  const addr = person.address
  const hasAddress = addr && Object.values(addr).some(Boolean)

  const buses = [
    ...(person.assignedBuses ?? []),
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

      {/* Left column (2/3) */}
      <div className="lg:col-span-2 space-y-4">

        {/* Contact */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InfoRow icon={<Phone className="size-4 text-muted-foreground" />} label="Téléphone" value={person.phone} href={`tel:${person.phone}`} />
            <InfoRow icon={<Mail className="size-4 text-muted-foreground" />} label="Email" value={person.email} href={`mailto:${person.email}`} />
          </CardContent>
        </Card>

        {/* Permit / Habilitation */}
        {isDriverOrConductor && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {person.role === "driver" ? "Permis de conduire" : "Habilitation"}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow
                icon={<CreditCard className="size-4 text-muted-foreground" />}
                label="Numéro"
                value={person.licenseNo}
                mono
              />
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {permit.expired
                    ? <AlertTriangle className="size-4 text-destructive" />
                    : permit.soon
                      ? <AlertTriangle className="size-4 text-amber-500" />
                      : <Calendar className="size-4 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Expiration</p>
                  <p className={`text-sm font-medium ${permit.expired ? "text-destructive" : permit.soon ? "text-amber-600" : ""}`}>
                    {formatDate(person.permitExpirationDate)}
                    {permit.expired && <span className="ml-1.5 text-xs">(expiré)</span>}
                    {permit.soon && !permit.expired && <span className="ml-1.5 text-xs">(bientôt)</span>}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Address */}
        {hasAddress && addr && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adresse</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {addr.street        && <InfoRow icon={<MapPin className="size-4 text-muted-foreground" />} label="Rue / Avenue"          value={addr.street} />}
              {addr.quartier      && <InfoRow icon={<MapPin className="size-4 text-muted-foreground" />} label="Quartier"              value={addr.quartier} />}
              {addr.arrondissement && <InfoRow icon={<MapPin className="size-4 text-muted-foreground" />} label="Arrondissement"       value={addr.arrondissement} />}
              {addr.city          && <InfoRow icon={<MapPin className="size-4 text-muted-foreground" />} label="Ville"                 value={addr.city} />}
              {addr.department    && <InfoRow icon={<MapPin className="size-4 text-muted-foreground" />} label="Province / Département" value={addr.department} />}
            </CardContent>
          </Card>
        )}

        {/* Assigned buses (drivers / conductors) as cards */}
        {isDriverOrConductor && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Bus className="size-3.5" /> Bus assigné(s)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {buses.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {buses.map((b) => {
                    const sCfg = BUS_STATUS_CFG[b.status ?? ""] ?? { label: "—", badge: "" }
                    const roleLabel = b.role === "driver" ? "Chauffeur" : b.role === "conductor" ? "Receveur" : null
                    return (
                      <div key={b.id} className="flex items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Bus className="size-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-sm">{b.plate}</span>
                            {roleLabel && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{roleLabel}</Badge>}
                          </div>
                          {(b.brand || b.model) && (
                            <p className="text-xs text-muted-foreground truncate">{[b.brand, b.model].filter(Boolean).join(" ")}</p>
                          )}
                        </div>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${sCfg.badge}`}>{sCfg.label}</Badge>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Aucun bus assigné</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right column (1/3) */}
      <div className="space-y-4">

        {/* Fiche */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fiche</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <InfoRow icon={<Calendar className="size-4 text-muted-foreground" />} label="Inscrit le" value={formatDate(person.createdAt)} />
            <InfoRow icon={<ShieldCheck className="size-4 text-muted-foreground" />} label="Statut" value={STATUS_CONFIG[person.status ?? "inactive"]?.label} />
            {person.stats?.busCount !== undefined && (
              <InfoRow icon={<Bus className="size-4 text-muted-foreground" />} label="Bus associés" value={String(person.stats.busCount)} />
            )}
          </CardContent>
        </Card>

        {/* Quality score breakdown */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Star className="size-3.5" /> Score qualité
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            {[
              { label: "Ponctualité",  pct: 85 },
              { label: "Comportement", pct: 72 },
              { label: "Documents",    pct: 90 },
              { label: "Incidents",    pct: 60 },
            ].map(({ label, pct }) => {
              const bar = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400"
              return (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-xs font-semibold">{pct}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            <p className="text-[10px] text-muted-foreground pt-1">Score calculé automatiquement (données simulées)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

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

  const role   = ROLE_CONFIG[person.role]  ?? { label: person.role,  badge: "", color: "#64748b" }
  const status = STATUS_CONFIG[person.status ?? "inactive"] ?? STATUS_CONFIG.inactive
  const initials = (person.name ?? "").split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase() || "?"

  const isDriverOrConductor = person.role === "driver" || person.role === "conductor"
  const isOwner = person.role === "owner"

  const addr = person.address
  const hasAddress = addr && Object.values(addr).some(Boolean)
  const addrLine = [addr?.street, addr?.quartier, addr?.arrondissement, addr?.city, addr?.department]
    .filter(Boolean).join(", ")

  const ownedBuses = person.ownedBuses ?? []

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 w-full">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/people")}>
          <ArrowLeft className="size-4" />
          Personnel
        </Button>
        <span>/</span>
        <span className="font-semibold text-foreground">{person.name}</span>
      </div>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="h-2 w-full"
          style={{ background: `linear-gradient(90deg, ${role.color}88, ${role.color}22)` }} />
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6">
          <Avatar className="size-20 shrink-0 border-2 border-border shadow">
            {person.avatar ? <AvatarImage src={person.avatar} alt={person.name} /> : null}
            <AvatarFallback className="text-2xl font-black"
              style={{ backgroundColor: `${role.color}18`, color: role.color }}>
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate mb-1">
              {person.firstName ? `${person.firstName} ${person.name}` : person.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`text-xs ${role.badge}`}>{role.label}</Badge>
              <Badge variant="outline" className={`text-xs ${status.badge}`}>
                <span className={`mr-1.5 inline-block size-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </Badge>
              {person.phone && (
                <a href={`tel:${person.phone}`}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <Phone className="size-3" />{person.phone}
                </a>
              )}
            </div>
            {hasAddress && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />{addrLine}
              </p>
            )}
          </div>

          <div className="shrink-0 self-center">
            <QualityRing score={78} />
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="informations" className="w-full">
        <TabsList className="mb-2">
          <TabsTrigger value="informations">Informations</TabsTrigger>

          {isDriverOrConductor && (
            <TabsTrigger value="reservations">Réservations</TabsTrigger>
          )}

          {isOwner && (
            <TabsTrigger value="buses">
              Bus
              {ownedBuses.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">{ownedBuses.length}</Badge>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="informations" className="mt-0 outline-none">
          <InformationsTab person={person} />
        </TabsContent>

        {isDriverOrConductor && (
          <TabsContent value="reservations" className="mt-0 outline-none">
            <ReservationsTab person={person} />
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="buses" className="mt-0 outline-none">
            {ownedBuses.length > 0 ? (
              <BusesTab buses={ownedBuses} navigate={navigate} />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-16 text-center">
                <Bus className="size-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">Aucun bus enregistré</p>
                <p className="text-xs text-muted-foreground mt-1">Ce propriétaire n'a pas encore de bus associés</p>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
