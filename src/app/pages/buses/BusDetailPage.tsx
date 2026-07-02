"use client"

import * as React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft, Pencil, Power, UserCircle, Phone, Mail,
  FileText, Upload, ShieldCheck, CarFront,
  CheckCircle2, AlertTriangle, XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

import busApi, { type UIBus, type BusStatus } from "@/api/bus"
import peopleApi, { type Person } from "@/api/people"
import AddEditBusDialog from "@/components/bus/AddEditBusDialog"

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  active: { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "En service" },
  inactive: { dot: "bg-slate-400", badge: "bg-slate-50 text-slate-700 border-slate-200", label: "Hors service" },
  maintenance: { dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-200", label: "En maintenance" },
}

const TYPE_LABELS: Record<string, string> = {
  hiace: "Hiace", coaster: "Coaster", sprinter: "Sprinter",
  coach: "Autocar", minibus: "Minibus", bus: "Bus classique",
}

const prettyType = (t?: string | null) => {
  if (!t) return "—"
  const k = t.toLowerCase()
  return TYPE_LABELS[k] ?? k.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function getComplianceStatus(date?: string | null): "ok" | "warning" | "expired" | "none" {
  if (!date) return "none"
  const days = Math.floor((new Date(date).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return "expired"
  if (days <= 30) return "warning"
  return "ok"
}

function ComplianceCard({ label, date }: { label: string; date?: string | null }) {
  const s = getComplianceStatus(date)
  const bg =
    s === "expired" ? "bg-destructive/10 border-destructive/20" :
    s === "warning" ? "bg-amber-50 border-amber-200" :
    s === "ok"      ? "bg-emerald-50 border-emerald-200" :
                      "bg-muted/30 border-border"
  const Icon =
    s === "expired" ? XCircle :
    s === "warning" ? AlertTriangle :
    s === "ok"      ? CheckCircle2 : null
  const textColor =
    s === "expired" ? "text-destructive" :
    s === "warning" ? "text-amber-700" :
    s === "ok"      ? "text-emerald-700" : "text-muted-foreground"

  return (
    <div className={`rounded-lg border p-3 transition-colors ${bg}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={`size-4 shrink-0 ${textColor}`} />}
        <span className={`text-sm font-medium ${s === "none" ? "text-xs text-muted-foreground/60" : textColor}`}>
          {formatDate(date)}
        </span>
      </div>
    </div>
  )
}

function DataRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value || "—"}</dd>
    </div>
  )
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 w-full">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-44" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-52" />
      </div>
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function BusDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [bus, setBus] = React.useState<UIBus | null>(null)
  const [people, setPeople] = React.useState<Person[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editOpen, setEditOpen] = React.useState(false)
  const [togglingStatus, setTogglingStatus] = React.useState(false)

  const getPerson = React.useCallback(
    (personId?: string | null) => people.find((p) => String(p.id) === String(personId)) ?? null,
    [people],
  )

  const load = React.useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const [busRes, peopleRes] = await Promise.all([
        busApi.get(id, ["operator", "driver", "conductor"]),
        peopleApi.list({ per_page: 200 }),
      ])
      setBus(busRes.data)
      setPeople(peopleRes.data.rows)
    } catch {
      toast.error("Impossible de charger les données du bus.")
      navigate("/buses")
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  React.useEffect(() => { load() }, [load])

  const handleToggleStatus = async () => {
    if (!bus) return
    const next: BusStatus = bus.status === "active" ? "inactive" : "active"
    setTogglingStatus(true)
    try {
      const res = await busApi.setStatus(bus.id, next)
      setBus(res.data)
      toast.success(next === "active" ? "Bus activé" : "Bus désactivé")
    } catch {
      toast.error("Impossible de modifier le statut.")
    } finally {
      setTogglingStatus(false)
    }
  }

  if (loading) return <PageSkeleton />
  if (!bus) return null

  const status = STATUS_CONFIG[bus.status ?? "inactive"]
  const isActive = bus.status === "active"
  const owner = getPerson(bus.operatorId)
  const driver = getPerson(bus.assignedDriverId)
  const conductor = getPerson(bus.assignedConductorId)

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 w-full">

      {/* ── Breadcrumb ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/buses")}
        >
          <ArrowLeft className="size-4" />
          Bus
        </Button>
        <span>/</span>
        <span className="font-mono font-semibold text-foreground">{bus.plate}</span>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 shadow-lg">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -top-14 -right-14 size-56 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-20 right-24 size-64 rounded-full bg-white/[0.03]" />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 relative">
          <div className="flex items-center gap-5">
            {/* Styled plate */}
            <div className="flex items-stretch h-14 overflow-hidden rounded-lg border border-white/20 bg-white/5 shadow-inner shrink-0">
              <div className="flex items-center justify-center w-8 bg-primary/70 shrink-0">
                <span className="text-[8px] font-black text-primary-foreground leading-none">RC</span>
              </div>
              <div className="flex items-center justify-center px-5">
                <span className="font-mono text-2xl font-black tracking-widest uppercase text-white">
                  {bus.plate}
                </span>
              </div>
            </div>

            <div>
              <h1 className="text-xl font-bold text-white">
                {[bus.model, bus.year].filter(Boolean).join(" · ") || "Véhicule"}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {bus.type && (
                  <Badge className="bg-white/10 text-white/80 border-transparent hover:bg-white/20 text-xs">
                    {prettyType(bus.type)}
                  </Badge>
                )}
                <span className="text-white/50 text-xs">·</span>
                <span className="text-white/60 text-xs">{bus.capacity} places</span>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <Badge
            variant="outline"
            className={`shrink-0 px-3 py-1.5 text-xs font-semibold shadow border ${status.badge}`}
          >
            <span className={`mr-2 inline-block size-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </Badge>
        </div>

        {/* Action buttons */}
        <div className="relative flex items-center gap-3 mt-6">
          <Button
            size="sm"
            className="bg-white/10 text-white border border-white/20 hover:bg-white/20"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5 mr-2" />
            Modifier
          </Button>
          <Button
            size="sm"
            className={`border border-white/20 ${
              isActive
                ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
            }`}
            onClick={handleToggleStatus}
            disabled={togglingStatus}
          >
            <Power className="size-3.5 mr-2" />
            {isActive ? "Désactiver" : "Activer"}
          </Button>
        </div>
      </div>

      {/* ── Quick Stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Capacité", value: `${bus.capacity} places` },
          { label: "Type", value: prettyType(bus.type) },
          { label: "Année", value: bus.year ? String(bus.year) : "—" },
          { label: "Kilométrage", value: bus.mileageKm ? `${bus.mileageKm.toLocaleString("fr-FR")} km` : "—" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</span>
            <span className="text-lg font-bold text-foreground">{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── Main grid ────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Left column — 2/3 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Specs */}
          <Card className="border-muted/60 shadow-sm">
            <CardHeader className="border-b border-muted/30 px-6 pb-3 pt-5">
              <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <CarFront className="size-4 text-primary" /> Spécifications
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-5">
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                <DataRow label="Modèle" value={bus.model} />
                <DataRow label="Type" value={prettyType(bus.type)} />
                <DataRow label="Capacité" value={bus.capacity ? `${bus.capacity} places` : null} />
                <DataRow label="Année" value={bus.year ? String(bus.year) : null} />
                <DataRow label="Kilométrage" value={bus.mileageKm ? `${bus.mileageKm.toLocaleString("fr-FR")} km` : null} />
                <DataRow label="Dernière révision" value={formatDate(bus.lastServiceDate)} />
              </dl>
            </CardContent>
          </Card>

          {/* Owner */}
          <Card className="relative overflow-hidden border-muted/60 shadow-sm">
            <div className="absolute inset-y-0 left-0 w-1 bg-primary/40" />
            <CardContent className="p-0">
              <div className="flex items-center gap-5 p-5 pl-6">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-muted">
                  {owner ? (
                    <span className="text-xl font-bold text-muted-foreground">
                      {owner.name.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <UserCircle className="size-8 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Propriétaire / Opérateur
                    </p>
                    <p className="font-semibold text-foreground">{owner?.name ?? "Non renseigné"}</p>
                  </div>
                  {owner && (
                    <div className="flex flex-col justify-center gap-1.5">
                      {owner.phone && (
                        <a href={`tel:${owner.phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                          <Phone className="size-3" /> {owner.phone}
                        </a>
                      )}
                      {owner.email && (
                        <a href={`mailto:${owner.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                          <Mail className="size-3" /> {owner.email}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — Compliance */}
        <Card className="border-muted/60 shadow-sm">
          <CardHeader className="border-b border-muted/30 px-6 pb-3 pt-5">
            <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" /> Conformité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-6 py-5">
            <ComplianceCard label="Assurance (expiration)" date={bus.insuranceValidUntil} />
            {bus.insurancePolicyNumber && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">N° Police</p>
                <p className="text-sm font-medium text-foreground font-mono">{bus.insurancePolicyNumber}</p>
              </div>
            )}
            {bus.insuranceProvider && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assureur</p>
                <p className="text-sm font-medium text-foreground">{bus.insuranceProvider}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="my-2" />

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <Tabs defaultValue="equipage" className="flex flex-col gap-6">
        <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
          {[
            { value: "equipage", label: "Équipage" },
            { value: "documents", label: "Documents" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-b-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground shadow-none data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="equipage" className="mt-0 animate-in fade-in duration-300 outline-none">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Équipe active</h3>
              <p className="text-xs text-muted-foreground">Personnel actuellement affecté à ce bus.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                { role: "Chauffeur Principal", person: driver },
                { role: "Receveur / Convoyeur", person: conductor },
              ] as const).map(({ role, person }) => (
                <Card key={role} className="border-muted/60 shadow-sm transition-colors hover:border-primary/20">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                      {person ? (
                        <span className="text-base font-bold text-primary">{person.name.charAt(0).toUpperCase()}</span>
                      ) : (
                        <UserCircle className="size-6 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{role}</p>
                      <p className="truncate text-sm font-medium">{person?.name ?? "Non assigné"}</p>
                      {person?.phone && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="size-3" /> {person.phone}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-0 animate-in fade-in duration-300 outline-none">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Dossier administratif</h3>
                <p className="text-xs text-muted-foreground">Gérez les documents et attestations du véhicule.</p>
              </div>
              <Button size="sm">
                <Upload className="size-3.5 mr-2" /> Ajouter
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Ajouté le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      <FileText className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                      Aucun document disponible pour ce bus.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <AddEditBusDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={bus as any}
        people={people}
        onSubmit={async (updated: any) => {
          try {
            await busApi.update(bus.id, updated)
            await load()
            toast.success("Bus mis à jour", { description: `Plaque : ${updated.plate}` })
          } catch {
            toast.error("Erreur lors de la mise à jour.")
          }
        }}
      />
    </div>
  )
}
