import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { IconArrowRight } from "@tabler/icons-react"
import type { UIReservation, ReservationStatus, ReservationPaymentStatus } from "@/api/reservation"

/* ----------- label/color helpers ----------- */

const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "En attente", confirmed: "Confirmée",
  in_progress: "En cours", completed: "Terminée", cancelled: "Annulée",
}
const STATUS_COLORS: Record<ReservationStatus, string> = {
  pending:     "border-amber-400 text-amber-700 bg-amber-50",
  confirmed:   "border-primary text-primary-foreground bg-primary/10",
  in_progress: "border-indigo-400 text-indigo-700 bg-indigo-50",
  completed:   "border-emerald-400 text-emerald-700 bg-emerald-50",
  cancelled:   "border-red-400 text-red-700 bg-red-50",
}
const PAYMENT_LABELS: Record<ReservationPaymentStatus, string> = {
  paid: "Payé", pending: "Impayé", failed: "Échoué", refunded: "Remboursé",
}
const PAYMENT_COLORS: Record<ReservationPaymentStatus, string> = {
  paid:     "border-emerald-400 text-emerald-700 bg-emerald-50",
  pending:  "border-amber-400 text-amber-700 bg-amber-50",
  failed:   "border-red-400 text-red-700 bg-red-50",
  refunded: "border-blue-400 text-blue-700 bg-blue-50",
}
const EVENT_LABELS: Record<string, string> = {
  none: "Aucun", school_trip: "Sortie scolaire", university_trip: "Voyage universitaire",
  educational_tour: "Visite pédagogique", student_transport: "Transport d'étudiants",
  wedding: "Mariage", funeral: "Funérailles", birthday: "Anniversaire",
  baptism: "Baptême", family_meeting: "Retrouvailles familiales",
  conference: "Conférence", seminar: "Séminaire", company_trip: "Voyage d'entreprise",
  business_mission: "Mission professionnelle", staff_shuttle: "Navette du personnel",
  football_match: "Match de football", sports_tournament: "Tournoi sportif",
  concert: "Concert", festival: "Festival", school_competition: "Compétition scolaire",
  tourist_trip: "Voyage touristique", group_excursion: "Excursion de groupe",
  pilgrimage: "Pèlerinage", site_visit: "Visite de site",
  airport_transfer: "Transfert aéroport", election_campaign: "Campagne électorale",
  administrative_mission: "Mission administrative", official_trip: "Voyage officiel",
  private_transport: "Transport privé", special_event: "Événement spécial",
  simple_rental: "Location simple",
}

function parseSmartDate(s?: string): Date | null {
  if (!s) return null
  const d = new Date(/[zZ]|[+\-]\d{2}:\d{2}$/.test(s) ? s : s.replace("T", " "))
  return isNaN(d.getTime()) ? null : d
}

const fmtDate = (iso?: string) => {
  const d = parseSmartDate(iso)
  if (!d) return "—"
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(d)
}
const fmtMoney = (v?: number) => (typeof v === "number" ? `${v.toLocaleString("fr-FR")} FCFA` : "—")
const frEvent = (e?: string | null) => (e ? (EVENT_LABELS[e] ?? e) : "—")

/* ----------- sub-components ----------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

/* ----------- props ----------- */

export type ReservationDetailsProps = {
  reservation: UIReservation
  busPlateById: Map<string, string>
}

/* ----------- component ----------- */

export function ReservationDetails({ reservation: r, busPlateById }: ReservationDetailsProps) {
  const busPlates = (r.busIds ?? []).map((id) => busPlateById.get(String(id)) ?? String(id))

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className={STATUS_COLORS[r.status]}>
          {STATUS_LABELS[r.status] ?? r.status}
        </Badge>
        {r.paymentStatus && (
          <Badge variant="outline" className={PAYMENT_COLORS[r.paymentStatus]}>
            {PAYMENT_LABELS[r.paymentStatus] ?? r.paymentStatus}
          </Badge>
        )}
        {r.event && r.event !== "none" && (
          <Badge variant="secondary">{frEvent(r.event)}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Trajet */}
        <InfoCard title="Trajet">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>{r.route?.from ?? "—"}</span>
            <IconArrowRight className="size-3.5 text-muted-foreground shrink-0" />
            <span>{r.route?.to ?? "—"}</span>
          </div>
          <Separator />
          <Field label="Date">{fmtDate(r.tripDate)}</Field>
          {!!r.distanceKm && (
            <>
              <Separator />
              <Field label="Distance">{r.distanceKm.toLocaleString("fr-FR")} km</Field>
            </>
          )}
        </InfoCard>

        {/* Passager */}
        <InfoCard title="Passager">
          <Field label="Nom">{r.passenger?.name ?? "—"}</Field>
          <Separator />
          <Field label="Téléphone">{r.passenger?.phone ?? "—"}</Field>
          <Separator />
          <Field label="Email">{r.passenger?.email ?? "—"}</Field>
        </InfoCard>

        {/* Finances */}
        <InfoCard title="Finances">
          <Field label="Sièges">{r.seats ?? "—"}</Field>
          <Separator />
          <Field label="Total">{fmtMoney(r.priceTotal)}</Field>
          <Separator />
          <Field label="Paiement">
            {r.paymentStatus ? (
              <Badge variant="outline" className={PAYMENT_COLORS[r.paymentStatus]}>
                {PAYMENT_LABELS[r.paymentStatus]}
              </Badge>
            ) : "—"}
          </Field>
        </InfoCard>

        {/* Bus */}
        <InfoCard title="Bus assignés">
          {busPlates.length ? (
            <div className="flex flex-wrap gap-2">
              {busPlates.map((plate) => (
                <Badge key={plate} variant="outline" className="font-mono">{plate}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Aucun bus assigné</p>
          )}
        </InfoCard>

      </div>
    </div>
  )
}
