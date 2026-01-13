"use client"

import * as React from "react"
import mapboxgl from "mapbox-gl"
import { toast } from "sonner"

import type { Reservation, Trip, Bus } from "@/types"
import type { UIReservation } from "@/api/reservation"

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
import { cn } from "@/lib/utils"
import { Info, Calendar as CalendarIcon, ChevronsUpDown, Check } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import api from "@/api/apiService"

/* ----------------------------------------------------------------------------- 
   ENV
----------------------------------------------------------------------------- */
const MAPBOX_TOKEN = "pk.eyJ1IjoiYXJkZW4tYm91ZXQiLCJhIjoiY21maWgyY3dvMGF1YTJsc2UxYzliNnA0ZCJ9.XC5hXXwEa-NCUPpPtBdWCA"
mapboxgl.accessToken = MAPBOX_TOKEN

/* --------------------------------- Helpers --------------------------------- */

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLon = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const sinDlat = Math.sin(dLat / 2)
  const sinDlon = Math.sin(dLon / 2)
  const h = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon
  return 2 * R * Math.asin(Math.sqrt(h))
}

function totalPathKm(points: { lat: number; lng: number }[]) {
  if (points.length < 2) return 0
  let sum = 0
  for (let i = 1; i < points.length; i++) sum += haversineKm(points[i - 1], points[i])
  return sum
}

const alphaLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")
const autoLabel = (i: number) => `Point ${alphaLabels[i] ?? String(i + 1)}`

/* ---------------------------- Mapbox Geocoding ----------------------------- */

async function geocodeForward(q: string, token: string) {
  if (!q || !token) return []

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    q
  )}.json?access_token=${token}&limit=6&language=fr`

  const r = await fetch(url)
  if (!r.ok) return []

  const j: { features?: { place_name: string; center: [number, number] }[] } = await r.json()

  return (j.features ?? []).map((f) => ({
    label: f.place_name,
    lng: f.center?.[0] ?? 0,
    lat: f.center?.[1] ?? 0,
  }))
}

async function reverseGeocode(lng: number, lat: number, token: string) {
  if (!token) return undefined
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1&language=fr`
  const r = await fetch(url)
  if (!r.ok) return undefined
  const j = await r.json()
  const name = j?.features?.[0]?.place_name as string | undefined
  return name
}

/* ------------------------------ Directions API ---------------------------- */

type Waypoint = { lat: number; lng: number; label: string }

type DirectionsResult = {
  geometry: GeoJSON.LineString | null
  distanceKm: number | null
}

