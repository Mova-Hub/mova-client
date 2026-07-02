import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { Job } from "@/api/job"
import { getLabel, JOB_STATUSES, WORK_MODES, CONTRACT_TYPES } from "@/api/job"

/* ----------- status color map ----------- */

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  open:  "bg-green-100 text-green-800 border-green-300",
  closed:"bg-red-100 text-red-800 border-red-300",
}

/* ----------- small helpers ----------- */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function BulletList({ items }: { items?: string[] }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground italic">Non renseigné</p>
  return (
    <ul className="pl-4 space-y-1 list-disc text-sm text-muted-foreground">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  )
}

/* ----------- props ----------- */

export type Option = { label: string; value: string }

export type JobDetailsProps = {
  job: Job
  allDepts: Option[]
  allLocs: Option[]
  allCountries: Option[]
}

/* ----------- component ----------- */

export function JobDetails({ job, allDepts, allLocs, allCountries }: JobDetailsProps) {
  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Status + mode badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{getLabel(WORK_MODES, job.workMode)}</Badge>
        <Badge variant="secondary">{getLabel(CONTRACT_TYPES, job.contractType)}</Badge>
        <Badge variant="outline" className={STATUS_COLORS[job.status]}>
          {getLabel(JOB_STATUSES, job.status)}
        </Badge>
      </div>

      {/* Meta info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Département", value: getLabel(allDepts, job.department) },
          { label: "Lieu",        value: getLabel(allLocs, job.location)   },
          { label: "Pays",        value: getLabel(allCountries, job.country) },
          { label: "Contrat",     value: getLabel(CONTRACT_TYPES, job.contractType) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-0.5 text-sm font-medium">{value || "—"}</p>
          </div>
        ))}
      </div>

      <Separator />

      {/* Content sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard title="Le Poste">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {job.shortDesc || <span className="italic">Non renseigné</span>}
          </p>
        </SectionCard>

        <SectionCard title="Responsabilités">
          <BulletList items={job.responsibilities} />
        </SectionCard>

        <SectionCard title="Profil Recherché">
          <BulletList items={job.requirements} />
        </SectionCard>

        <SectionCard title="Avantages">
          <BulletList items={job.benefits} />
        </SectionCard>
      </div>
    </div>
  )
}
