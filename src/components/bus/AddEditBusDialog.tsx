"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { toast } from "sonner"

import type { UIBus } from "@/api/bus"
import type { Person } from "@/api/people"
import type { BusStatus, BusType } from "@/api/bus"
import { cn } from "@/lib/utils"
import useAuth from "@/hooks/useAuth"

/* ─── Config ─────────────────────────────────────────────────────────────────── */

const MODEL_OPTIONS = [
  "Toyota Coaster",
  "Toyota Hiace",
  "Isuzu NQR",
  "Isuzu NPR",
  "Scania Touring",
  "Yutong ZK",
  "Mercedes Sprinter",
] as const

const TYPE_OPTIONS: { value: BusType; label: string }[] = [
  { value: "hiace",    label: "Hiace" },
  { value: "coaster",  label: "Coaster" },
  { value: "sprinter", label: "Sprinter" },
  { value: "minibus",  label: "Minibus" },
  { value: "coach",    label: "Autocar" },
  { value: "bus",      label: "Bus classique" },
  { value: "other",    label: "Autre" },
]

const ENERGY_OPTIONS: { value: string; label: string }[] = [
  { value: "diesel",   label: "Diesel" },
  { value: "gasoline", label: "Essence" },
  { value: "electric", label: "Électrique" },
  { value: "hybrid",   label: "Hybride" },
  { value: "lpg",      label: "GPL" },
]

const PROVIDERS = ["AXA", "Jubilee", "Britam", "CIC", "APA"] as const

const STEPS = [
  { id: 1, label: "Identification", description: "Immatriculation & identité" },
  { id: 2, label: "Technique",      description: "Caractéristiques du véhicule" },
  { id: 3, label: "Équipe",         description: "Personnel affecté" },
  { id: 4, label: "Assurance",      description: "Contrat d'assurance" },
] as const

type Id = Person["id"]

export type AddEditBusDialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (bus: Partial<UIBus> & { id?: string }) => void
  editing?: UIBus | null
  people?: Person[]
}

