// src/pages/Reservations.tsx
"use client"

import * as React from "react"
import { IconPencil, IconTrash, IconCash } from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { makeDrawerTriggerColumn } from "@/components/data-table-helpers"
import type { FilterConfig, GroupByConfig } from "@/components/data-table"

import ImportDialog from "@/components/common/ImportDialog"
import AddEditReservationDialog from "@/components/reservation/AddEditReservation"
import { PaymentDialog } from "@/components/reservation/PaymentDialog"

import reservationApi, { type UIReservation, type ReservationStatus, type ReservationPaymentStatus } from "@/api/reservation"
import busApi, { type UIBus } from "@/api/bus"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { MapIcon } from "lucide-react"

/* ------------------------------- i18n helpers ------------------------------ */

type EventType = string 

const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  cancelled: "Annulée",
}

const PAYMENT_LABELS: Record<ReservationPaymentStatus, string> = {
  paid: "Payé",
  pending: "Impayé",
  failed: "Échoué",
  refunded: "Remboursé",
}

const EVENT_LABELS: Record<string, string> = {
  none: "Aucun",
  school_trip: "Sortie scolaire",
  university_trip: "Voyage universitaire",
  educational_tour: "Visite pédagogique",
  student_transport: "Transport d’étudiants",
  wedding: "Mariage",
  funeral: "Funérailles",
  birthday: "Anniversaire",
  baptism: "Baptême",
  family_meeting: "Retrouvailles familiales",
  conference: "Conférence",
  seminar: "Séminaire",
  company_trip: "Voyage d’entreprise",
  business_mission: "Mission professionnelle",
  staff_shuttle: "Navette du personnel",
  football_match: "Match de football",
  sports_tournament: "Tournoi sportif",
  concert: "Concert",
  festival: "Festival",
  school_competition: "Compétition scolaire",
  tourist_trip: "Voyage touristique",
  group_excursion: "Excursion de groupe",
  pilgrimage: "Pèlerinage",
  site_visit: "Visite de site",
  airport_transfer: "Transfert aéroport",
  election_campaign: "Campagne électorale",
  administrative_mission: "Mission administrative",
  official_trip: "Voyage officiel",
  private_transport: "Transport privé",
  special_event: "Événement spécial",
  simple_rental: "Location simple",
}

const frStatus = (s?: ReservationStatus | null) => (s ? (STATUS_LABELS[s] ?? s) : "—")
const frEvent = (e?: string | null) => (e ? (EVENT_LABELS[e] ?? e) : "—")
const frPayment = (p?: ReservationPaymentStatus | null) => p ? (PAYMENT_LABELS[p] ?? p) : "—"

/* ------------------------------- date utils -------------------------------- */

function parseSmartDate(input?: string): Date | null {
  if (!input) return null
  const s = input.trim()
  if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s.replace("T", " "))
  return isNaN(d.getTime()) ? null : d
}

const fmtMoney = (v?: number) => (typeof v === "number" ? `${v.toLocaleString("fr-FR")} FCFA` : "—")

const friendlyDateTime = (iso?: string) => {
  const d = parseSmartDate(iso)
  if (!d) return "—"
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(d)
}

const dateHeaderLabel = (iso?: string) => {
  const d = parseSmartDate(iso)
  if (!d) return "—"
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

const shortDatetime = (iso?: string) => {
  const d = parseSmartDate(iso)
  if (!d) return "—"
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(d)
}

/* ------------------------------- update helpers ------------------------------ */

function pruneUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}

function serializeReservationForUpdate(r: UIReservation): Partial<UIReservation> {
  const email = r.passenger?.email === "" ? "" : r.passenger?.email ?? undefined
  const out: Partial<UIReservation> = {
    code: r.code ?? undefined,
    tripDate: r.tripDate ?? undefined,
    route: r.route ?? undefined,
    passenger: r.passenger ? { name: r.passenger.name ?? "", phone: r.passenger.phone ?? "", email } : undefined,
    seats: r.seats ?? undefined,
    priceTotal: r.priceTotal ?? undefined,
    status: r.status ?? undefined,
    event: r.event ?? undefined,
    waypoints: r.waypoints ?? undefined,
    distanceKm: r.distanceKm ?? undefined,
    busIds: r.busIds ?? undefined,
  }
  return pruneUndefined(out)
}

