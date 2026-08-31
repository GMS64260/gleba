"use client"

/**
 * Onglet Référentiel - Base de données des especes
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ColumnDef } from "@tanstack/react-table"
import { Leaf, Salad, TreeDeciduous, Cherry, Sprout, Flower, Flower2 } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { getEspeceEmoji } from "@/lib/categories-emojis"
import {
  makeOrigineColumn,
  useReferentielActions,
  FiltreOrigine,
  filtrerParOrigine,
  type FiltreOrigineValue,
} from "@/components/referentiel/catalogue-communaute"
import { formatRendement, libelleTypeEspece } from "@/lib/validations/espece"

const ESPECE_TYPES = [
  { value: "all", label: "Tous", icon: Leaf },
  { value: "legume", label: "Légumes", icon: Salad },
  { value: "aromatique", label: "Aromatiques", icon: Flower2 },
  // Ticket FB-PMWX8O — production florale.
  { value: "fleur", label: "Fleurs", icon: Flower },
  { value: "engrais_vert", label: "Engrais verts", icon: Sprout },
  { value: "arbre_fruitier", label: "Arbres fruitiers", icon: TreeDeciduous },
  { value: "petit_fruit", label: "Petits fruits", icon: Cherry },
] as const

// Bug feedback testeur 2026-05-26 (cmpm71z5s) : le label « Ornement » avait été
// ajouté ICI pour ne pas afficher la valeur brute minuscule « ornement ». Le
// correctif n'a jamais atteint les trois autres copies de la même carte, et le
// défaut a été re-signalé sur l'écran de création deux mois et demi plus tard
// (FB-E33FAA, 2026-08-18). Les libellés viennent maintenant du référentiel.

interface EspeceWithRelations {
  id: string
  nom: string | null
  type: string
  // Catalogue communautaire : userId null = Gleba officiel ; renseigné = perso
  // d'un membre. partageCommunaute = proposé/partagé à la communauté.
  userId: string | null
  partageCommunaute: boolean
  familleId: string | null
  nomLatin: string | null
  rendement: number | null
  uniteRendement: string | null
  vivace: boolean
  besoinEau: number | null
  aPlanifier: boolean
  couleur: string | null
  categorie: string | null
  famille: { id: string; couleur: string | null; nomFr: string | null } | null
  _count: { varietes: number; cultures: number }
}

function BesoinsEau({ val }: { val: number | null }) {
  if (!val) return <span className="text-muted-foreground">-</span>
  const bars = Math.min(val, 5)
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`w-1.5 h-4 rounded-sm ${i < bars ? "bg-blue-500" : "bg-slate-200"}`}
        />
      ))}
    </div>
  )
}

const columns: ColumnDef<EspeceWithRelations>[] = [
  {
    accessorKey: "id",
    header: "Espèce",
    cell: ({ row }) => {
      const espece = row.original
      const couleur = espece.couleur || espece.famille?.couleur || "#888888"
      const emoji = getEspeceEmoji(espece.nom, espece.categorie)
      return (
        <div className="flex items-center gap-2">
          {emoji ? (
            <span className="text-lg">{emoji}</span>
          ) : (
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: couleur }} />
          )}
          <span className="font-medium">{espece.nom ?? espece.id}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ getValue }) => {
      const type = getValue() as string
      return (
        <Badge variant="outline" className="text-xs">
          {libelleTypeEspece(type)}
        </Badge>
      )
    },
  },
  {
    accessorKey: "familleId",
    header: "Famille",
    cell: ({ row }) => {
      const famille = row.original.famille
      if (!famille) return "-"
      return (
        <div className="flex items-center gap-1.5">
          {famille.couleur && (
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: famille.couleur }} />
          )}
          {/* BUG #19+#23 — latin partout (id) + tooltip français */}
          <span className="text-sm" title={famille.nomFr || undefined}>{famille.id}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "nomLatin",
    header: "Nom latin",
    cell: ({ getValue }) => {
      const val = getValue() as string | null
      return val ? <span className="italic text-sm text-muted-foreground">{val}</span> : "-"
    },
  },
  {
    accessorKey: "rendement",
    // QA cmsqlu3os — l'unité vit dans la cellule, pas dans l'en-tête : la même
    // colonne mélange du kg/m² (maraîchage), du kg/arbre (fruitiers) et des
    // t/ha (engrais verts).
    header: "Rendement",
    cell: ({ row }) => formatRendement(row.original.rendement, row.original.uniteRendement),
  },
  {
    accessorKey: "besoinEau",
    header: "Eau",
    cell: ({ getValue }) => <BesoinsEau val={getValue() as number | null} />,
  },
  {
    accessorKey: "_count.varietes",
    header: "Variétés",
    cell: ({ getValue }) => getValue() || 0,
  },
  {
    accessorKey: "_count.cultures",
    // BUG #18 (audit Marc 2026-05-15) : « Cultures 31 » sans contexte
    // pouvait laisser croire à un cumul historique trompeur. Le mode
    // par défaut est désormais « saison » (année en cours, cultures
    // non terminées) ET filtré par user — le header le dit explicitement.
    header: () => (
      <span title="Nombre de cultures (parcelles semées/plantées) de cette espèce cette saison — pas le nombre de variétés du catalogue. 0 = espèce non plantée cette année.">
        Cultures saison
      </span>
    ),
    cell: ({ getValue }) => getValue() || 0,
  },
]

