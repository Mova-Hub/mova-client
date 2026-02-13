// src/components/reservation/AddEditReservation.tsx
"use client"

import * as React from "react"
import { toast } from "sonner"
import { 
  IconCash, 
  IconMapPin, 
  IconInfoCircle, 
  IconAlertTriangle, 
  IconBrandGoogleMaps,
  IconX,
  IconClick,
  IconGripVertical
} from "@tabler/icons-react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, ChevronsUpDown, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { cn, step25 } from "@/lib/utils"

import { 
  useJsApiLoader, 
  GoogleMap, 
  Autocomplete, 
  DirectionsRenderer, 
  Marker 
} from '@react-google-maps/api'

import type { Reservation, Trip, Bus } from "@/types"
import { type UIReservation, type ReservationEvent } from "@/api/reservation"
import type { BusType } from "@/api/bus"
import api from "@/api/apiService"

// --- CONSTANTS ---
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
const BRAZZAVILLE_CENTER = { lat: -4.2634, lng: 15.2429 }
const LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"]
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
type MultiSelectOption = { label: string; value: string; type?: BusType }
type VehicleType = "hiace" | "coaster"
// type EventType = string // Simplified for brevity

function fmtMoney(v: number | null | undefined, curr: string) {
  const n = Number(v ?? 0)
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${curr}`
}

export function buildVehiclesMap(hiace: number, coaster: number) {
  const map: Record<string, number> = {}
  const h = Math.max(0, Math.floor(Number(hiace || 0)))
  const c = Math.max(0, Math.floor(Number(coaster || 0)))
  if (h > 0) map.hiace = h
  if (c > 0) map.coaster = c
  return map
}

/* ----------------------------------------------------------------------------- 
   COMPONENTS
----------------------------------------------------------------------------- */

/* --- Google Map Picker --- */
export function GoogleMapPicker({ 
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

  React.useEffect(() => {
    if (!isLoaded) return
    if (waypoints.length < 2) {
      setDirectionsResponse(null)
      if (waypoints.length < 2) onRouteKmChange(0)
      return
    }

    const timeoutId = setTimeout(() => {
      const directionsService = new google.maps.DirectionsService()
      const origin = waypoints[0]
      const destination = waypoints[waypoints.length - 1]
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
    }, 1000)
    return () => clearTimeout(timeoutId)
  }, [isLoaded, waypoints])

  const onPlaceChanged = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace()
      if (place.geometry && place.geometry.location) {
        onChange([...waypoints, {
          label: place.name || place.formatted_address || "Point recherché",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng()
        }])
        if (searchRef.current) searchRef.current.value = ""
        map?.panTo(place.geometry.location)
        map?.setZoom(14)
      }
    }
  }

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()
    const geocoder = new google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      let label = "Point carte"
      if (status === "OK" && results?.[0]) label = results[0].formatted_address.split(',')[0]
      onChange([...waypoints, { label, lat, lng }])
    })
  }

  const handleMarkerDragEnd = (index: number, e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return
    const next = [...waypoints]
    next[index] = { ...next[index], lat: e.latLng.lat(), lng: e.latLng.lng() }
    onChange(next)
  }

  if (!isLoaded) return <div className="h-[300px] w-full bg-muted animate-pulse rounded-md flex items-center justify-center">Chargement Google Maps...</div>

  return (
    <div className="space-y-3">
      <style>{`.pac-container { z-index: 99999 !important; border-radius: 0.5rem; margin-top: 4px; border: 1px solid #e2e8f0; }`}</style>
      <div className="relative">
        <Autocomplete onLoad={setAutocomplete} onPlaceChanged={onPlaceChanged} restrictions={{ country: "cg" }} fields={["geometry", "name", "formatted_address"]}>
          <Input ref={searchRef} placeholder="Rechercher un lieu au Congo..." className="pl-10" />
        </Autocomplete>
        <IconMapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
      <div className="h-[400px] w-full rounded-md border overflow-hidden relative group">
        <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={BRAZZAVILLE_CENTER} zoom={12} onLoad={setMap} onClick={handleMapClick} options={{ streetViewControl: false, mapTypeControl: false, clickableIcons: false }}>
          {waypoints.map((wp, idx) => wp.lat && wp.lng && (
            <Marker key={`${idx}-${wp.lat}`} position={{ lat: wp.lat, lng: wp.lng }} draggable={true} onDragEnd={(e) => handleMarkerDragEnd(idx, e)} icon={{ path: MARKER_SVG_PATH, fillColor: "#059669", fillOpacity: 1, strokeWeight: 1, strokeColor: "#ffffff", scale: 2, anchor: new google.maps.Point(12, 22), labelOrigin: new google.maps.Point(12, 9) }} label={{ text: (idx + 1).toString(), color: "white", fontSize: "12px", fontWeight: "bold" }} />
          ))}
          {directionsResponse && <DirectionsRenderer directions={directionsResponse} options={{ suppressMarkers: true, polylineOptions: { strokeColor: "#059669", strokeOpacity: 0.8, strokeWeight: 5 } }} />}
        </GoogleMap>
        <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur px-2 py-1 rounded text-[10px] text-muted-foreground shadow-sm pointer-events-none flex items-center gap-1 border">
          <IconClick className="w-3 h-3" /> Cliquez pour ajouter • Glissez pour ajuster
        </div>
      </div>
      <div className="space-y-2">
        {waypoints.map((wp, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded-md border border-transparent hover:border-border transition-colors">
             <div className="cursor-grab text-muted-foreground"><IconGripVertical className="h-4 w-4" /></div>
             <Badge className="h-5 w-5 flex items-center justify-center rounded-full p-0 bg-emerald-600 hover:bg-emerald-700">{idx + 1}</Badge>
             <span className="flex-1 truncate font-medium text-xs text-foreground/80">{wp.label}</span>
             <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => { const next = [...waypoints]; next.splice(idx, 1); onChange(next) }}><IconX className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* --- MultiSelectBuses --- */
export function MultiSelectBuses({ value, onChange, options, placeholder = "Sélectionner des bus" }: { value: string[]; onChange: (ids: string[]) => void; options: Array<MultiSelectOption>; placeholder?: string }) {
  const [open, setOpen] = React.useState(false)
  const [filter, setFilter] = React.useState<"all" | "hiace" | "coaster">("all")
  const selected = new Set(value)
  const filtered = React.useMemo(() => (filter === "all" ? options : options.filter(o => o.type === filter)), [options, filter])
  function toggle(val: string) { const next = new Set(selected); if (next.has(val)) next.delete(val); else next.add(val); onChange(Array.from(next)) }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("flex min-h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm", "hover:bg-accent hover:text-accent-foreground")}>
          <div className="flex min-h-6 flex-wrap items-center gap-1">
            {value.length === 0 ? <span className="text-muted-foreground">{placeholder}</span> : value.map((v) => <Badge key={v} variant="secondary" className="px-2">{options.find((o) => o.value === v)?.label ?? v}</Badge>)}
          </div>
          <span className="ml-3 text-xs text-muted-foreground">{open ? "Fermer" : "Ouvrir"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[480px] p-0" align="start">
        <div className="flex flex-col">
          <div className="sticky top-0 z-10 bg-popover/80 backdrop-blur border-b p-2">
            <Command><CommandInput placeholder="Chercher un bus..." /></Command>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["all", "hiace", "coaster"] as const).map(k => <button key={k} type="button" onClick={() => setFilter(k)} className={cn("rounded-md border px-2 py-1 text-xs capitalize", filter === k ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>{k}</button>)}
            </div>
          </div>
          <div className="max-h-[320px] overflow-auto">
            <Command><CommandList><CommandEmpty>Aucun résultat.</CommandEmpty><CommandGroup>
              {filtered.map((opt) => <CommandItem key={opt.value} value={`${opt.label} ${opt.type ?? ""}`} onSelect={() => toggle(opt.value)} className="flex justify-between">
                <div className="flex items-center gap-2">{opt.type && <Badge variant="outline" className="capitalize">{opt.type}</Badge>}<span>{opt.label}</span></div>
                {selected.has(opt.value) && <span className="text-xs text-primary">Sélectionné</span>}
              </CommandItem>)}
            </CommandGroup></CommandList></Command>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* --- TripDateTimePicker --- */
function pad(n: number) { return String(n).padStart(2, "0") }
function toIsoLocal(d: Date) {
  const y = d.getFullYear(); const m = pad(d.getMonth() + 1); const day = pad(d.getDate())
  const hh = pad(d.getHours()); const mm = pad(d.getMinutes()); const ss = pad(d.getSeconds())
  const offsetMin = d.getTimezoneOffset(); const sign = offsetMin > 0 ? "-" : "+"
  const abs = Math.abs(offsetMin); const oh = pad(Math.floor(abs / 60)); const om = pad(abs % 60)
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}${sign}${oh}:${om}`
}
export function TripDateTimePicker({ valueIso, onChange }: { valueIso?: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const initial = React.useMemo(() => (valueIso ? new Date(valueIso) : new Date()), [valueIso])
  const [date, setDate] = React.useState<Date>(initial)
  const [time, setTime] = React.useState<string>(format(initial, "HH:mm"))
  
  function apply(nextDate?: Date, nextTime?: string) {
    const d = new Date(nextDate ?? date); const [hh, mm] = (nextTime ?? time).split(":").map(Number)
    d.setHours(hh || 0); d.setMinutes(mm || 0); d.setSeconds(0); onChange(toIsoLocal(d))
  }
  const displayLabel = React.useMemo(() => valueIso && !isNaN(new Date(valueIso).getTime()) ? format(new Date(valueIso), "yyyy-MM-dd HH:mm") : "Choisir date", [valueIso])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" /><span className={cn(!valueIso && "text-muted-foreground")}>{displayLabel}</span></Button></PopoverTrigger>
      <PopoverContent className="p-0" align="start"><div className="p-2">
        <Calendar mode="single" selected={date} onSelect={(d) => { if(d) { setDate(d); apply(d, time) } }} initialFocus />
        <div className="mt-3 flex items-center gap-2"><Label className="text-xs">Heure</Label><Input type="time" value={time} onChange={(e) => { setTime(e.target.value); apply(undefined, e.target.value) }} /></div>
        <div className="mt-3 flex justify-end"><Button size="sm" onClick={() => setOpen(false)}>Ok</Button></div>
      </div></PopoverContent>
    </Popover>
  )
}

/* --- EventCombobox --- */
const EVENT_OPTIONS = [
  { value: "none", label: "Aucun" },

  // Éducation
  { value: "school_trip", label: "Voyage scolaire", group: "Éducation" },
  { value: "university_trip", label: "Voyage universitaire", group: "Éducation" },
  { value: "educational_tour", label: "Visite éducative", group: "Éducation" },
  { value: "student_transport", label: "Transport étudiant", group: "Éducation" },
  { value: "school_competition", label: "Compétition scolaire", group: "Éducation" },

  // Cérémonies & famille
  { value: "wedding", label: "Mariage", group: "Cérémonies" },
  { value: "funeral", label: "Funérailles", group: "Cérémonies" },
  { value: "birthday", label: "Anniversaire", group: "Cérémonies" },
  { value: "baptism", label: "Baptême", group: "Cérémonies" },
  { value: "family_meeting", label: "Réunion de famille", group: "Cérémonies" },
  { value: "pilgrimage", label: "Pèlerinage", group: "Cérémonies" },

  // Pro / Officiel
  { value: "conference", label: "Conférence", group: "Pro / Officiel" },
  { value: "seminar", label: "Séminaire", group: "Pro / Officiel" },
  { value: "company_trip", label: "Voyage d’entreprise", group: "Pro / Officiel" },
  { value: "business_mission", label: "Mission professionnelle", group: "Pro / Officiel" },
  { value: "staff_shuttle", label: "Navette du personnel", group: "Pro / Officiel" },
  { value: "administrative_mission", label: "Mission administrative", group: "Pro / Officiel" },
  { value: "official_trip", label: "Voyage officiel", group: "Pro / Officiel" },
  { value: "election_campaign", label: "Campagne électorale", group: "Pro / Officiel" },

  // Sport & Culture
  { value: "football_match", label: "Match de football", group: "Sport & Culture" },
  { value: "sports_tournament", label: "Tournoi sportif", group: "Sport & Culture" },
  { value: "concert", label: "Concert", group: "Sport & Culture" },
  { value: "festival", label: "Festival", group: "Sport & Culture" },

  // Tourisme / Divers
  { value: "tourist_trip", label: "Voyage touristique", group: "Tourisme / Divers" },
  { value: "group_excursion", label: "Excursion de groupe", group: "Tourisme / Divers" },
  { value: "site_visit", label: "Visite de site", group: "Tourisme / Divers" },
  { value: "airport_transfer", label: "Transfert aéroport", group: "Tourisme / Divers" },
  { value: "private_transport", label: "Transport privé", group: "Tourisme / Divers" },
  { value: "special_event", label: "Événement spécial", group: "Tourisme / Divers" },
  { value: "simple_rental", label: "Location simple", group: "Tourisme / Divers" },
]
export function EventCombobox({ value, onChange }: { value: ReservationEvent; onChange: (v: ReservationEvent) => void }) {
  const [open, setOpen] = React.useState(false)
  const current = EVENT_OPTIONS.find(o => o.value === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><Button variant="outline" role="combobox" className="w-full justify-between"><span className="truncate">{current ? current.label : "Choisir..."}</span><ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></PopoverTrigger>
      <PopoverContent className="p-0"><Command><CommandInput placeholder="Type d'événement..." /><CommandList><CommandEmpty>Rien trouvé.</CommandEmpty><CommandGroup>
        {EVENT_OPTIONS.map((opt) => <CommandItem key={opt.value} value={opt.label} onSelect={() => { onChange(opt.value as ReservationEvent); setOpen(false) }}><span>{opt.label}</span>{opt.value === value && <Check className="ml-auto h-4 w-4" />}</CommandItem>)}
      </CommandGroup></CommandList></Command></PopoverContent>
    </Popover>
  )
}

/* ----------------------------------------------------------------------------- 
   MAIN DIALOG COMPONENT
----------------------------------------------------------------------------- */

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: UIReservation | null
  onSubmit: (r: UIReservation) => void
  trips?: Trip[]
  buses: Bus[]
}

export default function AddEditReservationDialog({ open, onOpenChange, editing, onSubmit, buses }: Props) {
  // State
  const [form, setForm] = React.useState<Partial<UIReservation>>({})
  const [waypoints, setWaypoints] = React.useState<Waypoint[]>([])
  const [busIds, setBusIds] = React.useState<string[]>([])
  const [routeKm, setRouteKm] = React.useState<number | null>(null)
  const [useMap, setUseMap] = React.useState(false) // Toggle
  const [eventType, setEventType] = React.useState<ReservationEvent>("none")

  const [quoteCurrency, setQuoteCurrency] = React.useState<string>("FCFA")
  const [hiaceCount, setHiaceCount] = React.useState<number>(0)
  const [coasterCount, setCoasterCount] = React.useState<number>(0)
  
  const [quote, setQuote] = React.useState<QuoteFull | null>(null)
  const [quoting, setQuoting] = React.useState(false)
  const quoteReqSeq = React.useRef(0)

  // -- Helpers --
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

  const busOptions = React.useMemo<MultiSelectOption[]>(() => {
    const uniq: Record<string, boolean> = {}
    return (buses ?? []).filter(b => { if (uniq[b.id]) return false; uniq[b.id] = true; return true }).map(b => ({ label: (b as any).plate || String(b.id), value: String(b.id), type: String((b as any)?.type || "").toLowerCase() as BusType || "other" }))
  }, [buses])

  // -- Initialization --
  React.useEffect(() => {
    const isEdit = !!editing
    setForm(isEdit ? editing! : { status: "pending", seats: 1, route: { from: "", to: "" }, passenger: { name: "", phone: "" }, busIds: [], tripDate: toIsoLocal(new Date()) })
    
    // Init Arrays & Counts
    const ids = (editing?.busIds as string[]) ?? []
    setBusIds(ids)
    
    // Init Waypoints
    const wps = (editing as any)?.waypoints as Waypoint[] | undefined
    if (wps?.length) {
      setWaypoints(wps)
      setUseMap(true) // Auto-enable map if waypoints exist
    } else {
      setWaypoints([])
      setUseMap(false)
    }

    setRouteKm((editing as any)?.distanceKm ?? 0)
    setEventType(((editing as any)?.event as ReservationEvent) ?? "none")

    // Init Counts (if editing, assume the counts match assigned buses initially, or 0 if new)
    if (isEdit && ids.length > 0) {
      const { h, c } = countByType(ids)
      setHiaceCount(Math.max(0, h))
      setCoasterCount(Math.max(0, c))
    } else {
      setHiaceCount(0)
      setCoasterCount(0)
    }
  }, [editing, open, busTypeIndex])

  function setField<K extends keyof Reservation>(key: K, val: Reservation[K]) { setForm((prev) => ({ ...prev, [key]: val })) }
  function setNested(path: string, val: string) {
    setForm((prev) => {
      const next = { ...prev } as any; const parts = path.split("."); let cur = next
      for (let i = 0; i < parts.length - 1; i++) { cur[parts[i]] = cur[parts[i]] ?? {}; cur = cur[parts[i]] }
      cur[parts[parts.length - 1]] = val; return next
    })
  }

  // -- Quoting Logic --
  const distanceKmDisplay = routeKm ?? 0

  React.useEffect(() => {
    let cancelled = false
    const seq = ++quoteReqSeq.current
    
    const distanceOk = Number.isFinite(distanceKmDisplay) && distanceKmDisplay > 0
    const haveCounts = (hiaceCount > 0 || coasterCount > 0)

    if (!(haveCounts && distanceOk)) {
      setQuote(null)
      // Only reset price if it's NOT a manual edit override context (keeping simple: reset if invalid inputs)
      // Actually, for editing existing, we might want to keep old price if quote fails? 
      // Let's reset to 0 to indicate "calc needed" or let user see 0.
      setField("priceTotal", 0 as any)
      return
    }

    const t = setTimeout(async () => {
      setQuoting(true)
      try {
        const vehicles_map = buildVehiclesMap(hiaceCount, coasterCount)
        const res = await api.post<{ currency: string; breakdown: QuoteBreakdown; client_payable: number; bus_payable: number; meta?: Record<string, unknown> }, any>("/quote", { vehicles_map, distance_km: distanceKmDisplay, event: eventType })
        if (cancelled || seq !== quoteReqSeq.current) return
        setQuote(res.data)
        setField("priceTotal", res.data.client_payable as any)
        setQuoteCurrency(res.data.currency)
      } catch (e) {
        if (!cancelled) { setQuote(null); toast.error("Erreur calcul tarif") }
      } finally { if (!cancelled) setQuoting(false) }
    }, 600)
    return () => { cancelled = true; clearTimeout(t) }
  }, [eventType, distanceKmDisplay, hiaceCount, coasterCount])

  // -- Handlers --
  function setBusIdsLimited(next: string[]) {
    const added = next.find(id => !busIds.includes(id))
    if (!added) { setBusIds(next); return }
    const t = busTypeIndex[added]
    const { h, c } = countByType(next)
    if (t === "hiace" && h > hiaceCount) return toast.error(`Max ${hiaceCount} Hiace.`)
    if (t === "coaster" && c > coasterCount) return toast.error(`Max ${coasterCount} Coaster.`)
    setBusIds(next)
  }

  const handleManualWaypointChange = (idx: number, val: string) => {
    const next = [...waypoints]
    if (!next[0]) next[0] = { label: "" }
    if (!next[1]) next[1] = { label: "" }
    next[idx] = { ...next[idx], label: val }
    setWaypoints(next)
  }

  function handleSubmit() {
    if (!form.passenger?.name || !form.passenger?.phone) return toast.error("Nom et téléphone requis.")
    if (busIds.length === 0) return toast.error("Assignez au moins un bus.")

    const id = editing?.id ?? (crypto.randomUUID() as Reservation["id"])
    const code = editing?.code ?? `BZV-${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`
    const fromLabel = waypoints[0]?.label || form.route?.from || "Départ"
    const toLabel = waypoints[waypoints.length - 1]?.label || form.route?.to || "Arrivée"

    const payload: UIReservation = {
      ...form as UIReservation,
      id, code,
      route: { from: fromLabel, to: toLabel },
      busIds,
      event: eventType,
      seats: Number(form.seats ?? 1),
      priceTotal: Number(form.priceTotal ?? 0),
      distanceKm: distanceKmDisplay,
      // Convertis explicitement pour satisfaire UIWaypoint
      waypoints: waypoints
        .filter(w => !!w.label)
        .map(w => ({
          lat: w.lat ?? 0,
          lng: w.lng ?? 0,
          label: w.label
        }))
    }
    onSubmit(payload)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-none w-[min(100vw-0.5rem,1600px)] h-[95vh] max-h-[calc(100dvh-1rem)] flex flex-col bg-background">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{editing ? "Modifier la réservation" : "Nouvelle réservation"}</DialogTitle>
          <DialogDescription>Gérez l'itinéraire, le tarif et l'affectation des bus.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-8">
          
          {/* 1. Itinerary */}
          <div className="space-y-4 pt-4">
             <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Itinéraire</h3>
                <div className="flex items-center gap-2">
                   <Switch id="map-mode" checked={useMap} onCheckedChange={setUseMap} />
                   <Label htmlFor="map-mode" className="text-xs cursor-pointer flex items-center gap-1"><IconBrandGoogleMaps className="w-3 h-3" />Utiliser Google Maps</Label>
                </div>
             </div>
             <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                   <Label>Date du trajet</Label>
                   <TripDateTimePicker valueIso={form.tripDate} onChange={(v) => setField("tripDate", v as any)} />
                </div>
                <div className="grid gap-1.5">
                   <Label>Distance (km)</Label>
                   <Input type="number" value={distanceKmDisplay} onChange={e => setRouteKm(Number(e.target.value))} className="bg-background font-medium" />
                </div>
             </div>
             {useMap ? (
               <div className="pt-2"><GoogleMapPicker waypoints={waypoints} onChange={setWaypoints} onRouteKmChange={setRouteKm} /></div>
             ) : (
               <div className="grid gap-4 sm:grid-cols-2 pt-2 animate-in fade-in">
                  <div className="grid gap-1.5"><Label>Départ</Label><Input placeholder="Ex: Aéroport" value={waypoints[0]?.label ?? ""} onChange={e => handleManualWaypointChange(0, e.target.value)} /></div>
                  <div className="grid gap-1.5"><Label>Arrivée</Label><Input placeholder="Ex: Centre Ville" value={waypoints[1]?.label ?? ""} onChange={e => handleManualWaypointChange(1, e.target.value)} /></div>
                  <div className="sm:col-span-2 text-xs text-muted-foreground italic bg-muted/30 p-2 rounded"><IconAlertTriangle className="inline w-3 h-3 mr-1" />Mode manuel: saisissez la distance ci-dessus pour le tarif.</div>
               </div>
             )}
          </div>
          <Separator />

          {/* 2. Passenger */}
          <div className="space-y-3">
             <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Passager</h3>
             <div className="grid gap-4 sm:grid-cols-2">
               <div className="grid gap-1.5"><Label>Nom</Label><Input value={form.passenger?.name ?? ""} onChange={e => setNested("passenger.name", e.target.value)} /></div>
               <div className="grid gap-1.5"><Label>Téléphone</Label><Input value={form.passenger?.phone ?? ""} onChange={e => setNested("passenger.phone", e.target.value)} /></div>
               <div className="grid gap-1.5 sm:col-span-2"><Label>Email</Label><Input value={form.passenger?.email ?? ""} onChange={e => setNested("passenger.email", e.target.value)} /></div>
             </div>
          </div>
          <Separator />

          {/* 3. Pricing */}
          <div className="space-y-3">
             <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tarification & Ressources</h3>
             <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5"><Label>Hiace (nombre)</Label><Input type="number" min={0} value={hiaceCount} onChange={e => setHiaceCount(Math.max(0, Math.floor(Number(e.target.value))))} /></div>
                <div className="grid gap-1.5"><Label>Coaster (nombre)</Label><Input type="number" min={0} value={coasterCount} onChange={e => setCoasterCount(Math.max(0, Math.floor(Number(e.target.value))))} /></div>
             </div>
             <div className="grid gap-4 sm:grid-cols-2 mt-2">
               <div className="grid gap-1.5"><Label>Évènement</Label><EventCombobox value={eventType} onChange={setEventType} /></div>
               <div className="grid gap-1.5"><Label>Prix Total</Label><div className="relative"><Input type="number" value={form.priceTotal ?? 0} readOnly className="pr-16 font-bold text-emerald-700 bg-muted cursor-not-allowed" /><div className="absolute right-3 top-2.5 text-xs text-muted-foreground">{quoteCurrency}</div></div></div>
             </div>
          </div>
          <Separator />

          {/* 4. Bus */}
          <div className="space-y-3">
             <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Affectation des Bus</h3>
             <div className="grid gap-1.5">
               <Label>Sélection (Max: {hiaceCount} Hiace, {coasterCount} Coaster)</Label>
               <MultiSelectBuses value={busIds} onChange={setBusIdsLimited} options={busOptions} />
             </div>
          </div>
          <Separator />

          {/* 5. Recap */}
          <div className="space-y-4 pb-4">
             <div className="flex items-center justify-between"><h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Récapitulatif</h3>{quoting && <Badge variant="secondary" className="animate-pulse">Calcul...</Badge>}</div>
             <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4 bg-muted/5"><div className="text-xs text-muted-foreground">Total Client</div><div className="mt-1 text-2xl font-semibold text-emerald-700">{fmtMoney(quote?.client_payable ?? form.priceTotal, quoteCurrency)}</div></div>
                <div className="rounded-lg border p-4 bg-muted/5"><div className="text-xs text-muted-foreground">Part Bus</div><div className="mt-1 text-2xl font-semibold">{fmtMoney(quote?.breakdown.bus_rounded, quoteCurrency)}</div></div>
                <div className="rounded-lg border p-4 bg-muted/5"><div className="text-xs text-muted-foreground">Commission</div><div className="mt-1 text-2xl font-semibold text-primary">{fmtMoney(quote?.breakdown.commission, quoteCurrency)}</div></div>
             </div>
          </div>

        </div>

        <DialogFooter className="border-t bg-background px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={quoting}>{editing ? "Enregistrer" : "Créer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}