/* --------------------------------- Page ----------------------------------- */

export default function ReservationPage() {
  const [rows, setRows] = React.useState<UIReservation[]>([])
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<UIReservation | null>(null)
  
  // Payment Dialog State
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [paymentTarget, setPaymentTarget] = React.useState<UIReservation | null>(null)

  const [openImport, setOpenImport] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [buses, setBuses] = React.useState<UIBus[]>([])

  const reload = React.useCallback(async () => {
    try {
      setLoading(true)
      const [resvRes, busRes] = await Promise.all([
        reservationApi.list({ with: ["buses"], per_page: 100 }),
        busApi.list({ per_page: 500 }),
      ])
      setRows(resvRes.data.rows)
      setBuses(busRes.data.rows)
    } catch (e: any) {
      toast.error(e?.message ?? "Échec du chargement des réservations.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { reload() }, [reload])

  const rowsSorted = React.useMemo(() => {
    const by = (x?: string) => (x ? parseSmartDate(x)?.getTime() ?? 0 : 0)
    return [...rows].sort((a, b) => by(b.createdAt) - by(a.createdAt))
  }, [rows])

  const busPlateById = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const b of buses) {
      if (!b?.id) continue
      m.set(String(b.id), b.plate ?? String(b.id))
    }
    return m
  }, [buses])

  const searchable = {
    placeholder: "Rechercher code, passager, téléphone, départ, arrivée…",
    fields: ["code", "passenger.name", "passenger.phone", "route.from", "route.to"] as (keyof UIReservation)[],
  }

  const statusOptions = (Object.keys(STATUS_LABELS) as ReservationStatus[]).map(v => ({ label: STATUS_LABELS[v], value: v }))
  const eventOptions = (Object.entries(EVENT_LABELS) as [string, string][]).map(([value, label]) => ({ value, label }))

  const filters: FilterConfig<UIReservation>[] = [
    { id: "status", label: "Statut réservation", options: statusOptions, accessor: (r) => r.status ?? "", defaultValue: "" },
    { id: "event", label: "Événement", options: eventOptions, accessor: (r) => r.event ?? "", defaultValue: "" },
    {
      id: "payment",
      label: "Paiement",
      options: [
        { label: PAYMENT_LABELS.paid, value: "paid" },
        { label: PAYMENT_LABELS.pending, value: "pending" },
        { label: PAYMENT_LABELS.failed, value: "failed" },
        { label: PAYMENT_LABELS.refunded, value: "refunded" },
      ],
      accessor: (r) => r.paymentStatus ?? "pending",
      defaultValue: "",
    },
  ]

  const columns = React.useMemo<ColumnDef<UIReservation>[]>(() => [
    makeDrawerTriggerColumn<UIReservation>("code", {
      triggerField: "code",
      renderTitle: (r) => r.code,
      renderBody: (r) => {
        const busPlates = (r.busIds ?? []).map((id) => busPlateById.get(String(id)) ?? String(id))
        const dist = r.distanceKm
        return (
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Statut :</span>
              <Badge variant="outline" className="px-1.5 capitalize">{frStatus(r.status)}</Badge>
            </div>
            {!!r.event && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Événement :</span>
                <Badge variant="outline" className="px-1.5">{frEvent(r.event)}</Badge>
              </div>
            )}
            <div className="grid gap-1">
              <span className="text-muted-foreground">Passager</span>
              <div>Nom : {r.passenger?.name ?? "—"}</div>
              <div>Tél. : {r.passenger?.phone ?? "—"}</div>
              <div>Email : {r.passenger?.email ?? "—"}</div>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">Trajet</span>
              <div>{r.route?.from ?? "—"} → {r.route?.to ?? "—"}</div>
              <div> Date : {friendlyDateTime(r.tripDate)} </div>
              {!!dist && <div>Distance : {dist.toLocaleString("fr-FR")} km</div>}
            </div>
            <div className="grid gap-1">
              <div>Sièges : {r.seats ?? "—"}</div>
              <div>Total : {fmtMoney(r.priceTotal)}</div>
              <div>Bus : {busPlates.length ? busPlates.join(", ") : "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Paiement :</span>
              <Badge variant="outline" className={
                  r.paymentStatus === 'paid' ? "border-emerald-500 text-emerald-600 bg-emerald-50" : 
                  r.paymentStatus === 'failed' ? "border-red-500 text-red-600 bg-red-50" : ""
              }>
                  {frPayment(r.paymentStatus)}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">Créée le {shortDatetime(r.createdAt)}</div>
          </div>
        )
      },
    }),

    { id: "tripDate", header: "Date", cell: ({ row }) => friendlyDateTime(row.original.tripDate) },
    { id: "passenger", header: "Passager", cell: ({ row }) => (
        <div className="max-w-[240px] truncate">
          {row.original.passenger?.name ?? "—"}
          <div className="text-xs text-muted-foreground">{row.original.passenger?.phone ?? "—"}</div>
        </div>
      ), enableSorting: false },
    { id: "route", header: "Itinéraire", cell: ({ row }) => (
        <span className="block max-w-[260px] truncate">{row.original.route?.from ?? "—"} → {row.original.route?.to ?? "—"}</span>
      ), enableSorting: false },
    { accessorKey: "seats", header: () => <div className="w-full text-right">Sièges</div>, cell: ({ row }) => <div className="w-full text-right">{row.original.seats ?? "—"}</div> },
    { id: "buses", header: "Bus", cell: ({ row }) => {
        const plates = (row.original.busIds ?? []).map((id) => busPlateById.get(String(id)) ?? String(id))
        return <div className="max-w-[260px] truncate text-right">{plates.length ? plates.join(", ") : "—"}</div>
      }, enableSorting: false },
    { accessorKey: "event", header: "Événement", cell: ({ row }) => <Badge variant="outline" className="px-1.5">{frEvent(row.original.event)}</Badge> },
    { id: "total", header: () => <div className="w-full text-right">Total</div>, cell: ({ row }) => <div className="w-full text-right">{fmtMoney(row.original.priceTotal)}</div> },
    { accessorKey: "status", header: "Statut", cell: ({ row }) => <Badge variant="outline" className="px-1.5 capitalize">{frStatus(row.original.status)}</Badge> },
    
    // Updated Payment Column
    { 
        accessorKey: "paymentStatus", 
        header: "Paiement",
        cell: ({ row }) => {
            const s = row.original.paymentStatus
            const color = s === 'paid' ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                          s === 'failed' ? "bg-red-100 text-red-800 border-red-200" : 
                          "bg-amber-50 text-amber-800 border-amber-200"
            return <Badge variant="outline" className={`px-1.5 capitalize border ${color}`}>{frPayment(s)}</Badge> 
        }
    },
  ], [busPlateById])

  const groupBy: GroupByConfig<UIReservation>[] = [
    { id: "date", label: "Date", accessor: (r) => dateHeaderLabel(r.tripDate) },
    { id: "client", label: "Clients", accessor: (r) => r.passenger?.name ?? "—" },
    { id: "event", label: "Événements", accessor: (r) => frEvent(r.event) },
  ]

  function renderRowActions(r: UIReservation) {
    const isCancelled = r.status === "cancelled"
    return (
      <>
        <DropdownMenuItem onClick={() => { setEditing(r); setOpen(true) }}>Modifier</DropdownMenuItem>
        
        {/* Encaisser (Hidden if Paid or Cancelled) */}
        {r.paymentStatus !== 'paid' && !isCancelled && (
            <DropdownMenuItem onClick={() => { setPaymentTarget(r); setPaymentOpen(true) }}>
                <IconCash className="w-4 h-4 mr-2 text-emerald-600" /> Encaisser
            </DropdownMenuItem>
        )}

        {r.paymentStatus !== 'paid' && !isCancelled && (
          <DropdownMenuItem onClick={async () => {
            const prev = rows
            setRows((xs) => xs.map((x) => (x.id === r.id ? { ...x, status: "cancelled" } : x)))
            try {
              await reservationApi.setStatus(r.id, "cancelled")
              toast("Réservation annulée")
              await reload()
            } catch (e: any) {
              setRows(prev)
              toast.error(e?.message ?? "Échec de l’annulation.")
            }
          }}>Annuler
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />

        {/* <DropdownMenuItem className="text-rose-600" onClick={async () => {
          const prev = rows
          setRows((xs) => xs.filter((x) => x.id !== r.id))
          try {
            await reservationApi.remove(r.id)
            toast("Réservation supprimée")
            await reload()
          } catch (e: any) {
            setRows(prev)
            toast.error(e?.message ?? "Échec de la suppression.")
          }
        }}>Supprimer
        </DropdownMenuItem> */}
      </>
    )
  }

  const getRowId = (r: UIReservation) => String(r.id)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Réservations</h1>
          <p className="text-sm text-muted-foreground">Suivez les réservations, paiements et voyages planifiés.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/map/reservations"><MapIcon className="mr-2 h-4 w-4" />Vue carte</Link>
        </Button>
      </div>

      <DataTable<UIReservation>
        data={rowsSorted}
        columns={columns}
        getRowId={getRowId}
        searchable={searchable}
        filters={filters}
        loading={loading}
        onAdd={() => { setEditing(null); setOpen(true) }}
        addLabel="Ajouter"
        onImport={() => setOpenImport(true)}
        importLabel="Importer"
        renderRowActions={renderRowActions}
        groupBy={groupBy}
        initialView="list"
        pageSizeOptions={[10, 20, 50]}
        onDeleteSelected={async (selected) => {
          if (selected.length === 0) return
          const prev = rows
          setRows((xs) => xs.filter((x) => !selected.some((s) => s.id === x.id)))
          try {
            await Promise.all(selected.map((s) => reservationApi.remove(s.id)))
            await reload()
            toast(`${selected.length} réservation(s) supprimée(s).`)
          } catch (e: any) {
            setRows(prev)
            toast.error("Échec sur la suppression groupée.")
          }
        }}
      />

      <AddEditReservationDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSubmit={async (res) => {
          if (editing) {
            const prev = rows
            setRows((xs) => xs.map((x) => (x.id === res.id ? { ...x, ...res } : x)))
            try {
              const payload = serializeReservationForUpdate(res)
              const apiRes = await reservationApi.update(res.id, payload)
              setRows((xs) => xs.map((x) => (x.id === res.id ? apiRes.data : x)))
              toast("Réservation mise à jour.")
              await reload()
            } catch (e: any) {
              setRows(prev)
              toast.error(e?.message ?? "Échec de la mise à jour.")
            } finally {
              setEditing(null)
            }
          } else {
            const tempId = res.id
            setRows((xs) => [res, ...xs])
            try {
              const apiRes = await reservationApi.create(res)
              setRows((xs) => xs.map((x) => (x.id === tempId ? apiRes.data : x)))
              toast("Réservation ajoutée.")
              await reload()
            } catch (e: any) {
              setRows((xs) => xs.filter((x) => x.id !== tempId))
              toast.error(e?.message ?? "Échec de la création.")
            }
          }
        }}
        trips={[]}
        buses={buses as unknown as any[]}
      />

      {/* Manual Payment Dialog */}
      <PaymentDialog 
        open={paymentOpen} 
        onOpenChange={setPaymentOpen}
        reservation={paymentTarget}
        onSuccess={() => {
            reload()
            setPaymentTarget(null)
        }}
      />

      <ImportDialog<UIReservation>
        open={openImport}
        onOpenChange={setOpenImport}
        title="Importer des réservations"
        description="Chargez un CSV/Excel, mappez les colonnes, puis validez l'import."
        fields={[
          { key: "code", label: "Code" },
          { key: "tripDate", label: "Date du trajet", required: true },
          { key: "route.from", label: "Départ", required: true },
          { key: "route.to", label: "Arrivée", required: true },
          { key: "passenger.name", label: "Passager · Nom", required: true },
          { key: "passenger.phone", label: "Passager · Téléphone", required: true },
          { key: "passenger.email", label: "Passager · Email" },
          { key: "seats", label: "Sièges", required: true },
          { key: "busIds", label: "Bus IDs (uuid,uuid,…)" },
          { key: "priceTotal", label: "Total (FCFA)" },
          { key: "status", label: "Statut (pending/confirmed/cancelled)" },
        ]}
        sampleHeaders={["code","tripDate","from","to","passenger_name","passenger_phone","passenger_email","seats","busIds","priceTotal","status"]}
        transform={(raw) => {
          const g = (k: string) => {
            switch (k) {
              case "route.from": return raw["route.from"] ?? raw["from"]
              case "route.to": return raw["route.to"] ?? raw["to"]
              case "passenger.name": return raw["passenger.name"] ?? raw["passenger_name"]
              case "passenger.phone": return raw["passenger.phone"] ?? raw["passenger_phone"]
              case "passenger.email": return raw["passenger.email"] ?? raw["passenger_email"]
              default: return raw[k]
            }
          }
          const code = String((raw.code ?? "") || `BZV-${String(Math.floor(Math.random()*1e6)).padStart(6,"0")}`)
          const tripDate = String(g("tripDate") ?? "").trim()
          const from = String(g("route.from") ?? "").trim()
          const to = String(g("route.to") ?? "").trim()
          const name = String(g("passenger.name") ?? "").trim()
          const phone = String(g("passenger.phone") ?? "").trim()
          const email = (g("passenger.email") ? String(g("passenger.email")).trim() : undefined) as string | undefined
          if (!tripDate || !from || !to || !name || !phone) return null
          const seatsNum = Number(raw.seats ?? 1)
          const totalNum = Number(raw.priceTotal ?? 0)
          let status = String(raw.status ?? "pending").toLowerCase()
          if (!["pending", "confirmed", "cancelled"].includes(status)) status = "pending"
          const busIdsVal = raw.busIds ? String(raw.busIds).split(",").map((s: string) => s.trim()).filter(Boolean) : []
          return {
            id: crypto.randomUUID(),
            code,
            tripDate,
            route: { from, to },
            passenger: { name, phone, email },
            seats: isNaN(seatsNum) ? 1 : seatsNum,
            busIds: busIdsVal,
            priceTotal: isNaN(totalNum) ? 0 : totalNum,
            status: status as ReservationStatus,
            paymentStatus: "pending",
            event: "none",
            waypoints: [],
            distanceKm: 0,
            createdAt: new Date().toISOString(),
          } as UIReservation
        }}
        onConfirm={async (imported) => {
          const prev = rows
          setRows((xs) => [...imported, ...xs])
          try {
            const created = await Promise.all(imported.map((r) => reservationApi.create(r).then((x) => x.data)))
            setRows((xs) => {
              const withoutTemps = xs.filter((x) => !imported.some((t) => t.id === x.id)) // rough check
              return [...created, ...withoutTemps]
            })
            await reload()
            toast.success(`Import réussi.`)
          } catch (e: any) {
            setRows(prev)
            toast.error("Échec de l'import.")
          }
        }}
      />
    </div>
  )
}