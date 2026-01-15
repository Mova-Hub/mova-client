// src/components/data-table.tsx
"use client"

import * as React from "react"
import type { ColumnDef, SortingState, Column } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"

import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconDotsVertical,
  IconPlus,
  IconUpload,
  IconSearch,
  IconTrash,
  IconTable,
  IconGridDots,
  IconX,
  IconFilter,
  IconRefresh,
  IconChevronDown,
  IconLoader2,            // NEW
  IconMoodConfuzed,       // NEW
  IconSearch as IconSearchOutline, // NEW (alias to avoid name clash)
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { cn, getNestedValue } from "@/lib/utils"

export type FilterConfig<T> = {
  id: string
  label: string
  options: Array<{ label: string; value: string }>
  accessor: (row: T) => string
  defaultValue?: string
}

export type GroupByConfig<T> = {
  id: string
  label: string
  accessor: (row: T) => string
  sortGroups?: (a: string, b: string) => number
}

export type DrawerConfig<T> = {
  triggerField?: keyof T
  renderTrigger?: (row: T) => React.ReactNode
  renderTitle?: (row: T) => React.ReactNode
  renderBody?: (row: T) => React.ReactNode
  renderFooter?: (row: T) => React.ReactNode
}

type ViewMode = "list" | "grid"

export type DataTableProps<T extends object> = {
  data: T[]
  columns: ColumnDef<T>[]
  getRowId?: (row: T, index: number) => string
  /** kept for API compatibility but ignored now that DnD is removed */
  drag?: { getId: (row: T) => string }
  searchable?: { placeholder?: string; fields: (keyof T)[] }
  filters?: FilterConfig<T>[]
  /** Optional grouping (dynamic). If omitted, Group By control is hidden. */
  groupBy?: GroupByConfig<T>[]
  /** Optional initial view; default "list" */
  initialView?: ViewMode
  /** Grid view renderer; if omitted, a generic card is rendered from visible columns */
  renderCard?: (row: T) => React.ReactNode
  onAdd?: () => void
  addLabel?: string
  onImport?: () => void
  importLabel?: string
  pageSizeOptions?: number[]
  renderRowActions?: (row: T) => React.ReactNode
  /** bulk delete handler; called after user confirms */
  onDeleteSelected?: (rows: T[]) => void
  /** show loading empty state */
  loading?: boolean
  rowCount?: number
  pagination?: { pageIndex: number; pageSize: number }
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
  onRowClick?: (row: T) => void
}

/* -------------------------- Safe label/value helpers ------------------------- */
/** Never call flexRender with fake contexts in grid mode. */
function columnLabel<T>(col: Column<T, unknown>) {
  const def: any = col.columnDef
  if (typeof def.header === "string") return def.header
  if (def?.meta?.label) return String(def.meta.label)
  return String(col.id)
}

function columnValue<T>(col: Column<T, unknown>, row: T) {
  const def: any = col.columnDef
  if (typeof def.accessorFn === "function") {
    try {
      return def.accessorFn(row, 0)
    } catch {
      // ignore
    }
  }
  if (def.accessorKey) {
    return (row as any)[String(def.accessorKey)]
  }
  return (row as any)[String(col.id)]
}

/* -------------------------------------------------------------------------- */
/*                               Main component                               */
/* -------------------------------------------------------------------------- */

