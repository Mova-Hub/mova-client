// src/api/order.ts
import api, { buildQuery } from "@/api/apiService"
import type { ClientDto, Client } from "./client"
import { toClient } from "./client"

/* ----------------------------- Server DTOs -------------------------------- */

export type OrderStatus = "pending" | "contacted" | "converted" | "cancelled"

export type OrderDto = {
  id: number
  client_id: number
  status: OrderStatus
  event_type: string
  origin: string
  destination: string
  pickup_date: string // YYYY-MM-DD
  pickup_time: string
  fleet_requirements: Record<string, number> // { "coaster": 2, "hiace": 1 }
  contact_name: string
  contact_phone: string
  internal_notes?: string | null
  created_at: string
  updated_at: string
  client?: ClientDto
}

export type OrderListParams = {
  status?: OrderStatus | ""
  page?: number
  per_page?: number
}

/* ------------------------------ Transforms -------------------------------- */

export type Order = {
  id: string
  clientId: string
  status: OrderStatus
  eventType: string
  origin: string
  destination: string
  pickupDate: string
  pickupTime: string
  /** Fleet object: { "coaster": 2 } */
  fleet: Record<string, number>
  contactName: string
  contactPhone: string
  internalNotes?: string
  createdAt: string
  client?: Client
}

export function toOrder(dto: OrderDto): Order {
  return {
    id: String(dto.id),
    clientId: String(dto.client_id),
    status: dto.status,
    eventType: dto.event_type,
    origin: dto.origin,
    destination: dto.destination,
    pickupDate: dto.pickup_date,
    pickupTime: dto.pickup_time,
    fleet: dto.fleet_requirements ?? {},
    contactName: dto.contact_name,
    contactPhone: dto.contact_phone,
    internalNotes: dto.internal_notes ?? undefined,
    createdAt: dto.created_at,
    client: dto.client ? toClient(dto.client) : undefined,
  }
}

/* -------------------------------- Service ---------------------------------- */

async function list(params?: OrderListParams) {
  const qs = buildQuery(params as any)
  const res = await api.get<{ data: OrderDto[], meta: any }>(`/orders${qs}`)
  return {
    ...res,
    data: {
      rows: res.data.data.map(toOrder),
      meta: res.data.meta,
    },
  }
}

async function show(id: string | number) {
  const res = await api.get<{ order: OrderDto, actions: any }>(`/orders/${id}`)
  return {
    data: toOrder(res.data.order),
    actions: res.data.actions // call_link, whatsapp_link
  }
}

async function update(id: string | number, payload: { status?: OrderStatus, internal_notes?: string }) {
  const res = await api.patch<{ message: string, order: OrderDto }>(`/orders/${id}`, payload)
  return { data: toOrder(res.data.order), message: res.data.message }
}

async function convertToReservation(id: string | number) {
  const res = await api.post<{ status: boolean, message: string }>(`/orders/${id}/convert`, {})
  return res.data
}

export default {
  list,
  show,
  update,
  convertToReservation,
}