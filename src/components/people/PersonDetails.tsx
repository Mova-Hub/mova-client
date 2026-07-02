import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Person, PersonRole } from "@/api/people"

/* ----------- label helpers ----------- */

const ROLE_LABELS: Record<PersonRole, string> = {
  driver: "Chauffeur",
  owner: "Propriétaire",
  conductor: "Contrôleur",
}
const STATUS_LABELS: Record<string, string> = { active: "Actif", inactive: "Inactif" }
const STATUS_COLORS: Record<string, string> = {
  active: "border-emerald-400 text-emerald-700 bg-emerald-50",
  inactive: "border-gray-300 text-gray-600 bg-gray-50",
}

function normalizeRole(val: unknown): PersonRole | undefined {
  const s = String(val ?? "").trim().toLowerCase()
  if (s === "driver" || s === "chauffeur") return "driver"
  if (s === "owner" || s === "propriétaire" || s === "proprietaire") return "owner"
  if (s === "conductor" || s === "receveur" || s === "controleur" || s === "contrôleur") return "conductor"
  return undefined
}

function frRole(r?: PersonRole | null) { return r ? (ROLE_LABELS[r] ?? r) : "—" }
function frStatus(s?: string | null) { return s ? (STATUS_LABELS[s] ?? s) : "—" }

/* ----------- sub-component ----------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  )
}

/* ----------- props ----------- */

export type PersonDetailsProps = {
  person: Person
}

/* ----------- component ----------- */

export function PersonDetails({ person }: PersonDetailsProps) {
  const role = normalizeRole(person.role) ?? (person.role as PersonRole)
  const statusColor = STATUS_COLORS[person.status ?? ""] ?? ""

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Profil */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Profil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Rôle">
              <Badge variant="outline" className="capitalize">
                {frRole(role)}
              </Badge>
            </Field>
            <Separator />
            <Field label="Statut">
              <Badge variant="outline" className={statusColor}>
                {frStatus(person.status)}
              </Badge>
            </Field>
            {person.licenseNo && (
              <>
                <Separator />
                <Field label="N° Permis">
                  <span className="font-mono">{person.licenseNo}</span>
                </Field>
              </>
            )}
            {person.createdAt && (
              <>
                <Separator />
                <Field label="Ajouté le">
                  {new Date(person.createdAt).toLocaleDateString("fr-FR")}
                </Field>
              </>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Téléphone">{person.phone ?? "—"}</Field>
            <Separator />
            <Field label="Email">{person.email ?? "—"}</Field>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
