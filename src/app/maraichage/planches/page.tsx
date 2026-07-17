"use client"

/**
 * Page Planches - Gestion des parcelles
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, LayoutGrid, Wand2, AlertTriangle, ListChecks } from "lucide-react"
import { AssistantDialog, AssistantButton } from "@/components/assistant"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { EditableSelectCell } from "@/components/planches/EditableSelectCell"
import { CompleterTerrainDialog } from "@/components/planches/CompleterTerrainDialog"
import { AppHeader, PageToolbar } from "@/components/shell/AppHeader"

// Type pour les planches
interface PlancheWithRelations {
  id: string
  nom: string
  largeur: number | null
  longueur: number | null
  surface: number | null
  ilot: string | null
  rotationId: string | null
  rotation: { id: string } | null
  type: string | null
  irrigation: string | null
  typeSol: string | null
  retentionEau: string | null
  _count: { cultures: number; fertilisations: number }
}

// Options pour les selects
const TYPES_SOL = [
  { value: 'Argileux', label: 'Argileux', icon: '🟤' },
  { value: 'Limoneux', label: 'Limoneux', icon: '🟫' },
  { value: 'Sableux', label: 'Sableux', icon: '🟡' },
  { value: 'Mixte', label: 'Mixte', icon: '🌈' },
]

const RETENTION_EAU = [
  { value: 'Faible', label: 'Faible', icon: '💧' },
  { value: 'Moyenne', label: 'Moyenne', icon: '💦' },
  { value: 'Élevée', label: 'Élevée', icon: '💙' },
]

// Fonction pour créer les colonnes (avec callback)
const createColumns = (onUpdate: () => void): ColumnDef<PlancheWithRelations>[] => [
  {
    accessorKey: "nom",
    header: "Planche",
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: "ilot",
    header: "Îlot",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "largeur",
    header: "Largeur (m)",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? val.toFixed(2) : "-"
    },
  },
  {
    accessorKey: "longueur",
    header: "Longueur (m)",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? val.toFixed(1) : "-"
    },
  },
  {
    accessorKey: "surface",
    header: "Surface (m²)",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? val.toFixed(1) : "-"
    },
  },
  {
    accessorKey: "rotation.id",
    header: "Rotation",
    cell: ({ row }) => row.original.rotation?.id || "-",
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "typeSol",
    header: "Sol",
    cell: ({ row }) => (
      <EditableSelectCell
        plancheId={row.original.nom}
        field="typeSol"
        value={row.original.typeSol}
        options={TYPES_SOL}
        placeholder="Définir"
        onUpdate={onUpdate}
      />
    ),
  },
  {
    accessorKey: "retentionEau",
    header: "Rétention",
    cell: ({ row }) => (
      <EditableSelectCell
        plancheId={row.original.nom}
        field="retentionEau"
        value={row.original.retentionEau}
        options={RETENTION_EAU}
        placeholder="Définir"
        onUpdate={onUpdate}
      />
    ),
  },
  {
    accessorKey: "_count.cultures",
    header: "Cultures",
    cell: ({ getValue }) => getValue() || 0,
  },
]

export default function PlanchesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<PlancheWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [showAssistant, setShowAssistant] = React.useState(false)
  // Bug #11 — modale de complétion en masse + chargement des rotations actives.
  const [showCompleter, setShowCompleter] = React.useState(false)
  const [rotations, setRotations] = React.useState<{ id: string; active: boolean }[]>([])

  // Charger les données
  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/planches?pageSize=200")
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les planches",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  // Créer colonnes avec callback
  const columns = React.useMemo(() => createColumns(fetchData), [fetchData])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  // Bug #11 — Charger la liste des rotations pour les proposer dans la modale.
  React.useEffect(() => {
    fetch("/api/rotations?pageSize=200")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.data) {
          setRotations(res.data.map((r: { id: string; active: boolean }) => ({ id: r.id, active: r.active })))
        }
      })
      .catch(() => {})
  }, [])

  // Handlers
  const handleAdd = () => {
    router.push("/planches/new")
  }

  const handleRowClick = (row: PlancheWithRelations) => {
    router.push(`/planches/${encodeURIComponent(row.nom)}`)
  }

  const handleEdit = (row: PlancheWithRelations) => {
    router.push(`/planches/${encodeURIComponent(row.nom)}`)
  }

  const handleDelete = async (row: PlancheWithRelations) => {
    if (row._count.cultures > 0) {
      toast({
        variant: "destructive",
        title: "Impossible de supprimer",
        description: `${row.nom} a ${row._count.cultures} culture(s) associée(s)`,
      })
      return
    }

    if (!(await confirmDialog(`Supprimer la planche "${row.nom}" ?`))) return

    try {
      const response = await fetch(`/api/planches/${encodeURIComponent(row.nom)}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Erreur lors de la suppression")
      toast({
        title: "Planche supprimée",
        description: `La planche "${row.nom}" a été supprimée`,
      })
      fetchData()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer la planche",
      })
    }
  }

  // Calcul des stats
  const totalSurface = data.reduce((sum, p) => sum + (p.surface || 0), 0)

  // Bug #11 — Taux de complétion : champs critiques pour les modules dépendants
  // (Rotations / Irrigation / ITPs sol-spécifique). On considère une planche
  // "complète" si elle a type + typeSol + retentionEau renseignés.
  const totalPlanches = data.length
  const planchesCompletes = data.filter((p) => p.type && p.typeSol && p.retentionEau).length
  const tauxCompletion = totalPlanches > 0 ? (planchesCompletes / totalPlanches) * 100 : 100
  const showOnboardingBanner = totalPlanches > 0 && tauxCompletion < 50

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Assistant Maraîcher */}
      <AssistantDialog open={showAssistant} onOpenChange={setShowAssistant} />

      <AppHeader current="maraichage" />
      <PageToolbar>
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Accueil
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-amber-600" />
            <h1 className="text-xl font-bold">Planches</h1>
          </div>
        </div>
        {/* Responsive 360px — bouton + assistant + stats ne tiennent pas sur une ligne */}
        <div className="flex items-center gap-4 flex-wrap">
          {totalPlanches > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowCompleter(true)}>
              <ListChecks className="h-4 w-4 mr-2" />
              Compléter en masse
            </Button>
          )}
          <AssistantButton onClick={() => setShowAssistant(true)} />
          <div className="text-sm text-muted-foreground">
            {data.length} planches • {totalSurface.toFixed(1)} m² total
          </div>
        </div>
      </PageToolbar>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Bug #11 — Banner onboarding terrain incomplet */}
        {showOnboardingBanner && (
          <div className="mb-4 p-4 bg-amber-50 rounded-lg border border-amber-300 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1 text-sm text-amber-900">
              <p className="font-medium">
                Votre terrain est incomplet ({planchesCompletes}/{totalPlanches} planches renseignées)
              </p>
              <p className="mt-1 text-amber-800">
                Sans Type / Sol / Rétention, les rotations, les recommandations d'irrigation et
                les ITPs sol-spécifiques ne peuvent pas fonctionner correctement.
              </p>
              <Button
                size="sm"
                className="mt-2"
                onClick={() => setShowCompleter(true)}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Compléter toutes les planches en une fois
              </Button>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          showPagination={false}
          onAdd={handleAdd}
          onRefresh={fetchData}
          onRowClick={handleRowClick}
          onRowEdit={handleEdit}
          onRowDelete={handleDelete}
          searchPlaceholder="Rechercher une planche..."
          emptyMessage="Aucune planche trouvée. Cliquez sur Ajouter pour créer la première."
        />
      </main>

      {/* Bug #11 — Modale de complétion en masse */}
      <CompleterTerrainDialog
        open={showCompleter}
        onOpenChange={setShowCompleter}
        planches={data.map((p) => ({
          id: p.id,
          nom: p.nom,
          ilot: p.ilot,
          type: p.type,
          typeSol: p.typeSol,
          retentionEau: p.retentionEau,
          rotationId: p.rotationId,
        }))}
        rotations={rotations}
        onComplete={fetchData}
      />
    </div>
  )
}