export default function AddEditBusDialog({
  open,
  onOpenChange,
  onSubmit,
  editing,
  people = [],
}: AddEditBusDialogProps) {
  const { user } = useAuth()
  const isAdmin = React.useMemo(() => {
    const role = (user?.role ?? "").toString().toLowerCase()
    return role === "admin" || role === "superadmin"
  }, [user?.role])

  /* ─── Step state ─────────────────────────────────────────────────────────── */
  const [currentStep, setCurrentStep] = React.useState(1)

  React.useEffect(() => {
    if (open) setCurrentStep(1)
  }, [open])

  /* ─── Form state ─────────────────────────────────────────────────────────── */
  const [plate, setPlate] = React.useState("")
  const [brand, setBrand] = React.useState("")
  const [capacity, setCapacity] = React.useState<number>(49)
  const [status, setStatus] = React.useState<BusStatus>("active")
  const [type, setType] = React.useState<BusType>("hiace")
  const [model, setModel] = React.useState<string>(MODEL_OPTIONS[0])
  const [year, setYear] = React.useState<number | "">("")
  const [energyType, setEnergyType] = React.useState<string>("")
  const [firstRegistrationYear, setFirstRegistrationYear] = React.useState<number | "">("")
  const [chassisNumber, setChassisNumber] = React.useState("")
  const [mileageKm, setMileageKm] = React.useState<number | "">("")
  const [operatorId, setOperatorId] = React.useState<Id | "">("")
  const [assignedDriverId, setAssignedDriverId] = React.useState<Id | "">("")
  const [assignedConductorId, setAssignedConductorId] = React.useState<Id | "">("")
  const [lastServiceDate, setLastServiceDate] = React.useState<string>("")

  const [hasInsurance, setHasInsurance] = React.useState(false)
  const [insProvider, setInsProvider] = React.useState<string>("")
  const [insPolicy, setInsPolicy] = React.useState<string>("")
  const [insValidUntil, setInsValidUntil] = React.useState<string>("")

  /* ─── People lists ───────────────────────────────────────────────────────── */
  const owners     = React.useMemo(() => people.filter((p) => p.role === "owner"), [people])
  const drivers    = React.useMemo(() => people.filter((p) => p.role === "driver"), [people])
  const conductors = React.useMemo(() => people.filter((p) => p.role === "conductor"), [people])

  const fallbackPersonLabels = React.useMemo(() => {
    const map = new Map<string, string>()
    if (editing?.operatorId      && editing.operatorName)   map.set(String(editing.operatorId), editing.operatorName)
    if (editing?.assignedDriverId && editing.driverName)    map.set(String(editing.assignedDriverId), editing.driverName)
    if (editing?.assignedConductorId && editing.conductorName) map.set(String(editing.assignedConductorId), editing.conductorName)
    return map
  }, [editing?.operatorId, editing?.operatorName, editing?.assignedDriverId, editing?.driverName, editing?.assignedConductorId, editing?.conductorName])

  const getPersonLabel = React.useCallback(
    (id: Id | ""): string | undefined => {
      if (!id) return undefined
      const found = people.find((p) => p.id === id)
      if (found) return `${found.name}${found.phone ? ` - ${found.phone}` : ""}`
      return fallbackPersonLabels.get(String(id))
    },
    [people, fallbackPersonLabels]
  )

  /* ─── Hydration ──────────────────────────────────────────────────────────── */
  React.useEffect(() => {
    if (editing) {
      setPlate(editing.plate ?? "")
      setBrand(editing.brand ?? "")
      setCapacity(editing.capacity ?? 49)
      setStatus((editing.status as BusStatus) ?? "active")
      setType((editing.type as BusType) ?? "hiace")
      setModel(editing.model ?? MODEL_OPTIONS[0])
      setYear(editing.year ?? "")
      setEnergyType(editing.energyType ?? "")
      setFirstRegistrationYear(editing.firstRegistrationYear ?? "")
      setChassisNumber(editing.chassisNumber ?? "")
      setMileageKm(editing.mileageKm ?? "")
      setOperatorId((editing.operatorId as Id | undefined) ?? "")
      setAssignedDriverId((editing.assignedDriverId as Id | undefined) ?? "")
      setAssignedConductorId((editing.assignedConductorId as Id | undefined) ?? "")
      setLastServiceDate(editing.lastServiceDate ?? "")
      const hasAnyInsurance = Boolean(editing.insuranceProvider || editing.insurancePolicyNumber || editing.insuranceValidUntil)
      setHasInsurance(hasAnyInsurance)
      setInsProvider(editing.insuranceProvider ?? "")
      setInsPolicy(editing.insurancePolicyNumber ?? "")
      setInsValidUntil(editing.insuranceValidUntil ?? "")
    } else {
      setPlate(""); setBrand(""); setCapacity(49); setStatus("active"); setType("hiace")
      setModel(MODEL_OPTIONS[0]); setYear(""); setEnergyType(""); setFirstRegistrationYear("")
      setChassisNumber(""); setMileageKm(""); setOperatorId(""); setAssignedDriverId("")
      setAssignedConductorId(""); setLastServiceDate(""); setHasInsurance(false)
      setInsProvider(""); setInsPolicy(""); setInsValidUntil("")
    }
  }, [editing])

  /* ─── Navigation ─────────────────────────────────────────────────────────── */
  function handleNext() {
    if (currentStep === 1) {
      if (!plate.trim()) { toast.error("L'immatriculation est obligatoire."); return }
    }
    if (currentStep === 2) {
      if (!capacity || Number(capacity) < 1) { toast.error("La capacité doit être un nombre positif."); return }
    }
    if (currentStep < 4) setCurrentStep((s) => s + 1)
  }

  /* ─── Submit ─────────────────────────────────────────────────────────────── */
  function isIsoDate(v: string) { return /^\d{4}-\d{2}-\d{2}$/.test(v) }
  function asStringOrUndefined(v: unknown) {
    if (v === "" || v === undefined || v === null) return undefined
    return String(v)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!plate.trim()) { toast.error("L'immatriculation est obligatoire."); return }
    if (!capacity || Number(capacity) < 1) { toast.error("La capacité doit être un nombre positif."); return }

    const lockedOperatorId   = !isAdmin ? editing?.operatorId   : operatorId
    const lockedDriverId     = !isAdmin ? editing?.assignedDriverId : assignedDriverId
    const lockedConductorId  = !isAdmin ? editing?.assignedConductorId : assignedConductorId

    const payload: Partial<UIBus> & { id?: string } = {
      ...(editing?.id ? { id: editing.id } : {}),
      plate: plate.trim(),
      brand: brand.trim() || undefined,
      capacity: Number(capacity),
      status,
      type,
      model: model.trim() || undefined,
      year: year === "" ? undefined : Number(year),
      energyType: energyType || undefined,
      firstRegistrationYear: firstRegistrationYear === "" ? undefined : Number(firstRegistrationYear),
      chassisNumber: chassisNumber.trim() || undefined,
      mileageKm: mileageKm === "" ? undefined : Number(mileageKm),
      operatorId: asStringOrUndefined(lockedOperatorId),
      assignedDriverId: asStringOrUndefined(lockedDriverId),
      assignedConductorId: asStringOrUndefined(lockedConductorId),
      lastServiceDate: lastServiceDate && isIsoDate(lastServiceDate) ? lastServiceDate : undefined,
      ...(hasInsurance && (insProvider.trim() || insPolicy.trim() || insValidUntil.trim())
        ? {
            insuranceProvider: insProvider.trim() || undefined,
            insurancePolicyNumber: insPolicy.trim() || undefined,
            insuranceValidUntil: insValidUntil && isIsoDate(insValidUntil) ? insValidUntil : undefined,
          }
        : { insuranceProvider: undefined, insurancePolicyNumber: undefined, insuranceValidUntil: undefined }),
    }

    onSubmit(payload)
    onOpenChange(false)
  }

  /* ─── UI helpers ─────────────────────────────────────────────────────────── */

  function ComboBox<T extends string | number>({
    value, onChange, options, placeholder, emptyText = "Aucun résultat",
    getLabel, includeCurrentValue, disabled,
  }: {
    value: T | ""
    onChange: (v: T | "") => void
    options: readonly T[]
    placeholder: string
    emptyText?: string
    getLabel?: (v: T) => string | undefined
    includeCurrentValue?: boolean
    disabled?: boolean
  }) {
    const [open, setOpen] = React.useState(false)
    const selectedLabel = value !== "" ? (getLabel ? getLabel(value as T) : String(value)) : ""
    const preparedOptions = React.useMemo(() => {
      const set = new Set(options.map((o) => String(o)))
      const arr: T[] = [...options] as T[]
      if (includeCurrentValue && value !== "" && !set.has(String(value))) arr.unshift(value as T)
      return arr
    }, [options, value, includeCurrentValue])

    return (
      <Popover open={!disabled && open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverTrigger asChild>
          <Button
            type="button" variant="outline" role="combobox" aria-expanded={open} disabled={disabled}
            className={cn("justify-between w-full font-normal", disabled && "opacity-70 cursor-not-allowed")}
          >
            {selectedLabel
              ? <span>{selectedLabel}</span>
              : <span className="text-muted-foreground">{placeholder}</span>}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="ml-2 size-4 opacity-60 shrink-0">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
            </svg>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[220px]">
          <Command>
            <CommandInput placeholder={`Rechercher…`} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={() => { onChange(""); setOpen(false) }}>— Aucun —</CommandItem>
                {preparedOptions.map((opt) => {
                  const label = getLabel ? getLabel(opt) : String(opt)
                  return (
                    <CommandItem key={String(opt)} onSelect={() => { onChange(opt); setOpen(false) }}>
                      {label || String(opt)}
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

  function PersonCombo({ value, onChange, people: ps, placeholder, disabled }: {
    value: Id | ""; onChange: (v: Id | "") => void; people: Person[]; placeholder: string; disabled?: boolean
  }) {
    const ids = React.useMemo(() => ps.map((p) => p.id), [ps])
    return (
      <ComboBox<Id>
        value={value} onChange={onChange} options={ids} includeCurrentValue
        placeholder={placeholder} disabled={disabled} getLabel={(id) => getPersonLabel(id)}
      />
    )
  }

  function DatePicker({ value, onChange, placeholder = "Choisir une date" }: {
    value: string; onChange: (v: string) => void; placeholder?: string
  }) {
    const parsed = value ? new Date(value) : undefined
    const [open, setOpen] = React.useState(false)
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="justify-between w-full font-normal">
            {parsed
              ? format(parsed, "PPP", { locale: fr })
              : <span className="text-muted-foreground">{placeholder}</span>}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="ml-2 size-4 opacity-60 shrink-0">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
            </svg>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0">
          <Calendar mode="single" selected={parsed} onSelect={(d) => { onChange(d ? format(d, "yyyy-MM-dd") : ""); setOpen(false) }} initialFocus />
        </PopoverContent>
      </Popover>
    )
  }

  /* ─── Step indicator ─────────────────────────────────────────────────────── */
  function StepIndicator() {
    return (
      <div className="flex items-start mt-4">
        {STEPS.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => step.id < currentStep && setCurrentStep(step.id)}
                className={cn(
                  "size-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-200",
                  currentStep === step.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : step.id < currentStep
                      ? "bg-primary/15 text-primary border-primary/40 hover:bg-primary/25 cursor-pointer"
                      : "bg-muted/60 text-muted-foreground border-border cursor-default"
                )}
              >
                {step.id < currentStep ? <Check className="size-3.5" /> : step.id}
              </button>
              <span className={cn(
                "text-[10px] font-semibold leading-none text-center w-16",
                currentStep === step.id ? "text-foreground" : "text-muted-foreground"
              )}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={cn(
                "flex-1 h-px mt-4 mx-1.5 transition-colors",
                step.id < currentStep ? "bg-primary/30" : "bg-border"
              )} />
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }

  /* ─── Step content ───────────────────────────────────────────────────────── */

  function StepBadge({ step }: { step: number }) {
    const s = STEPS[step - 1]
    return (
      <div className="flex items-center gap-2 mb-5">
        <Badge variant="outline" className="text-[10px] font-bold px-1.5 py-0.5 text-primary border-primary/30 bg-primary/5">
          Étape {s.id}/4
        </Badge>
        <div>
          <p className="text-sm font-semibold leading-none">{s.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
        </div>
      </div>
    )
  }

  /* ─── Render ─────────────────────────────────────────────────────────────── */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl flex flex-col max-h-[92vh] p-0 gap-0">

        {/* Header + step indicator */}
        <DialogHeader className="px-6 pt-5 pb-4 shrink-0">
          <DialogTitle className="text-base">
            {editing ? "Modifier un bus" : "Ajouter un bus"}
          </DialogTitle>
          <StepIndicator />
        </DialogHeader>

        <Separator />

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="bus-form" onSubmit={submit}>

            {/* ── Step 1: Identification ── */}
            {currentStep === 1 && (
              <div>
                <StepBadge step={1} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label htmlFor="plate">Immatriculation *</Label>
                    <Input
                      id="plate"
                      value={plate}
                      onChange={(e) => setPlate(e.target.value.toUpperCase())}
                      placeholder="KDC 123A"
                      className="font-mono tracking-widest uppercase text-base"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="brand">Marque</Label>
                    <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Toyota" />
                  </div>

                  <div className="grid gap-1.5">
                    <Label>Statut</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as BusStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="inactive">Inactif</SelectItem>
                        <SelectItem value="maintenance">En maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <Label>Type de véhicule</Label>
                    <Select value={type} onValueChange={(v) => setType(v as BusType)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <Label>Modèle</Label>
                    <ComboBox
                      value={model}
                      onChange={(v) => setModel((v as string) || "")}
                      options={MODEL_OPTIONS}
                      placeholder="Choisir le modèle"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 2: Technique ── */}
            {currentStep === 2 && (
              <div>
                <StepBadge step={2} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div className="grid gap-1.5">
                    <Label htmlFor="year">Année de fabrication</Label>
                    <Input
                      id="year" type="number" min={1970} max={new Date().getFullYear() + 1}
                      value={year} onChange={(e) => setYear(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="2020"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="firstReg">1re mise en circulation</Label>
                    <Input
                      id="firstReg" type="number" min={1970} max={new Date().getFullYear() + 1}
                      value={firstRegistrationYear}
                      onChange={(e) => setFirstRegistrationYear(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="2021"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label>Énergie</Label>
                    <Select value={energyType || "__none__"} onValueChange={(v) => setEnergyType(v === "__none__" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="— Choisir —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Choisir —</SelectItem>
                        {ENERGY_OPTIONS.map((e) => (
                          <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="chassisNumber">N° châssis</Label>
                    <Input
                      id="chassisNumber" value={chassisNumber}
                      onChange={(e) => setChassisNumber(e.target.value)}
                      placeholder="VF7XXXXXXXXXXXX" className="font-mono"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="capacity">Capacité *</Label>
                    <div className="relative">
                      <Input
                        id="capacity" type="number" min={1}
                        value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}
                        className="pr-14"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">places</span>
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="mileageKm">Kilométrage</Label>
                    <div className="relative">
                      <Input
                        id="mileageKm" type="number" min={0}
                        value={mileageKm} onChange={(e) => setMileageKm(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="120 000" className="pr-10"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">km</span>
                    </div>
                  </div>

                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label>Dernière révision</Label>
                    <DatePicker value={lastServiceDate} onChange={setLastServiceDate} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Équipe ── */}
            {currentStep === 3 && (
              <div>
                <StepBadge step={3} />
                <div className="grid gap-4">
                  <div className="grid gap-1.5">
                    <Label>Propriétaire / Opérateur</Label>
                    <PersonCombo value={operatorId} onChange={setOperatorId} people={owners} placeholder="Choisir le propriétaire" disabled={!isAdmin} />
                    {!isAdmin && <p className="text-[11px] text-muted-foreground">Réservé aux administrateurs</p>}
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Chauffeur</Label>
                    <PersonCombo value={assignedDriverId} onChange={setAssignedDriverId} people={drivers} placeholder="Choisir le chauffeur" disabled={!isAdmin} />
                    {!isAdmin && <p className="text-[11px] text-muted-foreground">Réservé aux administrateurs</p>}
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Receveur / Convoyeur</Label>
                    <PersonCombo value={assignedConductorId} onChange={setAssignedConductorId} people={conductors} placeholder="Choisir le receveur" disabled={!isAdmin} />
                    {!isAdmin && <p className="text-[11px] text-muted-foreground">Réservé aux administrateurs</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 4: Assurance ── */}
            {currentStep === 4 && (
              <div>
                <StepBadge step={4} />

                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 mb-5">
                  <div>
                    <p className="text-sm font-medium">Ajouter une assurance</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Renseignez les informations du contrat</p>
                  </div>
                  <Switch id="hasInsurance" checked={hasInsurance} onCheckedChange={setHasInsurance} />
                </div>

                {hasInsurance ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-1.5">
                      <Label>Assureur</Label>
                      <ComboBox
                        value={insProvider}
                        onChange={(v) => setInsProvider((v as string) || "")}
                        options={PROVIDERS}
                        placeholder="Choisir l'assureur"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="insPolicy">N° de police</Label>
                      <Input id="insPolicy" value={insPolicy} onChange={(e) => setInsPolicy(e.target.value)} placeholder="POL-123456" />
                    </div>
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label>Valide jusqu'au</Label>
                      <DatePicker value={insValidUntil} onChange={setInsValidUntil} placeholder="Choisir une date d'expiration" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground gap-2 rounded-lg border border-dashed">
                    <svg xmlns="http://www.w3.org/2000/svg" className="size-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    <p>Activez le commutateur pour renseigner<br />les informations d'assurance.</p>
                  </div>
                )}
              </div>
            )}

          </form>
        </div>

        <Separator />

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0 bg-background">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <span className="text-xs text-muted-foreground">Étape {currentStep} sur 4</span>
          </div>
          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={() => setCurrentStep((s) => s - 1)}>
                Précédent
              </Button>
            )}
            {currentStep < 4 ? (
              <Button type="button" onClick={handleNext}>
                Suivant
              </Button>
            ) : (
              <Button type="submit" form="bus-form">
                {editing ? "Enregistrer" : "Ajouter le bus"}
              </Button>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}
