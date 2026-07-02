"use client"

import * as React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeft, MapPin, User, Phone, Mail, Banknote, Bus,
  Pencil, Route, Check, Play, CheckCircle2, X as XIcon, CreditCard, Navigation,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import reservationApi, {
  type UIReservation,
  type ReservationStatus,
  type ReservationPaymentStatus,
} from "@/api/reservation"
import busApi, { type UIBus } from "@/api/bus"
import AddEditReservationDialog from "@/components/reservation/AddEditReservation"
import { PaymentDialog } from "@/components/reservation/PaymentDialog"

/* ─── Configs ──────────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<ReservationStatus, { label: string; badge: string; dot: string }> = {
  pending:     { label: "En attente",  badge: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-500" },
  confirmed:   { label: "Confirmée",   badge: "bg-blue-50 text-blue-700 border-blue-200",          dot: "bg-blue-500" },
  in_progress: { label: "En cours",    badge: "bg-violet-50 text-violet-700 border-violet-200",    dot: "bg-violet-500" },
  completed:   { label: "Terminée",    badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  cancelled:   { label: "Annulée",     badge: "bg-red-50 text-red-700 border-red-200",             dot: "bg-red-500" },
}

const PAYMENT_CONFIG: Record<ReservationPaymentStatus, { label: string; badge: string }> = {
  paid:      { label: "Payé",       badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  pending:   { label: "Impayé",     badge: "bg-amber-50 text-amber-700 border-amber-200" },
  failed:    { label: "Échoué",     badge: "bg-red-50 text-red-700 border-red-200" },
  refunded:  { label: "Remboursé",  badge: "bg-slate-50 text-slate-700 border-slate-200" },
}

const EVENT_LABELS: Record<string, string> = {
  none: "Aucun", school_trip: "Sortie scolaire", university_trip: "Voyage universitaire",
  educational_tour: "Visite pédagogique", student_transport: "Transport d'étudiants",
  wedding: "Mariage", funeral: "Funérailles", birthday: "Anniversaire", baptism: "Baptême",
  family_meeting: "Retrouvailles familiales", conference: "Conférence", seminar: "Séminaire",
  company_trip: "Voyage d'entreprise", business_mission: "Mission professionnelle",
  staff_shuttle: "Navette du personnel", football_match: "Match de football",
  sports_tournament: "Tournoi sportif", concert: "Concert", festival: "Festival",
  school_competition: "Compétition scolaire", tourist_trip: "Voyage touristique",
  group_excursion: "Excursion de groupe", pilgrimage: "Pèlerinage", site_visit: "Visite de site",
  airport_transfer: "Transfert aéroport", election_campaign: "Campagne électorale",
  administrative_mission: "Mission administrative", official_trip: "Voyage officiel",
  private_transport: "Transport privé", special_event: "Événement spécial", simple_rental: "Location simple",
}

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function formatShortDate(iso?: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

function formatCurrency(amount?: number): string {
  if (amount == null) return "—"
  return amount.toLocaleString("fr-FR") + " FCFA"
}

function pruneUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>
}

function serializeForUpdate(r: UIReservation): Partial<UIReservation> {
  const email = r.passenger?.email === "" ? "" : r.passenger?.email ?? undefined
  return pruneUndefined({
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
  })
}

/* ─── Sub-components ───────────────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="flex flex-col w-full gap-6 p-6 lg:p-8">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="w-full h-52 rounded-2xl" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-36" />
          <Skeleton className="h-28" />
        </div>
      </div>
    </div>
  )
}

function InfoCard({ title, icon: Icon, children }: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="px-5 pt-4 pb-3 border-b border-muted/30">
        <CardTitle className="flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-muted-foreground">
          <Icon className="size-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-4 space-y-3">{children}</CardContent>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value || "—"}</span>
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

type StatusDialog = {
  open: boolean
  newStatus: ReservationStatus | null
  title: string
  desc: string
  btnLabel: string
  btnClass: string
}

export default function ReservationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [reservation, setReservation] = React.useState<UIReservation | null>(null)
  const [buses, setBuses] = React.useState<UIBus[]>([])
  const [loading, setLoading] = React.useState(true)
  const [editOpen, setEditOpen] = React.useState(false)
  const [paymentOpen, setPaymentOpen] = React.useState(false)
  const [statusDialog, setStatusDialog] = React.useState<StatusDialog>({
    open: false, newStatus: null, title: "", desc: "", btnLabel: "", btnClass: "",
  })

  const busPlateById = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const b of buses) { if (b?.id) m.set(String(b.id), b.plate ?? String(b.id)) }
    return m
  }, [buses])

  const load = React.useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const [resvRes, busRes] = await Promise.all([
        reservationApi.show(id),
        busApi.list({ per_page: 500 }),
      ])
      setReservation(resvRes.data)
      setBuses(busRes.data.rows)
    } catch {
      toast.error("Impossible de charger la réservation.")
      navigate("/reservations")
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  React.useEffect(() => { load() }, [load])

  const openStatusDialog = (
    newStatus: ReservationStatus,
    title: string,
    desc: string,
    btnLabel: string,
    btnClass: string,
  ) => setStatusDialog({ open: true, newStatus, title, desc, btnLabel, btnClass })

  const handleStatusChange = async () => {
    if (!reservation || !statusDialog.newStatus) return
    const prev = reservation
    const next = statusDialog.newStatus
    setReservation((r) => r ? { ...r, status: next } : r)
    setStatusDialog((d) => ({ ...d, open: false }))
    try {
      await reservationApi.setStatus(reservation.id, next)
      toast.success(`Réservation ${reservation.code} → ${STATUS_CONFIG[next].label}`)
      await load()
    } catch (e: any) {
      setReservation(prev)
      toast.error(e?.message ?? "Échec de la mise à jour du statut.")
    }
  }

  if (loading) return <PageSkeleton />
  if (!reservation) return null

  const r = reservation
  const status = STATUS_CONFIG[r.status]
  const payment = r.paymentStatus ? PAYMENT_CONFIG[r.paymentStatus] : null
  const busPlates = (r.busIds ?? []).map((bid) => busPlateById.get(String(bid)) ?? String(bid))
  const canChangeStatus = !["completed", "cancelled"].includes(r.status)
  const canPay = r.paymentStatus !== "paid" && !["cancelled", "completed"].includes(r.status)

  return (
    <div className="flex flex-col w-full gap-6 p-6 lg:p-8">

      {/* ── Breadcrumb ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/reservations")}
        >
          <ArrowLeft className="size-4" />
          Réservations
        </Button>
        <span>/</span>
        <span className="font-mono font-semibold text-foreground">
          {r.code ?? r.id.slice(0, 8).toUpperCase()}
        </span>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative p-6 overflow-hidden shadow-lg rounded-2xl bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 sm:p-8">
        <div className="absolute rounded-full pointer-events-none -top-12 -right-12 size-52 bg-white/5" />
        <div className="pointer-events-none absolute -bottom-16 right-20 size-60 rounded-full bg-white/[0.03]" />

        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          {/* Route info */}
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 mt-0.5">
              <Route className="size-7 text-white/80" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xl font-bold text-white">{r.route.from}</span>
                <span className="text-white/40">→</span>
                <span className="text-xl font-bold text-white">{r.route.to}</span>
              </div>
              <p className="mt-1.5 text-sm text-white/60">{formatDate(r.tripDate)}</p>
              {r.event && r.event !== "none" && (
                <p className="mt-1 text-xs text-white/50">{EVENT_LABELS[r.event] ?? r.event}</p>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 shrink-0">
            <Badge variant="outline" className={`px-3 py-1.5 text-xs font-semibold ${status.badge}`}>
              <span className={`mr-2 inline-block size-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </Badge>
            {payment && (
              <Badge variant="outline" className={`px-3 py-1.5 text-xs font-semibold ${payment.badge}`}>
                {payment.label}
              </Badge>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="relative flex flex-wrap items-center gap-2 mt-6">
          <Button
            size="sm"
            className="text-white border bg-white/10 border-white/20 hover:bg-white/20"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5 mr-2" />
            Modifier
          </Button>

          {r.status === "pending" && (
            <Button
              size="sm"
              className="border bg-emerald-500/20 text-emerald-300 border-emerald-400/30 hover:bg-emerald-500/30"
              onClick={() => openStatusDialog(
                "confirmed", "Confirmer la réservation",
                `Marquer la réservation ${r.code} (${r.passenger.name}) comme confirmée.`,
                "Confirmer", "bg-emerald-600 hover:bg-emerald-700",
              )}
            >
              <Check className="size-3.5 mr-2" /> Confirmer
            </Button>
          )}

          {r.status === "confirmed" && (
            <Button
              size="sm"
              className="text-blue-300 border bg-blue-500/20 border-blue-400/30 hover:bg-blue-500/30"
              onClick={() => openStatusDialog(
                "in_progress", "Démarrer le voyage",
                `Indiquer que le voyage pour ${r.code} a commencé.`,
                "Démarrer", "bg-blue-600 hover:bg-blue-700",
              )}
            >
              <Play className="size-3.5 mr-2" /> Démarrer
            </Button>
          )}

          {r.status === "in_progress" && (
            <Button
              size="sm"
              className="border bg-violet-500/20 text-violet-300 border-violet-400/30 hover:bg-violet-500/30"
              onClick={() => openStatusDialog(
                "completed", "Terminer le voyage",
                `Marquer le voyage ${r.code} comme terminé. Assurez-vous que tous les passagers sont arrivés.`,
                "Terminer", "bg-emerald-600 hover:bg-emerald-700",
              )}
            >
              <CheckCircle2 className="size-3.5 mr-2" /> Terminer
            </Button>
          )}

          {canChangeStatus && (
            <Button
              size="sm"
              className="text-red-300 border bg-red-500/20 border-red-400/30 hover:bg-red-500/30"
              onClick={() => openStatusDialog(
                "cancelled", "Annuler la réservation",
                `Annuler ${r.code} (${r.passenger.name}). Les bus seront remis en disponibilité. Cette action est irréversible.`,
                "Annuler", "bg-red-600 hover:bg-red-700",
              )}
            >
              <XIcon className="size-3.5 mr-2" /> Annuler
            </Button>
          )}

          {canPay && (
            <Button
              size="sm"
              className="border bg-amber-500/20 text-amber-300 border-amber-400/30 hover:bg-amber-500/30"
              onClick={() => setPaymentOpen(true)}
            >
              <CreditCard className="size-3.5 mr-2" /> Encaisser
            </Button>
          )}
        </div>
      </div>

      {/* ── Quick Stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Places",       value: `${r.seats} place${r.seats > 1 ? "s" : ""}` },
          { label: "Montant",      value: formatCurrency(r.priceTotal) },
          { label: "Distance",     value: r.distanceKm ? `${r.distanceKm} km` : "—" },
          { label: "Bus assigné(s)", value: busPlates.length ? busPlates.join(", ") : "Aucun" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
            <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground">{s.label}</span>
            <span className="text-sm font-bold truncate text-foreground">{s.value}</span>
          </div>
        ))}
      </div>

      <Separator />

      {/* ── Main grid ────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Left column (2/3) */}
        <div className="space-y-4 lg:col-span-2">

          {/* Passager */}
          <InfoCard title="Passager" icon={User}>
            <InfoRow label="Nom" value={r.passenger.name || "—"} />
            <InfoRow
              label="Téléphone"
              value={r.passenger.phone ? (
                <a href={`tel:${r.passenger.phone}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Phone className="size-3.5" /> {r.passenger.phone}
                </a>
              ) : null}
            />
            <InfoRow
              label="Email"
              value={r.passenger.email ? (
                <a href={`mailto:${r.passenger.email}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Mail className="size-3.5" /> {r.passenger.email}
                </a>
              ) : null}
            />
          </InfoCard>

          {/* Trajet */}
          <InfoCard title="Trajet" icon={MapPin}>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Départ" value={r.route.from} />
              <InfoRow label="Arrivée" value={r.route.to} />
              <InfoRow label="Date du voyage" value={formatDate(r.tripDate)} />
              {r.distanceKm > 0 && <InfoRow label="Distance" value={`${r.distanceKm} km`} />}
              {r.event && r.event !== "none" && (
                <InfoRow label="Événement" value={EVENT_LABELS[r.event] ?? r.event} />
              )}
            </div>

            {/* Waypoints */}
            {(r.waypoints ?? []).length > 0 && (
              <>
                <Separator className="my-1" />
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Étapes intermédiaires</p>
                  <ol className="space-y-1.5">
                    {r.waypoints!.map((wp, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Navigation className="size-3 shrink-0 text-muted-foreground" />
                        <span>{wp.label || `${wp.lat}, ${wp.lng}`}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}
          </InfoCard>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-4">

          {/* Finances */}
          <InfoCard title="Finances" icon={Banknote}>
            <InfoRow label="Montant total" value={formatCurrency(r.priceTotal)} />
            <InfoRow label="Statut paiement" value={payment ? (
              <Badge variant="outline" className={`text-xs ${payment.badge}`}>{payment.label}</Badge>
            ) : "—"} />
            <InfoRow label="Places réservées" value={`${r.seats}`} />
          </InfoCard>

          {/* Bus assigné(s) */}
          <InfoCard title="Bus assigné(s)" icon={Bus}>
            {busPlates.length > 0 ? (
              busPlates.map((plate, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div className="flex items-center justify-center rounded size-7 shrink-0 bg-muted">
                    <Bus className="size-3.5 text-muted-foreground" />
                  </div>
                  <span className="font-mono font-semibold">{plate}</span>
                </div>
              ))
            ) : (
              <p className="text-sm italic text-muted-foreground">Aucun bus assigné</p>
            )}
          </InfoCard>

          {/* Meta */}
          <div className="rounded-xl border bg-muted/30 px-4 py-3 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Informations</p>
            <p className="text-xs text-muted-foreground">
              Créée le <span className="font-medium text-foreground">{formatShortDate(r.createdAt)}</span>
            </p>
            <p className="font-mono text-xs truncate text-muted-foreground/60">{r.id}</p>
          </div>
        </div>
      </div>

      {/* ── Dialogs ──────────────────────────────────────────────────── */}

      <AddEditReservationDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={r}
        trips={[]}
        buses={buses as unknown as any[]}
        onSubmit={async (updated) => {
          try {
            const payload = serializeForUpdate(updated)
            const res = await reservationApi.update(r.id, payload)
            setReservation(res.data)
            toast.success("Réservation mise à jour.")
            setEditOpen(false)
          } catch (e: any) {
            toast.error(e?.message ?? "Échec de la mise à jour.")
          }
        }}
      />

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        reservation={r}
        onSuccess={() => { load(); setPaymentOpen(false) }}
      />

      <AlertDialog open={statusDialog.open} onOpenChange={(v) => setStatusDialog((d) => ({ ...d, open: v }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{statusDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{statusDialog.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction
              className={`cursor-pointer ${statusDialog.btnClass}`}
              onClick={handleStatusChange}
            >
              {statusDialog.btnLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
