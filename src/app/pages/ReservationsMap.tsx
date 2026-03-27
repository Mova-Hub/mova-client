"use client"

import * as React from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { 
  useJsApiLoader, 
  GoogleMap, 
  Autocomplete, 
  DirectionsRenderer, 
  OverlayViewF,
  InfoWindowF
} from '@react-google-maps/api'

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Map as MapIcon, ListChecks, ArrowLeft, Search as SearchIcon, Undo2, Save, X, MapPin, Plus, ArrowUp, ArrowDown, Trash2, Loader2
} from "lucide-react"

import reservationApi, { type UIReservation } from "@/api/reservation"
import busApi, { type UIBus } from "@/api/bus"
import AddEditReservationSheet from "@/components/reservation/AddEditReservationSheet"

// Clé depuis l'environnement Vite
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""

type Waypoint = { lat: number; lng: number; label?: string }

// 🛡️ SÉCURITÉ : Empêche le crash de Google Maps en filtrant les mauvaises coordonnées
const isValidWp = (w: any): w is Waypoint => {
  return w && typeof w.lat === "number" && !isNaN(w.lat) && typeof w.lng === "number" && !isNaN(w.lng)
}

const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")

/* ---------------------------- Reverse Geocoding (Google) ---------------------------- */
async function reverseGeocode(lng: number, lat: number): Promise<string | undefined> {
  if (!window.google) return undefined
  const geocoder = new window.google.maps.Geocoder()
  try {
    const response = await geocoder.geocode({ location: { lat, lng } })
    return response.results[0]?.formatted_address || response.results[1]?.formatted_address
  } catch (e) {
    return undefined
  }
}

