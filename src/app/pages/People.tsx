// src/pages/People.tsx
"use client"

import * as React from "react"
import { 
  IconPencil, 
  IconTrash, 
  IconPhone,        // NEW
  IconDotsVertical  // NEW
} from "@tabler/icons-react"


import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import {
  DropdownMenu,
  DropdownMenuContent, // NEW
  DropdownMenuTrigger, // NEW
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { makeDrawerTriggerColumn } from "@/components/data-table-helpers"
import type { FilterConfig, GroupByConfig } from "@/components/data-table"

import ImportDialog from "@/components/common/ImportDialog"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import peopleApi, { type Person, type PersonRole } from "@/api/people"
import { ApiError } from "@/api/apiService"

/* -------------------------- Role normalization -------------------------- */

// Accept common English/French/typo variants and normalize.
function normalizeRole(val: unknown): PersonRole | undefined {
  const s = String(val ?? "").trim().toLowerCase()

  switch (s) {
    // driver
    case "driver":
    case "chauffeur":
      return "driver"

    // owner
    case "owner":
    case "proprietaire":
    case "propriétaire":
      return "owner"

    // conductor (receveur / contrôleur variants)
    case "conductor":
    case "receveur":
    case "controleur":
    case "contrôleur":
    case "controller":
      return "conductor"

    default:
      return undefined
  }
}

/* -------------------------- i18n helpers -------------------------- */

const ROLE_LABELS: Record<PersonRole, string> = {
  driver: "Chauffeur",
  owner: "Propriétaire",
  conductor: "Contrôleur",
}
const frRole = (r?: PersonRole | null) => (r ? (ROLE_LABELS[r] ?? r) : "—")

type PersonStatus = NonNullable<Person["status"]>
const STATUS_LABELS: Partial<Record<PersonStatus, string>> = {
  active: "Actif",
  inactive: "Inactif",
}
const frStatus = (s?: Person["status"] | null) => (s ? (STATUS_LABELS[s as PersonStatus] ?? String(s)) : "—")

/* -------------------------- Error helper -------------------------- */

function showValidationErrors(err: unknown) {
  const e = err as ApiError
  if (e?.payload?.errors) {
    const lines = Object.entries(e.payload.errors).map(([k, v]) => {
      const msg = Array.isArray(v) ? v[0] : v
      return `${k}: ${msg}`
    })
    if (lines.length) {
      toast.error(lines.join("\n"))
      return
    }
  }
  toast.error((e as any)?.message ?? "Erreur inconnue.")
}

/* -------------------------- Add / Edit Person dialog ------------------------ */

type AddEditPersonDialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Person | null
  onSubmit: (p: Person) => void
}

