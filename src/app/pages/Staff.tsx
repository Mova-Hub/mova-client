// src/pages/Staff.tsx
"use client"

import * as React from "react"
import { IconPencil } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import staffApi, { type Staff, type StaffRole } from "@/api/staff"
import { ApiError } from "@/api/apiService"

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

/* ------------------------- Add/Edit Dialog ------------------------- */

type AddEditStaffDialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Staff | null
  onSubmit: (s: Staff & { password?: string }) => void
}

function AddEditStaffDialog({ open, onOpenChange, editing, onSubmit }: AddEditStaffDialogProps) {
  const [form, setForm] = React.useState<Partial<Staff & { password?: string }>>({})

  React.useEffect(() => {
    setForm(editing ?? { role: "agent" })
  }, [editing, open])

  function set<K extends keyof (Staff & { password?: string })>(key: K, val: (Staff & { password?: string })[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function handleSubmit() {
    const payload: Staff & { password?: string } = {
      id: editing?.id ?? crypto.randomUUID(),
      role: (form.role as StaffRole) ?? "agent",
      name: String(form.name ?? "").trim(),
      phone: form.phone ? String(form.phone).trim() : undefined,
      email: form.email ? String(form.email).trim() : undefined,
      createdAt: editing?.createdAt ?? undefined,
      status: editing?.status ?? undefined,
      password: form.password ? String(form.password) : undefined, // only used on create
    }

    if (!payload.name) {
      toast("Le nom est obligatoire.")
      return
    }

    onSubmit(payload)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier le membre du staff" : "Ajouter un membre du staff"}</DialogTitle>
          <DialogDescription>Renseignez l’identité, le rôle et les coordonnées.</DialogDescription>
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
            <Select value={(form.role as StaffRole) ?? "agent"} onValueChange={(v) => set("role", v as any)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un rôle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Password only on create (optionnel) */}
          {!editing && (
            <div className="grid gap-1.5">
              <Label>Mot de passe (optionnel)</Label>
              <Input type="password" value={form.password ?? ""} onChange={(e) => set("password", e.target.value as any)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit}>{editing ? "Enregistrer" : "Ajouter"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------------- Page ----------------------------------- */

export default function StaffPage() {
  const [rows, setRows] = React.useState<Staff[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Staff | null>(null)
  const [openImport, setOpenImport] = React.useState(false)

  const reload = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await staffApi.list({ per_page: 100 })
      setRows(res.data.rows)
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
    fields: ["name", "phone", "email"] as (keyof Staff)[],
  }

  const filters: FilterConfig<Staff>[] = [
    {
      id: "role",
      label: "Rôle",
      options: [
        { label: "Agent", value: "agent" },
        { label: "Admin", value: "admin" },
      ],
      accessor: (s) => s.role ?? "",
      defaultValue: "",
    },
  ]

  const columns = React.useMemo<ColumnDef<Staff>[]>(() => [
    {
      accessorKey: "name",
      header: "Membre",
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground truncate">{row.original.email ?? row.original.phone ?? "—"}</div>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Rôle",
      cell: ({ row }) => <Badge variant="outline" className="px-1.5 capitalize">{row.original.role}</Badge>,
    },
    {
      accessorKey: "phone",
      header: () => <div className="w-full text-right">Téléphone</div>,
      cell: ({ row }) => <div className="w-full text-right">{row.original.phone ?? "—"}</div>,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="block max-w-[260px] truncate">{row.original.email ?? "—"}</span>,
      enableSorting: false,
    },
  ], [])

  function renderRowActions(s: Staff) {
    return (
      <DropdownMenuItem onClick={() => { setEditing(s); setOpen(true) }}>
        <IconPencil className="mr-2 h-4 w-4" /> Modifier
      </DropdownMenuItem>
    )
  }

  async function handleDeleteRow(s: Staff) {
    const prev = rows
    setRows((r) => r.filter((x) => x.id !== s.id))
    try {
      await staffApi.remove(s.id)
      toast("Membre supprimé.")
    } catch (e: any) {
      setRows(prev)
      showValidationErrors(e)
    }
  }
  
  const groupBy: GroupByConfig<Staff>[] = [
    {
      id: "role",
      label: "Role",
      accessor: (r: Staff) => r.role ?? "—",
    },
  ]
  
  const getRowId = (r: Staff) => String(r.id)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Équipe</h1>
          <p className="text-sm text-muted-foreground">
            Gestion des agents et administrateurs : accès et coordonnées.
          </p>
        </div>
      </div>

      <DataTable<Staff>
        data={rows}
        columns={columns}
        getRowId={getRowId}
        searchable={{ placeholder: "Rechercher nom, téléphone, email…", fields: ["name", "phone", "email"] }}
        filters={filters}
        loading={loading}
        onAdd={() => { setEditing(null); setOpen(true) }}
        addLabel="Ajouter un membre"
        onImport={() => setOpenImport(true)}
        importLabel="Importer"
        renderRowActions={renderRowActions}
        onDeleteRow={handleDeleteRow}
        getDeleteRowLabel={(s) => s.name}
        groupBy={groupBy}
        pageSizeOptions={[10, 20, 50]}
        renderRowDetailTitle={(s) => s.name}
        renderRowDetail={(s) => (
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Rôle :</span>
              <Badge variant="outline" className="px-1.5 capitalize">{s.role}</Badge>
            </div>
            <div><span className="text-muted-foreground">Téléphone :</span> {s.phone ?? "—"}</div>
            <div><span className="text-muted-foreground">Email :</span> {s.email ?? "—"}</div>
          </div>
        )}
        onDeleteSelected={async (selected) => {
          if (selected.length === 0) return
          const prev = rows
          setRows((r) => r.filter((p) => !selected.some((s) => s.id === p.id)))
          try {
            await Promise.all(selected.map(s => staffApi.remove(s.id)))
            toast(`${selected.length} membre(s) supprimé(s).`)
          } catch (e: any) {
            setRows(prev)
            showValidationErrors(e)
          }
        }}
      />

      <AddEditStaffDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSubmit={async (staff) => {
          if (editing) {
            const prev = rows
            setRows((r) => r.map(x => x.id === staff.id ? { ...x, ...staff } : x))
            try {
              await staffApi.update(staff.id, staff)
              await reload()
              toast("Membre mis à jour.")
            } catch (e: any) {
              setRows(prev)
              showValidationErrors(e)
            } finally {
              setEditing(null)
            }
          } else {
            const tempId = staff.id
            const tempRow = { ...staff }
            setRows((r) => [tempRow, ...r])
            try {
              await staffApi.create(staff)
              await reload()
              toast("Membre ajouté.")
            } catch (e: any) {
              setRows((r) => r.filter(x => x.id !== tempId))
              showValidationErrors(e)
            }
          }
        }}
      />

      <ImportDialog<Staff>
        open={openImport}
        onOpenChange={setOpenImport}
        title="Importer le staff"
        description="Chargez un CSV/Excel, mappez les colonnes, puis validez l'import."
        fields={[
          { key: "name", label: "Nom", required: true },
          { key: "role", label: "Rôle", required: true },
          { key: "phone", label: "Téléphone" },
          { key: "email", label: "Email" },
        ]}
        sampleHeaders={["name", "role", "phone", "email"]}
        transform={(raw) => {
          const norm = (v: string | undefined) => (typeof v === "string" ? v.trim() : v)
          const name = String(norm(raw.name) ?? "")
          if (!name) return null

          let role = String(norm(raw.role) ?? "").toLowerCase()
          role = role === "admin" ? "admin" : "agent"

          const phone = norm(raw.phone) || undefined
          const email = norm(raw.email) || undefined

          const staff: Staff = {
            id: crypto.randomUUID(),
            role: role as StaffRole,
            name,
            phone,
            email: email ? String(email) : undefined,
            createdAt: undefined,
            status: "active",
          }
          return staff
        }}
        onConfirm={async (imported) => {
          const prev = rows
          setRows((r) => [...imported, ...r])
          try {
            await Promise.all(imported.map(s => staffApi.create(s)))
            await reload()
            toast(`Import réussi (${imported.length} membre${imported.length > 1 ? "s" : ""}).`)
          } catch (e: any) {
            setRows(prev)
            showValidationErrors(e)
          }
        }}
      />
    </div>
  )
}
