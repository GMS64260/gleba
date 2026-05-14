"use client"

/**
 * Page des cultures à irriguer — intégration météo complète
 * Affiche l'urgence d'irrigation basée sur le bilan hydrique réel,
 * les précipitations passées/prevues, et l'auto-validation par la pluie.
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Droplets,
  RefreshCw,
  Droplet,
  CloudRain,
  CloudSun,
  CheckCircle2,
  Info,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

interface MeteoResume {
  pluie48h: number
  pluie7j: number
  pluiePrevue48h: number
  pluiePrevue5j: number
  joursSansPluie: number | null
  joursAvantPluie: number | null
}

interface CultureIrriguer {
  id: number
  especeId: string
  varieteId: string | null
  plancheId: string | null
  aIrriguer: boolean | null
  derniereIrrigation: string | null
  nbRangs: number | null
  longueur: number | null
  joursSansEau: number | null
  ageJours: number | null
  isJeune: boolean
  sousAbri: boolean
  urgence: 'critique' | 'haute' | 'moyenne' | 'faible' | 'aucune'
  raisonUrgence: string
  consommationEauSemaine: number
  prochainesIrrigations: number
  irrigationsAutoValidees: number
  meteo: MeteoResume | null
  espece: {
    id: string
    couleur: string | null
    besoinEau: number | null
    irrigation: string | null
  } | null
  planche: {
    id: string
    nom?: string
    ilot: string | null
    type: string | null
    irrigation: string | null
    surface: number | null
    largeur: number | null
    longueur: number | null
  } | null
  variete: {
    id: string
  } | null
}

interface Stats {
  total: number
  nbIlots: number
  critique: number
  haute: number
  aucune: number
  jamaisArrose: number
  prochainesIrrigations7j: number
  irrigationsAutoValidees: number
  consommationTotaleEstimee: number
  parTypeIrrigation: { type: string; count: number }[]
}

function CulturesIrriguerContent() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [data, setData] = React.useState<CultureIrriguer[]>([])
  const [parIlot, setParIlot] = React.useState<Record<string, CultureIrriguer[]>>({})
  const [parTypeIrrigation, setParTypeIrrigation] = React.useState<Record<string, CultureIrriguer[]>>({})
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [meteoGlobal, setMeteoGlobal] = React.useState<MeteoResume | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(
    parseInt(searchParams.get("annee") || new Date().getFullYear().toString())
  )
  const [groupBy, setGroupBy] = React.useState<'ilot' | 'type-irrigation' | 'urgence'>('ilot')
  const [filtreUrgence, setFiltreUrgence] = React.useState<'all' | 'critique' | 'haute' | 'aucune' | 'jamais'>('all')
  const [filtreTypeIrrigation, setFiltreTypeIrrigation] = React.useState<string>('all')
  const [filtreBesoinEau, setFiltreBesoinEau] = React.useState<'all' | '3' | '4'>('all')

  const annees = React.useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 6 }, (_, i) => currentYear - 3 + i)
  }, [])

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/cultures/irriguer?annee=${annee}`)
      if (!response.ok) throw new Error("Erreur lors du chargement")
      const result = await response.json()
      setData(result.data)
      setParIlot(result.parIlot)
      setParTypeIrrigation(result.parTypeIrrigation || {})
      setStats(result.stats)
      setMeteoGlobal(result.meteo || null)
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les cultures a irriguer",
      })
    } finally {
      setIsLoading(false)
    }
  }, [annee, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleIrrigation = async (cultureId: number, currentValue: boolean | null) => {
    try {
      const response = await fetch("/api/cultures/irriguer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cultureId, aIrriguer: !currentValue }),
      })
      if (!response.ok) throw new Error("Erreur")

      setData(prev => prev.map(c =>
        c.id === cultureId ? { ...c, aIrriguer: !currentValue } : c
      ))
      setParIlot(prev => {
        const n: Record<string, CultureIrriguer[]> = {}
        for (const [ilot, cultures] of Object.entries(prev)) {
          n[ilot] = cultures.map(c =>
            c.id === cultureId ? { ...c, aIrriguer: !currentValue } : c
          )
        }
        return n
      })

      toast({
        title: "Mis a jour",
        description: currentValue ? "Irrigation desactivee" : "Irrigation activee",
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre a jour",
      })
    }
  }

  const marquerArrosee = async (cultureId: number) => {
    try {
      const response = await fetch("/api/cultures/irriguer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cultureId, marquerArrosage: true }),
      })
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      const now = result.date

      setData(prev => prev.map(c =>
        c.id === cultureId ? { ...c, derniereIrrigation: now } : c
      ))
      setParIlot(prev => {
        const n: Record<string, CultureIrriguer[]> = {}
        for (const [ilot, cultures] of Object.entries(prev)) {
          n[ilot] = cultures.map(c =>
            c.id === cultureId ? { ...c, derniereIrrigation: now } : c
          )
        }
        return n
      })

      toast({
        title: "Arrosage note",
        description: "Derniere irrigation mise à jour",
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de noter l'arrosage",
      })
    }
  }

  const marquerIlotArrose = async (ilot: string) => {
    const culturesIlot = parIlot[ilot]
    if (!culturesIlot || culturesIlot.length === 0) return

    try {
      const cultureIds = culturesIlot.map(c => c.id)
      const response = await fetch("/api/cultures/irriguer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cultureIds, marquerArrosage: true }),
      })
      if (!response.ok) throw new Error("Erreur")
      const result = await response.json()
      const now = result.date

      setData(prev => prev.map(c =>
        cultureIds.includes(c.id) ? { ...c, derniereIrrigation: now } : c
      ))
      setParIlot(prev => {
        const n: Record<string, CultureIrriguer[]> = {}
        for (const [i, cultures] of Object.entries(prev)) {
          n[i] = cultures.map(c =>
            cultureIds.includes(c.id) ? { ...c, derniereIrrigation: now } : c
          )
        }
        return n
      })

      toast({
        title: "Ilot arrose",
        description: `${culturesIlot.length} culture(s) marquee(s)`,
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de noter l'arrosage",
      })
    }
  }

  const getUrgenceColor = (urgence: string): string => {
    if (urgence === 'critique') return "text-red-600"
    if (urgence === 'haute') return "text-orange-500"
    if (urgence === 'moyenne') return "text-yellow-600"
    if (urgence === 'aucune') return "text-green-600"
    return "text-blue-600"
  }

  const getUrgenceBadge = (urgence: string, jamais: boolean) => {
    if (urgence === 'aucune') return <Badge variant="secondary" className="bg-green-100 text-green-700">OK</Badge>
    if (jamais && urgence !== 'critique') return <Badge variant="secondary" className="bg-slate-100 text-slate-600">Jamais</Badge>
    if (urgence === 'critique') return <Badge variant="destructive">Urgent</Badge>
    if (urgence === 'haute') return <Badge className="bg-orange-500">Priorite</Badge>
    if (urgence === 'moyenne') return <Badge className="bg-yellow-500">Moyen</Badge>
    return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Faible</Badge>
  }

  const getBesoinEauBadge = (besoinEau: number | null, irrigation: string | null) => {
    if (irrigation === 'Eleve' || (besoinEau && besoinEau >= 4)) {
      return <Badge variant="destructive">Eleve</Badge>
    }
    if (besoinEau && besoinEau >= 3) {
      return <Badge variant="default" className="bg-orange-500">Moyen</Badge>
    }
    return <Badge variant="secondary">Faible</Badge>
  }

  const filteredData = React.useMemo(() => {
    let filtered = data

    if (filtreUrgence !== 'all') {
      if (filtreUrgence === 'jamais') {
        filtered = filtered.filter(c => c.joursSansEau === null)
      } else {
        filtered = filtered.filter(c => c.urgence === filtreUrgence)
      }
    }

    if (filtreTypeIrrigation !== 'all') {
      filtered = filtered.filter(c => c.planche?.irrigation === filtreTypeIrrigation)
    }

    if (filtreBesoinEau !== 'all') {
      const seuil = parseInt(filtreBesoinEau)
      filtered = filtered.filter(c => (c.espece?.besoinEau || 0) >= seuil)
    }

    return filtered
  }, [data, filtreUrgence, filtreTypeIrrigation, filtreBesoinEau])

  const groupedData = React.useMemo(() => {
    if (groupBy === 'ilot') {
      const groups: Record<string, typeof filteredData> = {}
      filteredData.forEach(c => {
        const key = c.planche?.ilot || 'Sans ilot'
        if (!groups[key]) groups[key] = []
        groups[key].push(c)
      })
      return groups
    } else if (groupBy === 'type-irrigation') {
      const groups: Record<string, typeof filteredData> = {}
      filteredData.forEach(c => {
        const key = c.planche?.irrigation || 'Non defini'
        if (!groups[key]) groups[key] = []
        groups[key].push(c)
      })
      return groups
    } else {
      const groups: Record<string, typeof filteredData> = {
        'Critique': filteredData.filter(c => c.urgence === 'critique'),
        'Haute': filteredData.filter(c => c.urgence === 'haute'),
        'Moyenne': filteredData.filter(c => c.urgence === 'moyenne'),
        'Faible': filteredData.filter(c => c.urgence === 'faible'),
        'OK (pas besoin)': filteredData.filter(c => c.urgence === 'aucune'),
      }
      Object.keys(groups).forEach(key => {
        if (groups[key].length === 0) delete groups[key]
      })
      return groups
    }
  }, [filteredData, groupBy])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="border-b bg-white sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-64" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/maraichage/cultures">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cultures
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Droplets className="h-6 w-6 text-cyan-600" />
              <h1 className="text-xl font-bold">Irrigation</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
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

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Bandeau meteo */}
        {meteoGlobal && (
          <div className={`mb-4 p-4 rounded-lg border ${
            meteoGlobal.pluie48h >= 8
              ? 'bg-blue-50 border-blue-200'
              : meteoGlobal.joursSansPluie !== null && meteoGlobal.joursSansPluie >= 5
              ? 'bg-orange-50 border-orange-200'
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-start gap-3">
              {meteoGlobal.pluie48h >= 8 ? (
                <CloudRain className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              ) : meteoGlobal.pluiePrevue48h >= 5 ? (
                <CloudRain className="h-5 w-5 text-cyan-600 flex-shrink-0 mt-0.5" />
              ) : (
                <CloudSun className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-medium">
                    {meteoGlobal.pluie48h >= 8
                      ? `Il a plu ${Math.round(meteoGlobal.pluie48h)}mm ces 2 derniers jours`
                      : meteoGlobal.pluie7j >= 10
                      ? `${Math.round(meteoGlobal.pluie7j)}mm de pluie cette semaine`
                      : meteoGlobal.joursSansPluie !== null && meteoGlobal.joursSansPluie >= 3
                      ? `${meteoGlobal.joursSansPluie} jours sans pluie`
                      : 'Conditions normales'}
                  </span>
                  {stats && stats.irrigationsAutoValidees > 0 && (
                    <Badge className="bg-blue-500 text-white">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {stats.irrigationsAutoValidees} irrigation{stats.irrigationsAutoValidees > 1 ? 's' : ''} auto-validee{stats.irrigationsAutoValidees > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>7j: {Math.round(meteoGlobal.pluie7j)}mm</span>
                  <span>48h: {Math.round(meteoGlobal.pluie48h)}mm</span>
                  {meteoGlobal.pluiePrevue48h > 0 && (
                    <span className="text-blue-600">
                      +{Math.round(meteoGlobal.pluiePrevue48h)}mm prevus (48h)
                    </span>
                  )}
                  {meteoGlobal.pluiePrevue5j > 0 && (
                    <span className="text-blue-600">
                      +{Math.round(meteoGlobal.pluiePrevue5j)}mm prevus (5j)
                    </span>
                  )}
                  {meteoGlobal.joursAvantPluie !== null && meteoGlobal.joursAvantPluie > 0 && (
                    <span>Prochaine pluie dans {meteoGlobal.joursAvantPluie}j</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ilot">Grouper par ilot</SelectItem>
              <SelectItem value="type-irrigation">Par type irrigation</SelectItem>
              <SelectItem value="urgence">Par urgence</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtreUrgence} onValueChange={(v: any) => setFiltreUrgence(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Urgence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes urgences</SelectItem>
              <SelectItem value="critique">Critique</SelectItem>
              <SelectItem value="haute">Haute</SelectItem>
              <SelectItem value="aucune">OK (pas besoin)</SelectItem>
              <SelectItem value="jamais">Jamais arrose</SelectItem>
            </SelectContent>
          </Select>

          {stats && stats.parTypeIrrigation.length > 0 && (
            <Select value={filtreTypeIrrigation} onValueChange={setFiltreTypeIrrigation}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type irrigation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {stats.parTypeIrrigation.map(t => (
                  <SelectItem key={t.type} value={t.type}>
                    {t.type} ({t.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={filtreBesoinEau} onValueChange={(v: any) => setFiltreBesoinEau(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Besoin eau" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous besoins</SelectItem>
              <SelectItem value="4">Eleve (4+)</SelectItem>
              <SelectItem value="3">Moyen (3)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-cyan-600" />
                  Cultures suivies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.total}</p>
                {stats.aucune > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    {stats.aucune} n&apos;ont pas besoin d&apos;arrosage
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className={stats.critique > 0 ? "border-red-300 bg-red-50" : stats.critique + stats.haute === 0 ? "border-green-300 bg-green-50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Urgences</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.critique + stats.haute > 0 ? (
                  <>
                    <p className="text-2xl font-bold text-red-600">{stats.critique + stats.haute}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.critique} critique · {stats.haute} haute
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-green-600">0</p>
                    <p className="text-xs text-green-600 mt-1">Aucune urgence</p>
                  </>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Irrigations planifiées</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">{stats.prochainesIrrigations7j}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  restantes (7j)
                  {stats.irrigationsAutoValidees > 0 && (
                    <span className="text-green-600 ml-1">
                      · {stats.irrigationsAutoValidees} auto-validee{stats.irrigationsAutoValidees > 1 ? 's' : ''} par la pluie
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Consommation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-cyan-600">{stats.consommationTotaleEstimee}L</p>
                <p className="text-xs text-muted-foreground mt-1">par semaine (estime)</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Groupes */}
        {Object.keys(groupedData).length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {filtreUrgence !== 'all' || filtreTypeIrrigation !== 'all' || filtreBesoinEau !== 'all'
                ? 'Aucune culture ne correspond aux filtres'
                : `Aucune culture a irriguer pour ${annee}`}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedData).map(([groupe, cultures]) => {
              const consommationGroupe = cultures.reduce((sum, c) => sum + c.consommationEauSemaine, 0)
              const prochainesGroupe = cultures.reduce((sum, c) => sum + c.prochainesIrrigations, 0)
              const okCount = cultures.filter(c => c.urgence === 'aucune').length

              return (
              <Card key={groupe}>
                <CardHeader>
                  <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="whitespace-nowrap">{groupe}</Badge>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {cultures.length} culture(s)
                      </span>
                      {okCount === cultures.length ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Tout OK
                        </Badge>
                      ) : (
                        groupBy === 'ilot' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => marquerIlotArrose(groupe)}
                            className="text-cyan-600 border-cyan-300 hover:bg-cyan-50 whitespace-nowrap"
                          >
                            <Droplet className="h-4 w-4 mr-1" />
                            Tout arroser
                          </Button>
                        )
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <Droplets className="h-3 w-3 text-cyan-600 flex-shrink-0" />
                        <span>{Math.round(consommationGroupe)}L/sem</span>
                      </div>
                      {prochainesGroupe > 0 && (
                        <span className="text-blue-600 whitespace-nowrap">
                          +{prochainesGroupe} a venir
                        </span>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {cultures.map((culture) => {
                      const jamais = culture.joursSansEau === null
                      const urgenceColor = getUrgenceColor(culture.urgence)

                      return (
                        <div
                          key={culture.id}
                          className={`flex flex-col gap-2 p-3 rounded-lg transition-colors ${
                            culture.urgence === 'critique' ? 'bg-red-50 border border-red-200' :
                            culture.urgence === 'haute' ? 'bg-orange-50 border border-orange-200' :
                            culture.urgence === 'aucune' ? 'bg-green-50/50 border border-green-100' :
                            'bg-slate-50'
                          }`}
                        >
                          {/* Ligne principale */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                              <Checkbox
                                checked={culture.aIrriguer || false}
                                onCheckedChange={() => toggleIrrigation(culture.id, culture.aIrriguer)}
                                className="mt-1 sm:mt-0"
                              />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  {culture.espece?.couleur && (
                                    <div
                                      className="w-3 h-3 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: culture.espece.couleur }}
                                    />
                                  )}
                                  <span className="font-medium break-words">{culture.especeId}</span>
                                  {culture.variete && (
                                    <span className="text-sm text-muted-foreground break-words">
                                      ({culture.variete.id})
                                    </span>
                                  )}
                                  {culture.sousAbri && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Abri</Badge>
                                  )}
                                </div>

                                {/* Info culture */}
                                <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
                                  {culture.ageJours !== null && (
                                    <span className={culture.isJeune ? "text-green-600 font-medium" : ""}>
                                      {culture.ageJours < 7
                                        ? `${culture.ageJours}j`
                                        : `${Math.floor(culture.ageJours / 7)}sem`}
                                      {culture.isJeune && " (jeune)"}
                                    </span>
                                  )}
                                  {culture.planche?.irrigation && (
                                    <span className="flex items-center gap-1">
                                      <Droplets className="h-3 w-3" />
                                      {culture.planche.irrigation}
                                    </span>
                                  )}
                                  {culture.consommationEauSemaine > 0 && (
                                    <span>~{Math.round(culture.consommationEauSemaine)}L/sem</span>
                                  )}
                                  {culture.prochainesIrrigations > 0 && (
                                    <span className="text-blue-600">
                                      +{culture.prochainesIrrigations} planifiee{culture.prochainesIrrigations > 1 ? 's' : ''} (7j)
                                    </span>
                                  )}
                                  {culture.irrigationsAutoValidees > 0 && (
                                    <span className="text-green-600">
                                      <CheckCircle2 className="h-3 w-3 inline mr-0.5" />
                                      {culture.irrigationsAutoValidees} auto-validee{culture.irrigationsAutoValidees > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                              {getUrgenceBadge(culture.urgence, jamais)}

                              <div className={`text-xs sm:text-sm flex items-center gap-1 whitespace-nowrap ${urgenceColor}`}>
                                {!jamais ? (
                                  <>
                                    <Droplets className="h-3 w-3 flex-shrink-0" />
                                    <span>
                                      {culture.joursSansEau === 0 ? "Auj." : `${culture.joursSansEau}j`}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-slate-400 text-xs">Jamais</span>
                                )}
                              </div>

                              {/* Meteo culture */}
                              {culture.meteo && culture.meteo.pluie48h > 0 && (
                                <span className="text-xs text-blue-500 flex items-center gap-0.5">
                                  <CloudRain className="h-3 w-3" />
                                  {Math.round(culture.meteo.pluie48h)}mm
                                </span>
                              )}

                              <div className="text-sm">
                                {getBesoinEauBadge(
                                  culture.espece?.besoinEau || null,
                                  culture.espece?.irrigation || null
                                )}
                              </div>

                              {culture.planche && (
                                <Link href={`/maraichage/planches/${encodeURIComponent(culture.planche.nom || culture.planche.id)}`}>
                                  <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200 whitespace-nowrap">
                                    {culture.planche.nom || culture.planche.id}
                                  </Badge>
                                </Link>
                              )}

                              {culture.urgence !== 'aucune' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => marquerArrosee(culture.id)}
                                  className="h-8 w-8 p-0 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
                                  title="Marquer comme arrose"
                                >
                                  <Droplet className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Raison urgence */}
                          {culture.raisonUrgence && (
                            <div className="flex items-start gap-1.5 pl-9 sm:pl-10">
                              <Info className={`h-3 w-3 flex-shrink-0 mt-0.5 ${urgenceColor}`} />
                              <p className={`text-xs ${urgenceColor}`}>
                                {culture.raisonUrgence}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
            })}
          </div>
        )}

        {/* Historique recent */}
        {filteredData.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm">Historique recent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {filteredData
                  .filter(c => c.derniereIrrigation)
                  .sort((a, b) => new Date(b.derniereIrrigation!).getTime() - new Date(a.derniereIrrigation!).getTime())
                  .slice(0, 10)
                  .map(c => (
                    <div key={c.id} className="flex items-center justify-between text-sm py-1">
                      <div className="flex items-center gap-2">
                        {c.espece?.couleur && (
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: c.espece.couleur }}
                          />
                        )}
                        <span>{c.especeId}</span>
                        {c.planche && (
                          <Badge variant="secondary" className="text-xs">{c.planche.nom || c.planche.id}</Badge>
                        )}
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {new Date(c.derniereIrrigation!).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                {filteredData.filter(c => c.derniereIrrigation).length === 0 && (
                  <p className="text-sm text-muted-foreground italic">Aucun arrosage enregistre</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

export default function CulturesIrriguerPage() {
  return (
    <Suspense fallback={<Skeleton className="h-screen w-full" />}>
      <CulturesIrriguerContent />
    </Suspense>
  )
}
