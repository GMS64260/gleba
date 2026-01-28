"use client"

/**
 * DataTable générique
 * Basé sur TanStack Table avec toutes les features du PotaWidget Qt
 */

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowUpDown,
  ChevronDown,
  MoreHorizontal,
  Plus,
  Search,
  Download,
  RefreshCw,
  Pencil,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  // Pagination
  pageCount?: number
  pageIndex?: number
  pageSize?: number
  onPaginationChange?: (pageIndex: number, pageSize: number) => void
  // Actions
  onAdd?: () => void
  onRefresh?: () => void
  onExport?: () => void
  onRowClick?: (row: TData) => void
  onRowEdit?: (row: TData) => void
  onRowDelete?: (row: TData) => void
  // Personnalisation
  title?: string
  searchPlaceholder?: string
  emptyMessage?: string
  showColumnToggle?: boolean
  showSearch?: boolean
  showPagination?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  pageCount,
  pageIndex = 0,
  pageSize = 50,
  onPaginationChange,
  onAdd,
  onRefresh,
  onExport,
  onRowClick,
  onRowEdit,
  onRowDelete,
  title,
  searchPlaceholder = "Rechercher...",
  emptyMessage = "Aucun résultat.",
  showColumnToggle = true,
  showSearch = true,
  showPagination = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState("")

  // Ajouter une colonne d'actions si des handlers sont fournis
  const columnsWithActions = React.useMemo(() => {
    if (!onRowEdit && !onRowDelete) return columns

    const actionsColumn: ColumnDef<TData, TValue> = {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {onRowEdit && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-blue-100 hover:text-blue-600"
                onClick={() => onRowEdit(row.original)}
                title="Modifier"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onRowDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                onClick={() => onRowDelete(row.original)}
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )
      },
      enableSorting: false,
      enableHiding: false,
    }

    return [...columns, actionsColumn]
  }, [columns, onRowEdit, onRowDelete])

  const table = useReactTable({
    data,
    columns: columnsWithActions,
    pageCount,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: !!onPaginationChange,
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter ?? ""}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-8 w-[250px]"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
          {showColumnToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Colonnes
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => {
                    return (
                      <DropdownMenuCheckboxItem
                        key={column.id}
                        className="capitalize"
                        checked={column.getIsVisible()}
                        onCheckedChange={(value) => column.toggleVisibility(!!value)}
                      >
                        {column.id}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onAdd && (
            <Button size="sm" onClick={onAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div
                        className={
                          header.column.getCanSort()
                            ? "flex items-center gap-1 cursor-pointer select-none"
                            : ""
                        }
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() && (
                          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton loading
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columnsWithActions.length}
                  className="h-24 text-center"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length > 0 && (
              <span>
                {table.getFilteredSelectedRowModel().rows.length} sur{" "}
              </span>
            )}
            {table.getFilteredRowModel().rows.length} résultat(s)
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                table.previousPage()
                onPaginationChange?.(table.getState().pagination.pageIndex - 1, pageSize)
              }}
              disabled={!table.getCanPreviousPage()}
            >
              Précédent
            </Button>
            <span className="text-sm">
              Page {table.getState().pagination.pageIndex + 1} sur{" "}
              {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                table.nextPage()
                onPaginationChange?.(table.getState().pagination.pageIndex + 1, pageSize)
              }}
              disabled={!table.getCanNextPage()}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper pour créer une colonne avec header triable
export function createSortableColumn<TData>(
  accessorKey: string,
  header: string,
  options?: {
    cell?: (value: unknown) => React.ReactNode
  }
): ColumnDef<TData> {
  return {
    accessorKey,
    header,
    cell: options?.cell
      ? ({ getValue }) => options.cell!(getValue())
      : ({ getValue }) => getValue() as React.ReactNode,
  }
}
