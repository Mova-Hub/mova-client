"use client"

import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Calendar } from "@/components/ui/calendar"
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

const MODEL_OPTIONS = [
  "Toyota Coaster",
  "Toyota Hiace",
  "Isuzu NQR",
  "Isuzu NPR",
  "Scania Touring",
  "Yutong ZK",
  "Mercedes Sprinter",
] as const

const TYPE_OPTIONS: BusType[] = ["hiace", "coaster", "sprinter", "minibus", "coach", "bus"]
const ENERGY_OPTIONS = ["diesel", "gasoline", "electric", "hybrid", "lpg"] as const
const ENERGY_LABELS: Record<string, string> = {
  diesel: "Diesel", gasoline: "Essence", electric: "Électrique", hybrid: "Hybride", lpg: "GPL",
}
const PROVIDERS = ["AXA", "Jubilee", "Britam", "CIC", "APA"] as const

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

  // ------- État (Bus) -------
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
  const [assignedConductorId, setAssignedConductorId] = React.useState<Id | "">("") // NEW
  const [lastServiceDate, setLastServiceDate] = React.useState<string>("")

  // Assurance (optionnelle)
  const [hasInsurance, setHasInsurance] = React.useState(false)
  const [insProvider, setInsProvider] = React.useState<string>("")
  const [insPolicy, setInsPolicy] = React.useState<string>("")
  const [insValidUntil, setInsValidUntil] = React.useState<string>("")

  // Listes
  const owners = React.useMemo(() => people.filter((p) => p.role === "owner"), [people])
  const drivers = React.useMemo(() => people.filter((p) => p.role === "driver"), [people])
  const conductors = React.useMemo(() => people.filter((p) => p.role === "conductor"), [people]) // NEW

  // Fallback labels (when selected id isn't present in people[] yet)
  const fallbackPersonLabels = React.useMemo(() => {
    const map = new Map<string, string>()
    if (editing?.operatorId && editing.operatorName) {
      map.set(String(editing.operatorId), editing.operatorName)
    }
    if (editing?.assignedDriverId && editing.driverName) {
      map.set(String(editing.assignedDriverId), editing.driverName)
    }
    if (editing?.assignedConductorId && editing.conductorName) {
      map.set(String(editing.assignedConductorId), editing.conductorName) // NEW
    }
    return map
  }, [
    editing?.operatorId, editing?.operatorName,
    editing?.assignedDriverId, editing?.driverName,
    editing?.assignedConductorId, editing?.conductorName,
  ])

  const getPersonLabel = React.useCallback(
    (id: Id | ""): string | undefined => {
      if (!id) return undefined
      const found = people.find((p) => p.id === id)
      if (found) return `${found.name}${found.phone ? ` - ${found.phone}` : ""}`
      const fb = fallbackPersonLabels.get(String(id))
      return fb || undefined
    },
    [people, fallbackPersonLabels]
  )

  // Hydratation en édition
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
      setAssignedConductorId((editing.assignedConductorId as Id | undefined) ?? "") // NEW
      setLastServiceDate(editing.lastServiceDate ?? "")

      const hasAnyInsurance = Boolean(
        editing.insuranceProvider || editing.insurancePolicyNumber || editing.insuranceValidUntil
      )
      setHasInsurance(hasAnyInsurance)
      setInsProvider(editing.insuranceProvider ?? "")
      setInsPolicy(editing.insurancePolicyNumber ?? "")
      setInsValidUntil(editing.insuranceValidUntil ?? "")
    } else {
      setPlate("")
      setBrand("")
      setCapacity(49)
      setStatus("active")
      setType("hiace")
      setModel(MODEL_OPTIONS[0])
      setYear("")
      setEnergyType("")
      setFirstRegistrationYear("")
      setChassisNumber("")
      setMileageKm("")
      setOperatorId("")
      setAssignedDriverId("")
      setAssignedConductorId("") // NEW
      setLastServiceDate("")
      setHasInsurance(false)
      setInsProvider("")
      setInsPolicy("")
      setInsValidUntil("")
    }
  }, [editing])

  function isIsoDate(v: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(v)
  }
  function asStringOrUndefined(v: unknown) {
    if (v === "" || v === undefined || v === null) return undefined
    return String(v)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()

    if (insValidUntil && lastServiceDate) {
      const a = new Date(insValidUntil)
      const b = new Date(lastServiceDate)
      if (a < b) {
        toast.error("La date de validité d’assurance doit être postérieure ou égale à la dernière révision.")
        return
      }
    }

    // Lock owner/driver/conductor values for non-admins:
    const lockedOperatorId = !isAdmin ? editing?.operatorId : operatorId
    const lockedDriverId = !isAdmin ? editing?.assignedDriverId : assignedDriverId
    const lockedConductorId = !isAdmin ? editing?.assignedConductorId : assignedConductorId

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
      assignedConductorId: asStringOrUndefined(lockedConductorId), // NEW
      lastServiceDate: lastServiceDate && isIsoDate(lastServiceDate) ? lastServiceDate : undefined,
      ...(hasInsurance &&
      (insProvider.trim() || insPolicy.trim() || insValidUntil.trim())
        ? {
            insuranceProvider: insProvider.trim() || undefined,
            insurancePolicyNumber: insPolicy.trim() || undefined,
            insuranceValidUntil: insValidUntil && isIsoDate(insValidUntil) ? insValidUntil : undefined,
          }
        : {
            insuranceProvider: undefined,
            insurancePolicyNumber: undefined,
            insuranceValidUntil: undefined,
          }),
    }

    if (!payload.plate) {
      toast.error("L'immatriculation est obligatoire.")
      return
    }
    if (!payload.capacity || payload.capacity < 1) {
      toast.error("La capacité doit être un nombre positif.")
      return
    }

    onSubmit(payload)
    onOpenChange(false)
  }

  // -------------------- Helpers UI --------------------
  function SectionTitle({ children }: { children: React.ReactNode }) {
    return <h3 className="text-sm font-semibold text-foreground">{children}</h3>
  }

  // Combobox générique (select + recherche) — now supports `disabled`
  function ComboBox<T extends string | number>({
    value,
    onChange,
    options,
    placeholder,
    emptyText = "Aucun résultat",
    getLabel,
    className,
    includeCurrentValue,
    disabled,
  }: {
    value: T | ""
    onChange: (v: T | "") => void
    options: readonly T[]
    placeholder: string
    emptyText?: string
    getLabel?: (v: T) => string | undefined
    className?: string
    includeCurrentValue?: boolean
    disabled?: boolean
  }) {
    const [open, setOpen] = React.useState(false)

    const selectedLabel =
      value !== "" ? (getLabel ? getLabel(value as T) : String(value)) : ""

    const preparedOptions = React.useMemo(() => {
      const set = new Set(options.map((o) => String(o)))
      const arr: T[] = [...options] as T[]
      if (includeCurrentValue && value !== "" && !set.has(String(value))) {
        arr.unshift(value as T)
      }
      return arr
    }, [options, value, includeCurrentValue])

    return (
      <Popover open={!disabled && open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn("justify-between w-full", disabled && "opacity-70 cursor-not-allowed", className)}
          >
            {selectedLabel
              ? selectedLabel
              : <span className="text-muted-foreground">{placeholder}</span>}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="ml-2 size-4 opacity-60"
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
            </svg>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[220px]">
          <Command>
            <CommandInput placeholder={`Rechercher ${placeholder.toLowerCase()}…`} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onChange("")
                    setOpen(false)
                  }}
                >
                  — Aucun —
                </CommandItem>
                {preparedOptions.map((opt) => {
                  const label = getLabel ? getLabel(opt) : String(opt)
                  return (
                    <CommandItem
                      key={String(opt)}
                      onSelect={() => {
                        onChange(opt)
                        setOpen(false)
                      }}
                    >
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

  // Combobox personne (propriétaire / chauffeur / receveur)
  function PersonCombo({
    value,
    onChange,
    people,
    placeholder,
    disabled,
  }: {
    value: Id | ""
    onChange: (v: Id | "") => void
    people: Person[]
    placeholder: string
    disabled?: boolean
  }) {
    const ids = React.useMemo(() => people.map((p) => p.id), [people])
    return (
      <ComboBox<Id>
        value={value}
        onChange={onChange}
        options={ids}
        includeCurrentValue
        placeholder={placeholder}
        disabled={disabled}
        getLabel={(id) => getPersonLabel(id)}
      />
    )
  }

  // Sélecteur de date
  function DatePicker({
    value,
    onChange,
    placeholder = "Choisir une date",
  }: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
  }) {
    const parsed = value ? new Date(value) : undefined
    const [open, setOpen] = React.useState(false)

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="justify-between w-full"
          >
            {parsed
              ? format(parsed, "PPP", { locale: fr })
              : <span className="text-muted-foreground">{placeholder}</span>}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="ml-2 size-4 opacity-60"
            >
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
            </svg>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0">
          <Calendar
            mode="single"
            selected={parsed}
            onSelect={(d) => {
              onChange(d ? format(d, "yyyy-MM-dd") : "")
              setOpen(false)
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-2 shrink-0">
          <DialogTitle>{editing ? "Modifier un bus" : "Ajouter un bus"}</DialogTitle>
          <DialogDescription>Saisissez les informations du bus.</DialogDescription>
        </DialogHeader>
        <Separator />
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form id="bus-form" className="grid gap-6" onSubmit={submit}>
            {/* --- Informations principales --- */}
            <div className="grid gap-4">
              <SectionTitle>Informations principales</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="plate">Immatriculation *</Label>
                  <Input
                    id="plate"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="KDC 123A"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="brand">Marque</Label>
                  <Input
                    id="brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Toyota"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="status">Statut</Label>
                  <select
                    id="status"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as BusStatus)}
                  >
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="type">Type</Label>
                  <select
                    id="type"
                    className="h-9 rounded-md border bg-background px-3 text-sm capitalize"
                    value={type ?? "hiace"}
                    onChange={(e) => setType(e.target.value as BusType)}
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t} className="capitalize">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label>Modèle</Label>
                  <ComboBox
                    value={model}
                    onChange={(v) => setModel((v as string) || "")}
                    options={MODEL_OPTIONS}
                    placeholder="Choisir le modèle"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="year">Année de fabrication</Label>
                  <Input
                    id="year"
                    type="number"
                    min={1970}
                    max={new Date().getFullYear() + 1}
                    value={year}
                    onChange={(e) => setYear(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="2020"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="firstReg">1re mise en circulation</Label>
                  <Input
                    id="firstReg"
                    type="number"
                    min={1970}
                    max={new Date().getFullYear() + 1}
                    value={firstRegistrationYear}
                    onChange={(e) => setFirstRegistrationYear(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="2021"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="energyType">Énergie</Label>
                  <select
                    id="energyType"
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={energyType}
                    onChange={(e) => setEnergyType(e.target.value)}
                  >
                    <option value="">— Choisir —</option>
                    {ENERGY_OPTIONS.map((e) => (
                      <option key={e} value={e}>{ENERGY_LABELS[e]}</option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="chassisNumber">N° châssis</Label>
                  <Input
                    id="chassisNumber"
                    value={chassisNumber}
                    onChange={(e) => setChassisNumber(e.target.value)}
                    placeholder="VF7XXXXXXXXXXXX"
                    className="font-mono"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="capacity">Capacité *</Label>
                  <div className="relative">
                    <Input
                      id="capacity"
                      type="number"
                      min={1}
                      value={capacity}
                      onChange={(e) => setCapacity(Number(e.target.value))}
                      required
                      className="pr-16"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      places
                    </span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="mileageKm">Kilométrage</Label>
                  <div className="relative">
                    <Input
                      id="mileageKm"
                      type="number"
                      min={0}
                      value={mileageKm}
                      onChange={(e) => setMileageKm(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="120000"
                      className="pr-10"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      km
                    </span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Dernière révision</Label>
                  <DatePicker
                    value={lastServiceDate}
                    onChange={setLastServiceDate}
                    placeholder="Choisir une date"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* --- Affectations --- */}
            <div className="grid gap-4">
              <SectionTitle>Affectations</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Propriétaire</Label>
                  <PersonCombo
                    value={operatorId}
                    onChange={setOperatorId}
                    people={owners}
                    placeholder="Choisir le propriétaire"
                    disabled={!isAdmin}
                  />
                  {!isAdmin && (
                    <p className="text-[11px] text-muted-foreground">
                      Réservé aux administrateurs
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Chauffeur</Label>
                  <PersonCombo
                    value={assignedDriverId}
                    onChange={setAssignedDriverId}
                    people={drivers}
                    placeholder="Choisir le chauffeur"
                    disabled={!isAdmin}
                  />
                  {!isAdmin && (
                    <p className="text-[11px] text-muted-foreground">
                      Réservé aux administrateurs
                    </p>
                  )}
                </div>
                <div className="grid gap-2 md:col-span-2">
                  <Label>Receveur</Label>
                  <PersonCombo
                    value={assignedConductorId}
                    onChange={setAssignedConductorId}
                    people={conductors}
                    placeholder="Choisir le receveur"
                    disabled={!isAdmin}
                  />
                  {!isAdmin && (
                    <p className="text-[11px] text-muted-foreground">
                      Réservé aux administrateurs
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* --- Assurance (optionnel) --- */}
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <SectionTitle>Assurance</SectionTitle>
                <div className="flex items-center gap-2">
                  <Switch
                    id="hasInsurance"
                    checked={hasInsurance}
                    onCheckedChange={setHasInsurance}
                  />
                  <Label htmlFor="hasInsurance">Activer</Label>
                </div>
              </div>

              {hasInsurance && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="grid gap-2 md:col-span-1">
                    <Label>Assureur</Label>
                    <ComboBox
                      value={insProvider}
                      onChange={(v) => setInsProvider((v as string) || "")}
                      options={PROVIDERS}
                      placeholder="Choisir l’assureur"
                    />
                  </div>
                  <div className="grid gap-2 md:col-span-1">
                    <Label htmlFor="insPolicy">N° de police</Label>
                    <Input
                      id="insPolicy"
                      value={insPolicy}
                      onChange={(e) => setInsPolicy(e.target.value)}
                      placeholder="POL-123456"
                    />
                  </div>
                  <div className="grid gap-2 md:col-span-1">
                    <Label>Valide jusqu’au</Label>
                    <DatePicker
                      value={insValidUntil}
                      onChange={setInsValidUntil}
                      placeholder="Choisir une date"
                    />
                  </div>
                </div>
              )}
            </div>

          </form>
        </div>
        <Separator />
        <div className="flex items-center justify-end gap-2 px-6 py-4 shrink-0 bg-background">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="bus-form">
            {editing ? "Enregistrer" : "Ajouter"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
