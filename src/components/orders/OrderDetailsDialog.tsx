// src/components/orders/OrderDetailDialog.tsx
import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { 
  IconPhone, IconMessageCircle, IconArrowRight, 
  IconBus, IconCalendar, IconUser, IconCash, IconPlus, 
  IconCheck
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"

import orderApi, { type Order } from "@/api/order"
import { type UIBus } from "@/api/bus"
import { MultiSelectBuses } from "../reservation/AddEditReservation-copy"
// Reuse the MultiSelectBuses logic/component from your Reservation file
// import { MultiSelectBuses } from "@/components/reservation/AddEditReservation" 

interface Props {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
  buses: UIBus[]
}

export function OrderDetailDialog({ order, open, onOpenChange, onUpdate, buses }: Props) {
  const [isConverting, setIsConverting] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  
  // Conversion Form State
  const [price, setPrice] = React.useState<number>(0)
  const [selectedBusIds, setSelectedBusIds] = React.useState<string[]>([])
  const [notes, setNotes] = React.useState("")

  React.useEffect(() => {
    if (open && order) {
      setNotes(order.internalNotes ?? "")
      setIsConverting(false) // Reset view on open
      setSelectedBusIds([])
      setPrice(0)
    }
  }, [open, order])

  if (!order) return null

  const handleConvert = async () => {
    if (price <= 0 || selectedBusIds.length === 0) {
      return toast.error("Veuillez saisir un prix et sélectionner au moins un bus.")
    }

    setLoading(true)
    try {
      await orderApi.convertToReservation(order.id, {
        price_total: price,
        bus_ids: selectedBusIds,
        internal_notes: notes
      })
      toast.success("Demande convertie en réservation avec succès !")
      onUpdate()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la conversion")
    } finally {
      setLoading(false)
    }
  }

  const busOptions = buses.map(b => ({
    label: b.plate || b.name || String(b.id),
    value: String(b.id),
    type: b.type as any
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 pb-0">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-xl">Demande #{order.id}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Reçue le {format(new Date(order.createdAt), "PPP à p", { locale: fr })}
              </p>
            </div>
            <Badge variant={order.status === 'converted' ? 'secondary' : 'default'}>
              {order.status === 'converted' ? 'Converti' : 'Nouveau Lead'}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-6">
            {/* 1. Trip Section */}
            <section className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase flex items-center gap-1">
                  <IconCalendar className="w-3 h-3" /> Itinéraire
                </Label>
                <div className="font-medium flex items-center gap-2">
                  {order.origin} <IconArrowRight className="w-3 h-3 text-muted-foreground" /> {order.destination}
                </div>
                <p className="text-sm">
                  {format(new Date(order.pickupDate), "dd MMMM yyyy", { locale: fr })} à {order.pickupTime}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground uppercase flex items-center gap-1">
                  <IconBus className="w-3 h-3" /> Type d'événement
                </Label>
                <p className="font-medium capitalize">{order.eventType.replace('_', ' ')}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(order.fleet).map(([type, qty]) => (
                    <Badge key={type} variant="outline" className="text-[10px] bg-background">
                      {qty}x {type}
                    </Badge>
                  ))}
                </div>
              </div>
            </section>

            {/* 2. Contact Section */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <IconUser className="w-4 h-4 text-primary" /> Information Client
              </h4>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{order.contactName}</p>
                  <p className="text-sm text-muted-foreground">{order.contactPhone}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild className="h-8 w-8 p-0 rounded-full">
                    <a href={`tel:${order.contactPhone}`}><IconPhone className="w-4 h-4" /></a>
                  </Button>
                  <Button size="sm" variant="outline" asChild className="h-8 w-8 p-0 rounded-full text-green-600">
                    <a href={`https://wa.me/${order.contactPhone.replace('+', '')}`} target="_blank"><IconMessageCircle className="w-4 h-4" /></a>
                  </Button>
                </div>
              </div>
            </section>

            <Separator />

            {/* 3. Conversion Form (Action Area) */}
            {order.status !== 'converted' && (
              <section className={cn("space-y-4 rounded-lg p-4 transition-all", isConverting ? "bg-emerald-50/50 border border-emerald-200" : "bg-muted/20")}>
                {!isConverting ? (
                  <div className="flex flex-col items-center py-2">
                    <p className="text-sm text-muted-foreground mb-3 text-center">
                      Le client a-t-il validé le devis ?
                    </p>
                    <Button 
                      onClick={() => setIsConverting(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 w-full"
                    >
                      <IconPlus className="mr-2 w-4 h-4" /> Préparer la réservation
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-emerald-800">Détails de la réservation</h4>
                      <Button variant="ghost" size="sm" onClick={() => setIsConverting(false)} className="h-7 text-xs">Annuler</Button>
                    </div>

                    <div className="grid gap-4">
                      <div className="space-y-1.5">
                        <Label>Prix total convenu (FCFA)</Label>
                        <div className="relative">
                          <IconCash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type="number" 
                            className="pl-9" 
                            placeholder="0" 
                            value={price || ""} 
                            onChange={e => setPrice(Number(e.target.value))}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label>Assigner les bus (Basé sur la flotte demandée)</Label>
                        <MultiSelectBuses
                          value={selectedBusIds}
                          onChange={setSelectedBusIds}
                          options={busOptions}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>Notes internes</Label>
                        <Textarea 
                          placeholder="Instructions pour le chauffeur, détails de paiement..." 
                          value={notes}
                          onChange={e => setNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {order.status === 'converted' && (
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg flex items-center gap-3 text-emerald-800">
                <IconCheck className="w-5 h-5" />
                <p className="text-sm font-medium">Cette demande a déjà été convertie en réservation.</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 bg-muted/10 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          {isConverting && (
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700" 
              onClick={handleConvert}
              disabled={loading}
            >
              {loading ? "Traitement..." : "Confirmer la Réservation"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}