// src/pages/People.tsx
"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  IconPencil, IconTrash, IconPhone, IconDotsVertical,
} from "@tabler/icons-react"
import { Camera } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { Calendar } from "@/components/ui/calendar"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table"
import type { FilterConfig, GroupByConfig } from "@/components/data-table"

import ImportDialog from "@/components/common/ImportDialog"

import peopleApi, { type Person, type PersonRole, type PersonAddress } from "@/api/people"
import busApi, { type UIBus } from "@/api/bus"
import { ApiError } from "@/api/apiService"
import auth from "@/api/auth"

/* ─── Role normalization ──────────────────────────────────────────────────── */

function normalizeRole(val: unknown): PersonRole | undefined {
  const s = String(val ?? "").trim().toLowerCase()
  switch (s) {
    case "driver": case "chauffeur": return "driver"
    case "owner": case "proprietaire": case "propriétaire": return "owner"
    case "conductor": case "receveur": case "controleur": case "contrôleur": case "controller": return "conductor"
    default: return undefined
  }
}

/* ─── i18n ────────────────────────────────────────────────────────────────── */

const ROLE_LABELS: Record<PersonRole, string> = {
  driver: "Chauffeur", owner: "Propriétaire", conductor: "Receveur",
}
const frRole   = (r?: PersonRole | null) => r ? (ROLE_LABELS[r] ?? r) : "—"
const frStatus = (s?: string | null) => s === "active" ? "Actif" : s === "inactive" ? "Inactif" : s === "suspended" ? "Suspendu" : "—"

/* ─── Error helper ────────────────────────────────────────────────────────── */

