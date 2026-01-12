// src/pages/Orders.tsx
"use client"

import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { IconPhone, IconMessageCircle, IconArrowRight, IconBus, IconNotes, IconCheck } from "@tabler/icons-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

import { DataTable, type FilterConfig } from "@/components/data-table"
import type { ColumnDef } from "@tanstack/react-table"

import orderApi, { type Order, type OrderStatus } from "@/api/order"
import { ApiError } from "@/api/apiService"

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

/* ------------------------- Process Dialog ------------------------- */

function ProcessOrderDialog({ 
  open, 
  onOpenChange, 
  order, 
  onUpdate 
}: { 
  open: boolean, 
  onOpenChange: (v: boolean) => void, 
  order: Order | null,
  onUpdate: () => void 
}) {
  const [status, setStatus] = React.useState<OrderStatus>("pending")
  const [notes, setNotes] = React.useState("")
  const [converting, setConverting] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (order) {
      setStatus(order.status)
      setNotes(order.internalNotes ?? "")
    }
  }, [order])

  if (!order) return null

  // Handle simple save (Status/Notes)
  async function handleSave() {
    setSaving(true)
    try {
      await orderApi.update(order!.id, { status, internal_notes: notes })
      toast.success("Commande mise à jour.")
      onUpdate()
      onOpenChange(false)
    } catch (e) {
      toast.error("Erreur lors de la sauvegarde.")
    } finally {
      setSaving(false)
    }
  }

  // Handle "Convert to Reservation"
  async function handleConvert() {
    if (!confirm("Voulez-vous transformer cette demande en réservation officielle ?")) return
    
    setConverting(true)
    try {
      const res = await orderApi.convertToReservation(order!.id)
      toast.success(res.message)
      onUpdate() // refresh list
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la conversion.")
    } finally {
      setConverting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Traiter la demande #{order.id}</DialogTitle>
          <DialogDescription>
            Reçue le {format(new Date(order.createdAt), "dd MMM yyyy à HH:mm", { locale: fr })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Top: Route & Contact */}
          <div className="grid md:grid-cols-2 gap-6 p-4 bg-muted/30 rounded-lg border">
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <IconBus className="w-4 h-4" /> Détails du trajet
              </h4>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Type:</span> {order.eventType}</p>
                <div className="flex items-center gap-2 font-medium">
                  {order.origin} <IconArrowRight className="w-3 h-3 text-muted-foreground" /> {order.destination}
                </div>
                <p>
                  <span className="text-muted-foreground">Date:</span> {format(new Date(order.pickupDate), "dd MMM yyyy", { locale: fr })}
                </p>
                <p>
                  <span className="text-muted-foreground">Heure:</span> {order.pickupTime}
                </p>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <IconPhone className="w-4 h-4" /> Contact
              </h4>
              <div className="text-sm space-y-1">
                <p className="font-medium">{order.contactName}</p>
                <p>{order.contactPhone}</p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={`tel:${order.contactPhone}`}><IconPhone className="w-3 h-3 mr-1" /> Appeler</a>
                  </Button>
                  <Button size="sm" variant="outline" className="text-green-600 border-green-200 bg-green-50 hover:bg-green-100" asChild>
                    <a href={`https://wa.me/${order.contactPhone.replace(/\+/g, '')}`} target="_blank" rel="noreferrer">
                      <IconMessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Fleet Requirements */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Véhicules demandés</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(order.fleet).map(([type, qty]) => (
                <Badge key={type} variant="secondary" className="text-sm py-1 px-3">
                  {qty}x <span className="capitalize ml-1">{type.replace('_', ' ')}</span>
                </Badge>
              ))}
            </div>
          </div>

          {/* Admin Inputs */}
          <div className="grid gap-4 border-t pt-4">
            <div className="grid gap-2">
              <Label>Statut interne</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)} disabled={order.status === "converted"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Nouveau (Pending)</SelectItem>
                  <SelectItem value="contacted">Déjà contacté</SelectItem>
                  <SelectItem value="converted">Converti</SelectItem>
                  <SelectItem value="cancelled">Annulé / Perdu</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Notes internes</Label>
              <Textarea 
                placeholder="Ex: Client rappelé, devis envoyé..." 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {order.status !== "converted" && (
            <Button 
              variant="default" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white mr-auto"
              onClick={handleConvert}
              disabled={converting || saving}
            >
              {converting ? "Conversion..." : "Convertir en Réservation"}
            </Button>
          )}
          
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Fermer</Button>
          <Button onClick={handleSave} disabled={saving || order.status === "converted"}>
            {saving ? "Sauvegarde..." : "Enregistrer les notes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------------- Page ----------------------------------- */

export default function OrdersPage() {
  const [rows, setRows] = React.useState<Order[]>([])
  const [loading, setLoading] = React.useState<boolean>(true)
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 20 })
  const [total, setTotal] = React.useState(0)
  
  // Filter state
  const [statusFilter, setStatusFilter] = React.useState<OrderStatus | "">("")

  // Dialog state
  const [selectedOrder, setSelectedOrder] = React.useState<Order | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const fetchOrders = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await orderApi.list({
        status: statusFilter,
        page: pagination.pageIndex + 1,
        per_page: pagination.pageSize,
      })
      setRows(res.data.rows)
      setTotal(res.data.meta?.total ?? 0)
    } catch (e) {
      toast.error("Impossible de charger les commandes")
    } finally {
      setLoading(false)
    }
  }, [pagination, statusFilter])

  React.useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

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
      cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.eventType}</Badge>,
    },
    {
      id: "route",
      header: "Trajet & Date",
      cell: ({ row }) => {
        const o = row.original
        return (
          <div className="text-sm">
            <div className="flex items-center gap-1 font-medium">
              {o.origin} <IconArrowRight className="w-3 h-3" /> {o.destination}
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
      accessorKey: "createdAt",
      header: "Reçu",
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{format(new Date(row.original.createdAt), "dd/MM HH:mm")}</span>,
    }
  ], [])

  const filters: FilterConfig<Order>[] = [
    {
      id: "status",
      label: "Statut",
      options: [
        { label: "Tous", value: "" },
        { label: "Nouveaux", value: "pending" },
        { label: "Traités", value: "contacted" },
        { label: "Convertis", value: "converted" },
        { label: "Annulés", value: "cancelled" },
      ],
      accessor: () => statusFilter,
      defaultValue: "",
    }
  ]

  function openOrder(order: Order) {
    setSelectedOrder(order)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Demandes & Leads</h1>
        <p className="text-sm text-muted-foreground">
          Gérez les demandes de réservation provenant de l'application mobile.
        </p>
      </div>

      {/* Tabs for quick filtering */}
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
        // Custom row click to open dialog
        onRowClick={openOrder}
      />

      <ProcessOrderDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
        order={selectedOrder}
        onUpdate={fetchOrders}
      />
    </div>
  )
}