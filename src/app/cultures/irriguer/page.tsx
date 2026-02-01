"use client"

/**
 * Page des cultures a irriguer
 */

import * as React from "react"
import { Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Droplets, Check, RefreshCw, Droplet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  urgence: 'critique' | 'haute' | 'moyenne' | 'faible'
  consommationEauSemaine: number
  prochainesIrrigations: number
  espece: {
    id: string
    couleur: string | null
    besoinEau: number | null
    irrigation: string | null
  } | null
  planche: {
    id: string
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
  jamaisArrose: number
  prochainesIrrigations7j: number
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
  const [isLoading, setIsLoading] = React.useState(true)
  const [annee, setAnnee] = React.useState(
    parseInt(searchParams.get("annee") || new Date().getFullYear().toString())
  )
  const [groupBy, setGroupBy] = React.useState<'ilot' | 'type-irrigation' | 'urgence'>('ilot')
  const [filtreUrgence, setFiltreUrgence] = React.useState<'all' | 'critique' | 'haute' | 'jamais'>('all')
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
    } catch (error) {
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

      // Mettre a jour localement
      setData(prev => prev.map(c =>
        c.id === cultureId ? { ...c, aIrriguer: !currentValue } : c
      ))
      setParIlot(prev => {
        const newParIlot: Record<string, CultureIrriguer[]> = {}
        for (const [ilot, cultures] of Object.entries(prev)) {
          newParIlot[ilot] = cultures.map(c =>
            c.id === cultureId ? { ...c, aIrriguer: !currentValue } : c
          )
        }
        return newParIlot
      })

      toast({
        title: "Mis a jour",
        description: currentValue ? "Irrigation desactivee" : "Irrigation activee",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre a jour",
      })
    }
  }

  // Marquer une culture comme arrosee
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

      // Mettre a jour localement
      setData(prev => prev.map(c =>
        c.id === cultureId ? { ...c, derniereIrrigation: now } : c
      ))
      setParIlot(prev => {
        const newParIlot: Record<string, CultureIrriguer[]> = {}
        for (const [ilot, cultures] of Object.entries(prev)) {
          newParIlot[ilot] = cultures.map(c =>
            c.id === cultureId ? { ...c, derniereIrrigation: now } : c
          )
        }
        return newParIlot
      })

      toast({
        title: "Arrosage note",
        description: "Derniere irrigation mise a jour",
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de noter l'arrosage",
      })
    }
  }

  // Marquer tout un ilot comme arrose
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

      // Mettre a jour localement
      setData(prev => prev.map(c =>
        cultureIds.includes(c.id) ? { ...c, derniereIrrigation: now } : c
      ))
      setParIlot(prev => {
        const newParIlot: Record<string, CultureIrriguer[]> = {}
        for (const [i, cultures] of Object.entries(prev)) {
          newParIlot[i] = cultures.map(c =>
            cultureIds.includes(c.id) ? { ...c, derniereIrrigation: now } : c
          )
        }
        return newParIlot
      })

      toast({
        title: "Ilot arrose",
        description: `${culturesIlot.length} culture(s) marquee(s)`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de noter l'arrosage",
      })
    }
  }

  // Couleur selon urgence
  const getUrgenceColor = (urgence: string, jamais: boolean): string => {
    if (jamais) return "text-gray-500"
    if (urgence === 'critique') return "text-red-600"
    if (urgence === 'haute') return "text-orange-500"
    if (urgence === 'moyenne') return "text-yellow-600"
    return "text-green-600"
  }

  const getUrgenceBadge = (urgence: string, jamais: boolean) => {
    if (jamais) return <Badge variant="secondary" className="bg-gray-100 text-gray-600">Jamais arrosé</Badge>
    if (urgence === 'critique') return <Badge variant="destructive">Urgent</Badge>
    if (urgence === 'haute') return <Badge className="bg-orange-500">Priorité</Badge>
    if (urgence === 'moyenne') return <Badge className="bg-yellow-500">Moyen</Badge>
    return <Badge variant="secondary" className="bg-green-100 text-green-700">OK</Badge>
  }

  const getBesoinEauBadge = (besoinEau: number | null, irrigation: string | null) => {
    if (irrigation === 'Eleve' || (besoinEau && besoinEau >= 4)) {
      return <Badge variant="destructive">Élevé</Badge>
    }
    if (besoinEau && besoinEau >= 3) {
      return <Badge variant="default" className="bg-orange-500">Moyen</Badge>
    }
    return <Badge variant="secondary">Faible</Badge>
  }

  // Appliquer les filtres
  const filteredData = React.useMemo(() => {
    let filtered = data

    // Filtre urgence
    if (filtreUrgence !== 'all') {
      if (filtreUrgence === 'jamais') {
        filtered = filtered.filter(c => c.joursSansEau === null)
      } else {
        filtered = filtered.filter(c => c.urgence === filtreUrgence)
      }
    }

    // Filtre type irrigation
    if (filtreTypeIrrigation !== 'all') {
      filtered = filtered.filter(c => c.planche?.irrigation === filtreTypeIrrigation)
    }

    // Filtre besoin eau
    if (filtreBesoinEau !== 'all') {
      const seuil = parseInt(filtreBesoinEau)
      filtered = filtered.filter(c => (c.espece?.besoinEau || 0) >= seuil)
    }

    return filtered
  }, [data, filtreUrgence, filtreTypeIrrigation, filtreBesoinEau])

  // Regrouper selon le choix
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
        const key = c.planche?.irrigation || 'Non défini'
        if (!groups[key]) groups[key] = []
        groups[key].push(c)
      })
      return groups
    } else {
      // Grouper par urgence
      const groups: Record<string, typeof filteredData> = {
        'Critique (>3j)': filteredData.filter(c => c.urgence === 'critique'),
        'Haute (3j)': filteredData.filter(c => c.urgence === 'haute'),
        'Jamais arrosé': filteredData.filter(c => c.joursSansEau === null),
        'Moyenne (2j)': filteredData.filter(c => c.urgence === 'moyenne'),
        'OK (<2j)': filteredData.filter(c => c.urgence === 'faible'),
      }
      // Retirer les groupes vides
      Object.keys(groups).forEach(key => {
        if (groups[key].length === 0) delete groups[key]
      })
      return groups
    }
  }, [filteredData, groupBy])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/cultures">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cultures
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Droplets className="h-6 w-6 text-cyan-600" />
              <h1 className="text-xl font-bold">Cultures a irriguer</h1>
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
        {/* Filtres */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ilot">Grouper par îlot</SelectItem>
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
              <SelectItem value="critique">🔴 Critique</SelectItem>
              <SelectItem value="haute">🟠 Haute</SelectItem>
              <SelectItem value="jamais">⚪ Jamais arrosé</SelectItem>
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
              <SelectItem value="4">Élevé (≥4)</SelectItem>
              <SelectItem value="3">Moyen (3)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats enrichies */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-cyan-600" />
                  Cultures a irriguer
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className={stats.critique > 0 ? "border-red-300 bg-red-50" : ""}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Urgences</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{stats.critique + stats.haute}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.critique} critique · {stats.haute} haute · {stats.jamaisArrose} jamais
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">7 prochains jours</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">{stats.prochainesIrrigations7j}</p>
                <p className="text-xs text-muted-foreground mt-1">irrigations planifiées</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Consommation</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-cyan-600">{stats.consommationTotaleEstimee}L</p>
                <p className="text-xs text-muted-foreground mt-1">par semaine (estimé)</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Info */}
        <div className="mb-4 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
          <p className="text-sm text-cyan-800">
            Cette page liste les cultures en place qui necessitent une irrigation reguliere
            (besoin en eau eleve ou marque manuellement). Cochez/decochez pour gerer le statut.
          </p>
        </div>

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
              // Calculer la consommation totale du groupe
              const consommationGroupe = cultures.reduce((sum, c) => sum + c.consommationEauSemaine, 0)
              const prochainesGroupe = cultures.reduce((sum, c) => sum + c.prochainesIrrigations, 0)

              return (
              <Card key={groupe}>
                <CardHeader>
                  <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="whitespace-nowrap">{groupe}</Badge>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {cultures.length} culture(s)
                      </span>
                      {groupBy === 'ilot' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => marquerIlotArrose(groupe)}
                          className="text-cyan-600 border-cyan-300 hover:bg-cyan-50 whitespace-nowrap"
                        >
                          <Droplet className="h-4 w-4 mr-1" />
                          Tout arroser
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        <Droplets className="h-3 w-3 text-cyan-600 flex-shrink-0" />
                        <span>{Math.round(consommationGroupe)}L/sem</span>
                      </div>
                      {prochainesGroupe > 0 && (
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <span className="text-blue-600">+{prochainesGroupe} à venir</span>
                        </div>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {cultures.map((culture) => {
                      const jamais = culture.joursSansEau === null
                      const urgenceColor = getUrgenceColor(culture.urgence, jamais)

                      return (
                        <div
                          key={culture.id}
                          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg transition-colors ${
                            culture.urgence === 'critique' ? 'bg-red-50 border border-red-200' :
                            culture.urgence === 'haute' ? 'bg-orange-50 border border-orange-200' :
                            jamais ? 'bg-gray-100 border border-gray-300' :
                            'bg-gray-50'
                          }`}
                        >
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
                              </div>

                              {/* Info complémentaire */}
                              <div className="flex items-center gap-2 sm:gap-3 text-xs text-muted-foreground flex-wrap">
                                {/* Âge de la culture */}
                                {culture.ageJours !== null && (
                                  <span className={culture.isJeune ? "text-green-600 font-medium" : ""}>
                                    {culture.isJeune && "🌱 "}
                                    {culture.ageJours < 7
                                      ? `${culture.ageJours}j`
                                      : `${Math.floor(culture.ageJours / 7)}sem`}
                                    {culture.isJeune && " (jeune)"}
                                  </span>
                                )}

                                {/* Type irrigation planche */}
                                {culture.planche?.irrigation && (
                                  <span className="flex items-center gap-1">
                                    <Droplets className="h-3 w-3" />
                                    {culture.planche.irrigation}
                                  </span>
                                )}

                                {/* Consommation */}
                                {culture.consommationEauSemaine > 0 && (
                                  <span>~{Math.round(culture.consommationEauSemaine)}L/sem</span>
                                )}

                                {/* Prochaines irrigations */}
                                {culture.prochainesIrrigations > 0 && (
                                  <span className="text-blue-600">
                                    +{culture.prochainesIrrigations} planifiée{culture.prochainesIrrigations > 1 ? 's' : ''} (7j)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            {/* Urgence badge */}
                            {getUrgenceBadge(culture.urgence, jamais)}

                            {/* Derniere irrigation */}
                            <div className={`text-xs sm:text-sm flex items-center gap-1 whitespace-nowrap ${urgenceColor}`}>
                              {!jamais ? (
                                <>
                                  <Droplets className="h-3 w-3 flex-shrink-0" />
                                  <span>
                                    {culture.joursSansEau === 0 ? "Auj." : `${culture.joursSansEau}j`}
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-400 text-xs">Jamais</span>
                              )}
                            </div>

                            {/* Besoin eau */}
                            <div className="text-sm">
                              {getBesoinEauBadge(
                                culture.espece?.besoinEau || null,
                                culture.espece?.irrigation || null
                              )}
                            </div>

                            {/* Planche */}
                            {culture.planche && (
                              <Link href={`/planches/${encodeURIComponent(culture.planche.id)}`}>
                                <Badge variant="secondary" className="cursor-pointer hover:bg-gray-200 whitespace-nowrap">
                                  {culture.planche.id}
                                </Badge>
                              </Link>
                            )}

                            {/* Bouton arroser */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => marquerArrosee(culture.id)}
                              className="h-8 w-8 p-0 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
                              title="Marquer comme arrose"
                            >
                              <Droplet className="h-4 w-4" />
                            </Button>
                          </div>
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

        {/* Historique récent (10 derniers arrosages) */}
        {filteredData.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm">Historique récent</CardTitle>
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
                          <Badge variant="secondary" className="text-xs">{c.planche.id}</Badge>
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
                  <p className="text-sm text-muted-foreground italic">Aucun arrosage enregistré</p>
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