export function DataTable<T extends object>({
  data: externalData,
  columns,
  getRowId,
  searchable,
  filters,
  groupBy,
  initialView = "list",
  renderCard,
  onAdd,
  addLabel = "Add",
  onImport,
  importLabel = "Import",
  pageSizeOptions = [10, 20, 30, 40, 50],
  renderRowActions,
  onDeleteSelected,
  loading, // NEW
}: DataTableProps<T>) {
  const ALL_TOKEN = "__ALL__" // Radix Select can't use empty string

  /* ------------------------------- Local rows ------------------------------- */
  const [data, setData] = React.useState<T[]>(() => externalData)
  React.useEffect(() => setData(externalData), [externalData])

  /* --------------------------------- Table --------------------------------- */
  const [openDelete, setOpenDelete] = React.useState(false)
  const [rowSelection, setRowSelection] = React.useState({})
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  // Normalize initial view so Grid can't be activated even if passed in
  const normalizedInitialView: ViewMode = initialView === "grid" ? "list" : initialView
  const [view, setView] = React.useState<ViewMode>(normalizedInitialView)

  /* ------------------------------ Search (UX) ------------------------------- */
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 180)
    return () => clearTimeout(t)
  }, [searchInput])

  function focusSearchSafely() {
    const el = searchInputRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.focus({ preventScroll: true })
      try {
        const len = el.value.length
        el.setSelectionRange(len, len)
      } catch {}
    })
  }
  React.useEffect(() => {
    if (searchOpen) focusSearchSafely()
  }, [searchOpen])

  /* -------------------------------- Filters -------------------------------- */
  const [filterSelections, setFilterSelections] = React.useState<Record<string, string>>(
    () =>
      (filters ?? []).reduce((acc, f) => {
        if (f.defaultValue) acc[f.id] = f.defaultValue
        return acc
      }, {} as Record<string, string>)
  )
  function setFilter(id: string, value: string) {
    setFilterSelections((prev) => ({ ...prev, [id]: value }))
  }
  function clearAllFilters() {
    setFilterSelections({})
  }

  // Faceted counts (respects other filters + search)
  const countsByFilter = React.useMemo(() => {
    if (!filters?.length) return {}
    const q = search.trim().toLowerCase()
    const afterSearch = !searchable || !q
      ? data
      : data.filter((row) =>
          searchable.fields.some((k) =>
            String(row[k] ?? "").toLowerCase().includes(q)
          )
        )
    const map: Record<string, Record<string, number>> = {}
    for (const f of filters) {
      const rows = afterSearch.filter((row) =>
        (filters ?? []).every((g) => {
          if (g.id === f.id) return true
          const selected = (filterSelections[g.id] ?? g.defaultValue) || ""
          if (!selected) return true
          return g.accessor(row) === selected
        })
      )
      const counter: Record<string, number> = {}
      for (const row of rows) {
        const v = f.accessor(row) ?? ""
        counter[v] = (counter[v] ?? 0) + 1
      }
      map[f.id] = counter
    }
    return map
  }, [data, filters, filterSelections, search, searchable])

  /* ------------------------- Final filtered rows ------------------------ */
  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.filter((row) => {
      const passSearch =
        !searchable || !q
          ? true
          : searchable.fields.some((k) => {
              // FIX: Use helper for dot-notation keys
              const val = getNestedValue(row, String(k))
              return String(val ?? "").toLowerCase().includes(q)
            })
            
      const passFilters =
        !(filters && filters.length)
          ? true
          : filters!.every((f) => {
              const selected = (filterSelections[f.id] ?? f.defaultValue) || ""
              if (!selected) return true
              return f.accessor(row) === selected
            })
      return passSearch && passFilters
    })
  }, [data, search, filters, searchable, filterSelections])

  // Reset to first page when filters/search change
  React.useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [search, filterSelections])

  /* -------------------------------- Grouping -------------------------------- */
  const [groupId, setGroupId] = React.useState<string>("")
  const currentGroup = React.useMemo(
    () => groupBy?.find((g) => g.id === groupId),
    [groupBy, groupId]
  )

  const grouped: Record<string, T[]> | null = React.useMemo(() => {
    if (!currentGroup) return null
    const map: Record<string, T[]> = {}
    for (const r of filteredRows) {
      const key = currentGroup.accessor(r) ?? "—"
      if (!map[key]) map[key] = []
      map[key].push(r)
    }
    const keys = Object.keys(map)
    keys.sort(currentGroup.sortGroups ?? ((a, b) => a.localeCompare(b)))
    return keys.reduce((acc, k) => (acc[k] = map[k], acc), {} as Record<string, T[]>)
  }, [filteredRows, currentGroup])

  /* ------------------------------ Columns compose ----------------------------- */
  const composedColumns = React.useMemo<ColumnDef<T>[]>(() => {
    const cols: ColumnDef<T>[] = []

    // Select column
    cols.push({
      id: "_select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 36,
    })

    // User columns
    cols.push(...columns)

    // Actions column
    if (renderRowActions) {
      cols.push({
        id: "_actions",
        header: () => null,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
              >
                <IconDotsVertical />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {renderRowActions(row.original)}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 56,
      })
    }

    return cols
  }, [columns, renderRowActions])

  /* --------------------------------- Table --------------------------------- */
  const table = useReactTable({
    data: filteredRows,
    columns: composedColumns,
    state: { sorting, rowSelection, pagination },
    getRowId: (row, index) => (getRowId?.(row, index) ?? String(index)),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  /* ------------------------------ Toolbar (UI) ------------------------------ */

  // NEW: detect active search or filters (for better empty copy)
  const hasActiveFilters =
    Object.entries(filterSelections).some(([, v]) => !!v) || !!search.trim()

  // NEW: reset UX helpers
  function resetSearchAndFilters() {
    setSearchInput("")
    setSearch("")
    clearAllFilters()
    focusSearchSafely()
  }

  // NEW: Beautiful empty states (loading vs. nothing found)
  function EmptyState() {
    if (loading) {
      return (
        <div className="py-16">
          <div className="mx-auto w-full max-w-md rounded-lg border bg-muted/30 p-6 text-center">
            <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-background shadow ring-1 ring-border">
              <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
            <div className="text-base font-medium">Chargement des données…</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Merci de patienter, ceci peut prendre quelques secondes.
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="py-16">
        <div className="mx-auto w-full max-w-md rounded-lg border bg-muted/20 p-6 text-center">
          <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-background shadow ring-1 ring-border">
            {hasActiveFilters ? (
              <IconSearchOutline className="size-5 text-muted-foreground" />
            ) : (
              <IconMoodConfuzed className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="text-base font-semibold">
            {hasActiveFilters ? "Aucun résultat trouvé" : "Aucun élément à afficher"}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Ajustez votre recherche ou vos filtres pour élargir les résultats."
              : "Lorsque des données seront disponibles, elles s’afficheront ici."}
          </p>

          {hasActiveFilters && (
            <div className="mt-4 flex justify-center">
              <Button
                size="sm"
                variant="secondary"
                onClick={resetSearchAndFilters}
              >
                Réinitialiser la recherche et les filtres
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  function ActiveFilterChips() {
    const entries = Object.entries(filterSelections).filter(([, v]) => v && v !== ALL_TOKEN)
    if (!entries.length) return null
    return (
      <div className="flex flex-wrap items-center gap-2">
        {entries.map(([id, v]) => {
          const meta = filters?.find(f => f.id === id)
          const label = meta?.options.find(o => o.value === v)?.label ?? v
          return (
            <span
              key={`${id}:${v}`}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs"
            >
              <span className="font-medium">{meta?.label}:</span> {label}
              <button
                className="rounded-full p-1 hover:bg-muted"
                onClick={() => setFilter(id, "")}
                aria-label={`Remove ${meta?.label}`}
              >
                <IconX className="size-3" />
              </button>
            </span>
          )
        })}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={clearAllFilters}
        >
          <IconRefresh className="mr-1 size-4" /> Clear
        </Button>
      </div>
    )
  }

  // function Toolbar() {
  //   return (
  //     <div className="mb-3">
  //       <div className="flex flex-wrap items-center gap-2">
  //         {/* LEFT: Filters */}
  //         <div className="flex flex-wrap items-center gap-2">
  //           {filters?.map((f) => {
  //             const selected = filterSelections[f.id] ?? ""
  //             const counts = countsByFilter[f.id] ?? {}
  //             const total = filteredRows.length
  //             return (
  //               <Select
  //                 key={f.id}
  //                 value={selected ? selected : ALL_TOKEN}
  //                 onValueChange={(v) => setFilter(f.id, v === ALL_TOKEN ? "" : v)}
  //               >
  //                 <SelectTrigger
  //                   className="w-[210px]"
  //                   size="sm"
  //                   aria-label={f.label}
  //                 >
  //                   <IconFilter className="mr-1 size-4 text-muted-foreground" />
  //                   <SelectValue placeholder={f.label} />
  //                 </SelectTrigger>
  //                 <SelectContent align="start">
  //                   <SelectItem value={ALL_TOKEN}>
  //                     Tous {typeof total === "number" ? `(${total})` : ""}
  //                   </SelectItem>
  //                   {f.options.map((o) => (
  //                     <SelectItem key={o.value} value={o.value}>
  //                       {o.label} ({counts[o.value] ?? 0})
  //                     </SelectItem>
  //                   ))}
  //                 </SelectContent>
  //               </Select>
  //             )
  //           })}

  //           {/* Group By */}
  //           {groupBy?.length ? (
  //             <Select
  //               value={groupId || "none"}
  //               onValueChange={(v) => setGroupId(v === "none" ? "" : v)}
  //             >
  //               <SelectTrigger size="sm" className="w-[180px]">
  //                 <IconChevronDown className="mr-1 size-4 text-muted-foreground" />
  //                 <SelectValue placeholder="Group by" />
  //               </SelectTrigger>
  //               <SelectContent>
  //                 <SelectItem value="none">Group</SelectItem>
  //                 {groupBy.map((g) => (
  //                   <SelectItem key={g.id} value={g.id}>
  //                     {g.label}
  //                   </SelectItem>
  //                 ))}
  //               </SelectContent>
  //             </Select>
  //           ) : null}

  //           {/* Active filter chips */}
  //           <ActiveFilterChips />
  //         </div>

  //         {/* CENTER: Search Icon → Expanding Input */}
  //         {searchable && (
  //           <div className="mx-auto flex items-center">
  //             <div
  //               className={cn(
  //                 "flex items-center rounded-md border bg-background transition-all",
  //                 searchOpen ? "pr-2" : "border-transparent"
  //               )}
  //               onMouseDown={(e) => e.preventDefault()}
  //             >
  //               <Button
  //                 type="button"
  //                 variant={searchOpen ? "secondary" : "ghost"}
  //                 size="icon"
  //                 className="size-8"
  //                 onClick={() => setSearchOpen((v) => !v)}
  //               >
  //                 <IconSearch className="size-4" />
  //               </Button>
  //               <Input
  //                 ref={searchInputRef}
  //                 className={cn(
  //                   "border-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all placeholder:text-sm",
  //                   searchOpen ? "w-40 sm:w-64 lg:w-80 opacity-100" : "w-0 p-0 opacity-0"
  //                 )}
  //                 placeholder={searchable.placeholder ?? "Search..."}
  //                 value={searchInput}
  //                 onChange={(e) => setSearchInput(e.target.value)}
  //                 onFocus={() => setSearchOpen(true)}
  //               />
  //               {searchOpen && searchInput && (
  //                 <button
  //                   className="rounded p-1 hover:bg-muted"
  //                   onClick={() => {
  //                     setSearchInput("")
  //                     setSearch("")
  //                     focusSearchSafely()
  //                   }}
  //                   aria-label="Clear search"
  //                 >
  //                   <IconX className="size-4" />
  //                 </button>
  //               )}
  //             </div>
  //           </div>
  //         )}

  //         {/* RIGHT: View switch + Import + Delete + Add */}
  //         <div className="ml-auto flex items-center gap-2">
  //           {/* View */}
  //           <div className="hidden sm:flex rounded-md border">
  //             <Button
  //               type="button"
  //               variant={view === "list" ? "default" : "ghost"}
  //               size="sm"
  //               className="gap-1 rounded-r-none"
  //               onClick={() => setView("list")}
  //             >
  //               <IconTable className="size-4" />
  //               <span className="hidden md:inline">Liste</span>
  //             </Button>
  //             <Button
  //               type="button"
  //               variant="ghost"
  //               size="sm"
  //               className="gap-1 rounded-l-none opacity-50 pointer-events-none"
  //               disabled
  //               title="Grid indisponible pour le moment"
  //             >
  //               <IconGridDots className="size-4" />
  //               <span className="hidden md:inline">Grid</span>
  //             </Button>
  //           </div>

  //           {/* Delete selected */}
  //           {onDeleteSelected && table.getFilteredSelectedRowModel().rows.length > 0 && (
  //             <Button
  //               variant="destructive"
  //               size="sm"
  //               onClick={() => setOpenDelete(true)}
  //             >
  //               <IconTrash />
  //               <span className="hidden lg:inline">
  //                 Supprimer ({table.getFilteredSelectedRowModel().rows.length})
  //               </span>
  //             </Button>
  //           )}
  //           {onImport && (
  //             <Button variant="outline" size="sm" onClick={onImport}>
  //               <IconUpload />
  //               <span className="hidden lg:inline">{importLabel}</span>
  //             </Button>
  //           )}
  //           {onAdd && (
  //             <Button variant="default" size="sm" onClick={onAdd}>
  //               <IconPlus />
  //               <span className="hidden lg:inline">{addLabel}</span>
  //             </Button>
  //           )}
  //         </div>
  //       </div>
  //     </div>
  //   )
  // }

  /* ------------------------------ Grid rendering (kept but unreachable) ------ */
  function AutoCard({ row }: { row: any }) {
    // Build from leaf, visible columns (skip _select/_actions) WITHOUT flexRender
    const visibleCols = table
      .getAllLeafColumns()
      .filter((c) => c.getIsVisible() && !["_select", "_actions"].includes(c.id)) as Column<any, unknown>[]

    return (
      <div className="rounded-lg border p-3 hover:shadow-sm transition-shadow">
        <div className="space-y-2">
          {visibleCols.map((col) => {
            const label = columnLabel(col)
            const value = columnValue(col, row)

            return (
              <div key={col.id} className="grid grid-cols-3 gap-2 text-sm">
                <div className="col-span-1 text-muted-foreground">{label}</div>
                <div className="col-span-2 font-medium truncate">
                  {React.isValidElement(value)
                    ? value
                    : typeof value === "string" || typeof value === "number"
                    ? String(value)
                    : value == null
                    ? "—"
                    : JSON.stringify(value)}
                </div>
              </div>
            )
          })}
        </div>

        {renderRowActions && (
          <div className="mt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <IconDotsVertical className="size-4" /> Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {renderRowActions(row)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    )
  }

  function GridSection({ title, rows }: { title?: string; rows: T[] }) {
    return (
      <section className="w-full">
        {title ? (
          <div className="sticky top-[52px] z-10 -mx-1 mb-2 bg-background/60 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/40">
            <div className="text-sm font-semibold">
              {title} <span className="text-muted-foreground">({rows.length})</span>
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {rows.map((r, i) => (
            <div key={(r as any).id ?? i}>
              {renderCard ? renderCard(r) : <AutoCard row={r} />}
            </div>
          ))}
        </div>
      </section>
    )
  }

  /* ---------------------------------- Render ---------------------------------- */
  return (
    <div className="-mx-4 lg:-mx-6 w-full flex flex-col justify-start">
      <div className="pt-1 px-4 lg:px-6">
        
        {/* --- INLINED TOOLBAR START --- */}
        <div className="mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* LEFT: Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {filters?.map((f) => {
                const selected = filterSelections[f.id] ?? ""
                const counts = countsByFilter[f.id] ?? {}
                const total = filteredRows.length
                return (
                  <Select
                    key={f.id}
                    value={selected ? selected : ALL_TOKEN}
                    onValueChange={(v) => setFilter(f.id, v === ALL_TOKEN ? "" : v)}
                  >
                    <SelectTrigger
                      className="w-[210px]"
                      size="sm"
                      aria-label={f.label}
                    >
                      <IconFilter className="mr-1 size-4 text-muted-foreground" />
                      <SelectValue placeholder={f.label} />
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectItem value={ALL_TOKEN}>
                        Tous {typeof total === "number" ? `(${total})` : ""}
                      </SelectItem>
                      {f.options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label} ({counts[o.value] ?? 0})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              })}

              {/* Group By */}
              {groupBy?.length ? (
                <Select
                  value={groupId || "none"}
                  onValueChange={(v) => setGroupId(v === "none" ? "" : v)}
                >
                  <SelectTrigger size="sm" className="w-[180px]">
                    <IconChevronDown className="mr-1 size-4 text-muted-foreground" />
                    <SelectValue placeholder="Group by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Group</SelectItem>
                    {groupBy.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              {/* Active filter chips */}
              <ActiveFilterChips />
            </div>

            {/* CENTER: Search Icon → Expanding Input */}
            {searchable && (
              <div className="mx-auto flex items-center">
                <div
                  className={cn(
                    "flex items-center rounded-md border bg-background transition-all",
                    searchOpen ? "pr-2" : "border-transparent"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Button
                    type="button"
                    variant={searchOpen ? "secondary" : "ghost"}
                    size="icon"
                    className="size-8"
                    onClick={() => setSearchOpen((v) => !v)}
                  >
                    <IconSearch className="size-4" />
                  </Button>
                  <Input
                    ref={searchInputRef}
                    className={cn(
                      "border-none focus-visible:ring-0 focus-visible:ring-offset-0 transition-all placeholder:text-sm",
                      searchOpen ? "w-40 sm:w-64 lg:w-80 opacity-100" : "w-0 p-0 opacity-0"
                    )}
                    placeholder={searchable.placeholder ?? "Search..."}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onFocus={() => setSearchOpen(true)}
                  />
                  {searchOpen && searchInput && (
                    <button
                      className="rounded p-1 hover:bg-muted"
                      onClick={() => {
                        setSearchInput("")
                        setSearch("")
                        focusSearchSafely()
                      }}
                      aria-label="Clear search"
                    >
                      <IconX className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* RIGHT: View switch + Import + Delete + Add */}
            <div className="ml-auto flex items-center gap-2">
              {/* View */}
              <div className="hidden sm:flex rounded-md border">
                <Button
                  type="button"
                  variant={view === "list" ? "default" : "ghost"}
                  size="sm"
                  className="gap-1 rounded-r-none"
                  onClick={() => setView("list")}
                >
                  <IconTable className="size-4" />
                  <span className="hidden md:inline">Liste</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 rounded-l-none opacity-50 pointer-events-none"
                  disabled
                  title="Grid indisponible pour le moment"
                >
                  <IconGridDots className="size-4" />
                  <span className="hidden md:inline">Grid</span>
                </Button>
              </div>

              {/* Delete selected */}
              {onDeleteSelected && table.getFilteredSelectedRowModel().rows.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setOpenDelete(true)}
                >
                  <IconTrash />
                  <span className="hidden lg:inline">
                    Supprimer ({table.getFilteredSelectedRowModel().rows.length})
                  </span>
                </Button>
              )}
              {onImport && (
                <Button variant="outline" size="sm" onClick={onImport}>
                  <IconUpload />
                  <span className="hidden lg:inline">{importLabel}</span>
                </Button>
              )}
              {onAdd && (
                <Button variant="default" size="sm" onClick={onAdd}>
                  <IconPlus />
                  <span className="hidden lg:inline">{addLabel}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
        {/* --- INLINED TOOLBAR END --- */}

      </div>

      {/* LIST VIEW */}
      {view === "list" ? (
        <div className="relative px-2 lg:px-3 ">{/* match toolbar edges */}
          <div className="overflow-x-auto border-x">{/* side borders only */}
            <Table className="w-full min-w-full">{/* ensure full width */}
              <TableHeader className="bg-muted sticky top-0 z-10">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} colSpan={header.colSpan} className="whitespace-nowrap">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {(() => {
                  const rows = table.getRowModel().rows
                  if (!rows?.length) {
                    // Improved empty states
                    return (
                      <TableRow>
                        <TableCell colSpan={composedColumns.length} className="h-auto p-0">
                          <EmptyState />
                        </TableCell>
                      </TableRow>
                    )
                  }

                  // If grouped, render group headers + rows
                  if (currentGroup && grouped) {
                    return Object.entries(grouped).map(([label, groupRows]) => (
                      <React.Fragment key={label}>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableCell colSpan={composedColumns.length} className="text-sm font-semibold">
                            {label} <span className="text-muted-foreground">({groupRows.length})</span>
                          </TableCell>
                        </TableRow>
                        {groupRows.map((gr, idx) => {
                          const id = getRowId?.(gr, idx) ?? String(filteredRows.indexOf(gr))
                          const tableRow =
                            rows.find((r) => r.id === id) ?? rows.find((r) => r.original === gr)
                          if (!tableRow) return null
                          return (
                            <TableRow
                              key={tableRow.id}
                              data-state={tableRow.getIsSelected() && "selected"}
                            >
                              {tableRow.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id} className="whitespace-nowrap">
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              ))}
                            </TableRow>
                          )
                        })}
                      </React.Fragment>
                    ))
                  }

                  // Ungrouped: render table rows normally
                  return rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="whitespace-nowrap">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                })()}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 px-2 lg:px-3">{/* keep padding here */}
            <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <div className="flex w-full items-center gap-8 lg:w-fit">
              <div className="hidden items-center gap-2 lg:flex">
                <Label htmlFor="rows-per-page" className="text-sm font-medium">
                  Résultat par page:
                </Label>
                <Select
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(v) => table.setPageSize(Number(v))}
                >
                  <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                    <SelectValue placeholder={table.getState().pagination.pageSize} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {pageSizeOptions.map((ps) => (
                      <SelectItem key={ps} value={`${ps}`}>
                        {ps}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex w-fit items-center justify-center text-sm font-medium">
                Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}
              </div>
              <div className="ml-auto flex items-center gap-2 lg:ml-0">
                <Button
                  variant="outline"
                  className="hidden h-8 w-8 p-0 lg:flex"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to first page</span>
                  <IconChevronsLeft />
                </Button>
                <Button
                  variant="outline"
                  className="size-8"
                  size="icon"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <span className="sr-only">Go to previous page</span>
                  <IconChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  className="size-8"
                  size="icon"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Go to next page</span>
                  <IconChevronRight />
                </Button>
                <Button
                  variant="outline"
                  className="hidden size-8 lg:flex"
                  size="icon"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}
                >
                  <span className="sr-only">Go to last page</span>
                  <IconChevronsRight />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* GRID VIEW — will never be reachable because Grid is disabled */
        <div className="flex flex-col gap-3">
          {currentGroup && grouped
            ? Object.entries(grouped).map(([label, rows]) => (
                <GridSection key={label} title={label} rows={rows} />
              ))
            : <GridSection rows={filteredRows} />
          }
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la sélection ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les éléments sélectionnés seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const selectedRows = table.getFilteredSelectedRowModel().rows.map(r => r.original as T)
                setOpenDelete(false)
                onDeleteSelected?.(selectedRows)
                table.resetRowSelection()
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
