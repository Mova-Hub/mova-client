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
  IconLoader2,
  IconMoodConfuzed,
  IconSearch as IconSearchOutline,
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

import { cn } from "@/lib/utils"

/* ------------------------------- Types ------------------------------ */

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

type ViewMode = "list" | "grid"

export type DataTableProps<T extends object> = {
  data: T[]
  columns: ColumnDef<T>[]
  getRowId?: (row: T, index: number) => string
  searchable?: { placeholder?: string; fields: string[] } // Changed to string[] for nested paths
  filters?: FilterConfig<T>[]
  groupBy?: GroupByConfig<T>[]
  initialView?: ViewMode
  onAdd?: () => void
  addLabel?: string
  onImport?: () => void
  importLabel?: string
  pageSizeOptions?: number[]
  renderRowActions?: (row: T) => React.ReactNode
  onDeleteSelected?: (rows: T[]) => void
  loading?: boolean
}

/* -------------------------- Utility Helpers ------------------------- */

const ALL_TOKEN = "__ALL__"

/** Access nested values like "passenger.name" */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj)
}

/* -------------------------------------------------------------------------- */
/* Sub-Components                               */
/* -------------------------------------------------------------------------- */

/** * MOVED OUTSIDE to prevent focus loss and recreation on every render.
 */

