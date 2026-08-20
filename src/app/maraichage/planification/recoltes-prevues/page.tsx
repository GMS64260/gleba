"use client"

/**
 * Page Recoltes prevues par mois
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useAnneePlanification } from "@/hooks/use-annee-planification"
import { ArrowLeft, BarChart3 } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { libelleUniteQuantite, type UniteQuantite } from "@/lib/recolte/projection"
import {
  arrondirQuantites,
  formatQuantite,
  formatQuantiteParUnite,
  fusionnerQuantites,
  quantitesNonNulles,
  type QuantiteParUnite,
} from "@/lib/recolte/quantites"

interface RecoltePrevue {
  periode: string
  periodeNum: number
  especes: {
    especeId: string
    especeNom?: string
    especeCouleur: string | null
    quantite: number
    quantiteParUnite?: QuantiteParUnite
    surface: number
  }[]
  totalKg: number
  totalParUnite?: QuantiteParUnite
  totalSurface: number
}

interface Stats {
  totalAnnee: number
  realiseesKg?: number
  projectionKg?: number
  projectionRotationsKg?: number
  totalAttenduKg?: number
  // Ventilations par unité (2026-08-20) : les champs en kilos ci-dessus n'en
  // sont que la part pondérale. Un compte de fleurs coupées les lit à zéro.
  totalAnneeParUnite?: QuantiteParUnite
  realiseesParUnite?: QuantiteParUnite
  projectionParUnite?: QuantiteParUnite
  projectionRotationsParUnite?: QuantiteParUnite
  totalAttenduParUnite?: QuantiteParUnite
  meilleureQuantiteParUnite?: QuantiteParUnite
  surfaceTotale: number
  meilleurePeriode: string
  meilleureQuantite: number
}

function RecoltesPrevuesContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<RecoltePrevue[]>([])
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  // QA cmswwu5cc — l'année du hub Planification vit dans une seule source
  // (URL, puis saison mémorisée du module) : voir useAnneePlanification.
  const { annee, definirAnnee, annees, pret: anneePrete } = useAnneePlanification()


  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/planification/recoltes-prevues?annee=${annee}&groupBy=mois`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setStats(result.stats)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les récoltes prévues",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    // Ne pas charger la saison courante avant d'avoir restauré la saison
    // mémorisée : la réponse tardive écraserait les données de la bonne année.
    if (!anneePrete) return
    fetchData()
  }, [anneePrete, fetchData])

  /*
    Préparer les données du graphique. UNE SÉRIE PAR UNITÉ (2026-08-20) : la
    seule série « kg » laissait le graphique vide pour un compte de fleurs
    coupées, alors que son tableau était plein. Les échelles ne sont pas
    comparables entre unités — 12 kg et 360 tiges dans le même repère — mais
    chaque barre est nommée, ce qui vaut mieux qu'une donnée absente ou, pire,
    additionnée.
  */
  const unitesPresentes = quantitesNonNulles(
    arrondirQuantites(fusionnerQuantites(...data.map((r) => r.totalParUnite ?? {}))),
  ).map((e) => e.unite)

  const chartData = data.map((r) => {
    const ligne: Record<string, string | number> = { mois: r.periode.substring(0, 3) }
    for (const unite of unitesPresentes) {
      ligne[unite] = r.totalParUnite?.[unite] ?? 0
    }
    return ligne
  })

  const COULEUR_UNITE: Record<UniteQuantite, string> = {
    kg: "#9333ea",
    tige: "#db2777",
    piece: "#0891b2",
    botte: "#16a34a",
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        {/* Responsive 360px — retour + titre débordent sinon */}
        <div className="flex items-center gap-4 flex-wrap">
          <Link href="/?tab=planification">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Planification
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-purple-600" />
            <h1 className="text-xl font-bold">Récoltes prévues par mois</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {stats && (
            <Badge variant="outline" className="text-lg">
              {formatQuantiteParUnite(
                stats.totalAttenduParUnite ?? stats.totalAnneeParUnite ?? {},
              )}{" "}
              attendu
            </Badge>
          )}
          <Select
            value={annee.toString()}
            onValueChange={(value) => definirAnnee(parseInt(value))}
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

      <main>
        {/* BUG-03 : 3 stat cards qui partagent la même source que Calendrier/Récoltes */}
        {stats && (stats.realiseesKg !== undefined || stats.projectionKg !== undefined) && (
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card className="border-emerald-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Récoltes réalisées</CardTitle>
                <CardDescription className="text-[10px]">données saisies cette année</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatQuantiteParUnite(stats.realiseesParUnite ?? {})}
                </p>
              </CardContent>
            </Card>
            <Card className="border-purple-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Projection restante</CardTitle>
                <CardDescription className="text-[10px]">cultures × rendement à récolter</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-purple-600">
                  {formatQuantiteParUnite(stats.projectionParUnite ?? {})}
                </p>
                {/* QA cmswxpaer — la part venant des rotations non encore créées
                    est nommée : c'est ce qui explique l'écart avec la liste
                    Cultures, et son absence faisait afficher « 0 kg attendu »
                    face à un tableau mensuel garni. */}
                {(stats.projectionRotationsKg ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    dont {formatQuantiteParUnite(stats.projectionRotationsParUnite ?? {})} de cultures prévues par vos
                    rotations, pas encore créées
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="border-slate-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total attendu {annee}</CardTitle>
                <CardDescription className="text-[10px]">réalisé + projection</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatQuantiteParUnite(
                    stats.totalAttenduParUnite ?? stats.totalAnneeParUnite ?? {},
                  )}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Onglets */}
        <div className="flex gap-2 mb-4">
          <Link href={`/maraichage/planification/recoltes-prevues?annee=${annee}`}>
            <Button variant="default" size="sm">
              Par mois
            </Button>
          </Link>
          <Link href={`/maraichage/planification/recoltes-prevues/par-semaines?annee=${annee}`}>
            <Button variant="outline" size="sm">
              Par semaines
            </Button>
          </Link>
        </div>

        {/* Graphique */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Récoltes mensuelles prévues</CardTitle>
            <CardDescription>
              Quantité par mois pour {annee}
              {unitesPresentes.length > 1 && " — une série par unité, les échelles ne se comparent pas"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mois" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => [
                      formatQuantite(Number(value), name as UniteQuantite),
                      "Récolte",
                    ]}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  {(unitesPresentes.length > 0 ? unitesPresentes : (["kg"] as UniteQuantite[])).map(
                    (unite) => (
                      <Bar
                        key={unite}
                        dataKey={unite}
                        name={libelleUniteQuantite(unite)}
                        fill={COULEUR_UNITE[unite]}
                        radius={[4, 4, 0, 0]}
                      />
                    ),
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tableau */}
        <Card>
          <CardHeader>
            <CardTitle>Détail par mois</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mois</TableHead>
                    <TableHead>Espèces</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Surface (m²)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={r.periode} className={r.totalKg === 0 ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{r.periode}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.especes.slice(0, 5).map((e) => (
                            <Badge
                              key={e.especeId}
                              variant="outline"
                              className="text-xs"
                              style={{
                                borderColor: e.especeCouleur || undefined,
                                backgroundColor: e.especeCouleur ? `${e.especeCouleur}20` : undefined,
                              }}
                            >
                              {e.especeNom ?? e.especeId}:{" "}
                              {formatQuantiteParUnite(e.quantiteParUnite ?? {})}
                            </Badge>
                          ))}
                          {r.especes.length > 5 && (
                            <Badge variant="secondary" className="text-xs">
                              +{r.especes.length - 5}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatQuantiteParUnite(r.totalParUnite ?? {})}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.totalSurface.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default function RecoltesPrevuesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <RecoltesPrevuesContent />
    </Suspense>
  )
}
