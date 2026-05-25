"use client"

/**
 * Onglet Dashboard & Soins - Vue d'ensemble de l'elevage
 * Stats, alertes, graphiques, et soins à planifier
 */

import * as React from "react"
import Link from "next/link"
import {
  Bird,
  Egg,
  TrendingUp,
  Scissors,
  Stethoscope,
  AlertTriangle,
  Package,
  Check,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BulkActions } from "@/components/calendrier/BulkActions"
import { useToast } from "@/hooks/use-toast"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"

interface DashboardTabProps {
  year: number
}

interface DashboardData {
  stats: {
    animauxActifs: number
    lotsActifs: number
    animauxEnLots?: number
    animauxTotal?: number
    productionOeufsAnnee: number
    productionOeufsAnneePrecedente: number
    ventesAnnee: number
    ventesAnneePrecedente: number
    nbVentes: number
    abattagesAnnee: number
    poidsCarcasseAnnee: number
    soinsAPlanifier: number
    alimentsStockBas: number
    stockOeufs: number
    stockOeufsDetail: { produits: number; casses: number; sales?: number; vendus: number }
    mortaliteAnnee: number
    tauxMortalite: number
    tauxPonte: number | null
    nbPondeuses: number
    fcr: number | null
    consoAlimentsKg: number
    // PROMPT 17 — KPI lait
    laitTotalAnnee?: number
    laitMoyenJourJ30?: number
    laitStockTransformable?: number
    nbCollectesAnnee?: number
    tauxPonteSaisonAttendu?: number | null
  }
  animauxParType: {
    especeAnimaleId: string
    nom: string
    couleur: string | null
    count: number
  }[]
  productionOeufsMois: {
    mois: number
    total: number
  }[]
}

interface SoinItem {
  id: number
  date: string
  type: string
  description: string | null
  produit: string | null
  cout: number | null
  fait: boolean
  datePrevue: string | null
  animal: { id: number; nom: string; identifiant: string } | null
  lot: { id: number; nom: string } | null
}

const MOIS_LABELS = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec']
const COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const TYPE_LABELS: Record<string, string> = {
  vaccination: "Vaccination",
  vermifuge: "Vermifuge",
  traitement: "Traitement",
  autre: "Autre",
}

