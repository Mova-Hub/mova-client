import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Staff } from "@/api/staff"

/* ----------- label helpers ----------- */

const ROLE_LABELS: Record<string, string> = { agent: "Agent", admin: "Administrateur" }
const STATUS_COLORS: Record<string, string> = {
  active: "border-emerald-400 text-emerald-700 bg-emerald-50",
  inactive: "border-gray-300 text-gray-600 bg-gray-50",
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  )
}

/* ----------- props ----------- */

export type StaffDetailsProps = {
  staff: Staff
}

/* ----------- component ----------- */

export function StaffDetails({ staff }: StaffDetailsProps) {
  const statusColor = STATUS_COLORS[staff.status ?? ""] ?? ""

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
                {ROLE_LABELS[staff.role] ?? staff.role}
              </Badge>
            </Field>
            {staff.status && (
              <>
                <Separator />
                <Field label="Statut">
                  <Badge variant="outline" className={statusColor}>
                    {staff.status === "active" ? "Actif" : "Inactif"}
                  </Badge>
                </Field>
              </>
            )}
            {staff.createdAt && (
              <>
                <Separator />
                <Field label="Membre depuis">
                  {new Date(staff.createdAt).toLocaleDateString("fr-FR")}
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
            <Field label="Téléphone">{staff.phone ?? "—"}</Field>
            <Separator />
            <Field label="Email">{staff.email ?? "—"}</Field>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
