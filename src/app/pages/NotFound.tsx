"use client"

import * as React from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Bus, Search, Home, ArrowLeft, Ticket, MapPinned, Settings, LifeBuoy } from "lucide-react"

export default function NotFound() {
  const navigate = useNavigate()
  
  const [query, setQuery] = React.useState("")

  const onSearch = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return
    // Simulé: redirige vers une page de recherche (à brancher sur votre logique)
    navigate(`/reservations?search=${encodeURIComponent(query.trim())}`)
  }

  return (
    <main className="relative grid min-h-[calc(100dvh-var(--header-height))] place-items-center px-6 py-12">
      {/* Motif de fond discret (route en pointillés) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, currentColor 0 10px, transparent 10px 28px)",
          color: "currentColor",
        }}
      />

      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <Badge variant="secondary" className="mb-3 gap-1">
            <Bus className="h-3.5 w-3.5" />
            Gestion des réservations
          </Badge>

          <h1 className="font-semibold tracking-tight text-3xl sm:text-4xl">
            Page introuvable
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-prose">
            Oups ! La page que vous cherchez n’existe pas ou a été déplacée.
            Utilisez la recherche ci-dessous ou revenez vers une section connue.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={onSearch} className="mt-6">
          <label htmlFor="q" className="sr-only">
            Rechercher
          </label>
          <div className="relative">
            <Input
              id="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une réservation (code, téléphone, immatriculation)"
              className="h-11 pr-28"
            />
            <Button
              type="submit"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-9 px-3"
            >
              <Search className="mr-2 h-4 w-4" />
              Rechercher
            </Button>
          </div>
        </form>

        <Separator className="my-8" />

        {/* Quick actions */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="secondary"
            className="justify-start"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Revenir en arrière
          </Button>

          <Button className="justify-start" onClick={() => navigate("/overview")}>
            <Home className="mr-2 h-4 w-4" />
            Retour au tableau de bord
          </Button>

          <Button
            variant="outline"
            className="justify-start"
            onClick={() => navigate("/reservations")}
          >
            <Ticket className="mr-2 h-4 w-4" />
            Voir les réservations
          </Button>

          <Button
            variant="outline"
            className="justify-start"
            onClick={() => navigate("/buses")}
          >
            <MapPinned className="mr-2 h-4 w-4" />
            Gérer les bus & trajets
          </Button>
        </div>

        {/* Helpful tips / links */}
        <Card className="mt-8">
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Besoin d’aide ?</p>
                <p className="text-xs text-muted-foreground">
                  Consultez vos paramètres ou contactez le support si le problème persiste.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Paramètres
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                >
                  <LifeBuoy className="h-4 w-4" />
                  Support
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
