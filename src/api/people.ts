// src/api/people.ts
import api, { buildQuery } from "@/api/apiService"

/* ----------------------------- Server DTOs -------------------------------- */

export type PersonRole   = "driver" | "conductor" | "owner"
export type PersonStatus = "active" | "inactive" | "suspended"

export type PersonAddress = {
  street?: string | null
  quartier?: string | null
  arrondissement?: string | null
  city?: string | null
  department?: string | null
  country?: string | null
}

export type AssignedBusSnippet = {
  id: string | number
  plate: string
  brand?: string | null
  model?: string | null
  type?: string | null
  status?: string | null
  role?: "driver" | "conductor" | null // the person's role on this bus
}

export type PersonDto = {
  id: number
  name: string
  first_name?: string | null
  email?: string | null
  phone?: string | null
  role: PersonRole
  status?: PersonStatus | null
  avatar_url?: string | null
  avatar?: string | null
  license_no?: string | null
  permit_expiration_date?: string | null
  address?: PersonAddress | null
  assigned_buses?: AssignedBusSnippet[] | null
  owned_buses?: AssignedBusSnippet[] | null
  stats?: { bus_count?: number } | null
  created_at?: string
  updated_at?: string
}

/** Typical Laravel paginator */
export type Paginated<T> = {
  data: T[]
  meta?: {
    current_page: number
    last_page: number
    per_page: number
    total: number
  }
}

export type ListParams = {
  search?: string
  status?: PersonStatus | ""
  role?: PersonRole | ""
  page?: number
  per_page?: number
}

/* ------------------------------ Transforms -------------------------------- */

export type Person = {
  id: string
  name: string
  firstName?: string
  email?: string
  phone?: string
  role: PersonRole
  status?: PersonStatus
  avatar?: string
  licenseNo?: string
  permitExpirationDate?: string
  address?: PersonAddress
  assignedBuses?: AssignedBusSnippet[]
  ownedBuses?: AssignedBusSnippet[]
  stats?: { busCount?: number }
  createdAt?: string
}

export function toPerson(u: PersonDto): Person {
  return {
    id: String(u.id),
    name: u.name,
    firstName: u.first_name ?? undefined,
    email: u.email ?? undefined,
    phone: u.phone ?? undefined,
    role: u.role,
    status: (u.status ?? undefined) as PersonStatus | undefined,
    avatar: (u.avatar_url ?? u.avatar) ?? undefined,
    licenseNo: u.license_no ?? undefined,
    permitExpirationDate: u.permit_expiration_date ?? undefined,
    address: u.address ?? undefined,
    assignedBuses: u.assigned_buses?.map((b) => ({
      ...b,
      id: String(b.id),
    })) ?? undefined,
    ownedBuses: u.owned_buses?.map((b) => ({
      ...b,
      id: String(b.id),
    })) ?? undefined,
    stats: u.stats ? { busCount: u.stats.bus_count } : undefined,
    createdAt: u.created_at,
  }
}

export function toPayload(p: Partial<Person & { password?: string }>) {
  const body: Record<string, unknown> = {}
  if (p.name       !== undefined) body.name       = p.name
  if (p.firstName  !== undefined) body.first_name  = p.firstName || null
  if (p.email      !== undefined) body.email       = p.email || null
  if (p.phone      !== undefined) body.phone       = p.phone || null
  if (p.role       !== undefined) body.role        = p.role
  if (p.status     !== undefined) body.status      = p.status
  if (p.licenseNo  !== undefined) body.license_no  = p.licenseNo || null
  if (p.permitExpirationDate !== undefined) body.permit_expiration_date = p.permitExpirationDate || null
  if (p.address    !== undefined) body.address     = p.address ?? null
  if (p.avatar     !== undefined) {
    body.avatar_url = p.avatar || null
    body.avatar     = p.avatar || null
  }
  if (p.password   !== undefined) body.password    = p.password || null
  return body
}

/* -------------------------------- Client ---------------------------------- */

async function list(params?: ListParams) {
  const qs = buildQuery(params as any)
  const res = await api.get<Paginated<PersonDto>>(`/person${qs}`)
  return {
    ...res,
    data: {
      rows: res.data.data.map(toPerson),
      meta: res.data.meta ?? {
        current_page: 1,
        last_page: 1,
        per_page: res.data.data.length,
        total: res.data.data.length,
      },
    },
  }
}

async function get(id: string | number) {
  const res = await api.get<PersonDto>(`/person/${id}`)
  return { ...res, data: toPerson(res.data) }
}

async function create(payload: Partial<Person & { password?: string }>) {
  const res = await api.post<PersonDto, Record<string, unknown>>(`/person`, toPayload(payload))
  return { ...res, data: toPerson(res.data) }
}

async function update(id: string | number, payload: Partial<Person & { password?: string }>) {
  const res = await api.put<PersonDto, Record<string, unknown>>(`/person/${id}`, toPayload(payload))
  return { ...res, data: toPerson(res.data) }
}

async function remove(id: string | number) {
  return api.delete<null>(`/person/${id}`)
}

async function bulkStatus(ids: Array<string | number>, status: PersonStatus) {
  const body = { ids: ids.map(Number), status }
  return api.post<{ updated: number }, typeof body>(`/person/bulk-status`, body)
}

async function setRole(id: string | number, role: PersonRole) {
  const body = { id: Number(id), role }
  const res = await api.post<PersonDto, typeof body>(`/person/role`, body)
  return { ...res, data: toPerson(res.data) }
}

async function uploadAvatar(id: string | number, file: File) {
  const fd = new FormData()
  fd.append("avatar", file)
  const res = await api.post<PersonDto, FormData>(`/person/${id}/avatar`, fd)
  return { ...res, data: toPerson(res.data) }
}

export default { list, get, create, update, remove, bulkStatus, setRole, uploadAvatar }
