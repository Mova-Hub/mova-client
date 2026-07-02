import * as React from "react"
import { IconMail, IconPhone, IconShoppingBag, IconCalendar, IconClock } from "@tabler/icons-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Client } from "@/api/client"

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium ml-auto text-right">{children}</span>
    </div>
  )
}

export type ClientDetailsProps = {
  client: Client
}

export function ClientDetails({ client }: ClientDetailsProps) {
  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—"

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Contact */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Téléphone" icon={<IconPhone className="size-4" />}>
              {client.phone ?? "—"}
            </Field>
            <Separator />
            <Field label="Email" icon={<IconMail className="size-4" />}>
              {client.email ?? "—"}
            </Field>
          </CardContent>
        </Card>

        {/* Statistiques */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Statistiques
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Commandes" icon={<IconShoppingBag className="size-4" />}>
              {client.ordersCount ?? 0}
            </Field>
            <Separator />
            <Field label="Inscrit le" icon={<IconCalendar className="size-4" />}>
              {fmtDate(client.createdAt)}
            </Field>
            <Separator />
            <Field label="Dernière connexion" icon={<IconClock className="size-4" />}>
              {client.lastLoginAt ? fmtDate(client.lastLoginAt) : <span className="italic text-muted-foreground">Jamais</span>}
            </Field>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
