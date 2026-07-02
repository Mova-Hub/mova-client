import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft,
  Pencil,
  FileText,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  UserCircle,
  Phone,
  Mail,
  Upload,
  Trash2,
  ShieldCheck,
  Fuel,
  CarFront,
  Fingerprint
} from "lucide-react"

import type { UIBus } from "@/api/bus"
import type { Person } from "@/api/people"

/* ----------- Types & Helpers ----------- */

// On étend le type pour inclure les nouveaux champs
export type ExtendedBus = UIBus & {
  brand?: string
  energy?: string
  chassisNumber?: string
  insuranceExpiry?: string
  inspectionDue?: string
}

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
  if (!t) return "Non défini"
  const k = t.toLowerCase()
  return TYPE_LABELS[k] ?? k.replace(/[_-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
}

function formatDate(iso?: string | null): string {
  if (!iso) return "Non défini"
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function getComplianceStatus(date?: string | null): "ok" | "warning" | "expired" | "none" {
  if (!date) return "none"
  const days = Math.floor((new Date(date).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return "expired"
  if (days <= 30) return "warning"
  return "ok"
}

/* ----------- Sous-composants UI ----------- */

function ComplianceCard({ label, date }: { label: string; date?: string | null }) {
  const s = getComplianceStatus(date)
  const bg = s === "expired" ? "bg-destructive/10 border-destructive/20" :
             s === "warning" ? "bg-amber-50 border-amber-200" :
             s === "ok"      ? "bg-emerald-50 border-emerald-200" :
                               "bg-muted/30 border-border"
  const Icon = s === "expired" ? XCircle :
               s === "warning" ? AlertTriangle :
               s === "ok"      ? CheckCircle2 : null
  const textColor = s === "expired" ? "text-destructive" :
                    s === "warning" ? "text-amber-700" :
                    s === "ok"      ? "text-emerald-700" : "text-muted-foreground"

  return (
    <div className={`rounded-lg border p-3 ${bg} transition-colors`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-semibold">{label}</p>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className={`size-4 shrink-0 ${textColor}`} />}
        <span className={`text-sm font-medium ${s === "none" ? "text-muted-foreground/60 text-xs" : textColor}`}>
          {formatDate(date)}
        </span>
      </div>
    </div>
  )
}

function DataRow({ label, value, isMono = false }: { label: string, value?: React.ReactNode, isMono?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={`text-sm text-foreground ${isMono ? "font-mono font-semibold tracking-wide" : "font-medium"}`}>
        {value || "—"}
      </dd>
    </div>
  )
}

/* ----------- Onglets ----------- */

function DocumentsTab({ busId }: { busId: string }) {
  // Remplacer par votre vrai hook (ex: useQuery)
  const isLoading = false
  const docs = [
    { id: 1, label: "Assurance RC", type: "Assurance", expiry: "2026-12-31", date: "2025-01-15" },
    { id: 2, label: "Contrôle Technique", type: "Visite", expiry: "2026-08-15", date: "2025-02-10" },
  ]

  return (
    <div className="flex flex-col gap-4 duration-500 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Dossier administratif</h3>
          <p className="text-xs text-muted-foreground">Gérez les documents et attestations du véhicule.</p>
        </div>
        <Button size="sm"><Upload className="size-3.5 mr-2" /> Ajouter un document</Button>
      </div>
      
      <div className="overflow-hidden border rounded-lg bg-card">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Expiration</TableHead>
              <TableHead>Ajouté le</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}><Skeleton className="w-full h-10" /></TableCell></TableRow>
            ) : docs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-sm text-center text-muted-foreground">
                  Aucun document disponible.
                </TableCell>
              </TableRow>
            ) : docs.map(doc => (
              <TableRow key={doc.id} className="hover:bg-muted/10">
                <TableCell className="flex items-center gap-2 font-medium">
                  <FileText className="size-4 text-primary" /> {doc.label}
                </TableCell>
                <TableCell><Badge variant="outline" className="text-xs font-normal">{doc.type}</Badge></TableCell>
                <TableCell><ComplianceCard label="" date={doc.expiry} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(doc.date)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10">
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function EquipageTab({ driver, conductor }: { driver: Person | null, conductor: Person | null }) {
  const renderMember = (role: string, person: Person | null) => (
    <Card className="transition-colors shadow-sm border-muted/60 hover:border-primary/20">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex items-center justify-center border rounded-full size-12 bg-primary/10 border-primary/20 shrink-0">
          <UserCircle className="size-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{role}</p>
          <p className="text-sm font-medium truncate text-foreground">{person ? person.name : "Non assigné"}</p>
          {person?.phone && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Phone className="size-3" /> {person.phone}
            </p>
          )}
        </div>
        <Button variant="secondary" size="sm" className="text-xs">
          {person ? "Remplacer" : "Assigner"}
        </Button>
      </CardContent>
    </Card>
  )

  return (
    <div className="flex flex-col gap-4 duration-500 animate-in fade-in">
       <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Équipe active</h3>
          <p className="text-xs text-muted-foreground">Personnel actuellement affecté à ce bus.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {renderMember("Chauffeur Principal", driver)}
        {renderMember("Receveur / Convoyeur", conductor)}
      </div>
    </div>
  )
}

/* ----------- Page Principale ----------- */

export function BusDetails({ bus, people }: { bus: ExtendedBus; people: Person[] }) {
  const getPerson = (id?: string | null) => people.find(p => String(p.id) === String(id)) || null
  const status = STATUS_CONFIG[bus.status ?? "inactive"]

  const owner = getPerson(bus.operatorId)
  const driver = getPerson(bus.assignedDriverId)
  const conductor = getPerson(bus.assignedConductorId)

  return (
    <div className="flex flex-col w-full gap-6 px-4 py-6 mx-auto lg:px-8 max-w-7xl">
      
      {/* ── En-tête de page ──────────────────────────────────────────────────── */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="size-9 shrink-0">
            <ArrowLeft className="size-4 text-muted-foreground" />
          </Button>
          
          <div className="flex items-center flex-1 min-w-0 gap-4">
            {/* Plaque d'immatriculation stylisée */}
            <div className="flex items-stretch h-10 overflow-hidden border-2 rounded-md shadow-sm border-slate-800 bg-slate-50">
              <div className="flex flex-col items-center justify-center w-5 bg-primary text-primary-foreground shrink-0">
                <span className="text-[7px] font-bold">RC</span>
              </div>
              <div className="flex items-center justify-center px-4">
                <span className="font-mono text-xl font-black tracking-widest uppercase text-slate-900">
                  {bus.plate}
                </span>
              </div>
            </div>

            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-foreground">
                {bus.brand || "Véhicule"} {bus.model || ""}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">ID: {bus.id}</span>
                <span className="text-muted-foreground text-[10px]">•</span>
                <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                  {prettyType(bus.type)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Badge variant="outline" className={`px-2.5 py-1 text-xs font-medium shadow-sm ${status.badge}`}>
            <span className={`size-1.5 rounded-full mr-2 ${status.dot}`} />
            {status.label}
          </Badge>
          <Button size="sm" className="h-9">
            <Pencil className="size-3.5 mr-2" /> Éditer
          </Button>
        </div>
      </div>

      {/* ── Grille de vue d'ensemble ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Colonne Principale (Prend 2 colonnes) */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="shadow-sm border-muted/60">
            <CardHeader className="px-6 pt-5 pb-3 border-b border-muted/30">
              <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-muted-foreground">
                <CarFront className="size-4 text-primary" /> Spécifications Techniques
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-5">
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
                <DataRow label="Marque" value={bus.brand} />
                <DataRow label="Modèle" value={bus.model} />
                <DataRow label="Énergie" value={bus.energy} />
                <DataRow label="Capacité" value={bus.capacity ? `${bus.capacity} places` : null} />
                <div className="col-span-2 md:col-span-4">
                  <DataRow label="Numéro de Châssis (VIN)" value={bus.chassisNumber} isMono />
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Profil Propriétaire intégré discrètement */}
          <Card className="relative overflow-hidden shadow-sm border-muted/60">
            {/* Liseret de couleur à gauche */}
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-primary/40"></div>
            <CardContent className="p-0">
              <div className="flex items-center gap-5 p-5">
                <div className="flex items-center justify-center border rounded-full size-14 bg-muted border-border">
                  <UserCircle className="size-8 text-muted-foreground/50" />
                </div>
                <div className="grid flex-1 grid-cols-2 gap-4">
                  <div>
                    <p className="mb-1 text-xs font-semibold tracking-wide uppercase text-muted-foreground">Propriétaire / Opérateur</p>
                    <p className="font-semibold text-foreground">{owner ? owner.name : "Non renseigné"}</p>
                  </div>
                  <div className="flex flex-col justify-center gap-1.5">
                    {owner?.phone && <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="size-3" /> {owner.phone}</span>}
                    {owner?.email && <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="size-3" /> {owner.email}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-xs"><Pencil className="size-3.5 mr-1.5"/> Gérer</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Colonne Latérale : Conformité */}
        <div className="space-y-6">
          <Card className="h-full shadow-sm border-muted/60">
            <CardHeader className="px-6 pt-5 pb-3 border-b border-muted/30">
              <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" /> État de Conformité
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 py-5 space-y-3">
              <ComplianceCard label="Assurance Véhicule" date={bus.insuranceExpiry} />
              <ComplianceCard label="Contrôle Technique" date={bus.inspectionDue} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator className="my-2" />

      {/* ── Navigation par Onglets ─────────────────────────────────────────── */}
      <Tabs defaultValue="documents" className="flex flex-col gap-6">
        <TabsList className="justify-start w-full h-auto gap-6 p-0 bg-transparent border-b rounded-none border-border">
          <TabsTrigger
            value="documents"
            className="rounded-none border-b-2 border-b-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
          >
            Documents
          </TabsTrigger>
          <TabsTrigger
            value="equipage"
            className="rounded-none border-b-2 border-b-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground data-[state=active]:border-b-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
          >
            Équipage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-0 outline-none">
          <DocumentsTab busId={bus.id} />
        </TabsContent>
        
        <TabsContent value="equipage" className="mt-0 outline-none">
          <EquipageTab driver={driver} conductor={conductor} />
        </TabsContent>
      </Tabs>
      
    </div>
  )
}