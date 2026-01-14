// src/components/orders/OrderReservation.tsx
"use client"

import * as React from "react"
import { toast } from "sonner"
import { IconCash, IconMapPin, IconInfoCircle, IconAlertTriangle } from "@tabler/icons-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { cn, step25 } from "@/lib/utils"

// Reuse components from the main reservation dialog
import { 
  MapPicker, 
  TripDateTimePicker, 
  EventCombobox, 
  MultiSelectBuses,
  buildVehiclesMap
} from "../reservation/AddEditReservation"

import orderApi, { type Order, type ConvertPayload } from "@/api/order"
import api from "@/api/apiService"
import { type UIBus, type BusType } from "@/api/bus"

// Constants
const MAPBOX_TOKEN = "pk.eyJ1IjoiYXJkZW4tYm91ZXQiLCJhIjoiY21maWgyY3dvMGF1YTJsc2UxYzliNnA0ZCJ9.XC5hXXwEa-NCUPpPtBdWCA"

/* --- Types for Quote Logic --- */
type QuoteBreakdown = {
  base: number; motivation: number; event: number; majorated: number;
  client_fees: number; client_raw: number; client_rounded: number;
  commission: number; bus_base: number; bus_fees: number; bus_raw: number; bus_rounded: number;
}
type QuoteFull = {
  currency: string;
  breakdown: QuoteBreakdown;
  client_payable: number;
  bus_payable: number;
  meta?: Record<string, unknown>;
}
function fmtMoney(v: number | null | undefined, curr: string) {
  const n = Number(v ?? 0)
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${curr}`
}

type Props = {
  order: Order
  buses: UIBus[]
  onSuccess: () => void
  onCancel: () => void
}

export function OrderReservation({ order, buses, onSuccess, onCancel }: Props) {
  // --- Core State ---
  const [loading, setLoading] = React.useState(false)
  
  // 1. Itinerary State
  const [tripDate, setTripDate] = React.useState<string>(() => {
    try {
      const dateStr = `${order.pickupDate}T${order.pickupTime}`
      const d = new Date(dateStr)
      return !isNaN(d.getTime()) ? dateStr : new Date().toISOString()
    } catch { return new Date().toISOString() }
  })
  const [waypoints, setWaypoints] = React.useState<any[]>([])
  const [routeKm, setRouteKm] = React.useState<number | null>(null) // from Mapbox
  
  // 2. Passenger State (Pre-filled from Order)
  const [passengerName, setPassengerName] = React.useState(order.contactName || "")
  const [passengerPhone, setPassengerPhone] = React.useState(order.contactPhone || "")
  const [passengerEmail, setPassengerEmail] = React.useState(order.client?.email || "")

  // 3. Pricing & Config State
  const [eventType, setEventType] = React.useState<any>(order.eventType || "none")
  const [hiaceCount, setHiaceCount] = React.useState<number>(order.fleet['hiace'] || 0)
  const [coasterCount, setCoasterCount] = React.useState<number>(order.fleet['coaster'] || 0)
  const [manualPrice, setManualPrice] = React.useState<number>(0)
  
  // 4. Bus Assignment State
  const [busIds, setBusIds] = React.useState<string[]>([])
  const [notes, setNotes] = React.useState(order.internalNotes || "")

  // --- Quoting System ---
  const [quote, setQuote] = React.useState<QuoteFull | null>(null)
  const [quoting, setQuoting] = React.useState(false)
  const [quoteCurrency, setQuoteCurrency] = React.useState("FCFA")
  const quoteReqSeq = React.useRef(0)

  // Derived Distance
  const distanceKmDisplay = routeKm ?? 0

  // --- Helpers for Bus Logic ---
  const busTypeIndex = React.useMemo(() => {
    const idx: Record<string, "hiace" | "coaster" | "unknown"> = {}
    ;(buses ?? []).forEach(b => {
      const t = String((b as any)?.type || "").toLowerCase()
      idx[String(b.id)] = t === "hiace" || t === "coaster" ? (t as any) : "unknown"
    })
    return idx
  }, [buses])

  function countByType(ids: string[]) {
    let h = 0, c = 0
    ids.forEach(id => {
      const t = busTypeIndex[id]
      if (t === "hiace") h++
      else if (t === "coaster") c++
    })
    return { h, c }
  }

  // --- Quote Effect (Debounced) ---
  React.useEffect(() => {
    let cancelled = false
    const seq = ++quoteReqSeq.current

    const distanceOk = Number.isFinite(distanceKmDisplay) && (distanceKmDisplay ?? 0) > 0
    const haveCounts = (hiaceCount > 0 || coasterCount > 0)
    
    // If we don't have enough info, clear quote
    if (!(haveCounts && distanceOk)) {
      setQuote(null)
      setManualPrice(0)
      return
    }

    const t = setTimeout(async () => {
      setQuoting(true)
      try {
        const vehicles_map = buildVehiclesMap(hiaceCount, coasterCount)
        const res = await api.post<QuoteFull, any>("/quote", { 
           vehicles_map, 
           distance_km: distanceKmDisplay, 
           event: eventType 
        })

        if (cancelled || seq !== quoteReqSeq.current) return
        
        setQuote(res.data)
        setManualPrice(res.data.client_payable)
        setQuoteCurrency(res.data.currency)
      } catch (e: any) {
        if (!cancelled && seq === quoteReqSeq.current) {
          setQuote(null)
          console.error("Quote failed", e)
        }
      } finally {
        if (!cancelled && seq === quoteReqSeq.current) setQuoting(false)
      }
    }, 600) // 600ms debounce

    return () => { cancelled = true; clearTimeout(t) }
  }, [distanceKmDisplay, hiaceCount, coasterCount, eventType])


  // --- Logic: Limit Bus Selection based on Counts ---
  function setBusIdsLimited(next: string[]) {
    const added = next.find(id => !busIds.includes(id))
    if (!added) { setBusIds(next); return }

    const t = busTypeIndex[added]
    const { h, c } = countByType(next)

    // Caps
    const capH = Math.max(0, hiaceCount|0)
    const capC = Math.max(0, coasterCount|0)

    if (t === "hiace" && h > capH) {
      toast.error(`Vous ne pouvez pas dépasser ${capH} Hiace.`)
      return
    }
    if (t === "coaster" && c > capC) {
      toast.error(`Vous ne pouvez pas dépasser ${capC} Coaster.`)
      return
    }
    setBusIds(next)
  }

  // --- Final Submit ---
  const handleConvert = async () => {
    if (busIds.length === 0) return toast.error("Veuillez assigner au moins un bus.")
    if (waypoints.length < 2) return toast.error("L'itinéraire sur la carte est requis (Départ et Arrivée).")
    if (!passengerName || !passengerPhone) return toast.error("Nom et téléphone passager requis.")

    setLoading(true)
    try {
      const payload: ConvertPayload = {
        trip_date: tripDate,
        from_location: waypoints[0].label,
        to_location: waypoints[waypoints.length - 1].label,
        passenger_name: passengerName,
        passenger_phone: passengerPhone,
        passenger_email: passengerEmail,
        price_total: manualPrice, // User can override this input
        bus_ids: busIds,
        waypoints: waypoints,
        distance_km: distanceKmDisplay,
        event: eventType,
        internal_notes: notes
      }
      
      const res = await orderApi.convertToReservation(order.id, payload)
      toast.success(res.message)
      onSuccess()
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de conversion")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in slide-in-from-top-4 relative">
      
      {/* Scrollable Body */}
      {/* Added pb-32 to ensure content isn't hidden behind footer */}
      <div className="flex-1 space-y-8 pr-2 pb-32">
        
        {/* Header inside the scroll view */}
        <div className="flex items-center justify-between pb-2 border-b">
          <div>
            <h3 className="font-bold text-lg text-emerald-800 flex items-center gap-2">
              <IconMapPin className="w-5 h-5" /> Configuration Complète
            </h3>
            <p className="text-sm text-muted-foreground">Définissez l'itinéraire et calculez le devis exact.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
        </div>

        {/* 1. Itinerary & Map */}
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Itinéraire & Carte</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Date du trajet</Label>
                <TripDateTimePicker valueIso={tripDate} onChange={setTripDate} />
              </div>
              <div className="grid gap-1.5">
                <Label>Distance estimée (km)</Label>
                <Input value={Number.isFinite(distanceKmDisplay) ? distanceKmDisplay : 0} readOnly className="bg-muted" />
              </div>
            </div>

            {MAPBOX_TOKEN ? (
              <MapPicker 
                waypoints={waypoints} 
                onChange={setWaypoints} 
                onRouteKmChange={setRouteKm} 
              />
            ) : (
               <div className="p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-md flex items-center gap-2">
                 <IconAlertTriangle className="w-5 h-5" /> Mapbox Token missing.
               </div>
            )}
        </div>

        <Separator />

        {/* 2. Passenger */}
        <div className="space-y-3">
           <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Passager</h3>
           <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                 <Label>Nom</Label>
                 <Input value={passengerName} onChange={e => setPassengerName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                 <Label>Téléphone</Label>
                 <Input value={passengerPhone} onChange={e => setPassengerPhone(e.target.value)} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                 <Label>Email (Optionnel)</Label>
                 <Input value={passengerEmail} onChange={e => setPassengerEmail(e.target.value)} />
              </div>
           </div>
        </div>

        <Separator />

        {/* 3. Pricing & Resources */}
        <div className="space-y-3">
           <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tarification & Ressources</h3>
           
           {/* Counts */}
           <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Hiace (nombre)</Label>
                <Input type="number" min={0} value={hiaceCount} onChange={e => setHiaceCount(Math.max(0, Math.floor(Number(e.target.value))))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Coaster (nombre)</Label>
                <Input type="number" min={0} value={coasterCount} onChange={e => setCoasterCount(Math.max(0, Math.floor(Number(e.target.value))))} />
              </div>
           </div>

           {/* Event & Total */}
           <div className="grid gap-4 sm:grid-cols-2 mt-2">
             <div className="grid gap-1.5">
               <Label>Évènement</Label>
               <EventCombobox value={eventType} onChange={setEventType} />
             </div>
             <div className="grid gap-1.5">
               <Label>Prix Total Client</Label>
               <div className="relative">
                 <Input 
                   type="number" 
                   value={manualPrice} 
                   onChange={e => setManualPrice(Number(e.target.value))} 
                   className="pr-16 font-bold text-emerald-700"
                 />
                 <div className="pointer-events-none absolute inset-y-0 right-0 grid w-16 place-items-center text-xs text-muted-foreground">
                    {quoteCurrency}
                 </div>
               </div>
             </div>
           </div>
        </div>

        <Separator />

        {/* 4. Bus Assignment */}
        <div className="space-y-3">
           <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Affectation des Bus</h3>
           <div className="grid gap-1.5">
              <Label>Sélectionner les véhicules (max: {hiaceCount} Hiace, {coasterCount} Coaster)</Label>
              <MultiSelectBuses 
                value={busIds} 
                onChange={setBusIdsLimited} 
                options={buses.map(b => ({ 
                   label: b.plate!, 
                   value: String(b.id), 
                   type: (b.type as any) || "other" 
                }))}
              />
           </div>
           <div className="grid gap-1.5 mt-2">
              <Label>Notes internes / Chauffeur</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
           </div>
        </div>

        <Separator />

        {/* 5. Quote Breakdown (Read Only) */}
        <div className="space-y-4">
           <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Récapitulatif</h3>
              {quoting && <Badge variant="secondary" className="animate-pulse">Calcul en cours...</Badge>}
           </div>

           <div className="grid gap-4 md:grid-cols-3">
              {/* Client Card */}
              <div className="rounded-lg border p-4 bg-muted/5">
                 <div className="text-xs text-muted-foreground">Total Client</div>
                 <div className="mt-1 text-2xl font-semibold text-emerald-700">
                    {fmtMoney(quote?.client_payable ?? manualPrice, quoteCurrency)}
                 </div>
                 <p className="mt-1 text-xs text-muted-foreground">Montant à facturer</p>
              </div>

              {/* Bus Card */}
              <div className="rounded-lg border p-4 bg-muted/5">
                 <div className="text-xs text-muted-foreground">Part Bus</div>
                 <div className="mt-1 text-2xl font-semibold">
                    {fmtMoney(quote?.breakdown.bus_rounded ?? 0, quoteCurrency)}
                 </div>
                 <p className="mt-1 text-xs text-muted-foreground text-destructive">
                    Dont frais: -{fmtMoney(quote?.breakdown.bus_fees ?? 0, quoteCurrency)}
                 </p>
              </div>

              {/* Commission Card */}
              <div className="rounded-lg border p-4 bg-muted/5">
                 <div className="text-xs text-muted-foreground">Commission</div>
                 <div className="mt-1 text-2xl font-semibold text-primary">
                    {fmtMoney(quote?.breakdown.commission ?? 0, quoteCurrency)}
                 </div>
                 <p className="mt-1 text-xs text-muted-foreground">Marge nette</p>
              </div>
           </div>
        </div>
      </div>

      {/* Sticky Footer Action */}
      {/* -mx-6 and -mb-6 negate parent padding so footer is edge-to-edge */}
      <div className="flex justify-end gap-3 pt-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky bottom-0 -mx-6 -mb-6 p-6 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <Button variant="outline" onClick={onCancel}>Retour</Button>
        <Button onClick={handleConvert} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 min-w-[200px] shadow-lg">
          {loading ? "Conversion..." : "Confirmer & Convertir"}
        </Button>
      </div>
    </div>
  )
}