// src/api/job.ts
import api, { buildQuery } from "@/api/apiService"

/* ========================================================================== */
/* JOBS (OFFRES)                              */
/* ========================================================================== */

/* ----------------------------- Server DTOs & Types -------------------------------- */
export type JobWorkMode = "onsite" | "hybrid" | "remote"
export type JobContractType = "full_time" | "part_time" | "cdi" | "cdd" | "freelance" | "internship" | "apprenticeship"
export type JobStatus = "draft" | "open" | "closed"

export type JobDto = {
  id: number | string
  title: string
  department: string 
  location: string   
  country: string    
  work_mode: JobWorkMode
  contract_type: JobContractType
  short_desc: string
  responsibilities: string[]
  requirements: string[]
  benefits: string[]
  status: JobStatus
  created_at?: string
  updated_at?: string
}

export type Paginated<T> = {
  data: T[]
  meta?: { current_page: number; last_page: number; per_page: number; total: number }
}

export type ListParams = {
  search?: string
  status?: JobStatus | ""
  department?: string | ""
  workMode?: JobWorkMode | ""
  page?: number
  per_page?: number
}

export type Job = {
  id: string
  title: string
  department: string
  location: string
  country: string
  workMode: JobWorkMode
  contractType: JobContractType
  shortDesc: string
  responsibilities: string[]
  requirements: string[]
  benefits: string[]
  status: JobStatus
  createdAt?: string
}

/* ----------------------------- Dictionaries (Value/Label) ------------------------- */

export const WORK_MODES = [
  { value: "onsite", label: "Présentiel" },
  { value: "hybrid", label: "Hybride" },
  { value: "remote", label: "Télétravail" },
]

export const CONTRACT_TYPES = [
  { value: "full_time", label: "Temps plein" },
  { value: "part_time", label: "Temps partiel" },
  { value: "cdi", label: "CDI" },
  { value: "cdd", label: "CDD" },
  { value: "freelance", label: "Freelance" },
  { value: "internship", label: "Stage" },
  { value: "apprenticeship", label: "Alternance" },
]

export const JOB_STATUSES = [
  { value: "draft", label: "Brouillon" },
  { value: "open", label: "Ouvert" },
  { value: "closed", label: "Fermé" },
]

export const DEFAULT_DEPARTMENTS = [
  { value: "engineering", label: "Ingénierie" },
  { value: "marketing", label: "Marketing" },
  { value: "operations", label: "Opérations" },
  { value: "support", label: "Support Client" },
  { value: "design", label: "Design & UX" },
]

export const DEFAULT_COUNTRIES = [
  { value: "cg", label: "Congo-Brazzaville" },
  { value: "cd", label: "Rép. Démocratique du Congo" },
  { value: "fr", label: "France" },
  { value: "sn", label: "Sénégal" },
  { value: "ci", label: "Côte d'Ivoire" },
  { value: "cm", label: "Cameroun" },
]

export const DEFAULT_CITIES = [
  { value: "bzv", label: "Brazzaville" },
  { value: "pnr", label: "Pointe-Noire" },
  { value: "dol", label: "Dolisie" },
  { value: "kin", label: "Kinshasa" },
  { value: "par", label: "Paris" },
]

export function getLabel(list: { value: string; label: string }[], val?: string): string {
  if (!val) return "—"
  return list.find(item => item.value === val)?.label || val
}

/* ------------------------------ Transforms -------------------------------- */
export function toJob(dto: JobDto): Job {
  return {
    id: String(dto.id),
    title: dto.title,
    department: dto.department,
    location: dto.location,
    country: dto.country,
    workMode: dto.work_mode,
    contractType: dto.contract_type,
    shortDesc: dto.short_desc,
    responsibilities: dto.responsibilities ?? [],
    requirements: dto.requirements ?? [],
    benefits: dto.benefits ?? [],
    status: dto.status ?? "draft",
    createdAt: dto.created_at,
  }
}

export function toPayload(j: Partial<Job>) {
  const p: Record<string, unknown> = {}
  if (j.title !== undefined) p.title = j.title
  if (j.department !== undefined) p.department = j.department
  if (j.location !== undefined) p.location = j.location
  if (j.country !== undefined) p.country = j.country
  if (j.workMode !== undefined) p.work_mode = j.workMode
  if (j.contractType !== undefined) p.contract_type = j.contractType
  if (j.shortDesc !== undefined) p.short_desc = j.shortDesc
  if (j.responsibilities !== undefined) p.responsibilities = j.responsibilities
  if (j.requirements !== undefined) p.requirements = j.requirements
  if (j.benefits !== undefined) p.benefits = j.benefits
  if (j.status !== undefined) p.status = j.status
  return p
}

