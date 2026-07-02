"use client"

import * as React from "react"
import { IconX } from "@tabler/icons-react"

import {
  Sheet,
  SheetContent,
  SheetClose,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

/** @deprecated width is no longer used – panels are always full-screen */
export type DetailPanelWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full"

export type DetailPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  /** @deprecated no-op, kept for API compatibility */
  width?: DetailPanelWidth
  className?: string
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

export function DetailPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: DetailPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          // Full-screen overlay: span the entire viewport width
          "flex flex-col gap-0 p-0 inset-y-0 left-0 w-screen max-w-none sm:max-w-none border-l-0 [&>button:last-child]:hidden",
          className
        )}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between border-b bg-muted/30 px-8 py-5 shrink-0">
          <div className="min-w-0 flex-1">
            {title ? (
              <SheetTitle className="text-lg font-semibold leading-snug">
                {title}
              </SheetTitle>
            ) : (
              <SheetTitle className="sr-only">Détails</SheetTitle>
            )}
            {description && (
              <SheetDescription className="mt-0.5 text-sm leading-snug">
                {description}
              </SheetDescription>
            )}
          </div>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-4 shrink-0 size-9 text-muted-foreground hover:text-foreground"
            >
              <IconX className="size-5" />
              <span className="sr-only">Fermer</span>
            </Button>
          </SheetClose>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-8 py-6">
            {children}
          </div>
        </ScrollArea>

        {/* ── Pinned footer ───────────────────────────────────────── */}
        {footer && (
          <div className="border-t bg-background px-8 py-4 shrink-0">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