export function DashboardTab({ year }: DashboardTabProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [data, setData] = React.useState<DashboardData | null>(null)
  const [soins, setSoins] = React.useState<SoinItem[]>([])
  const [loadingSoins, setLoadingSoins] = React.useState(true)

  // Charger stats dashboard
  React.useEffect(() => {
    async function fetchStats() {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/elevage/stats?annee=${year}`)
        if (response.ok) {
          setData(await response.json())
        }
      } catch {
        // silent
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [year])

  // Charger soins a faire
  const fetchSoins = React.useCallback(async () => {
    setLoadingSoins(true)
    try {
      const res = await fetch('/api/elevage/soins?fait=false&limit=20')
      if (res.ok) {
        const result = await res.json()
        setSoins(result.data || [])
      }
    } catch {
      // silent
    } finally {
      setLoadingSoins(false)
    }
  }, [])

  React.useEffect(() => {
    fetchSoins()
  }, [fetchSoins])

  // PROMPT 20a — Bulk actions sur les soins
  const bulkSoinsDone = async () => {
    const ids = soins.map((s) => s.id)
    if (ids.length === 0) return
    setSoins([]) // optimistic
    try {
      await Promise.all(
        ids.map((id) =>
          fetch('/api/elevage/soins', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, fait: true, date: new Date().toISOString() }),
          })
        )
      )
      toast({ title: `${ids.length} soin(s) marqué(s) comme fait(s)` })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur, recharge en cours' })
      fetchSoins()
    }
  }
  const bulkSoinsReport = async (days: number) => {
    const ids = soins.filter((s) => s.datePrevue).map((s) => s.id)
    if (ids.length === 0) return
    try {
      const res = await fetch('/api/soins/bulk-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, days }),
      })
      if (!res.ok) throw new Error('Échec')
      toast({ title: `${ids.length} soin(s) reporté(s) de ${days} jour(s)` })
      fetchSoins()
    } catch {
      toast({ variant: 'destructive', title: 'Erreur' })
    }
  }
  const bulkSoinsReportTo = async (date: string) => {
    const ids = soins.map((s) => s.id)
    if (ids.length === 0) return
    try {
      const res = await fetch('/api/soins/bulk-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, date }),
      })
      if (!res.ok) throw new Error('Échec')
      toast({ title: `${ids.length} soin(s) reporté(s) au ${new Date(date).toLocaleDateString('fr-FR')}` })
      fetchSoins()
    } catch {
      toast({ variant: 'destructive', title: 'Erreur' })
    }
  }

  // Toggle soin fait
  const toggleSoin = async (id: number, fait: boolean) => {
    try {
      const response = await fetch('/api/elevage/soins', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, fait: !fait, date: !fait ? new Date().toISOString() : undefined }),
      })
      if (!response.ok) throw new Error('Erreur')
      setSoins(prev => prev.filter(s => s.id !== id))
      toast({ title: "Soin marque comme fait !" })
    } catch {
      toast({ variant: "destructive", title: "Erreur" })
    }
  }

  // Preparer donnees graphique production oeufs par mois
  // Feedback Marc 2026-05-16 — V4 Bug 3 : la requête $queryRaw renvoie
  // `mois` typé `Prisma.Decimal` (sérialisé en string dans certains cas)
  // et `total` en `bigint`. Le mapping côté API faisait déjà `Number()`,
  // mais on blinde ici en cas de désynchronisation type (chart vide alors
  // que les 1345 œufs/2026 existent en base).
  const productionMoisData = React.useMemo(() => {
    if (!data?.productionOeufsMois) return []
    const map = new Map<number, number>()
    for (const p of data.productionOeufsMois) {
      const m = Number(p.mois)
      const t = Number(p.total)
      if (Number.isFinite(m) && Number.isFinite(t)) map.set(m, t)
    }
    return MOIS_LABELS.map((label, i) => ({
      mois: label,
      oeufs: map.get(i + 1) ?? 0,
    }))
  }, [data])

  return (
    <div className="space-y-6">
      {/* Mini-stats */}
      {isLoading ? (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : data && (
        <>
          {/* Ligne 1 : Stats principales avec tendances N-1 */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            {/* BUG #8 (audit Julien 15/05/2026) — Avant : « 6 + 3 lots » faisait
                lire « 6 animaux » et paniquer l'éleveur. On affiche désormais
                le total cheptel en gros (individus + animaux en lots) + le
                détail en sous-titre. Click = navigation vers Animaux & Lots. */}
            {(() => {
              const total = data.stats.animauxTotal ?? data.stats.animauxActifs
              const individus = data.stats.animauxActifs
              const enLots = data.stats.animauxEnLots ?? 0
              const nbLots = data.stats.lotsActifs
              // Bug cmp8rw40u (Marc 2026-05-16) — "2 lots" comptait les lots
              // ACTIFS mais la page Lots affiche tous les lots (terminés inclus),
              // d'où l'incohérence visuelle. On précise "actif" dans le label
              // pour lever l'ambiguïté.
              const sousTitre =
                total === 0
                  ? null
                  : enLots > 0
                  ? `${individus} individu${individus > 1 ? 's' : ''} · ${enLots} en lot${enLots > 1 ? 's' : ''} (${nbLots} lot${nbLots > 1 ? 's' : ''} actif${nbLots > 1 ? 's' : ''})`
                  : `${individus} individu${individus > 1 ? 's' : ''}`
              return (
                <Link href="/elevage/animaux" className="block">
                  <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 transition-colors cursor-pointer">
                    <CardHeader className="pb-1 pt-3 px-4">
                      <CardDescription className="text-amber-100 text-xs">Animaux actifs</CardDescription>
                      <CardTitle className="text-2xl">
                        {total === 0 ? 'Aucun animal' : `${total} animau${total > 1 ? 'x' : ''}`}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                      {sousTitre ? (
                        <p className="text-xs text-amber-100">{sousTitre}</p>
                      ) : (
                        <p className="text-xs text-amber-100">Ajoutez votre premier animal</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })()}

            <Card className="bg-gradient-to-br from-slate-700 to-slate-800 text-white">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-slate-300 text-xs flex items-center gap-1">
                  Production œufs
                  {(() => {
                    const diff = data.stats.productionOeufsAnnee - data.stats.productionOeufsAnneePrecedente
                    if (data.stats.productionOeufsAnneePrecedente === 0) return null
                    return diff >= 0
                      ? <TrendingUp className="h-3 w-3 text-slate-300" />
                      : <TrendingDown className="h-3 w-3 text-red-300" />
                  })()}
                </CardDescription>
                <CardTitle className="text-2xl">{data.stats.productionOeufsAnnee}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className="text-xs text-slate-300">
                  {data.stats.productionOeufsAnneePrecedente > 0
                    ? `${data.stats.productionOeufsAnnee >= data.stats.productionOeufsAnneePrecedente ? '+' : ''}${Math.round(((data.stats.productionOeufsAnnee - data.stats.productionOeufsAnneePrecedente) / data.stats.productionOeufsAnneePrecedente) * 100)}% vs ${year - 1}`
                    : `oeufs en ${year}`
                  }
                </p>
              </CardContent>
            </Card>

            <Card className={`bg-gradient-to-br ${data.stats.stockOeufs < 24 ? "from-orange-500 to-orange-600" : "from-emerald-500 to-emerald-600"} text-white`}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className={`text-xs ${data.stats.stockOeufs < 24 ? "text-orange-100" : "text-emerald-100"}`}>Stock œufs</CardDescription>
                <CardTitle className="text-2xl">{data.stats.stockOeufs}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className={`text-xs ${data.stats.stockOeufs < 24 ? "text-orange-100" : "text-emerald-100"}`}>disponibles</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-emerald-100 text-xs flex items-center gap-1">
                  Ventes {year}
                  {(() => {
                    const diff = data.stats.ventesAnnee - data.stats.ventesAnneePrecedente
                    if (data.stats.ventesAnneePrecedente === 0) return null
                    return diff >= 0
                      ? <TrendingUp className="h-3 w-3 text-emerald-200" />
                      : <TrendingDown className="h-3 w-3 text-red-200" />
                  })()}
                </CardDescription>
                <CardTitle className="text-2xl">{data.stats.ventesAnnee.toFixed(0)} &euro;</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                {/* Feedback Marc 2026-05-16 — V4 Bug 4 : on signale
                    l'incohérence « X ventes / 0 € » (prix de vente non
                    renseignés) pour éviter la lecture trompeuse
                    « Ventes 0 € » alors qu'on en a une à 0 €. */}
                <p className="text-xs text-emerald-100">
                  {data.stats.ventesAnneePrecedente > 0
                    ? `${data.stats.ventesAnnee >= data.stats.ventesAnneePrecedente ? '+' : ''}${Math.round(((data.stats.ventesAnnee - data.stats.ventesAnneePrecedente) / data.stats.ventesAnneePrecedente) * 100)}% vs ${year - 1}`
                    : `${data.stats.nbVentes} vente${data.stats.nbVentes > 1 ? 's' : ''}${data.stats.nbVentes > 0 && data.stats.ventesAnnee === 0 ? ' (prix manquants)' : ''}`
                  }
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-orange-100 text-xs">Abattages {year}</CardDescription>
                <CardTitle className="text-2xl">{data.stats.abattagesAnnee}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                {/* Feedback Marc 2026-05-16 — V4 Bug 4 : si poids vif > 0
                    mais carcasse à 0, on signale l'incohérence agronomique
                    (perte de rendement ~30% normale entre vif et carcasse). */}
                <p className="text-xs text-orange-100">
                  {data.stats.poidsCarcasseAnnee > 0
                    ? `${data.stats.poidsCarcasseAnnee.toFixed(1)} kg carcasse`
                    : data.stats.abattagesAnnee > 0
                      ? "Poids carcasse à compléter"
                      : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Ligne 2 : Métriques de performance */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {data.stats.tauxPonte !== null && (
              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1">
                    <Egg className="h-3 w-3" />
                    Taux de ponte (saisonnalisé)
                  </CardDescription>
                  <CardTitle className={`text-2xl ${data.stats.tauxPonte >= 70 ? 'text-green-600' : data.stats.tauxPonte >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                    {data.stats.tauxPonte}%
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">
                    {data.stats.nbPondeuses} pondeuses
                    {data.stats.tauxPonteSaisonAttendu != null && (
                      <> — attendu période ≈ {data.stats.tauxPonteSaisonAttendu}%</>
                    )}
                  </p>
                </CardContent>
              </Card>
            )}
            {/* PROMPT 17 — KPI Lait */}
            {data.stats.laitMoyenJourJ30 != null && data.stats.laitMoyenJourJ30 > 0 && (
              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1">
                    🥛 Production lait (30 j)
                  </CardDescription>
                  <CardTitle className="text-2xl text-blue-700">
                    {data.stats.laitMoyenJourJ30} L/j
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">{data.stats.nbCollectesAnnee ?? 0} collectes cette année</p>
                </CardContent>
              </Card>
            )}
            {data.stats.laitStockTransformable != null && data.stats.laitStockTransformable > 0 && (
              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1">
                    📦 Stock lait transformable
                  </CardDescription>
                  <CardTitle className="text-2xl text-cyan-700">
                    {data.stats.laitStockTransformable} L
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">non affecté à un lot</p>
                </CardContent>
              </Card>
            )}
            {data.stats.mortaliteAnnee > 0 && (
              <Card className={data.stats.tauxMortalite > 5 ? "border-red-200 bg-red-50" : ""}>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Mortalite {year}
                  </CardDescription>
                  <CardTitle className={`text-2xl ${data.stats.tauxMortalite > 5 ? 'text-red-600' : 'text-slate-700'}`}>
                    {data.stats.mortaliteAnnee}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">taux : {data.stats.tauxMortalite}%</p>
                </CardContent>
              </Card>
            )}
            {data.stats.fcr !== null && (
              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    Indice conso. (FCR)
                  </CardDescription>
                  <CardTitle className="text-2xl">{data.stats.fcr}</CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">kg aliment / kg carcasse</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-xs flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Alimentation {year}
                </CardDescription>
                <CardTitle className="text-2xl">{data.stats.consoAlimentsKg} kg</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className="text-xs text-muted-foreground">total distribue</p>
              </CardContent>
            </Card>
          </div>

          {/* Alertes */}
          {(data.stats.soinsAPlanifier > 0 || data.stats.alimentsStockBas > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {data.stats.soinsAPlanifier > 0 && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-700 flex items-center gap-2">
                      <Stethoscope className="h-4 w-4" />
                      Soins a planifier
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-blue-800">
                      {data.stats.soinsAPlanifier} soin(s) prevu(s) dans les 30 prochains jours
                    </p>
                  </CardContent>
                </Card>
              )}
              {data.stats.alimentsStockBas > 0 && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-orange-700 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Stock aliments bas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-orange-800">
                      {data.stats.alimentsStockBas} aliment(s) a reapprovisionner
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Graphiques */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Production œufs par mois — BUG #7 : axe Y dynamique sur
                max(données) × 1.2 (jamais hardcodé), placeholder « Pas
                encore de données » si l'année est vide plutôt qu'un
                graphe blanc déconcertant. */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Production d&apos;œufs par mois</CardTitle>
                <CardDescription>Année {year}</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const maxOeufs = Math.max(0, ...productionMoisData.map((d) => d.oeufs))
                  if (maxOeufs <= 0) {
                    return (
                      <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground gap-1">
                        <Egg className="h-8 w-8 opacity-30" />
                        <p className="text-sm">Pas encore de collecte sur {year}.</p>
                      </div>
                    )
                  }
                  const yMax = Math.ceil(maxOeufs * 1.2)
                  return (
                    <ChartContainer config={{}} className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={productionMoisData}>
                          <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} domain={[0, yMax]} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="oeufs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Repartition animaux par type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Repartition par espèce</CardTitle>
                <CardDescription>Animaux actifs</CardDescription>
              </CardHeader>
              <CardContent>
                {data.animauxParType.length > 0 ? (
                  <ChartContainer config={{}} className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.animauxParType}
                          dataKey="count"
                          nameKey="nom"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {data.animauxParType.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.couleur || COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="h-[250px] flex flex-col items-center justify-center text-muted-foreground gap-1">
                    <Bird className="h-8 w-8 opacity-30" />
                    <p className="text-sm">Pas encore d&apos;animal enregistré.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Soins à faire */}
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-blue-600" />
            Soins à faire
            {soins.length > 0 && (
              <Badge variant="secondary">{soins.length}</Badge>
            )}
          </h2>
          {/* PROMPT 20a — Actions en masse sur les soins */}
          {soins.length >= 2 && (
            <BulkActions
              count={soins.length}
              markAllLabel={`Tout fait (${soins.length})`}
              onMarkAllDone={bulkSoinsDone}
              onReport={bulkSoinsReport}
              onReportTo={bulkSoinsReportTo}
            />
          )}
        </div>

        {loadingSoins ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : soins.length === 0 ? (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-4">
              <p className="text-sm text-green-700">Tous les soins sont à jour !</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {soins.map((soin) => (
              <button
                key={soin.id}
                onClick={() => toggleSoin(soin.id, soin.fait)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border bg-white border-blue-200 hover:border-blue-400 hover:shadow-sm transition-all text-left"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Stethoscope className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[soin.type] || soin.type}
                    </Badge>
                    <span className="font-medium text-sm truncate">
                      {soin.lot?.nom || soin.animal?.nom || '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {soin.produit && (
                      <span className="text-xs text-muted-foreground">{soin.produit}</span>
                    )}
                    {soin.cout && (
                      <span className="text-xs text-muted-foreground">{soin.cout.toFixed(2)} &euro;</span>
                    )}
                  </div>
                </div>
                {(() => {
                  // Bug cmp8rwths — badge "En retard" si datePrevue (ou date)
                  // est antérieure à aujourd'hui et soin pas encore fait.
                  const ref = soin.datePrevue ?? (!soin.fait ? soin.date : null)
                  if (!ref) return null
                  const refDate = new Date(ref)
                  const today = new Date(); today.setHours(0, 0, 0, 0)
                  const isLate = !soin.fait && refDate < today
                  return (
                    <span className={`text-xs flex-shrink-0 flex items-center gap-1 ${isLate ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                      {isLate && <AlertTriangle className="h-3 w-3" />}
                      {refDate.toLocaleDateString('fr-FR')}
                      {isLate && ' (en retard)'}
                    </span>
                  )
                })()}
                <Check className="h-4 w-4 text-slate-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
