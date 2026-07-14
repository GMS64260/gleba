"use client"

/**
 * Onglet Referentiel Verger - Especes arbres filtrées
 * Clic sur une ligne → Sheet latéral avec fiche espece
 */

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { ColumnDef } from "@tanstack/react-table"
import { Leaf, TreeDeciduous, Cherry, Loader2, ExternalLink, GitBranch, Bug, TreePine, Trees, Download } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useReferentielActions,
  makeOrigineColumn,
  FiltreOrigine,
  filtrerParOrigine,
  type EntreeCommunaute,
  type FiltreOrigineValue,
} from "@/components/referentiel/catalogue-communaute"
import { AjoutReferentielDialog } from "@/components/referentiel/AjoutReferentielDialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { AvisDialog } from "@/components/avis/AvisDialog"
import { AvisCell } from "@/components/avis/AvisCell"
import type { AvisStatsListe } from "@/lib/avis/types"

const ESPECE_TYPES = [
  { value: "all", label: "Tous", icon: Leaf },
  { value: "arbre_fruitier", label: "Arbres fruitiers", icon: TreeDeciduous },
  { value: "petit_fruit", label: "Petits fruits", icon: Cherry },
] as const

const TYPE_LABELS: Record<string, string> = {
  arbre_fruitier: "Arbre fruitier",
  petit_fruit: "Petit fruit",
}

// Bug #cmp8e4qut : la catégorie historique du référentiel mélangeait des
// libellés snake_case (`fruitier`, `petit_fruit`, `legume`...) et des
// émojis. On humanise les valeurs textuelles, les émojis passent au travers.
const CATEGORIE_LABELS: Record<string, string> = {
  fruitier: "Fruitier",
  arbre_fruitier: "Arbre fruitier",
  petit_fruit: "Petit fruit",
  fruit: "Fruit",
  legume: "Légume",
  aromatique: "Aromatique",
  engrais_vert: "Engrais vert",
  ornement: "Ornement",
}

function labelCategorie(v: string | null | undefined): string {
  if (!v) return "-"
  return CATEGORIE_LABELS[v] ?? v
}

// QA Hélène 2026-05-15 — Bug #15 + #16 : les sensibilités porte-greffes
// et méthodes PBI bioagresseurs sortaient en snake_case du seed
// (`secheresse`, `feu_bacterien`, `BT_tenebrionis`). On humanise ici.
const SLUG_LABELS: Record<string, string> = {
  // Sensibilités porte-greffes
  secheresse: "Sécheresse",
  feu_bacterien: "Feu bactérien",
  phytophthora: "Phytophthora",
  asphyxie: "Asphyxie racinaire",
  pucerons: "Pucerons",
  carence_fer: "Carence en fer",
  calcaire: "Calcaire actif",
  gel: "Gel printanier",
  excess_eau: "Excès d'eau",
  // Méthodes PBI bioagresseurs
  variete_resistante: "Variété résistante",
  confusion_sexuelle: "Confusion sexuelle",
  piegeage_chromo: "Piégeage chromatique",
  piegeage_pheromone: "Piégeage à phéromone",
  pheromone: "Phéromone",
  filet_anti_insecte: "Filet anti-insecte",
  badigeon: "Badigeon",
  BT_tenebrionis: "Bt tenebrionis",
  BT_kurstaki: "Bt kurstaki",
  spinosad: "Spinosad",
  pyrethre_naturel: "Pyrèthre naturel",
  savon_noir: "Savon noir",
  prophylaxie: "Prophylaxie",
  taille_sanitaire: "Taille sanitaire",
  rotation_culturale: "Rotation culturale",
  enherbement: "Enherbement",
  bandes_fleuries: "Bandes fleuries",
  auxiliaires: "Lâchers d'auxiliaires",
  decoction_prele: "Décoction de prêle",
  purin_ortie: "Purin d'ortie",
  cuivre: "Cuivre",
  soufre: "Soufre",
}

function humaniseSlug(s: string): string {
  if (SLUG_LABELS[s]) return SLUG_LABELS[s]
  // Fallback : snake_case → "Snake case"
  return s
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
}

interface EspeceWithRelations {
  id: string
  nom: string | null
  type: string
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
  avisStats?: AvisStatsListe
  userId: string | null
  partageCommunaute: boolean
}

