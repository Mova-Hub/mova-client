// src/pages/Clients.tsx
"use client"

import * as React from "react"
import { IconEye, IconPhone, IconMail } from "@tabler/icons-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import { makeDrawerTriggerColumn } from "@/components/data-table-helpers"

import clientApi, { type Client } from "@/api/client"
import { ApiError } from "@/api/apiService"

function showValidationErrors(err: unknown) {
  const e = err as ApiError
  toast.error((e as any)?.message ?? "Erreur de chargement.")
}

export default function ClientsPage() {
  const [rows, setRows] = React.useState<Client[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [total, setTotal] = React.useState(0)

  // Basic server-side pagination state
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 })

  const fetchClients = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await clientApi.list({
        page: pagination.pageIndex + 1,
        per_page: pagination.pageSize,
      })
      setRows(res.data.rows)
      setTotal(res.data.meta?.total ?? 0)
    } catch (e) {
      showValidationErrors(e)
    } finally {
      setLoading(false)
    }
  }, [pagination])

  React.useEffect(() => {
    fetchClients()
  }, [fetchClients])

  /* ---------------- Columns ---------------- */
  const columns = React.useMemo<ColumnDef<Client>[]>(() => [
    makeDrawerTriggerColumn<Client>("name", {
      triggerField: "name",
      // headerLabel: "Client",
      renderTrigger: (c) => (
        <div className="flex flex-col">
          <span className="font-medium">{c.name}</span>
          <span className="text-xs text-muted-foreground">{c.phone}</span>
        </div>
      ),
      renderTitle: (c) => c.name,
      renderBody: (c) => (
        <div className="space-y-4">
          <div className="grid gap-2 text-sm">
            <div className="flex items-center gap-2">
              <IconPhone className="h-4 w-4 text-muted-foreground" />
              <span>{c.phone}</span>
            </div>
            {c.email && (
              <div className="flex items-center gap-2">
                <IconMail className="h-4 w-4 text-muted-foreground" />
                <span>{c.email}</span>
              </div>
            )}
          </div>
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">Statistiques</p>
            <p>Commandes passées : {c.ordersCount}</p>
            <p>Inscrit le : {c.createdAt ? new Date(c.createdAt).toLocaleDateString("fr-FR") : "—"}</p>
          </div>
        </div>
      ),
    }),
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => row.original.email ?? "—",
    },
    {
      accessorKey: "ordersCount",
      header: () => <div className="text-right">Commandes</div>,
      cell: ({ row }) => <div className="text-right font-medium">{row.original.ordersCount}</div>,
    },
    {
      accessorKey: "lastLoginAt",
      header: "Dernière connexion",
      cell: ({ row }) => {
        const d = row.original.lastLoginAt
        return d ? new Date(d).toLocaleDateString("fr-FR") : <span className="text-muted-foreground italic">Jamais</span>
      },
    },
  ], [])

  /* ---------------- Actions ---------------- */
  function renderRowActions(client: Client) {
    return (
      <DropdownMenuItem onClick={() => toast("Fonctionnalité Vue détaillée à venir")}>
        <IconEye className="mr-2 h-4 w-4" /> Voir détails
      </DropdownMenuItem>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Clients</h1>
        <p className="text-sm text-muted-foreground">
          Base de données des utilisateurs de l'application mobile.
        </p>
      </div>

      <DataTable<Client>
        data={rows}
        columns={columns}
        loading={loading}
        // Server side pagination props
        rowCount={total}
        pagination={pagination}
        onPaginationChange={setPagination}
        
        getRowId={(r) => r.id}
        searchable={{ placeholder: "Rechercher par nom ou téléphone...", fields: ["name", "phone"] }}
        renderRowActions={renderRowActions}
      />
    </div>
  )
}