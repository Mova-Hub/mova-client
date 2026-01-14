// src/components/orders/OrderReservation.tsx
"use client"

import * as React from "react"
import { toast } from "sonner"
import { 
  IconCash, 
  IconMapPin, 
  IconAlertTriangle, 
  IconBrandGoogleMaps,
  IconX,
  IconClick,
  IconGripVertical
} from "@tabler/icons-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { 
  useJsApiLoader, 
  GoogleMap, 
  Autocomplete, 
  DirectionsRenderer, 
  Marker 
} from '@react-google-maps/api'

import { 
  TripDateTimePicker, 
  EventCombobox, 
  MultiSelectBuses,
  buildVehiclesMap
} from "../reservation/AddEditReservation"

import orderApi, { type Order, type ConvertPayload } from "@/api/order"
import api from "@/api/apiService"
import { type UIBus } from "@/api/bus"

// --- CONSTANTS ---
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const BRAZZAVILLE_CENTER = { lat: -4.2634, lng: 15.2429 }
const LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"]

// Custom Marker Icon (Emerald Teardrop)
const MARKER_SVG_PATH = "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"

/* --- Types --- */
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
type Waypoint = {
  label: string
  lat?: number
  lng?: number
}
function fmtMoney(v: number | null | undefined, curr: string) {
  const n = Number(v ?? 0)
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${curr}`
}

/* --- GOOGLE MAP COMPONENT --- */

function GoogleMapPicker({ 
  waypoints, 
  onChange, 
  onRouteKmChange 
}: { 
  waypoints: Waypoint[]
  onChange: (wps: Waypoint[]) => void
  onRouteKmChange: (km: number | null) => void
}) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  })

  const [map, setMap] = React.useState<google.maps.Map | null>(null)
  const [directionsResponse, setDirectionsResponse] = React.useState<google.maps.DirectionsResult | null>(null)
  const [autocomplete, setAutocomplete] = React.useState<google.maps.places.Autocomplete | null>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)

  // -- 1. Route Calculation Logic --
  React.useEffect(() => {
    if (!isLoaded || waypoints.length < 2) {
      setDirectionsResponse(null)
      if (waypoints.length < 2) onRouteKmChange(0)
      return
    }

    const directionsService = new google.maps.DirectionsService()
    const origin = waypoints[0]
    const destination = waypoints[waypoints.length - 1]
    
    // Middle points are stopovers
    const stops = waypoints.slice(1, -1).map(wp => ({
      location: (wp.lat && wp.lng) ? { lat: wp.lat, lng: wp.lng } : undefined,
      stopover: true
    })).filter(s => s.location !== undefined) as google.maps.DirectionsWaypoint[]

    if (!origin.lat || !destination.lat) return

    directionsService.route({
      origin: { lat: origin.lat!, lng: origin.lng! },
      destination: { lat: destination.lat!, lng: destination.lng! },
      waypoints: stops,
      travelMode: google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK && result) {
        setDirectionsResponse(result)
        const totalMeters = result.routes[0].legs.reduce((acc, leg) => acc + (leg.distance?.value || 0), 0)
        onRouteKmChange(Math.round((totalMeters / 1000) * 100) / 100)
      }
    })
  }, [isLoaded, waypoints.length, waypoints])

  // -- 2. Autocomplete Handler --
  const onPlaceChanged = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace()
      if (place.geometry && place.geometry.location) {
        addPoint(
          place.name || place.formatted_address || "Point recherché",
          place.geometry.location.lat(),
          place.geometry.location.lng()
        )
        if (searchRef.current) searchRef.current.value = ""
        map?.panTo(place.geometry.location)
        map?.setZoom(14)
      }
    }
  }

  // -- 3. Map Click & Drag --
  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()

    const geocoder = new google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      let label = "Point carte"
      if (status === "OK" && results?.[0]) {
         label = results[0].formatted_address.split(',')[0] 
      }
      addPoint(label, lat, lng)
    })
  }

  const handleMarkerDragEnd = (index: number, e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return
    const next = [...waypoints]
    next[index] = { 
      ...next[index], 
      lat: e.latLng.lat(), 
      lng: e.latLng.lng(),
      label: next[index].label + " (modifié)" 
    }
    onChange(next)
  }

  const addPoint = (label: string, lat: number, lng: number) => {
    onChange([...waypoints, { label, lat, lng }])
  }

  if (!isLoaded) return <div className="h-[300px] w-full bg-muted animate-pulse rounded-md flex items-center justify-center">Chargement Google Maps...</div>

  return (
    <div className="space-y-3">
      {/* GLOBAL STYLE FIX FOR PAC CONTAINER Z-INDEX */}
      <style>{`
        .pac-container {
          z-index: 99999 !important;
          border-radius: 0.5rem;
          margin-top: 4px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          border: 1px solid #e2e8f0;
          font-family: inherit;
        }
        .pac-item {
          padding: 8px 12px;
          cursor: pointer;
          font-size: 0.875rem;
        }
        .pac-item:hover {
          background-color: #f1f5f9;
        }
        .pac-item-query {
          font-size: 0.875rem;
          color: #0f172a;
        }
      `}</style>

      <div className="relative">
        <Autocomplete
          onLoad={(auto) => setAutocomplete(auto)}
          onPlaceChanged={onPlaceChanged}
          restrictions={{ country: "cg" }}
        >
          <Input 
            ref={searchRef}
            placeholder="Rechercher un lieu au Congo..." 
            className="pl-10"
          />
        </Autocomplete>
        <IconMapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>

      <div className="h-[400px] w-full rounded-md border overflow-hidden relative group">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={BRAZZAVILLE_CENTER}
          zoom={12}
          onLoad={(map) => setMap(map)}
          onClick={handleMapClick}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            clickableIcons: false,
          }}
        >
          {/* Render Markers */}
          {waypoints.map((wp, idx) => (
            wp.lat && wp.lng && (
              <Marker 
                key={`${idx}-${wp.lat}`} 
                position={{ lat: wp.lat, lng: wp.lng }}
                draggable={true} // ENABLE DRAGGING
                onDragEnd={(e) => handleMarkerDragEnd(idx, e)}
                animation={google.maps.Animation.DROP}
                icon={{
                  path: MARKER_SVG_PATH,
                  fillColor: "#059669", // Emerald 600
                  fillOpacity: 1,
                  strokeWeight: 1,
                  strokeColor: "#ffffff",
                  scale: 2,
                  anchor: new google.maps.Point(12, 22), // Bottom tip of the pin
                  labelOrigin: new google.maps.Point(12, 9), // Center of the bubble
                }}
                label={{
                  text: (idx + 1).toString(),
                  color: "white",
                  fontSize: "12px",
                  fontWeight: "bold"
                }}
              />
            )
          ))}

          {/* Render Route */}
          {directionsResponse && (
            <DirectionsRenderer 
              directions={directionsResponse} 
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: "#059669",
                  strokeOpacity: 0.8,
                  strokeWeight: 5,
                }
              }}
            />
          )}
        </GoogleMap>
        
        <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur px-2 py-1 rounded text-[10px] text-muted-foreground shadow-sm pointer-events-none flex items-center gap-1 border">
          <IconClick className="w-3 h-3" />
          Cliquez pour ajouter • Glissez les marqueurs pour ajuster
        </div>
      </div>

      {/* Selected Points List */}
      <div className="space-y-2">
        {waypoints.map((wp, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded-md border border-transparent hover:border-border transition-colors">
             <div className="cursor-grab text-muted-foreground">
                <IconGripVertical className="h-4 w-4" />
             </div>
             <Badge className="h-5 w-5 flex items-center justify-center rounded-full p-0 bg-emerald-600 hover:bg-emerald-700">
               {idx + 1}
             </Badge>
             <span className="flex-1 truncate font-medium text-xs text-foreground/80">{wp.label}</span>
             <Button 
               variant="ghost" 
               size="icon" 
               className="h-6 w-6 text-muted-foreground hover:text-destructive"
               onClick={() => {
                 const next = [...waypoints]
                 next.splice(idx, 1)
                 onChange(next)
               }}
             >
               <IconX className="h-4 w-4" />
             </Button>
          </div>
        ))}
      </div>
    </div>
  )
}


/* --- MAIN COMPONENT --- */

type Props = {
  order: Order
  buses: UIBus[]
  onSuccess: () => void
  onCancel: () => void
}

export function OrderReservation({ order, buses, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = React.useState(false)
  const [useMap, setUseMap] = React.useState(false)

  // 1. Itinerary
  const [tripDate, setTripDate] = React.useState<string>(() => {
    try {
      const dateStr = `${order.pickupDate}T${order.pickupTime}`
      const d = new Date(dateStr)
      return !isNaN(d.getTime()) ? dateStr : new Date().toISOString()
    } catch { return new Date().toISOString() }
  })
  
  const [waypoints, setWaypoints] = React.useState<Waypoint[]>([])
  const [routeKm, setRouteKm] = React.useState<number | null>(null)
  
  React.useEffect(() => {
    if (waypoints.length === 0 && !useMap) {
      const initial: Waypoint[] = []
      if (order.origin) initial.push({ label: order.origin })
      if (order.destination) initial.push({ label: order.destination })
      if (initial.length > 0) setWaypoints(initial)
    }
  }, []) 

  // 2. Passenger
  const [passengerName, setPassengerName] = React.useState(order.contactName || "")
  const [passengerPhone, setPassengerPhone] = React.useState(order.contactPhone || "")
  const [passengerEmail, setPassengerEmail] = React.useState(order.client?.email || "")

  // 3. Pricing
  const [eventType, setEventType] = React.useState<any>(order.eventType || "none")
  const [hiaceCount, setHiaceCount] = React.useState<number>(order.fleet['hiace'] || 0)
  const [coasterCount, setCoasterCount] = React.useState<number>(order.fleet['coaster'] || 0)
  const [manualPrice, setManualPrice] = React.useState<number>(0)
  
  // 4. Bus
  const [busIds, setBusIds] = React.useState<string[]>([])
  const [notes, setNotes] = React.useState(order.internalNotes || "")

  // Quoting
  const [quote, setQuote] = React.useState<QuoteFull | null>(null)
  const [quoting, setQuoting] = React.useState(false)
  const [quoteCurrency, setQuoteCurrency] = React.useState("FCFA")
  const quoteReqSeq = React.useRef(0)

  const distanceKmDisplay = routeKm ?? 0

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

  React.useEffect(() => {
    let cancelled = false
    const seq = ++quoteReqSeq.current

    // Trigger quote if distance > 0 OR user manually set a distance (handled by distanceKmDisplay)
    const distanceOk = Number.isFinite(distanceKmDisplay) && distanceKmDisplay > 0
    const haveCounts = (hiaceCount > 0 || coasterCount > 0)
    
    if (!(haveCounts && distanceOk)) {
      setQuote(null)
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
    }, 600)

    return () => { cancelled = true; clearTimeout(t) }
  }, [distanceKmDisplay, hiaceCount, coasterCount, eventType])


  function setBusIdsLimited(next: string[]) {
    const added = next.find(id => !busIds.includes(id))
    if (!added) { setBusIds(next); return }

    const t = busTypeIndex[added]
    const { h, c } = countByType(next)
    const capH = Math.max(0, hiaceCount|0)
    const capC = Math.max(0, coasterCount|0)

    if (t === "hiace" && h > capH) return toast.error(`Vous ne pouvez pas dépasser ${capH} Hiace.`)
    if (t === "coaster" && c > capC) return toast.error(`Vous ne pouvez pas dépasser ${capC} Coaster.`)
    setBusIds(next)
  }

  const handleManualWaypointChange = (idx: number, val: string) => {
    const next = [...waypoints]
    if (!next[0]) next[0] = { label: "" }
    if (!next[1]) next[1] = { label: "" }
    next[idx] = { ...next[idx], label: val }
    setWaypoints(next)
  }

  const handleConvert = async () => {
    if (busIds.length === 0) return toast.error("Veuillez assigner au moins un bus.")
    if (!passengerName || !passengerPhone) return toast.error("Nom et téléphone passager requis.")

    setLoading(true)
    try {
      const fromLoc = waypoints[0]?.label || order.origin || "Départ"
      const toLoc = waypoints[waypoints.length - 1]?.label || order.destination || "Arrivée"

      const payload: ConvertPayload = {
        trip_date: tripDate,
        from_location: fromLoc,
        to_location: toLoc,
        passenger_name: passengerName,
        passenger_phone: passengerPhone,
        passenger_email: passengerEmail,
        price_total: manualPrice,
        bus_ids: busIds,
        waypoints: waypoints.filter(w => !!w.label),
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
      <div className="flex-1 space-y-8 pr-2 pb-32">
        <div className="flex items-center justify-between pb-2 border-b">
          <div>
            <h3 className="font-bold text-lg text-emerald-800 flex items-center gap-2">
              <IconMapPin className="w-5 h-5" /> Configuration Complète
            </h3>
            <p className="text-sm text-muted-foreground">Définissez l'itinéraire et calculez le devis exact.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>Annuler</Button>
        </div>

        {/* 1. Itinerary */}
        <div className="space-y-4">
            <div className="flex items-center justify-between">
               <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Itinéraire</h3>
               <div className="flex items-center gap-2">
                  <Switch id="map-mode" checked={useMap} onCheckedChange={setUseMap} />
                  <Label htmlFor="map-mode" className="text-xs cursor-pointer flex items-center gap-1">
                    <IconBrandGoogleMaps className="w-3 h-3" />
                    Utiliser Google Maps
                  </Label>
               </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Date du trajet</Label>
                <TripDateTimePicker valueIso={tripDate} onChange={setTripDate} />
              </div>
              <div className="grid gap-1.5">
                <Label>Distance (km)</Label>
                {/* Enabled Distance Input */}
                <Input 
                  type="number"
                  value={Number.isFinite(distanceKmDisplay) ? distanceKmDisplay : 0} 
                  onChange={(e) => setRouteKm(Number(e.target.value))}
                  className="bg-background font-medium"
                />
              </div>
            </div>

            {useMap ? (
              <div className="pt-2">
                <GoogleMapPicker 
                  waypoints={waypoints} 
                  onChange={setWaypoints} 
                  onRouteKmChange={setRouteKm} 
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 pt-2 animate-in fade-in">
                 <div className="grid gap-1.5">
                    <Label>Lieu de Départ</Label>
                    <Input 
                      placeholder="Ex: Aéroport Maya Maya" 
                      value={waypoints[0]?.label ?? ""} 
                      onChange={e => handleManualWaypointChange(0, e.target.value)}
                    />
                 </div>
                 <div className="grid gap-1.5">
                    <Label>Lieu d'Arrivée</Label>
                    <Input 
                      placeholder="Ex: Hôtel Pefaco" 
                      value={waypoints[1]?.label ?? ""} 
                      onChange={e => handleManualWaypointChange(1, e.target.value)}
                    />
                 </div>
                 <div className="sm:col-span-2 text-xs text-muted-foreground italic bg-muted/30 p-2 rounded">
                    <IconAlertTriangle className="inline w-3 h-3 mr-1" />
                    En mode manuel, le calcul automatique de distance est désactivé. Veuillez saisir la distance ci-dessus.
                 </div>
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

        {/* 3. Pricing */}
        <div className="space-y-3">
           <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tarification & Ressources</h3>
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

           <div className="grid gap-4 sm:grid-cols-2 mt-2">
             <div className="grid gap-1.5">
               <Label>Évènement</Label>
               <EventCombobox value={eventType} onChange={setEventType} />
             </div>
             <div className="grid gap-1.5">
               <Label>Prix Total Client</Label>
               <div className="relative">
                 {/* Disabled Price Input */}
                 <Input 
                   type="number" 
                   value={manualPrice} 
                   readOnly
                   className="pr-16 font-bold text-emerald-700 bg-muted cursor-not-allowed"
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

        {/* 5. Recap */}
        <div className="space-y-4">
           <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Récapitulatif</h3>
              {quoting && <Badge variant="secondary" className="animate-pulse">Calcul en cours...</Badge>}
           </div>

           <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4 bg-muted/5">
                 <div className="text-xs text-muted-foreground">Total Client</div>
                 <div className="mt-1 text-2xl font-semibold text-emerald-700">
                    {fmtMoney(quote?.client_payable ?? manualPrice, quoteCurrency)}
                 </div>
                 <p className="mt-1 text-xs text-muted-foreground">Montant à facturer</p>
              </div>

              <div className="rounded-lg border p-4 bg-muted/5">
                 <div className="text-xs text-muted-foreground">Part Bus</div>
                 <div className="mt-1 text-2xl font-semibold">
                    {fmtMoney(quote?.breakdown.bus_rounded ?? 0, quoteCurrency)}
                 </div>
                 <p className="mt-1 text-xs text-muted-foreground text-destructive">
                    Dont frais: -{fmtMoney(quote?.breakdown.bus_fees ?? 0, quoteCurrency)}
                 </p>
              </div>

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

      <div className="flex justify-end gap-3 pt-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky bottom-0 -mx-6 -mb-6 p-6 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <Button variant="outline" onClick={onCancel}>Retour</Button>
        <Button onClick={handleConvert} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 min-w-[200px] shadow-lg">
          {loading ? "Conversion..." : "Confirmer & Convertir"}
        </Button>
      </div>
    </div>
  )
}