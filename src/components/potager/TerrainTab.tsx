"use client"

/**
 * Onglet Terrain - Planches + Rotations + Associations en sous-onglets
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import {
  LayoutGrid,
  RefreshCw,
  Heart,
  CheckCircle2,
  XCircle,
  Users,
} from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { EditableSelectCell } from "@/components/planches/EditableSelectCell"

// ============================================================
// Types
// ============================================================

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

interface RotationDetail {
  id: number
  annee: number
  itpId: string | null
  itp: {
    id: string
    espece: { id: string; couleur: string | null } | null
  } | null
}

interface RotationWithRelations {
  id: string
  active: boolean
  nbAnnees: number | null
  notes: string | null
  details: RotationDetail[]
  _count: { planches: number }
}

interface AssociationWithRelations {
  id: string
  nom: string
  description: string | null
  notes: string | null
  details: {
    id: number
    especeId: string | null
    familleId: string | null
    groupe: string | null
    requise: boolean
    espece: { id: string; couleur: string | null } | null
    famille: { id: string; couleur: string | null } | null
  }[]
}

// ============================================================
// Options
// ============================================================

const TYPES_SOL = [
  { value: "Argileux", label: "Argileux", icon: "" },
  { value: "Limoneux", label: "Limoneux", icon: "" },
  { value: "Sableux", label: "Sableux", icon: "" },
  { value: "Mixte", label: "Mixte", icon: "" },
]

const RETENTION_EAU = [
  { value: "Faible", label: "Faible", icon: "" },
  { value: "Moyenne", label: "Moyenne", icon: "" },
  { value: "Elevee", label: "Elevee", icon: "" },
]

// ============================================================
// Composant principal
// ============================================================

export function TerrainTab() {
  return (
    <Tabs defaultValue="planches" className="space-y-4">
      <TabsList>
        <TabsTrigger value="planches" className="flex items-center gap-1.5">
          <LayoutGrid className="h-4 w-4" />
          Planches
        </TabsTrigger>
        <TabsTrigger value="rotations" className="flex items-center gap-1.5">
          <RefreshCw className="h-4 w-4" />
          Rotations
        </TabsTrigger>
        <TabsTrigger value="associations" className="flex items-center gap-1.5">
          <Heart className="h-4 w-4" />
          Associations
        </TabsTrigger>
      </TabsList>

      <TabsContent value="planches">
        <PlanchesSubTab />
      </TabsContent>
      <TabsContent value="rotations">
        <RotationsSubTab />
      </TabsContent>
      <TabsContent value="associations">
        <AssociationsSubTab />
      </TabsContent>
    </Tabs>
  )
}

// ============================================================
// Planches
// ============================================================

function PlanchesSubTab() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<PlancheWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/planches?pageSize=200")
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      setData(result.data)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les planches" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  const columns = React.useMemo(
    (): ColumnDef<PlancheWithRelations>[] => [
      {
        accessorKey: "nom",
        header: "Planche",
        cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
      },
      { accessorKey: "ilot", header: "Ilot", cell: ({ getValue }) => getValue() || "-" },
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
        header: "Surface (m2)",
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
      { accessorKey: "type", header: "Type", cell: ({ getValue }) => getValue() || "-" },
      {
        accessorKey: "typeSol",
        header: "Sol",
        cell: ({ row }) => (
          <EditableSelectCell
            plancheId={row.original.nom}
            field="typeSol"
            value={row.original.typeSol}
            options={TYPES_SOL}
            placeholder="Definir"
            onUpdate={fetchData}
          />
        ),
      },
      {
        accessorKey: "retentionEau",
        header: "Retention",
        cell: ({ row }) => (
          <EditableSelectCell
            plancheId={row.original.nom}
            field="retentionEau"
            value={row.original.retentionEau}
            options={RETENTION_EAU}
            placeholder="Definir"
            onUpdate={fetchData}
          />
        ),
      },
      { accessorKey: "_count.cultures", header: "Cultures", cell: ({ getValue }) => getValue() || 0 },
    ],
    [fetchData]
  )

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalSurface = data.reduce((sum, p) => sum + (p.surface || 0), 0)

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        {data.length} planches &bull; {totalSurface.toFixed(0)} m2 total
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        showPagination={false}
        onAdd={() => router.push("/planches/new")}
        onRefresh={fetchData}
        onRowClick={(row) => router.push(`/planches/${encodeURIComponent(row.nom)}`)}
        onRowEdit={(row) => router.push(`/planches/${encodeURIComponent(row.nom)}`)}
        onRowDelete={async (row) => {
          if (row._count.cultures > 0) {
            toast({
              variant: "destructive",
              title: "Impossible",
              description: `${row.nom} a ${row._count.cultures} culture(s)`,
            })
            return
          }
          if (!confirm(`Supprimer "${row.nom}" ?`)) return
          try {
            await fetch(`/api/planches/${encodeURIComponent(row.nom)}`, { method: "DELETE" })
            toast({ title: "Planche supprimee" })
            fetchData()
          } catch {
            toast({ variant: "destructive", title: "Erreur" })
          }
        }}
        searchPlaceholder="Rechercher une planche..."
        emptyMessage="Aucune planche trouvee."
      />
    </div>
  )
}

// ============================================================
// Rotations
// ============================================================

function RotationYears({ details }: { details: RotationDetail[] }) {
  if (details.length === 0) return <span className="text-muted-foreground">-</span>
  return (
    <div className="flex gap-1 flex-wrap">
      {details.map((d) => {
        const couleur = d.itp?.espece?.couleur || "#888888"
        const label = d.itp?.espece?.id || d.itp?.id || "?"
        return (
          <Badge
            key={d.id}
            variant="outline"
            className="text-xs px-1.5"
            style={{ borderColor: couleur, backgroundColor: `${couleur}20` }}
          >
            A{d.annee}: {label}
          </Badge>
        )
      })}
    </div>
  )
}

const rotationColumns: ColumnDef<RotationWithRelations>[] = [
  {
    accessorKey: "id",
    header: "Rotation",
    cell: ({ row }) => <span className="font-medium">{row.original.id}</span>,
  },
  {
    accessorKey: "active",
    header: "Statut",
    cell: ({ getValue }) => {
      const active = getValue() as boolean
      return active ? (
        <Badge variant="default" className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Active
        </Badge>
      ) : (
        <Badge variant="secondary">
          <XCircle className="h-3 w-3 mr-1" />
          Inactive
        </Badge>
      )
    },
  },
  {
    accessorKey: "nbAnnees",
    header: "Cycle",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? `${val} an${val > 1 ? "s" : ""}` : "-"
    },
  },
  {
    id: "details",
    header: "Plan de rotation",
    cell: ({ row }) => <RotationYears details={row.original.details} />,
  },
  {
    accessorKey: "_count.planches",
    header: "Planches",
    cell: ({ getValue }) => {
      const count = getValue() as number
      return (
        <div className="flex items-center gap-1">
          <LayoutGrid className="h-3 w-3 text-muted-foreground" />
          {count}
        </div>
      )
    },
  },
]

function RotationsSubTab() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<RotationWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/rotations?page=1&pageSize=100")
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      setData(result.data)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les rotations" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-3">
      <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 text-sm text-orange-800">
        <p className="font-medium">Rotations des cultures</p>
        <p className="mt-1 text-orange-700">
          Definissez la succession des cultures sur plusieurs annees. Assignez une rotation a vos
          planches pour planifier automatiquement.
        </p>
      </div>
      <DataTable
        columns={rotationColumns}
        data={data}
        isLoading={isLoading}
        showPagination={false}
        onAdd={() => router.push("/rotations/new")}
        onRefresh={fetchData}
        onRowClick={(row) => router.push(`/rotations/${encodeURIComponent(row.id)}`)}
        onRowEdit={(row) => router.push(`/rotations/${encodeURIComponent(row.id)}`)}
        onRowDelete={async (row) => {
          if (row._count.planches > 0) {
            toast({
              variant: "destructive",
              title: "Impossible",
              description: `Utilisee par ${row._count.planches} planche(s)`,
            })
            return
          }
          if (!confirm(`Supprimer "${row.id}" ?`)) return
          try {
            await fetch(`/api/rotations/${encodeURIComponent(row.id)}`, { method: "DELETE" })
            toast({ title: "Rotation supprimee" })
            fetchData()
          } catch {
            toast({ variant: "destructive", title: "Erreur" })
          }
        }}
        searchPlaceholder="Rechercher une rotation..."
        emptyMessage="Aucune rotation trouvee."
      />
    </div>
  )
}

// ============================================================
// Associations
// ============================================================

const associationColumns: ColumnDef<AssociationWithRelations>[] = [
  {
    accessorKey: "nom",
    header: "Association",
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Heart className="h-4 w-4 text-pink-500" />
        <span className="font-medium">{row.original.nom}</span>
      </div>
    ),
  },
  {
    accessorKey: "details",
    header: "Especes/Familles",
    cell: ({ row }) => {
      const details = row.original.details
      if (!details || details.length === 0)
        return <span className="text-muted-foreground">-</span>
      return (
        <div className="flex flex-wrap gap-1">
          {details.slice(0, 5).map((d, i) => {
            const name = d.especeId || d.familleId || d.groupe || "?"
            const color = d.espece?.couleur || d.famille?.couleur || "#888"
            return (
              <Badge
                key={i}
                variant={d.requise ? "default" : "outline"}
                className="text-xs"
                style={{ borderColor: color }}
              >
                {d.requise && "* "}
                {name}
              </Badge>
            )
          })}
          {details.length > 5 && (
            <Badge variant="secondary" className="text-xs">
              +{details.length - 5}
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ getValue }) => {
      const desc = getValue() as string | null
      if (!desc) return <span className="text-muted-foreground">-</span>
      return <span className="text-sm text-muted-foreground line-clamp-2">{desc}</span>
    },
  },
  {
    id: "nbRequises",
    header: "Requises",
    cell: ({ row }) => {
      const count = row.original.details.filter((d) => d.requise).length
      return count > 0 ? (
        <Badge variant="default" className="bg-green-600">
          {count}
        </Badge>
      ) : (
        <span className="text-muted-foreground">0</span>
      )
    },
  },
  {
    id: "nbTotal",
    header: "Total",
    cell: ({ row }) => row.original.details.length,
  },
]

function AssociationsSubTab() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<AssociationWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/associations")
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      setData(result)
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les associations",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  return (
    <div className="space-y-3">
      <div className="p-3 bg-pink-50 rounded-lg border border-pink-200 text-sm text-pink-800">
        <div className="flex items-start gap-2">
          <Users className="h-4 w-4 text-pink-600 mt-0.5" />
          <div>
            <p className="font-medium">Compagnonnage</p>
            <p className="mt-1 text-pink-700">
              Les associations definissent quelles especes se beneficient mutuellement. Une
              association <strong>requise</strong> (*) indique une dependance forte.
            </p>
          </div>
        </div>
      </div>
      <DataTable
        columns={associationColumns}
        data={data}
        isLoading={isLoading}
        showPagination={true}
        pageSize={20}
        onAdd={() => router.push("/associations/new")}
        onRefresh={fetchData}
        onRowClick={(row) => router.push(`/associations/${row.id}`)}
        onRowEdit={(row) => router.push(`/associations/${row.id}`)}
        onRowDelete={async (row) => {
          if (!confirm(`Supprimer "${row.nom}" ?`)) return
          try {
            await fetch(`/api/associations/${row.id}`, { method: "DELETE" })
            toast({ title: "Association supprimee" })
            fetchData()
          } catch {
            toast({ variant: "destructive", title: "Erreur" })
          }
        }}
        searchPlaceholder="Rechercher une association..."
        emptyMessage="Aucune association trouvee."
      />
    </div>
  )
}
