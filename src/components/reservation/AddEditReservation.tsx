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
import { cn, step25 } from "@/lib/utils"
import { Info, Calendar as CalendarIcon, ChevronsUpDown, Check } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import api from "@/api/apiService"
import type { BusType } from "@/api/bus"

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
// build the vehicles[] array the API expects (repeat by count)
function buildVehiclesArray(hiace: number, coaster: number) {
  const arr: string[] = []
  for (let i = 0; i < Math.max(0, hiace|0); i++) arr.push("hiace")
  for (let i = 0; i < Math.max(0, coaster|0); i++) arr.push("coaster")
  return arr
}

function buildVehiclesMap(hiace: number, coaster: number) {
  const map: Record<string, number> = {}
  const h = Math.max(0, Math.floor(Number(hiace || 0)))
  const c = Math.max(0, Math.floor(Number(coaster || 0)))
  if (h > 0) map.hiace = h
  if (c > 0) map.coaster = c
  return map
}


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

type MultiSelectOption = { label: string; value: string; type?: BusType }

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
  options: Array<MultiSelectOption>   // now includes optional `type`
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [filter, setFilter] = React.useState<"all" | "hiace" | "coaster">("all")
  const selected = new Set(value)

  // counts by type (for small badges in filter)
  const counts = React.useMemo(() => {
    let h = 0, c = 0
    let ah = 0, ac = 0
    options.forEach(o => {
      if (o.type === "hiace") ah++
      else if (o.type === "coaster") ac++
    })
    value.forEach(id => {
      const t = options.find(o => o.value === id)?.type
      if (t === "hiace") h++
      else if (t === "coaster") c++
    })
    return { selected: { h, c }, available: { h: ah, c: ac } }
  }, [options, value])

  const filtered = React.useMemo(() => {
    if (filter === "all") return options
    return options.filter(o => (o.type === filter))
  }, [options, filter])

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
          <span className="ml-3 text-xs text-muted-foreground">
            {open ? "Fermer" : "Ouvrir"}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[480px] p-0" align="start">
        <div className="flex flex-col">
          {/* Sticky tools (search + type filter) */}
          <div className="sticky top-0 z-10 bg-popover/80 backdrop-blur supports-[backdrop-filter]:bg-popover/60 border-b">
            <div className="p-2">
              <Command>
                <CommandInput placeholder="Chercher un bus (plaque, nom…)" />
              </Command>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-3">
                {([
                  { key: "all", label: "Tous" },
                  { key: "hiace", label: "Hiace" },
                  { key: "coaster", label: "Coaster" },
                ] as const).map(btn => {
                  const active = filter === btn.key
                  // small count badge (selected/available) for hiace & coaster
                  const badge =
                    btn.key === "hiace"
                      ? `${counts.selected.h}/${counts.available.h}`
                      : btn.key === "coaster"
                      ? `${counts.selected.c}/${counts.available.c}`
                      : undefined

                  return (
                    <button
                      key={btn.key}
                      type="button"
                      onClick={() => setFilter(btn.key)}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm",
                        active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                      )}
                    >
                      <span>{btn.label}</span>
                      {badge && (
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[11px]",
                          active ? "bg-primary-foreground/20" : "bg-muted text-foreground/70"
                        )}>
                          {badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[320px] overflow-auto">
            <Command>
              <CommandList>
                <CommandEmpty className="px-3 py-2">Aucun résultat.</CommandEmpty>
                <CommandGroup>
                  {filtered.map((opt) => {
                    const active = selected.has(opt.value)
                    return (
                      <CommandItem
                        key={opt.value}
                        value={`${opt.label} ${opt.type ?? ""}`}
                        onSelect={() => toggle(opt.value)}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          {opt.type && (
                            <Badge variant="outline" className="capitalize">
                              {opt.type}
                            </Badge>
                          )}
                          <span>{opt.label}</span>
                        </div>
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
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-2 border-t p-2">
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-muted-foreground hover:underline"
            >
              Tout effacer
            </button>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {value.length} sélectionné{value.length > 1 ? "s" : ""}
              </Badge>
              <Button size="sm" onClick={() => setOpen(false)}>Fermer</Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}


/* --------------------------------- MapPicker -------------------------------- */

export function MapPicker({
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

    const USE_GEOLOCATION = false; // toggle when needed

    if (USE_GEOLOCATION && typeof navigator !== "undefined" && navigator.geolocation) {
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

export function EventCombobox({
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

export function TripDateTimePicker({
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

  // prevent stale responses from overwriting fresh ones
  const quoteReqSeq = React.useRef(0)
  const [quoting, setQuoting] = React.useState(false)

  const [quote, setQuote] = React.useState<QuoteFull | null>(null)

  // Build an index id -> type (lowercased)
  const busTypeIndex = React.useMemo(() => {
    const idx: Record<string, "hiace" | "coaster" | "unknown"> = {}
    ;(buses ?? []).forEach(b => {
      const t = String((b as any)?.type || "").toLowerCase()
      idx[String(b.id)] = t === "hiace" || t === "coaster" ? (t as any) : "unknown"
    })
    return idx
  }, [buses])

  // Count helper
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
    return (buses ?? [])
      .filter(b => !!b?.id)
      .filter(b => {
        if (uniq[b.id]) return false
        uniq[b.id] = true
        return true
      })
      .map(b => ({
        label: (b as any).plate || String(b.id),
        value: String(b.id),
        type: String((b as any)?.type || "")
          .toLowerCase() as BusType || "other",
      }))
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

    if (editing && Array.isArray(editing.busIds) && (editing.busIds as any[]).length > 0) {
      let h = 0, c = 0
      ;(editing.busIds as any[]).forEach(id => {
        const t = busTypeIndex[String(id)]
        if (t === "hiace") h++
        else if (t === "coaster") c++
      })
      setHiaceCount(prev => Math.max(prev, h))
      setCoasterCount(prev => Math.max(prev, c))
    }

  }, [editing, open, busTypeIndex])

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

  // quoting effect
  React.useEffect(() => {
    let cancelled = false
    const seq = ++quoteReqSeq.current

    const distanceOk = Number.isFinite(distanceKmDisplay) && (distanceKmDisplay ?? 0) >= 0
    const haveCounts = (hiaceCount > 0 || coasterCount > 0)
    if (!(haveCounts && distanceOk)) {
      setQuote(null)
      setField("priceTotal", 0 as any)
      return
    }

    const t = setTimeout(async () => {
      setQuoting(true)
      try {
        const distance = Number(distanceKmDisplay ?? 0)
        const vehicles_map = buildVehiclesMap(hiaceCount, coasterCount)
        const res = await api.post<{
          currency: string
          breakdown: QuoteBreakdown
          client_payable: number
          bus_payable: number
          meta?: Record<string, unknown>
        }, { vehicles_map: Record<string, number>; distance_km: number; event: EventType }>(
          "/quote",
          { vehicles_map, distance_km: distance, event: eventType }
        )

        if (cancelled || seq !== quoteReqSeq.current) return
        const data = res.data
        setQuote({
          currency: data.currency,
          breakdown: data.breakdown,
          client_payable: data.client_payable,
          bus_payable: data.bus_payable,
          meta: data.meta ?? {},
        })
        setField("priceTotal", data.client_payable as any)
        setQuoteCurrency(data.currency)
      } catch (e: any) {
        if (!cancelled && seq === quoteReqSeq.current) {
          setQuote(null)
          toast.error(e?.message ?? "Échec du calcul du tarif.")
        }
      } finally {
        if (!cancelled && seq === quoteReqSeq.current) setQuoting(false)
      }
    }, 300)

    return () => { cancelled = true; clearTimeout(t) }
  }, [eventType, distanceKmDisplay, hiaceCount, coasterCount])

  // Guarded setter for busIds (enforces caps)
  function setBusIdsLimited(next: string[]) {
    // detect newly added id
    const added = next.find(id => !busIds.includes(id))
    if (!added) { setBusIds(next); return }

    const t = busTypeIndex[added]
    const { h, c } = countByType(next)

    // caps from the quoted counts
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
    if (t === "unknown") {
      toast.error("Type de bus inconnu, impossible de valider cette sélection.")
      return
    }

    setBusIds(next)
  }

  const assigned = countByType(busIds)
  const needH = Math.max(0, hiaceCount|0), needC = Math.max(0, coasterCount|0)
  const ok = assigned.h === needH && assigned.c === needC

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

          {/* Tarification (avant affectation des bus) */}
          <div className="space-y-3 py-4">
            <h3 className="text-sm font-medium text-muted-foreground">Tarification (avant affectation des bus)</h3>

            {/* Hiace (left) & Coaster (right) */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Hiace (nombre de bus)</Label>
                <Input
                  type="number"
                  min={0}
                  value={hiaceCount}
                  onChange={(e) => setHiaceCount(Math.max(0, Math.floor(Number(e.target.value || 0))))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Coaster (nombre de bus)</Label>
                <Input
                  type="number"
                  min={0}
                  value={coasterCount}
                  onChange={(e) => setCoasterCount(Math.max(0, Math.floor(Number(e.target.value || 0))))}
                />
              </div>
            </div>

            {/* Event & Total (underneath) */}
            <div className="grid gap-4 sm:grid-cols-2">
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
            </div>

            <p className="text-xs text-muted-foreground">
              Définissez le nombre de bus par type pour obtenir un tarif indicatif. Après accord client, affectez les bus disponibles ci-dessous.
            </p>
          </div>


          <Separator />

          {/* Bus */}
          <div className="space-y-3 py-4">
            <h3 className="text-sm font-medium text-muted-foreground">Affectation des bus</h3>
            <div className="grid gap-1.5">
              <Label>Bus (multi-sélection)</Label>
              <MultiSelectBuses
                value={busIds}
                onChange={setBusIdsLimited}
                options={busOptions}
                placeholder="Sélectionner des bus"
              />
              <p className="text-xs text-muted-foreground">
                Les bus proviennent de votre parc (libellés = plaques).
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                L’affectation doit respecter le nombre de Hiace/Coaster indiqués ci-dessus (pas de recalcul ici).
              </p>
            </div>
          </div>

          <Separator />

          {/* Récapitulatif tarifaire */}
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Récapitulatif tarifaire
              </h3>
              {quoting && <Badge variant="secondary">Calcul en cours…</Badge>}
            </div>

            {/* 3 key figures */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Total client</div>
                <div className="mt-1 text-2xl font-semibold">
                  {fmtMoney(quote?.client_payable ?? form.priceTotal ?? 0, quoteCurrency)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Montant payé par le client</p>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Part bus</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {/* {fmtMoney(quote?.bus_payable ?? 0, quoteCurrency)} */}
                      {fmtMoney(quote?.breakdown.bus_rounded ?? 0, quoteCurrency)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Réparti entre les bus affectés
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Frais de retrait</div>
                    <div className="mt-1 text-sm font-medium text-destructive">
                      -{fmtMoney(quote?.breakdown?.bus_fees ?? 0, quoteCurrency)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {/* ({(quote?.meta?.bus_mm_percent ?? 0) * 100}%) */}
                    </div>
                  </div>
                </div>
              </div>


              <div className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">Commission </div>
                <div className="mt-1 text-2xl font-semibold">
                  {fmtMoney(quote?.breakdown?.commission ?? 0, quoteCurrency)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Notre rémunération</p>
              </div>

            </div>

            {/* Vehicule Quote */}
            {quote?.meta && (quote.meta as any)?.vehicles && (
              <div className="mt-2 grid md:grid-cols-2 gap-3">
                {Object.entries((quote.meta as any).vehicles).map(([type, v]: any) => (
                  <div key={type} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between">
                      {/* Left: Type and basic info */}
                      <div>
                        <div className="text-xs text-muted-foreground capitalize">{type}</div>
                        <div className="mt-1 flex flex-wrap gap-6">
                          <span>
                            Nb: <b>{v.count}</b>
                          </span>
                          <span>
                            Total: <b>{fmtMoney(step25(v.bus_final), quoteCurrency)}</b>
                          </span>
                        </div>
                      </div>

                      {/* Right: per-bus info (only if multiple buses) */}
                      {v.count > 1 && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Par bus</div>
                        <div className="mt-1 text-sm font-medium">
                          {fmtMoney(step25(v.bus_final / v.count), quoteCurrency)}
                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}


            {/* (Optional) Status controls — keep if you still want workflow state */}
            <div className="grid gap-1.5">
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
