// src/api/client.ts
import api, { buildQuery } from "@/api/apiService"

/* ----------------------------- Server DTOs -------------------------------- */

export type ClientDto = {
  id: number
  name: string
  phone: string
  email?: string | null
  avatar_url?: string | null
  last_login_at?: string | null
  created_at?: string
  orders_count?: number
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

export type ClientListParams = {
  search?: string
  page?: number
  per_page?: number
}

/* ------------------------------ Transforms -------------------------------- */

export type Client = {
  id: string
  name: string
  phone: string
  email?: string
  avatar?: string
  lastLoginAt?: string
  createdAt?: string
  ordersCount?: number
}

export function toClient(dto: ClientDto): Client {
  return {
    id: String(dto.id),
    name: dto.name,
    phone: dto.phone,
    email: dto.email ?? undefined,
    avatar: dto.avatar_url ?? undefined,
    lastLoginAt: dto.last_login_at ?? undefined,
    createdAt: dto.created_at,
    ordersCount: dto.orders_count ?? 0,
  }
}

/* -------------------------------- Client Service ---------------------------------- */

async function list(params?: ClientListParams) {
  const qs = buildQuery(params as any)
  const res = await api.get<Paginated<ClientDto>>(`/clients${qs}`)
  return {
    ...res,
    data: {
      rows: res.data.data.map(toClient),
      meta: res.data.meta,
    },
  }
}

async function show(id: string | number) {
  const res = await api.get<ClientDto>(`/clients/${id}`)
  return { data: toClient(res.data) }
}

// Note: Usually clients manage their own profile via app, but admins might need to edit.
// Use standard update if your backend supports it.
async function update(id: string | number, payload: Partial<Client>) {
  // Mapping UI fields to Backend fields if necessary
  const body = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone
  }
  const res = await api.put<ClientDto>(`/clients/${id}`, body)
  return { data: toClient(res.data) }
}

export default {
  list,
  show,
  update,
}