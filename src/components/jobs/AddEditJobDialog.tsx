"use client"

import * as React from "react"
import { toast } from "sonner"
import { Check, ChevronsUpDown } from "lucide-react"

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from "@/components/ui/command"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"

import { cn } from "@/lib/utils"
import { 
  type Job, type JobContractType, type JobStatus, type JobWorkMode,
  WORK_MODES, CONTRACT_TYPES, JOB_STATUSES, DEFAULT_DEPARTMENTS, DEFAULT_CITIES, DEFAULT_COUNTRIES, getLabel
} from "@/api/job"

type AddEditJobDialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: Job | null
  onSubmit: (j: Job) => void
  existingJobs?: Job[] 
}

export default function AddEditJobDialog({ open, onOpenChange, editing, onSubmit, existingJobs = [] }: AddEditJobDialogProps) {
  const [form, setForm] = React.useState<Partial<Job>>({})

  const [respText, setRespText] = React.useState("")
  const [reqText, setReqText] = React.useState("")
  const [benText, setBenText] = React.useState("")

  const [openDept, setOpenDept] = React.useState(false)
  const [openLoc, setOpenLoc] = React.useState(false)
  const [openCountry, setOpenCountry] = React.useState(false)
  
  const [deptSearch, setDeptSearch] = React.useState("")
  const [locSearch, setLocSearch] = React.useState("")
  const [countrySearch, setCountrySearch] = React.useState("")

  React.useEffect(() => {
    if (editing) {
      setForm(editing)
      setRespText(editing.responsibilities?.join("\n") ?? "")
      setReqText(editing.requirements?.join("\n") ?? "")
      setBenText(editing.benefits?.join("\n") ?? "")
    } else {
      setForm({ status: "draft", workMode: "hybrid", contractType: "full_time", country: "cg", location: "bzv" })
      setRespText("")
      setReqText("")
      setBenText("")
    }
    setDeptSearch("")
    setLocSearch("")
    setCountrySearch("")
  }, [editing, open])

  function set<K extends keyof Job>(key: K, val: Job[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  function handleSubmit() {
    if (!form.title || !form.department || !form.location) {
      toast.error("Le titre, le département et la ville sont obligatoires.")
      return
    }

    const payload: Job = {
      id: editing?.id ?? crypto.randomUUID(),
      title: String(form.title).trim(),
      department: String(form.department).trim(),
      location: String(form.location).trim(),
      country: String(form.country ?? "cg").trim(),
      workMode: (form.workMode ?? "hybrid") as JobWorkMode,
      contractType: (form.contractType ?? "full_time") as JobContractType,
      shortDesc: String(form.shortDesc ?? "").trim(),
      status: (form.status ?? "draft") as JobStatus,
      responsibilities: respText.split("\n").map(s => s.trim()).filter(Boolean),
      requirements: reqText.split("\n").map(s => s.trim()).filter(Boolean),
      benefits: benText.split("\n").map(s => s.trim()).filter(Boolean),
      createdAt: editing?.createdAt,
    }

    onSubmit(payload)
    onOpenChange(false)
  }

  // ---- Combobox Lists Generation ----
  const allDepts = React.useMemo(() => {
    const map = new Map<string, string>()
    DEFAULT_DEPARTMENTS.forEach(d => map.set(d.value, d.label))
    existingJobs.forEach(j => { if (j.department && !map.has(j.department)) map.set(j.department, j.department) })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [existingJobs])

  const allLocs = React.useMemo(() => {
    const map = new Map<string, string>()
    DEFAULT_CITIES.forEach(d => map.set(d.value, d.label))
    existingJobs.forEach(j => { if (j.location && !map.has(j.location)) map.set(j.location, j.location) })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [existingJobs])

  const allCountries = React.useMemo(() => {
    const map = new Map<string, string>()
    DEFAULT_COUNTRIES.forEach(d => map.set(d.value, d.label))
    existingJobs.forEach(j => { if (j.country && !map.has(j.country)) map.set(j.country, j.country) })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [existingJobs])


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier l'offre d'emploi" : "Créer une offre d'emploi"}</DialogTitle>
          <DialogDescription>Renseignez les détails du poste. Pour les listes, utilisez un retour à la ligne par point.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Titre du poste *</Label>
              <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="ex: Ingénieur React Native" />
            </div>
            
            {/* DÉPARTEMENT */}
            <div className="flex flex-col gap-1.5">
              <Label>Département *</Label>
              <Popover open={openDept} onOpenChange={setOpenDept}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className={cn("justify-between font-normal", !form.department && "text-muted-foreground")}>
                    {form.department ? getLabel(allDepts, form.department) : "Sélectionner..."}
                    <ChevronsUpDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[280px]">
                  <Command>
                    <CommandInput placeholder="Chercher ou ajouter..." value={deptSearch} onValueChange={setDeptSearch} />
                    <CommandList>
                      <CommandEmpty>
                        {deptSearch ? (
                          <div className="p-2 text-sm text-center">
                            Département introuvable.
                            <Button variant="link" size="sm" className="block w-full mt-1 text-primary" onClick={() => { set("department", deptSearch); setOpenDept(false); }}>
                              Ajouter "{deptSearch}"
                            </Button>
                          </div>
                        ) : "Aucun département."}
                      </CommandEmpty>
                      <CommandGroup>
                        {allDepts.map((dept) => (
                          <CommandItem key={dept.value} value={dept.label} onSelect={(val) => { 
                             const exact = allDepts.find(d => d.label.toLowerCase() === val)
                             set("department", exact?.value ?? val); setOpenDept(false); 
                          }}>
                            <Check className={cn("mr-2 h-4 w-4", form.department === dept.value ? "opacity-100" : "opacity-0")} />
                            {dept.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* VILLE */}
            <div className="flex flex-col gap-1.5">
              <Label>Ville *</Label>
              <Popover open={openLoc} onOpenChange={setOpenLoc}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className={cn("justify-between font-normal", !form.location && "text-muted-foreground")}>
                    {form.location ? getLabel(allLocs, form.location) : "Sélectionner..."}
                    <ChevronsUpDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[280px]">
                  <Command>
                    <CommandInput placeholder="Chercher ou ajouter..." value={locSearch} onValueChange={setLocSearch} />
                    <CommandList>
                      <CommandEmpty>
                        {locSearch ? (
                          <div className="p-2 text-sm text-center">
                            Ville introuvable.
                            <Button variant="link" size="sm" className="block w-full mt-1 text-primary" onClick={() => { set("location", locSearch); setOpenLoc(false); }}>
                              Ajouter "{locSearch}"
                            </Button>
                          </div>
                        ) : "Aucune ville."}
                      </CommandEmpty>
                      <CommandGroup>
                        {allLocs.map((loc) => (
                          <CommandItem key={loc.value} value={loc.label} onSelect={(val) => { 
                             const exact = allLocs.find(d => d.label.toLowerCase() === val)
                             set("location", exact?.value ?? val); setOpenLoc(false); 
                          }}>
                            <Check className={cn("mr-2 h-4 w-4", form.location === loc.value ? "opacity-100" : "opacity-0")} />
                            {loc.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* PAYS */}
            <div className="flex flex-col gap-1.5">
              <Label>Pays</Label>
              <Popover open={openCountry} onOpenChange={setOpenCountry}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className={cn("justify-between font-normal", !form.country && "text-muted-foreground")}>
                    {form.country ? getLabel(allCountries, form.country) : "Sélectionner..."}
                    <ChevronsUpDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[280px]">
                  <Command>
                    <CommandInput placeholder="Chercher ou ajouter..." value={countrySearch} onValueChange={setCountrySearch} />
                    <CommandList>
                      <CommandEmpty>
                        {countrySearch ? (
                          <div className="p-2 text-sm text-center">
                            Pays introuvable.
                            <Button variant="link" size="sm" className="block w-full mt-1 text-primary" onClick={() => { set("country", countrySearch); setOpenCountry(false); }}>
                              Ajouter "{countrySearch}"
                            </Button>
                          </div>
                        ) : "Aucun pays."}
                      </CommandEmpty>
                      <CommandGroup>
                        {allCountries.map((country) => (
                          <CommandItem key={country.value} value={country.label} onSelect={(val) => { 
                             const exact = allCountries.find(d => d.label.toLowerCase() === val)
                             set("country", exact?.value ?? val); setOpenCountry(false); 
                          }}>
                            <Check className={cn("mr-2 h-4 w-4", form.country === country.value ? "opacity-100" : "opacity-0")} />
                            {country.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* SELECT STANDARD (WORK MODE / CONTRACT / STATUS) */}
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-1.5">
              <Label>Mode de travail</Label>
              <Select value={form.workMode ?? "hybrid"} onValueChange={(v) => set("workMode", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORK_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Type de contrat</Label>
              <Select value={form.contractType ?? "full_time"} onValueChange={(v) => set("contractType", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONTRACT_TYPES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Statut</Label>
              <Select value={form.status ?? "draft"} onValueChange={(v) => set("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {JOB_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Courte description</Label>
            <Textarea value={form.shortDesc ?? ""} onChange={(e) => set("shortDesc", e.target.value)} placeholder="Une phrase d'accroche..." rows={2} />
          </div>

          <div className="grid gap-1.5">
            <Label>Responsabilités (1 ligne = 1 point)</Label>
            <Textarea value={respText} onChange={(e) => setRespText(e.target.value)} placeholder="Développer l'application mobile...&#10;Optimiser..." rows={4} />
          </div>

          <div className="grid gap-1.5">
            <Label>Prérequis & Compétences (1 ligne = 1 point)</Label>
            <Textarea value={reqText} onChange={(e) => setReqText(e.target.value)} placeholder="5 ans d'expérience...&#10;Maîtrise de React Native..." rows={4} />
          </div>

          <div className="grid gap-1.5">
            <Label>Avantages (1 ligne = 1 point)</Label>
            <Textarea value={benText} onChange={(e) => setBenText(e.target.value)} placeholder="Mutuelle 100%...&#10;Mova Pass illimité..." rows={3} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit}>{editing ? "Mettre à jour" : "Publier l'offre"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}