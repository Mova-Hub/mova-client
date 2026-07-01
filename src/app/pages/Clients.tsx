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
import type { FilterConfig, GroupByConfig } from "@/components/data-table"

import clientApi, { type Client } from "@/api/client"
import { ApiError } from "@/api/apiService"
import { ClientDetailsDialog } from "@/components/clients/ClientDetailsDialog"

function showValidationErrors(err: unknown) {
  const e = err as ApiError
  toast.error((e as any)?.message ?? "Erreur de chargement.")
}

export default function ClientsPage() {
  const [rows, setRows] = React.useState<Client[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [total, setTotal] = React.useState(0)

  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)

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
    {
      accessorKey: "name",
      header: "Client",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.name}</span>
          <span className="text-xs text-muted-foreground">{row.original.phone}</span>
        </div>
      ),
    },
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

  /* ---------------- Filters & GroupBy ---------------- */
  const filters: FilterConfig<Client>[] = [
    {
      id: "hasEmail",
      label: "Email",
      options: [
        { label: "Avec email", value: "yes" },
        { label: "Sans email", value: "no" },
      ],
      accessor: (c) => (c.email ? "yes" : "no"),
    },
    {
      id: "activity",
      label: "Connexion",
      options: [
        { label: "Déjà connecté", value: "connected" },
        { label: "Jamais connecté", value: "never" },
      ],
      accessor: (c) => (c.lastLoginAt ? "connected" : "never"),
    },
  ]

  const groupBy: GroupByConfig<Client>[] = [
    {
      id: "orders",
      label: "Nombre de commandes",
      accessor: (c) => {
        const n = c.ordersCount ?? 0
        if (n === 0) return "Aucune commande"
        if (n <= 3) return "1 – 3 commandes"
        if (n <= 10) return "4 – 10 commandes"
        return "10+ commandes"
      },
      sortGroups: (a, b) => {
        const order = ["Aucune commande", "1 – 3 commandes", "4 – 10 commandes", "10+ commandes"]
        return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99)
      },
    },
    {
      id: "activity",
      label: "Activité récente",
      accessor: (c) => {
        if (!c.lastLoginAt) return "Jamais connecté"
        const days = Math.floor(
          (Date.now() - new Date(c.lastLoginAt).getTime()) / 86_400_000
        )
        if (days <= 7) return "Actif (7 derniers jours)"
        if (days <= 30) return "Actif (30 derniers jours)"
        return "Inactif (> 30 jours)"
      },
      sortGroups: (a, b) => {
        const order = [
          "Actif (7 derniers jours)",
          "Actif (30 derniers jours)",
          "Inactif (> 30 jours)",
          "Jamais connecté",
        ]
        return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99)
      },
    },
  ]

  /* ---------------- Actions ---------------- */
  function renderRowActions(client: Client) {
    return (
      <DropdownMenuItem onClick={() => {
        setSelectedClient(client)
        setDetailOpen(true)
      }}>
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
        filters={filters}
        groupBy={groupBy}
        renderRowActions={renderRowActions}
        renderRowDetailTitle={(c) => c.name}
        renderRowDetail={(c) => (
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
        )}
      />

      {/* Client Details Dialog Component */}
      <ClientDetailsDialog
        client={selectedClient} 
        open={detailOpen} 
        onOpenChange={setDetailOpen} 
      />
    </div>
  )
}