function AddEditPersonDialog({ open, onOpenChange, editing, onSubmit }: AddEditPersonDialogProps) {
  const [form, setForm] = React.useState<Partial<Person>>({})

  React.useEffect(() => {
    // Normalize any incoming role into the select's expected values
    const norm = normalizeRole((editing as any)?.role) ?? (editing?.role as PersonRole) ?? "driver"
    setForm(editing ? { ...editing, role: norm } : { role: "driver" })
  }, [editing, open])

  function set<K extends keyof Person>(key: K, val: Person[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function handleSubmit() {
    const role = normalizeRole((form.role as any)) ?? "driver"
    const payload: Person = {
      id: editing?.id ?? crypto.randomUUID(),
      role,
      name: String(form.name ?? "").trim(),
      phone: form.phone ? String(form.phone).trim() : undefined,
      email: form.email ? String(form.email).trim() : undefined,
      licenseNo: role === "driver" ? (form.licenseNo ? String(form.licenseNo).trim() : undefined) : undefined,
      createdAt: editing?.createdAt ?? undefined,
      status: (form.status as Person["status"]) ?? editing?.status ?? "active",
    }

    if (!payload.name) {
      toast.error("Le nom est obligatoire.")
      return
    }

    onSubmit(payload)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier la personne" : "Ajouter une personne"}</DialogTitle>
          <DialogDescription>
            Renseignez les informations d’identité, de contact et le rôle.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Nom</Label>
            <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value as any)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Téléphone (optionnel)</Label>
            <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value as any)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Email (optionnel)</Label>
            <Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value as any)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Rôle</Label>
            <Select
              value={(form.role as PersonRole) ?? "driver"}
              onValueChange={(v) => {
                // Keep form normalized as the user changes the select
                const nr = normalizeRole(v) ?? "driver"
                set("role", nr as PersonRole)
                if (nr !== "driver") set("licenseNo", undefined as any)
              }}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="driver">Chauffeur</SelectItem>
                <SelectItem value="owner">Propriétaire</SelectItem>
                <SelectItem value="conductor">Contrôleur</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(form.role as PersonRole) === "driver" && (
            <div className="grid gap-1.5">
              <Label>N° de permis (chauffeurs)</Label>
              <Input
                value={form.licenseNo ?? ""}
                onChange={(e) => set("licenseNo", e.target.value as any)}
                placeholder="Ex: DL-123456"
              />
            </div>
          )}

          <div className="grid gap-1.5">
            <Label>Statut</Label>
            <Select
              value={(form.status as Person["status"]) ?? "active"}
              onValueChange={(v) => set("status", v as Person["status"])}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner un statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="inactive">Inactif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit}>{editing ? "Enregistrer" : "Ajouter"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------- People page -------------------------------- */

export default function PeoplePage() {
  const [rows, setRows] = React.useState<Person[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Person | null>(null)
  const [openImport, setOpenImport] = React.useState(false)

  const reload = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await peopleApi.list({ per_page: 100 })
      // Normalize roles coming from backend variants (e.g., "receveur", "contrôleur", etc.)
      const normalized = (res.data.rows ?? []).map((r: any) => {
        const rawRole = r.role ?? r.type ?? r.role_name
        const nr = normalizeRole(rawRole) ?? normalizeRole(String(rawRole || ""))
        return { ...r, role: nr ?? r.role } as Person
      })
      setRows(normalized)
    } catch (e) {
      showValidationErrors(e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      await reload()
      if (!alive) return
    })()
    return () => { alive = false }
  }, [reload])

  const searchable = {
    placeholder: "Rechercher nom, téléphone, email…",
    fields: ["name", "phone", "email", "licenseNo"] as (keyof Person)[],
  }

  const filters: FilterConfig<Person>[] = [
    {
      id: "role",
      label: "Rôle",
      options: [
        { label: ROLE_LABELS.driver, value: "driver" },
        { label: ROLE_LABELS.owner, value: "owner" },
        { label: ROLE_LABELS.conductor, value: "conductor" },
      ],
      accessor: (p) => normalizeRole(p.role) ?? "",
      defaultValue: "",
    },
    {
      id: "status",
      label: "Statut",
      options: [
        { label: "Actif", value: "active" },
        { label: "Inactif", value: "inactive" },
      ],
      accessor: (p) => p.status ?? "",
      defaultValue: "",
    },
  ]


  const isServerId = (id: string) => /^\d+$/.test(id)

