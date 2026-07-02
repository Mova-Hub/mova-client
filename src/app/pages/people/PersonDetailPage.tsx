"use client"

import * as React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft, Phone, Mail, CreditCard, Calendar, MapPin,
  Bus, Star, ShieldCheck, AlertTriangle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

import peopleApi, { type Person } from "@/api/people"

/* ─── Config ────────────────────────────────────────────────────────────────── */

const ROLE_CONFIG: Record<string, { label: string; badge: string; color: string }> = {
  driver:    { label: "Chauffeur",    badge: "bg-sky-50 text-sky-700 border-sky-200",       color: "#0284c7" },
  conductor: { label: "Receveur",     badge: "bg-violet-50 text-violet-700 border-violet-200", color: "#7c3aed" },
  owner:     { label: "Propriétaire", badge: "bg-amber-50 text-amber-700 border-amber-200", color: "#d97706" },
}

const STATUS_CONFIG: Record<string, { dot: string; label: string; badge: string }> = {
  active:    { dot: "bg-emerald-500", label: "Actif",    badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  inactive:  { dot: "bg-slate-400",   label: "Inactif",  badge: "bg-slate-50 text-slate-700 border-slate-200"       },
  suspended: { dot: "bg-red-500",     label: "Suspendu", badge: "bg-red-50 text-red-700 border-red-200"             },
}

const BUS_STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  active:      { label: "En service",    badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  inactive:    { label: "Hors service",  badge: "bg-slate-50 text-slate-600 border-slate-200"       },
  maintenance: { label: "Maintenance",   badge: "bg-amber-50 text-amber-700 border-amber-200"       },
  suspended:   { label: "Suspendu",      badge: "bg-red-50 text-red-700 border-red-200"             },
}

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function isExpiringSoon(isoDate?: string | null): boolean {
  if (!isoDate) return false
  const diff = new Date(isoDate).getTime() - Date.now()
  return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000 // 60 days
}

function isExpired(isoDate?: string | null): boolean {
  if (!isoDate) return false
  return new Date(isoDate).getTime() < Date.now()
}

/* ─── Quality score ring ─────────────────────────────────────────────────────
   Placeholder: hardcoded to 78 / 100.
   Replace with a real computed value when the backend provides it.
────────────────────────────────────────────────────────────────────────────── */
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
          <circle
            cx="44" cy="44" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circ}`}
          />
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

/* ─── Skeletons ─────────────────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 w-full max-w-5xl mx-auto">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

/* ─── Info row ───────────────────────────────────────────────────────────────── */

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

  if (href && value) {
    return <a href={href} className="block transition-opacity hover:opacity-80">{inner}</a>
  }
  return <div>{inner}</div>
}

/* ─── Bus card ───────────────────────────────────────────────────────────────── */

function BusCard({ bus, navigate }: { bus: { id: string | number; plate: string; brand?: string | null; model?: string | null; type?: string | null; status?: string | null; role?: "driver" | "conductor" | null }; navigate: (path: string) => void }) {
  const statusCfg = BUS_STATUS_CONFIG[bus.status ?? ""] ?? { label: bus.status ?? "—", badge: "" }
  const roleLabel = bus.role === "driver" ? "Chauffeur" : bus.role === "conductor" ? "Receveur" : null

  return (
    <button
      type="button"
      className="w-full text-left rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
      onClick={() => navigate(`/buses/${bus.id}`)}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Bus className="size-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm">{bus.plate}</span>
            {roleLabel && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{roleLabel}</Badge>
            )}
          </div>
          {(bus.brand || bus.model) && (
            <p className="text-xs text-muted-foreground truncate">{[bus.brand, bus.model].filter(Boolean).join(" ")}</p>
          )}
        </div>
        <Badge variant="outline" className={`text-[10px] shrink-0 ${statusCfg.badge}`}>{statusCfg.label}</Badge>
      </div>
    </button>
  )
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */

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

  const role = ROLE_CONFIG[person.role] ?? { label: person.role, badge: "", color: "#64748b" }
  const status = STATUS_CONFIG[person.status ?? "inactive"]
  const initials = (person.name ?? "")
    .split(" ").map((n) => n[0] ?? "").join("").slice(0, 2).toUpperCase() || "?"

  const buses = [
    ...(person.assignedBuses ?? []),
    ...(person.ownedBuses ?? []).map((b) => ({ ...b, role: null as null })),
  ]
  const isDriverOrConductor = person.role === "driver" || person.role === "conductor"

  const permit = {
    expired: isExpired(person.permitExpirationDate),
    soon: isExpiringSoon(person.permitExpirationDate),
  }

  const addr = person.address
  const hasAddress = addr && Object.values(addr).some(Boolean)
  const addrLine = [addr?.street, addr?.quartier, addr?.arrondissement, addr?.city, addr?.department]
    .filter(Boolean).join(", ")

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 w-full max-w-5xl mx-auto">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => navigate("/people")}>
          <ArrowLeft className="size-4" />
          Personnel
        </Button>
        <span>/</span>
        <span className="font-semibold text-foreground">{person.name}</span>
      </div>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
        {/* Decorative gradient strip */}
        <div className="h-2 w-full" style={{ background: `linear-gradient(90deg, ${role.color}88, ${role.color}22)` }} />

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6">
          {/* Avatar */}
          <Avatar className="size-20 shrink-0 text-2xl border-2 border-border shadow">
            {person.avatar ? <AvatarImage src={person.avatar} alt={person.name} /> : null}
            <AvatarFallback className="text-2xl font-black" style={{ backgroundColor: `${role.color}18`, color: role.color }}>
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold truncate">
                {person.firstName ? `${person.firstName} ${person.name}` : person.name}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`text-xs ${role.badge}`}>{role.label}</Badge>
              <Badge variant="outline" className={`text-xs ${status.badge}`}>
                <span className={`mr-1.5 inline-block size-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </Badge>
              {person.phone && (
                <a href={`tel:${person.phone}`} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                  <Phone className="size-3" />
                  {person.phone}
                </a>
              )}
            </div>
            {hasAddress && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                {addrLine}
              </p>
            )}
          </div>

          {/* Quality score */}
          <div className="shrink-0 self-center">
            <QualityRing score={78} />
          </div>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Left column (2/3) ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Contact */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={<Phone className="size-4 text-muted-foreground" />} label="Téléphone" value={person.phone} href={`tel:${person.phone}`} />
              <InfoRow icon={<Mail className="size-4 text-muted-foreground" />} label="Email" value={person.email} href={`mailto:${person.email}`} />
            </CardContent>
          </Card>

          {/* Permit (drivers & conductors only) */}
          {isDriverOrConductor && (
            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
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
                    {permit.expired ? (
                      <AlertTriangle className="size-4 text-destructive" />
                    ) : permit.soon ? (
                      <AlertTriangle className="size-4 text-amber-500" />
                    ) : (
                      <Calendar className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Expiration</p>
                    <p className={`text-sm font-medium ${permit.expired ? "text-destructive" : permit.soon ? "text-amber-600" : ""}`}>
                      {formatDate(person.permitExpirationDate)}
                      {permit.expired && <span className="ml-2 text-xs">(expiré)</span>}
                      {permit.soon && !permit.expired && <span className="ml-2 text-xs">(bientôt)</span>}
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
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Adresse</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addr.street && (
                  <InfoRow icon={<MapPin className="size-4 text-muted-foreground" />} label="Rue / Avenue" value={addr.street} />
                )}
                {addr.quartier && (
                  <InfoRow icon={<MapPin className="size-4 text-muted-foreground" />} label="Quartier" value={addr.quartier} />
                )}
                {addr.arrondissement && (
                  <InfoRow icon={<MapPin className="size-4 text-muted-foreground" />} label="Arrondissement" value={addr.arrondissement} />
                )}
                {addr.city && (
                  <InfoRow icon={<MapPin className="size-4 text-muted-foreground" />} label="Ville" value={addr.city} />
                )}
                {addr.department && (
                  <InfoRow icon={<MapPin className="size-4 text-muted-foreground" />} label="Province / Département" value={addr.department} />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right column (1/3) ── */}
        <div className="space-y-4">

          {/* Fiche */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Fiche</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <InfoRow
                icon={<Calendar className="size-4 text-muted-foreground" />}
                label="Inscrit le"
                value={formatDate(person.createdAt)}
              />
              <InfoRow
                icon={<ShieldCheck className="size-4 text-muted-foreground" />}
                label="Statut"
                value={STATUS_CONFIG[person.status ?? "inactive"]?.label}
              />
              {person.stats?.busCount !== undefined && (
                <InfoRow
                  icon={<Bus className="size-4 text-muted-foreground" />}
                  label="Bus associés"
                  value={String(person.stats.busCount)}
                />
              )}
            </CardContent>
          </Card>

          {/* Quality score breakdown (placeholder) */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Star className="size-3.5" />
                Score qualité
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-3">
              {[
                { label: "Ponctualité",   pct: 85 },
                { label: "Comportement",  pct: 72 },
                { label: "Documents",     pct: 90 },
                { label: "Incidents",     pct: 60 },
              ].map(({ label, pct }) => {
                const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-red-400"
                return (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-semibold">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              <p className="text-[10px] text-muted-foreground pt-1">Score calculé automatiquement (données simulées)</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Assigned / Owned buses ── */}
      {buses.length > 0 && (
        <div className="space-y-3">
          <Separator />
          <div className="flex items-center gap-2">
            <Bus className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">
              {person.role === "owner" ? "Bus en propriété" : "Bus assigné(s)"}
            </h2>
            <Badge variant="secondary" className="text-xs px-1.5">{buses.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {buses.map((b) => (
              <BusCard key={b.id} bus={{ ...b, id: String(b.id) }} navigate={navigate} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state for bus section when driver/conductor with no bus */}
      {buses.length === 0 && isDriverOrConductor && (
        <div className="space-y-3">
          <Separator />
          <div className="flex items-center gap-2">
            <Bus className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Bus assigné(s)</h2>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-10 text-center">
            <Bus className="size-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Aucun bus assigné</p>
          </div>
        </div>
      )}
    </div>
  )
}
