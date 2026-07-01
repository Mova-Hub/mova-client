// src/components/data-table.tsx
"use client"

import * as React from "react"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DetailPanel } from "@/components/ui/detail-panel"
import type { DetailPanelWidth } from "@/components/ui/detail-panel"
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
  /** @deprecated kept for API compatibility */
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
  { value: "eq",           label: "est",             needsValue: true  },
  { value: "neq",          label: "n'est pas",       needsValue: true  },
  { value: "contains",     label: "contient",        needsValue: true  },
  { value: "not_contains", label: "ne contient pas", needsValue: true  },
  { value: "empty",        label: "est vide",        needsValue: false },
  { value: "not_empty",    label: "n'est pas vide",  needsValue: false },
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
  /** Adds a built-in "Supprimer" item with confirmation dialog to the actions menu */
  onDeleteRow?: (row: T) => Promise<void> | void
  /** Label shown in the single-row delete confirmation: Supprimer « [label] » ? */
  getDeleteRowLabel?: (row: T) => string
  onDeleteSelected?: (rows: T[]) => void
  loading?: boolean
  rowCount?: number
  pagination?: { pageIndex: number; pageSize: number }
  onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void
  onRowClick?: (row: T) => void
  /** Right-side detail panel triggered by row click */
  renderRowDetail?: (row: T) => React.ReactNode
  renderRowDetailTitle?: (row: T) => React.ReactNode
  renderRowDetailDescription?: (row: T) => React.ReactNode
  rowDetailPanelWidth?: DetailPanelWidth
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
  onDeleteRow,
  getDeleteRowLabel,
  onDeleteSelected,
  loading,
  onRowClick,
  renderRowDetail,
  renderRowDetailTitle,
  renderRowDetailDescription,
  rowDetailPanelWidth = "xl",
}: DataTableProps<T>) {
  const ALL_TOKEN = "__ALL__"

  const [data, setData] = React.useState<T[]>(() => externalData)
  React.useEffect(() => setData(externalData), [externalData])

  /* ----------------------------- Table state ------------------------------ */
  const [openDeleteSelected, setOpenDeleteSelected] = React.useState(false)
  const [rowToDelete, setRowToDelete] = React.useState<T | null>(null)
  const [rowSelection, setRowSelection] = React.useState({})
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  /* ------------------------------ Row detail ------------------------------ */
  const [detailRow, setDetailRow] = React.useState<T | null>(null)
  const isRowClickable = !!(renderRowDetail || onRowClick)

  /* ------------------------------- Search --------------------------------- */
  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")

  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 180)
    return () => clearTimeout(t)
  }, [searchInput])

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

  function resetAll() {
    setSearchInput("")
    setSearch("")
    clearAllFilters()
  }

  /* ------------------------- Filtered rows -------------------------------- */
  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return data.filter((row) => {
      const passSearch =
        !searchable || !q
          ? true
          : searchable.fields.some((k) => {
              const val = getNestedValue(row, String(k))
              return String(val ?? "").toLowerCase().includes(q)
            })

      const passFilters =
        conditions.length === 0
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
    const keys = Object.keys(map).sort(
      currentGroup.sortGroups ?? ((a, b) => a.localeCompare(b))
    )
    return keys.reduce((acc, k) => { acc[k] = map[k]; return acc }, {} as Record<string, T[]>)
  }, [filteredRows, currentGroup])

  /* ------------------------------ Columns --------------------------------- */
  const hasActionsColumn = !!(renderRowActions || onDeleteRow)

  const composedColumns = React.useMemo<ColumnDef<T>[]>(() => {
    const cols: ColumnDef<T>[] = []

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

    if (hasActionsColumn) {
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
              <DropdownMenuContent align="end" className="w-44">
                {renderRowActions?.(row.original)}
                {onDeleteRow && renderRowActions && <DropdownMenuSeparator />}
                {onDeleteRow && (
                  <DropdownMenuItem
                    className="text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                    onClick={() => setRowToDelete(row.original)}
                  >
                    <IconTrash className="mr-2 size-4" />
                    Supprimer
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
        size: 56,
      })
    }

    return cols
  }, [columns, renderRowActions, onDeleteRow, hasActionsColumn])

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
          <div className="w-full max-w-md p-6 mx-auto text-center border rounded-lg bg-muted/30">
            <div className="grid w-10 h-10 mx-auto mb-3 rounded-full shadow place-items-center bg-background ring-1 ring-border">
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
        <div className="w-full max-w-md p-6 mx-auto text-center border rounded-lg bg-muted/20">
          <div className="grid w-10 h-10 mx-auto mb-3 rounded-full shadow place-items-center bg-background ring-1 ring-border">
            {hasActiveFilters ? (
              <IconSearch className="size-5 text-muted-foreground" />
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
              : "Lorsque des données seront disponibles, elles s'afficheront ici."}
          </p>
          {hasActiveFilters && (
            <div className="flex justify-center mt-4">
              <Button size="sm" variant="secondary" onClick={resetAll}>
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
    <div className="flex flex-col justify-start w-full -mx-4 lg:-mx-6">
      <div className="px-4 pt-1 lg:px-6">

        {/* ── Toolbar ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-3">

          {/* LEFT: Filter + Group By */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <span className="text-sm font-medium">Filtres</span>
                    {conditions.length > 0 && (
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={clearAllFilters}>
                        <IconRefresh className="mr-1 size-3" />
                        Effacer tout
                      </Button>
                    )}
                  </div>
                  <div className="p-3 space-y-2 overflow-y-auto max-h-72">
                    {conditions.length === 0 ? (
                      <p className="py-6 text-sm text-center text-muted-foreground">
                        Aucun filtre actif. Cliquez sur « Ajouter un filtre » pour commencer.
                      </p>
                    ) : (
                      conditions.map((cond) => {
                        const fieldConfig = filters.find((f) => f.id === cond.field)
                        const isEnumField = (fieldConfig?.options?.length ?? 0) > 0
                        const availableOps = isEnumField
                          ? OPERATORS.filter((op) =>
                              ["eq", "neq", "empty", "not_empty"].includes(op.value)
                            )
                          : OPERATORS
                        const needsValue =
                          OPERATORS.find((op) => op.value === cond.operator)?.needsValue ?? true

                        return (
                          <div key={cond.id} className="flex items-center gap-2">
                            <Select
                              value={cond.field}
                              onValueChange={(v) =>
                                updateCondition(cond.id, { field: v, value: "", operator: "eq" })
                              }
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
                            <Select
                              value={cond.operator}
                              onValueChange={(v) =>
                                updateCondition(cond.id, { operator: v as FilterOperator })
                              }
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
                            {needsValue &&
                              (isEnumField ? (
                                <Select
                                  value={cond.value || ALL_TOKEN}
                                  onValueChange={(v) =>
                                    updateCondition(cond.id, { value: v === ALL_TOKEN ? "" : v })
                                  }
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
                                  onChange={(e) =>
                                    updateCondition(cond.id, { value: e.target.value })
                                  }
                                />
                              ))}
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
                  <div className="px-3 py-2 border-t">
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={addCondition}>
                      <IconPlus className="mr-1 size-3.5" />
                      Ajouter un filtre
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ) : null}

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

          {/* CENTER: Always-visible search */}
          {searchable && (
            <div className="flex items-center flex-1 min-w-0 mx-1">
              <div className="relative w-full max-w-sm">
                <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  className="h-8 pl-8 pr-8 text-sm"
                  placeholder={searchable.placeholder ?? "Rechercher…"}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                {searchInput && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => { setSearchInput(""); setSearch("") }}
                    aria-label="Effacer la recherche"
                  >
                    <IconX className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* RIGHT: Actions */}
          <div className={cn("flex items-center gap-2 shrink-0", !searchable && "ml-auto")}>
            {onDeleteSelected && table.getFilteredSelectedRowModel().rows.length > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setOpenDeleteSelected(true)}>
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
        {/* ── End Toolbar ──────────────────────────────────────────── */}

      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="relative px-2 lg:px-3">
        <div className="overflow-x-auto border-x">
          <Table className="w-full min-w-full">
            <TableHeader className="sticky top-0 z-10 bg-muted">
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
                    onClick={
                      isRowClickable
                        ? () => {
                            onRowClick?.(row.original)
                            if (renderRowDetail) setDetailRow(row.original)
                          }
                        : undefined
                    }
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
                          {label}{" "}
                          <span className="text-muted-foreground">({groupRows.length})</span>
                        </TableCell>
                      </TableRow>
                      {groupRows.map((gr, idx) => {
                        const id =
                          getRowId?.(gr, idx) ?? String(filteredRows.indexOf(gr))
                        const tableRow =
                          rows.find((r) => r.id === id) ??
                          rows.find((r) => r.original === gr)
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

        {/* ── Pagination ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-2 mt-3 lg:px-3">
          <div className="flex-1 hidden text-sm text-muted-foreground lg:flex">
            {table.getFilteredSelectedRowModel().rows.length} sur{" "}
            {table.getFilteredRowModel().rows.length} ligne(s) sélectionnée(s)
          </div>
          <div className="flex items-center w-full gap-8 lg:w-fit">
            <div className="items-center hidden gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Résultats par page :
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
            <div className="flex items-center justify-center text-sm font-medium w-fit">
              Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}
            </div>
            <div className="flex items-center gap-2 ml-auto lg:ml-0">
              <Button
                variant="outline"
                className="hidden w-8 h-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Première page</span>
                <IconChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Page précédente</span>
                <IconChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Page suivante</span>
                <IconChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Dernière page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Row detail panel (right-side Sheet) ──────────────────────── */}
      {renderRowDetail && (
        <DetailPanel
          open={!!detailRow}
          onOpenChange={(open) => { if (!open) setDetailRow(null) }}
          width={rowDetailPanelWidth}
          title={detailRow ? renderRowDetailTitle?.(detailRow) : undefined}
          description={detailRow ? renderRowDetailDescription?.(detailRow) : undefined}
          footer={
            <Button variant="outline" className="w-full" onClick={() => setDetailRow(null)}>
              Fermer
            </Button>
          }
        >
          {detailRow && renderRowDetail(detailRow)}
        </DetailPanel>
      )}

      {/* ── Bulk delete confirmation ─────────────────────────────────── */}
      <AlertDialog open={openDeleteSelected} onOpenChange={setOpenDeleteSelected}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la sélection ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.{" "}
              {table.getFilteredSelectedRowModel().rows.length} élément(s) seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="text-white bg-destructive hover:bg-destructive/90"
              onClick={() => {
                const selected = table
                  .getFilteredSelectedRowModel()
                  .rows.map((r) => r.original as T)
                setOpenDeleteSelected(false)
                onDeleteSelected?.(selected)
                table.resetRowSelection()
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Single-row delete confirmation ───────────────────────────── */}
      <AlertDialog
        open={!!rowToDelete}
        onOpenChange={(open) => { if (!open) setRowToDelete(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {rowToDelete && getDeleteRowLabel
                ? `Supprimer « ${getDeleteRowLabel(rowToDelete)} » ?`
                : "Supprimer cet élément ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible et ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRowToDelete(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="text-white bg-destructive hover:bg-destructive/90"
              onClick={async () => {
                if (!rowToDelete) return
                const target = rowToDelete
                setRowToDelete(null)
                await onDeleteRow?.(target)
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