async function getDrivingRoute(pts: Waypoint[], token: string): Promise<DirectionsResult> {
  if (!token || pts.length < 2) return { geometry: null, distanceKm: null }
  const coords = pts.map(p => `${p.lng},${p.lat}`).join(";")
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}.json?geometries=geojson&overview=full&language=fr&access_token=${token}`
  const r = await fetch(url)
  if (!r.ok) return { geometry: null, distanceKm: null }
  const j = await r.json()
  const route = j?.routes?.[0]
  if (!route?.geometry) return { geometry: null, distanceKm: null }
  const km = typeof route.distance === "number" ? Math.round((route.distance / 1000) * 100) / 100 : null
  return { geometry: route.geometry as GeoJSON.LineString, distanceKm: km }
}

/* ------------------------------ UI Helpers -------------------------------- */

type MultiSelectOption = { label: string; value: string }

function EnvAlert({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
      <Info className="mt-0.5 h-4 w-4" />
      <div className="text-sm">{message}</div>
    </div>
  )
}

/* --------------------------- MultiSelect (buses) --------------------------- */

export function MultiSelectBuses({
  value,
  onChange,
  options,
  placeholder = "Sélectionner des bus",
}: {
  value: string[]
  onChange: (ids: string[]) => void
  options: MultiSelectOption[]
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = new Set(value)

  function toggle(val: string) {
    const next = new Set(selected)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange(Array.from(next))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-10 w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm",
            "hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <div className="flex min-h-6 flex-wrap items-center gap-1">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              value.map((v) => {
                const opt = options.find((o) => o.value === v)
                return (
                  <Badge key={v} variant="secondary" className="px-2">
                    {opt?.label ?? v}
                  </Badge>
                )
              })
            )}
          </div>
          <span className="ml-3 text-xs text-muted-foreground">{open ? "Fermer" : "Ouvrir"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Chercher un bus…" />
          <CommandList>
            <CommandEmpty>Aucun résultat.</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const active = selected.has(opt.value)
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => toggle(opt.value)}
                    className="flex items-center justify-between"
                  >
                    <span>{opt.label}</span>
                    {active ? (
                      <span className="text-xs text-primary">Sélectionné</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Ajouter</span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* --------------------------------- MapPicker -------------------------------- */

function MapPicker({
  waypoints,
  onChange,
  onRouteKmChange,
}: {
  waypoints: Waypoint[]
  onChange: (wps: Waypoint[]) => void
  onRouteKmChange: (km: number | null) => void
}) {
  const mapRef = React.useRef<mapboxgl.Map | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const markersRef = React.useRef<mapboxgl.Marker[]>([])

  const routeSourceId = React.useRef(`route-src-${Math.random().toString(36).slice(2)}`)
  const routeLayerId = React.useRef(`route-lyr-${Math.random().toString(36).slice(2)}`)

  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<{ label: string; lat: number; lng: number }[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const id = setTimeout(async () => {
      if (!query || query.trim().length < 2) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const res = await geocodeForward(query.trim(), MAPBOX_TOKEN)
        setResults(res)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [query])

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    if (!MAPBOX_TOKEN) return

    const DEFAULT_CENTER: [number, number] = [15.2832, -4.2667]

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: DEFAULT_CENTER,
      zoom: 10,
      maxZoom: 18,
      accessToken: MAPBOX_TOKEN,
    })
    mapRef.current = map

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords
          map.setCenter([longitude, latitude])
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 60000, timeout: 7000 }
      )
    }

    map.on("click", async (e) => {
      const { lng, lat } = e.lngLat
      let label = await reverseGeocode(lng, lat, MAPBOX_TOKEN)
      if (!label) label = autoLabel(waypoints.length)
      onChange([...waypoints, { lat, lng, label }])
      map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 14), duration: 500 })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [onChange, waypoints.length])

  React.useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    waypoints.forEach((wp, idx) => {
      const el = document.createElement("div")
      el.className =
        "rounded-full bg-primary text-primary-foreground text-[11px] px-2 py-1 shadow ring-1 ring-black/10"
      el.textContent = alphaLabels[idx] ?? String(idx + 1)

      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map)

      marker.on("dragend", async () => {
        const pos = marker.getLngLat()
        const next = [...waypoints]
        const newLabel =
          (await reverseGeocode(pos.lng, pos.lat, MAPBOX_TOKEN)) || next[idx].label || autoLabel(idx)
        next[idx] = { ...next[idx], lat: pos.lat, lng: pos.lng, label: newLabel }
        onChange(next)
      })

      markersRef.current.push(marker)
    })

    if (waypoints.length > 0) {
      const bounds = new mapboxgl.LngLatBounds(
        [waypoints[0].lng, waypoints[0].lat],
        [waypoints[0].lng, waypoints[0].lat]
      )
      waypoints.forEach((p) => bounds.extend([p.lng, p.lat]))
      map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 500 })
    }
  }, [waypoints, onChange])

  React.useEffect(() => {
    ;(async () => {
      const map = mapRef.current
      if (!map) return

      if (waypoints.length < 2) {
        if (map.getSource(routeSourceId.current)) {
          (map.getSource(routeSourceId.current) as mapboxgl.GeoJSONSource).setData({
            type: "FeatureCollection",
            features: [],
          })
        }
        onRouteKmChange(null)
        return
      }

      try {
        const { geometry, distanceKm } = await getDrivingRoute(waypoints, MAPBOX_TOKEN)
        onRouteKmChange(distanceKm ?? null)

        const data: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
          type: "FeatureCollection",
          features: geometry ? [{ type: "Feature", geometry, properties: {} }] : [],
        }

        if (!map.getSource(routeSourceId.current)) {
          map.addSource(routeSourceId.current, { type: "geojson", data })
          map.addLayer({
            id: routeLayerId.current,
            type: "line",
            source: routeSourceId.current,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-width": 5, "line-color": "#2563eb", "line-opacity": 0.9 },
          })
        } else {
          (map.getSource(routeSourceId.current) as mapboxgl.GeoJSONSource).setData(data)
        }

        if (geometry?.coordinates?.length) {
          const coords = geometry.coordinates
          const bounds = new mapboxgl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
          coords.forEach((c) => bounds.extend(c as [number, number]))
          map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 500 })
        }
      } catch {
        // fallback via Haversine
      }
    })()
  }, [waypoints, onRouteKmChange])

  function addResultToPath(r: { label: string; lat: number; lng: number }) {
    onChange([...waypoints, { lat: r.lat, lng: r.lng, label: r.label }])
    setQuery("")
    setResults([])
    const map = mapRef.current
    if (map) map.easeTo({ center: [r.lng, r.lat], zoom: Math.max(map.getZoom(), 14), duration: 500 })
  }

  return (
    <div className="space-y-3">
      {/* Recherche lieu */}
      <div className="relative">
        <Input
          placeholder="Rechercher un lieu (ville, adresse…)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover p-1 shadow">
            {loading && <div className="px-2 py-1.5 text-sm text-muted-foreground">Recherche…</div>}
            {!loading && results.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">Aucun résultat</div>
            )}
            {!loading &&
              results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => addResultToPath(r)}
                >
                  {r.label}
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Carte — bigger & responsive */}
      <div
        ref={containerRef}
        className="h-[360px] sm:h-[420px] md:h-[500px] w-full rounded-lg border"
      />

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" type="button" onClick={() => onChange([])} size="sm">
          Réinitialiser la carte
        </Button>
      </div>
    </div>
  )
}

/* --------------------------------- Dialog ---------------------------------- */

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: UIReservation | null
  onSubmit: (r: UIReservation) => void
  trips?: Trip[]
  buses: Bus[]
}

type VehicleType = "hiace" | "coaster"
type EventType =
  | "none"
  | "school_trip"
  | "university_trip"
  | "educational_tour"
  | "student_transport"
  | "wedding"
  | "funeral"
  | "birthday"
  | "baptism"
  | "family_meeting"
  | "conference"
  | "seminar"
  | "company_trip"
  | "business_mission"
  | "staff_shuttle"
  | "football_match"
  | "sports_tournament"
  | "concert"
  | "festival"
  | "school_competition"
  | "tourist_trip"
  | "group_excursion"
  | "pilgrimage"
  | "site_visit"
  | "airport_transfer"
  | "election_campaign"
  | "administrative_mission"
  | "official_trip"
  | "private_transport"
  | "special_event"
  | "simple_rental";

type QuoteResponse = {
  currency: string
  client_payable: number
  bus_payable: number
}

/* ----------------------------- Event Combobox ------------------------------ */

const EVENT_OPTIONS: { value: EventType; label: string; group?: string }[] = [
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

function groupBy<T, K extends string | number | symbol>(arr: T[], key: (t: T) => K) {
  return arr.reduce((acc, item) => {
    const k = key(item)
    ;(acc[k] ||= []).push(item)
    return acc
  }, {} as Record<K, T[]>)
}

function EventCombobox({
  value,
  onChange,
}: {
  value: EventType
  onChange: (v: EventType) => void
}) {
  const [open, setOpen] = React.useState(false)
  const current = EVENT_OPTIONS.find(o => o.value === value)
  const grouped = React.useMemo(
    () => groupBy(EVENT_OPTIONS, (o) => o.group ?? "Autres"),
    []
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className={cn("truncate", !current && "text-muted-foreground")}>
            {current ? current.label : "Choisir un évènement"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[calc(100vw-2rem)] sm:w-[420px]" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un évènement…" />
          <CommandList>
            <CommandEmpty>Aucun évènement</CommandEmpty>
            {Object.entries(grouped).map(([g, items]) => (
              <CommandGroup key={g} heading={g}>
                {items.map((opt) => {
                  const selected = opt.value === value
                  return (
                    <CommandItem
                      key={opt.value}
                      value={opt.label}
                      onSelect={() => { onChange(opt.value); setOpen(false) }}
                      className="flex items-center justify-between"
                    >
                      <span>{opt.label}</span>
                      {selected && <Check className="h-4 w-4 text-primary" />}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* --------------------------- Local ISO helpers ----------------------------- */

function pad(n: number) { return String(n).padStart(2, "0") }
function toIsoLocal(d: Date) {
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  const ss = pad(d.getSeconds())
  const offsetMin = d.getTimezoneOffset()
  const sign = offsetMin > 0 ? "-" : "+"
  const abs = Math.abs(offsetMin)
  const oh = pad(Math.floor(abs / 60))
  const om = pad(abs % 60)
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}${sign}${oh}:${om}`
}