interface ReferentielTabProps {
  year: number
}

export function ReferentielTab({ year }: ReferentielTabProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id as string | undefined
  const [data, setData] = React.useState<EspeceWithRelations[]>([])
  const [filteredData, setFilteredData] = React.useState<EspeceWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedType, setSelectedType] = React.useState("all")
  // Filtre par origine (catalogue communautaire) : Tout / Gleba / Communauté / Mes espèces
  const [filtreOrigine, setFiltreOrigine] = React.useState<FiltreOrigineValue>("tout")

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/especes?pageSize=500&annee=${year}`)
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      const items = Array.isArray(result) ? result : result.data || []
      setData(items)
      setFilteredData(items)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les espèces" })
    } finally {
      setIsLoading(false)
    }
  }, [toast, year])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  React.useEffect(() => {
    if (selectedType === "all") {
      setFilteredData(data)
    } else {
      setFilteredData(data.filter((e) => e.type === selectedType))
    }
  }, [selectedType, data])

  // Catalogue communautaire : actions partagées (proposer/rendre privé, supprimer).
  const referentielActions = useReferentielActions("/api/especes", fetchData, toast)

  // Colonne « Origine » partagée : badge Gleba/Perso/Communauté + actions sur son perso.
  const origineColumn = makeOrigineColumn<EspeceWithRelations>(
    (e) => e.nom ?? e.id,
    currentUserId,
    referentielActions,
    "ESPECE"
  )

  // Filtre client par origine (combiné au filtre de type).
  const displayedData = filtrerParOrigine(filteredData, filtreOrigine, currentUserId)

  return (
    <div className="space-y-4">
      <Tabs value={selectedType} onValueChange={setSelectedType}>
        <TabsList className="flex-wrap h-auto gap-1">
          {ESPECE_TYPES.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              aria-label={label}
              title={label}
              className="flex items-center gap-1"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Filtre par origine (catalogue communautaire) */}
      <FiltreOrigine value={filtreOrigine} onChange={setFiltreOrigine} labelPerso="Mes espèces" />

      <DataTable
        columns={[...columns, origineColumn]}
        data={displayedData}
        isLoading={isLoading}
        showPagination={true}
        pageSize={50}
        onAdd={() => router.push("/maraichage/especes/new")}
        onRefresh={fetchData}
        onRowClick={(row) => router.push(`/maraichage/especes/${encodeURIComponent(row.id)}`)}
        onRowEdit={(row) => router.push(`/maraichage/especes/${encodeURIComponent(row.id)}`)}
        searchPlaceholder="Rechercher une espèce..."
        emptyMessage="Aucune espèce trouvée."
      />
    </div>
  )
}