interface EspeceDetail {
  id: string
  nom: string | null
  type: string
  familleId: string | null
  nomLatin: string | null
  rendement: number | null
  vivace: boolean
  besoinEau: number | null
  couleur: string | null
  categorie: string | null
  famille: { id: string; couleur: string | null; nomFr: string | null } | null
  varietes: {
    id: string
    nom: string | null
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
    // Feedback Marc 2026-05-16 — V2 Bug 5 : l'en-tête affichait
    // « kg/m² » pour toutes les espèces alors que les arbres sont
    // rangés en kg/arbre (uniteRendement = kg_arbre). On lit l'unité
    // de chaque ligne pour afficher la bonne suffixe.
    header: "Rendement",
    cell: ({ row }) => {
      const val = row.original.rendement
      const unite = (row.original as { uniteRendement?: string }).uniteRendement ?? "kg_m2"
      if (val == null) return "-"
      const label = unite === "kg_arbre"
        ? "kg/arbre"
        : unite === "biomasse_t_ha"
          ? "t/ha"
          : "kg/m²"
      return `${val.toFixed(1)} ${label}`
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

// Bug #4 — Sous-référentiels supplémentaires : porte-greffes, bioagresseurs,
// essences bocagères. Wrapper exporté qui switche entre 4 vues.
const SOUS_REFS = [
  { key: "especes", label: "Espèces", icon: Leaf },
  { key: "porte-greffes", label: "Porte-greffes", icon: GitBranch },
  { key: "bioagresseurs", label: "Bioagresseurs", icon: Bug },
  { key: "essences", label: "Essences bocagères", icon: TreePine },
  { key: "essences-forestieres", label: "Essences forestières", icon: Trees },
] as const
type SousRef = typeof SOUS_REFS[number]["key"]

// L'export CSV du référentiel (route dédiée hors périmètre) ne couvre pas les
// essences forestières : on masque le bouton pour cet onglet.
const SOUS_REFS_EXPORTABLES: ReadonlyArray<SousRef> = [
  "especes",
  "porte-greffes",
  "bioagresseurs",
  "essences",
]

export function ReferentielTab() {
  const [sousRef, setSousRef] = React.useState<SousRef>("especes")
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex rounded-md border bg-white">
          {SOUS_REFS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSousRef(key)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm border-l first:border-l-0 ${
                sousRef === key ? "bg-lime-600 text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        {SOUS_REFS_EXPORTABLES.includes(sousRef) && (
          <a
            href={`/api/verger/referentiel/export?onglet=${sousRef}`}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </a>
        )}
      </div>
      {sousRef === "especes" && <EspecesReferentiel />}
      {sousRef === "porte-greffes" && <PorteGreffesReferentiel />}
      {sousRef === "bioagresseurs" && <BioagresseursReferentiel />}
      {sousRef === "essences" && <EssencesReferentiel />}
      {sousRef === "essences-forestieres" && <EssencesForestieresReferentiel />}
    </div>
  )
}

function EspecesReferentiel() {
  const { toast } = useToast()
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id as string | undefined
  const [data, setData] = React.useState<EspeceWithRelations[]>([])
  const [filteredData, setFilteredData] = React.useState<EspeceWithRelations[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedType, setSelectedType] = React.useState("all")
  const [filtreOrigine, setFiltreOrigine] = React.useState<FiltreOrigineValue>("tout")
  const [avisRef, setAvisRef] = React.useState<EspeceWithRelations | null>(null)

  // Sheet state
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [detail, setDetail] = React.useState<EspeceDetail | null>(null)
  const [detailLoading, setDetailLoading] = React.useState(false)
  // Bug #cmp8dn92j (2026-05-16) : on garde l'id ciblé en ref pour
  // ignorer les réponses retardées de fetchs antérieurs (race condition
  // observée : clic Pommier → fiche Oranger quand deux fetchs s'inversent).
  const lastRequestedIdRef = React.useRef<string | null>(null)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/especes?pageSize=500&avis=1")
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
    const requestedId = row.id
    lastRequestedIdRef.current = requestedId
    setSheetOpen(true)
    setDetail(null)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/especes/${encodeURIComponent(requestedId)}`)
      if (!res.ok) {
        // Feedback Marc 2026-05-16 — Bug 04 : sur erreur, lire le
        // message renvoyé par l'API plutôt qu'un texte générique pour
        // que l'utilisateur sache si l'espèce est introuvable, si la
        // session a expiré (401), ou si le serveur a planté (500).
        let description = "Impossible de charger la fiche"
        try {
          const errJson = await res.json()
          if (errJson?.error) description = String(errJson.error)
        } catch {
          /* ignore JSON parse errors */
        }
        throw new Error(description)
      }
      const json = (await res.json()) as EspeceDetail
      // Bug #cmp8dn92j : si l'utilisateur a cliqué entre-temps sur une
      // autre espèce, on jette la réponse (sinon on écrase la bonne fiche
      // par une réponse antérieure).
      if (
        lastRequestedIdRef.current === requestedId &&
        (!json.id || json.id === requestedId)
      ) {
        setDetail(json)
      }
    } catch (err) {
      if (lastRequestedIdRef.current === requestedId) {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: err instanceof Error ? err.message : "Impossible de charger la fiche",
        })
        setSheetOpen(false)
      }
    } finally {
      if (lastRequestedIdRef.current === requestedId) {
        setDetailLoading(false)
      }
    }
  }, [toast])

  const referentielActions = useReferentielActions("/api/especes", fetchData, toast)

  const columnsAvecAvis = React.useMemo<ColumnDef<EspeceWithRelations>[]>(
    () => [
      ...columns,
      makeOrigineColumn<EspeceWithRelations>((e) => e.nom ?? e.id, currentUserId, referentielActions, "ESPECE"),
      {
        id: "avis",
        header: "Avis",
        enableSorting: false,
        cell: ({ row }) => (
          <AvisCell
            stats={row.original.avisStats}
            onClick={(e) => {
              e.stopPropagation()
              setAvisRef(row.original)
            }}
          />
        ),
      },
    ],
    [currentUserId, referentielActions]
  )

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

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FiltreOrigine value={filtreOrigine} onChange={setFiltreOrigine} labelPerso="Mes entrées" />
        <AjoutReferentielDialog
          titre="Ajouter une espèce fruitière"
          apiBase="/api/especes"
          champs={[{ key: "id", label: "Nom", required: true, placeholder: "ex. Maracuja" }]}
          extraBody={{ type: "arbre_fruitier", uniteRendement: "kg_arbre", vivace: true, aPlanifier: false }}
          onCreated={fetchData}
          triggerLabel="Ajouter une espèce"
        />
      </div>

      <DataTable
        columns={columnsAvecAvis}
        data={filtrerParOrigine(filteredData, filtreOrigine, currentUserId)}
        isLoading={isLoading}
        showPagination={true}
        pageSize={50}
        onRefresh={fetchData}
        onRowClick={openDetail}
        searchPlaceholder="Rechercher une espèce..."
        emptyMessage="Aucune espèce trouvée."
      />

      <AvisDialog
        refType="ESPECE"
        refId={avisRef?.id ?? null}
        nom={avisRef?.nom ?? avisRef?.id}
        open={avisRef !== null}
        onOpenChange={(o) => !o && setAvisRef(null)}
        onSaved={fetchData}
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
                  <SheetTitle className="text-left">{detail.nom ?? detail.id}</SheetTitle>
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
                    {/* QA Hélène 2026-05-15 — Bug #17 : afficher le nom
                        FR de la famille (Rosacées) plutôt que le binom
                        latin (Rosaceae) — cohérent avec la table. */}
                    <p className="font-medium">{detail.famille?.nomFr || detail.familleId || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Catégorie</p>
                    <p className="font-medium">{labelCategorie(detail.categorie)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Rendement</p>
                    {/* Même logique d'unité que la colonne du tableau (V2 Bug 5) :
                        les arbres sont en kg/arbre, pas en kg/m². */}
                    <p className="font-medium">
                      {detail.rendement
                        ? `${detail.rendement} ${
                            ((detail as { uniteRendement?: string }).uniteRendement ?? "kg_m2") === "kg_arbre"
                              ? "kg/arbre"
                              : ((detail as { uniteRendement?: string }).uniteRendement ?? "kg_m2") === "biomasse_t_ha"
                                ? "t/ha"
                                : "kg/m²"
                          }`
                        : "-"}
                    </p>
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
                          <span className="font-medium">{v.nom ?? v.id}</span>
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
                  <Link href={`/maraichage/especes/${encodeURIComponent(detail.id)}`}>
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

// ============================================================================
// Bug #4 — Sous-référentiels Porte-greffes / Bioagresseurs / Essences
// ============================================================================

type PorteGreffeRow = {
  id: string
  nom: string
  vigueur: number
  precocite: number
  sensibilites: string[]
  drageonnement: boolean
  especesCompatibles: string[]
  notes: string | null
  userId: string | null
  partageCommunaute: boolean
  avisStats?: AvisStatsListe
}

function PorteGreffesReferentiel() {
  const { toast } = useToast()
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id as string | undefined
  const [data, setData] = React.useState<PorteGreffeRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [filtreOrigine, setFiltreOrigine] = React.useState<FiltreOrigineValue>("tout")
  const [avisRef, setAvisRef] = React.useState<PorteGreffeRow | null>(null)

  const fetchData = React.useCallback(() => {
    setIsLoading(true)
    fetch("/api/verger/porte-greffes?avis=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => setData(res?.data || []))
      .catch(() => toast({ variant: "destructive", title: "Erreur de chargement" }))
      .finally(() => setIsLoading(false))
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const actions = useReferentielActions("/api/verger/porte-greffes", fetchData, toast)

  const columns: ColumnDef<PorteGreffeRow>[] = [
    { accessorKey: "nom", header: "Nom", cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span> },
    { accessorKey: "vigueur", header: "Vigueur", cell: ({ getValue }) => `${getValue()}/5` },
    { accessorKey: "precocite", header: "Précocité", cell: ({ getValue }) => `${getValue()}/5` },
    {
      accessorKey: "especesCompatibles",
      header: "Espèces compatibles",
      cell: ({ getValue }) => {
        const arr = (getValue() as string[]) ?? []
        if (arr.length === 0) return <span className="text-muted-foreground">—</span>
        return <span className="text-xs">{arr.slice(0, 3).join(", ")}{arr.length > 3 ? ` +${arr.length - 3}` : ""}</span>
      },
    },
    {
      accessorKey: "sensibilites",
      header: "Sensibilités",
      cell: ({ getValue }) => {
        const arr = (getValue() as string[]) ?? []
        if (arr.length === 0) return <span className="text-muted-foreground">—</span>
        return <span className="text-xs">{arr.map(humaniseSlug).join(", ")}</span>
      },
    },
    { accessorKey: "drageonnement", header: "Drageonne", cell: ({ getValue }) => (getValue() ? "Oui" : "Non") },
    {
      id: "avis",
      header: "Avis",
      enableSorting: false,
      cell: ({ row }) => (
        <AvisCell
          stats={row.original.avisStats}
          onClick={(e) => {
            e.stopPropagation()
            setAvisRef(row.original)
          }}
        />
      ),
    },
    makeOrigineColumn<PorteGreffeRow>((r) => r.nom, currentUserId, actions, "PORTE_GREFFE"),
  ]

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <FiltreOrigine value={filtreOrigine} onChange={setFiltreOrigine} labelPerso="Mes entrées" />
        <AjoutReferentielDialog
          titre="Ajouter un porte-greffe"
          apiBase="/api/verger/porte-greffes"
          champs={[{ key: "nom", label: "Nom", required: true }]}
          onCreated={fetchData}
          triggerLabel="Ajouter un porte-greffe"
        />
      </div>
      <DataTable
        columns={columns}
        data={filtrerParOrigine(data, filtreOrigine, currentUserId)}
        isLoading={isLoading}
        showPagination={false}
        searchPlaceholder="Rechercher un porte-greffe..."
        emptyMessage="Aucun porte-greffe en référentiel."
      />
      <AvisDialog
        refType="PORTE_GREFFE"
        refId={avisRef?.id ?? null}
        nom={avisRef?.nom}
        open={avisRef !== null}
        onOpenChange={(o) => !o && setAvisRef(null)}
        onSaved={fetchData}
      />
    </>
  )
}

type BioagresseurRow = {
  id: string
  nomCommun: string
  nomLatin: string
  type: string
  organeCible: string
  periodePression: string[]
  methodesPbi: string[]
  seuilNuisibilite: string | null
  especesCibles: string[]
}

function BioagresseursReferentiel() {
  const { toast } = useToast()
  const [data, setData] = React.useState<BioagresseurRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    setIsLoading(true)
    fetch("/api/verger/bioagresseurs")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => setData(res?.data || []))
      .catch(() => toast({ variant: "destructive", title: "Erreur de chargement" }))
      .finally(() => setIsLoading(false))
  }, [toast])

  const columns: ColumnDef<BioagresseurRow>[] = [
    {
      accessorKey: "nomCommun",
      header: "Bioagresseur",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.nomCommun}</div>
          <div className="text-xs text-muted-foreground italic">{row.original.nomLatin}</div>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ getValue }) => {
        const t = getValue() as string
        const color = t === "Maladie" ? "bg-red-100 text-red-700" : t === "Ravageur" ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-700"
        return <Badge variant="outline" className={color}>{t}</Badge>
      },
    },
    { accessorKey: "organeCible", header: "Organe cible" },
    {
      accessorKey: "periodePression",
      header: "Période",
      cell: ({ getValue }) => (((getValue() as string[]) ?? []).join(", ") || "—"),
    },
    {
      accessorKey: "methodesPbi",
      header: "Méthodes biocontrôle",
      cell: ({ getValue }) => {
        const arr = ((getValue() as string[]) ?? []).slice(0, 3)
        return arr.length > 0 ? arr.map(humaniseSlug).join(", ") : "—"
      },
    },
    {
      accessorKey: "especesCibles",
      header: "Cibles",
      cell: ({ getValue }) => {
        const arr = (getValue() as string[]) ?? []
        return <span className="text-xs">{arr.slice(0, 3).join(", ")}{arr.length > 3 ? ` +${arr.length - 3}` : ""}</span>
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={data}
      isLoading={isLoading}
      showPagination={false}
      searchPlaceholder="Rechercher un bioagresseur..."
      emptyMessage="Aucun bioagresseur en référentiel."
    />
  )
}

type EssenceBocageRow = {
  id: string
  nomCommun: string
  nomLatin: string
  hauteurM: number
  croissance: string
  roles: string[]
  persistant: boolean
  epineux: boolean
  userId: string | null
  partageCommunaute: boolean
}

function EssencesReferentiel() {
  const { toast } = useToast()
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id as string | undefined
  const [data, setData] = React.useState<EssenceBocageRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [filtreOrigine, setFiltreOrigine] = React.useState<FiltreOrigineValue>("tout")

  const fetchData = React.useCallback(() => {
    setIsLoading(true)
    fetch("/api/verger/essences-bocageres")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => setData(res?.data || []))
      .catch(() => toast({ variant: "destructive", title: "Erreur de chargement" }))
      .finally(() => setIsLoading(false))
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const actions = useReferentielActions("/api/verger/essences-bocageres", fetchData, toast)

  const columns: ColumnDef<EssenceBocageRow>[] = [
    {
      accessorKey: "nomCommun",
      header: "Essence",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.nomCommun}</div>
          <div className="text-xs text-muted-foreground italic">{row.original.nomLatin}</div>
        </div>
      ),
    },
    { accessorKey: "hauteurM", header: "Hauteur (m)", cell: ({ getValue }) => `${getValue()} m` },
    { accessorKey: "croissance", header: "Croissance" },
    {
      accessorKey: "roles",
      header: "Rôles écologiques",
      cell: ({ getValue }) => {
        const arr = (getValue() as string[]) ?? []
        return (
          <div className="flex flex-wrap gap-1">
            {arr.slice(0, 3).map((r) => (
              <Badge key={r} variant="outline" className="text-[10px] py-0">{r}</Badge>
            ))}
            {arr.length > 3 && <span className="text-xs text-muted-foreground">+{arr.length - 3}</span>}
          </div>
        )
      },
    },
    { accessorKey: "persistant", header: "Persistant", cell: ({ getValue }) => (getValue() ? "Oui" : "—") },
    { accessorKey: "epineux", header: "Épineux", cell: ({ getValue }) => (getValue() ? "Oui" : "—") },
    makeOrigineColumn<EssenceBocageRow>((r) => r.nomCommun, currentUserId, actions),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FiltreOrigine value={filtreOrigine} onChange={setFiltreOrigine} labelPerso="Mes entrées" />
        <AjoutReferentielDialog
          titre="Ajouter une essence bocagère"
          apiBase="/api/verger/essences-bocageres"
          champs={[
            { key: "nomCommun", label: "Nom commun", required: true },
            { key: "nomLatin", label: "Nom latin", required: true },
          ]}
          onCreated={fetchData}
          triggerLabel="Ajouter une essence"
        />
      </div>
      <DataTable
        columns={columns}
        data={filtrerParOrigine(data, filtreOrigine, currentUserId)}
        isLoading={isLoading}
        showPagination={false}
        onRefresh={fetchData}
        searchPlaceholder="Rechercher une essence..."
        emptyMessage="Aucune essence en référentiel."
      />
    </div>
  )
}

// ============================================================================
// Sous-référentiel Essences forestières (table essences_forestieres) —
// harmonisé au modèle communauté/perso.
// ============================================================================

type EssenceForestiereRow = {
  id: string
  nom: string
  nomLatin: string
  categorie: string
  usages: string[]
  croissance: string
  cycleAnsRecolte: number | null
  conseils: string | null
  userId: string | null
  partageCommunaute: boolean
}

function EssencesForestieresReferentiel() {
  const { toast } = useToast()
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id as string | undefined
  const [data, setData] = React.useState<EssenceForestiereRow[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [filtreOrigine, setFiltreOrigine] = React.useState<FiltreOrigineValue>("tout")

  const fetchData = React.useCallback(() => {
    setIsLoading(true)
    fetch("/api/verger/essences-forestieres")
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => setData(res?.data || []))
      .catch(() => toast({ variant: "destructive", title: "Erreur de chargement" }))
      .finally(() => setIsLoading(false))
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const actions = useReferentielActions("/api/verger/essences-forestieres", fetchData, toast)

  const columns: ColumnDef<EssenceForestiereRow>[] = [
    {
      accessorKey: "nom",
      header: "Essence",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.nom}</div>
          <div className="text-xs text-muted-foreground italic">{row.original.nomLatin}</div>
        </div>
      ),
    },
    {
      accessorKey: "categorie",
      header: "Catégorie",
      cell: ({ getValue }) => labelCategorie(getValue() as string),
    },
    { accessorKey: "croissance", header: "Croissance" },
    {
      accessorKey: "usages",
      header: "Usages",
      cell: ({ getValue }) => {
        const arr = (getValue() as string[]) ?? []
        if (arr.length === 0) return <span className="text-muted-foreground">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {arr.slice(0, 3).map((u) => (
              <Badge key={u} variant="outline" className="text-[10px] py-0">{humaniseSlug(u)}</Badge>
            ))}
            {arr.length > 3 && <span className="text-xs text-muted-foreground">+{arr.length - 3}</span>}
          </div>
        )
      },
    },
    {
      accessorKey: "cycleAnsRecolte",
      header: "Cycle (ans)",
      cell: ({ getValue }) => {
        const v = getValue() as number | null
        return v != null ? `${v}` : "—"
      },
    },
    makeOrigineColumn<EssenceForestiereRow>((r) => r.nom, currentUserId, actions),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FiltreOrigine value={filtreOrigine} onChange={setFiltreOrigine} labelPerso="Mes entrées" />
        <AjoutReferentielDialog
          titre="Ajouter une essence forestière"
          apiBase="/api/verger/essences-forestieres"
          champs={[
            { key: "nom", label: "Nom commun", required: true },
            { key: "nomLatin", label: "Nom latin", required: true },
            {
              key: "categorie",
              label: "Catégorie",
              type: "select",
              defaut: "feuillu",
              options: [
                { value: "feuillu", label: "Feuillu" },
                { value: "resineux", label: "Résineux" },
                { value: "fruitier", label: "Fruitier" },
                { value: "petit_fruit", label: "Petit fruit" },
              ],
            },
          ]}
          onCreated={fetchData}
          triggerLabel="Ajouter une essence"
        />
      </div>
      <DataTable
        columns={columns}
        data={filtrerParOrigine(data, filtreOrigine, currentUserId)}
        isLoading={isLoading}
        showPagination={false}
        onRefresh={fetchData}
        searchPlaceholder="Rechercher une essence forestière..."
        emptyMessage="Aucune essence forestière en référentiel."
      />
    </div>
  )
}
