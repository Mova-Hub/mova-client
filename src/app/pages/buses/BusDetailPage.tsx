"use client"

import * as React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft, Pencil, Power, UserCircle, Phone,
  Upload, ShieldCheck, CarFront, Trash2,
  CheckCircle2, AlertTriangle, XCircle, FileText,
} from "lucide-react"
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"

import busApi, { type UIBus, type BusStatus, type BusDocument, type BusStats } from "@/api/bus"
import peopleApi, { type Person } from "@/api/people"
import AddEditBusDialog from "@/components/bus/AddEditBusDialog"

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  active:      { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "En service" },
  inactive:    { dot: "bg-slate-400",   badge: "bg-slate-50 text-slate-700 border-slate-200",       label: "Hors service" },
  maintenance: { dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-200",       label: "En maintenance" },
}

const TYPE_LABELS: Record<string, string> = {
  hiace: "Hiace", coaster: "Coaster", sprinter: "Sprinter",
  coach: "Autocar", minibus: "Minibus", bus: "Bus classique",
}

const ENERGY_LABELS: Record<string, string> = {
  diesel: "Diesel", gasoline: "Essence", electric: "Électrique",
  hybrid: "Hybride", lpg: "GPL",
}

const DOC_TYPE_LABELS: Record<string, string> = {
  carte_grise: "Carte grise", assurance: "Assurance",
  visite_technique: "Visite technique", permis: "Permis", autre: "Autre",
}

const RESERVATION_STATUS_COLORS: Record<string, string> = {
  pending:     "#f59e0b",
  confirmed:   "#3b82f6",
  completed:   "#10b981",
  cancelled:   "#ef4444",
  in_progress: "#6366f1",
}

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

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