function showValidationErrors(err: unknown) {
  const e = err as ApiError
  if (e?.payload?.errors) {
    const lines = Object.entries(e.payload.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`)
    if (lines.length) { toast.error(lines.join("\n")); return }
  }
  toast.error((e as any)?.message ?? "Erreur inconnue.")
}

/* ─── Phone input with auto-formatting ───────────────────────────────────── */

function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function format(raw: string): string {
    // Preserve a leading + then strip non-digits
    const startsPlus = raw.startsWith("+")
    const digits = raw.replace(/\D/g, "")

    // Congo Brazzaville: +242 XX XXX XXXX
    const cc = "242"
    const local = digits.startsWith(cc) ? digits.slice(cc.length) : digits

    const p1 = local.slice(0, 2)          // e.g. 06
    const p2 = local.slice(2, 5)          // e.g. 123
    const p3 = local.slice(5, 9)          // e.g. 4567

    const parts = [p1, p2, p3].filter(Boolean).join(" ")
    return parts ? `+242 ${parts}` : (startsPlus && !digits ? "+" : "")
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    // Allow clearing
    if (!raw) { onChange(""); return }
    onChange(format(raw))
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
        🇨🇬
      </span>
      <Input
        value={value}
        onChange={handleChange}
        placeholder="+242 06 123 4567"
        type="tel"
        className="pl-9"
      />
    </div>
  )
}

/* ─── Date picker helper ──────────────────────────────────────────────────── */

function DatePicker({ value, onChange, placeholder = "Choisir une date" }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  const parsed = value ? new Date(value) : undefined
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="justify-between w-full font-normal text-sm">
          {parsed ? format(parsed, "PPP", { locale: fr }) : <span className="text-muted-foreground">{placeholder}</span>}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="ml-2 size-4 opacity-50 shrink-0">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
          </svg>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <Calendar mode="single" selected={parsed} onSelect={(d) => { onChange(d ? format(d, "yyyy-MM-dd") : ""); setOpen(false) }} initialFocus />
      </PopoverContent>
    </Popover>
  )
}

/* ─── Add/Edit person dialog ──────────────────────────────────────────────── */

type AddEditPersonDialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Person | null
  onSubmit: (p: Person, photo: File | null, assignedBusId: string | null) => void
  buses?: UIBus[]
}

function AddEditPersonDialog({ open, onOpenChange, editing, onSubmit, buses = [] }: AddEditPersonDialogProps) {
  /* ── State ── */
  const [name,      setName]      = React.useState("")
  const [firstName, setFirstName] = React.useState("")
  const [phone,     setPhone]     = React.useState("")
  const [role,      setRole]      = React.useState<PersonRole>("driver")
  const [status,    setStatus]    = React.useState("active")
  const [licenseNo, setLicenseNo] = React.useState("")
  const [permitExpirationDate, setPermitExpirationDate] = React.useState("")
  const [assignedBusId, setAssignedBusId] = React.useState<string | null>(null)

  /* Photo */
  const [photo,     setPhoto]     = React.useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null)
  const photoInputRef = React.useRef<HTMLInputElement>(null)

  /* Address */
  const [street,         setStreet]         = React.useState("")
  const [quartier,       setQuartier]       = React.useState("")
  const [arrondissement, setArrondissement] = React.useState("")
  const [city,           setCity]           = React.useState("")
  const [department,     setDepartment]     = React.useState("")

  /* Bus combobox */
  const [busComboOpen, setBusComboOpen] = React.useState(false)
  const needsBus = role === "driver" || role === "conductor"
  const assignedBus = buses.find((b) => b.id === assignedBusId)

  /* ── Hydration ── */
  React.useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name ?? "")
        setFirstName(editing.firstName ?? "")
        setPhone(editing.phone ?? "")
        setRole((normalizeRole(editing.role) ?? "driver") as PersonRole)
        setStatus(editing.status ?? "active")
        setLicenseNo(editing.licenseNo ?? "")
        setPermitExpirationDate(editing.permitExpirationDate ?? "")
        setStreet(editing.address?.street ?? "")
        setQuartier(editing.address?.quartier ?? "")
        setArrondissement(editing.address?.arrondissement ?? "")
        setCity(editing.address?.city ?? "")
        setDepartment(editing.address?.department ?? "")
        // Pre-select the bus the driver/conductor is currently assigned to
        const currentBus = buses.find(
          (b) => b.assignedDriverId === editing.id || b.assignedConductorId === editing.id
        )
        setAssignedBusId(currentBus?.id ?? null)
        setPhotoPreview(editing.avatar ?? null)
      } else {
        setName(""); setFirstName(""); setPhone(""); setRole("driver")
        setStatus("active"); setLicenseNo(""); setPermitExpirationDate("")
        setStreet(""); setQuartier(""); setArrondissement(""); setCity(""); setDepartment("")
        setAssignedBusId(null); setPhotoPreview(null)
      }
      setPhoto(null)
    }
  }, [open, editing, buses])

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setPhoto(f)
    if (f) {
      const url = URL.createObjectURL(f)
      setPhotoPreview(url)
    }
  }

  function handleSubmit() {
    if (!name.trim()) { toast.error("Le nom est obligatoire."); return }

    const nr = normalizeRole(role) ?? "driver"
    const addr: PersonAddress = {
      street: street.trim() || null,
      quartier: quartier.trim() || null,
      arrondissement: arrondissement.trim() || null,
      city: city.trim() || null,
      department: department.trim() || null,
    }
    const hasAddr = Object.values(addr).some(Boolean)

    const payload: Person = {
      id: editing?.id ?? crypto.randomUUID(),
      role: nr as PersonRole,
      name: name.trim(),
      firstName: firstName.trim() || undefined,
      phone: phone.trim() || undefined,
      licenseNo: (nr === "driver" || nr === "conductor") ? (licenseNo.trim() || undefined) : undefined,
      permitExpirationDate: (nr === "driver" || nr === "conductor") ? (permitExpirationDate || undefined) : undefined,
      address: hasAddr ? addr : undefined,
      createdAt: editing?.createdAt,
      status: status as Person["status"],
    }

    onSubmit(payload, photo, needsBus ? assignedBusId : null)
    onOpenChange(false)
  }

  const initials = name.trim()
    ? name.trim().split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase()
    : "?"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[92vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 shrink-0">
          <DialogTitle>{editing ? "Modifier la personne" : "Ajouter une personne"}</DialogTitle>
        </DialogHeader>
        <Separator />

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ── Photo ── */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative size-20 rounded-full overflow-hidden cursor-pointer group border-2 border-border bg-muted"
              onClick={() => photoInputRef.current?.click()}
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-muted-foreground">{initials}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="size-5 text-white" />
              </div>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => photoInputRef.current?.click()}>
              {photoPreview ? "Changer la photo" : "Ajouter une photo"}
            </Button>
          </div>

          {/* ── Identité ── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identité</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Nom *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="BOUETOUMOUSSA" />
              </div>
              <div className="grid gap-1.5">
                <Label>Prénom</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Arden" />
              </div>
              <div className="grid gap-1.5">
                <Label>Rôle</Label>
                <Select value={role} onValueChange={(v) => setRole(v as PersonRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="driver">Chauffeur</SelectItem>
                    <SelectItem value="conductor">Receveur</SelectItem>
                    <SelectItem value="owner">Propriétaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Statut</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                    <SelectItem value="suspended">Suspendu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Téléphone</Label>
                <PhoneInput value={phone} onChange={setPhone} />
              </div>
            </div>
          </div>

          {/* ── Permis / Véhicule (chauffeurs & receveurs seulement) ── */}
          {(role === "driver" || role === "conductor") && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {role === "driver" ? "Permis de conduire" : "Habilitation"}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>{role === "driver" ? "N° de permis" : "N° d'habilitation"}</Label>
                  <Input value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} placeholder="DL-123456" className="font-mono" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Date d'expiration du permis</Label>
                  <DatePicker value={permitExpirationDate} onChange={setPermitExpirationDate} placeholder="Choisir une date" />
                </div>
              </div>

              {/* Bus assignment */}
              <div className="grid gap-1.5">
                <Label>Bus assigné</Label>
                <Popover open={busComboOpen} onOpenChange={setBusComboOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="justify-between w-full font-normal">
                      {assignedBus ? (
                        <span className="flex items-center gap-2">
                          <span className="font-mono font-semibold">{assignedBus.plate}</span>
                          {assignedBus.brand && <span className="text-muted-foreground text-xs">{assignedBus.brand} {assignedBus.model}</span>}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Aucun bus assigné</span>
                      )}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="ml-2 size-4 opacity-50 shrink-0">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
                      </svg>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-72" align="start">
                    <Command>
                      <CommandInput placeholder="Rechercher un bus…" />
                      <CommandList>
                        <CommandEmpty>Aucun bus trouvé</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => { setAssignedBusId(null); setBusComboOpen(false) }}>
                            <span className="text-muted-foreground">— Aucun —</span>
                          </CommandItem>
                          {buses.map((b) => (
                            <CommandItem key={b.id} onSelect={() => { setAssignedBusId(b.id); setBusComboOpen(false) }}>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-sm">{b.plate}</span>
                                {(b.brand || b.model) && (
                                  <span className="text-xs text-muted-foreground">{[b.brand, b.model].filter(Boolean).join(" ")}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* ── Adresse ── */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adresse</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Rue / Avenue</Label>
                <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Avenue des 3 Martyrs, n°15" />
              </div>
              <div className="grid gap-1.5">
                <Label>Quartier</Label>
                <Input value={quartier} onChange={(e) => setQuartier(e.target.value)} placeholder="Poto-Poto" />
              </div>
              <div className="grid gap-1.5">
                <Label>Arrondissement</Label>
                <Input value={arrondissement} onChange={(e) => setArrondissement(e.target.value)} placeholder="Moungali" />
              </div>
              <div className="grid gap-1.5">
                <Label>Ville</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Brazzaville" />
              </div>
              <div className="grid gap-1.5">
                <Label>Département / Province</Label>
                <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Brazzaville" />
              </div>
            </div>
          </div>
        </div>

        <Separator />
        <DialogFooter className="px-6 py-4 shrink-0 bg-background">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="button" onClick={handleSubmit}>
            {editing ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Delete dialogs ──────────────────────────────────────────────────────── */

function DeletePersonDialog({ person, onClose, onConfirm }: {
  person: Person | null; onClose: () => void; onConfirm: (p: Person) => Promise<void>
}) {
  const [input, setInput] = React.useState("")
  const [deleting, setDeleting] = React.useState(false)
  React.useEffect(() => { if (person) setInput("") }, [person])
  const matches = input.trim().toLowerCase() === (person?.name ?? "").trim().toLowerCase()

  return (
    <AlertDialog open={!!person} onOpenChange={(o) => { if (!o && !deleting) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette personne ?</AlertDialogTitle>
          <AlertDialogDescription>
            Saisissez <span className="font-semibold text-foreground">{person?.name}</span> pour confirmer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-1.5">
          <Label>Nom</Label>
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={person?.name}
            onKeyDown={(e) => e.key === "Enter" && matches && !deleting && (setDeleting(true), onConfirm(person!).finally(() => setDeleting(false)))} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={deleting}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            disabled={!matches || deleting}
            onClick={async () => { setDeleting(true); try { await onConfirm(person!) } finally { setDeleting(false) } }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "Suppression…" : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function BulkDeletePersonDialog({ targets, onClose, onConfirm }: {
  targets: Person[] | null; onClose: () => void; onConfirm: (password: string) => Promise<void>
}) {
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  React.useEffect(() => { if (targets) { setPassword(""); setError("") } }, [targets])

  async function handleSubmit() {
    if (!password) return
    setError(""); setLoading(true)
    try { await onConfirm(password) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Mot de passe incorrect.") }
    finally { setLoading(false) }
  }

  return (
    <AlertDialog open={!!targets} onOpenChange={(o) => { if (!o && !loading) onClose() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {targets?.length ?? 0} personne(s) ?</AlertDialogTitle>
          <AlertDialogDescription>Action irréversible. Confirmez avec votre mot de passe.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-1.5">
          <Label>Mot de passe</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={loading}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            disabled={!password || loading}
            onClick={handleSubmit}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Vérification…" : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/* ─── Shared people table ─────────────────────────────────────────────────── */

function PeopleTable({
  rows, loading, filters, groupBy, onAdd, addLabel, onEdit, onDelete, onBulkDelete, onRowClick,
}: {
  rows: Person[]
  loading: boolean
  filters: FilterConfig<Person>[]
  groupBy: GroupByConfig<Person>[]
  onAdd: () => void
  addLabel: string
  onEdit: (p: Person) => void
  onDelete: (p: Person) => void
  onBulkDelete: (ps: Person[]) => void
  onRowClick: (p: Person) => void
}) {
  const columns = React.useMemo<ColumnDef<Person>[]>(() => [
    {
      accessorKey: "name",
      header: "Nom",
      cell: ({ row }) => {
        const p = row.original
        const initials = (p.name ?? "").split(" ").map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?"
        return (
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8">
              {p.avatar ? <AvatarImage src={p.avatar} alt={p.name} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm leading-none">{p.name}</p>
              {p.firstName && <p className="text-xs text-muted-foreground mt-0.5">{p.firstName}</p>}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "role",
      header: "Rôle",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-xs capitalize">
          {frRole(normalizeRole(row.original.role) ?? row.original.role)}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Statut",
      cell: ({ row }) => {
        const s = row.original.status
        const cls = s === "active" ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                  : s === "suspended" ? "border-red-200 text-red-700 bg-red-50"
                  : ""
        return <Badge variant="outline" className={`text-xs ${cls}`}>{frStatus(s)}</Badge>
      },
    },
    {
      accessorKey: "phone",
      header: "Téléphone",
      cell: ({ row }) => row.original.phone ?? "—",
    },
    {
      accessorKey: "licenseNo",
      header: "N° Permis",
      cell: ({ row }) => row.original.licenseNo
        ? <span className="font-mono text-xs">{row.original.licenseNo}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => {
        const p = row.original
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {p.phone ? (
              <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                onClick={() => window.location.href = `tel:${p.phone}`}>
                <IconPhone className="w-4 h-4" />
              </Button>
            ) : <div className="w-8" />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground">
                  <IconDotsVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(p)}>
                  <IconPencil className="w-4 h-4 mr-2" /> Modifier
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-rose-600 focus:text-rose-600 focus:bg-rose-50" onClick={() => onDelete(p)}>
                  <IconTrash className="w-4 h-4 mr-2" /> Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
      size: 80,
    },
  ], [onEdit, onDelete])

  return (
    <DataTable<Person>
      data={rows}
      columns={columns}
      getRowId={(r) => String(r.id)}
      searchable={{ placeholder: "Rechercher nom, téléphone, permis…", fields: ["name", "phone", "licenseNo"] as (keyof Person)[] }}
      filters={filters}
      loading={loading}
      onAdd={onAdd}
      addLabel={addLabel}
      groupBy={groupBy}
      pageSizeOptions={[10, 20, 50]}
      onRowClick={onRowClick}
      onDeleteSelected={(selected) => { if (selected.length > 0) onBulkDelete(selected) }}
    />
  )
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function PeoplePage() {
  const navigate = useNavigate()
  const [rows,    setRows]    = React.useState<Person[]>([])
  const [buses,   setBuses]   = React.useState<UIBus[]>([])
  const [loading, setLoading] = React.useState(true)
  const [open,    setOpen]    = React.useState(false)
  const [editing, setEditing] = React.useState<Person | null>(null)
  const [openImport, setOpenImport] = React.useState(false)
  const [personToDelete,    setPersonToDelete]    = React.useState<Person | null>(null)
  const [bulkDeleteTargets, setBulkDeleteTargets] = React.useState<Person[] | null>(null)

  const reload = React.useCallback(async () => {
    try {
      setLoading(true)
      const [peopleRes, busRes] = await Promise.all([
        peopleApi.list({ per_page: 200 }),
        busApi.list({ per_page: 200, with: ["driver", "conductor"] }),
      ])
      const normalized = (peopleRes.data.rows ?? []).map((r: Person) => {
        const rawRole = r.role ?? (r as Record<string, unknown>).type ?? (r as Record<string, unknown>).role_name
        const nr = normalizeRole(rawRole) ?? normalizeRole(String(rawRole || ""))
        return { ...r, role: nr ?? r.role } as Person
      })
      setRows(normalized)
      setBuses(busRes.data.rows)
    } catch (e) {
      showValidationErrors(e)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    let alive = true
    reload().then(() => { if (!alive) return })
    return () => { alive = false }
  }, [reload])

  const isServerId = (id: string) => /^\d+$/.test(id)

  /* ── Submit handler (create / update) ── */
  async function handleSubmit(person: Person, photo: File | null, assignedBusId: string | null) {
    const isEdit = editing !== null

    if (isEdit) {
      const prev = rows
      setRows((r) => r.map((x) => x.id === person.id ? { ...x, ...person } : x))
      try {
        const saved = await peopleApi.update(person.id, person)
        // Upload photo if changed
        if (photo) {
          await peopleApi.uploadAvatar(saved.data.id, photo)
        }
        // Handle bus assignment change
        if (assignedBusId !== null) {
          const fn = person.role === "driver" ? busApi.assignDriver : busApi.assignConductor
          await fn(assignedBusId, person.id).catch(() => {})
        }
        await reload()
        toast("Profil mis à jour.")
      } catch (e) {
        setRows(prev)
        showValidationErrors(e)
      } finally {
        setEditing(null)
      }
    } else {
      const tempId = person.id
      setRows((r) => [person, ...r])
      try {
        const saved = await peopleApi.create(person)
        if (photo) {
          await peopleApi.uploadAvatar(saved.data.id, photo).catch(() => {})
        }
        if (assignedBusId && saved.data.id) {
          const fn = person.role === "driver" ? busApi.assignDriver : busApi.assignConductor
          await fn(assignedBusId, saved.data.id).catch(() => {})
        }
        await reload()
        toast("Personne ajoutée.")
      } catch (e) {
        setRows((r) => r.filter((x) => x.id !== tempId))
        showValidationErrors(e)
      }
    }
  }

  /* ── Delete ── */
  async function handleDeletePerson(p: Person) {
    setPersonToDelete(null)
    const prev = rows
    setRows((r) => r.filter((x) => x.id !== p.id))
    try {
      if (isServerId(p.id)) await peopleApi.remove(p.id)
      toast("Personne supprimée.")
    } catch (e) {
      setRows(prev)
      showValidationErrors(e)
    }
  }

  /* ── Filtered sub-lists ── */
  const personnel  = rows.filter((r) => r.role === "driver" || r.role === "conductor")
  const proprietaires = rows.filter((r) => r.role === "owner")

  /* ── Filters ── */
  const personnelFilters: FilterConfig<Person>[] = [
    {
      id: "role", label: "Rôle",
      options: [{ label: "Chauffeur", value: "driver" }, { label: "Receveur", value: "conductor" }],
      accessor: (p) => normalizeRole(p.role) ?? "",
    },
    {
      id: "status", label: "Statut",
      options: [{ label: "Actif", value: "active" }, { label: "Inactif", value: "inactive" }, { label: "Suspendu", value: "suspended" }],
      accessor: (p) => p.status ?? "",
    },
  ]
  const ownerFilters: FilterConfig<Person>[] = [
    {
      id: "status", label: "Statut",
      options: [{ label: "Actif", value: "active" }, { label: "Inactif", value: "inactive" }],
      accessor: (p) => p.status ?? "",
    },
  ]

  const sharedGroupBy: GroupByConfig<Person>[] = [
    { id: "status", label: "Statut", accessor: (r) => frStatus(r.status) },
  ]

  const commonTableProps = {
    loading,
    onEdit: (p: Person) => { setEditing(p); setOpen(true) },
    onDelete: setPersonToDelete,
    onBulkDelete: setBulkDeleteTargets,
    onRowClick: (p: Person) => navigate(`/people/${p.id}`),
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Personnel</h1>
        <p className="text-sm text-muted-foreground">
          Chauffeurs, receveurs et propriétaires de la flotte.
        </p>
      </div>

      <Tabs defaultValue="personnel" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="personnel">
            Personnel roulant
            {personnel.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">{personnel.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="proprietaires">
            Propriétaires
            {proprietaires.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">{proprietaires.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personnel">
          <PeopleTable
            {...commonTableProps}
            rows={personnel}
            filters={personnelFilters}
            groupBy={[{ id: "role", label: "Rôle", accessor: (r) => frRole(normalizeRole(r.role) ?? r.role) }, ...sharedGroupBy]}
            onAdd={() => { setEditing(null); setOpen(true) }}
            addLabel="Ajouter un chauffeur"
          />
        </TabsContent>

        <TabsContent value="proprietaires">
          <PeopleTable
            {...commonTableProps}
            rows={proprietaires}
            filters={ownerFilters}
            groupBy={sharedGroupBy}
            onAdd={() => { setEditing(null); setOpen(true) }}
            addLabel="Ajouter un propriétaire"
          />
        </TabsContent>
      </Tabs>

      {/* ── Dialog ── */}
      <AddEditPersonDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        buses={buses}
        onSubmit={handleSubmit}
      />

      <ImportDialog<Person>
        open={openImport}
        onOpenChange={setOpenImport}
        title="Importer des personnes"
        description="Chargez un CSV/Excel, mappez les colonnes, puis validez l'import."
        fields={[
          { key: "name", label: "Nom", required: true },
          { key: "role", label: "Rôle", required: true },
          { key: "phone", label: "Téléphone" },
          { key: "licenseNo", label: "N° de permis (chauffeurs)" },
        ]}
        sampleHeaders={["name", "role", "phone", "license_no"]}
        transform={(raw) => {
          const norm = (v: string | null | undefined) => (typeof v === "string" ? v.trim() : v)
          const name = String(norm(raw.name) ?? "")
          if (!name) return null
          const role = normalizeRole(norm(raw.role) ?? "") ?? "driver"
          const phone = (norm(raw.phone) ?? undefined) as string | undefined
          const rawRec = raw as Record<string, unknown>
          const licenseNoSrc = ((norm(rawRec.license_no as string | undefined) ?? norm(rawRec.licenseNo as string | undefined)) ?? undefined) as string | undefined
          return {
            id: crypto.randomUUID(), role, name, phone,
            licenseNo: role === "driver" ? licenseNoSrc : undefined,
            createdAt: undefined, status: "active",
          } as Person
        }}
        onConfirm={async (imported) => {
          const prev = rows
          setRows((r) => [...imported, ...r])
          try {
            await Promise.all(imported.map((p) => peopleApi.create(p)))
            await reload()
            toast(`Import réussi (${imported.length} personne${imported.length > 1 ? "s" : ""}).`)
          } catch (e) {
            setRows(prev)
            showValidationErrors(e)
          }
        }}
      />

      <DeletePersonDialog
        person={personToDelete}
        onClose={() => setPersonToDelete(null)}
        onConfirm={handleDeletePerson}
      />

      <BulkDeletePersonDialog
        targets={bulkDeleteTargets}
        onClose={() => setBulkDeleteTargets(null)}
        onConfirm={async (password: string) => {
          const valid = await auth.verifyPassword(password)
          if (!valid) throw new Error("Mot de passe incorrect.")
          const selected = bulkDeleteTargets!
          const prev = rows
          setRows((r) => r.filter((p) => !selected.some((s) => s.id === p.id)))
          try {
            await Promise.all(selected.filter((s) => isServerId(s.id)).map((s) => peopleApi.remove(s.id)))
            toast(`${selected.length} personne(s) supprimée(s).`)
            setBulkDeleteTargets(null)
          } catch (e) {
            setRows(prev)
            throw e
          }
        }}
      />
    </div>
  )
}
