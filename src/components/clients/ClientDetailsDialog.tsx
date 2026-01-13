// src/components/clients/ClientDetailsDialog.tsx
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { IconPhone, IconMail, IconCalendar, IconLogin, IconPackage } from "@tabler/icons-react"
import type { Client } from "@/api/client"

interface Props {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClientDetailsDialog({ client, open, onOpenChange }: Props) {
  if (!client) return null

  const initials = client.name.split(" ").map(n => n[0]).join("").toUpperCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Détails du Client</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4 py-4">
          {/* Avatar Section */}
          <Avatar className="h-24 w-24 border-2 border-primary/10">
            <AvatarImage src={client.avatar} alt={client.name} className="object-cover" />
            <AvatarFallback className="text-2xl bg-primary/5 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="text-center">
            <h2 className="text-xl font-bold tracking-tight">{client.name}</h2>
            <Badge variant="secondary" className="mt-1 font-normal">
              ID: #{client.id}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Info Grid */}
        <div className="grid gap-4 py-4">
          <DetailItem 
            icon={<IconPhone className="h-4 w-4 text-muted-foreground" />} 
            label="Téléphone" 
            value={client.phone} 
          />
          <DetailItem 
            icon={<IconMail className="h-4 w-4 text-muted-foreground" />} 
            label="Email" 
            value={client.email ?? "Non renseigné"} 
          />
          <DetailItem 
            icon={<IconPackage className="h-4 w-4 text-muted-foreground" />} 
            label="Total Commandes" 
            value={`${client.ordersCount} commandes`} 
          />
          <DetailItem 
            icon={<IconCalendar className="h-4 w-4 text-muted-foreground" />} 
            label="Membre depuis" 
            value={client.createdAt ? new Date(client.createdAt).toLocaleDateString("fr-FR", { dateStyle: 'long' }) : "—"} 
          />
          <DetailItem 
            icon={<IconLogin className="h-4 w-4 text-muted-foreground" />} 
            label="Dernière connexion" 
            value={client.lastLoginAt ? new Date(client.lastLoginAt).toLocaleString("fr-FR") : "Jamais"} 
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">{icon}</div>
      <div className="space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground leading-none">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}