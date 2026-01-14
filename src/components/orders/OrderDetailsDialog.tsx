// src/components/orders/OrderDetailDialog.tsx
import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { 
  IconPhone, IconMessageCircle, IconArrowRight, 
  IconBus, IconCalendar, IconUser, IconCash, IconPlus, 
  IconCheck, IconMapPin
} from "@tabler/icons-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"

import orderApi, { type Order, type ConvertPayload } from "@/api/order"
import { type UIBus } from "@/api/bus"
// import { 
//     MultiSelectBuses, 
//     MapPicker, 
//     TripDateTimePicker, 
//     EventCombobox,
//     fmtMoney
// } from "../reservation/AddEditReservation" // Reuse components from your Reservation file
import api from "@/api/apiService"
import { EventCombobox, MapPicker, MultiSelectBuses, TripDateTimePicker } from "../reservation/AddEditReservation"

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
  
  // --- Conversion State (Reservation Builder) ---
  const [waypoints, setWaypoints] = React.useState<any[]>([])
  const [tripDate, setTripDate] = React.useState<string>("")
  const [busIds, setBusIds] = React.useState<string[]>([])
  const [price, setPrice] = React.useState<number>(0)
  const [distanceKm, setDistanceKm] = React.useState<number | null>(null)
  const [eventType, setEventType] = React.useState<any>("none")
  const [notes, setNotes] = React.useState("")

  // Initializing conversion data from lead
  React.useEffect(() => {
    if (open && order) {
      setIsConverting(false)
      setNotes(order.internalNotes ?? "")
      try {
        // 1. Basic combination
        const dateStr = `${order.pickupDate}T${order.pickupTime}`
        
        // 2. Validate it. If invalid, date-fns inside the picker will crash the app.
        const testDate = new Date(dateStr)
        
        if (!isNaN(testDate.getTime())) {
           setTripDate(dateStr)
        } else {
           console.warn("Invalid order date format, defaulting to now:", dateStr)
           setTripDate(new Date().toISOString())
        }
      } catch (e) {
        // Fallback for any parsing errors
        setTripDate(new Date().toISOString())
      }
      
      setEventType(order.eventType)
      // Clear specific reservation states
      setBusIds([])
      setPrice(0)
      setWaypoints([]) 
    }
  }, [open, order])

  if (!order) return null

  const handleConvertAction = async () => {
    if (busIds.length === 0) return toast.error("Assignez au moins un bus.")
    if (waypoints.length < 2) return toast.error("Définissez l'itinéraire sur la carte.")

    setLoading(true)
    try {
      const payload: ConvertPayload = {
        trip_date: tripDate,
        from_location: waypoints[0].label,
        to_location: waypoints[waypoints.length - 1].label,
        passenger_name: order.contactName,
        passenger_phone: order.contactPhone,
        passenger_email: order.client?.email,
        price_total: price,
        bus_ids: busIds,
        waypoints: waypoints,
        distance_km: distanceKm ?? 0,
        event: eventType,
        internal_notes: notes
      }
      
      const res = await orderApi.convertToReservation(order.id, payload)
      toast.success(res.message)
      onUpdate()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de la conversion")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 flex flex-col h-[90vh] overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-xl">Demande #{order.id}</DialogTitle>
              <DialogDescription>
                Client: {order.contactName} • Reçue le {format(new Date(order.createdAt), "dd MMM yyyy", { locale: fr })}
              </DialogDescription>
            </div>
            <Badge variant={order.status === 'converted' ? 'secondary' : 'default'}>
              {order.status === 'converted' ? 'Converti' : 'Lead Actif'}
            </Badge>
          </div>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* Section 1: Lead Details (Always visible) */}
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

          {/* Section 2: The Conversion Builder */}
          {order.status !== 'converted' && (
            <div className="space-y-6">
              {!isConverting ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-4 border-2 border-dashed rounded-xl">
                  <p className="text-muted-foreground">Prêt à transformer ce lead en voyage ?</p>
                  <Button onClick={() => setIsConverting(true)} size="lg" className="bg-emerald-600 hover:bg-emerald-700">
                    <IconPlus className="mr-2 h-5 w-5" /> Préparer la réservation
                  </Button>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-top-4 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-emerald-700">
                      <IconMapPin className="w-5 h-5" /> Itinéraire Réel & Carte
                    </h3>
                    <Button variant="ghost" size="sm" onClick={() => setIsConverting(false)}>Annuler</Button>
                  </div>

                  <div className="grid gap-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date & Heure Confirmée</Label>
                        <TripDateTimePicker valueIso={tripDate} onChange={setTripDate} />
                      </div>
                      <div className="space-y-2">
                        <Label>Événement</Label>
                        <EventCombobox value={eventType} onChange={setEventType} />
                      </div>
                    </div>

                    <MapPicker 
                      waypoints={waypoints} 
                      onChange={setWaypoints} 
                      onRouteKmChange={setDistanceKm} 
                    />

                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm">Assignation des ressources</h4>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Buses</Label>
                          <MultiSelectBuses 
                            value={busIds} 
                            onChange={setBusIds} 
                            options={buses.map(b => ({ label: b.plate!, value: String(b.id), type: b.type as any }))} 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Prix Final (FCFA)</Label>
                          <div className="relative">
                            <Input 
                              type="number" 
                              value={price} 
                              onChange={(e) => setPrice(Number(e.target.value))} 
                              className="pl-10" 
                            />
                            <IconCash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Notes pour le chauffeur</Label>
                      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {order.status === 'converted' && (
            <div className="flex flex-col items-center justify-center py-12 text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100">
              <IconCheck className="h-12 w-12 mb-2" />
              <p className="font-bold">Demande traitée et convertie.</p>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <DialogFooter className="p-6 border-t bg-muted/10">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          {isConverting && (
            <Button 
                onClick={handleConvertAction} 
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? "Conversion..." : "Confirmer la Réservation"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}