export default function ReservationsMapPage() {
  const [rows, setRows] = React.useState<UIReservation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [buses, setBuses] = React.useState<UIBus[]>([])
  const [query, setQuery] = React.useState("")
  const [openList, setOpenList] = React.useState(false)

  const [selected, setSelected] = React.useState<UIReservation | null>(null)
  const [openEditSheet, setOpenEditSheet] = React.useState(false)
  const [editing, setEditing] = React.useState<UIReservation | null>(null)

  const [routeEditMode, setRouteEditMode] = React.useState(false)
  const [draftWps, setDraftWps] = React.useState<Waypoint[] | null>(null)
  const [draftDistanceKm, setDraftDistanceKm] = React.useState<number | null>(null)
  const [creatingNew, setCreatingNew] = React.useState(false)

  const [toolbarOpen, setToolbarOpen] = React.useState(false)
  const [placeBarOpen, setPlaceBarOpen] = React.useState(false)
  const [showWpPanel, setShowWpPanel] = React.useState(false)

  // 🗺️ Google Maps States
  const [map, setMap] = React.useState<google.maps.Map | null>(null)
  const [directionsData, setDirectionsData] = React.useState<google.maps.DirectionsResult | null>(null)
  const [autocomplete, setAutocomplete] = React.useState<google.maps.places.Autocomplete | null>(null)

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: ["places"],
  })

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const [resv, b] = await Promise.all([
          reservationApi.list({ per_page: 500 }),
          busApi.list({ per_page: 500 }),
        ])
        if (!alive) return
        setRows(resv.data.rows ?? [])
        setBuses(b.data.rows ?? [])
      } catch (e: any) {
        toast.error(e?.message ?? "Échec du chargement.")
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      [r.code, r.passenger?.name, r.passenger?.phone, r.route?.from, r.route?.to, ...(r.busIds ?? [])]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [rows, query])

  const activeWps: Waypoint[] | undefined = React.useMemo(() => {
    if (routeEditMode && draftWps) return draftWps.filter(isValidWp)
    const wps = (selected as any)?.waypoints as Waypoint[] | undefined
    return wps?.filter(isValidWp)
  }, [routeEditMode, draftWps, selected])

  /* ---------------------- Calcul d'itinéraire (Directions) ---------------------- */
  React.useEffect(() => {
    if (!isLoaded || !activeWps || activeWps.length < 2) {
      setDirectionsData(null)
      return
    }

    const fetchDirections = async () => {
      const directionsService = new window.google.maps.DirectionsService()
      const origin = activeWps[0]
      const destination = activeWps[activeWps.length - 1]
      const waypoints = activeWps.slice(1, -1).map(p => ({
        location: new window.google.maps.LatLng(p.lat, p.lng),
        stopover: true
      }))

      try {
        const response = await directionsService.route({
          origin: new window.google.maps.LatLng(origin.lat, origin.lng),
          destination: new window.google.maps.LatLng(destination.lat, destination.lng),
          waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
        })
        
        setDirectionsData(response)

        if (routeEditMode) {
          let totalMeters = 0
          response.routes[0].legs.forEach(leg => { totalMeters += leg.distance?.value || 0 })
          setDraftDistanceKm(Math.round((totalMeters / 1000) * 100) / 100)
        }
      } catch (e) {
        console.error("Erreur de calcul d'itinéraire", e)
      }
    }

    const timer = setTimeout(fetchDirections, 300)
    return () => clearTimeout(timer)
  }, [activeWps, isLoaded, routeEditMode])

  /* ---------------------- Clic sur la carte ---------------------- */
  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!routeEditMode || !e.latLng) return
    const lat = e.latLng.lat()
    const lng = e.latLng.lng()
    
    const name = (await reverseGeocode(lng, lat)) || `Étape ${(draftWps?.length ?? 0) + 1}`
    
    setDraftWps((prev) => {
      const next = prev ? [...prev] : []
      next.push({ lat, lng, label: name })
      return next
    })
  }

  const handlePlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace()
      if (place.geometry?.location && map) {
        map.panTo(place.geometry.location)
        map.setZoom(15)
        setPlaceBarOpen(false)
      }
    }
  }

  /* -------------------------- Ajustement de la caméra -------------------------- */
  React.useEffect(() => {
    if (!map || !isLoaded) return

    const bounds = new window.google.maps.LatLngBounds()
    let hasPoints = false

    if (activeWps && activeWps.length > 0) {
      activeWps.forEach(wp => bounds.extend({ lat: wp.lat, lng: wp.lng }))
      hasPoints = true
    } else if (!selected && !routeEditMode && filtered.length > 0) {
      filtered.forEach(r => {
        const wps = ((r as any).waypoints as Waypoint[] | undefined)?.filter(isValidWp)
        if (wps && wps.length > 0) {
          bounds.extend({ lat: wps[0].lat, lng: wps[0].lng })
          hasPoints = true
        }
      })
    }

    if (hasPoints) {
      if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
        map.panTo(bounds.getCenter())
        map.setZoom(13)
      } else {
        map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 })
      }
    }
  }, [activeWps, filtered, selected, routeEditMode, map, isLoaded])

  /* -------------------------- Logique Métier -------------------------- */
  const busPlateById = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const b of buses) if (b?.id) m.set(String(b.id), b.plate ?? String(b.id))
    return m
  }, [buses])

  function startCreationFlow() {
    setSelected(null)
    setDraftWps([])
    setDraftDistanceKm(null)
    setRouteEditMode(true)
    setCreatingNew(true)
    setShowWpPanel(true)
    toast.info("Cliquez sur la carte pour ajouter le départ, l’arrivée et les étapes.")
  }

  async function saveDraftRoute() {
    if (creatingNew) {
      if (!draftWps || draftWps.length < 2) {
        toast.error("Ajoutez au moins un départ et une arrivée.")
        return
      }
      const id = crypto.randomUUID()
      const code = `BZV-${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`
      const payload: UIReservation = {
        id, code,
        tripDate: new Date().toISOString().slice(0, 10),
        route: { from: draftWps[0]?.label || "Départ", to: draftWps[draftWps.length - 1]?.label || "Arrivée" },
        passenger: { name: "", phone: "" },
        seats: 1, busIds: [], priceTotal: 0, status: "pending",
        createdAt: new Date().toISOString(),
        ...(draftDistanceKm != null ? ({ distanceKm: draftDistanceKm } as any) : {}),
        ...(draftWps ? ({ waypoints: draftWps } as any) : {}),
      }
      setEditing(payload)
      setOpenEditSheet(true)
      setRouteEditMode(false)
      setCreatingNew(false)
      setShowWpPanel(false)
      return
    }

    if (!selected || !draftWps?.length) {
      setRouteEditMode(false)
      return
    }

    const updated: UIReservation = {
      ...selected,
      ...(draftDistanceKm != null ? ({ distanceKm: draftDistanceKm } as any) : {}),
      ...(draftWps ? ({ waypoints: draftWps } as any) : {}),
      route: {
        from: draftWps[0]?.label ?? selected.route?.from ?? "Départ",
        to: draftWps[draftWps.length - 1]?.label ?? selected.route?.to ?? "Arrivée",
      },
    }

    setRows((xs) => xs.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
    setSelected(updated)

    try {
      await reservationApi.update(updated.id, updated)
      toast.success("Itinéraire enregistré avec succès.")
    } catch (e: any) {
      toast.error("Échec de l’enregistrement de l’itinéraire.")
    }

    setEditing(updated)
    setOpenEditSheet(true)
    setRouteEditMode(false)
    setDraftWps(null)
    setShowWpPanel(false)
  }

  /* ----------------------- Fonctions Panneau Waypoints ---------------------- */
  function updateWpLabel(i: number, v: string) {
    setDraftWps((prev) => {
      if (!prev) return prev
      const next = [...prev]
      next[i] = { ...next[i], label: v }
      return next
    })
  }
  function removeWp(i: number) {
    setDraftWps((prev) => {
      if (!prev) return prev
      const next = [...prev]
      next.splice(i, 1)
      return next
    })
  }
  function moveWp(i: number, dir: -1 | 1) {
    setDraftWps((prev) => {
      if (!prev) return prev
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      const tmp = next[i]
      next[i] = next[j]
      next[j] = tmp
      return next
    })
  }
  function undoLastPoint() {
    setDraftWps((prev) => {
      if (!prev || prev.length === 0) return prev
      const next = [...prev]
      next.pop()
      return next
    })
  }
  function recenterToDraft() {
    if (!map) return
    const wps = (routeEditMode ? draftWps : activeWps) ?? []
    if (wps.length === 0) return
    if (wps.length === 1) {
      map.panTo({ lat: wps[0].lat, lng: wps[0].lng })
      map.setZoom(14)
      return
    }
    const bounds = new window.google.maps.LatLngBounds()
    wps.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
    map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 })
  }

  if (loadError) return <div className="p-4 text-red-500">Erreur de chargement de Google Maps. Vérifiez votre clé d'API.</div>
  if (!isLoaded) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>

  return (
    <div className="relative w-full h-full min-h-0">
      
      {/* -------------------- BARRE DE RECHERCHE PRINCIPALE -------------------- */}
      <div className="absolute z-20 left-4 top-4">
        {!toolbarOpen && (
          <button type="button" onClick={() => setToolbarOpen(true)} className="grid transition bg-white rounded-full shadow-lg size-12 place-items-center ring-1 ring-black/10 hover:shadow-xl">
            <MapIcon className="w-5 h-5 text-foreground" />
          </button>
        )}
        <AnimatePresence>
          {toolbarOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: -8 }}
              className="flex items-center gap-2 p-2 border shadow-lg w-[90vw] max-w-[720px] rounded-xl bg-background/95 backdrop-blur"
            >
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une réservation..." className="w-full" />
              <Sheet open={openList} onOpenChange={setOpenList}>
                <SheetTrigger asChild>
                  <Button size="icon" variant="outline"><ListChecks className="w-4 h-4" /></Button>
                </SheetTrigger>
                <SheetContent side="right">
                  <SheetHeader><SheetTitle>Réservations ({filtered.length})</SheetTitle></SheetHeader>
                  <ScrollArea className="h-[calc(100vh-10rem)] pr-2 mt-4">
                    {filtered.map((r) => (
                      <button
                        key={r.id}
                        className="w-full p-3 mb-2 text-left transition border rounded-lg hover:border-primary/50 hover:bg-accent"
                        onClick={() => { setSelected(r); setOpenList(false) }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-bold">{r.code}</div>
                          <Badge variant="outline">{r.status}</Badge>
                        </div>
                        <div className="mt-1 text-sm truncate text-muted-foreground">{r.route?.from ?? "—"} &rarr; {r.route?.to ?? "—"}</div>
                      </button>
                    ))}
                  </ScrollArea>
                </SheetContent>
              </Sheet>
              <Button onClick={() => setToolbarOpen(false)} size="icon" variant="ghost"><X className="w-4 h-4" /></Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* -------------------- RECHERCHE DE LIEU -------------------- */}
      <div className="absolute z-20 left-4 top-20">
        {!placeBarOpen && (
          <button onClick={() => setPlaceBarOpen(true)} className="grid transition bg-white rounded-full shadow-lg size-12 place-items-center ring-1 ring-black/10 hover:shadow-xl">
            <SearchIcon className="w-5 h-5 text-foreground" />
          </button>
        )}
        <AnimatePresence>
          {placeBarOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95, x: -8 }}
              className="w-[90vw] max-w-[400px] p-2 border shadow-lg rounded-xl bg-background/95 backdrop-blur"
            >
              <div className="flex items-center gap-2">
                <Autocomplete 
                  onLoad={setAutocomplete} 
                  onPlaceChanged={handlePlaceChanged}
                  options={{ componentRestrictions: { country: "CG" } }}
                >
                  <Input placeholder="Rechercher une adresse au Congo..." className="flex-1 w-full" />
                </Autocomplete>
                <Button onClick={() => setPlaceBarOpen(false)} size="icon" variant="ghost"><X className="w-4 h-4" /></Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* -------------------- NOUVELLE RÉSERVATION -------------------- */}
      <div className="absolute z-20 left-4 top-36">
        <button onClick={startCreationFlow} className="grid text-white transition rounded-full shadow-lg bg-primary size-12 place-items-center ring-1 ring-black/10 hover:shadow-xl hover:bg-primary/90">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* -------------------- TOOLBAR EDITION ROUTE -------------------- */}
      {routeEditMode && (
        <div className="absolute left-4 top-[168px] z-20 w-[min(680px,calc(100vw-2rem))]">
          <div className="flex flex-wrap items-center gap-2 p-2 border rounded-lg shadow-lg bg-background/95 backdrop-blur">
            <Badge variant="secondary" className="px-3 py-1 text-sm">{draftWps?.length ?? 0} étapes</Badge>
            <Badge variant="outline" className="px-3 py-1 text-sm font-semibold">{(draftDistanceKm ?? 0).toLocaleString("fr-FR")} km</Badge>
            <Separator orientation="vertical" className="h-6 mx-2" />
            <Button size="sm" variant="ghost" onClick={undoLastPoint}><Undo2 className="w-4 h-4 mr-2" /> Annuler point</Button>
            <Button size="sm" variant="ghost" onClick={recenterToDraft}>Recentrer</Button>
            <Button size="sm" variant={showWpPanel ? "default" : "secondary"} onClick={() => setShowWpPanel(v => !v)}>
              {showWpPanel ? "Masquer les détails" : "Gérer les points"}
            </Button>
            <div className="flex gap-2 ml-auto">
              <Button size="sm" variant="outline" onClick={() => { setRouteEditMode(false); setDraftWps(null); }}><X className="w-4 h-4 mr-1" /> Quitter</Button>
              <Button size="sm" onClick={saveDraftRoute}><Save className="w-4 h-4 mr-2" /> Enregistrer</Button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- PANNEAU LATÉRAL : TIMELINE DES WAYPOINTS -------------------- */}
      {routeEditMode && showWpPanel && (
        <div className="absolute z-20 left-4 top-[240px] w-[min(420px,calc(100vw-2rem))] rounded-xl border bg-background/95 p-4 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-md">Itinéraire du trajet</h3>
            <Badge variant="outline">{draftWps?.length || 0} étapes</Badge>
          </div>
          
          <div className="max-h-[50vh] overflow-y-auto pr-2 pb-2 space-y-3 relative">
            {(draftWps?.length || 0) > 1 && (
              <div className="absolute top-4 bottom-4 left-[23px] w-0.5 bg-border -z-10" />
            )}

            {(draftWps ?? []).length === 0 && (
              <div className="p-8 text-sm text-center border border-dashed rounded-lg text-muted-foreground bg-muted/50">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Cliquez sur la carte pour ajouter votre point de départ.
              </div>
            )}

            {(draftWps ?? []).map((wp, idx) => (
              <div key={idx} className="flex items-start gap-3 p-2 transition border rounded-lg shadow-sm bg-card hover:border-primary/50 group">
                <div className="flex flex-col items-center mt-1">
                  <div className="grid w-8 h-8 text-xs font-bold rounded-full place-items-center ring-2 ring-background bg-primary text-primary-foreground">
                    {idx === 0 ? "De" : idx === (draftWps?.length ?? 0) - 1 ? "Ar" : alpha[idx]}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <Input 
                    value={wp.label ?? ""} 
                    onChange={(e) => updateWpLabel(idx, e.target.value)} 
                    placeholder="Nom du lieu..."
                    className="h-8 font-medium bg-transparent border-transparent px-1.5 hover:border-border focus-visible:bg-background"
                  />
                  <div className="flex items-center gap-1 mt-2 text-muted-foreground">
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded mr-auto">
                      {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                    </span>
                    <div className="flex items-center transition-opacity opacity-0 group-hover:opacity-100">
                      <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => moveWp(idx, -1)} disabled={idx === 0}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="w-6 h-6" onClick={() => moveWp(idx, +1)} disabled={idx === (draftWps?.length ?? 0) - 1}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                      <Separator orientation="vertical" className="h-4 mx-1" />
                      <Button size="icon" variant="ghost" className="w-6 h-6 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeWp(idx)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------- GOOGLE MAPS COMPONENTS -------------------- */}
      <div className="absolute inset-0 bg-muted" style={{ minHeight: "100vh" }}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={{ lat: -4.2667, lng: 15.2832 }}
          zoom={12}
          onClick={handleMapClick}
          onLoad={setMap}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy"
          }}
        >
          {/* Ligne de Trajet avec ta couleur Primary exacte */}
          {directionsData && (
            <DirectionsRenderer 
              directions={directionsData} 
              options={{ 
                suppressMarkers: true, 
                polylineOptions: { strokeColor: "hsl(107, 52%, 50%)", strokeWeight: 5, strokeOpacity: 0.9 } 
              }} 
            />
          )}

          {/* Marqueurs en mode Édition */}
          {routeEditMode && activeWps?.map((wp, i) => (
            <OverlayViewF
              key={`draft-${i}`}
              position={{ lat: wp.lat, lng: wp.lng }}
              mapPaneName="overlayMouseTarget"
              getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -(height) })} 
            >
              <div className="flex flex-col items-center pointer-events-none">
                <div className="rounded-full bg-primary text-primary-foreground font-bold text-[11px] px-2.5 py-1 shadow-md ring-2 ring-white whitespace-nowrap">
                  {i === 0 ? "De" : i === activeWps.length - 1 ? "Ar" : alpha[i] || String(i + 1)}
                </div>
                {/* Petit pointeur SVG avec la couleur text-primary */}
                <div className="text-primary drop-shadow-sm -mt-[1px]">
                   <svg width="12" height="6" viewBox="0 0 12 6" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                     <path d="M0 0H12L6 6L0 0Z" />
                   </svg>
                </div>
              </div>
            </OverlayViewF>
          ))}

          {/* Marqueurs pour la Réservation Sélectionnée */}
          {!routeEditMode && selected && activeWps?.map((wp, i) => (
             <OverlayViewF
                key={`selected-${i}`}
                position={{ lat: wp.lat, lng: wp.lng }}
                mapPaneName="overlayMouseTarget"
                getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -(height) })}
             >
              <div className="flex flex-col items-center pointer-events-none">
                <div className="rounded-full bg-primary text-primary-foreground font-bold text-[11px] px-2.5 py-1 shadow-md ring-2 ring-white whitespace-nowrap">
                  {i === 0 ? "De" : i === activeWps.length - 1 ? "Ar" : alpha[i] || String(i + 1)}
                </div>
                <div className="text-primary drop-shadow-sm -mt-[1px]">
                   <svg width="12" height="6" viewBox="0 0 12 6" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                     <path d="M0 0H12L6 6L0 0Z" />
                   </svg>
                </div>
              </div>
             </OverlayViewF>
          ))}

          {/* Marqueurs Liste Globale ("De") */}
          {!routeEditMode && !selected && filtered.map((r) => {
            const wps = ((r as any).waypoints as Waypoint[] | undefined)?.filter(isValidWp)
            if (!wps || wps.length === 0) return null
            return (
              <OverlayViewF
                key={`list-${r.id}`}
                position={{ lat: wps[0].lat, lng: wps[0].lng }}
                mapPaneName="overlayMouseTarget"
                getPixelPositionOffset={(width, height) => ({ x: -(width / 2), y: -(height) })}
              >
                <div 
                  className="flex flex-col items-center cursor-pointer group"
                  onClick={(e) => { e.stopPropagation(); setSelected(r); }}
                >
                  <div className="px-2 py-1 text-xs font-bold transition rounded-full shadow-md bg-primary text-primary-foreground ring-2 ring-white group-hover:scale-110 whitespace-nowrap">
                    Départ
                  </div>
                  <div className="text-primary drop-shadow-sm -mt-[1px] group-hover:scale-110 transition origin-top">
                     <svg width="12" height="6" viewBox="0 0 12 6" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                       <path d="M0 0H12L6 6L0 0Z" />
                     </svg>
                  </div>
                </div>
              </OverlayViewF>
            )
          })}

          {/* Pop-up Info (Bulle) au-dessus de la réservation sélectionnée */}
          {!routeEditMode && selected && activeWps && activeWps.length > 0 && (
            <InfoWindowF
              position={{ lat: activeWps[0].lat, lng: activeWps[0].lng }}
              onCloseClick={() => setSelected(null)}
              options={{ disableAutoPan: true, pixelOffset: new window.google.maps.Size(0, -35) }} 
            >
              <div className="w-[280px] p-1 font-sans text-black">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase truncate">{selected.route?.from ?? "—"} &rarr; {selected.route?.to ?? "—"}</div>
                    <div className="mt-1 text-base font-bold truncate">{selected.code}</div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{selected.status}</Badge>
                </div>
                <Separator className="my-2" />
                <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                  <div><span className="text-gray-500">Passagers:</span> {selected.seats}</div>
                  <div><span className="text-gray-500">Prix:</span> {selected.priceTotal ? `${selected.priceTotal.toLocaleString()} F` : "—"}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => {
                     setEditing(selected)
                     setOpenEditSheet(true)
                  }}>Ouvrir le dossier</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => {
                    const wps = (selected as any)?.waypoints as Waypoint[] | undefined
                    setDraftWps(wps ? JSON.parse(JSON.stringify(wps)) : [])
                    setRouteEditMode(true)
                    setShowWpPanel(true)
                  }}>Éditer l'itinéraire</Button>
                </div>
              </div>
            </InfoWindowF>
          )}

        </GoogleMap>
      </div>

      <AddEditReservationSheet
        open={openEditSheet}
        onOpenChange={(v) => {
          setOpenEditSheet(v)
          if (!v && creatingNew) setCreatingNew(false)
        }}
        editing={editing}
        onSubmit={async () => setCreatingNew(false)}
        buses={buses as unknown as any[]}
        onEditItinerary={() => {
          if (!editing) return
          const wps = (editing as any).waypoints as Waypoint[] | undefined
          setDraftWps(wps ? JSON.parse(JSON.stringify(wps)) : [])
          setRouteEditMode(true)
          setCreatingNew(false)
          setShowWpPanel(true)
          setOpenEditSheet(false)
        }}
      />
    </div>
  )
}