function initials(name?: string | null) {
  if (!name) return "?"
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
}

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function CompliancePill({ label, date }: { label: string; date?: string | null }) {
  const s = getComplianceStatus(date)
  const cfg = {
    ok:      { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", Icon: CheckCircle2 },
    warning: { bg: "bg-amber-50 border-amber-200",     text: "text-amber-700",   Icon: AlertTriangle },
    expired: { bg: "bg-red-50 border-red-200",         text: "text-red-700",     Icon: XCircle },
    none:    { bg: "bg-muted/30 border-border",        text: "text-muted-foreground", Icon: null },
  }[s]

  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-3 ${cfg.bg}`}>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div className={`flex items-center gap-1.5 text-sm font-medium ${cfg.text}`}>
        {cfg.Icon && <cfg.Icon className="size-3.5 shrink-0" />}
        {formatDate(date)}
      </div>
    </div>
  )
}

function Spec({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  )
}

function AvatarCircle({ name, size = "md" }: { name?: string | null; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-14 text-xl" : "size-10 text-sm"
  return (
    <div className={`${sz} rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0`}>
      {name ? initials(name) : <UserCircle className="size-5 text-muted-foreground" />}
    </div>
  )
}

/* ─── Inline crew assignment popover ─────────────────────────────────────────── */

function AssignPopover({
  busId,
  currentId,
  people,
  role,
  onAssigned,
}: {
  busId: string
  currentId?: string | null
  people: Person[]
  role: "driver" | "conductor"
  onAssigned: (updated: UIBus) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  const candidates = people.filter((p) => p.role === role)

  async function assign(personId: string | null) {
    setLoading(true)
    try {
      const res = role === "driver"
        ? await busApi.assignDriver(busId, personId)
        : await busApi.assignConductor(busId, personId)
      onAssigned(res.data)
      toast.success(personId ? "Personnel assigné." : "Personnel retiré.")
    } catch {
      toast.error("Erreur lors de l'assignation.")
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading} className="h-7 text-xs px-2.5">
          {currentId ? "Changer" : "Assigner"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-64" align="end">
        <Command>
          <CommandInput placeholder="Rechercher…" />
          <CommandList>
            <CommandEmpty>Aucun résultat</CommandEmpty>
            <CommandGroup>
              {currentId && (
                <CommandItem onSelect={() => assign(null)} className="text-destructive focus:text-destructive">
                  <XCircle className="mr-2 size-3.5 shrink-0" /> Retirer
                </CommandItem>
              )}
              {candidates.map((p) => (
                <CommandItem key={p.id} onSelect={() => assign(String(p.id))}>
                  <AvatarCircle name={p.name} size="sm" />
                  <div className="ml-2 min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* ─── Document upload dialog ─────────────────────────────────────────────────── */

function UploadDocumentDialog({
  open,
  onOpenChange,
  onUpload,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onUpload: (file: File, name: string, type: string, expiresAt: string) => Promise<void>
}) {
  const [file, setFile] = React.useState<File | null>(null)
  const [name, setName] = React.useState("")
  const [docType, setDocType] = React.useState("autre")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) { setFile(null); setName(""); setDocType("autre"); setExpiresAt("") }
  }, [open])

  async function handleSubmit() {
    if (!file || !name.trim()) return
    setLoading(true)
    try {
      await onUpload(file, name.trim(), docType, expiresAt)
      onOpenChange(false)
    } catch {
      toast.error("Erreur lors du téléversement.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un document</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Fichier *</Label>
            <Input type="file" onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              setFile(f)
              if (f && !name) setName(f.name.replace(/\.[^.]+$/, ""))
            }} />
          </div>
          <div className="grid gap-1.5">
            <Label>Libellé *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Carte grise 2025" />
          </div>
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label>Date d'expiration (optionnel)</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button disabled={!file || !name.trim() || loading} onClick={handleSubmit}>
            {loading ? "Envoi…" : "Téléverser"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Tabs ───────────────────────────────────────────────────────────────────── */

function InformationsTab({ bus }: { bus: UIBus }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left: specs */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader className="pb-3 pt-5 px-6 border-b">
            <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <CarFront className="size-4 text-primary" /> Spécifications
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
              <Spec label="Marque" value={bus.brand} />
              <Spec label="Modèle" value={bus.model} />
              <Spec label="Type" value={prettyType(bus.type)} />
              <Spec label="Énergie" value={bus.energyType ? (ENERGY_LABELS[bus.energyType] ?? bus.energyType) : undefined} />
              <Spec label="Capacité" value={bus.capacity ? `${bus.capacity} places` : undefined} />
              <Spec label="Année fab." value={bus.year ? String(bus.year) : undefined} />
              <Spec label="1re mise en circ." value={bus.firstRegistrationYear ? String(bus.firstRegistrationYear) : undefined} />
              <Spec label="N° châssis" value={bus.chassisNumber} />
              <Spec label="Kilométrage" value={bus.mileageKm ? `${bus.mileageKm.toLocaleString("fr-FR")} km` : undefined} />
              <Spec label="Dernière révision" value={formatDate(bus.lastServiceDate)} />
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Right: compliance */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3 pt-5 px-6 border-b">
            <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" /> Conformité
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 py-5 space-y-3">
            <CompliancePill label="Assurance" date={bus.insuranceValidUntil} />
            {bus.insurancePolicyNumber && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">N° Police</p>
                <p className="text-sm font-mono font-medium">{bus.insurancePolicyNumber}</p>
              </div>
            )}
            {bus.insuranceProvider && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Assureur</p>
                <p className="text-sm font-medium">{bus.insuranceProvider}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function EquipageTab({
  bus,
  people,
  onBusUpdated,
}: {
  bus: UIBus
  people: Person[]
  onBusUpdated: (updated: UIBus) => void
}) {
  const getPerson = (id?: string | null) => people.find((p) => String(p.id) === String(id)) ?? null

  const crew: { role: "driver" | "conductor"; label: string; person: Person | null; id?: string | null }[] = [
    { role: "driver",    label: "Chauffeur",          person: getPerson(bus.assignedDriverId),   id: bus.assignedDriverId },
    { role: "conductor", label: "Receveur / Convoyeur", person: getPerson(bus.assignedConductorId), id: bus.assignedConductorId },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Équipe active</h3>
        <p className="text-xs text-muted-foreground">Personnel actuellement affecté à ce bus.</p>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Rôle</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-24 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {crew.map(({ role, label, person, id }) => (
              <TableRow key={role}>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <AvatarCircle name={person?.name} size="sm" />
                    <span className="text-sm font-medium">{person?.name ?? <span className="text-muted-foreground italic">Non assigné</span>}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {person?.phone ? (
                    <a href={`tel:${person.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      <Phone className="size-3" />{person.phone}
                    </a>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {person ? (
                    <Badge variant="outline" className={person.status === "active" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : ""}>
                      {person.status === "active" ? "Actif" : "Inactif"}
                    </Badge>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <AssignPopover
                    busId={bus.id}
                    currentId={id}
                    people={people}
                    role={role}
                    onAssigned={onBusUpdated}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function DocumentsTab({ bus }: { bus: UIBus }) {
  const [docs, setDocs] = React.useState<BusDocument[]>([])
  const [loading, setLoading] = React.useState(true)
  const [uploadOpen, setUploadOpen] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<number | null>(null)

  React.useEffect(() => {
    busApi.fetchDocuments(bus.id)
      .then((res) => setDocs(res.data))
      .catch(() => toast.error("Impossible de charger les documents."))
      .finally(() => setLoading(false))
  }, [bus.id])

  async function handleUpload(file: File, name: string, type: string, expiresAt: string) {
    const fd = new FormData()
    fd.append("file", file)
    fd.append("name", name)
    fd.append("type", type)
    if (expiresAt) fd.append("expires_at", expiresAt)
    const res = await busApi.uploadDocument(bus.id, fd)
    setDocs((d) => [res.data, ...d])
    toast.success("Document ajouté.")
  }

  async function handleDelete(docId: number) {
    setDeletingId(docId)
    try {
      await busApi.deleteDocument(bus.id, docId)
      setDocs((d) => d.filter((x) => x.id !== docId))
      toast.success("Document supprimé.")
    } catch {
      toast.error("Erreur lors de la suppression.")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Dossier administratif</h3>
          <p className="text-xs text-muted-foreground">Gérez les documents et attestations du véhicule.</p>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="size-3.5 mr-2" /> Ajouter
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Expiration</TableHead>
              <TableHead>Ajouté le</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell>
                </TableRow>
              ))
            ) : docs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  <FileText className="mx-auto mb-2 size-8 text-muted-foreground/40" />
                  Aucun document disponible.
                </TableCell>
              </TableRow>
            ) : (
              docs.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:underline text-sm"
                    >
                      {doc.name}
                    </a>
                    {doc.sizeKb && <span className="ml-1.5 text-xs text-muted-foreground">{doc.sizeKb} Ko</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {doc.type ? (DOC_TYPE_LABELS[doc.type] ?? doc.type) : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {doc.expiresAt ? (
                      <span className={getComplianceStatus(doc.expiresAt) === "expired" ? "text-destructive font-medium text-sm" :
                        getComplianceStatus(doc.expiresAt) === "warning" ? "text-amber-600 font-medium text-sm" : "text-sm"}>
                        {formatDate(doc.expiresAt)}
                      </span>
                    ) : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(doc.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      disabled={deletingId === doc.id}
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} onUpload={handleUpload} />
    </div>
  )
}

function ReservationsTab({ busId }: { busId: string }) {
  const [stats, setStats] = React.useState<BusStats | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    busApi.fetchStats(busId)
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [busId])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!stats) return (
    <p className="text-sm text-muted-foreground py-8 text-center">Impossible de charger les statistiques.</p>
  )

  const statusData = Object.entries(stats.by_status).map(([name, value]) => ({ name, value }))
  const eventData  = Object.entries(stats.by_event).map(([name, value]) => ({ name, value }))

  const statCards = [
    { label: "Total trajets",       value: stats.total_reservations.toString() },
    { label: "Distance cumulée",    value: `${stats.total_distance_km.toLocaleString("fr-FR")} km` },
    { label: "Revenus estimés",     value: `${stats.total_revenue.toLocaleString("fr-FR")} FCFA` },
    { label: "Confirmées",          value: String(stats.by_status["confirmed"] ?? 0) },
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</span>
            <span className="text-lg font-bold">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Charts */}
      {(statusData.length > 0 || eventData.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {statusData.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-5 px-6">
                <CardTitle className="text-sm font-semibold">Répartition par statut</CardTitle>
              </CardHeader>
              <CardContent className="h-52 px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={72} paddingAngle={2}>
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={RESERVATION_STATUS_COLORS[entry.name] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [v, "Réservations"]} />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {eventData.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-5 px-6">
                <CardTitle className="text-sm font-semibold">Par type d'événement</CardTitle>
              </CardHeader>
              <CardContent className="h-52 px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={eventData} margin={{ top: 4, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" name="Réservations" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recent table */}
      {stats.recent.length > 0 && (
        <Card>
          <CardHeader className="pb-3 pt-5 px-6 border-b">
            <CardTitle className="text-sm font-semibold">Réservations récentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead>Réf.</TableHead>
                  <TableHead>Passager</TableHead>
                  <TableHead>Date trajet</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.code ?? r.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{r.passenger_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.trip_date ? new Date(r.trip_date).toLocaleDateString("fr-FR") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{r.status ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {r.price_total.toLocaleString("fr-FR")} FCFA
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ─── Page skeleton ──────────────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 w-full">
      <Skeleton className="h-8 w-28" />
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default function BusDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [bus, setBus] = React.useState<UIBus | null>(null)
  const [people, setPeople] = React.useState<Person[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editOpen, setEditOpen] = React.useState(false)
  const [togglingStatus, setTogglingStatus] = React.useState(false)

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
  const owner = people.find((p) => String(p.id) === String(bus.operatorId)) ?? null

  const tabs = [
    { value: "informations", label: "Informations" },
    { value: "equipage",     label: "Équipage" },
    { value: "documents",    label: "Documents" },
    { value: "reservations", label: "Réservations" },
  ]

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 w-full max-w-7xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1.5" onClick={() => navigate("/buses")}>
          <ArrowLeft className="size-4" /> Bus
        </Button>
        <span>/</span>
        <span className="font-mono font-semibold text-foreground">{bus.plate}</span>
      </div>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 shadow-lg">
        <div className="pointer-events-none absolute -top-14 -right-14 size-56 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-20 right-24 size-64 rounded-full bg-white/[0.03]" />

        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div className="flex items-center gap-5">
            {/* Plate badge */}
            <div className="flex items-stretch h-14 overflow-hidden rounded-lg border border-white/20 bg-white/5 shadow-inner shrink-0">
              <div className="flex items-center justify-center w-8 bg-primary/70">
                <span className="text-[8px] font-black text-primary-foreground leading-none">RC</span>
              </div>
              <div className="flex items-center justify-center px-5">
                <span className="font-mono text-2xl font-black tracking-widest uppercase text-white">{bus.plate}</span>
              </div>
            </div>

            <div>
              <h1 className="text-xl font-bold text-white">
                {[bus.brand, bus.model, bus.year].filter(Boolean).join(" · ") || "Véhicule"}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {bus.type && (
                  <Badge className="bg-white/10 text-white/80 border-transparent hover:bg-white/20 text-xs">
                    {prettyType(bus.type)}
                  </Badge>
                )}
                {bus.energyType && (
                  <Badge className="bg-white/10 text-white/80 border-transparent hover:bg-white/20 text-xs">
                    {ENERGY_LABELS[bus.energyType] ?? bus.energyType}
                  </Badge>
                )}
                <span className="text-white/50 text-xs">·</span>
                <span className="text-white/60 text-xs">{bus.capacity} places</span>
              </div>
            </div>
          </div>

          <Badge
            variant="outline"
            className={`shrink-0 self-start px-3 py-1.5 text-xs font-semibold shadow border ${status.badge}`}
          >
            <span className={`mr-2 inline-block size-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </Badge>
        </div>

        {/* Quick strip */}
        <div className="relative mt-5 flex flex-wrap gap-6 border-t border-white/10 pt-4">
          {[
            { l: "Capacité",  v: `${bus.capacity} pl.` },
            { l: "Propriétaire", v: owner?.name ?? "—" },
            { l: "Kilométrage", v: bus.mileageKm ? `${bus.mileageKm.toLocaleString("fr-FR")} km` : "—" },
            { l: "Assurance",  v: formatDate(bus.insuranceValidUntil) },
          ].map((s) => (
            <div key={s.l}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{s.l}</p>
              <p className="text-sm font-semibold text-white/90">{s.v}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="relative flex items-center gap-3 mt-5">
          <Button size="sm" className="bg-white/10 text-white border border-white/20 hover:bg-white/20" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5 mr-2" /> Modifier
          </Button>
          <Button
            size="sm"
            className={`border border-white/20 ${isActive ? "bg-red-500/20 text-red-300 hover:bg-red-500/30" : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"}`}
            onClick={handleToggleStatus}
            disabled={togglingStatus}
          >
            <Power className="size-3.5 mr-2" />
            {isActive ? "Désactiver" : "Activer"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="informations" className="flex flex-col gap-6">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b bg-transparent p-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-b-transparent px-3 pb-3 pt-2 font-medium text-muted-foreground shadow-none data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="informations" className="mt-0 outline-none">
          <InformationsTab bus={bus} />
        </TabsContent>

        <TabsContent value="equipage" className="mt-0 outline-none">
          <EquipageTab bus={bus} people={people} onBusUpdated={setBus} />
        </TabsContent>

        <TabsContent value="documents" className="mt-0 outline-none">
          <DocumentsTab bus={bus} />
        </TabsContent>

        <TabsContent value="reservations" className="mt-0 outline-none">
          <ReservationsTab busId={bus.id} />
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
