// src/api/staff.ts
import api, { buildQuery } from "@/api/apiService"

/* ----------------------------- Server DTOs -------------------------------- */

export type StaffRole = "agent" | "admin"
export type StaffStatus = "active" | "inactive" | "suspended"

export type StaffDto = {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  role: StaffRole
  status?: StaffStatus | null
  // Some APIs return avatar_url; others might return avatar. Support both.
  avatar_url?: string | null
  avatar?: string | null
  license_no?: string | null
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
  status?: StaffStatus | ""
  role?: StaffRole | ""
  page?: number
  per_page?: number
}

/* ------------------------------ Transforms -------------------------------- */

export type Staff = {
  id: string            // UI uses string ids; convert from number
  name: string
  email?: string
  phone?: string
  role: StaffRole
  status?: StaffStatus
  /** UI field; mapped to/from backend `avatar_url` or `avatar` */
  avatar?: string
  /** UI field; mapped to/from backend `license_no` */
  licenseNo?: string
  createdAt?: string
}

export function toStaff(u: StaffDto): Staff {
  return {
    id: String(u.id),
    name: u.name,
    email: u.email ?? undefined,
    phone: u.phone ?? undefined,
    role: u.role,
    status: (u.status ?? undefined) as StaffStatus | undefined,
    // accept either avatar_url or avatar from the API
    avatar: (u.avatar_url ?? u.avatar) ?? undefined,
    licenseNo: u.license_no ?? undefined,
    createdAt: u.created_at,
  }
}

export function toPayload(s: Partial<Staff & { password?: string }>) {
  // Only send fields your FormRequests expect (see Store/UpdateStaffRequest)
  const p: Record<string, unknown> = {}
  if (s.name !== undefined) p.name = s.name
  if (s.email !== undefined) p.email = s.email || null
  if (s.phone !== undefined) p.phone = s.phone || null // phone is nullable/optional
  if (s.role !== undefined) p.role = s.role
  if (s.status !== undefined) p.status = s.status
  // Map UI avatar -> avatar_url (server). Also include "avatar" for backends using that key.
  if (s.avatar !== undefined) {
    p.avatar_url = s.avatar || null
    p.avatar = s.avatar || null
  }
  if (s.licenseNo !== undefined) p.license_no = s.licenseNo || null
  if (s.password !== undefined) p.password = s.password || null
  return p
}

/* -------------------------------- Client ---------------------------------- */

async function list(params?: ListParams) {
  const qs = buildQuery(params as any)
  const res = await api.get<Paginated<StaffDto>>(`/staff${qs}`)
  return {
    ...res,
    data: {
      rows: res.data.data.map(toStaff),
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
  const res = await api.get<StaffDto>(`/staff/${id}`)
  return { ...res, data: toStaff(res.data) }
}

async function create(payload: Partial<Staff & { password?: string }>) {
  const res = await api.post<StaffDto, Record<string, unknown>>(`/staff`, toPayload(payload))
  return { ...res, data: toStaff(res.data) }
}

async function update(id: string | number, payload: Partial<Staff & { password?: string }>) {
  const res = await api.put<StaffDto, Record<string, unknown>>(`/staff/${id}`, toPayload(payload))
  return { ...res, data: toStaff(res.data) }
}

async function remove(id: string | number) {
  return api.delete<null>(`/staff/${id}`)
}

async function bulkStatus(ids: Array<string | number>, status: StaffStatus) {
  const body = { ids: ids.map(Number), status }
  return api.post<{ updated: number }, typeof body>(`/staff/bulk-status`, body)
}

async function setRole(id: string | number, role: StaffRole) {
  const body = { id: Number(id), role }
  const res = await api.post<StaffDto, typeof body>(`/staff/role`, body)
  return { ...res, data: toStaff(res.data) }
}

export default {
  list,
  get,
  create,
  update,
  remove,
  bulkStatus,
  setRole,
}
