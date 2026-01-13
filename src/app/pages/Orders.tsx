// src/pages/Orders.tsx
"use client"

import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { IconArrowRight, IconEye } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable, type FilterConfig } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"

import orderApi, { type Order, type OrderStatus } from "@/api/order"
import busApi, { type UIBus } from "@/api/bus"
import { OrderDetailDialog } from "@/components/orders/OrderDetailsDialog"

// --- Helpers for Status Colors ---
const STATUS_CONFIG: Record<OrderStatus, { label: string, color: string }> = {
  pending: { label: "Nouveau", color: "bg-blue-100 text-blue-800 border-blue-200" },
  contacted: { label: "Traité / Contacté", color: "bg-amber-100 text-amber-800 border-amber-200" },
  converted: { label: "Converti (Réservation)", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  cancelled: { label: "Annulé", color: "bg-gray-100 text-gray-600 border-gray-200" },
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const conf = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${conf.color}`}>
      {conf.label}
    </span>
  )
}

/* --------------------------------- Page ----------------------------------- */

export default function OrdersPage() {
  const [rows, setRows] = React.useState<Order[]>([])
  const [buses, setBuses] = React.useState<UIBus[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 })
  const [total, setTotal] = React.useState(0)
  
  // Filter state
  const [statusFilter, setStatusFilter] = React.useState<OrderStatus | "">("")

  // Dialog state
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true)
      const [orderRes, busRes] = await Promise.all([
        orderApi.list({
          status: statusFilter,
          page: pagination.pageIndex + 1,
          per_page: pagination.pageSize,
        }),
        busApi.list({ per_page: 500 }) 
      ])
      
      setRows(orderRes.data.rows)
      setTotal(orderRes.data.meta?.total ?? 0)
      setBuses(busRes.data.rows)
    } catch (e) {
      toast.error("Impossible de charger les données")
    } finally {
      setLoading(false)
    }
  }, [pagination, statusFilter])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  function openOrder(order: Order) {
    setSelectedOrder(order)
    setDialogOpen(true)
  }

  /* ---------------- Columns ---------------- */
  const columns = React.useMemo<ColumnDef<Order>[]>(() => [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">#{row.original.id}</span>,
      size: 60,
    },
    {
      accessorKey: "client",
      header: "Client",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.contactName}</div>
          <div className="text-xs text-muted-foreground">{row.original.contactPhone}</div>
        </div>
      ),
    },
    {
      accessorKey: "eventType",
      header: "Type",
      cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.eventType.replace('_', ' ')}</Badge>,
    },
    {
      id: "route",
      header: "Trajet & Date",
      cell: ({ row }) => {
        const o = row.original
        return (
          <div className="text-sm">
            <div className="flex items-center gap-1 font-medium">
              {o.origin} <IconArrowRight className="w-3 h-3 text-muted-foreground" /> {o.destination}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(o.pickupDate), "dd MMM", { locale: fr })} à {o.pickupTime}
            </div>
          </div>
        )
      }
    },
    {
      id: "fleet",
      header: "Véhicules",
      cell: ({ row }) => {
        const fleet = row.original.fleet
        const summary = Object.entries(fleet).map(([k, v]) => `${v}x ${k}`).join(", ")
        return <span className="text-sm truncate max-w-[150px] block" title={summary}>{summary}</span>
      }
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Action</div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation(); // Prevent onRowClick from firing twice
              openOrder(row.original);
            }}
          >
            <IconEye className="h-4 w-4 mr-2" />
            Voir
          </Button>
        </div>
      ),
    }
  ], [])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Demandes & Leads</h1>
          <p className="text-sm text-muted-foreground">
            Traitez les demandes et convertissez-les en réservations réelles.
          </p>
        </div>
      </div>

      <div className="flex gap-2 pb-2">
        {(["", "pending", "contacted", "converted"] as const).map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStatusFilter(s)
              setPagination(prev => ({ ...prev, pageIndex: 0 }))
            }}
            className="capitalize"
          >
            {s === "" ? "Tout" : STATUS_CONFIG[s as OrderStatus]?.label.split(" ")[0]}
          </Button>
        ))}
      </div>

      <DataTable<Order>
        data={rows}
        columns={columns}
        loading={loading}
        rowCount={total}
        pagination={pagination}
        onPaginationChange={setPagination}
        getRowId={(r) => r.id}
        onRowClick={openOrder}
      />

      <OrderDetailDialog 
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={selectedOrder}
        onUpdate={fetchData}
        buses={buses}
      />
    </div>
  )
}