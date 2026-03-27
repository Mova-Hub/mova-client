"use client"

import * as React from "react"
import { IconTrash, IconFileText, IconMail } from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { makeDrawerTriggerColumn } from "@/components/data-table-helpers"
import type { FilterConfig, GroupByConfig } from "@/components/data-table"

import jobApi, { type Candidate, type Job, getLabel, CANDIDATE_STATUSES, type CandidateStatus } from "@/api/job"
import { ApiError } from "@/api/apiService"
import { Button } from "../ui/button"

export function CandidatesTab({ jobs }: { jobs: Job[] }) {
  const [rows, setRows] = React.useState<Candidate[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)

  const reload = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await jobApi.listCandidates({ per_page: 100 })
      setRows(res.data.rows)
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors du chargement des candidatures.")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    reload()
  }, [reload])

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 border-amber-300",
    reviewed: "bg-blue-100 text-blue-800 border-blue-300",
    accepted: "bg-green-100 text-green-800 border-green-300",
    rejected: "bg-red-100 text-red-800 border-red-300",
  }

  // Filtres
  const filters: FilterConfig<Candidate>[] = [
    {
      id: "status",
      label: "Statut",
      options: CANDIDATE_STATUSES,
      accessor: (c) => c.status,
      defaultValue: "",
    },
    {
      id: "jobId",
      label: "Poste",
      options: jobs.map(j => ({ value: j.id, label: j.title })),
      accessor: (c) => c.jobId,
      defaultValue: "",
    },
  ]

  // Fonction de mise à jour rapide depuis le Drawer
  const handleUpdateStatus = async (c: Candidate, newStatus: CandidateStatus, notes?: string) => {
    try {
      await jobApi.updateCandidate(c.id, { status: newStatus, notes: notes ?? c.notes })
      toast.success("Candidature mise à jour.")
      reload()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const columns = React.useMemo<ColumnDef<Candidate>[]>(() => [
    makeDrawerTriggerColumn<Candidate>("firstName", {
      triggerField: "firstName",
      renderTrigger: (c) => (
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 font-bold rounded-full bg-primary/10 text-primary">
            {c.firstName.charAt(0)}{c.lastName.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{c.firstName} {c.lastName}</div>
            <div className="text-xs truncate text-muted-foreground">{c.job?.title ?? "Offre inconnue"}</div>
          </div>
        </div>
      ),
      renderTitle: (c) => (
        <div className="flex flex-col gap-1">
          <span className="text-xl font-bold">{c.firstName} {c.lastName}</span>
          <span className="text-sm font-normal text-muted-foreground">Postule pour : {c.job?.title}</span>
        </div>
      ),
      renderBody: (c) => (
        <div className="grid gap-6 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`px-2 ${statusColors[c.status]}`}>
              {getLabel(CANDIDATE_STATUSES, c.status)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Reçu le {c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR') : "—"}
            </span>
          </div>

          <div className="p-4 border rounded-md bg-muted/30">
            <h4 className="mb-2 font-semibold text-muted-foreground">Contact</h4>
            <div className="flex items-center gap-2 mb-1">
              <IconMail className="w-4 h-4" /> <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>
            </div>
            {c.phone && <div className="text-muted-foreground">{c.phone}</div>}
          </div>

          <div>
            <h4 className="pb-1 mb-2 font-semibold border-b">Pièces Jointes</h4>
            <div className="flex gap-3">
              {c.resumeUrl ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={c.resumeUrl} target="_blank" rel="noopener noreferrer">
                    <IconFileText className="w-4 h-4 mr-2" /> Voir le CV
                  </a>
                </Button>
              ) : <span className="text-xs italic text-muted-foreground">Aucun CV</span>}
              
              {c.coverLetterUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={c.coverLetterUrl} target="_blank" rel="noopener noreferrer">
                    <IconFileText className="w-4 h-4 mr-2" /> Lettre de motivation
                  </a>
                </Button>
              )}
            </div>
          </div>

          <div className="p-4 space-y-3 border rounded-md bg-muted/10">
            <h4 className="font-semibold">Gestion RH</h4>
            <div className="grid gap-1.5">
              <Label>Mettre à jour le statut</Label>
              <Select value={c.status} onValueChange={(val: CandidateStatus) => handleUpdateStatus(c, val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CANDIDATE_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 mt-2">
              <Label>Notes internes</Label>
              <Textarea 
                defaultValue={c.notes ?? ""} 
                onBlur={(e) => handleUpdateStatus(c, c.status, e.target.value)}
                placeholder="Ex: Excellent profil, à rappeler..." 
                rows={3}
              />
              <span className="text-[10px] text-muted-foreground">Les notes sont sauvegardées en quittant le champ.</span>
            </div>
          </div>
        </div>
      ),
    }),
    {
      accessorKey: "email",
      header: "Contact",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
    },
    {
      accessorKey: "status",
      header: () => <div className="text-right">Statut</div>,
      cell: ({ row }) => (
        <div className="flex justify-end">
           <Badge variant="outline" className={statusColors[row.original.status]}>
             {getLabel(CANDIDATE_STATUSES, row.original.status)}
           </Badge>
        </div>
      ),
    },
  ], [jobs])

  function renderRowActions(c: Candidate) {
    return (
      <DropdownMenuItem
        className="text-rose-600"
        onClick={async () => {
          const prev = rows
          setRows((r) => r.filter(x => x.id !== c.id))
          try {
            await jobApi.removeCandidate(c.id)
            toast.success("Candidature supprimée.")
          } catch (e: any) {
            setRows(prev)
            toast.error(e.message)
          }
        }}
      >
        <IconTrash className="w-4 h-4 mr-2" /> Supprimer
      </DropdownMenuItem>
    )
  }
  
  const groupBy: GroupByConfig<Candidate>[] = [
    { id: "status", label: "Statut", accessor: (c) => getLabel(CANDIDATE_STATUSES, c.status) },
    { id: "jobId", label: "Poste", accessor: (c) => c.job?.title ?? "Inconnu" },
  ]

  return (
    <DataTable<Candidate>
      data={rows}
      columns={columns}
      getRowId={(c) => String(c.id)}
      searchable={{ placeholder: "Rechercher un nom ou un email...", fields: ["firstName", "lastName", "email"] }}
      filters={filters}
      loading={loading}
      renderRowActions={renderRowActions}
      groupBy={groupBy}
      initialView="list"
      onDeleteSelected={async (selected) => {
        if (selected.length === 0) return
        const prev = rows
        setRows((r) => r.filter((p) => !selected.some((s) => s.id === p.id)))
        try {
          await Promise.all(selected.map(s => jobApi.removeCandidate(s.id)))
          toast.success(`${selected.length} candidature(s) supprimée(s).`)
        } catch (e: any) {
          setRows(prev)
          toast.error(e.message)
        }
      }}
    />
  )
}