"use client"

/**
 * Page Semences necessaires
 *
 * PROMPT 06 — affichage en 3 onglets selon le mode de propagation :
 *   - Graines nécessaires (g) — semis direct
 *   - Plants à produire en pépinière (nb) — plants repiqués
 *   - Caieux/bulbes à commander (nb) — ail, oignon, échalote
 *
 * Statut métier OK / LOW / MISSING ; les lignes IGNORE (besoin = 0) ne sont
 * pas envoyées par l'API.
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { ArrowLeft, Sprout, AlertTriangle, Package, Clock } from "lucide-react"

import { DataTable } from "@/components/tables/DataTable"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

interface BesoinSemence {
  especeId: string
  especeCouleur: string | null
  varieteId: string | null
  surfaceTotale: number
  nbPlants: number
  mode: "graine_directe" | "plant_repique" | "bulbe_caieu" | "bouture"
  grainesNecessaires: number
  besoinCaieux: number
  margeSecuritePct: number
  stockActuel: number
  stockUnites: number
  nbGrainesG: number | null
  doseSemis: number | null
  uniteDose: "g_m2" | "pieces_m2" | "graines_plant" | "caieux_m2" | null
  tauxGerminationPct: number | null
  aCommander: number
  caieuxACommander: number
  statut: "OK" | "LOW" | "MISSING" | "IGNORE"
  stockDateMaj: string | null
}

interface Stats {
  nbEspeces: number
  totalPlants: number
  totalGraines: number
  totalACommander: number
  totalCaieux: number
  totalCaieuxACommander: number
  especesSansStock: number
  nbMissing: number
  nbLow: number
  nbMissingGraines?: number
  nbMissingCaieux?: number
  nbLowGraines?: number
  nbLowCaieux?: number
  nbGraineDirecte: number
  nbPlantRepique: number
  nbBulbeCaieu: number
  stockObsolete: boolean
  stockObsoleteSeuilJours: number
  derniereMajStockISO: string | null
}

function StatutBadge({ statut }: { statut: BesoinSemence["statut"] }) {
  switch (statut) {
    case "OK":
      return <Badge className="bg-green-600 hover:bg-green-700">OK</Badge>
    case "LOW":
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Insuffisant
        </Badge>
      )
    case "MISSING":
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Manquant
        </Badge>
      )
    default:
      return <Badge variant="outline">—</Badge>
  }
}

const baseColumns: ColumnDef<BesoinSemence>[] = [
  {
    accessorKey: "especeId",
    header: "Espèce",
    cell: ({ row }) => {
      const b = row.original
      return (
        <div className="flex items-center gap-2">
          {b.especeCouleur && (
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: b.especeCouleur }}
            />
          )}
          <span className="font-medium">{b.especeId}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "varieteId",
    header: "Variété",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "surfaceTotale",
    header: "Surface",
    cell: ({ getValue }) => `${(getValue() as number).toFixed(1)} m²`,
  },
  {
    accessorKey: "nbPlants",
    header: "Nb plants",
    cell: ({ getValue }) => (getValue() as number).toLocaleString(),
  },
]

// Audit Marc Bug #7 — Unité de dose explicite selon le référentiel (et plus
// "g/m²" en dur partout).
function uniteLabel(u: BesoinSemence["uniteDose"]): string {
  switch (u) {
    case "pieces_m2": return "plants/m²"
    case "graines_plant": return "graines/godet"
    case "caieux_m2": return "caieux/m²"
    case "g_m2": return "g/m²"
    default: return "g/m²"
  }
}

// Besoin brut sans marge (réversion du calcul stocké côté API).
function brutGraines(b: BesoinSemence): number {
  if (!b.margeSecuritePct || b.margeSecuritePct <= 0) return b.grainesNecessaires
  return b.grainesNecessaires / (1 + b.margeSecuritePct / 100)
}

// Audit Marc BUG-01 — Tooltip explicite : dose × surface, puis marge,
// puis total. Le toggle « appliquer la marge » dans le header bascule entre
// affichage brut et total.
function GrainesTooltip({ b, appliquerMarge }: { b: BesoinSemence; appliquerMarge: boolean }) {
  const brut = brutGraines(b)
  const valeurAffichee = appliquerMarge ? b.grainesNecessaires : brut
  const margeG = b.grainesNecessaires - brut
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help underline decoration-dotted decoration-slate-400 underline-offset-4">
            {valeurAffichee.toFixed(1)} g
            <Info className="h-3 w-3 text-slate-400" />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          <div className="font-semibold mb-1">Formule de besoin semences</div>
          <div>
            Dose × surface : <strong>{brut.toFixed(1)} g</strong>
            {b.doseSemis !== null && (
              <span className="text-slate-300"> ({b.doseSemis} {uniteLabel(b.uniteDose)} × {b.surfaceTotale.toFixed(1)} m²)</span>
            )}
          </div>
          {b.margeSecuritePct > 0 && (
            <>
              <div>+ marge sécurité <strong>{b.margeSecuritePct}%</strong> ({margeG.toFixed(1)} g)</div>
              <div>= total avec marge : <strong>{b.grainesNecessaires.toFixed(1)} g</strong></div>
            </>
          )}
          {!appliquerMarge && b.margeSecuritePct > 0 && (
            <div className="mt-2 text-amber-300">
              ⚠️ Affichage <strong>sans marge</strong> activé en header.
            </div>
          )}
          {b.tauxGerminationPct !== null && (
            <div className="mt-2 text-slate-300">
              Marge dimensionnée sur le taux de germination réaliste de l'espèce&nbsp;: <strong>{b.tauxGerminationPct}%</strong>.
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function makeGrainesColumns(appliquerMarge: boolean): ColumnDef<BesoinSemence>[] {
  return [
    ...baseColumns,
    {
      accessorKey: "doseSemis",
      header: "Dose",
      cell: ({ row }) => {
        const v = row.original.doseSemis
        if (v === null || v === undefined) return "-"
        return `${v} ${uniteLabel(row.original.uniteDose)}`
      },
    },
    {
      accessorKey: "grainesNecessaires",
      header: appliquerMarge ? "Graines (g) avec marge" : "Graines (g) sans marge",
      cell: ({ row }) => <GrainesTooltip b={row.original} appliquerMarge={appliquerMarge} />,
    },
    {
      accessorKey: "stockActuel",
      header: "Stock (g)",
      cell: ({ getValue }) => `${(getValue() as number).toFixed(1)} g`,
    },
    {
      accessorKey: "aCommander",
      header: "À commander",
      cell: ({ row }) => {
        const cible = appliquerMarge ? row.original.grainesNecessaires : brutGraines(row.original)
        const v = Math.max(0, cible - row.original.stockActuel)
        return v > 0 ? `${v.toFixed(1)} g` : "—"
      },
    },
    {
      accessorKey: "statut",
      header: "Statut",
      cell: ({ row }) => <StatutBadge statut={row.original.statut} />,
    },
  ]
}

function makePlantsColumns(appliquerMarge: boolean): ColumnDef<BesoinSemence>[] {
  return [
    ...baseColumns,
    {
      accessorKey: "nbGrainesG",
      header: "Graines/g",
      cell: ({ getValue }) => {
        const v = getValue() as number | null
        return v ? v.toLocaleString() : "-"
      },
    },
    {
      accessorKey: "grainesNecessaires",
      header: appliquerMarge ? "Graines (g) avec marge" : "Graines (g) sans marge",
      cell: ({ row }) => {
        const v = appliquerMarge ? row.original.grainesNecessaires : brutGraines(row.original)
        return `${v.toFixed(1)} g`
      },
    },
    {
      accessorKey: "stockActuel",
      header: "Stock (g)",
      cell: ({ getValue }) => `${(getValue() as number).toFixed(1)} g`,
    },
    {
      accessorKey: "aCommander",
      header: "À commander",
      cell: ({ row }) => {
        const cible = appliquerMarge ? row.original.grainesNecessaires : brutGraines(row.original)
        const v = Math.max(0, cible - row.original.stockActuel)
        return v > 0 ? `${v.toFixed(1)} g` : "—"
      },
    },
    {
      accessorKey: "statut",
      header: "Statut",
      cell: ({ row }) => <StatutBadge statut={row.original.statut} />,
    },
  ]
}

// Feedback Marc 2026-05-16 — V3 Bug 7 : « Caïeux » est trompeur pour
// les tubercules (Pomme de terre, Topinambour). On adopte un libellé
// générique « Bulbilles / tubercules » et on adapte la cellule selon
// l'espèce pour ne plus rebuter l'agriculteur.
const isTubercule = (especeId: string): boolean => {
  return /pomme de terre|patate|topinambour|crosne/i.test(especeId)
}

const caieuxColumns: ColumnDef<BesoinSemence>[] = [
  ...baseColumns,
  {
    accessorKey: "besoinCaieux",
    header: "Bulbilles / tubercules nécessaires",
    cell: ({ row }) => {
      const v = row.original.besoinCaieux
      const unite = isTubercule(row.original.especeId) ? "tubercules" : "caïeux"
      return `${v.toLocaleString()} ${unite}`
    },
  },
  {
    accessorKey: "stockUnites",
    header: "Stock (unités)",
    cell: ({ getValue }) => (getValue() as number).toLocaleString(),
  },
  {
    accessorKey: "caieuxACommander",
    header: "À commander",
    cell: ({ row }) => {
      const v = row.original.caieuxACommander
      const unite = isTubercule(row.original.especeId) ? "tubercules" : "unités"
      return v > 0 ? `${v.toLocaleString()} ${unite}` : "—"
    },
  },
  {
    accessorKey: "statut",
    header: "Statut",
    cell: ({ row }) => <StatutBadge statut={row.original.statut} />,
  },
]

function SemencesContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<BesoinSemence[]>([])
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(
    parseInt(searchParams.get("annee") || new Date().getFullYear().toString())
  )
  // BUG-01 audit Marc : toggle pour basculer entre besoin brut et besoin
  // majoré (marge sécurité). Persistence via localStorage afin que la
  // préférence du maraîcher tienne d'une session à l'autre.
  const [appliquerMarge, setAppliquerMarge] = React.useState<boolean>(true)
  React.useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("planif.appliquerMarge") : null
    if (stored === "false") setAppliquerMarge(false)
  }, [])
  const toggleMarge = React.useCallback((next: boolean) => {
    setAppliquerMarge(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("planif.appliquerMarge", next ? "true" : "false")
    }
  }, [])

  const grainesColumns = React.useMemo(() => makeGrainesColumns(appliquerMarge), [appliquerMarge])
  const plantsColumns = React.useMemo(() => makePlantsColumns(appliquerMarge), [appliquerMarge])

  const annees = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)
  }, [])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/planification/semences?annee=${annee}`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setStats(result.stats)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les besoins en semences",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExport = () => {
    const headers = [
      "Espèce",
      "Variété",
      "Mode",
      "Surface (m²)",
      "Nb plants",
      "Graines nec. (g)",
      "Caïeux nec.",
      "Stock (g)",
      "Stock (unités)",
      "À commander (g)",
      "À commander (caïeux)",
      "Statut",
    ]
    const rows = data.map(b => [
      b.especeId,
      b.varieteId || "",
      b.mode,
      b.surfaceTotale.toFixed(1),
      b.nbPlants.toString(),
      b.grainesNecessaires.toFixed(1),
      b.besoinCaieux.toString(),
      b.stockActuel.toFixed(1),
      b.stockUnites.toString(),
      b.aCommander.toFixed(1),
      b.caieuxACommander.toString(),
      b.statut,
    ])

    const csv = [headers, ...rows].map(r => r.join(";")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `semences-necessaires-${annee}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Bug #10 — Aligner le filtrage table avec le compteur d'onglet :
  // les besoins IGNORE (statut neutre, hors plan) ne doivent pas gonfler
  // l'affichage (« Graines nécessaires (5) » vs 7 lignes dans le tableau).
  const graineDirecte = data.filter(b => b.mode === "graine_directe" && b.statut !== "IGNORE")
  const plantRepique = data.filter(b => b.mode === "plant_repique" && b.statut !== "IGNORE")
  const bulbeCaieu = data.filter(b => b.mode === "bulbe_caieu" && b.statut !== "IGNORE")

  // BUG-01 : total brut sommé ligne à ligne (chaque espèce peut avoir une
  // marge différente). Le serveur ne renvoie que le total majoré.
  const totalGrainesBrut = data
    .filter(b => b.mode === "graine_directe" || b.mode === "plant_repique")
    .reduce((s, b) => s + brutGraines(b), 0)
  const totalGrainesMarge = stats?.totalGraines ?? 0
  const grainesAffichees = appliquerMarge ? totalGrainesMarge : totalGrainesBrut
  const margeCumulee = Math.max(0, totalGrainesMarge - totalGrainesBrut)

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/?tab=planification">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Planification
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Sprout className="h-6 w-6 text-orange-600" />
              <h1 className="text-xl font-bold">Semences nécessaires</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 border rounded-md px-3 py-1.5 bg-white">
              <Switch
                id="toggle-marge"
                checked={appliquerMarge}
                onCheckedChange={toggleMarge}
              />
              <Label htmlFor="toggle-marge" className="text-xs cursor-pointer">
                Marge sécurité
              </Label>
            </div>
            <Link href="/maraichage/stocks">
              <Button variant="outline" size="sm">
                <Package className="h-4 w-4 mr-2" />
                Gérer stocks
              </Button>
            </Link>
            <Select
              value={annee.toString()}
              onValueChange={(value) => setAnnee(parseInt(value))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {annees.map((a) => (
                  <SelectItem key={a} value={a.toString()}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Alerte stock obsolète */}
        {stats?.stockObsolete && (
          <Card className="mb-4 border-amber-300 bg-amber-50">
            <CardContent className="py-3 flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                Inventaire stock semences non mis à jour depuis plus de{" "}
                <strong>{stats.stockObsoleteSeuilJours} jours</strong>. Les
                statuts ci-dessous peuvent être inexacts.{" "}
                <Link
                  href="/maraichage/stocks"
                  className="underline underline-offset-2 hover:text-amber-900"
                >
                  Mettre à jour
                </Link>
                .
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Espèces</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.nbEspeces}</p>
                {/* BUG #11 (audit Marc 2026-05-15) : le KPI Espèces (16)
                    ne matchait pas la somme des lignes affichées
                    (8 graines + 7 plants + 2 caïeux = 17). C'est
                    attendu — certaines espèces apparaissent dans 2
                    onglets (graines + plants à produire en pépinière).
                    On expose le breakdown pour lever l'ambiguïté. */}
                <p className="text-[10px] text-muted-foreground mt-1">
                  {stats.nbGraineDirecte} graine{stats.nbGraineDirecte > 1 ? 's' : ''}
                  {' · '}
                  {stats.nbPlantRepique} plant{stats.nbPlantRepique > 1 ? 's' : ''}
                  {' · '}
                  {stats.nbBulbeCaieu} caïeu{stats.nbBulbeCaieu > 1 ? 'x' : ''}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Graines nécessaires
                  {appliquerMarge && <span className="text-[10px] ml-1">(+ marge)</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{grainesAffichees.toFixed(0)} g</p>
                {appliquerMarge && margeCumulee > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    dose×surface {totalGrainesBrut.toFixed(0)} g + marges {margeCumulee.toFixed(0)} g
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {stats.nbGraineDirecte + stats.nbPlantRepique} besoins (sans marge)
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  Caïeux nécessaires
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalCaieux.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{stats.nbBulbeCaieu} espèce(s)</p>
              </CardContent>
            </Card>
            <Card
              className={stats.nbMissing + stats.nbLow > 0 ? "border-red-200 bg-red-50" : ""}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">À commander</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {stats.totalACommander.toFixed(0)} g
                  {stats.totalCaieuxACommander > 0 && (
                    <span className="text-base font-normal">
                      {" "}
                      + {stats.totalCaieuxACommander} caïeux
                    </span>
                  )}
                </p>
                {stats.nbMissing + stats.nbLow > 0 && (
                  <p className="text-sm text-red-600">
                    {/* BUG-15 + BUG #26 (audit Marc 2026-05-15) : breakdown
                        explicite graines / caïeux. Accord en nombre :
                        « manquant » au singulier si total = 1, « manquants »
                        sinon. */}
                    {stats.nbMissingGraines !== undefined && stats.nbMissingCaieux !== undefined
                      ? (() => {
                        const totalMiss = stats.nbMissingGraines + stats.nbMissingCaieux
                        const totalLow = (stats.nbLowGraines ?? 0) + (stats.nbLowCaieux ?? 0)
                        const manquantWord = totalMiss <= 1 ? 'manquant' : 'manquants'
                        const insuffisantWord = totalLow <= 1 ? 'insuffisant' : 'insuffisants'
                        return (
                          <>
                            {stats.nbMissingGraines} graine(s)
                            {stats.nbMissingCaieux > 0 && ` + ${stats.nbMissingCaieux} caïeux`} {manquantWord}
                            {totalLow > 0 && (
                              <> · {(stats.nbLowGraines ?? 0)} graine(s)
                                {(stats.nbLowCaieux ?? 0) > 0 && ` + ${stats.nbLowCaieux} caïeux`} {insuffisantWord}
                              </>
                            )}
                          </>
                        )
                      })()
                      : `${stats.nbMissing} ${stats.nbMissing <= 1 ? 'manquant' : 'manquants'} · ${stats.nbLow} ${stats.nbLow <= 1 ? 'insuffisant' : 'insuffisants'}`}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="graines">
          <TabsList>
            <TabsTrigger value="graines">
              Graines nécessaires
              {stats && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({stats.nbGraineDirecte})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="plants">
              Plants à produire
              {stats && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({stats.nbPlantRepique})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="caieux">
              Bulbilles / tubercules
              {stats && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({stats.nbBulbeCaieu})
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="graines">
            <DataTable
              columns={grainesColumns}
              data={graineDirecte}
              isLoading={isLoading}
              pageCount={1}
              pageIndex={0}
              pageSize={graineDirecte.length || 50}
              onPaginationChange={() => {}}
              onRefresh={fetchData}
              onExport={handleExport}
              searchPlaceholder="Rechercher..."
              emptyMessage="Aucune culture en semis direct planifiée."
            />
          </TabsContent>

          <TabsContent value="plants">
            <DataTable
              columns={plantsColumns}
              data={plantRepique}
              isLoading={isLoading}
              pageCount={1}
              pageIndex={0}
              pageSize={plantRepique.length || 50}
              onPaginationChange={() => {}}
              onRefresh={fetchData}
              onExport={handleExport}
              searchPlaceholder="Rechercher..."
              emptyMessage="Aucune culture à repiquer planifiée."
            />
          </TabsContent>

          <TabsContent value="caieux">
            <DataTable
              columns={caieuxColumns}
              data={bulbeCaieu}
              isLoading={isLoading}
              pageCount={1}
              pageIndex={0}
              pageSize={bulbeCaieu.length || 50}
              onPaginationChange={() => {}}
              onRefresh={fetchData}
              onExport={handleExport}
              searchPlaceholder="Rechercher..."
              emptyMessage="Aucune culture en caieux/bulbes planifiée."
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default function SemencesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <SemencesContent />
    </Suspense>
  )
}
