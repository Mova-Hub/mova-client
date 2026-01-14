// src/components/orders/OrderDetailDialog.tsx
import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { IconArrowRight, IconBus, IconCalendar, IconCheck, IconPlus } from "@tabler/icons-react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { OrderReservation } from "./OrderReservation"
import { type Order } from "@/api/order"
import { type UIBus } from "@/api/bus"

interface Props {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
  buses: UIBus[]
}

export function OrderDetailDialog({ order, open, onOpenChange, onUpdate, buses }: Props) {
  const [isConverting, setIsConverting] = React.useState(false)

  React.useEffect(() => {
    if (open) setIsConverting(false)
  }, [open])

  if (!order) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 flex flex-col h-[90vh] overflow-hidden border-none shadow-2xl">
        {/* Fixed Header */}
        <DialogHeader className="p-6 border-b bg-background z-10 shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-2xl font-bold">Demande #{order.id}</DialogTitle>
              <DialogDescription>
                Lead reçu de <strong>{order.contactName}</strong> le {format(new Date(order.createdAt), "dd MMM yyyy", { locale: fr })}
              </DialogDescription>
            </div>
            <Badge variant={order.status === 'converted' ? 'secondary' : 'default'} className="px-3 py-1">
              {order.status === 'converted' ? 'Converti' : 'Lead Actif'}
            </Badge>
          </div>
        </DialogHeader>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-muted">
          {!isConverting ? (
            <div className="space-y-8 animate-in fade-in duration-300">
                <section className="grid md:grid-cols-2 gap-6 bg-muted/20 p-4 rounded-lg border">
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                    <IconCalendar className="w-3 h-3" /> Souhait du client
                    </h4>
                    <p className="text-sm"><b>Trajet:</b> {order.origin} <IconArrowRight className="inline w-3 h-3" /> {order.destination}</p>
                    <p className="text-sm"><b>Date:</b> {format(new Date(order.pickupDate), "PPPP", { locale: fr })} à {order.pickupTime}</p>
                </div>
                <div className="space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                    <IconBus className="w-3 h-3" /> Flotte demandée
                    </h4>
                    <div className="flex flex-wrap gap-2">
                    {Object.entries(order.fleet).map(([type, qty]) => (
                        <Badge key={type} variant="secondary">{qty}x {type}</Badge>
                    ))}
                    </div>
                </div>
                </section>

              <Separator />

              {order.status !== 'converted' ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-2xl bg-emerald-50/30 border-emerald-100">
                  <div className="bg-emerald-100 p-4 rounded-full mb-4">
                    <IconBus className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-emerald-900">Transformer en Réservation</h3>
                  <p className="text-sm text-emerald-700/70 mb-6 text-center max-w-sm">
                    Cliquez ci-dessous pour confirmer l'itinéraire, le prix final et assigner les bus disponibles.
                  </p>
                  <Button onClick={() => setIsConverting(true)} size="lg" className="bg-emerald-600 hover:bg-emerald-700 shadow-lg">
                    <IconPlus className="mr-2 h-5 w-5" /> Lancer la préparation
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-emerald-600 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <IconCheck className="h-16 w-16 mb-4 animate-bounce" />
                  <p className="text-xl font-bold">Cette demande a été convertie.</p>
                  <p className="text-sm opacity-70">Consultez l'onglet Réservations pour plus de détails.</p>
                </div>
              )}
            </div>
          ) : (
            <OrderReservation 
                order={order} 
                buses={buses} 
                onCancel={() => setIsConverting(false)} 
                onSuccess={() => {
                    onUpdate();
                    onOpenChange(false);
                }}
            />
          )}
        </div>

        {/* Fixed Footer */}
        {!isConverting && (
          <DialogFooter className="p-4 border-t bg-muted/5 shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer la vue</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}