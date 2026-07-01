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
  IconX,
  IconFilter,
  IconRefresh,
  IconChevronDown,
  IconLoader2,
  IconMoodConfuzed,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer"
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

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

export type FilterConfig<T> = {
  id: string
  label: string
  options?: Array<{ label: string; value: string }>
  accessor: (row: T) => string
  /** @deprecated kept for API compatibility, unused in current filter system */
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

type FilterOperator = "eq" | "neq" | "contains" | "not_contains" | "empty" | "not_empty"

type FilterCondition = {
  id: string
  field: string
  operator: FilterOperator
  value: string
}

const OPERATORS: { value: FilterOperator; label: string; needsValue: boolean }[] = [
  { value: "eq",           label: "est",                needsValue: true  },
  { value: "neq",          label: "n'est pas",          needsValue: true  },
  { value: "contains",     label: "contient",           needsValue: true  },
  { value: "not_contains", label: "ne contient pas",    needsValue: true  },
  { value: "empty",        label: "est vide",           needsValue: false },
  { value: "not_empty",    label: "n'est pas vide",     needsValue: false },
]

export type DataTableProps<T extends object> = {
  data: T[]
  columns: ColumnDef<T>[]
  getRowId?: (row: T, index: number) => string
  searchable?: { placeholder?: string; fields: (keyof T)[] }
  filters?: FilterConfig<T>[]
  groupBy?: GroupByConfig<T>[]
  onAdd?: () => void
  addLabel?: string
  onImport?: () => void
  importLabel?: string
  pageSizeOptions?: number[]
  renderRowActions?: (row: T) => React.ReactNode
  onDeleteSelected?: (rows: T[]) => void
  loading?: boolean
  rowCount?: number
  pagination?: { pageIndex: number; pageSize: number }
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
  onRowClick?: (row: T) => void
  /** Opens a built-in Drawer when a row is clicked */
  renderRowDetail?: (row: T) => React.ReactNode
  renderRowDetailTitle?: (row: T) => React.ReactNode
}

/* -------------------------------------------------------------------------- */
/*                             Column value helpers                           */
/* -------------------------------------------------------------------------- */

function columnLabel<T>(col: Column<T, unknown>) {
  const def: any = col.columnDef
  if (typeof def.header === "string") return def.header
  if (def?.meta?.label) return String(def.meta.label)
  return String(col.id)
}

function columnValue<T>(col: Column<T, unknown>, row: T) {
  const def: any = col.columnDef
  if (typeof def.accessorFn === "function") {
    try { return def.accessorFn(row, 0) } catch { /* ignore */ }
  }
  if (def.accessorKey) return (row as any)[String(def.accessorKey)]
  return (row as any)[String(col.id)]
}

/* -------------------------------------------------------------------------- */
/*                              Main component                                */
/* -------------------------------------------------------------------------- */

export function DataTable<T extends object>({
  data: externalData,
  columns,
  getRowId,
  searchable,
  filters,
  groupBy,
  onAdd,
  addLabel = "Ajouter",
  onImport,
  importLabel = "Importer",
  pageSizeOptions = [10, 20, 30, 40, 50],
  renderRowActions,
  onDeleteSelected,
  loading,
  onRowClick,
  renderRowDetail,
  renderRowDetailTitle,
}: DataTableProps<T>) {
  const ALL_TOKEN = "__ALL__"

  const [data, setData] = React.useState<T[]>(() => externalData)
  React.useEffect(() => setData(externalData), [externalData])

  /* ----------------------------- Table state ------------------------------ */
  const [openDelete, setOpenDelete] = React.useState(false)
  const [rowSelection, setRowSelection] = React.useState({})
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  /* ------------------------------ Row detail ------------------------------ */
  const [detailRow, setDetailRow] = React.useState<T | null>(null)
  const isRowClickable = !!(renderRowDetail || onRowClick)

  /* ------------------------------- Search --------------------------------- */
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
      try { el.setSelectionRange(el.value.length, el.value.length) } catch { /* ignore */ }
    })
  }
  React.useEffect(() => { if (searchOpen) focusSearchSafely() }, [searchOpen])

  /* ------------------------- Airtable-style filters ----------------------- */
  const [conditions, setConditions] = React.useState<FilterCondition[]>([])

  function addCondition() {
    const firstField = filters?.[0]?.id
    if (!firstField) return
    setConditions((prev) => [
      ...prev,
      { id: Math.random().toString(36).slice(2), field: firstField, operator: "eq", value: "" },
    ])
  }

  function removeCondition(id: string) {
    setConditions((prev) => prev.filter((c) => c.id !== id))
  }

  function updateCondition(id: string, patch: Partial<FilterCondition>) {
    setConditions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function clearAllFilters() { setConditions([]) }

  function resetSearchAndFilters() {
    setSearchInput("")
    setSearch("")
    clearAllFilters()
    focusSearchSafely()
  }

  /* ------------------------- Filtered rows -------------------------------- */
  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.filter((row) => {
      const passSearch = !searchable || !q
        ? true
        : searchable.fields.some((k) => {
            const val = getNestedValue(row, String(k))
            return String(val ?? "").toLowerCase().includes(q)
          })

      const passFilters = conditions.length === 0
        ? true
        : conditions.every((cond) => {
            const config = filters?.find((f) => f.id === cond.field)
            if (!config) return true
            const rowValue = String(config.accessor(row) ?? "").toLowerCase()
            const condValue = cond.value.toLowerCase()
            switch (cond.operator) {
              case "eq":           return rowValue === condValue
              case "neq":          return rowValue !== condValue
              case "contains":     return rowValue.includes(condValue)
              case "not_contains": return !rowValue.includes(condValue)
              case "empty":        return !rowValue
              case "not_empty":    return !!rowValue
              default:             return true
            }
          })

      return passSearch && passFilters
    })
  }, [data, search, filters, searchable, conditions])

  React.useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [search, conditions])

  const hasActiveFilters = conditions.length > 0 || !!search.trim()

  /* -------------------------------- Grouping ------------------------------ */
  const [groupId, setGroupId] = React.useState<string>("")
  const currentGroup = React.useMemo(
    () => groupBy?.find((g) => g.id === groupId),
    [groupBy, groupId]
  )

  const grouped = React.useMemo<Record<string, T[]> | null>(() => {
    if (!currentGroup) return null
    const map: Record<string, T[]> = {}
    for (const r of filteredRows) {
      const key = currentGroup.accessor(r) ?? "—"
      if (!map[key]) map[key] = []
      map[key].push(r)
    }
    const keys = Object.keys(map).sort(currentGroup.sortGroups ?? ((a, b) => a.localeCompare(b)))
    return keys.reduce((acc, k) => { acc[k] = map[k]; return acc }, {} as Record<string, T[]>)
  }, [filteredRows, currentGroup])

  /* ------------------------------ Columns --------------------------------- */
  const composedColumns = React.useMemo<ColumnDef<T>[]>(() => {
    const cols: ColumnDef<T>[] = []

    cols.push({
      id: "_select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Sélectionner tout"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div
          className="flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Sélectionner la ligne"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      size: 36,
    })

    cols.push(...columns)

    if (renderRowActions) {
      cols.push({
        id: "_actions",
        header: () => null,
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="data-[state=open]:bg-muted text-muted-foreground flex size-8"
                >
                  <IconDotsVertical />
                  <span className="sr-only">Ouvrir le menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {renderRowActions(row.original)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        size: 56,
      })
    }

    return cols
  }, [columns, renderRowActions])

  /* --------------------------------- Table -------------------------------- */
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

  /* ----------------------------- Empty state ------------------------------ */
  const EmptyState = React.useCallback(() => {
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
            {hasActiveFilters
              ? <IconSearch className="size-5 text-muted-foreground" />
              : <IconMoodConfuzed className="size-5 text-muted-foreground" />
            }
          </div>
          <div className="text-base font-semibold">
            {hasActiveFilters ? "Aucun résultat trouvé" : "Aucun élément à afficher"}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Ajustez votre recherche ou vos filtres pour élargir les résultats."
              : "Lorsque des données seront disponibles, elles s'afficheront ici."}
          </p>
          {hasActiveFilters && (
            <div className="mt-4 flex justify-center">
              <Button size="sm" variant="secondary" onClick={resetSearchAndFilters}>
                Réinitialiser la recherche et les filtres
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, hasActiveFilters])

  /* -------------------------------- Render -------------------------------- */
  return (
    <div className="-mx-4 lg:-mx-6 w-full flex flex-col justify-start">
      <div className="pt-1 px-4 lg:px-6">

        {/* ── Toolbar ──────────────────────────────────────────── */}
        <div className="mb-3 flex flex-wrap items-center gap-2">

          {/* LEFT: Filter button (Airtable-style) + Group By */}
          <div className="flex flex-wrap items-center gap-2">

            {/* Airtable filter popover */}
            {filters?.length ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <IconFilter className="size-4" />
                    Filtrer
                    {conditions.length > 0 && (
                      <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                        {conditions.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[520px] p-0" sideOffset={6}>
                  {/* Panel header */}
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <span className="text-sm font-medium">Filtres</span>
                    {conditions.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAllFilters}>
                        <IconRefresh className="mr-1 size-3" />
                        Effacer tout
                      </Button>
                    )}
                  </div>

                  {/* Conditions list */}
                  <div className="max-h-72 overflow-y-auto p-3 space-y-2">
                    {conditions.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        Aucun filtre actif. Cliquez sur « Ajouter un filtre » pour commencer.
                      </p>
                    ) : (
                      conditions.map((cond) => {
                        const fieldConfig = filters.find((f) => f.id === cond.field)
                        const isEnumField = (fieldConfig?.options?.length ?? 0) > 0
                        const availableOps = isEnumField
                          ? OPERATORS.filter((op) => ["eq", "neq", "empty", "not_empty"].includes(op.value))
                          : OPERATORS
                        const needsValue = OPERATORS.find((op) => op.value === cond.operator)?.needsValue ?? true

                        return (
                          <div key={cond.id} className="flex items-center gap-2">
                            {/* Field selector */}
                            <Select
                              value={cond.field}
                              onValueChange={(v) => updateCondition(cond.id, { field: v, value: "", operator: "eq" })}
                            >
                              <SelectTrigger size="sm" className="w-[140px] shrink-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {filters.map((f) => (
                                  <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Operator selector */}
                            <Select
                              value={cond.operator}
                              onValueChange={(v) => updateCondition(cond.id, { operator: v as FilterOperator })}
                            >
                              <SelectTrigger size="sm" className="w-[160px] shrink-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableOps.map((op) => (
                                  <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            {/* Value */}
                            {needsValue && (
                              isEnumField ? (
                                <Select
                                  value={cond.value || ALL_TOKEN}
                                  onValueChange={(v) => updateCondition(cond.id, { value: v === ALL_TOKEN ? "" : v })}
                                >
                                  <SelectTrigger size="sm" className="w-[140px] shrink-0">
                                    <SelectValue placeholder="Choisir…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={ALL_TOKEN}>Tous</SelectItem>
                                    {fieldConfig?.options?.map((o) => (
                                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  className="h-8 w-[140px] shrink-0 text-sm"
                                  placeholder="Valeur…"
                                  value={cond.value}
                                  onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                                />
                              )
                            )}

                            <Button
                              variant="ghost"
                              size="icon"
                              className="ml-auto size-7 shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={() => removeCondition(cond.id)}
                            >
                              <IconX className="size-3.5" />
                            </Button>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Panel footer */}
                  <div className="border-t px-3 py-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addCondition}>
                      <IconPlus className="mr-1 size-3.5" />
                      Ajouter un filtre
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}

            {/* Group By */}
            {groupBy?.length ? (
              <Select
                value={groupId || "none"}
                onValueChange={(v) => setGroupId(v === "none" ? "" : v)}
              >
                <SelectTrigger size="sm" className="w-[180px]">
                  <IconChevronDown className="mr-1 size-4 text-muted-foreground" />
                  <SelectValue placeholder="Regrouper par" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun regroupement</SelectItem>
                  {groupBy.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          {/* CENTER: Search */}
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
                  placeholder={searchable.placeholder ?? "Rechercher…"}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onFocus={() => setSearchOpen(true)}
                />
                {searchOpen && searchInput && (
                  <button
                    className="rounded p-1 hover:bg-muted"
                    onClick={() => { setSearchInput(""); setSearch(""); focusSearchSafely() }}
                    aria-label="Effacer la recherche"
                  >
                    <IconX className="size-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* RIGHT: Delete + Import + Add */}
          <div className="ml-auto flex items-center gap-2">
            {onDeleteSelected && table.getFilteredSelectedRowModel().rows.length > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setOpenDelete(true)}>
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
        {/* ── End Toolbar ──────────────────────────────────────── */}

      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="relative px-2 lg:px-3">
        <div className="overflow-x-auto border-x">
          <Table className="w-full min-w-full">
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
                  return (
                    <TableRow>
                      <TableCell colSpan={composedColumns.length} className="h-auto p-0">
                        <EmptyState />
                      </TableCell>
                    </TableRow>
                  )
                }

                const renderTableRow = (row: (typeof rows)[number]) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(isRowClickable && "cursor-pointer")}
                    onClick={isRowClickable ? () => {
                      onRowClick?.(row.original)
                      if (renderRowDetail) setDetailRow(row.original)
                    } : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-nowrap">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )

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
                        const tableRow = rows.find((r) => r.id === id) ?? rows.find((r) => r.original === gr)
                        if (!tableRow) return null
                        return renderTableRow(tableRow)
                      })}
                    </React.Fragment>
                  ))
                }

                return rows.map(renderTableRow)
              })()}
            </TableBody>
          </Table>
        </div>

        {/* ── Pagination ──────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-3 px-2 lg:px-3">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} sur{" "}
            {table.getFilteredRowModel().rows.length} ligne(s) sélectionnée(s)
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Résultat par page :
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
                    <SelectItem key={ps} value={`${ps}`}>{ps}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button variant="outline" className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                <span className="sr-only">Première page</span>
                <IconChevronsLeft />
              </Button>
              <Button variant="outline" className="size-8" size="icon"
                onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                <span className="sr-only">Page précédente</span>
                <IconChevronLeft />
              </Button>
              <Button variant="outline" className="size-8" size="icon"
                onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                <span className="sr-only">Page suivante</span>
                <IconChevronRight />
              </Button>
              <Button variant="outline" className="hidden size-8 lg:flex" size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                <span className="sr-only">Dernière page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row detail Drawer ──────────────────────────────────── */}
      {renderRowDetail && (
        <Drawer open={!!detailRow} onOpenChange={(open) => { if (!open) setDetailRow(null) }}>
          <DrawerContent>
            <DrawerHeader className="gap-1">
              <DrawerTitle>
                {detailRow ? (renderRowDetailTitle?.(detailRow) ?? "Détails") : null}
              </DrawerTitle>
            </DrawerHeader>
            {detailRow && (
              <div className="overflow-y-auto px-4 py-2">
                {renderRowDetail(detailRow)}
              </div>
            )}
            <DrawerFooter>
              <Button variant="outline" onClick={() => setDetailRow(null)}>Fermer</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}

      {/* ── Delete confirmation ─────────────────────────────────── */}
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
            <AlertDialogAction onClick={() => {
              const selectedRows = table.getFilteredSelectedRowModel().rows.map((r) => r.original as T)
              setOpenDelete(false)
              onDeleteSelected?.(selectedRows)
              table.resetRowSelection()
            }}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