/* -------------------------------- Client ---------------------------------- */
async function list(params?: ListParams) {
  const qs = buildQuery(params as any)
  const res = await api.get<Paginated<JobDto>>(`/jobs${qs}`)
  return {
    ...res,
    data: {
      rows: res.data.data.map(toJob),
      meta: res.data.meta ?? { current_page: 1, last_page: 1, per_page: res.data.data.length, total: res.data.data.length },
    },
  }
}

async function create(payload: Partial<Job>) {
  const res = await api.post<JobDto, Record<string, unknown>>(`/jobs`, toPayload(payload))
  return { ...res, data: toJob(res.data) }
}

async function update(id: string, payload: Partial<Job>) {
  const res = await api.put<JobDto, Record<string, unknown>>(`/jobs/${id}`, toPayload(payload))
  return { ...res, data: toJob(res.data) }
}

async function remove(id: string) {
  return api.delete<null>(`/jobs/${id}`)
}

async function bulkStatus(ids: Array<string>, status: JobStatus) {
  const body = { ids, status }
  return api.post<{ updated: number }, typeof body>(`/jobs/bulk-status`, body)
}


/* ========================================================================== */
/* CANDIDATES (POSTULANTS)                        */
/* ========================================================================== */

export type CandidateStatus = "pending" | "reviewed" | "accepted" | "rejected"

export const CANDIDATE_STATUSES = [
  { value: "pending", label: "En attente" },
  { value: "reviewed", label: "En cours" },
  { value: "accepted", label: "Accepté" },
  { value: "rejected", label: "Rejeté" },
]

export type CandidateDto = {
  id: string
  emploi_id: string
  emploi?: JobDto
  first_name: string
  last_name: string
  email: string
  phone?: string
  resume_url?: string
  cover_letter_url?: string
  status: CandidateStatus
  notes?: string
  created_at?: string
  updated_at?: string
}

export type CandidateListParams = {
  search?: string
  status?: CandidateStatus | ""
  emploi_id?: string | ""
  page?: number
  per_page?: number
}

export type Candidate = {
  id: string
  jobId: string
  job?: Job
  firstName: string
  lastName: string
  email: string
  phone?: string
  resumeUrl?: string
  coverLetterUrl?: string
  status: CandidateStatus
  notes?: string
  createdAt?: string
}

export function toCandidate(dto: CandidateDto): Candidate {
  return {
    id: String(dto.id),
    jobId: String(dto.emploi_id),
    job: dto.emploi ? toJob(dto.emploi) : undefined,
    firstName: dto.first_name,
    lastName: dto.last_name,
    email: dto.email,
    phone: dto.phone,
    resumeUrl: dto.resume_url,
    coverLetterUrl: dto.cover_letter_url,
    status: dto.status,
    notes: dto.notes,
    createdAt: dto.created_at,
  }
}

async function listCandidates(params?: CandidateListParams) {
  const qs = buildQuery(params as any)
  const res = await api.get<Paginated<CandidateDto>>(`/candidates${qs}`)
  return {
    ...res,
    data: {
      rows: res.data.data.map(toCandidate),
      meta: res.data.meta ?? { current_page: 1, last_page: 1, per_page: res.data.data.length, total: res.data.data.length },
    },
  }
}

async function updateCandidate(id: string, payload: { status?: CandidateStatus; notes?: string }) {
  const res = await api.put<CandidateDto, typeof payload>(`/candidates/${id}`, payload)
  return { ...res, data: toCandidate(res.data) }
}

async function removeCandidate(id: string) {
  return api.delete<null>(`/candidates/${id}`)
}

async function bulkCandidateStatus(ids: Array<string>, status: CandidateStatus) {
  const body = { ids, status }
  return api.post<{ updated: number }, typeof body>(`/candidates/bulk-status`, body)
}

export default { 
  list, create, update, remove, bulkStatus,
  listCandidates, updateCandidate, removeCandidate, bulkCandidateStatus 
}