/* ---------------------------- Datetime Picker ------------------------------ */

function TripDateTimePicker({
  valueIso,
  onChange,
}: {
  valueIso?: string
  onChange: (iso: string) => void
}) {
  const [open, setOpen] = React.useState(false)

  const initial = React.useMemo(() => (valueIso ? new Date(valueIso) : new Date()), [valueIso])
  const [date, setDate] = React.useState<Date>(initial)
  const [time, setTime] = React.useState<string>(format(initial, "HH:mm"))

  React.useEffect(() => {
    if (!valueIso) return
    const d = new Date(valueIso)
    if (!Number.isNaN(d.getTime())) {
      setDate(d)
      setTime(format(d, "HH:mm"))
    }
  }, [valueIso])

  function apply(nextDate?: Date, nextTime?: string) {
    const d = new Date(nextDate ?? date)
    const [hh, mm] = (nextTime ?? time).split(":").map((s) => Number(s))
    d.setHours(Number.isFinite(hh) ? hh : 0)
    d.setMinutes(Number.isFinite(mm) ? mm : 0)
    d.setSeconds(0)
    onChange(toIsoLocal(d))
  }

  const displayLabel = React.useMemo(() => {
    const d = valueIso ? new Date(valueIso) : date
    return Number.isNaN(d.getTime()) ? "Choisir une date & heure" : format(d, "yyyy-MM-dd HH:mm")
  }, [valueIso, date])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className={cn(!valueIso && "text-muted-foreground")}>
            {displayLabel}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <div className="p-2">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(d) => {
              if (!d) return
              // keep time
              const withOldTime = new Date(d)
              const [hh, mm] = time.split(":").map(Number)
              withOldTime.setHours(hh || 0, mm || 0, 0, 0)
              setDate(withOldTime)
              apply(withOldTime, time)
            }}
            initialFocus
          />
          <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3">
            <Label className="text-xs text-muted-foreground">Heure</Label>
            <Input
              type="time"
              step={300} // 5 minutes
              value={time}
              onChange={(e) => {
                const t = e.target.value || "00:00"
                setTime(t)
                apply(undefined, t)
              }}
            />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const now = new Date()
                setDate(now)
                const t = format(now, "HH:mm")
                setTime(t)
                onChange(toIsoLocal(now))
              }}
            >
              Maintenant
            </Button>
            <Button type="button" onClick={() => setOpen(false)}>
              Valider
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function AddEditReservationDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
  trips,
  buses,
}: Props) {
  const [form, setForm] = React.useState<Partial<UIReservation>>({})
  const [waypoints, setWaypoints] = React.useState<Waypoint[]>([])
  const [busIds, setBusIds] = React.useState<string[]>([])
  const [routeKm, setRouteKm] = React.useState<number | null>(null)

  const [vehicleType, setVehicleType] = React.useState<VehicleType>("hiace")
  const [eventType, setEventType] = React.useState<EventType>("none")
  const [quoteCurrency, setQuoteCurrency] = React.useState<string>("FCFA")
  const [hiaceCount, setHiaceCount] = React.useState<number>(0)
  const [coasterCount, setCoasterCount] = React.useState<number>(0)
  const [quoting, setQuoting] = React.useState(false)

  const busOptions = React.useMemo<MultiSelectOption[]>(() => {
    const uniq: Record<string, boolean> = {}
    return (buses ?? [])
      .filter(b => !!b?.id)
      .filter(b => {
        if (uniq[b.id]) return false
        uniq[b.id] = true
        return true
      })
      .map(b => ({ label: (b as any).plate || b.id, value: b.id }))
  }, [buses])

  React.useEffect(() => {
    setForm(
      editing ?? {
        status: "pending",
        seats: 1,
        route: { from: "", to: "" },
        passenger: { name: "", phone: "" },
        busIds: [],
        tripDate: toIsoLocal(new Date()),
      }
    )
    setBusIds((editing?.busIds as string[]) ?? [])
    const edWp = (editing as any)?.waypoints as Waypoint[] | undefined
    if (edWp?.length) setWaypoints(edWp)
    else setWaypoints([])
    setRouteKm((editing as any)?.distanceKm ?? null)

    // hydrate event selector from existing row (fallback to "none")
    setEventType(((editing as any)?.event as EventType) ?? "none")
  }, [editing, open])

  function setField<K extends keyof Reservation>(key: K, val: Reservation[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function setNested(path: string, val: string) {
    setForm((prev) => {
      const next = { ...prev } as any
      const parts = path.split(".")
      let cur = next
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = cur[parts[i]] ?? {}
        cur = cur[parts[i]]
      }
      cur[parts[parts.length - 1]] = val
      return next
    })
  }

  const havKm = React.useMemo(() => {
    return Math.round(totalPathKm(waypoints.map((w) => ({ lat: w.lat, lng: w.lng }))) * 100) / 100
  }, [waypoints])

  const distanceKmDisplay = routeKm ?? havKm
  const busCount = busIds.length || 1

  React.useEffect(() => {
    let cancel = false

    const distanceOk = Number.isFinite(distanceKmDisplay) && (distanceKmDisplay ?? 0) >= 0
    const canQuote = eventType !== undefined && distanceOk && (busIds.length > 0 || !!vehicleType)

    if (!canQuote) return

    const t = setTimeout(async () => {
      setQuoting(true)
      try {
        // Prefer mixed-vehicle path when user selected specific buses
        let payload:
          | { bus_ids: number[]; distance_km: number; event: EventType }
          | { vehicle_type: VehicleType; distance_km: number; event: EventType; buses: number }

        if (busIds.length > 0) {
          // Convert IDs to numbers if possible; leave as-is if not
          const ids = busIds.map((id) => {
            const n = Number(id)
            return Number.isFinite(n) ? n : (id as unknown as number)
          })
          payload = {
            bus_ids: ids,
            distance_km: Number(distanceKmDisplay ?? 0),
            event: eventType,
          }
        } else {
          // Legacy single-type path
          const busesCount = Math.max(1, Number(busCount || 1))
          payload = {
            vehicle_type: vehicleType,
            distance_km: Number(distanceKmDisplay ?? 0),
            event: eventType,
            buses: busesCount,
          }
        }

        const res = await api.post<QuoteResponse, typeof payload>("/quote", payload)
        if (cancel) return
        setField("priceTotal", res.data.client_payable as any)
        if (res.data?.currency) setQuoteCurrency(res.data.currency)
      } catch (e: any) {
        if (!cancel) toast.error(e?.message ?? "Échec du calcul du tarif.")
      } finally {
        if (!cancel) setQuoting(false)
      }
    }, 400)

    return () => {
      cancel = true
      clearTimeout(t)
    }
  }, [vehicleType, eventType, distanceKmDisplay, busIds]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit() {
    if (!form.passenger?.name || !form.passenger?.phone) {
      toast.error("Nom et téléphone du passager sont obligatoires.")
      return
    }
    if (waypoints.length < 2) {
      toast.error("Sélectionnez au minimum un départ et une arrivée sur la carte.")
      return
    }

    const id = editing?.id ?? (crypto.randomUUID() as Reservation["id"])
    const code = editing?.code ?? `BZV-${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`

    const seats = Number(form.seats ?? 1)
    const priceTotal = Number(form.priceTotal ?? 0)

    const fromLabel = waypoints[0]?.label || "Départ"
    const toLabel   = waypoints[waypoints.length - 1]?.label || "Arrivée"

    const uiPayload: UIReservation = {
      id,
      code,
      tripDate: String(form.tripDate ?? toIsoLocal(new Date())), // full ISO datetime
      route: { from: fromLabel, to: toLabel },
      passenger: {
        name: String(form.passenger?.name ?? ""),
        phone: String(form.passenger?.phone ?? ""),
        email: form.passenger?.email ? String(form.passenger.email) : undefined,
      },
      seats: isNaN(seats) ? 1 : seats,
      busIds,
      event: eventType,
      priceTotal: isNaN(priceTotal) ? 0 : priceTotal,
      status: (form.status as Reservation["status"]) ?? "pending",
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      ...( { distanceKm: routeKm ?? havKm } as any ),
      ...( { waypoints } as any ),
    }

    // Map to API shape (snake_case) for Laravel
    const apiPayload: any = {
      code: code || undefined,
      trip_date: uiPayload.tripDate || undefined, // full ISO datetime
      from_location: fromLabel || undefined,
      to_location: toLabel || undefined,

      passenger_name: uiPayload.passenger?.name || undefined,
      passenger_phone: uiPayload.passenger?.phone || undefined,
      passenger_email: uiPayload.passenger?.email ?? undefined,

      seats: uiPayload.seats,
      price_total: uiPayload.priceTotal ?? null,

      status: uiPayload.status,

      waypoints: waypoints?.length ? waypoints.map(w => ({
        lat: w.lat,
        lng: w.lng,
        label: w.label || null,
      })) : undefined,

      distance_km: (routeKm ?? havKm) ?? null,
      bus_ids: busIds?.length ? busIds : null,
      event: eventType,
    }

    Object.keys(apiPayload).forEach(k => apiPayload[k] === undefined && delete apiPayload[k])

    onSubmit(uiPayload)
    onOpenChange(false)
    toast(editing ? "Réservation mise à jour." : "Réservation ajoutée.")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          p-0
          sm:max-w-none
          w-[min(100vw-0.5rem,1600px)]
          h-[95vh]
          max-h-[calc(100dvh-1rem)]
          flex flex-col
        "
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>{editing ? "Modifier la réservation" : "Ajouter une réservation"}</DialogTitle>
          <DialogDescription>
            Organisez l’itinéraire (carte), assignez les bus, puis renseignez les détails du passager.
          </DialogDescription>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {/* Itinéraire & Carte */}
          <div className="space-y-3 py-4">
            <h3 className="text-sm font-medium text-muted-foreground">Itinéraire & Carte</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Date du trajet</Label>
                <TripDateTimePicker
                  valueIso={form.tripDate ?? ""}
                  onChange={(iso) => setField("tripDate", iso as any)}
                />
              </div>

              <div className="grid gap-1.5">
                <Label>Distance totale (km)</Label>
                <Input value={Number.isFinite(distanceKmDisplay) ? distanceKmDisplay : 0} readOnly />
              </div>
            </div>

            {!MAPBOX_TOKEN && (
              <EnvAlert message="Clé Mapbox manquante. Ajoutez VITE_MAPBOX_TOKEN dans votre fichier .env puis redémarrez le serveur." />
            )}

            {MAPBOX_TOKEN ? (
              <MapPicker
                waypoints={waypoints}
                onChange={setWaypoints}
                onRouteKmChange={setRouteKm}
              />
            ) : (
              <div className="h-[360px] sm:h-[420px] md:h-[500px] w-full rounded-lg border grid place-items-center text-sm text-muted-foreground">
                Carte désactivée — configurez d’abord <code>VITE_MAPBOX_TOKEN</code>.
              </div>
            )}

            {/* Liste & étiquetage */}
            <div className="space-y-2">
              <Label>Points de l’itinéraire</Label>
              <div className="grid gap-2">
                {waypoints.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Cliquez sur la carte pour définir le départ, l’arrivée et vos étapes éventuelles.
                  </p>
                )}
                {waypoints.map((wp, idx) => (
                  <div key={`${wp.lat}-${wp.lng}-${idx}`} className="flex items-center gap-2">
                    <Badge variant="secondary">{alphaLabels[idx] ?? idx + 1}</Badge>
                    <Input
                      className="flex-1"
                      value={wp.label}
                      onChange={(e) => {
                        const next = [...waypoints]
                        next[idx] = { ...next[idx], label: e.target.value }
                        setWaypoints(next)
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => {
                        const next = [...waypoints]
                        next.splice(idx, 1)
                        setWaypoints(next)
                      }}
                    >
                      Retirer
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Astuce : faites glisser les marqueurs sur la carte pour affiner précisément la position.
              </p>
            </div>
          </div>

          <Separator />

          {/* Passager */}
          <div className="space-y-3 py-4">
            <h3 className="text-sm font-medium text-muted-foreground">Passager</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Nom</Label>
                <Input
                  value={form.passenger?.name ?? ""}
                  onChange={(e) => setNested("passenger.name", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Téléphone</Label>
                <Input
                  value={form.passenger?.phone ?? ""}
                  onChange={(e) => setNested("passenger.phone", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Email (optionnel)</Label>
                <Input
                  value={form.passenger?.email ?? ""}
                  onChange={(e) => setNested("passenger.email", e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Bus */}
          <div className="space-y-3 py-4">
            <h3 className="text-sm font-medium text-muted-foreground">Affectation des bus</h3>
            <div className="grid gap-1.5">
              <Label>Bus (multi-sélection)</Label>
              <MultiSelectBuses
                value={busIds}
                onChange={setBusIds}
                options={busOptions}
                placeholder="Sélectionner des bus"
              />
              <p className="text-xs text-muted-foreground">
                Les bus proviennent de votre parc (libellés = plaques).
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Si vous sélectionnez des bus, le calcul utilisera leurs types réels (mix Hiace/Coaster).
              </p>
            </div>
          </div>

          <Separator />

          {/* Détails réservation */}
          <div className="space-y-3 py-4">
            <h3 className="text-sm font-medium text-muted-foreground">Détails de la réservation</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Sièges</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.seats ?? 1}
                  onChange={(e) => setField("seats", Number(e.target.value) as any)}
                />
              </div>

              <div className="grid gap-1.5">
                <Label>Type de véhicule</Label>
                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm capitalize"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                  disabled={busIds.length > 0}
                >
                  <option value="hiace">hiace</option>
                  <option value="coaster">coaster</option>
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label>Évènement</Label>
                <EventCombobox value={eventType} onChange={setEventType} />
              </div>

              <div className="grid gap-1.5">
                <Label>Total</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    value={form.priceTotal ?? 0}
                    onChange={(e) => setField("priceTotal", Number(e.target.value) as any)}
                    className="pr-16"
                    readOnly
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 grid w-16 place-items-center text-xs text-muted-foreground">
                    {quoteCurrency}
                  </div>
                </div>
              </div>

              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Statut</Label>
                <div className="grid grid-cols-3 gap-2">
                  {["pending", "confirmed", "cancelled"].map((s) => (
                    <Button
                      key={s}
                      type="button"
                      variant={(form.status ?? "pending") === s ? "default" : "outline"}
                      onClick={() => setField("status", s as any)}
                    >
                      {s === "pending" && "En attente"}
                      {s === "confirmed" && "Confirmée"}
                      {s === "cancelled" && "Annulée"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="bottom-0 z-10 mt-0 border-t bg-background px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={quoting}>
            {editing ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