const columns = React.useMemo<ColumnDef<Person>[]>(() => {
    return [
      // ... (Keep existing drawer/role/status/phone/email/license columns) ...
      makeDrawerTriggerColumn<Person>("name", { /*...*/ }),
      { accessorKey: "role", /*...*/ },
      { accessorKey: "status", /*...*/ },
      { accessorKey: "phone", /*...*/ },
      { accessorKey: "email", /*...*/ },
      { accessorKey: "licenseNo", /*...*/ },

      // NEW: Custom Actions Column
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => {
          const p = row.original
          
          return (
            <div className="flex items-center justify-end gap-1">
              {/* 1. Phone Button (Visible outside menu) */}
              {p.phone ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                  onClick={() => window.location.href = `tel:${p.phone}`}
                  title={`Appeler ${p.phone}`}
                >
                  <IconPhone className="h-4 w-4" />
                </Button>
              ) : (
                <div className="w-8" /> /* Spacer if no phone */
              )}

              {/* 2. Three Dots Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    <IconDotsVertical className="h-4 w-4" />
                    <span className="sr-only">Menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditing(p); setOpen(true) }}>
                    <IconPencil className="mr-2 h-4 w-4" /> Modifier
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                    onClick={async () => {
                      const prev = rows
                      setRows((r) => r.filter((x) => x.id !== p.id))
                      try {
                        if (isServerId(p.id)) {
                          await peopleApi.remove(p.id)
                          toast("Personne supprimée.")
                        } else {
                          toast("Élément local supprimé.")
                        }
                      } catch (e) {
                        setRows(prev)
                        showValidationErrors(e)
                      }
                    }}
                  >
                    <IconTrash className="mr-2 h-4 w-4" /> Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
        size: 80, // Slightly wider to fit both buttons
      },
    ]
  }, [rows, isServerId]) // Add dependencies needed for the actions

  /* ------------------------- Row action handlers ------------------------- */

  function renderRowActions(p: Person) {
    return (
      <>
        <DropdownMenuItem onClick={() => { setEditing(p); setOpen(true) }}>
          <IconPencil className="mr-2 h-4 w-4" /> Modifier
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-rose-600"
          onClick={async () => {
            const prev = rows
            setRows((r) => r.filter((x) => x.id !== p.id))
            try {
              if (isServerId(p.id)) {
                await peopleApi.remove(p.id)
                toast("Personne supprimée.")
              } else {
                toast("Élément local supprimé.")
              }
            } catch (e) {
              setRows(prev)
              showValidationErrors(e)
            }
          }}
        >
          <IconTrash className="mr-2 h-4 w-4" /> Supprimer
        </DropdownMenuItem>
      </>
    )
  }

  const groupBy: GroupByConfig<Person>[] = [
    {
      id: "role",
      label: "Rôle",
      accessor: (r: Person) => frRole(normalizeRole(r.role) ?? (r.role as PersonRole)),
      sortGroups: (a, b) => a.localeCompare(b, "fr"),
    },
    {
      id: "status",
      label: "Statut",
      accessor: (r: Person) => frStatus(r.status),
      sortGroups: (a, b) => a.localeCompare(b, "fr"),
    },
  ]

  const getRowId = (r: Person) => String(r.id)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Chauffeurs & Propriétaires</h1>
          <p className="text-sm text-muted-foreground">
            Onboarding des chauffeurs, des contrôleurs, gestion des permis et contrats des propriétaires.
          </p>
        </div>
      </div>

      <DataTable<Person>
        data={rows}
        columns={columns}
        getRowId={getRowId}
        searchable={searchable}
        filters={filters}
        loading={loading}
        onAdd={() => { setEditing(null); setOpen(true) }}
        addLabel="Ajouter une personne"
        onImport={() => setOpenImport(true)}
        importLabel="Importer"
        // renderRowActions={renderRowActions}
        groupBy={groupBy}
        initialView="list"
        pageSizeOptions={[10, 20, 50]}
        onDeleteSelected={async (selected) => {
          if (selected.length === 0) return
          const prev = rows
          setRows((r) => r.filter((p) => !selected.some((s) => s.id === p.id)))
          try {
            await Promise.all(
              selected
                .filter(s => isServerId(s.id))
                .map(s => peopleApi.remove(s.id))
            )
            toast(`${selected.length} personne(s) supprimée(s).`)
          } catch (e) {
            setRows(prev)
            showValidationErrors(e)
          }
        }}
      />

      <AddEditPersonDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSubmit={async (person) => {
          if (editing) {
            const prev = rows
            setRows((r) => r.map(x => x.id === person.id ? { ...x, ...person } : x))
            try {
              await peopleApi.update(person.id, person)
              await reload()
              toast("Profil mis à jour.")
            } catch (e) {
              setRows(prev)
              showValidationErrors(e)
            } finally {
              setEditing(null)
            }
          } else {
            const tempId = person.id
            setRows((r) => [person, ...r])
            try {
              await peopleApi.create(person)
              await reload()
              toast("Personne ajoutée.")
            } catch (e) {
              setRows((r) => r.filter(x => x.id !== tempId))
              showValidationErrors(e)
            }
          }
        }}
      />

      <ImportDialog<Person>
        open={openImport}
        onOpenChange={setOpenImport}
        title="Importer des personnes"
        description="Chargez un CSV/Excel, mappez les colonnes, puis validez l'import."
        fields={[
          { key: "name", label: "Nom", required: true },
          { key: "role", label: "Rôle", required: true },
          { key: "phone", label: "Téléphone" },
          { key: "email", label: "Email" },
          { key: "licenseNo", label: "N° de permis (chauffeurs)" },
        ]}
        sampleHeaders={["name", "role", "phone", "email", "license_no"]}
        transform={(raw) => {
          const norm = (v: string | null | undefined) => (typeof v === "string" ? v.trim() : v)

          const name = String(norm(raw.name) ?? "")
          if (!name) return null

          // Normalize any role variants on import
          const rawRole = norm(raw.role) ?? ""
          const role = normalizeRole(rawRole) ?? "driver"

          const phone = (norm(raw.phone) ?? undefined) as string | undefined
          const email = (norm(raw.email) ?? undefined) as string | undefined
          const licenseNoSrc = ((norm((raw as any).license_no) ?? norm((raw as any).licenseNo)) ?? undefined) as string | undefined

          const person: Person = {
            id: crypto.randomUUID(),
            role,
            name,
            phone,
            email,
            licenseNo: role === "driver" ? licenseNoSrc : undefined,
            createdAt: undefined,
            status: "active",
          }
          return person
        }}
        onConfirm={async (imported) => {
          const prev = rows
          setRows((r) => [...imported, ...r])
          try {
            await Promise.all(imported.map(p => peopleApi.create(p)))
            await reload()
            toast(`Import réussi (${imported.length} personne${imported.length > 1 ? "s" : ""}).`)
          } catch (e) {
            setRows(prev)
            showValidationErrors(e)
          }
        }}
      />
    </div>
  )
}
