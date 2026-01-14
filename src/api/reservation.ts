// src/api/reservation.ts
import api, { buildQuery } from "@/api/apiService"

/* ------------------------------- Server DTOs ------------------------------- */

export type ReservationStatus = "pending" | "confirmed" | "cancelled"

export type ReservationPaymentStatus = "pending" | "paid" | "failed" | "refunded"

export type ReservationEvent =
  | "none" | "school_trip" | "university_trip" | "educational_tour" | "student_transport"
  | "wedding" | "funeral" | "birthday" | "baptism" | "family_meeting"
  | "conference" | "seminar" | "company_trip" | "business_mission" | "staff_shuttle"
  | "football_match" | "sports_tournament" | "concert" | "festival" | "school_competition"
  | "tourist_trip" | "group_excursion" | "pilgrimage" | "site_visit" | "airport_transfer"
  | "election_campaign" | "administrative_mission" | "official_trip" | "private_transport"
  | "special_event" | "simple_rental"

export type WaypointDto = {
  lat: number
  lng: number
  label?: string | null
}

export type ReservationDto = {
  id: string // uuid
  code?: string | null
  trip_date: string // ISO-8601
  from_location: string
  to_location: string

  passenger?: {
    name: string | null
    phone: string | null
    email?: string | null
  } | null

  // Flattened fallbacks
  passenger_name?: string | null
  passenger_phone?: string | null
  passenger_email?: string | null

  seats: number
  price_total?: number | null
  status?: ReservationStatus | null
  payment_status?: ReservationPaymentStatus | null
  event?: ReservationEvent | null

  waypoints?: WaypointDto[] | null
  distance_km?: number | null

  buses?: Array<{
    id: number | string
    plate?: string | null
    name?: string | null
    status?: string | null
    type?: string | null
  }> | null

  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

export type Paginated<T> = {
  data: T[]
  meta?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

/* -------------------------------- UI Types -------------------------------- */

export type UIRoute = { from: string; to: string }
export type UIPassenger = { name: string; phone: string; email?: string }
export type UIWaypoint = { lat: number; lng: number; label: string }

export type UIReservation = {
  id: string
  code?: string
  tripDate: string
  route: UIRoute
  passenger: UIPassenger
  seats: number
  priceTotal: number
  status: ReservationStatus
  paymentStatus?: ReservationPaymentStatus
  event: ReservationEvent
  waypoints: UIWaypoint[]
  distanceKm: number
  busIds: string[]
  createdAt?: string
  updatedAt?: string
  deletedAt?: string | null
}

type PartialUIReservation = Partial<UIReservation>

/* ------------------------------ Transforming ------------------------------ */

export function toUIReservation(r: ReservationDto): UIReservation {
  const nested = r.passenger ?? null
  const name = nested?.name ?? r.passenger_name ?? ""
  const phone = nested?.phone ?? r.passenger_phone ?? ""
  const email = nested?.email ?? r.passenger_email ?? undefined

  return {
    id: String(r.id),
    code: r.code ?? undefined,
    tripDate: r.trip_date,
    route: { 
      from: r.from_location ?? "Départ inconnu", 
      to: r.to_location ?? "Arrivée inconnue" 
    },
    passenger: { name, phone, email },
    seats: Number(r.seats ?? 0),
    priceTotal: Number(r.price_total ?? 0),
    status: (r.status as ReservationStatus) ?? "pending",
    paymentStatus: (r.payment_status as ReservationPaymentStatus) ?? undefined,
    event: (r.event as ReservationEvent) ?? "none",
    waypoints: Array.isArray(r.waypoints) 
      ? r.waypoints.map(w => ({
          lat: Number(w.lat),
          lng: Number(w.lng),
          label: w.label ?? ""
        }))
      : [],
    distanceKm: Number(r.distance_km ?? 0),
    busIds: Array.isArray(r.buses) ? r.buses.map(b => String(b.id)) : [],
    createdAt: r.created_at ?? undefined,
    updatedAt: r.updated_at ?? undefined,
    deletedAt: r.deleted_at ?? null,
  }
}

/* --------------------------- Payload Construction --------------------------- */

function strOrNull(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim()
  return s ? s : null
}

function numOrNull(v: unknown): number | null {
  if (v === "" || v === undefined || v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function isIsoDateOrTime(v?: string) {
  // Rough check for ISO string
  return !!v && (v.includes("T") || v.match(/^\d{4}-\d{2}-\d{2}$/))
}

/**
 * Converts UI partial object to backend Payload.
 * Handles the logic between Map Mode (waypoints with coords) vs Manual Mode (text only).
 */
function toPayload(body: PartialUIReservation): Record<string, unknown> {
  const p: Record<string, unknown> = {}

  // Basic Fields
  if (body.code !== undefined) p.code = strOrNull(body.code)
  if (body.status) p.status = body.status
  if (body.event) p.event = body.event
  if (body.seats !== undefined) p.seats = Math.max(1, Number(body.seats))
  if (body.priceTotal !== undefined) p.price_total = Number(body.priceTotal)
  if (body.distanceKm !== undefined) p.distance_km = Number(body.distanceKm)

  // Dates
  if (body.tripDate && isIsoDateOrTime(body.tripDate)) {
    p.trip_date = body.tripDate
  }

  // Passenger
  if (body.passenger) {
    if (body.passenger.name) p.passenger_name = body.passenger.name
    if (body.passenger.phone) p.passenger_phone = body.passenger.phone
    if (body.passenger.email !== undefined) p.passenger_email = strOrNull(body.passenger.email)
  }

  // Route & Waypoints Logic
  // 1. Always sync from/to location text (essential for manual mode)
  if (body.route) {
    if (body.route.from) p.from_location = body.route.from
    if (body.route.to) p.to_location = body.route.to
  }

  // 2. Sync Waypoints (Geo Data)
  // Only send 'waypoints' array if we actually have valid coordinates.
  // If user used Manual Mode (text inputs), waypoints might be empty or have 0,0 coords.
  if (body.waypoints) {
    const validWaypoints = body.waypoints.filter(w => 
      (w.lat !== 0 && w.lng !== 0) && (Math.abs(w.lat) > 0.0001 || Math.abs(w.lng) > 0.0001)
    )

    if (validWaypoints.length >= 2) {
      p.waypoints = validWaypoints.map(w => ({
        lat: w.lat,
        lng: w.lng,
        label: w.label || null
      }))
    } else {
      // If we don't have enough geo-points, send null to clear existing map data on backend
      p.waypoints = null
    }
  }

  // Bus Syncing
  if (body.busIds !== undefined) {
    // Backend expects an array of IDs.
    p.bus_ids = body.busIds.map(id => String(id))
  }

  return p
}

/* --------------------------------- Service --------------------------------- */

export type ListParams = {
  search?: string
  status?: ReservationStatus | ""
  date_from?: string
  date_to?: string
  bus_id?: number | string
  with?: ("buses")[]
  trashed?: "with" | "only" | "without"
  order_by?: string
  order_dir?: "asc" | "desc"
  page?: number
  per_page?: number
}

function normalizeListParams(p?: ListParams) {
  if (!p) return undefined
  const out: Record<string, unknown> = { ...p }
  if (p.with?.length) out.with = p.with.join(",")
  return out
}

async function list(params?: ListParams) {
  const qs = buildQuery(normalizeListParams(params))
  const res = await api.get<Paginated<ReservationDto>>(`/reservations${qs}`)
  return {
    ...res,
    data: {
      rows: res.data.data.map(toUIReservation),
      meta: res.data.meta ?? { current_page: 1, last_page: 1, per_page: 10, total: 0 },
    },
  }
}

async function show(id: string) {
  const res = await api.get<ReservationDto>(`/reservations/${id}`)
  return { ...res, data: toUIReservation(res.data) }
}

async function create(payload: PartialUIReservation) {
  const res = await api.post<ReservationDto, Record<string, unknown>>(`/reservations`, toPayload(payload))
  return { ...res, data: toUIReservation(res.data) }
}

async function update(id: string, payload: PartialUIReservation) {
  const res = await api.put<ReservationDto, Record<string, unknown>>(`/reservations/${id}`, toPayload(payload))
  return { ...res, data: toUIReservation(res.data) }
}

async function remove(id: string) {
  return api.delete<null>(`/reservations/${id}`)
}

async function restore(id: string) {
  const res = await api.post<ReservationDto>(`/reservations/${id}/restore`)
  return { ...res, data: toUIReservation(res.data) }
}

async function setStatus(id: string, status: ReservationStatus) {
  const res = await api.post<ReservationDto, { status: ReservationStatus }>(`/reservations/${id}/status`, { status })
  return { ...res, data: toUIReservation(res.data) }
}

async function bulkStatus(ids: string[], status: ReservationStatus) {
  const body = { ids, status }
  return api.post<{ updated: number }, typeof body>(`/reservations/bulk-status`, body)
}

// Quote Endpoint helper (used in UI)
export async function getQuote(
  vehicles: Record<string, number>, 
  distanceKm: number, 
  event: string
) {
  return api.post<any, any>("/quote", { 
    vehicles_map: vehicles, 
    distance_km: distanceKm, 
    event 
  })
}


// Manual Payment Record - Updated to include reference
export async function recordPayment(id: string, payload: { amount: number, method: string, note?: string, reference?: string }) {
  const res = await api.post<ReservationDto, typeof payload>(`/reservations/${id}/payment`, payload)
  return { ...res, data: toUIReservation(res.data) }
}

export default {
  list,
  show,
  create,
  update,
  remove,
  restore,
  setStatus,
  bulkStatus,
  getQuote,
  recordPayment,
}