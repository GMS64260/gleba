"use client"

/**
 * Onglet Referentiel Verger - Especes arbres filtrées
 * Clic sur une ligne → Sheet latéral avec fiche espece
 */

import * as React from "react"
import Link from "next/link"
import { ColumnDef } from "@tanstack/react-table"
import { Leaf, TreeDeciduous, Cherry, Loader2, ExternalLink } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"

const ESPECE_TYPES = [
  { value: "all", label: "Tous", icon: Leaf },
  { value: "arbre_fruitier", label: "Arbres fruitiers", icon: TreeDeciduous },
  { value: "petit_fruit", label: "Petits fruits", icon: Cherry },
] as const

const TYPE_LABELS: Record<string, string> = {
  arbre_fruitier: "Arbre fruitier",
  petit_fruit: "Petit fruit",
}

interface EspeceWithRelations {
  id: string
  type: string
  familleId: string | null
  nomLatin: string | null
  rendement: number | null
  vivace: boolean
  besoinEau: number | null
  aPlanifier: boolean
  couleur: string | null
  categorie: string | null
  famille: { id: string; couleur: string | null } | null
  _count: { varietes: number; cultures: number }
}

interface EspeceDetail {
  id: string
  type: string
  familleId: string | null
  nomLatin: string | null
  rendement: number | null
  vivace: boolean
  besoinEau: number | null
  couleur: string | null
  categorie: string | null
  famille: { id: string; couleur: string | null } | null
  varietes: {
    id: string
    especeId: string
    precocite: string | null
    fournisseurId: string | null
    fournisseur: { id: string } | null
  }[]
  itps: { id: string; nom: string | null }[]
  _count: { cultures: number; recoltes: number }
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
      return (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: couleur }} />
          <span className="font-medium">{espece.id}</span>
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
          {TYPE_LABELS[type] || type}
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
          <span className="text-sm">{famille.id}</span>
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
    header: "Rendement (kg/m2)",
    cell: ({ getValue }) => {
      const val = getValue() as number | null
      return val ? val.toFixed(1) : "-"
    },
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
]

export function ReferentielTab() {
  const { toast } = useToast()
  const [data, setData] = React.useState<EspeceWithRelations[]>([])
  const [filteredData, setFilteredData] = React.useState<EspeceWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedType, setSelectedType] = React.useState("all")

  // Sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [detail, setDetail] = React.useState<EspeceDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/especes?pageSize=500")
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      const items = Array.isArray(result) ? result : result.data || []
      // Filtrer uniquement les types arbres
      const arbresItems = items.filter((e: EspeceWithRelations) =>
        ["arbre_fruitier", "petit_fruit"].includes(e.type)
      )
      setData(arbresItems)
      setFilteredData(arbresItems)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les espèces" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

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

  const openDetail = React.useCallback(async (row: EspeceWithRelations) => {
    setSheetOpen(true)
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/especes/${encodeURIComponent(row.id)}`)
      if (!res.ok) throw new Error("Erreur")
      setDetail(await res.json())
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger la fiche" })
      setSheetOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }, [toast])

  return (
    <div className="space-y-4">
      <Tabs value={selectedType} onValueChange={setSelectedType}>
        <TabsList className="flex-wrap h-auto gap-1">
          {ESPECE_TYPES.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="flex items-center gap-1">
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
        showPagination={true}
        pageSize={50}
        onRefresh={fetchData}
        onRowClick={openDetail}
        searchPlaceholder="Rechercher une espèce..."
        emptyMessage="Aucune espèce trouvée."
      />

      {/* Sheet fiche espece */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : detail ? (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  {(detail.couleur || detail.famille?.couleur) && (
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: detail.couleur || detail.famille?.couleur || "#888" }}
                    />
                  )}
                  <SheetTitle className="text-left">{detail.id}</SheetTitle>
                </div>
                <SheetDescription className="text-left">
                  {detail.nomLatin && <span className="italic">{detail.nomLatin}</span>}
                  {detail.nomLatin && " — "}
                  {TYPE_LABELS[detail.type] || detail.type}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Infos générales */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Famille</p>
                    <p className="font-medium">{detail.familleId || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Catégorie</p>
                    <p className="font-medium">{detail.categorie || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Rendement</p>
                    <p className="font-medium">{detail.rendement ? `${detail.rendement} kg/m²` : "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Besoin eau</p>
                    <BesoinsEau val={detail.besoinEau} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Vivace</p>
                    <p className="font-medium">{detail.vivace ? "Oui" : "Non"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Cultures</p>
                    <p className="font-medium">{detail._count.cultures}</p>
                  </div>
                </div>

                {/* Variétés */}
                <div>
                  <h3 className="text-sm font-semibold mb-2">
                    Variétés ({detail.varietes.length})
                  </h3>
                  {detail.varietes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune variété</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {detail.varietes.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between text-sm p-2 rounded-md bg-slate-50 border"
                        >
                          <span className="font-medium">{v.id}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {v.precocite && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{v.precocite}</Badge>}
                            {v.fournisseur && <span>{v.fournisseur.id}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ITPs */}
                {detail.itps.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">
                      Itinéraires techniques ({detail.itps.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.itps.map((itp) => (
                        <Badge key={itp.id} variant="secondary" className="text-xs">
                          {itp.nom || itp.id}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lien vers fiche complète */}
                <div className="pt-2 border-t">
                  <Link href={`/especes/${encodeURIComponent(detail.id)}`}>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ouvrir la fiche complète
                    </Button>
                  </Link>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
