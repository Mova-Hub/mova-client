"use client"

import * as React from "react"
import { toast } from "sonner"
import { IconCash, IconCheck, IconCreditCard, IconBuildingBank, IconDeviceMobile } from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import type { UIReservation } from "@/api/reservation"
import reservationApi from "@/api/reservation"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  reservation: UIReservation | null
  onSuccess: () => void
}

export function PaymentDialog({ open, onOpenChange, reservation, onSuccess }: Props) {
  const [loading, setLoading] = React.useState(false)
  const [amount, setAmount] = React.useState<number>(0)
  const [method, setMethod] = React.useState<string>("cash")
  const [note, setNote] = React.useState("")

  React.useEffect(() => {
    if (reservation) {
      setAmount(reservation.priceTotal ?? 0)
      setMethod("cash")
      setNote("")
    }
  }, [reservation, open])

  const handleSubmit = async () => {
    if (!reservation) return
    if (amount <= 0) return toast.error("Le montant doit être positif.")

    setLoading(true)
    try {
      await reservationApi.recordPayment(reservation.id, {
        amount,
        method,
        note
      })
      toast.success("Paiement enregistré avec succès.")
      onSuccess()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur lors de l'enregistrement.")
    } finally {
      setLoading(false)
    }
  }

  if (!reservation) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCash className="w-5 h-5 text-emerald-600" /> 
            Enregistrer un paiement
          </DialogTitle>
          <DialogDescription>
            Ajouter manuellement un paiement pour la réservation <strong>{reservation.code}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Montant reçu (FCFA)</Label>
            <Input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(Number(e.target.value))} 
              className="font-bold text-lg"
            />
          </div>

          <div className="grid gap-2">
            <Label>Moyen de paiement</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">
                  <div className="flex items-center gap-2"><IconCash className="w-4 h-4"/> Espèces</div>
                </SelectItem>
                <SelectItem value="mobile_money">
                  <div className="flex items-center gap-2"><IconDeviceMobile className="w-4 h-4"/> Mobile Money</div>
                </SelectItem>
                <SelectItem value="bank_transfer">
                  <div className="flex items-center gap-2"><IconBuildingBank className="w-4 h-4"/> Virement Bancaire</div>
                </SelectItem>
                <SelectItem value="check">
                  <div className="flex items-center gap-2"><IconCreditCard className="w-4 h-4"/> Chèque</div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Référence / Notes (Optionnel)</Label>
            <Textarea 
              placeholder="Ex: ID transaction, Nom du déposant..." 
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
            {loading ? "Enregistrement..." : "Confirmer le paiement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}