function EmptyState({ 
  loading, 
  hasActiveFilters, 
  onReset 
}: { 
  loading?: boolean; 
  hasActiveFilters: boolean; 
  onReset: () => void 
}) {
  if (loading) {
    return (
      <div className="py-16">
        <div className="mx-auto w-full max-w-md rounded-lg border bg-muted/30 p-6 text-center">
          <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-background shadow ring-1 ring-border">
            <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
          <div className="text-base font-medium">Chargement des données…</div>
          <p className="mt-1 text-sm text-muted-foreground">Merci de patienter...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="py-16">
      <div className="mx-auto w-full max-w-md rounded-lg border bg-muted/20 p-6 text-center">
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-background shadow ring-1 ring-border">
          {hasActiveFilters ? <IconSearchOutline className="size-5 text-muted-foreground" /> : <IconMoodConfuzed className="size-5 text-muted-foreground" />}
        </div>
        <div className="text-base font-semibold">{hasActiveFilters ? "Aucun résultat trouvé" : "Aucun élément à afficher"}</div>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasActiveFilters ? "Ajustez votre recherche ou vos filtres." : "Lorsque des données seront disponibles, elles s’afficheront ici."}
        </p>
        {hasActiveFilters && (
          <div className="mt-4 flex justify-center">
            <Button size="sm" variant="secondary" onClick={onReset}>Réinitialiser</Button>
          </div>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Main Component                              */
/* -------------------------------------------------------------------------- */

export function DataTable<T extends object>({
  data: externalData,
  columns,
  getRowId,
  searchable,
  filters,
  groupBy,
  onAdd,
  addLabel = "Add",
  onImport,
  importLabel = "Import",
  pageSizeOptions = [10, 20, 30, 40, 50],
  renderRowActions,
  onDeleteSelected,
  loading,
}: DataTableProps<T>) {
  const [rowSelection, setRowSelection] = React.useState({})
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  /* ------------------------------ Search & Filter State ------------------------------- */
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchInput, setSearchInput] = React.useState("")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filterSelections, setFilterSelections] = React.useState<Record<string, string>>(() => 
    (filters ?? []).reduce((acc, f) => { if (f.defaultValue) acc[f.id] = f.defaultValue; return acc }, {} as Record<string, string>)
  )

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 200)
    return () => clearTimeout(t)
  }, [searchInput])

  const clearAllFilters = () => {
    setFilterSelections({})
    setSearchInput("")
    setSearchQuery("")
  }

  /* ------------------------- Professional Search Logic ------------------------ */
  const filteredRows = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    
    return externalData.filter((row) => {
      // 1. Search Logic
      const passSearch = !searchable || !q
        ? true
        : searchable.fields.some((field) => {
            const val = getNestedValue(row, field)
            return String(val ?? "").toLowerCase().includes(q)
          })

      // 2. Filter Logic
      const passFilters = !filters?.length
        ? true
        : filters.every((f) => {
            const selected = filterSelections[f.id] || ""
            if (!selected) return true
            return f.accessor(row) === selected
          })

      return passSearch && passFilters
    })
  }, [externalData, searchQuery, searchable, filters, filterSelections])

  /* -------------------------------- Grouping -------------------------------- */
  const [groupId, setGroupId] = React.useState<string>("")
  const currentGroup = groupBy?.find((g) => g.id === groupId)

  const groupedData = React.useMemo(() => {
    if (!currentGroup) return null
    const groups: Record<string, T[]> = {}
    filteredRows.forEach(row => {
      const key = currentGroup.accessor(row) || "—"
      if (!groups[key]) groups[key] = []
      groups[key].push(row)
    })
    return groups
  }, [filteredRows, currentGroup])

  /* ------------------------------ Columns compose ----------------------------- */
  const composedColumns = React.useMemo<ColumnDef<T>[]>(() => {
    const cols: ColumnDef<T>[] = [
      {
        id: "_select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />,
        size: 40,
      },
      ...columns,
    ]

    if (renderRowActions) {
      cols.push({
        id: "_actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8"><IconDotsVertical size={16}/></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {renderRowActions(row.original)}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 40,
      })
    }
    return cols
  }, [columns, renderRowActions])

  const table = useReactTable({
    data: filteredRows,
    columns: composedColumns,
    state: { sorting, rowSelection, pagination },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row, index) => getRowId?.(row, index) ?? String(index),
  })

  const [openDelete, setOpenDelete] = React.useState(false)

  return (
    <div className="w-full space-y-4">
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div className="flex flex-wrap items-center gap-2">
          {filters?.map((f) => (
            <Select
              key={f.id}
              value={filterSelections[f.id] || ALL_TOKEN}
              onValueChange={(v) => setFilterSelections(prev => ({ ...prev, [f.id]: v === ALL_TOKEN ? "" : v }))}
            >
              <SelectTrigger className="w-[180px]" size="sm">
                <IconFilter className="mr-2 size-4 text-muted-foreground" />
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TOKEN}>Tous {f.label}</SelectItem>
                {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ))}

          {groupBy?.length && (
             <Select value={groupId || ALL_TOKEN} onValueChange={(v) => setGroupId(v === ALL_TOKEN ? "" : v)}>
               <SelectTrigger className="w-[150px]" size="sm">
                 <IconChevronDown className="mr-2 size-4 text-muted-foreground" />
                 <SelectValue placeholder="Grouper par" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value={ALL_TOKEN}>Pas de groupe</SelectItem>
                 {groupBy.map(g => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
               </SelectContent>
             </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          {searchable && (
            <div className={cn("flex items-center rounded-md border bg-background px-2 transition-all", searchOpen ? "ring-1 ring-ring" : "border-transparent")}>
              <IconSearch size={18} className="text-muted-foreground" />
              <Input
                placeholder={searchable.placeholder}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => !searchInput && setSearchOpen(false)}
                className="h-9 border-none bg-transparent focus-visible:ring-0 w-40 lg:w-64"
              />
              {searchInput && (
                <button onClick={() => { setSearchInput(""); setSearchQuery("") }}>
                  <IconX size={14} className="text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          )}

          {onDeleteSelected && table.getFilteredSelectedRowModel().rows.length > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setOpenDelete(true)}>
              <IconTrash className="mr-2 size-4" /> Supprimer ({table.getFilteredSelectedRowModel().rows.length})
            </Button>
          )}
          {onImport && <Button variant="outline" size="sm" onClick={onImport}><IconUpload className="mr-2 size-4" /> {importLabel}</Button>}
          {onAdd && <Button size="sm" onClick={onAdd}><IconPlus className="mr-2 size-4" /> {addLabel}</Button>}
        </div>
      </div>

      {/* TABLE */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              currentGroup && groupedData ? (
                Object.entries(groupedData).map(([label, groupRows]) => (
                  <React.Fragment key={label}>
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell colSpan={composedColumns.length}>{label} ({groupRows.length})</TableCell>
                    </TableRow>
                    {groupRows.map((row, idx) => {
                       const tableRow = table.getRowModel().rows.find(r => r.original === row)
                       return tableRow ? (
                        <TableRow key={tableRow.id}>
                          {tableRow.getVisibleCells().map(cell => (
                            <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                          ))}
                        </TableRow>
                       ) : null
                    })}
                  </React.Fragment>
                ))
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>{row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}</TableRow>
                ))
              )
            ) : (
              <TableRow>
                <TableCell colSpan={composedColumns.length} className="h-24 text-center">
                  <EmptyState loading={loading} hasActiveFilters={!!searchQuery || Object.values(filterSelections).some(Boolean)} onReset={clearAllFilters} />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* PAGINATION */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} sur {table.getFilteredRowModel().rows.length} ligne(s) sélectionnée(s).
        </div>
        <div className="flex items-center gap-6 lg:gap-8">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">Lignes par page</p>
            <Select value={`${table.getState().pagination.pageSize}`} onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[70px]"><SelectValue placeholder={table.getState().pagination.pageSize} /></SelectTrigger>
              <SelectContent side="top">{pageSizeOptions.map((ps) => <SelectItem key={ps} value={`${ps}`}>{ps}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-center text-sm font-medium">Page {table.getState().pagination.pageIndex + 1} sur {table.getPageCount()}</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="size-8 p-0" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><IconChevronLeft size={16} /></Button>
            <Button variant="outline" className="size-8 p-0" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><IconChevronRight size={16} /></Button>
          </div>
        </div>
      </div>

      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la sélection ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              onDeleteSelected?.(table.getFilteredSelectedRowModel().rows.map(r => r.original))
              table.resetRowSelection()
              setOpenDelete(false)
            }}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}