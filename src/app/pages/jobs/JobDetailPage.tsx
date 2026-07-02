"use client"

import * as React from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Briefcase, MapPin, Clock, FileText, ListChecks, Gift } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import jobApi, {
  type Job,
  getLabel,
  JOB_STATUSES,
  WORK_MODES,
  CONTRACT_TYPES,
  DEFAULT_DEPARTMENTS,
  DEFAULT_CITIES,
  DEFAULT_COUNTRIES,
} from "@/api/job"

/* ─── Helpers ──────────────────────────────────────────────────────────────── */

const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
  draft:  { label: "Brouillon", badge: "bg-slate-50 text-slate-700 border-slate-200",     dot: "bg-slate-400" },
  open:   { label: "Ouvert",    badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  closed: { label: "Fermé",     badge: "bg-red-50 text-red-700 border-red-200",           dot: "bg-red-500" },
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 w-full">
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [job, setJob] = React.useState<Job | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!id) return
    jobApi.get(id)
      .then((res) => setJob(res.data))
      .catch(() => { toast.error("Impossible de charger l'offre."); navigate("/jobs") })
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) return <PageSkeleton />
  if (!job) return null

  const status = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.draft

  const deptLabel = getLabel(DEFAULT_DEPARTMENTS, job.department)
  const cityLabel = getLabel(DEFAULT_CITIES, job.location)
  const countryLabel = getLabel(DEFAULT_COUNTRIES, job.country)
  const modeLabel = getLabel(WORK_MODES, job.workMode)
  const contractLabel = getLabel(CONTRACT_TYPES, job.contractType)

  return (
    <div className="flex flex-col gap-6 p-6 lg:p-8 w-full">

      {/* ── Breadcrumb ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/jobs")}
        >
          <ArrowLeft className="size-4" />
          Recrutement
        </Button>
        <span>/</span>
        <span className="font-semibold text-foreground">{job.title}</span>
      </div>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 sm:p-8 shadow-lg">
        <div className="pointer-events-none absolute -top-10 -right-10 size-48 rounded-full bg-white/5" />

        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
              <Briefcase className="size-8 text-white/80" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{job.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="bg-white/10 text-white/80 border-transparent text-xs">{deptLabel}</Badge>
                <span className="text-white/40 text-xs">·</span>
                <span className="flex items-center gap-1 text-sm text-white/60">
                  <MapPin className="size-3.5" /> {cityLabel}, {countryLabel}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-white/50">{contractLabel}</span>
                <span className="text-white/30 text-xs">·</span>
                <span className="text-xs text-white/50">{modeLabel}</span>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <Badge variant="outline" className={`shrink-0 px-3 py-1.5 text-xs font-semibold ${status.badge}`}>
            <span className={`mr-2 inline-block size-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </Badge>
        </div>
      </div>

      {/* ── Quick Stats ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Département", value: deptLabel },
          { label: "Lieu", value: `${cityLabel}, ${countryLabel}` },
          { label: "Contrat", value: contractLabel },
          { label: "Mode de travail", value: modeLabel },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</span>
            <span className="text-sm font-bold text-foreground">{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <Tabs defaultValue="description" className="flex flex-col gap-6">
        <TabsList className="h-auto w-full justify-start gap-6 rounded-none border-b border-border bg-transparent p-0">
          {[
            { value: "description", label: "Description" },
            { value: "requirements", label: "Prérequis" },
            { value: "benefits", label: "Avantages" },
          ].map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-none border-b-2 border-b-transparent px-2 pb-3 pt-2 font-medium text-muted-foreground shadow-none data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Description */}
        <TabsContent value="description" className="mt-0 outline-none animate-in fade-in duration-300">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="size-4 text-primary" />
              Le poste
            </div>
            {job.shortDesc ? (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{job.shortDesc}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Aucune description disponible.</p>
            )}
          </div>
        </TabsContent>

        {/* Requirements */}
        <TabsContent value="requirements" className="mt-0 outline-none animate-in fade-in duration-300">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ListChecks className="size-4 text-primary" />
              Profil recherché
            </div>
            {job.requirements?.length ? (
              <ul className="space-y-2">
                {job.requirements.map((req, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    {req}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">Aucun prérequis spécifié.</p>
            )}
          </div>
        </TabsContent>

        {/* Benefits */}
        <TabsContent value="benefits" className="mt-0 outline-none animate-in fade-in duration-300">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Gift className="size-4 text-primary" />
              Avantages
            </div>
            {job.benefits?.length ? (
              <ul className="space-y-2">
                {job.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {b}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">Aucun avantage spécifié.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
