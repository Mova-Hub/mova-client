// src/components/SiteHeader.tsx
"use client"

import * as React from "react"
import { NavLink, useLocation } from "react-router-dom"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import useAuth from "@/hooks/useAuth"
import { Badge } from "@/components/ui/badge"

/* ----------------------------- Tabs (all) ----------------------------- */
type Tab = { to: string; label: string }

const ALL_TABS: readonly Tab[] = [
  { to: "/buses", label: "Bus" },
  { to: "/people", label: "Chauffeurs & Propriétaires" }, // admin-only
  { to: "/clients", label: "Clients" }, 
  { to: "/orders", label: "Commandes" }, 
  { to: "/reservations", label: "Locations" },
  { to: "/staff", label: "Staff" }, // admin-only
] as const

const ADMIN_ONLY_PATHS = new Set<string>(["/people", "/staff"])

/* ----------------------------- Secondary navbar ----------------------------- */
function SecondaryHeadbar({ tabs }: { tabs: readonly Tab[] }) {
  return (
    <div className="z-30 w-full border-b bg-primary/5">
      <div className="flex items-center justify-between px-4 sm:px-6 h-10 text-sm">
        {/* Visible links on medium+ screens */}
        <div className="hidden md:flex items-center gap-4">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                cn(
                  "inline-flex h-10 items-center px-2 font-medium transition-colors border-b-2",
                  "border-transparent hover:text-foreground text-muted-foreground",
                  isActive && "text-foreground border-primary"
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>

        {/* Dropdown for small screens */}
        <div className="flex md:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="flex items-center gap-1 text-sm">
                <MoreHorizontal className="h-4 w-4" />
                <span>Plus</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="p-1 min-w-48">
              {tabs.map((t) => (
                <DropdownMenuItem key={t.to} asChild className="rounded-md">
                  <NavLink
                    to={t.to}
                    className={({ isActive }) =>
                      cn(
                        "w-full px-2 py-1.5 rounded-md transition-colors",
                        isActive ? "bg-accent text-foreground" : "hover:bg-accent/60 text-muted-foreground"
                      )
                    }
                  >
                    {t.label}
                  </NavLink>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------- Main Header ----------------------------- */
export function SiteHeader() {
  const { user } = useAuth()
  const isAdmin = React.useMemo(() => {
    const role = (user?.role ?? "").toString().toLowerCase()
    return role === "admin" || role === "superadmin"
  }, [user?.role])

  // filter tabs based on role
  const visibleTabs = React.useMemo(
    () => ALL_TABS.filter((t) => isAdmin || !ADMIN_ONLY_PATHS.has(t.to)),
    [isAdmin]
  )

  const location = useLocation()
  const isLocations = location.pathname.startsWith("/locations")
  const isDataActive = !isLocations

  return (
    <>
      {/* Top header */}
      <header className="relative z-40 flex h-[56px] items-center border-b bg-background/80 backdrop-blur-md px-4 lg:px-6">
        {/* Mobile-only trigger to open the off-canvas sidebar */}
        <SidebarTrigger className="-ml-1 mr-2 md:hidden" />

        {/* Center nav */}
        <nav className="pointer-events-auto absolute left-1/2 -translate-x-1/2">
          <ul className="flex items-center gap-2 p-1 bg-muted/50 rounded-md">
            <li>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                    isActive || (!location.pathname.startsWith("/map") && !location.pathname.startsWith("/locations"))
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )
                }
              >
                Données
              </NavLink>
            </li>
            <li className="flex items-center gap-1.5">
              <NavLink
                to="/map/reservations"
                className={({ isActive }) =>
                  cn(
                    "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                    (isActive || location.pathname.startsWith("/map") || location.pathname.startsWith("/locations"))
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  )
                }
              >
                Locations
              </NavLink>

              {/* Beta tag */}
              <Badge
                variant="secondary"
                className="text-[10px] font-medium uppercase px-1.5 py-0.5 leading-none"
              >
                Beta
              </Badge>
            </li>
          </ul>
        </nav>



        {/* Right side — empty (notifications moved to sidebar) */}
        <div className="ml-auto flex items-center gap-2" />
      </header>

      {/* Clean, responsive second nav (role-aware) */}
      <SecondaryHeadbar tabs={visibleTabs} />
    </>
  )
}
