"use client"

import * as React from "react"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, MapPin, Pencil, Trash2, Plus, Map as MapIcon } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ParcelleFormDialog } from "@/components/parcelles/ParcelleFormDialog"
import {
  COUCHE_COLORS,
  COUCHE_LABELS,
  formatSurface,
  formatEntites,
  type ParcelleWithRelations,
} from "@/components/parcelles/parcelle-constants"

const createColumns = (): ColumnDef<ParcelleWithRelations>[] => [
  {
    accessorKey: "nom",
    header: "Nom",
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "surface",
    header: "Surface",
    cell: ({ getValue }) => formatSurface(getValue() as number | null),
  },
  {
    id: "couches",
    header: "Couches",
    cell: ({ row }) => {
      const couches = row.original.couches
      if (!couches?.length) return <span className="text-muted-foreground">-</span>
      return (
        <div className="flex flex-wrap gap-1">
          {couches.map((c) => (
            <Badge key={c} variant="secondary" className={`text-xs ${COUCHE_COLORS[c] || ""}`}>
              {COUCHE_LABELS[c] || c}
            </Badge>
          ))}
        </div>
      )
    },
  },
  {
    id: "entites",
    header: "Entités rattachées",
    cell: ({ row }) => {
      const text = formatEntites(row.original._count)
      return text
        ? <span className="text-sm">{text}</span>
        : <span className="text-muted-foreground">-</span>
    },
  },
]

function ParcelleCard({
  parcelle,
  onEdit,
  onDelete,
}: {
  parcelle: ParcelleWithRelations
  onEdit: (p: ParcelleWithRelations) => void
  onDelete: (p: ParcelleWithRelations) => void
}) {
  const entites = formatEntites(parcelle._count)
  return (
    <div className="bg-white rounded-lg border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-base">{parcelle.nom}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onEdit(parcelle)}>
            <Pencil className="h-4 w-4 text-blue-600" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onDelete(parcelle)}>
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{formatSurface(parcelle.surface)}</span>
        {entites && <span>{entites}</span>}
      </div>
      {parcelle.couches?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {parcelle.couches.map((c) => (
            <Badge key={c} variant="secondary" className={`text-xs ${COUCHE_COLORS[c] || ""}`}>
              {COUCHE_LABELS[c] || c}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ParcellesPage() {
  const { toast } = useToast()
  const [data, setData] = React.useState<ParcelleWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingParcelle, setEditingParcelle] = React.useState<ParcelleWithRelations | null>(null)
  const [deletingParcelle, setDeletingParcelle] = React.useState<ParcelleWithRelations | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/parcelles")
      if (!res.ok) throw new Error("Erreur chargement")
      const result = await res.json()
      setData(Array.isArray(result) ? result : [])
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les parcelles" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const columns = React.useMemo(() => createColumns(), [])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAdd = () => {
    setEditingParcelle(null)
    setDialogOpen(true)
  }

  const handleEdit = (row: ParcelleWithRelations) => {
    setEditingParcelle(row)
    setDialogOpen(true)
  }

  const handleDelete = (row: ParcelleWithRelations) => {
    setDeletingParcelle(row)
  }

  const confirmDelete = async () => {
    if (!deletingParcelle) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/parcelles/${deletingParcelle.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Erreur suppression")
      toast({ title: "Parcelle supprimée", description: `"${deletingParcelle.nom}" a été supprimée` })
      setDeletingParcelle(null)
      fetchData()
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer la parcelle" })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDialogClose = (saved?: boolean) => {
    setDialogOpen(false)
    setEditingParcelle(null)
    if (saved) fetchData()
  }

  const totalSurface = data.reduce((sum, p) => sum + (p.surface || 0), 0)

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />

      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Accueil
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <MapPin className="h-6 w-6 text-purple-600" />
              <h1 className="text-xl font-bold">Parcelles</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/jardin/carte">
              <Button variant="outline" size="sm" className="text-purple-700 border-purple-300 hover:bg-purple-50">
                <MapIcon className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Carte</span>
              </Button>
            </Link>
            <span className="text-sm text-muted-foreground">
              {data.length} parcelle{data.length > 1 ? "s" : ""} {totalSurface > 0 && `\u2022 ${totalSurface.toFixed(2)} ha total`}
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Desktop: DataTable */}
        <div className="hidden md:block">
          <DataTable
            columns={columns}
            data={data}
            isLoading={isLoading}
            showPagination={false}
            onAdd={handleAdd}
            onRefresh={fetchData}
            onRowEdit={handleEdit}
            onRowDelete={handleDelete}
            searchPlaceholder="Rechercher une parcelle..."
            emptyMessage="Aucune parcelle trouvée. Cliquez sur Ajouter pour créer la première."
          />
        </div>

        {/* Mobile: Cards */}
        <div className="md:hidden space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{data.length} resultat(s)</span>
            <Button size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter
            </Button>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg border p-4 h-24 animate-pulse" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Aucune parcelle trouvée. Cliquez sur Ajouter pour créer la première.
            </div>
          ) : (
            data.map((p) => (
              <ParcelleCard key={p.id} parcelle={p} onEdit={handleEdit} onDelete={handleDelete} />
            ))
          )}
        </div>
      </main>

      <ParcelleFormDialog
        open={dialogOpen}
        parcelle={editingParcelle}
        onClose={handleDialogClose}
      />

      {/* Dialog de confirmation de suppression */}
      <Dialog open={!!deletingParcelle} onOpenChange={(v) => !v && setDeletingParcelle(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer la parcelle</DialogTitle>
            <DialogDescription>
              Supprimer la parcelle &laquo;{deletingParcelle?.nom}&raquo; ?
              {deletingParcelle && (deletingParcelle._count.planches + deletingParcelle._count.arbres + deletingParcelle._count.lotsAnimaux) > 0 && (
                <span className="block mt-2 text-amber-600 font-medium">
                  Attention : {deletingParcelle._count.planches + deletingParcelle._count.arbres + deletingParcelle._count.lotsAnimaux} entité(s) rattachée(s) seront détachées.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeletingParcelle(null)} disabled={isDeleting}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? "Suppression..." : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
