"use client"

import * as React from "react"
import { IconPencil, IconTrash, IconBriefcase } from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ColumnDef } from "@tanstack/react-table"

import { DataTable } from "@/components/data-table"
import { makeDrawerTriggerColumn } from "@/components/data-table-helpers"
import type { FilterConfig, GroupByConfig } from "@/components/data-table"

import jobApi, { 
  type Job, getLabel, JOB_STATUSES, WORK_MODES, CONTRACT_TYPES, 
  DEFAULT_DEPARTMENTS, DEFAULT_CITIES, DEFAULT_COUNTRIES 
} from "@/api/job"
import { ApiError } from "@/api/apiService"
import AddEditJobDialog from "@/components/jobs/AddEditJobDialog"
import { CandidatesTab } from "@/components/jobs/CandidatesTab"

function showValidationErrors(err: unknown) {
  const e = err as ApiError
  if (e?.payload?.errors) {
    const lines = Object.entries(e.payload.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
    if (lines.length) {
      toast.error(lines.join("\n"))
      return
    }
  }
  toast.error((e as any)?.message ?? "Erreur inconnue.")
}

export default function JobsPage() {
  const [rows, setRows] = React.useState<Job[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Job | null>(null)

  const reload = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await jobApi.list({ per_page: 100 })
      setRows(res.data.rows)
    } catch (e) {
      showValidationErrors(e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    reload()
  }, [reload])

  const allDepts = React.useMemo(() => {
    const map = new Map<string, string>()
    DEFAULT_DEPARTMENTS.forEach(d => map.set(d.value, d.label))
    rows.forEach(j => { if (j.department && !map.has(j.department)) map.set(j.department, j.department) })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [rows])
  
  const allLocs = React.useMemo(() => {
    const map = new Map<string, string>()
    DEFAULT_CITIES.forEach(d => map.set(d.value, d.label))
    rows.forEach(j => { if (j.location && !map.has(j.location)) map.set(j.location, j.location) })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [rows])
  
  const allCountries = React.useMemo(() => {
    const map = new Map<string, string>()
    DEFAULT_COUNTRIES.forEach(d => map.set(d.value, d.label))
    rows.forEach(j => { if (j.country && !map.has(j.country)) map.set(j.country, j.country) })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [rows])

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800 border-gray-300",
    open: "bg-green-100 text-green-800 border-green-300",
    closed: "bg-red-100 text-red-800 border-red-300",
  }

  const filters: FilterConfig<Job>[] = [
    { id: "status", label: "Statut", options: JOB_STATUSES, accessor: (j) => j.status ?? "", defaultValue: "" },
    { id: "department", label: "Département", options: allDepts, accessor: (j) => j.department ?? "", defaultValue: "" },
  ]

  const columns = React.useMemo<ColumnDef<Job>[]>(() => [
    makeDrawerTriggerColumn<Job>("title", {
      triggerField: "title",
      renderTrigger: (j) => (
        <div className="flex items-center gap-3">
          <IconBriefcase className="w-8 h-8 p-1.5 rounded-md bg-accent text-muted-foreground" />
          <div className="min-w-0">
            <div className="font-semibold truncate text-primary">{j.title}</div>
            <div className="text-xs truncate text-muted-foreground">
              {getLabel(allDepts, j.department)} • {getLabel(CONTRACT_TYPES, j.contractType)}
            </div>
          </div>
        </div>
      ),
      renderTitle: (j) => (
        <div className="flex flex-col gap-1">
          <span className="text-xl font-bold">{j.title}</span>
          <span className="text-sm font-normal text-muted-foreground">
            {getLabel(allDepts, j.department)} — {getLabel(allLocs, j.location)}, {getLabel(allCountries, j.country)}
          </span>
        </div>
      ),
      renderBody: (j) => (
        <div className="grid gap-6 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="px-2">{getLabel(WORK_MODES, j.workMode)}</Badge>
            <Badge variant="secondary" className="px-2">{getLabel(CONTRACT_TYPES, j.contractType)}</Badge>
            <Badge variant="outline" className={`px-2 ${statusColors[j.status]}`}>
              {getLabel(JOB_STATUSES, j.status)}
            </Badge>
          </div>
          <div><h4 className="pb-1 mb-1 font-semibold border-b">Le Poste</h4><p className="leading-relaxed text-muted-foreground">{j.shortDesc || "—"}</p></div>
          <div><h4 className="pb-1 mb-2 font-semibold border-b">Responsabilités</h4><ul className="pl-5 space-y-1 list-disc text-muted-foreground">{j.responsibilities?.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
          <div><h4 className="pb-1 mb-2 font-semibold border-b">Profil Recherché</h4><ul className="pl-5 space-y-1 list-disc text-muted-foreground">{j.requirements?.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
          <div><h4 className="pb-1 mb-2 font-semibold border-b">Avantages</h4><ul className="pl-5 space-y-1 list-disc text-muted-foreground">{j.benefits?.map((r, i) => <li key={i}>{r}</li>)}</ul></div>
        </div>
      ),
      
    }),
    { accessorKey: "location", header: "Lieu", cell: ({ row }) => <span className="text-muted-foreground">{getLabel(allLocs, row.original.location)}</span> },
    { accessorKey: "workMode", header: "Mode", cell: ({ row }) => <Badge variant="secondary">{getLabel(WORK_MODES, row.original.workMode)}</Badge> },
    {
      accessorKey: "status", header: () => <div className="text-right">Statut</div>,
      cell: ({ row }) => (
        <div className="flex justify-end"><Badge variant="outline" className={statusColors[row.original.status]}>{getLabel(JOB_STATUSES, row.original.status)}</Badge></div>
      ),
    },
  ], [rows, allDepts, allLocs, allCountries])

  function renderRowActions(j: Job) {
    return (
      <>
        <DropdownMenuItem onClick={() => { setEditing(j); setOpen(true) }}><IconPencil className="w-4 h-4 mr-2" /> Modifier</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-rose-600" onClick={async () => {
          const prev = rows; setRows((r) => r.filter(x => x.id !== j.id));
          try { await jobApi.remove(j.id); toast.success("Offre supprimée.") } 
          catch (e: any) { setRows(prev); showValidationErrors(e) }
        }}>
          <IconTrash className="w-4 h-4 mr-2" /> Supprimer
        </DropdownMenuItem>
      </>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Recrutement</h1>
          <p className="text-sm text-muted-foreground">Gérez les offres d'emploi et suivez les candidatures.</p>
        </div>
      </div>

      {/* TABS IMPLEMENTATION */}
      <Tabs defaultValue="jobs" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 md:w-80">
          <TabsTrigger className="cursor-pointer" value="jobs">Offres d'emploi</TabsTrigger>
          <TabsTrigger className="cursor-pointer" value="candidates">Candidatures</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <DataTable<Job>
            data={rows}
            columns={columns}
            getRowId={(j) => String(j.id)}
            searchable={{ placeholder: "Rechercher un poste...", fields: ["title", "department"] }}
            filters={filters}
            loading={loading}
            onAdd={() => { setEditing(null); setOpen(true) }}
            addLabel="Créer une offre"
            renderRowActions={renderRowActions}
            groupBy={[ { id: "department", label: "Département", accessor: (j) => getLabel(allDepts, j.department) } ]}
            initialView="list"
          />
        </TabsContent>

        <TabsContent value="candidates">
          {/* Composant importé ! */}
          <CandidatesTab jobs={rows} />
        </TabsContent>
      </Tabs>

      <AddEditJobDialog
        open={open} onOpenChange={setOpen} editing={editing} existingJobs={rows}
        onSubmit={async (job) => {
          if (editing) {
            const prev = rows; setRows((r) => r.map(x => x.id === job.id ? { ...x, ...job } : x))
            try { await jobApi.update(job.id, job); await reload(); toast.success("Offre mise à jour.") } 
            catch (e: any) { setRows(prev); showValidationErrors(e) } finally { setEditing(null) }
          } else {
            const tempId = job.id; setRows((r) => [{ ...job }, ...r])
            try { await jobApi.create(job); await reload(); toast.success("Nouvelle offre publiée.") } 
            catch (e: any) { setRows((r) => r.filter(x => x.id !== tempId)); showValidationErrors(e) }
          }
        }}
      />
    </div>
  )
}