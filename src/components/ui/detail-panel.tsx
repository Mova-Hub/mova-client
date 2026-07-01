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

export type DetailPanelWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full"

const WIDTH_CLASSES: Record<DetailPanelWidth, string> = {
  sm:   "sm:max-w-sm",
  md:   "sm:max-w-md",
  lg:   "sm:max-w-lg",
  xl:   "sm:max-w-xl",
  "2xl":"sm:max-w-2xl",
  "3xl":"sm:max-w-3xl",
  full: "sm:max-w-full",
}

export type DetailPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Panel title (bold) */
  title?: React.ReactNode
  /** Subtitle rendered below the title in muted text */
  description?: React.ReactNode
  /** Panel body — rendered inside a ScrollArea */
  children?: React.ReactNode
  /** Pinned footer area (actions, buttons) */
  footer?: React.ReactNode
  /** Panel width (default: xl). Applies a max-width breakpoint. */
  width?: DetailPanelWidth
  /** Extra className forwarded to the SheetContent wrapper */
  className?: string
}

/* -------------------------------------------------------------------------- */
/*                                 Component                                  */
/* -------------------------------------------------------------------------- */

/**
 * A right-to-left full-height sliding detail panel.
 * Wraps shadcn/ui Sheet with a standardised header, scrollable body, and
 * optional pinned footer. Fully customisable per-page via props and className.
 *
 * Usage (standalone):
 *   <DetailPanel open={open} onOpenChange={setOpen} title="Bus ABC-123" width="2xl">
 *     <BusDetail bus={selected} />
 *   </DetailPanel>
 *
 * DataTable wires this up automatically via renderRowDetail / renderRowDetailTitle.
 */
export function DetailPanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "xl",
  className,
}: DetailPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          // Override shadcn default narrow width; hide built-in close button
          // (we render our own in the header for better positioning)
          "flex flex-col gap-0 p-0 inset-y-0 h-full [&>button:last-child]:hidden",
          WIDTH_CLASSES[width],
          className
        )}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-start justify-between border-b bg-muted/30 px-6 py-4 shrink-0">
          <div className="min-w-0 flex-1">
            {title ? (
              <SheetTitle className="text-base font-semibold leading-snug">
                {title}
              </SheetTitle>
            ) : (
              /* Accessibility: SheetTitle is required by Radix Dialog */
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
              className="ml-3 shrink-0 size-8 text-muted-foreground hover:text-foreground"
            >
              <IconX className="size-4" />
              <span className="sr-only">Fermer</span>
            </Button>
          </SheetClose>
        </div>

        {/* ── Scrollable body ─────────────────────────────────────── */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5">
            {children}
          </div>
        </ScrollArea>

        {/* ── Pinned footer ───────────────────────────────────────── */}
        {footer && (
          <div className="border-t bg-background px-6 py-4 shrink-0">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
