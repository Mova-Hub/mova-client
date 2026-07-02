import api, { buildQuery } from "@/api/apiService"

/* ----------------------------- Server DTOs -------------------------------- */

export type BusStatus = "active" | "maintenance" | "inactive"
export type BusType = "sprinter" | "coach" | "minibus" | "hiace" | "coaster" | "bus" | "other"

export type BusDto = {
  id: string // uuid
  plate: string
  capacity: number
  name?: string | null
  type?: BusType | null
  status?: BusStatus | null
  model?: string | null
  year?: number | null
  mileage_km?: number | null
  last_service_date?: string | null // YYYY-MM-DD

  insurance_provider?: string | null
  insurance_policy_number?: string | null
  insurance_valid_until?: string | null // YYYY-MM-DD

  // UUID FKs (must match your migration)
  operator_id?: string | null
  assigned_driver_id?: string | null
  assigned_conductor_id?: string | null 

  // optional related snippets when `with=operator,driver,conductor`
  operator?: { id: string; name: string } | null
  driver?: { id: string; name: string } | null
  conductor?: { id: string; name: string } | null 

  created_at?: string | null
  updated_at?: string | null
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

/* ------------------------------ UI Types ---------------------------------- */

export type UIBus = {
  id: string
  plate: string
  capacity: number
  name?: string
  type?: BusType
  status?: BusStatus
  model?: string
  year?: number
  mileageKm?: number
  lastServiceDate?: string // YYYY-MM-DD

  insuranceProvider?: string
  insurancePolicyNumber?: string
  insuranceValidUntil?: string // YYYY-MM-DD

  operatorId?: string | null
  assignedDriverId?: string | null
  assignedConductorId?: string | null 

  operatorName?: string | null
  driverName?: string | null
  conductorName?: string | null 

  createdAt?: string
  updatedAt?: string
}

/* ------------------------------ Transforms -------------------------------- */

export function toUIBus(b: BusDto): UIBus {
  return {
    id: b.id,
    plate: b.plate,
    capacity: Number(b.capacity ?? 0),
    name: b.name ?? undefined,
    type: (b.type ?? undefined) as BusType | undefined,
    status: (b.status ?? undefined) as BusStatus | undefined,
    model: b.model ?? undefined,
    year: (b.year ?? undefined) as number | undefined,
    mileageKm: b.mileage_km ?? undefined,
    lastServiceDate: b.last_service_date ?? undefined,
    insuranceProvider: b.insurance_provider ?? undefined,
    insurancePolicyNumber: b.insurance_policy_number ?? undefined,
    insuranceValidUntil: b.insurance_valid_until ?? undefined,
    operatorId: b.operator_id ?? null,
    assignedDriverId: b.assigned_driver_id ?? null,
    assignedConductorId: b.assigned_conductor_id ?? null,
    operatorName: b.operator?.name ?? undefined,
    driverName: b.driver?.name ?? undefined,
    conductorName: b.conductor?.name ?? undefined,
    createdAt: b.created_at ?? undefined,
    updatedAt: b.updated_at ?? undefined,
  }
}

type PartialUIBus = Partial<UIBus>

/* --------------------------- Coercion helpers ----------------------------- */

function asStringOrNull(v: unknown): string | null {
  const s =
    typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim()
  return s ? s : null
}

function asNumberOrNull(v: unknown): number | null {
  if (v === "" || v === undefined || v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function isIsoDate(v?: string): boolean {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

function toPayload(body: PartialUIBus): Record<string, unknown> {
  // Map camelCase UI -> snake_case API
  // Convert "" -> null for nullable fields
  const p: Record<string, unknown> = {}

  if (body.plate !== undefined) p.plate = String(body.plate).trim()
  if (body.capacity !== undefined) p.capacity = asNumberOrNull(body.capacity)

  if (body.name !== undefined) p.name = asStringOrNull(body.name)
  if (body.type !== undefined) p.type = body.type || null
  if (body.status !== undefined) p.status = body.status || null
  if (body.model !== undefined) p.model = asStringOrNull(body.model)

  if (body.year !== undefined) p.year = asNumberOrNull(body.year)
  if (body.mileageKm !== undefined) p.mileage_km = asNumberOrNull(body.mileageKm)

  if (body.lastServiceDate !== undefined) {
    p.last_service_date = isIsoDate(body.lastServiceDate) ? body.lastServiceDate : null
  }

  if (body.insuranceProvider !== undefined) p.insurance_provider = asStringOrNull(body.insuranceProvider)
  if (body.insurancePolicyNumber !== undefined) p.insurance_policy_number = asStringOrNull(body.insurancePolicyNumber)
  if (body.insuranceValidUntil !== undefined) {
    p.insurance_valid_until = isIsoDate(body.insuranceValidUntil) ? body.insuranceValidUntil : null
  }

  // UUIDs
  if (body.operatorId !== undefined) p.operator_id = asStringOrNull(body.operatorId)
  if (body.assignedDriverId !== undefined) p.assigned_driver_id = asStringOrNull(body.assignedDriverId)
  if (body.assignedConductorId !== undefined) p.assigned_conductor_id = asStringOrNull(body.assignedConductorId)

  return p
}

/* -------------------------------- Queries --------------------------------- */

export type ListParams = {
  search?: string
  status?: BusStatus | ""
  type?: BusType | ""
  operator_id?: string | ""     // UUID
  driver_id?: string | ""       // UUID
  conductor_id?: string | ""    // UUID
  year_min?: number
  year_max?: number
  service_before?: string       // YYYY-MM-DD
  insurance_before?: string     // YYYY-MM-DD
  with?: ("operator" | "driver" | "conductor")[]
  order_by?: "created_at" | "updated_at" | "plate" | "status" | "type" | "year" | "mileage_km"
  order_dir?: "asc" | "desc"
  page?: number
  per_page?: number
}

function normalizeListParams(params?: ListParams) {
  if (!params) return undefined
  const out: Record<string, unknown> = { ...params }
  if (params.with && params.with.length) out.with = params.with.join(",")
  return out
}

/* -------------------------------- Client ---------------------------------- */

async function list(params?: ListParams) {
  const qs = buildQuery(normalizeListParams(params))
  const res = await api.get<Paginated<BusDto>>(`/buses${qs}`)
  return {
    ...res,
    data: {
      rows: res.data.data.map(toUIBus),
      meta: res.data.meta ?? {
        current_page: 1,
        last_page: 1,
        per_page: res.data.data.length,
        total: res.data.data.length,
      },
    },
  }
}

async function create(payload: PartialUIBus) {
  const res = await api.post<BusDto, Record<string, unknown>>(`/buses`, toPayload(payload))
  return { ...res, data: toUIBus(res.data) }
}

async function update(id: string, payload: PartialUIBus) {
  const res = await api.put<BusDto, Record<string, unknown>>(`/buses/${id}`, toPayload(payload))
  return { ...res, data: toUIBus(res.data) }
}

async function remove(id: string) {
  return api.delete<null>(`/buses/${id}`)
}

async function setStatus(id: string, status: BusStatus) {
  const res = await api.post<BusDto, { status: BusStatus }>(`/buses/${id}/status`, { status })
  return { ...res, data: toUIBus(res.data) }
}

async function assignDriver(id: string, userId: string | null) {
  const res = await api.post<BusDto, { user_id: string | null }>(
    `/buses/${id}/assign-driver`,
    { user_id: userId }
  )
  return { ...res, data: toUIBus(res.data) }
}

async function assignConductor(id: string, userId: string | null) {
  const res = await api.post<BusDto, { user_id: string | null }>(
    `/buses/${id}/assign-conductor`,
    { user_id: userId }
  )
  return { ...res, data: toUIBus(res.data) }
}

async function setOperator(id: string, userId: string | null) {
  const res = await api.post<BusDto, { user_id: string | null }>(
    `/buses/${id}/set-operator`,
    { user_id: userId }
  )
  return { ...res, data: toUIBus(res.data) }
}

async function get(id: string, withRelations?: ("operator" | "driver" | "conductor")[]) {
  const qs = withRelations?.length ? buildQuery({ with: withRelations.join(",") }) : ""
  const res = await api.get<BusDto>(`/buses/${id}${qs}`)
  return { ...res, data: toUIBus(res.data) }
}

async function bulkStatus(ids: string[], status: BusStatus) {
  const body = { ids, status }
  return api.post<{ updated: number }, typeof body>(`/buses/bulk-status`, body)
}

export default {
  list,
  get,
  create,
  update,
  remove,
  setStatus,
  assignDriver,
  assignConductor,
  setOperator,
  bulkStatus,
}
