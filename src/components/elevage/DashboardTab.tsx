"use client"

/**
 * Onglet Dashboard & Soins - Vue d'ensemble de l'élevage
 * Stats, alertes, graphiques, et soins à planifier
 */

import * as React from "react"
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
    productionOeufsAnnee: number
    ventesAnnee: number
    nbVentes: number
    abattagesAnnee: number
    poidsCarcasseAnnee: number
    soinsAPlanifier: number
    alimentsStockBas: number
    stockOeufs: number
    stockOeufsDetail: { produits: number; casses: number; vendus: number }
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
  const productionMoisData = React.useMemo(() => {
    if (!data?.productionOeufsMois) return []
    const map = new Map(data.productionOeufsMois.map(p => [p.mois, p.total]))
    return MOIS_LABELS.map((label, i) => ({
      mois: label,
      oeufs: map.get(i + 1) || 0,
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
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-amber-100 text-xs">Animaux actifs</CardDescription>
                <CardTitle className="text-2xl">{data.stats.animauxActifs}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className="text-xs text-amber-100">+ {data.stats.lotsActifs} lots</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-400 to-yellow-500 text-white">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-yellow-100 text-xs">Production oeufs</CardDescription>
                <CardTitle className="text-2xl">{data.stats.productionOeufsAnnee}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className="text-xs text-yellow-100">oeufs en {year}</p>
              </CardContent>
            </Card>

            <Card className={`bg-gradient-to-br ${data.stats.stockOeufs < 24 ? "from-orange-500 to-red-500" : "from-emerald-500 to-green-500"} text-white`}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-white/80 text-xs">Stock oeufs</CardDescription>
                <CardTitle className="text-2xl">{data.stats.stockOeufs}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className="text-xs text-white/80">disponibles</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-green-100 text-xs">Ventes {year}</CardDescription>
                <CardTitle className="text-2xl">{data.stats.ventesAnnee.toFixed(0)} &euro;</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className="text-xs text-green-100">{data.stats.nbVentes} ventes</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-400 to-red-500 text-white">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardDescription className="text-red-100 text-xs">Abattages {year}</CardDescription>
                <CardTitle className="text-2xl">{data.stats.abattagesAnnee}</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-4">
                <p className="text-xs text-red-100">{data.stats.poidsCarcasseAnnee.toFixed(1)} kg carcasse</p>
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
            {/* Production oeufs par mois */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Production d'oeufs par mois</CardTitle>
                <CardDescription>Annee {year}</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{}} className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={productionMoisData}>
                      <XAxis dataKey="mois" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="oeufs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Repartition animaux par type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Repartition par espece</CardTitle>
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
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    Aucun animal enregistre
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Soins a faire */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-blue-600" />
          Soins a faire
          {soins.length > 0 && (
            <Badge variant="secondary">{soins.length}</Badge>
          )}
        </h2>

        {loadingSoins ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : soins.length === 0 ? (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-4">
              <p className="text-sm text-green-700">Tous les soins sont a jour !</p>
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
                {soin.datePrevue && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {new Date(soin.datePrevue).toLocaleDateString('fr-FR')}
                  </span>
                )}
                <Check className="h-4 w-4 text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
